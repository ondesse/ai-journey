from typing import List, Tuple, TypedDict, Literal, Dict
from data.champ_profiles import CHAMP_PROFILES, ChampProfile


ScalingLabel = Literal["early", "mid", "late", "mixed"]
LevelLabel = Literal["low", "medium", "high"]
DamageLabel = Literal["physical", "magic", "mixed"]


class TeamCompSummary(TypedDict):
    champs: List[str]
    scaling: ScalingLabel
    frontline: LevelLabel
    peel: LevelLabel
    engage: LevelLabel
    damage_profile: DamageLabel
    has_hypercarry: bool
    hypercarries: List[str]
    tags: List[str]


class WinconSide(TypedDict):
    label: str
    short: str
    detailed: str
    summary: TeamCompSummary


class WinconResult(TypedDict):
    status: str  # "ok" | "incomplete_champion_data"
    missing_champions: List[str]
    ally: WinconSide | None
    enemy: WinconSide | None


# -------------------------------------------------
# Internal helpers
# -------------------------------------------------


def _get_profiles_for_champs(champion_names: List[str]) -> Tuple[List[ChampProfile], List[str]]:
    profiles: List[ChampProfile] = []
    missing: List[str] = []

    for name in champion_names:
        profile = CHAMP_PROFILES.get(name)
        if profile is None:
            missing.append(name)
        else:
            profiles.append(profile)

    return profiles, missing


def _average_scaling(profiles: List[ChampProfile]) -> ScalingLabel:
    if not profiles:
        return "mixed"

    mapping: Dict[str, int] = {"early": 0, "mid": 1, "late": 2}
    total = 0.0
    for p in profiles:
        total += mapping.get(p["scaling"], 1)

    avg = total / len(profiles)
    if avg <= 0.7:
        return "early"
    if avg <= 1.3:
        return "mid"
    return "late"


def _level_from_score(score: float) -> LevelLabel:
    if score < 0.6:
        return "low"
    if score < 1.3:
        return "medium"
    return "high"


def _summarize_team_comp(champion_names: List[str]) -> TeamCompSummary:
    profiles, _ = _get_profiles_for_champs(champion_names)

    # Safety: if somehow empty, return neutral summary
    if not profiles:
        return {
            "champs": champion_names,
            "scaling": "mixed",
            "frontline": "low",
            "peel": "low",
            "engage": "low",
            "damage_profile": "mixed",
            "has_hypercarry": False,
            "hypercarries": [],
            "tags": [],
        }

    # Frontline / peel / engage
    frontline_score = 0.0
    peel_score = 0.0
    engage_score = 0.0

    # Damage type estimation
    physical_count = 0
    magic_count = 0

    # Hypercarry detection
    hypercarries: List[str] = []
    all_tags: List[str] = []

    for name, profile in zip(champion_names, profiles):
        role = profile["role"]
        durability = profile["durability"]
        peel = profile["peel"]
        engage = profile["engage"]
        tags = profile["tags"]

        # Frontline: tank/bruiser + durability
        if role in ["tank", "bruiser"]:
            frontline_score += 1.0
        if durability == "high":
            frontline_score += 1.0
        elif durability == "medium":
            frontline_score += 0.5

        # Peel
        if peel == "strong":
            peel_score += 2.0
        elif peel == "utility":
            peel_score += 1.0

        # Engage
        if engage == "high":
            engage_score += 2.0
        elif engage == "medium":
            engage_score += 1.0

        # Damage type rough heuristic
        if role in ["control-mage", "burst-mage", "poke", "enchanter"]:
            magic_count += 1
        else:
            physical_count += 1

        # Hypercarry
        if role == "hypercarry":
            hypercarries.append(name)

        all_tags.extend(tags)

    n = float(len(profiles))
    frontline_label = _level_from_score(frontline_score / n)
    peel_label = _level_from_score(peel_score / n)
    engage_label = _level_from_score(engage_score / n)

    # Damage profile
    if physical_count > 0 and magic_count > 0:
        damage_profile: DamageLabel = "mixed"
    elif magic_count > 0:
        damage_profile = "magic"
    else:
        damage_profile = "physical"

    scaling_label = _average_scaling(profiles)

    # De-duplicate tags
    unique_tags = sorted(set(all_tags))

    return {
        "champs": champion_names,
        "scaling": scaling_label,
        "frontline": frontline_label,
        "peel": peel_label,
        "engage": engage_label,
        "damage_profile": damage_profile,
        "has_hypercarry": len(hypercarries) > 0,
        "hypercarries": hypercarries,
        "tags": unique_tags,
    }


