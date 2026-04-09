import os
from dotenv import load_dotenv
import requests
from collections import defaultdict
import time
from io import StringIO
import contextlib
from ai_coach import build_ai_coach
from services.wincon import analyze_wincons_for_game

MATCH_DETAILS_CACHE = {}
MATCH_TIMELINE_CACHE = {}


def safe_riot_request(url: str, retries: int = 3, delay: float = 0.5):
    """
    Wrapper for all Riot API requests.
    Handles:
      - 429 (rate limit)
      - 500/502/503 temporary issues
      - timeouts
      - invalid JSON
    """
    for attempt in range(retries):
        try:
            resp = requests.get(url, headers=riot_headers(), timeout=5)

            if resp.status_code == 429:
                wait = int(resp.headers.get("Retry-After", 1))
                time.sleep(wait)
                continue

            if resp.status_code >= 500:
                time.sleep(delay)
                continue

            if resp.status_code != 200:
                raise RuntimeError(
                    f"Riot API error {resp.status_code}: {resp.text}"
                )

            return resp.json()

        except requests.exceptions.Timeout:
            time.sleep(delay)
            continue

        except Exception as e:
            raise RuntimeError(f"Network error: {e}")

    raise RuntimeError("Riot API failed after multiple retry attempts.")


load_dotenv()
RIOT_API_KEY = os.getenv("RIOT_API_KEY")


# 2) Basic config
REGION_ROUTING = "americas"  # for match/account routes in NA
PLATFORM_ROUTING = "na1"     # platform routing for NA


def riot_headers():
    if not RIOT_API_KEY:
        raise RuntimeError("Missing RIOT_API_KEY. Set it in your environment (or in a local .env).")
    return {
        "X-Riot-Token": RIOT_API_KEY
    }


def test_riot_connection():
    """
    Hits a simple Riot endpoint to make sure our key works.
    """
    url = f"https://{PLATFORM_ROUTING}.api.riotgames.com/lol/status/v4/platform-data"
    resp = requests.get(url, headers=riot_headers())

    print("Status code:", resp.status_code)
    if resp.status_code != 200:
        print("Something is wrong. Response text:")
        print(resp.text)
    else:
        data = resp.json()
        print("Connected! Riot API is responding.")
        print("Platform Name:", data.get("name"))
        print("Region ID:", data.get("id"))


def get_puuid_from_riot_id(game_name: str, tag_line: str) -> str:
    """
    Given a Riot ID (game_name + tag_line), return the player's PUUID.
    """
    url = f"https://{REGION_ROUTING}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/{game_name}/{tag_line}"
    data = safe_riot_request(url)
    return data["puuid"]


def get_recent_match_ids(puuid: str, count: int = 20):
    """
    Given a PUUID, return a list of recent match IDs.
    Riot's API supports up to 100 per call.
    """
    # safety clamp
    if count > 100:
        count = 100
    if count < 1:
        count = 1

    url = (
        f"https://{REGION_ROUTING}.api.riotgames.com/"
        f"lol/match/v5/matches/by-puuid/{puuid}/ids?count={count}"
    )

    return safe_riot_request(url)


def get_match_details(match_id: str) -> dict:
    # Check cache
    if match_id in MATCH_DETAILS_CACHE:
        return MATCH_DETAILS_CACHE[match_id]

    # Fetch with safety + rate limit protection
    url = f"https://{REGION_ROUTING}.api.riotgames.com/lol/match/v5/matches/{match_id}"
    data = safe_riot_request(url)

    # Save to cache
    MATCH_DETAILS_CACHE[match_id] = data
    return data


def get_match_timeline(match_id: str) -> dict:
    # Check cache
    if match_id in MATCH_TIMELINE_CACHE:
        return MATCH_TIMELINE_CACHE[match_id]

    # Fetch with safety
    url = f"https://{REGION_ROUTING}.api.riotgames.com/lol/match/v5/matches/{match_id}/timeline"
    data = safe_riot_request(url)

    # Save to cache
    MATCH_TIMELINE_CACHE[match_id] = data
    return data


def get_player_stats_from_match(match_data: dict, puuid: str) -> dict:
    """
    From a full match JSON + our player's PUUID, return a small dict
    with just the stats we care about for that player.
    """
    metadata = match_data["metadata"]
    info = match_data["info"]

    # Find which index in the participants list is our player
    puuid_list = metadata["participants"]
    try:
        idx = puuid_list.index(puuid)
    except ValueError:
        raise RuntimeError("PUUID not found in match participants")

    p = info["participants"][idx]

    # --- basic combat/econ stats ---
    kills = p["kills"]
    deaths = p["deaths"]
    assists = p["assists"]
    kda = (kills + assists) / max(1, deaths)

    total_cs = p["totalMinionsKilled"] + p["neutralMinionsKilled"]
    time_minutes = p["timePlayed"] / 60.0
    cs_per_min = total_cs / time_minutes if time_minutes > 0 else 0.0

    gold_earned = p["goldEarned"]
    xp = p["champExperience"]
    gpm = gold_earned / time_minutes if time_minutes > 0 else 0.0
    xpm = xp / time_minutes if time_minutes > 0 else 0.0

    team_id = p["teamId"]
    team_kills = sum(q["kills"] for q in info["participants"] if q["teamId"] == team_id)
    kp = (kills + assists) / max(1, team_kills) if team_kills > 0 else 0.0

    # --- challenges block (where jungle stats actually live) ---
    ch = p.get("challenges", {})

    scuttle_count = ch.get("scuttleCrabKills", 0)
    ally_jng_cs = ch.get("alliedJungleMonsterKills", 0)
    enemy_jng_cs = ch.get("enemyJungleMonsterKills", 0)
    jungle_cs_10 = ch.get("jungleCsBefore10Minutes", 0)

    return {
        "match_id": metadata["matchId"],
        "champion": p["championName"],
        "role": p.get("teamPosition", "UNKNOWN"),
        "team_id": team_id,
        "participant_id": p["participantId"],
        "win": p["win"],
        "kills": kills,
        "deaths": deaths,
        "assists": assists,
        "kda": kda,
        "kp": kp,
        "total_cs": total_cs,
        "cs_per_min": cs_per_min,
        "gold_earned": gold_earned,
        "xp": xp,
        "gpm": gpm,
        "xpm": xpm,
        "game_duration_min": time_minutes,
        # jungle-specific goodies
        "scuttle_count": scuttle_count,
        "ally_jng_cs": ally_jng_cs,
        "enemy_jng_cs": enemy_jng_cs,
        "jungle_cs_10": jungle_cs_10,
    }


def get_frame_closest_to_time(frames, target_seconds: float):
    """
    Given the list of frames and a target time in seconds,
    return the frame whose timestamp is closest to that time.
    """
    best_frame = None
    best_diff = None

    for frame in frames:
        # Riot timestamps are in milliseconds
        t_sec = frame["timestamp"] / 1000.0
        diff = abs(t_sec - target_seconds)
        if best_diff is None or diff < best_diff:
            best_diff = diff
            best_frame = frame

    return best_frame


