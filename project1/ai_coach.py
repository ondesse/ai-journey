from __future__ import annotations

from typing import TypedDict, List, Literal, Optional, Dict, Any


Rating = Literal["S", "A", "B", "C", "D", "F"]


class CoachingCategory(TypedDict):
    id: str
    label: str
    rating: Rating
    summary: str
    details: List[str]


class CoachingReport(TypedDict):
    overall_summary: str
    focus_next_block: List[str]
    categories: List[CoachingCategory]


def grade_from_value(value: float, bands: List[tuple[float, str]]) -> str:
    """
    Given a value and a list of (threshold, letter) sorted high → low,
    return the first letter where value >= threshold.
    """
    for threshold, letter in bands:
        if value >= threshold:
            return letter
    return bands[-1][1]


def _rating_to_word(r: Rating) -> str:
    return {
        "S": "elite",
        "A": "very strong",
        "B": "solid",
        "C": "inconsistent",
        "D": "weak",
        "F": "very weak",
    }[r]


def _format_time_mmss(seconds: Optional[float]) -> str:
    if seconds is None:
        return "N/A"
    m = int(seconds // 60)
    s = int(seconds % 60)
    return f"{m:02d}:{s:02d}"


def _rate_tempo(avg_xp_diff10: float, avg_gold_diff10: float) -> Rating:
    """
    Use your existing profile fields:
      avg_xp_diff10, avg_gold_diff10
    to grade early tempo.
    """
    score = (avg_xp_diff10 / 150.0) + (avg_gold_diff10 / 600.0)
    if score >= 1.5:
        return "S"
    if score >= 0.8:
        return "A"
    if score >= 0.2:
        return "B"
    if score >= -0.4:
        return "C"
    if score >= -1.0:
        return "D"
    return "F"


def _rate_farm(avg_cs10: float, avg_cs_diff10: float) -> Rating:
    """
    Farming / clear quality from:
      avg_cs10, avg_cs_diff10
    """
    score = (avg_cs10 - 55.0) / 5.0 + (avg_cs_diff10 / 5.0)
    if score >= 1.5:
        return "S"
    if score >= 0.8:
        return "A"
    if score >= 0.0:
        return "B"
    if score >= -0.8:
        return "C"
    if score >= -1.5:
        return "D"
    return "F"


def _rate_objectives(obj: Dict[str, Any]) -> Rating:
    """
    Objective control from:
      obj["avg_our_dragons"], obj["avg_enemy_dragons"],
      obj["avg_our_heralds"], obj["avg_enemy_heralds"]
    """
    avg_our_drags = obj.get("avg_our_dragons", 0.0)
    avg_enemy_drags = obj.get("avg_enemy_dragons", 0.0)
    avg_our_heralds = obj.get("avg_our_heralds", 0.0)
    avg_enemy_heralds = obj.get("avg_enemy_heralds", 0.0)

    drag_diff = avg_our_drags - avg_enemy_drags
    herald_diff = avg_our_heralds - avg_enemy_heralds

    score = drag_diff * 1.0 + herald_diff * 0.7
    if score >= 2.0:
        return "S"
    if score >= 1.0:
        return "A"
    if score >= 0.2:
        return "B"
    if score >= -0.4:
        return "C"
    if score >= -1.0:
        return "D"
    return "F"


def _rate_invading(avg_invade_diff: float) -> Rating:
    """
    Using profile["avg_invade_diff"] (your moreEnemyJungleThanOpponent diff).
    """
    score = avg_invade_diff
    if score >= 6.0:
        return "S"
    if score >= 3.0:
        return "A"
    if score >= 0.0:
        return "B"
    if score >= -3.0:
        return "C"
    if score >= -6.0:
        return "D"
    return "F"


def _rate_skirmishing(avg_kda: float) -> Rating:
    """
    Using profile["avg_kda"].
    """
    score = avg_kda
    if score >= 5.0:
        return "S"
    if score >= 4.0:
        return "A"
    if score >= 3.0:
        return "B"
    if score >= 2.0:
        return "C"
    if score >= 1.0:
        return "D"
    return "F"


def _rate_draft_and_pool(profile: Dict[str, Any]) -> Rating:
    """
    Grade draft & champion pool using:
      profile["champion_breakdowns"]
      profile["draft_recommendations"]
    """
    champ_bd = profile.get("champion_breakdowns", {})
    draft = profile.get("draft_recommendations", {})

    core_pool = draft.get("core_pool") or []
    situational = draft.get("situational_picks") or []

    if not champ_bd or profile.get("games_analyzed", 0) < 10:
        return "C"

    core_count = len(core_pool)
    situ_count = len(situational)

    core_wr_vals: List[float] = []
    for c in core_pool:
        core_wr_vals.append(float(c.get("winrate", 0.0)))

    if not core_wr_vals:
        avg_core_wr = 50.0
    else:
        avg_core_wr = sum(core_wr_vals) / len(core_wr_vals)

    if core_count >= 2 and avg_core_wr >= 57.0 and situ_count >= 2:
        return "S"
    if core_count >= 2 and avg_core_wr >= 54.0:
        return "A"
    if core_count >= 1 and avg_core_wr >= 52.0:
        return "B"
    if core_count == 0 and situ_count == 0:
        return "D"
    return "C"


# ------------- MAIN PROFILE-LEVEL AI COACH -------------


def build_ai_coach(profile: Dict[str, Any]) -> CoachingReport:
    """
    Main entrypoint for your AI coach.

    Input:  profile = result["profile"] from analyze_jungler_for_riot_id(...)
    Output: CoachingReport dict with:
      - overall_summary
      - focus_next_block (bullet points)
      - categories (cards with rating + details)
    """

    games = profile.get("games_analyzed", 0)
    winrate = float(profile.get("winrate", 0.0))
    avg_kda = float(profile.get("avg_kda", 0.0))
    avg_cs10 = float(profile.get("avg_cs10", 0.0))
    avg_cs_diff10 = float(profile.get("avg_cs_diff10", 0.0))
    avg_xp_diff10 = float(profile.get("avg_xp_diff10", 0.0))
    avg_gold_diff10 = float(profile.get("avg_gold_diff10", 0.0))
    avg_scuttles = float(profile.get("avg_scuttles", 0.0))
    avg_invade_diff = float(profile.get("avg_invade_diff", 0.0))

    lane_presence = profile.get("lane_presence", {}) or {}
    main_lane = lane_presence.get("main_lane")
    main_lane_pct = float(lane_presence.get("main_lane_pct", 0.0))

    ganks = profile.get("ganks", {}) or {}
    avg_first_gank_time = ganks.get("avg_first_gank_time_sec")
    total_ganks_top = ganks.get("total_top", 0)
    total_ganks_mid = ganks.get("total_mid", 0)
    total_ganks_bot = ganks.get("total_bot", 0)

    objectives = profile.get("objectives", {}) or {}

    style_tags = profile.get("style_tags", {}) or {}
    tempo_style = style_tags.get("tempo", "")
    gank_timing_style = style_tags.get("gank_timing", "")
    obj_style = style_tags.get("objectives", "")
    invade_style = style_tags.get("invading", "")

    draft_recs = profile.get("draft_recommendations", {}) or {}
    matchup_advice = profile.get("matchup_advice", "")

    # ---- Ratings ----
    tempo_rating = _rate_tempo(avg_xp_diff10, avg_gold_diff10)
    farm_rating = _rate_farm(avg_cs10, avg_cs_diff10)
    obj_rating = _rate_objectives(objectives)
    invade_rating = _rate_invading(avg_invade_diff)
    fight_rating = _rate_skirmishing(avg_kda)
    draft_rating = _rate_draft_and_pool(profile)

    categories: List[CoachingCategory] = []

    # ----- Tempo & Early Game -----
    tempo_details: List[str] = []
    tempo_details.append(
        f"On average you are {avg_xp_diff10:+.1f} XP and {avg_gold_diff10:+.0f} gold "
        f"at 10 minutes compared to the enemy jungler."
    )
    if "ahead" in tempo_style:
        tempo_details.append(f"Overall tempo pattern: {tempo_style}.")
    elif "behind" in tempo_style:
        tempo_details.append(f"Overall tempo pattern: {tempo_style}.")
    else:
        tempo_details.append(f"Your tempo is usually {tempo_style or 'roughly even'}.")

    if avg_first_gank_time is not None:
        tempo_details.append(
            f"Average first gank timing: {_format_time_mmss(avg_first_gank_time)}."
        )
        if avg_first_gank_time <= 210:
            tempo_details.append(
                "You gank very early. This is great if your lanes have pressure; just try to "
                "avoid low percentage dives that ruin your clear."
            )
        elif avg_first_gank_time <= 330:
            tempo_details.append(
                "Your first gank timing is pretty standard. Small pathing tweaks could open up "
                "earlier windows when lanes are in a good spot."
            )
        else:
            tempo_details.append(
                "You gank later than most junglers. That works on more farm focused champions, "
                "but make sure you're actually ahead around 10 minutes if you're skipping early fights."
            )

    categories.append(
        {
            "id": "tempo",
            "label": "Tempo & Early Game",
            "rating": tempo_rating,
            "summary": f"Your early tempo is {_rating_to_word(tempo_rating)} overall.",
            "details": tempo_details,
        }
    )

    # ----- Farming & Clears -----
    farm_details: List[str] = []
    farm_details.append(
        f"Average CS@10: {avg_cs10:.1f} (CS diff @10: {avg_cs_diff10:+.1f})."
    )
    farm_details.append(
        "Aim for around 55–65 CS at 10 minutes on most farming junglers, "
        "adjusting a bit down if the game is very fight heavy."
    )

    if farm_rating in ("S", "A"):
        farm_details.append(
            "Your clears are very efficient. The next step is syncing them with "
            "objective timers and lane states so you are never finishing a full clear "
            "with no follow up plan."
        )
    elif farm_rating in ("C", "D", "F"):
        farm_details.append(
            "Your clears are a little behind. Rewatch a few of your first two clears "
            "and compare them to a high elo VOD on your main champion; copy their camp "
            "order and recall timings."
        )

    farm_details.append(
        f"Average scuttle control: {avg_scuttles:.2f} per game. Remember scuttle is "
        "only worth fighting for if your lanes can actually move first."
    )

    categories.append(
        {
            "id": "farm",
            "label": "Farming & Clear Quality",
            "rating": farm_rating,
            "summary": f"Your farming and clears are {_rating_to_word(farm_rating)}.",
            "details": farm_details,
        }
    )

    # ----- Objectives & River Control -----
    avg_our_drags = objectives.get("avg_our_dragons", 0.0)
    avg_enemy_drags = objectives.get("avg_enemy_dragons", 0.0)
    avg_our_heralds = objectives.get("avg_our_heralds", 0.0)
    avg_enemy_heralds = objectives.get("avg_enemy_heralds", 0.0)

    obj_details: List[str] = [
        f"Average dragons: you {avg_our_drags:.2f} vs enemy {avg_enemy_drags:.2f}.",
        f"Average Heralds: you {avg_our_heralds:.2f} vs enemy {avg_enemy_heralds:.2f}.",
    ]

    if obj_style:
        obj_details.append(f"Objective pattern: {obj_style}.")

    if obj_rating in ("C", "D", "F"):
        obj_details.append(
            "Try to turn every won skirmish or strong lane state into a dragon or Herald "
            "whenever timers allow it, especially between 5 and 14 minutes."
        )
    else:
        obj_details.append(
            "You already do a good job turning advantages into objectives. You can squeeze even "
            "more value out by tracking the enemy jungler's tempo so you know when they can't contest."
        )

    categories.append(
        {
            "id": "objectives",
            "label": "Objectives & River Control",
            "rating": obj_rating,
            "summary": f"Your neutral objectives are {_rating_to_word(obj_rating)}.",
            "details": obj_details,
        }
    )

    # ----- Invading & Jungle Control -----
    invade_details: List[str] = []
    invade_details.append(
        f"Average jungle control (moreEnemyJungleThanOpponent): {avg_invade_diff:+.1f}."
    )
    if invade_style:
        invade_details.append(f"Invade pattern: {invade_style}.")

    if invade_rating in ("S", "A"):
        invade_details.append(
            "You usually come out ahead in jungle vs jungle. Just keep making sure your invades "
            "line up with lane priority and mid roams so you are not flipping 2v2s for no reason."
        )
    elif invade_rating in ("C", "D", "F"):
        invade_details.append(
            "You often lose control of your jungle. Drop bad quadrants instead of forcing fights, "
            "and use defensive vision to track the enemy rather than walking into fog alone."
        )
    else:
        invade_details.append(
            "Your jungle control is roughly even. Look for higher value counter jungles when your "
            "lanes are winning and you know where the enemy jungler started."
        )

    categories.append(
        {
            "id": "invading",
            "label": "Invading & Jungle Control",
            "rating": invade_rating,
            "summary": f"Your jungle control is {_rating_to_word(invade_rating)}.",
            "details": invade_details,
        }
    )

    # ----- Skirmishing & Fights -----
    fight_details: List[str] = []
    fight_details.append(f"Average KDA across games: {avg_kda:.2f}.")

    if fight_rating in ("S", "A"):
        fight_details.append(
            "You teamfight and skirmish very well. You can lean into that by taking more proactive "
            "fights around big objectives when you know you're strong."
        )
    elif fight_rating in ("C", "D", "F"):
        fight_details.append(
            "Your KDA suggests some fights are forced or poorly set up. Be pickier about engages: "
            "fight on your vision, with item spikes, or with a clear numbers advantage."
        )
    else:
        fight_details.append(
            "Your fights are fine but not game deciding yet. Small improvements in target selection "
            "and timing will turn more of these into clean wins."
        )

    categories.append(
        {
            "id": "skirmishing",
            "label": "Skirmishing & Fights",
            "rating": fight_rating,
            "summary": f"Your fighting impact is {_rating_to_word(fight_rating)}.",
            "details": fight_details,
        }
    )

    # ----- Lane Presence & Map Focus -----
    lane_details: List[str] = []
    lane_details.append(
        f"Primary early focus lane: {main_lane or 'Unknown'} "
        f"({main_lane_pct:.1f}% of your lane time from 0–14)."
    )
    lane_details.append(
        f"Total ganks – TOP: {total_ganks_top}, MID: {total_ganks_mid}, BOT: {total_ganks_bot}."
    )

    gank_focus_lane = ganks.get("focus_lane")
    if gank_focus_lane:
        lane_details.append(f"Your gank pattern leans toward the {gank_focus_lane} side of the map.")

    if main_lane == "BOT":
        lane_details.append(
            "You play a lot around bot, which is usually ideal for solo queue. Keep syncing your clears "
            "with bot wave states and dragon timers."
        )
    elif main_lane == "MID":
        lane_details.append(
            "You lean heavily into mid. Make sure your side lanes still get enough coverage so "
            "you don't quietly bleed plates and dragons while hovering mid the whole time."
        )
    elif main_lane == "TOP":
        lane_details.append(
            "You spend a lot of time top. Only commit that hard when top is actually your main win condition, "
            "otherwise try to route more of your pathing through mid and bot."
        )
    else:
        lane_details.append(
            "Your lane presence is pretty spread out. Each game, decide on a clear primary win condition lane "
            "and build your first few paths around it."
        )

    # This category uses the same rating as tempo.
    lane_rating: Rating = tempo_rating

    categories.append(
        {
            "id": "lane_presence",
            "label": "Lane Presence & Focus",
            "rating": lane_rating,
            "summary": f"Your lane coverage is {_rating_to_word(lane_rating)}.",
            "details": lane_details,
        }
    )

    # ----- Draft & Champion Pool -----
    draft_details: List[str] = []

    core_pool = draft_recs.get("core_pool") or []
    situ_pool = draft_recs.get("situational_picks") or []
    avoid_pool = draft_recs.get("avoid_for_now") or []

    if core_pool:
        names = ", ".join(f"{c['champion']} ({c['winrate']:.1f}% WR)" for c in core_pool)
        draft_details.append(f"Core jungle pool: {names}.")
    else:
        draft_details.append(
            "You don't have a clear core jungle pool yet. Focus on one or two comfort champs "
            "and stack more games on them."
        )

    if situ_pool:
        names = ", ".join(f"{c['champion']} ({c['winrate']:.1f}% WR)" for c in situ_pool)
        draft_details.append(f"Situational picks: {names}.")

    if avoid_pool:
        names = ", ".join(
            f"{c['champion']} ({c['winrate']:.1f}% over {c['games']} games)"
            for c in avoid_pool
        )
        draft_details.append(
            f"Champs to de-prioritize in ranked for now: {names}."
        )

    if matchup_advice:
        draft_details.append(matchup_advice)

    categories.append(
        {
            "id": "draft",
            "label": "Draft & Champion Pool",
            "rating": draft_rating,
            "summary": f"Your draft & pool health is {_rating_to_word(draft_rating)}.",
            "details": draft_details,
        }
    )

    # ----- Overall summary + next block focus -----
    rating_order = ["S", "A", "B", "C", "D", "F"]

    def rating_score(r: Rating) -> int:
        return rating_order.index(r)

    best_cat = min(categories, key=lambda c: rating_score(c["rating"]))
    worst_cat = max(categories, key=lambda c: rating_score(c["rating"]))

    overall_summary = (
        f"Over your last {games} jungle games ({winrate:.1f}% WR), your biggest strength is "
        f"**{best_cat['label']}** ({best_cat['rating']}) while your weakest area is "
        f"**{worst_cat['label']}** ({worst_cat['rating']}). Focus your next block of games "
        "on cleaning up that weakest category while keeping your main strength sharp."
    )

    focus_next_block: List[str] = []

    if farm_rating in ("C", "D", "F"):
        focus_next_block.append(
            "For the next 5–10 games, aim for at least **55–65 CS by 10 minutes** and avoid "
            "ganks that barely have a chance of working and blow up your clear."
        )

    if obj_rating in ("C", "D", "F"):
        focus_next_block.append(
            "Keep track of **dragon and Herald timers** and try to turn every small lead or won fight "
            "into an objective whenever it makes sense."
        )

    if tempo_rating in ("C", "D", "F"):
        focus_next_block.append(
            "Rewatch your **first two clears** and cut out unnecessary walking. You should either be "
            "farming or taking a real, high percentage gank window almost all the time."
        )

    if draft_rating in ("C", "D", "F"):
        focus_next_block.append(
            "Stick to a small jungle champion pool of **two or three champs** and stop swapping midway "
            "through your climb. Give each champ at least 30–40 games before moving on."
        )

    if not focus_next_block:
        focus_next_block.append(
            "Pick one category you care about most (tempo, farm, objectives, or draft) and "
            "set a clear goal for the next 10 games."
        )

    # dedupe while preserving order
    focus_next_block = list(dict.fromkeys(focus_next_block))

    return {
        "overall_summary": overall_summary,
        "focus_next_block": focus_next_block,
        "categories": categories,
    }