def _classify_wincon(summary: TeamCompSummary) -> WinconSide:
    """
    Pure draft-based win condition classification.
    Does NOT look at timeline or stats – just champ identities.
    """

    scaling = summary["scaling"]
    frontline = summary["frontline"]
    peel = summary["peel"]
    engage = summary["engage"]
    damage_profile = summary["damage_profile"]
    tags = summary["tags"]
    hypercarries = summary["hypercarries"]

    label = "Balanced teamfight"
    short = "Balanced teamfight / skirmish comp."
    detailed_parts: List[str] = []

    # Hypercarry + peel + frontline → front-to-back
    if summary["has_hypercarry"] and frontline != "low" and peel in ["medium", "high"]:
        main_carry = hypercarries[0] if hypercarries else "your backline carry"
        label = f"Front-to-back around {main_carry}"
        short = f"Play slow, protect {main_carry}, and take 5v5s when items are online."
        detailed_parts.append(
            f"Your draft has a hypercarry ({main_carry}) with enough frontline/peel to play classic front-to-back fights."
        )

    # Early skirmish / tempo
    elif scaling == "early" or ("early-tempo" in tags or "lane-bully" in tags):
        label = "Early skirmish & tempo"
        short = "Use early prio and skirmish strength to snowball the game."
        detailed_parts.append(
            "Your composition leans early/mid with strong skirmish and lane pressure. "
            "You want to fight around early objectives, invade with prio, and deny enemy scaling."
        )

    # Poke / siege
    elif "poke" in tags and engage in ["low", "medium"]:
        label = "Poke & siege"
        short = "Siege towers with range and poke; avoid hard-commit fights without setup."
        detailed_parts.append(
            "Your team has strong long-range damage and zone control but limited reliable engage. "
            "You want to poke enemies under towers or before objectives, then force when they are chunked."
        )

    # Hard engage / wombo
    elif engage == "high" and any(tag in tags for tag in ["wombo-combo", "aoe-engage", "aoe-wombo"]):
        label = "Hard engage wombo"
        short = "Look for big engages off your AoE tools and commit as 5."
        detailed_parts.append(
            "Your draft has strong hard-engage and AoE tools. "
            "You should play for grouped fights around choke points, flanks, and objective timers."
        )

    # Scaling late
    elif scaling == "late":
        label = "Scaling teamfight"
        short = "Play slow early, trade safely, and fight once your scaling comes online."
        detailed_parts.append(
            "Your composition wants to reach 2–3 items on key carries. "
            "Avoid coinflip early fights and trade objectives when behind tempo."
        )

    # Default balanced
    else:
        detailed_parts.append(
            "Your composition is fairly balanced between skirmish and teamfight. "
            "You can adapt your play around which lanes get prio and how the early game unfolds."
        )

    # Add a little nuance based on damage/engage
    if damage_profile == "magic":
        detailed_parts.append(
            "Your team is magic-heavy. Be aware that if enemies stack MR early, fights become harder unless you snowball."
        )
    elif damage_profile == "physical":
        detailed_parts.append(
            "Your team is physical-heavy. If enemies stack armor, secure early leads or play more for map control than front-to-back."
        )

    if engage == "low" and "poke" not in tags:
        detailed_parts.append(
            "Your engage is limited, so you should avoid starting fights from a front angle. "
            "Play more for vision, flanks, and punishing enemy mistakes."
        )

    detailed = " ".join(detailed_parts)

    return {
        "label": label,
        "short": short,
        "detailed": detailed,
        "summary": summary,
    }


# -------------------------------------------------
# Public API
# -------------------------------------------------


def analyze_wincons_for_game(
    ally_champs: List[str],
    enemy_champs: List[str],
) -> WinconResult:
    """
    Main entry point for the rest of your app.

    ally_champs / enemy_champs should be lists of champion names that match
    the keys in CHAMP_PROFILES (e.g. 'Lee Sin', 'Bel\\'Veth', 'Azir').
    """

    all_names = ally_champs + enemy_champs
    _, missing = _get_profiles_for_champs(all_names)

    if missing:
        return {
            "status": "incomplete_champion_data",
            "missing_champions": missing,
            "ally": None,
            "enemy": None,
        }

    ally_summary = _summarize_team_comp(ally_champs)
    enemy_summary = _summarize_team_comp(enemy_champs)

    ally_side = _classify_wincon(ally_summary)
    enemy_side = _classify_wincon(enemy_summary)

    return {
        "status": "ok",
        "missing_champions": [],
        "ally": ally_side,
        "enemy": enemy_side,
    }