def find_enemy_jungle_participant(match_info: dict, our_team_id: int) -> dict:
    """
    From match info, find the participant dict for the enemy jungler.
    We look for teamPosition == 'JUNGLE' on the opposite team.
    Fallback: highest neutralMinionsKilled on enemy team.
    """
    enemy_team_id = 100 if our_team_id == 200 else 200

    # First try: role-tagged jungler
    for p in match_info["participants"]:
        if p["teamId"] == enemy_team_id and p.get("teamPosition") == "JUNGLE":
            return p

    # Fallback: enemy with highest neutral CS (still jungle-ish)
    candidates = [p for p in match_info["participants"] if p["teamId"] == enemy_team_id]
    if not candidates:
        raise RuntimeError("No enemy team participants found")

    best = max(candidates, key=lambda p: p.get("neutralMinionsKilled", 0))
    return best


def classify_lane_from_position(x: int, y: int) -> str | None:
    """
    Roughly classify a Summoner's Rift position into TOP / MID / BOT.
    Coords are approximate; good enough for analytics.
    """
    # Map is ~0..15000 on both axes.
    # Top lane: upper-left area
    if x <= 6000 and y >= 8000:
        return "TOP"

    # Bot lane: lower-right area
    if x >= 9000 and y <= 7000:
        return "BOT"

    # Mid lane: central band
    if 6000 < x < 9000 and 6000 < y < 9000:
        return "MID"

    return None  # jungle / river / base / etc


def compute_lane_presence(timeline: dict, our_pid: int, max_minutes: float = 14.0):
    """
    Compute how much time (in % of early game) the jungler spends near each lane.
    Returns fractions between 0 and 1 for top/mid/bot.
    """
    frames = timeline["info"]["frames"]
    lane_counts = {"TOP": 0, "MID": 0, "BOT": 0}
    total_lane_frames = 0

    cutoff_seconds = max_minutes * 60.0

    for frame in frames:
        t_sec = frame["timestamp"] / 1000.0
        if t_sec > cutoff_seconds:
            break

        pf = frame["participantFrames"][str(our_pid)]
        pos = pf.get("position")
        if not pos:
            continue

        x = pos.get("x")
        y = pos.get("y")
        if x is None or y is None:
            continue

        lane = classify_lane_from_position(x, y)
        if lane is None:
            continue

        lane_counts[lane] += 1
        total_lane_frames += 1

    if total_lane_frames == 0:
        return {
            "presence_top": 0.0,
            "presence_mid": 0.0,
            "presence_bot": 0.0,
        }

    return {
        "presence_top": lane_counts["TOP"] / total_lane_frames,
        "presence_mid": lane_counts["MID"] / total_lane_frames,
        "presence_bot": lane_counts["BOT"] / total_lane_frames,
    }


def compute_early_lane_stats(timeline: dict, our_pid: int, enemy_jng_pid: int):
    """
    Using the timeline, compute early-game stats around 10 minutes:
    - our CS @10
    - CS diff @10
    - XP diff @10
    - gold diff @10
    """
    frames = timeline["info"]["frames"]

    # Get frame closest to 10 minutes
    frame_10 = get_frame_closest_to_time(frames, target_seconds=10 * 60)

    pf_ours = frame_10["participantFrames"][str(our_pid)]
    pf_enemy = frame_10["participantFrames"][str(enemy_jng_pid)]

    our_cs_10 = pf_ours["minionsKilled"] + pf_ours["jungleMinionsKilled"]
    enemy_cs_10 = pf_enemy["minionsKilled"] + pf_enemy["jungleMinionsKilled"]
    cs_diff_10 = our_cs_10 - enemy_cs_10

    our_xp_10 = pf_ours["xp"]
    enemy_xp_10 = pf_enemy["xp"]
    xp_diff_10 = our_xp_10 - enemy_xp_10

    our_gold_10 = pf_ours["totalGold"]
    enemy_gold_10 = pf_enemy["totalGold"]
    gold_diff_10 = our_gold_10 - enemy_gold_10

    return {
        "cs_10": our_cs_10,
        "cs_diff_10": cs_diff_10,
        "xp_diff_10": xp_diff_10,
        "gold_diff_10": gold_diff_10,
    }


# ---------- NEW: GANK + OBJECTIVE ANALYTICS (NO CAMP TRACKING) ----------

def extract_early_gank_stats(timeline: dict, match_info: dict, our_pid: int, max_minutes: float = 14.0):
    """
    From the timeline, compute:
      - time of first gank we participate in (kill or assist)
      - lane of that first gank (TOP/MID/BOT)
      - count of ganks per lane (based on kill participation)
    """
    frames = timeline["info"]["frames"]
    cutoff_seconds = max_minutes * 60.0

    # Map participantId -> lane (TOP/MID/BOT) from match_info
    lane_map = {}
    for p in match_info["participants"]:
        pid = p["participantId"]
        lane = p.get("teamPosition")
        lane_map[pid] = lane if lane in ("TOP", "MIDDLE", "MID", "BOTTOM", "BOT") else None

    def normalize_lane(label: str | None) -> str | None:
        if label in ("TOP",):
            return "TOP"
        if label in ("MIDDLE", "MID"):
            return "MID"
        if label in ("BOTTOM", "BOT"):
            return "BOT"
        return None

    first_gank_time = None
    first_gank_lane = None
    gank_counts = {"TOP": 0, "MID": 0, "BOT": 0}

    for frame in frames:
        t_sec = frame["timestamp"] / 1000.0
        if t_sec > cutoff_seconds:
            break

        for event in frame.get("events", []):
            if event.get("type") != "CHAMPION_KILL":
                continue

            killer = event.get("killerId")
            assists = event.get("assistingParticipantIds") or []
            victim = event.get("victimId")

            if our_pid not in ([killer] + assists):
                continue  # we didn't participate

            # Determine lane of the gank using victim lane or position
            lane = None

            # Try lane from match info
            raw_lane = lane_map.get(victim)
            lane = normalize_lane(raw_lane)

            # Fallback: classify by event position if needed
            if lane is None:
                pos = event.get("position")
                if pos:
                    lane = classify_lane_from_position(pos.get("x", 0), pos.get("y", 0))

            if lane not in ("TOP", "MID", "BOT"):
                continue  # ignore kills in jungle/river/base

            gank_counts[lane] += 1

            if first_gank_time is None:
                first_gank_time = t_sec
                first_gank_lane = lane

    return {
        "first_gank_time": first_gank_time,  # seconds or None
        "first_gank_lane": first_gank_lane,  # 'TOP'/'MID'/'BOT' or None
        "ganks_top": gank_counts["TOP"],
        "ganks_mid": gank_counts["MID"],
        "ganks_bot": gank_counts["BOT"],
    }


def extract_objective_stats(timeline: dict, our_team_id: int):
    """
    From the timeline, compute high-level objective stats:
      - dragons/heralds/barons taken by our team vs enemy
      - time of first dragon and which team got it
    """
    frames = timeline["info"]["frames"]

    our_dragons = 0
    enemy_dragons = 0
    our_heralds = 0
    enemy_heralds = 0
    our_barons = 0
    enemy_barons = 0

    first_dragon_time = None
    first_dragon_team = None  # 'ALLY' or 'ENEMY'

    for frame in frames:
        for event in frame.get("events", []):
            if event.get("type") != "ELITE_MONSTER_KILL":
                continue

            monster_type = event.get("monsterType")
            killer_team = event.get("killerTeamId")
            t_sec = event.get("timestamp", 0) / 1000.0

            if monster_type == "DRAGON":
                if first_dragon_time is None:
                    first_dragon_time = t_sec
                    first_dragon_team = "ALLY" if killer_team == our_team_id else "ENEMY"

                if killer_team == our_team_id:
                    our_dragons += 1
                else:
                    enemy_dragons += 1

            elif monster_type == "RIFTHERALD":
                if killer_team == our_team_id:
                    our_heralds += 1
                else:
                    enemy_heralds += 1

            elif monster_type == "BARON_NASHOR":
                if killer_team == our_team_id:
                    our_barons += 1
                else:
                    enemy_barons += 1

    return {
        "our_dragons": our_dragons,
        "enemy_dragons": enemy_dragons,
        "our_heralds": our_heralds,
        "enemy_heralds": enemy_heralds,
        "our_barons": our_barons,
        "enemy_barons": enemy_barons,
        "first_dragon_time": first_dragon_time,
        "first_dragon_team": first_dragon_team,
    }


# -------------------- GRADING & REPORTS --------------------

def grade_from_value(value: float, bands: list[tuple[float, str]]) -> str:
    """
    Given a value and a list of (threshold, letter) sorted high → low,
    return the first letter where value >= threshold.
    Example bands: [(10, 'A'), (5, 'B'), (0, 'C'), (-5, 'D'), (-999, 'F')]
    """
    for threshold, letter in bands:
        if value >= threshold:
            return letter
    return bands[-1][1]


def format_time_mmss(seconds: float | None) -> str:
    if seconds is None:
        return "N/A"
    m = int(seconds // 60)
    s = int(seconds % 60)
    return f"{m:02d}:{s:02d}"


def analyze_player_games(player_games: list[dict]) -> None:
    """
    Print a small jungle-coaching style report from the collected games.
    """
    if not player_games:
        print("\nNo jungle games to analyze after filtering.")
        return

    n_games = len(player_games)
    wins = sum(1 for g in player_games if g.get("win"))
    winrate = wins / n_games * 100.0

    avg_kda = sum(g.get("kda", 0.0) for g in player_games) / n_games
    avg_cs10 = sum(g.get("cs_10", 0.0) for g in player_games) / n_games
    avg_cs_diff10 = sum(g.get("cs_diff_10", 0.0) for g in player_games) / n_games
    avg_xp_diff10 = sum(g.get("xp_diff_10", 0.0) for g in player_games) / n_games
    avg_gold_diff10 = sum(g.get("gold_diff_10", 0.0) for g in player_games) / n_games
    avg_scuttles = sum(g.get("scuttle_count", 0.0) for g in player_games) / n_games
    avg_more_enemy_jg = sum(g.get("more_enemy_jungle", 0.0) for g in player_games) / n_games

    # gank averages (only for games with at least one gank)
    gank_games = [g for g in player_games if g.get("first_gank_time") is not None]
    if gank_games:
        avg_first_gank_time = sum(g["first_gank_time"] for g in gank_games) / len(gank_games)
    else:
        avg_first_gank_time = None

    total_ganks_top = sum(g.get("ganks_top", 0) for g in player_games)
    total_ganks_mid = sum(g.get("ganks_mid", 0) for g in player_games)
    total_ganks_bot = sum(g.get("ganks_bot", 0) for g in player_games)

    # objective averages
    avg_our_drags = sum(g.get("our_dragons", 0) for g in player_games) / n_games
    avg_enemy_drags = sum(g.get("enemy_dragons", 0) for g in player_games) / n_games
    avg_our_heralds = sum(g.get("our_heralds", 0) for g in player_games) / n_games
    avg_enemy_heralds = sum(g.get("enemy_heralds", 0) for g in player_games) / n_games

    dragon_games = [g for g in player_games if g.get("first_dragon_time") is not None]
    if dragon_games:
        avg_first_drag_time = sum(g["first_dragon_time"] for g in dragon_games) / len(dragon_games)
    else:
        avg_first_drag_time = None

    print("\n================ Jungle Performance Summary ================")
    print(f"Games analyzed: {n_games}")
    print(f"Winrate:       {winrate:.1f}%  ({wins}W / {n_games - wins}L)")
    print(f"Average KDA:   {avg_kda:.2f}")
    print(f"CS @10:        {avg_cs10:.1f}   (diff @10: {avg_cs_diff10:+.1f})")
    print(f"XP diff @10:   {avg_xp_diff10:+.1f}")
    print(f"Gold diff @10: {avg_gold_diff10:+.1f}")
    print(f"Scuttles:      {avg_scuttles:.2f} per game")
    print(f"Invade score:  {avg_more_enemy_jg:+.1f}  (moreEnemyJungleThanOpponent)")
    print("------------------------------------------------------------")
    print(f"gank time: {format_time_mmss(avg_first_gank_time)}")
    print(f"Total ganks – TOP: {total_ganks_top}, MID: {total_ganks_mid}, BOT: {total_ganks_bot}")
    print("------------------------------------------------------------")
    print(f"Avg dragons:  you {avg_our_drags:.2f}  | enemy {avg_enemy_drags:.2f}")
    print(f"Avg heralds:  you {avg_our_heralds:.2f} | enemy {avg_enemy_heralds:.2f}")
    print(f"Avg first dragon time: {format_time_mmss(avg_first_drag_time)}")
    print("============================================================")

    # 1) Lane presence WR (0–14 min)
    lane_buckets = defaultdict(lambda: {
        "games": 0,
        "wins": 0,
        "kda_sum": 0.0,
        "cs10_sum": 0.0,
        "gold_diff10_sum": 0.0,
    })

    for g in player_games:
        top_p = g.get("presence_top", 0.0)
        mid_p = g.get("presence_mid", 0.0)
        bot_p = g.get("presence_bot", 0.0)

        lane_vals = {"TOP": top_p, "MID": mid_p, "BOT": bot_p}
        dominant_lane = max(lane_vals, key=lane_vals.get)
        if lane_vals[dominant_lane] < 0.2:
            lane = "MIXED"
        else:
            lane = dominant_lane

        bucket = lane_buckets[lane]
        bucket["games"] += 1
        if g.get("win"):
            bucket["wins"] += 1
        bucket["kda_sum"] += g.get("kda", 0.0)
        bucket["cs10_sum"] += g.get("cs_10", 0.0)
        bucket["gold_diff10_sum"] += g.get("gold_diff_10", 0.0)

    print("\nLane focus (0–14 min) performance:")
    for lane in ["BOT", "MID", "TOP", "MIXED"]:
        b = lane_buckets.get(lane)
        if not b or b["games"] == 0:
            continue
        gcount = b["games"]
        wr = b["wins"] / gcount * 100.0
        avg_lane_kda = b["kda_sum"] / gcount
        avg_lane_cs10 = b["cs10_sum"] / gcount
        avg_lane_gold_diff10 = b["gold_diff10_sum"] / gcount
        print(
            f"  {lane}: {wr:5.1f}% WR over {gcount:2d} games | "
            f"KDA {avg_lane_kda:.2f}, CS@10 {avg_lane_cs10:.1f}, "
            f"Gold diff@10 {avg_lane_gold_diff10:+.1f}"
        )

    # 2) Jungle matchup mini-table
    matchup_stats = defaultdict(lambda: {"games": 0, "wins": 0})

    for g in player_games:
        our_champ = g.get("champion", "Unknown")
        enemy_champ = g.get("enemy_jungle_champion", "Unknown")
        key = (our_champ, enemy_champ)
        m = matchup_stats[key]
        m["games"] += 1
        if g.get("win"):
            m["wins"] += 1

    sorted_matchups = sorted(
        matchup_stats.items(),
        key=lambda kv: kv[1]["games"],
        reverse=True,
    )

    print("\nMost common jungle matchups:")
    for (our_champ, enemy_champ), m in sorted_matchups[:8]:
        gcount = m["games"]
        wr = m["wins"] / gcount * 100.0 if gcount > 0 else 0.0
        print(
            f"  {our_champ:12s} vs {enemy_champ:12s} "
            f"– {wr:5.1f}% WR over {gcount} games"
        )

    print(
        "\n(Use these numbers to see which lanes & matchups you actually "
        "perform best into, then we can refine the report further.)"
    )


def generate_jungle_report(player_games: list[dict]) -> None:
    """
    Higher-level 'coach style' jungle report with letter grades.
    """
    if not player_games:
        print("\nNo jungle games to generate report from.")
        return

    n = len(player_games)
    wins = sum(1 for g in player_games if g.get("win"))
    winrate = wins / n * 100.0

    # Basic averages
    avg_cs10 = sum(g.get("cs_10", 0.0) for g in player_games) / n
    avg_cs_diff10 = sum(g.get("cs_diff_10", 0.0) for g in player_games) / n
    avg_xp_diff10 = sum(g.get("xp_diff_10", 0.0) for g in player_games) / n
    avg_gold_diff10 = sum(g.get("gold_diff_10", 0.0) for g in player_games) / n
    avg_scuttles = sum(g.get("scuttle_count", 0.0) for g in player_games) / n
    avg_invade = sum(g.get("more_enemy_jungle", 0.0) for g in player_games) / n
    avg_kda = sum(g.get("kda", 0.0) for g in player_games) / n

    # Lane presence averages
    avg_top_p = sum(g.get("presence_top", 0.0) for g in player_games) / n
    avg_mid_p = sum(g.get("presence_mid", 0.0) for g in player_games) / n
    avg_bot_p = sum(g.get("presence_bot", 0.0) for g in player_games) / n

    # Gank style
    gank_games = [g for g in player_games if g.get("first_gank_time") is not None]
    if gank_games:
        avg_first_gank_time = sum(g["first_gank_time"] for g in gank_games) / len(gank_games)
    else:
        avg_first_gank_time = None

    total_ganks_top = sum(g.get("ganks_top", 0) for g in player_games)
    total_ganks_mid = sum(g.get("ganks_mid", 0) for g in player_games)
    total_ganks_bot = sum(g.get("ganks_bot", 0) for g in player_games)
    total_ganks_all = total_ganks_top + total_ganks_mid + total_ganks_bot

    # Objective style
    avg_our_drags = sum(g.get("our_dragons", 0) for g in player_games) / n
    avg_enemy_drags = sum(g.get("enemy_dragons", 0) for g in player_games) / n
    avg_our_heralds = sum(g.get("our_heralds", 0) for g in player_games) / n
    avg_enemy_heralds = sum(g.get("enemy_heralds", 0) for g in player_games) / n

    # ---- Grades ----

    # Tempo: mostly xp + gold diff at 10
    tempo_score = (avg_xp_diff10 / 50.0) + (avg_gold_diff10 / 150.0)
    tempo_grade = grade_from_value(tempo_score, [
        (1.2, "S"),
        (0.6, "A"),
        (0.0, "B"),
        (-0.6, "C"),
        (-1.2, "D"),
        (-999, "F"),
    ])

    # Farming / clear quality: cs@10 + cs diff@10
    farm_score = (avg_cs10 - 55) / 5.0 + (avg_cs_diff10 / 5.0)
    farm_grade = grade_from_value(farm_score, [
        (1.5, "S"),
        (0.8, "A"),
        (0.0, "B"),
        (-0.8, "C"),
        (-1.5, "D"),
        (-999, "F"),
    ])

    # Objective / river control: scuttles + dragons/heralds
    obj_score = avg_scuttles + 0.5 * (avg_our_drags - avg_enemy_drags) + 0.3 * (avg_our_heralds - avg_enemy_heralds)
    obj_grade = grade_from_value(obj_score, [
        (5.0, "S"),
        (3.5, "A"),
        (2.0, "B"),
        (0.5, "C"),
        (-0.5, "D"),
        (-999, "F"),
    ])

    # Invading: our custom more_enemy_jungle diff
    invade_grade = grade_from_value(avg_invade, [
        (6.0, "S"),
        (3.0, "A"),
        (0.0, "B"),
        (-3.0, "C"),
        (-6.0, "D"),
        (-999, "F"),
    ])

    # General fighting/killing efficiency
    kda_grade = grade_from_value(avg_kda, [
        (5.0, "S"),
        (4.0, "A"),
        (3.0, "B"),
        (2.0, "C"),
        (1.0, "D"),
        (-999, "F"),
    ])

    # Lane focus: where do you live?
    lane_presence = {"TOP": avg_top_p, "MID": avg_mid_p, "BOT": avg_bot_p}
    main_lane = max(lane_presence, key=lane_presence.get)
    main_lane_pct = lane_presence[main_lane] * 100.0

    # Crude overall grade: average of numeric equivalents
    grade_to_value = {"S": 4.5, "A": 4.0, "B": 3.0, "C": 2.0, "D": 1.0, "F": 0.0}
    cats = [tempo_grade, farm_grade, obj_grade, invade_grade, kda_grade]
    overall_value = sum(grade_to_value[g] for g in cats) / len(cats)
    overall_grade = grade_from_value(overall_value, [
        (4.25, "S"),
        (3.5, "A"),
        (2.5, "B"),
        (1.5, "C"),
        (0.5, "D"),
        (-999, "F"),
    ])

    print("\n================ Your Jungle Report ================")
    print(f"Games analyzed: {n} | Winrate: {winrate:.1f}%")
    print(f"Overall jungle grade: {overall_grade}")
    print("----------------------------------------------------")
    print(f"Tempo (early XP/gold leads):       {tempo_grade}")
    print(f"Farming / clear quality:           {farm_grade}")
    print(f"Objective & river control:         {obj_grade}")
    print(f"Invading / jungle control:         {invade_grade}")
    print(f"Skirmishing / KDA:                 {kda_grade}")
    print(f"Primary early focus lane:          {main_lane} "
          f"({main_lane_pct:.1f}% of lane time)")
    print(f"Average first gank time:           {format_time_mmss(avg_first_gank_time)}")
    print(f"Total ganks – TOP: {total_ganks_top}, MID: {total_ganks_mid}, BOT: {total_ganks_bot}")
    print(f"Avg dragons: you {avg_our_drags:.2f} | enemy {avg_enemy_drags:.2f}")
    print(f"Avg heralds: you {avg_our_heralds:.2f} | enemy {avg_enemy_heralds:.2f}")
    print("====================================================")

    # --- Little coachy blurbs ---

    print("\nCoach notes:")

    # Tempo note
    if tempo_grade in ("S", "A"):
        print("- Your early tempo is very strong. You regularly hit XP/gold "
              "leads by 10 minutes; keep stacking efficient clears and "
              "high-value ganks.")
    elif tempo_grade in ("B", "C"):
        print("- Your early tempo is okay but not consistently advantaged. "
              "Tightening first clear paths and avoiding low-value ganks "
              "would convert more games into early leads.")
    else:
        print("- You often fall behind in early tempo (XP/gold at 10). "
              "Focus on clean first clears, safer pathing when lanes lack "
              "prio, and minimizing deaths before level 6.")

    # Invade note
    if invade_grade in ("S", "A"):
        print("- You generally win the jungle vs jungle. Your invades are "
              "paying off; just be sure they line up with lane prio so you "
              "don't coinflip fights.")
    elif invade_grade in ("B", "C"):
        print("- Your invade pressure is neutral on average. Consider looking "
              "for more counter-jungle windows when you have lane prio, but "
              "avoid forcing it when lanes are losing.")
    else:
        print("- You often lose jungle control to the enemy. Path more around "
              "your strong lanes, drop losing quadrants when necessary, and "
              "use defensive vision instead of contesting blindly.")

    # Lane focus note
    if main_lane == "BOT":
        print("- You are primarily a bot-focused jungler. That's usually "
              "good for solo queue; double down on syncing your pathing with "
              "bot wave states and support roams.")
    elif main_lane == "MID":
        print("- You play heavily around mid. Make sure your side lanes still "
              "get enough coverage so you don't bleed plates and dragons while "
              "perma-hovering mid.")
    elif main_lane == "TOP":
        print("- You spend a lot of time top early. Unless top is a true win "
              "condition (counterpick or 1v9 champ), consider shifting a bit "
              "more presence towards bot/mid for dragon and map control.")
    else:
        print("- Your early game presence is fairly evenly split between lanes. "
              "That's flexible, but make sure each game you clearly decide "
              "which lane is your *main* win condition.")

    # Farming note
    if farm_grade in ("S", "A"):
        print("- Your farming and clear efficiency look very strong. Just make "
              "sure you don't overfarm when there are free fights or objectives.")
    elif farm_grade in ("B", "C"):
        print("- Your farm is serviceable but has room to improve. Aim for "
              "slightly higher CS@10 by smoothing your first two clears and "
              "cutting out unnecessary walks.")
    else:
        print("- Your farming is lagging behind. Study 1–2 high-elo VODs for "
              "your main junglers and copy their first 3 camps + recall timings.")

    # Gank style note
    if avg_first_gank_time is not None:
        if avg_first_gank_time <= 210:  # 3:30
            print("- Your first ganks are very early. This can snowball lanes "
                  "hard if synced with prio, but be careful not to sacrifice "
                  "too much farm or die on low-odds plays.")
        elif avg_first_gank_time <= 330:  # 5:30
            print("- Your first gank timing is pretty standard. Look for ways "
                  "to turn good lane states into earlier punish windows when "
                  "enemy junglers are stuck clearing.")
        else:
            print("- Your first ganks tend to come later. That can be fine on "
                  "full-clear champs, but make sure your farm leads at 10 "
                  "minutes actually justify skipping early pressure.")

    print("====================================================\n")

def classify_wincon_archetype(label: str) -> str:
    """
    Map the textual label from wincon.ally['label'] into a coarse archetype.
    This is draft identity, not gameplay:
      - "front_to_back"
      - "early_skirmish"
      - "poke_siege"
      - "hard_engage_wombo"
      - "scaling_teamfight"
      - "balanced"
    """
    lower = label.lower()

    if "front-to-back" in lower or "front to back" in lower:
        return "front_to_back"
    if "early skirmish" in lower or "tempo" in lower:
        return "early_skirmish"
    if "poke & siege" in lower or "poke and siege" in lower or "poke" in lower:
        return "poke_siege"
    if "hard engage wombo" in lower or "wombo" in lower:
        return "hard_engage_wombo"
    if "scaling teamfight" in lower or "scaling" in lower:
        return "scaling_teamfight"
    # fallback if nothing obvious
    return "balanced"


def build_wincon_profile(player_games: list[dict]) -> dict:
    """
    Aggregate draft win-conditions across all games to produce a
    profile-level summary of what kinds of comps you usually play.
    """
    if not player_games:
        return {
            "games_with_wincon": 0,
            "archetype_counts": {},
            "primary_archetype": None,
            "primary_archetype_pct": 0.0,
            "scaling_counts": {},
            "damage_profile_counts": {},
        }

    archetype_counts: dict[str, int] = {}
    scaling_counts: dict[str, int] = {}
    damage_counts: dict[str, int] = {}

    games_with_wincon = 0

    for g in player_games:
        wincon = g.get("wincon")
        if not wincon or wincon.get("status") != "ok":
            continue

        ally = wincon.get("ally")
        if not ally:
            continue

        summary = ally.get("summary", {})
        label = ally.get("label", "")

        archetype = classify_wincon_archetype(label)
        archetype_counts[archetype] = archetype_counts.get(archetype, 0) + 1

        scaling = summary.get("scaling", "mixed")
        scaling_counts[scaling] = scaling_counts.get(scaling, 0) + 1

        damage = summary.get("damage_profile", "mixed")
        damage_counts[damage] = damage_counts.get(damage, 0) + 1

        games_with_wincon += 1

    if games_with_wincon == 0:
        return {
            "games_with_wincon": 0,
            "archetype_counts": {},
            "primary_archetype": None,
            "primary_archetype_pct": 0.0,
            "scaling_counts": {},
            "damage_profile_counts": {},
        }

    # Find primary archetype
    primary_archetype = max(archetype_counts.items(), key=lambda kv: kv[1])[0]
    primary_count = archetype_counts[primary_archetype]
    primary_pct = primary_count / games_with_wincon * 100.0

    return {
        "games_with_wincon": games_with_wincon,
        "archetype_counts": archetype_counts,
        "primary_archetype": primary_archetype,
        "primary_archetype_pct": primary_pct,
        "scaling_counts": scaling_counts,
        "damage_profile_counts": damage_counts,
    }

def build_player_profile(player_games: list[dict]) -> dict:
    """
    Build a structured 'style profile' for the jungler based on the analyzed games.
    This is meant to be consumed by a UI later.
    """
    if not player_games:
        return {
            "games_analyzed": 0,
            "style_summary": "No jungle games found.",
        }

    n = len(player_games)
    wins = sum(1 for g in player_games if g.get("win"))
    winrate = wins / n * 100.0

    avg_kda = sum(g.get("kda", 0.0) for g in player_games) / n
    avg_cs10 = sum(g.get("cs_10", 0.0) for g in player_games) / n
    avg_cs_diff10 = sum(g.get("cs_diff_10", 0.0) for g in player_games) / n
    avg_xp_diff10 = sum(g.get("xp_diff_10", 0.0) for g in player_games) / n
    avg_gold_diff10 = sum(g.get("gold_diff_10", 0.0) for g in player_games) / n
    avg_scuttles = sum(g.get("scuttle_count", 0.0) for g in player_games) / n
    avg_invade = sum(g.get("more_enemy_jungle", 0.0) for g in player_games) / n

    # Lane presence
    avg_top_p = sum(g.get("presence_top", 0.0) for g in player_games) / n
    avg_mid_p = sum(g.get("presence_mid", 0.0) for g in player_games) / n
    avg_bot_p = sum(g.get("presence_bot", 0.0) for g in player_games) / n
    lane_presence = {"TOP": avg_top_p, "MID": avg_mid_p, "BOT": avg_bot_p}
    main_lane = max(lane_presence, key=lane_presence.get)
    main_lane_pct = lane_presence[main_lane] * 100.0

    # Ganks
    gank_games = [g for g in player_games if g.get("first_gank_time") is not None]
    if gank_games:
        avg_first_gank_time = sum(g["first_gank_time"] for g in gank_games) / len(gank_games)
    else:
        avg_first_gank_time = None

    total_ganks_top = sum(g.get("ganks_top", 0) for g in player_games)
    total_ganks_mid = sum(g.get("ganks_mid", 0) for g in player_games)
    total_ganks_bot = sum(g.get("ganks_bot", 0) for g in player_games)
    total_ganks_all = total_ganks_top + total_ganks_mid + total_ganks_bot

    if total_ganks_all > 0:
        gank_focus_lane = max(
            ["TOP", "MID", "BOT"],
            key=lambda lane: {
                "TOP": total_ganks_top,
                "MID": total_ganks_mid,
                "BOT": total_ganks_bot,
            }[lane],
        )
    else:
        gank_focus_lane = None

    # Objectives
    avg_our_drags = sum(g.get("our_dragons", 0) for g in player_games) / n
    avg_enemy_drags = sum(g.get("enemy_dragons", 0) for g in player_games) / n
    avg_our_heralds = sum(g.get("our_heralds", 0) for g in player_games) / n
    avg_enemy_heralds = sum(g.get("enemy_heralds", 0) for g in player_games) / n

    # --- Heuristic style tags ---

    # Tempo
    if avg_xp_diff10 > 150 and avg_gold_diff10 > 600:
        tempo_style = "consistently ahead early"
    elif avg_xp_diff10 > 50 or avg_gold_diff10 > 200:
        tempo_style = "slightly ahead early"
    elif avg_xp_diff10 < -150 and avg_gold_diff10 < -600:
        tempo_style = "consistently behind early"
    elif avg_xp_diff10 < -50 or avg_gold_diff10 < -200:
        tempo_style = "slightly behind early"
    else:
        tempo_style = "roughly even early tempo"

    # Gank style by timing
    if avg_first_gank_time is None:
        gank_timing_style = "low-gank data"
    elif avg_first_gank_time <= 210:   # <= 3:30
        gank_timing_style = "very early ganks"
    elif avg_first_gank_time <= 330:   # <= 5:30
        gank_timing_style = "standard first gank timing"
    else:
        gank_timing_style = "late first ganks (farm-heavy)"

    # Gank lane focus
    if gank_focus_lane == "BOT":
        gank_lane_style = "bot-focused ganks"
    elif gank_focus_lane == "MID":
        gank_lane_style = "mid-focused ganks"
    elif gank_focus_lane == "TOP":
        gank_lane_style = "top-focused ganks"
    else:
        gank_lane_style = "no clear gank lane focus"

    # Objective style
    drag_diff = avg_our_drags - avg_enemy_drags
    herald_diff = avg_our_heralds - avg_enemy_heralds
    if drag_diff >= 0.5 and herald_diff >= 0.3:
        obj_style = "strong dragon + herald control"
    elif drag_diff >= 0.5:
        obj_style = "strong dragon control"
    elif herald_diff >= 0.3:
        obj_style = "strong herald control"
    elif drag_diff <= -0.5 and herald_diff <= -0.3:
        obj_style = "weak objective control"
    else:
        obj_style = "mixed / average objective control"

    # Invade style
    if avg_invade >= 6:
        invade_style = "very aggressive counter-jungling"
    elif avg_invade >= 3:
        invade_style = "moderately aggressive counter-jungling"
    elif avg_invade <= -6:
        invade_style = "heavily losing jungle control"
    elif avg_invade <= -3:
        invade_style = "often behind in jungle control"
    else:
        invade_style = "neutral jungle control"

    # Overall style summary (short label you can show in UI)
    style_bits = []

    if "ahead" in tempo_style:
        style_bits.append("tempo")
    if "farm-heavy" in gank_timing_style:
        style_bits.append("farm")
    if "early ganks" in gank_timing_style:
        style_bits.append("early-gank")
    if gank_focus_lane in ("TOP", "MID", "BOT"):
        style_bits.append(gank_focus_lane.lower())
    if "strong dragon" in obj_style or "strong dragon + herald" in obj_style:
        style_bits.append("drag-control")

    overall_style_tag = "-".join(style_bits) if style_bits else "balanced-jungler"

    return {
        "games_analyzed": n,
        "winrate": winrate,
        "avg_kda": avg_kda,
        "avg_cs10": avg_cs10,
        "avg_cs_diff10": avg_cs_diff10,
        "avg_xp_diff10": avg_xp_diff10,
        "avg_gold_diff10": avg_gold_diff10,
        "avg_scuttles": avg_scuttles,
        "avg_invade_diff": avg_invade,
        "lane_presence": {
            "top": avg_top_p,
            "mid": avg_mid_p,
            "bot": avg_bot_p,
            "main_lane": main_lane,
            "main_lane_pct": main_lane_pct,
        },
        "ganks": {
            "avg_first_gank_time_sec": avg_first_gank_time,
            "total_top": total_ganks_top,
            "total_mid": total_ganks_mid,
            "total_bot": total_ganks_bot,
            "focus_lane": gank_focus_lane,
        },
        "objectives": {
            "avg_our_dragons": avg_our_drags,
            "avg_enemy_dragons": avg_enemy_drags,
            "avg_our_heralds": avg_our_heralds,
            "avg_enemy_heralds": avg_enemy_heralds,
        },
        "style_tags": {
            "overall": overall_style_tag,
            "tempo": tempo_style,
            "gank_timing": gank_timing_style,
            "gank_lane": gank_lane_style,
            "objectives": obj_style,
            "invading": invade_style,
        },
    }


def build_champion_breakdowns(player_games: list[dict]) -> dict:
    """
    Aggregate per-champion stats from player_games.
    Returns:
      {
        "Belveth": {
          "games": 12,
          "wins": 8,
          "winrate": 66.7,
          "avg_kda": 4.2,
          "avg_cs10": 61.3,
          "avg_cs_diff10": 5.1,
          "avg_gold_diff10": 430.0,
          "avg_xp_diff10": 210.0,
        },
        ...
      }
    """
    champs = defaultdict(lambda: {
        "games": 0,
        "wins": 0,
        "kda_sum": 0.0,
        "cs10_sum": 0.0,
        "csdiff10_sum": 0.0,
        "golddiff10_sum": 0.0,
        "xpdiff10_sum": 0.0,
    })

    for g in player_games:
        champ = g.get("champion", "Unknown")
        c = champs[champ]

        c["games"] += 1
        if g.get("win"):
            c["wins"] += 1

        c["kda_sum"] += g.get("kda", 0.0)
        c["cs10_sum"] += g.get("cs_10", 0.0)
        c["csdiff10_sum"] += g.get("cs_diff_10", 0.0)
        c["golddiff10_sum"] += g.get("gold_diff_10", 0.0)
        c["xpdiff10_sum"] += g.get("xp_diff_10", 0.0)

    result: dict[str, dict] = {}

    for champ, s in champs.items():
        games = s["games"]
        if games == 0:
            continue

        wins = s["wins"]
        wr = wins / games * 100.0

        result[champ] = {
            "games": games,
            "wins": wins,
            "winrate": round(wr, 1),
            "avg_kda": round(s["kda_sum"] / games, 2),
            "avg_cs10": round(s["cs10_sum"] / games, 1),
            "avg_cs_diff10": round(s["csdiff10_sum"] / games, 1),
            "avg_gold_diff10": round(s["golddiff10_sum"] / games, 1),
            "avg_xp_diff10": round(s["xpdiff10_sum"] / games, 1),
        }

    return result


def build_matchup_breakdowns(player_games: list[dict]) -> dict:
    """
    Aggregate per-matchup stats (our champ vs enemy jungler champ).
    Returns:
      {
        "Belveth": {
          "LeeSin": { "games": 3, "wins": 2, "winrate": 66.7 },
          "JarvanIV": { ... },
          ...
        },
        "Graves": {
          "Kayn": { ... }
        }
      }
    """
    raw = defaultdict(lambda: defaultdict(lambda: {
        "games": 0,
        "wins": 0,
    }))

    for g in player_games:
        our_champ = g.get("champion", "Unknown")
        enemy_champ = g.get("enemy_jungle_champion", "Unknown")

        m = raw[our_champ][enemy_champ]
        m["games"] += 1
        if g.get("win"):
            m["wins"] += 1

    # Normalize + compute winrates
    result: dict[str, dict] = {}
    for our_champ, vs_map in raw.items():
        result[our_champ] = {}
        for enemy_champ, stats in vs_map.items():
            games = stats["games"]
            if games == 0:
                continue
            wins = stats["wins"]
            wr = wins / games * 100.0
            result[our_champ][enemy_champ] = {
                "games": games,
                "wins": wins,
                "winrate": round(wr, 1),
            }

    return result


def get_jungle_report_text(player_games: list[dict]) -> str:
    """
    Run generate_jungle_report(player_games) but capture the printed
    output into a single string, so the API can return it.
    """
    buf = StringIO()
    with contextlib.redirect_stdout(buf):
        generate_jungle_report(player_games)
    return buf.getvalue()


def analyze_jungler_for_riot_id(
    game_name: str,
    tag_line: str,
    match_count: int = 100,
) -> dict:
    """
    Core entry point for code to call programmatically.

    Given a Riot ID (game_name + tag_line), fetch recent jungle games,
    compute all stats, and return:

        {
          "player_games": [...],    # per-game stat dicts
          "profile": {...},         # style profile dict (build_player_profile)
        }
    """
    # 1) Resolve PUUID
    puuid = get_puuid_from_riot_id(game_name, tag_line)

    # 2) Fetch recent match IDs
    match_ids = get_recent_match_ids(puuid, count=match_count)

    player_games: list[dict] = []

    # 3) Loop over matches and collect jungle games
    for match_id in match_ids:
        try:
            match_data = get_match_details(match_id)

            basic_stats = get_player_stats_from_match(match_data, puuid)

            participant = next(
                p for p in match_data["info"]["participants"]
                if p["participantId"] == basic_stats["participant_id"]
            )

            # Smite check (covers both spell1Id/summoner1Id schemas)
            spell1 = participant.get("spell1Id") or participant.get("summoner1Id")
            spell2 = participant.get("spell2Id") or participant.get("summoner2Id")

            if spell1 is None or spell2 is None:
                print(f"[WARN] Skipping match {match_id} – missing spell data")
                continue

            has_smite = (spell1 == 11 or spell2 == 11)

            # Skip any game where player was not jungling
            if basic_stats["role"] != "JUNGLE" or not has_smite:
                print(f"[INFO] Skipping non-jungle match {match_id}")
                continue

            # Enemy jungler
            enemy_jng_participant = find_enemy_jungle_participant(
                match_data["info"],
                basic_stats["team_id"],
            )
            enemy_jng_pid = enemy_jng_participant["participantId"]
            enemy_jng_champ = enemy_jng_participant["championName"]

            # Our enemy-jungle CS vs theirs
            our_enemy_jng_cs = basic_stats.get("enemy_jng_cs", 0)
            enemy_challenges = enemy_jng_participant.get("challenges", {})
            enemy_enemy_jng_cs = enemy_challenges.get("enemyJungleMonsterKills", 0)
            more_enemy_jungle = our_enemy_jng_cs - enemy_enemy_jng_cs

            # Timeline + derived stats
            timeline = get_match_timeline(match_id)

            early_stats = compute_early_lane_stats(
                timeline,
                our_pid=basic_stats["participant_id"],
                enemy_jng_pid=enemy_jng_pid,
            )

            lane_presence = compute_lane_presence(
                timeline,
                our_pid=basic_stats["participant_id"],
            )

            gank_stats = extract_early_gank_stats(
                timeline,
                match_data["info"],
                our_pid=basic_stats["participant_id"],
            )

            obj_stats = extract_objective_stats(
                timeline,
                our_team_id=basic_stats["team_id"],
            )

            # ---------- NEW: team comps + win conditions ----------
            info = match_data["info"]
            our_team_id = basic_stats["team_id"]

            ally_champs = [
                p["championName"]
                for p in info["participants"]
                if p["teamId"] == our_team_id
            ]
            enemy_champs = [
                p["championName"]
                for p in info["participants"]
                if p["teamId"] != our_team_id
            ]

            wincon = analyze_wincons_for_game(
                ally_champs=ally_champs,
                enemy_champs=enemy_champs,
            )
            # ------------------------------------------------------

            game_stats = {
                # core jungle stats
                **basic_stats,
                **early_stats,
                **lane_presence,
                **gank_stats,
                **obj_stats,
                # draft context for UI + wincon
                "ally_champs": ally_champs,
                "enemy_champs": enemy_champs,
                "wincon": wincon,
                # existing fields
                "enemy_jungle_champion": enemy_jng_champ,
                "more_enemy_jungle": more_enemy_jungle,
            }

            player_games.append(game_stats)

        except Exception as e:
            # catch-all so a single cursed game doesn't ruin everything
            print(f"[ERROR] Skipping match {match_id} due to error: {e}")
            continue

    # 4) After looping all matches, make sure we actually have games
    if not player_games:
        raise RuntimeError("No jungle games found for this player.")

    # 5) Build style profile from *all* games
    profile = build_player_profile(player_games)
    profile["champion_breakdowns"] = build_champion_breakdowns(player_games)
    profile["matchup_breakdowns"] = build_matchup_breakdowns(player_games)
    profile["matchup_advice"] = build_matchup_advice_text(profile)
    profile["draft_recommendations"] = build_draft_recommendations(profile)
    profile["wincon_profile"] = build_wincon_profile(player_games)

    # 🔮 NEW: AI coach block
    ai_coach = build_ai_coach(profile)

    return {
        "player_games": player_games,
        "profile": profile,
        "ai_coach": ai_coach,
    }

def build_matchup_advice_text(profile: dict) -> str:
    """
    Produce a short, human-readable advice string based on
    champion_breakdowns + matchup_breakdowns.
    This is a rule-based "mini-AI" layer that you can later replace
    with an LLM while keeping the same inputs.
    """
    champ_bd = profile.get("champion_breakdowns", {})
    matchup_bd = profile.get("matchup_breakdowns", {})

    if not champ_bd or not matchup_bd:
        return "Not enough jungle data yet for matchup advice."

    # 1) Find your main jungler (most games played)
    main_champ, main_stats = max(
        champ_bd.items(),
        key=lambda kv: kv[1].get("games", 0),
    )

    main_games = main_stats.get("games", 0)
    if main_games < 3:
        return (
            "You don't have enough games on a single jungler yet for "
            "solid matchup advice. Play a few more games on one champion!"
        )

    vs_map = matchup_bd.get(main_champ, {})
    if not vs_map:
        return (
            f"You play {main_champ}, but there isn't enough data versus "
            "specific enemy junglers yet."
        )

    # 2) Classify good / bad matchups for your main champ
    good_matchups = []
    bad_matchups = []

    for enemy_champ, stats in vs_map.items():
        games = stats.get("games", 0)
        wins = stats.get("wins", 0)
        wr = stats.get("winrate", 0.0)

        if games < 3:
            # ignore tiny sample sizes
            continue

        if wr >= 65.0:
            good_matchups.append((enemy_champ, games, wins, wr))
        elif wr <= 40.0:
            bad_matchups.append((enemy_champ, games, wins, wr))

    # Sort by number of games (most relevant first)
    good_matchups.sort(key=lambda t: t[1], reverse=True)
    bad_matchups.sort(key=lambda t: t[1], reverse=True)

    # Only keep the top few in text so it doesn't get overwhelming
    good_matchups = good_matchups[:3]
    bad_matchups = bad_matchups[:3]

    parts: list[str] = []

    parts.append(
        f"Your main jungler right now is **{main_champ}** "
        f"({main_games} games, {main_stats.get('winrate', 0.0):.1f}% WR)."
    )

    if good_matchups:
        good_bits = []
        for enemy, games, wins, wr in good_matchups:
            good_bits.append(f"{enemy} ({wins}-{games - wins}, {wr:.1f}% WR)")
        parts.append(
            "You perform **well into**: " + ", ".join(good_bits) + "."
        )
    else:
        parts.append(
            "There aren't any super consistent winning matchups yet; "
            "your results are pretty even across enemy junglers."
        )

    if bad_matchups:
        bad_bits = []
        for enemy, games, wins, wr in bad_matchups:
            bad_bits.append(f"{enemy} ({wins}-{games - wins}, {wr:.1f}% WR)")
        parts.append(
            "You tend to **struggle into**: " + ", ".join(bad_bits) + ". "
            "In those drafts, consider picking something else or playing "
            "more defensively around your strong lanes."
        )
    else:
        parts.append(
            "You don't have any clearly losing matchups yet. Keep abusing "
            "your comfort picks and tracking new matchups as you play more."
        )

    return " ".join(parts)


def build_draft_recommendations(profile: dict) -> dict:
    """
    Use champion_breakdowns to suggest:
      - a core jungle pool
      - situational / backup picks
      - champs to avoid for now

    Returns a dict with structured data + a short summary text.
    """
    champ_bd = profile.get("champion_breakdowns", {})
    if not champ_bd:
        return {
            "core_pool": [],
            "situational_picks": [],
            "avoid_for_now": [],
            "summary_text": "Not enough champion data yet for draft recommendations.",
        }

    champs: list[dict] = []
    for name, s in champ_bd.items():
        champs.append({
            "champion": name,
            "games": s.get("games", 0),
            "wins": s.get("wins", 0),
            "winrate": float(s.get("winrate", 0.0)),
            "avg_kda": float(s.get("avg_kda", 0.0)),
        })

    # Sort by winrate primarily, then by games (so consistent + played champs rise)
    champs.sort(key=lambda c: (c["winrate"], c["games"]), reverse=True)

    # Heuristics – you can tweak these thresholds later
    CORE_MIN_GAMES = 5
    CORE_MIN_WR = 52.0

    SITUATIONAL_MIN_GAMES = 3
    SITUATIONAL_MIN_WR = 48.0

    AVOID_MAX_WR = 45.0
    AVOID_MIN_GAMES = 3

    core_pool: list[dict] = []
    situational: list[dict] = []
    avoid: list[dict] = []

    for c in champs:
        g = c["games"]
        wr = c["winrate"]

        # Champs to avoid for now
        if g >= AVOID_MIN_GAMES and wr <= AVOID_MAX_WR:
            avoid.append(c)
            continue

        # Strong, reliable picks = core pool
        if g >= CORE_MIN_GAMES and wr >= CORE_MIN_WR:
            core_pool.append(c)
            continue

        # Decent but not super proven yet = situational
        if g >= SITUATIONAL_MIN_GAMES and wr >= SITUATIONAL_MIN_WR:
            situational.append(c)

    # Trim lists so they don't get huge
    core_pool = core_pool[:3]
    situational = situational[:4]
    avoid = avoid[:4]

    # Build a short summary text
    parts: list[str] = []

    if core_pool:
        core_names = ", ".join(
            f"{c['champion']} ({c['winrate']:.1f}% over {c['games']} games)"
            for c in core_pool
        )
        parts.append(f"Your **core jungle pool** should revolve around: {core_names}.")
    else:
        parts.append(
            "You don't have a clearly dominant core jungle pool yet. "
            "Play more games on 1–2 comfort champs to stabilize your pool."
        )

    if situational:
        situ_names = ", ".join(
            f"{c['champion']} ({c['winrate']:.1f}% WR)"
            for c in situational
        )
        parts.append(
            f"Solid **situational picks** you can draft when the comp fits are: {situ_names}."
        )

    if avoid:
        avoid_names = ", ".join(
            f"{c['champion']} ({c['winrate']:.1f}% over {c['games']} games)"
            for c in avoid
        )
        parts.append(
            f"Champs you should **avoid for now** until you practice them more: {avoid_names}."
        )
    else:
        parts.append(
            "You don't have any obvious int picks yet—nice. Just keep an eye on "
            "new champs you add to the pool and prune low-winrate experiments."
        )

    summary_text = " ".join(parts)

    return {
        "core_pool": core_pool,
        "situational_picks": situational,
        "avoid_for_now": avoid,
        "summary_text": summary_text,
    }


# -------------------- MAIN SCRIPT (CLI) --------------------

if __name__ == "__main__":
    test_riot_connection()

    print("\n--- Get PUUID from Riot ID ---")
    game_name = input("Enter your ign (e.g. strangelove): ").strip()
    tag_line = input("Enter your tag (e.g. NA1): ").strip()

    print("\n--- Running jungle analysis... ---")
    result = analyze_jungler_for_riot_id(
        game_name=game_name,
        tag_line=tag_line,
        match_count=20,
    )

    player_games = result["player_games"]
    profile = result["profile"]

    if not player_games:
        print("\nNo jungle games found for this player.")
    else:
        from pprint import pprint

        print(f"\nAnalyzed {len(player_games)} jungle games.")
        print("\nSample from first game:")
        pprint(player_games[0])

        analyze_player_games(player_games)
        generate_jungle_report(player_games)

        print("\n================ Jungler Style Profile (JSON) ================")
        pprint(profile)
        print("==============================================================")
