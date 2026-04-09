"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import champsRaw from "./data/champs.json";
import championRoles from "./data/champion_roles.json";
import matchupData from "./data/matchup_data.json";

type Role = "top" | "jungle" | "mid" | "bot" | "support";
type Side = "blue" | "red";

type Champ = {
  name: string;
  roles: Role[];
  iconKey: string;

  scaling?: string;
  durability?: string;
  cc?: string;
  engage?: string;
  peel?: string;
  range?: string;
  archetype?: string | null;
  lanePrio?: string | null;
  tags?: string[];
};

type Slot = {
  side: Side;
  role: Role;
};

type PickStep = {
  side: Side;
};

type PlannedPick = {
  stepIndex: number;
  slot: Slot;
  champName: string;
  iconKey: string;
};


const ROLES: Role[] = ["top", "jungle", "mid", "bot", "support"];

const ROLE_TAG_ALIASES: Record<Role, string[]> = {
  top: ["top"],
  jungle: ["jungle", "jungler"],
  mid: ["mid"],
  bot: ["bot", "adc"],
  support: ["support"],
};

// Simple data-driven classification - no tags, just lookups
function isAPCarry(c: Champ, role?: Role): boolean {
  // Special case: Fiddlesticks support is not an AP carry
  if (c.name === "Fiddlesticks" && role === "support") {
    return false;
  }
  // Check role-specific overrides first
  const roleSpecific = championRoles.roleSpecific as Record<string, Record<string, string>>;
  if (roleSpecific[c.name] && role && roleSpecific[c.name][role] === "apCarry") {
    return true;
  }
  return championRoles.apCarries.includes(c.name);
}

function isAPTank(c: Champ): boolean {
  return championRoles.apTanks.includes(c.name);
}

function isADC(c: Champ): boolean {
  return championRoles.adcs.includes(c.name);
}

function isTank(c: Champ): boolean {
  return championRoles.tanks.includes(c.name);
}

function isADBruiser(c: Champ): boolean {
  return championRoles.adBruisers.includes(c.name);
}

function isEnchanter(c: Champ, role?: Role): boolean {
  // Special case: Fiddlesticks support is an enchanter
  if (c.name === "Fiddlesticks" && role === "support") {
    return true;
  }
  return championRoles.enchanters.includes(c.name);
}

function isStandardSupport(c: Champ): boolean {
  // Standard supports are enchanters or engage supports
  const tags = new Set((c.tags ?? []).map((t) => t.toLowerCase()));
  const roles = new Set((c.roles ?? []).map((r) => r.toLowerCase()));
  
  // Must have support role
  if (!roles.has("support")) return false;
  
  // Enchanters: have enchanter tag, shield tag, or strong peel
  const isEnchanterCheck = isEnchanter(c);
  
  // Engage supports: have engage tag, high engage stat, or are known engage supports
  const isEngage = tags.has("engage") || 
                    (c.engage ?? "").toLowerCase() === "high" ||
                    c.name === "Leona" || c.name === "Nautilus" || c.name === "Thresh" ||
                    c.name === "Blitzcrank" || c.name === "Alistar" || c.name === "Braum" ||
                    c.name === "Rakan" || c.name === "Taric" || c.name === "Rell" ||
                    c.name === "Pyke" || c.name === "Bard";
  
  return isEnchanterCheck || isEngage;
}

function champPlaysRole(c: Champ, role: Role) {
  // For support role, only allow standard supports (enchanters/engage)
  if (role === "support") {
    return isStandardSupport(c);
  }
  
  if (c.roles?.includes(role)) return true;
  const tags = c.tags ?? [];
  const aliases = ROLE_TAG_ALIASES[role];
  return aliases.some((a) => tags.includes(a));
}

const PICK_STEPS: PickStep[] = [
  { side: "blue" },
  { side: "red" },
  { side: "red" },
  { side: "blue" },
  { side: "blue" },
  { side: "red" },
  { side: "red" },
  { side: "blue" },
  { side: "blue" },
  { side: "red" },
];

function sampleOne<T>(arr: T[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle<T>(arr: T[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function sideLabel(side: Side) {
  return side === "blue" ? "BLUE" : "RED";
}

function pickCode(stepIndex: number) {
  const side = PICK_STEPS[stepIndex].side === "blue" ? "B" : "R";
  const bluePickNumber = [0, 3, 4, 7, 8].indexOf(stepIndex) + 1;
  const redPickNumber = [1, 2, 5, 6, 9].indexOf(stepIndex) + 1;
  const num = side === "B" ? bluePickNumber : redPickNumber;
  return `${side}${num}`;
}

function slotKey(slot: Slot) {
  return `${slot.side}:${slot.role}`;
}

function champIconPath(iconKey: string) {
  // Handle iconKey mapping for special cases
  if (iconKey === "mundo") return `/draft/drmundo.png`;
  return `/draft/${iconKey}.png`;
}

function champDisplayName(name: string): string {
  if (name === "MonkeyKing" || name === "monkeyking") return "Wukong";
  if (name === "DrMundo" || name === "drmundo") return "Dr. Mundo";
  return name;
}

function roleBadge(role: Role) {
  const map: Record<Role, string> = {
    top: "TOP",
    jungle: "JUNGLE",
    mid: "MID",
    bot: "BOT",
    support: "SUPPORT",
  };
  return map[role];
}

function stableHash(input: string) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function tagHas(champ: Champ, needle: string) {
  const tags = champ.tags ?? [];
  return tags.includes(needle);
}

function uniqRoles(arr: Role[]) {
  const s = new Set<Role>();
  for (const r of arr) s.add(r);
  return Array.from(s.values());
}

function inferRolesFromTags(ch: Champ): Role[] {
  const tags = (ch.tags ?? []).map((t) => t.toLowerCase());
  const roles: Role[] = [];

  const hasAny = (needles: string[]) => needles.some((n) => tags.includes(n));

  if (hasAny(["top"])) roles.push("top");
  if (hasAny(["mid"])) roles.push("mid");
  if (hasAny(["support", "supp"])) roles.push("support");
  if (hasAny(["bot", "adc", "apc"])) roles.push("bot");
  if (hasAny(["jungle", "jungler"])) roles.push("jungle");

  return uniqRoles(roles);
}

function normalizeRange(v: string | undefined) {
  const r = (v ?? "").trim().toLowerCase();
  if (r === "short") return "melee";
  if (r === "melee" || r === "medium" || r === "long") return r;
  return "medium";
}

function normalizeChamp(ch: Champ): Champ {
  const baseRoles = (ch.roles ?? []) as Role[];
  const roles = baseRoles.length ? baseRoles : inferRolesFromTags(ch);

  return {
    ...ch,
    roles,
    range: normalizeRange(ch.range),
  };
}

function normScaling(v: string | undefined) {
  const s = (v ?? "").trim().toLowerCase();
  if (s === "high" || s === "late") return 3;
  if (s === "mid" || s === "medium") return 2;
  if (s === "low" || s === "early") return 1;
  return 2;
}

function isLongRange(c: Champ) {
  const r = (c.range ?? "").toLowerCase();
  return r === "long";
}

function isMelee(c: Champ) {
  const r = (c.range ?? "").toLowerCase();
  return r === "melee";
}

// Helper function for compatibility
function isMage(c: Champ) {
  return isAPCarry(c);
}

function isUtilityMage(c: Champ) {
  if (!isMage(c)) return false;
  const tags = new Set((c.tags ?? []).map((t) => t.toLowerCase()));
  return tagHas(c, "peel") || tagHas(c, "support") || tagHas(c, "enchanter") || tagHas(c, "control-mage") || (c.peel ?? "").toLowerCase() === "strong" || (c.cc ?? "").toLowerCase() === "high";
}

function isAssassinLike(c: Champ) {
  const a = (c.archetype ?? "").toLowerCase();
  return a.includes("assassin") || tagHas(c, "assassin") || tagHas(c, "dive") || tagHas(c, "burst") || tagHas(c, "pick");
}

function isHypercarryLike(c: Champ) {
  const a = (c.archetype ?? "").toLowerCase();
  return a.includes("hypercarry") || tagHas(c, "hypercarry") || tagHas(c, "dps-carry");
}

function hasEngage(c: Champ) {
  return (c.engage ?? "") === "high" || tagHas(c, "engage") || tagHas(c, "aoe-engage") || tagHas(c, "dive");
}

function hasPeel(c: Champ) {
  const p = (c.peel ?? "").toLowerCase();
  if (p === "strong") return true;
  return tagHas(c, "peel") || tagHas(c, "disengage") || tagHas(c, "anti-dive");
}

function hasCC(c: Champ) {
  const cc = (c.cc ?? "").toLowerCase();
  return cc === "high" || cc === "medium" || tagHas(c, "hook") || tagHas(c, "cc-chain") || tagHas(c, "pick");
}

type Style = "frontline" | "utility" | "carry" | "assassin" | "mage";
type DamageClass = "physical" | "magic" | "mixed";

// Simple damage class based on champion type
function guessDamageClass(champ: Champ): DamageClass {
  // AP carries and AP tanks deal magic damage
  if (isAPCarry(champ) || isAPTank(champ)) return "magic";
  // ADCs deal physical damage
  if (isADC(champ)) return "physical";
  // Everything else is mixed
  return "mixed";
}

// Helper function for compatibility
function isFrontline(c: Champ) {
  return isTank(c) || isADBruiser(c);
}

function champStyle(c: Champ): Style {
  if (isFrontline(c) && (hasCC(c) || hasEngage(c))) return "frontline";
  if (isADC(c) || isHypercarryLike(c) || tagHas(c, "marksman") || tagHas(c, "dps-carry")) return "carry";
  if (isAssassinLike(c)) return "assassin";
  if (hasPeel(c) && !isFrontline(c)) return "utility";
  return "mage";
}

function styleCounts(team: Champ[]) {
  const counts: Record<Style, number> = { frontline: 0, utility: 0, carry: 0, assassin: 0, mage: 0 };
  for (const c of team) counts[champStyle(c)] += 1;
  return counts;
}

function damageCounts(team: Champ[]) {
  const counts: Record<DamageClass, number> = { physical: 0, magic: 0, mixed: 0 };
  for (const c of team) counts[guessDamageClass(c)] += 1;
  return counts;
}

function teamDamageSummary(team: Champ[]) {
  const { physical, magic, mixed } = damageCounts(team);
  const effectivePhysical = physical + mixed * 0.5;
  const effectiveMagic = magic + mixed * 0.5;
  return {
    physical,
    magic,
    mixed,
    effectivePhysical,
    effectiveMagic,
  };
}


// Data-driven matchup and synergy functions using winrate data
// Returns winrate (0-100) when candidate plays against target, or null if data not available
function getMatchupWinrate(candidate: Champ, target: Champ): number | null {
  const cName = candidate.name;
  const tName = target.name;
  const matchup = (matchupData.matchups as any)[cName];
  if (matchup && matchup.vs && matchup.vs[tName] !== undefined) {
    return matchup.vs[tName];
  }
  return null;
}

// NOTE: This function is kept for potential future use, but synergies are NOT team synergies.
// Synergies in matchup_data.json represent favorable role matchups (champions that are strong
// into certain matchups in the same role), NOT how well champions work together on a team.
// Returns winrate (0-100) for favorable matchup, or null if data not available
function getSynergyWinrate(candidate: Champ, teammate: Champ): number | null {
  const cName = candidate.name;
  const tName = teammate.name;
  const synergy = (matchupData.synergies as any)[cName];
  if (synergy && synergy.with && synergy.with[tName] !== undefined) {
    return synergy.with[tName];
  }
  // Check reverse (teammate synergies with candidate)
  const reverseSynergy = (matchupData.synergies as any)[tName];
  if (reverseSynergy && reverseSynergy.with && reverseSynergy.with[cName] !== undefined) {
    return reverseSynergy.with[cName];
  }
  return null;
}

// Convert winrate (0-100) to score bonus/penalty
// 50% = neutral (0), above 50% = bonus, below 50% = penalty
// Scale: 1% winrate difference = 1 score point
function winrateToScore(winrate: number): number {
  return (winrate - 50) * 1.0; // 1 point per 1% winrate difference from 50%
}

// Pure data-driven counter scoring based on winrate data
// Uses matchup data as primary source, synergy as fallback
function simpleCounterScore(candidate: Champ, target: Champ) {
  let score = 0;

  // PRIMARY: Use matchup data (contains both good and bad matchups, all roles)
  const matchupWinrate = getMatchupWinrate(candidate, target);
  if (matchupWinrate !== null) {
    // Matchup winrate: >50% = candidate wins, <50% = candidate loses
    score += winrateToScore(matchupWinrate);
  } else {
    // FALLBACK: Use synergy data only if matchup data is missing
    const synergyWinrate = getSynergyWinrate(candidate, target);
    if (synergyWinrate !== null) {
      // Synergy winrate: >50% = candidate is good into target
      score += winrateToScore(synergyWinrate);
    } else {
      // Last resort: basic logic only if no data available
      const tIsLong = isLongRange(target);
      const cIsLong = isLongRange(candidate);
      const cIsMelee = isMelee(candidate);
      
      // Very basic fallback - minimal impact
      if (cIsLong && isMelee(target)) score += 2;
      if (cIsMelee && tIsLong) score -= 2;
    }
  }

  return score;
}

// Counter scoring: Reward picking champs that counter the opponent team
// Uses matchup data as primary source (contains both good and bad matchups, all roles)
// Falls back to synergy data only if matchup data is missing
function simpleTeamCounterScore(candidate: Champ, opponentTeam: Champ[]): number {
  let score = 0;
  for (const opponent of opponentTeam) {
    // PRIMARY: Use matchup data (candidate vs opponent)
    const matchupWinrate = getMatchupWinrate(candidate, opponent);
    if (matchupWinrate !== null) {
      // Matchup winrate: >50% = candidate wins (good counter), <50% = candidate loses (bad counter)
      score += winrateToScore(matchupWinrate);
    } else {
      // FALLBACK: Use synergy data only if matchup data is missing
      const synergyWinrate = getSynergyWinrate(candidate, opponent);
      if (synergyWinrate !== null) {
        // Synergy winrate: >50% = candidate is good into opponent
        score += winrateToScore(synergyWinrate);
      }
    }
  }
  return score;
}

// Synergy scoring: Same as counter scoring - uses matchup primary, synergy fallback
function simpleTeamSynergyScore(candidate: Champ, opponentTeam: Champ[]): number {
  return simpleTeamCounterScore(candidate, opponentTeam);
}

// Composition requirements: 1 ADC, 1 APC, 1 tank per team
function compNeedsPenalty(candidate: Champ, team: Champ[], pickIndex: number): number {
  const nextTeam = [...team, candidate];
  let penalty = 0;

  const adcCount = nextTeam.filter(isADC).length;
  const apCarryCount = nextTeam.filter(c => isAPCarry(c)).length;
  const tankCount = nextTeam.filter(isTank).length;

  const picksLeft = 5 - pickIndex;

  // Penalties for missing required roles
  if (pickIndex >= 4 && adcCount === 0) penalty += 100;
  if (pickIndex >= 4 && apCarryCount === 0) penalty += 100;
  if (pickIndex >= 4 && tankCount === 0) penalty += 30;

  if (pickIndex >= 3 && adcCount === 0) penalty += 50;
  if (pickIndex >= 3 && apCarryCount === 0) penalty += 50;

  return penalty;
}

// Composition bonuses: reward fulfilling requirements
function compNeedsBonus(candidate: Champ, team: Champ[], pickIndex: number): number {
  const nextTeam = [...team, candidate];
  let bonus = 0;

  const adcCount = nextTeam.filter(isADC).length;
  const apCarryCount = nextTeam.filter(c => isAPCarry(c)).length;
  const tankCount = nextTeam.filter(isTank).length;

  const picksLeft = 5 - pickIndex;

  // Large bonuses for picking required roles when missing
  if (adcCount === 0 && isADC(candidate)) {
    bonus += picksLeft <= 2 ? 1000 : (pickIndex >= 2 ? 500 : 200);
  }
  if (apCarryCount === 0 && isAPCarry(candidate)) {
    bonus += picksLeft <= 2 ? 1000 : (pickIndex >= 2 ? 500 : 200);
  }
  if (tankCount === 0 && isTank(candidate)) {
    bonus += picksLeft === 1 ? 300 : (picksLeft <= 2 ? 150 : (pickIndex >= 3 ? 50 : 0));
  }

  return bonus;
}

// Penalty for niche/off-meta picks to encourage standard picks
function calculateNichePenalty(candidate: Champ, role: Role): number {
  let penalty = 0;
  const roles = candidate.roles || [];
  const roleCount = roles.length;
  
  // Penalize champions with many roles (3+) - often flex picks that are niche
  if (roleCount >= 3) {
    penalty += 50;
  } else if (roleCount === 2) {
    const roleSet = new Set(roles.map(r => r.toLowerCase()));
    const standardCombos = [
      new Set(["top", "jungle"]),
      new Set(["mid", "jungle"]),
      new Set(["bot", "mid"]),
    ];
    const isStandardCombo = standardCombos.some(combo => 
      combo.size === roleSet.size && 
      Array.from(combo).every(r => roleSet.has(r))
    );
    if (!isStandardCombo) {
      penalty += 30;
    } else {
      penalty += 15;
    }
  }
  
  // Penalize specific niche picks
  const nichePicks: Record<string, number> = {
    "Seraphine": 40, "Karma": 40, "Lux": 25, "Morgana": 25,
    "Zilean": 35, "Veigar": 30, "Swain": 30, "Brand": 30,
    "Zyra": 25, "Xerath": 30, "Vel'Koz": 30,
    "Vayne": 40, "Quinn": 35, "Lucian": 40, "Tristana": 35,
    "Taliyah": 30, "Diana": 20, "Ekko": 25,
    "Akshan": 30, "Graves": 40, "Kindred": 40,
  };
  
  if (nichePicks[candidate.name]) {
    penalty += nichePicks[candidate.name];
  }
  
  const primaryRole = roles[0];
  if (primaryRole && primaryRole !== role && roles.includes(role)) {
    penalty += 25;
  }
  
  return penalty;
}

function pickEnemyWithVariety(
  pool: Champ[],
  revealedFriendly: Champ[],
  currentEnemyTeam: Champ[],
  usedNames: Set<string>,
  seedStr: string,
  pickNumber: number,
  recentPickCounts: Record<string, number>,
  role?: Role // Role parameter (currently unused, kept for compatibility)
) {
  const candidates = pool.filter((c) => !usedNames.has(c.name))
  if (candidates.length === 0) return null

  // HARD FILTER: Remove invalid candidates BEFORE scoring
  const hasAPCarry = currentEnemyTeam.some(c => isAPCarry(c));
  const hasAPTank = currentEnemyTeam.some(isAPTank);
  const hasADC = currentEnemyTeam.some(isADC);
  
  const validCandidates = candidates.filter((c) => {
    // HARD BLOCK: If team has AP carry, remove ALL AP carries
    if (hasAPCarry && isAPCarry(c)) return false;
    // HARD BLOCK: If team has AP tank, remove ALL AP tanks
    if (hasAPTank && isAPTank(c)) return false;
    // HARD BLOCK: If team has ADC, remove ALL ADCs
    if (hasADC && isADC(c)) return false;
    return true;
  });
  
  if (validCandidates.length === 0) {
    console.error(`No valid candidates after filtering for step ${pickNumber}`);
    return null;
  }

  const rng = mulberry32(stableHash(seedStr))

  const scored = validCandidates.map((c) => {
    // Repeat penalty - prioritize variety
    const repeatCount = recentPickCounts[c.name] ?? 0
    const repeatPenalty = repeatCount * 5000
    
    // Data-driven scoring: Uses matchup data as primary (all matchups, all roles), synergy as fallback
    // Matchup winrate >50% = candidate wins (good counter), <50% = candidate loses (bad counter)
    const counter = simpleTeamCounterScore(c, revealedFriendly) * 0.7 // Rewards counters (matchup primary, synergy fallback)
    
    // Composition requirements and bonuses - maintain pick integrity (1 ADC, 1 APC, 1 tank)
    const compPenalty = compNeedsPenalty(c, currentEnemyTeam, pickNumber) * 0.2
    const compBonus = compNeedsBonus(c, currentEnemyTeam, pickNumber) * 0.25
    
    // Niche penalty - minimize off-meta picks
    const actualRole = role || c.roles?.[0] || "mid";
    const nichePenalty = calculateNichePenalty(c, actualRole) * 0.4

    // Random jitter for variety
    const jitter = (rng() - 0.5) * 4000

    const score = counter + compBonus - compPenalty - repeatPenalty - nichePenalty + jitter

    return { champ: c, score }
  })

  const sorted = [...scored].sort((a, b) => b.score - a.score)
  // Much larger candidate pool - consider more options
  const k = Math.min(150, sorted.length) // Even larger pool for more variety (increased from 100)
  const top = sorted.slice(0, k)

  // Much higher temperature = more randomness
  const temp = 500 // MUCH higher temperature for maximum variety (increased from 200)
  const best = top[0].score
  const weights = top.map((x) => Math.exp((x.score - best) / Math.max(0.0001, temp)))
  const total = weights.reduce((a, b) => a + b, 0)

  let r = rng() * total
  for (let i = 0; i < top.length; i++) {
    r -= weights[i]
    if (r <= 0) return top[i]
  }
  return top[top.length - 1]
}

function buildDraftPlan(allChamps: Champ[], userRole: Role) {
  const userSide: Side = Math.random() < 0.5 ? "blue" : "red";
  const enemySide: Side = userSide === "blue" ? "red" : "blue";

  const stepIndicesForSide = (side: Side) =>
    PICK_STEPS.map((s, i) => ({ s, i }))
      .filter(({ s }) => s.side === side)
      .map(({ i }) => i);

  const blueSteps = stepIndicesForSide("blue");
  const redSteps = stepIndicesForSide("red");

  const eligibleUserStepIndices = userSide === "blue" ? blueSteps.filter((i) => i !== 0) : redSteps;

  const userPickIndex = sampleOne(eligibleUserStepIndices);
  const userPickNumberWithinSide = (userSide === "blue" ? blueSteps : redSteps).indexOf(userPickIndex);

  const orderBySide: Record<Side, Role[]> = { blue: [], red: [] };

  const userSideOrder = new Array<Role>(5) as Role[];
  userSideOrder[userPickNumberWithinSide] = userRole;

  const remainingRolesForUserSide = shuffle(ROLES.filter((r) => r !== userRole));
  for (let i = 0; i < 5; i++) {
    if (!userSideOrder[i]) userSideOrder[i] = remainingRolesForUserSide.pop() as Role;
  }

  const enemySideOrder = shuffle([...ROLES]);

  orderBySide[userSide] = userSideOrder;
  orderBySide[enemySide] = enemySideOrder;

  const pickCount: Record<Side, number> = { blue: 0, red: 0 };
  const slotForStep: Slot[] = [];
  for (let i = 0; i < PICK_STEPS.length; i++) {
    const side = PICK_STEPS[i].side;
    const n = pickCount[side];
    const role = orderBySide[side][n];
    pickCount[side] = n + 1;
    slotForStep.push({ side, role });
  }

  const plannedPicks: PlannedPick[] = slotForStep.map((slot, stepIndex) => {
    return {
      stepIndex,
      slot,
      champName: "",
      iconKey: "",
    };
  });

  const userPool = allChamps
    .filter((c) => champPlaysRole(c, userRole))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    userSide,
    enemySide,
    userPickIndex,
    slotForStep,
    plannedPicks,
    userPool,
  };
}

const ui = {
  bg: "#F5F0E8",
  panel: "#FFFFFF",
  panel2: "#FAF8F5",
  border: "rgba(0,0,0,0.08)",
  borderStrong: "rgba(0,0,0,0.12)",
  text: "#3D3D3D",
  text2: "#6B6B6B",
  text3: "#9B9B9B",
  pinkSoft: "rgba(255,182,193,0.3)",
  blueSoft: "rgba(176,224,230,0.3)",
  redSoft: "rgba(255,192,203,0.3)",
  chip: "rgba(0,0,0,0.04)",
  lavender: "#E6E6FA",
  peach: "#FFDAB9",
  mint: "#F0FFF0",
};

function pillBase(active: boolean) {
  return {
    padding: "10px 16px",
    borderRadius: 18,
    border: `1px solid ${active ? "rgba(255,182,193,0.4)" : ui.border}`,
    background: active ? ui.pinkSoft : ui.panel,
    cursor: "pointer",
    fontWeight: 500,
    color: ui.text,
    letterSpacing: 0.2,
  } as const;
}

export default function Page() {
  const allChamps = useMemo(() => (champsRaw as Champ[]).map(normalizeChamp), []);
  const [userRole, setUserRole] = useState<Role>("jungle");
  const [phase, setPhase] = useState<"setup" | "draft" | "done">("setup");

  const [userSide, setUserSide] = useState<Side>("blue");
  const [enemySide, setEnemySide] = useState<Side>("red");
  const [userPickIndex, setUserPickIndex] = useState<number>(-1);
  const userPickIndexRef = useRef<number>(-1);

  const [slotForStep, setSlotForStep] = useState<Slot[]>([]);
  const slotForStepRef = useRef<Slot[]>([]);
  const [plannedPicks, setPlannedPicks] = useState<PlannedPick[]>([]);
  const [userPool, setUserPool] = useState<Champ[]>([]);
  
  // Function to swap pick order with a teammate (changes when you pick, but you keep your role)
  function swapPickOrder(teammateStepIndex: number) {
    if (phase !== "draft") {
      console.log("[SWAP] Cannot swap: not in draft phase");
      return;
    }
    
    const currentRevealedUntil = revealedUntilRef.current;
    const currentUserPickIndex = userPickIndex;
    
    console.log(`[SWAP] Attempting swap: user at ${currentUserPickIndex}, teammate at ${teammateStepIndex}, revealedUntil: ${currentRevealedUntil}`);
    
    // Can't swap with yourself
    if (teammateStepIndex === currentUserPickIndex) {
      console.log("[SWAP] Cannot swap: same position");
      return;
    }
    
    // Must be a teammate - check this first
    const teammateSlot = slotForStep[teammateStepIndex];
    if (!teammateSlot || teammateSlot.side !== userSide) {
      console.log(`[SWAP] Cannot swap: not a teammate (slot: ${teammateSlot ? teammateSlot.side : 'null'}, userSide: ${userSide})`);
      return;
    }
    
    // Can't swap if either player has already picked
    // Check if the specific slots have been picked, not just the step indices
    const teammateSlotKey = slotKey(teammateSlot);
    const userSlot = slotForStep[currentUserPickIndex];
    const userSlotKey = slotKey(userSlot);
    const teammateHasPicked = boardRef.current[teammateSlotKey] !== null && boardRef.current[teammateSlotKey] !== undefined;
    const userHasPicked = boardRef.current[userSlotKey] !== null && boardRef.current[userSlotKey] !== undefined;
    
    if (teammateHasPicked) {
      console.log(`[SWAP] Cannot swap: teammate at ${teammateStepIndex} has already picked ${boardRef.current[teammateSlotKey]?.name}`);
      return;
    }
    if (userHasPicked) {
      console.log(`[SWAP] Cannot swap: user at ${currentUserPickIndex} has already picked ${boardRef.current[userSlotKey]?.name}`);
      return;
    }
    
    console.log(`[SWAP] Swapping roles: user ${currentUserPickIndex} <-> teammate ${teammateStepIndex}`);
    
    // CRITICAL: Only swap the roles, NOT the entire slots
    // This preserves the original draft order (which team picks when) from PICK_STEPS
    // We only change which teammate picks at which team position
    setSlotForStep((prev) => {
      const newSlots = [...prev];
      const userSlot = newSlots[currentUserPickIndex];
      const teammateSlot = newSlots[teammateStepIndex];
      
      // Verify both slots are on the same team (safety check)
      if (userSlot.side !== teammateSlot.side) {
        console.error(`[SWAP] ERROR: Cannot swap - slots are on different teams!`);
        return prev;
      }
      
      // Only swap the roles, keep the sides (which preserve draft order)
      const tempRole = userSlot.role;
      newSlots[currentUserPickIndex] = { ...userSlot, role: teammateSlot.role };
      newSlots[teammateStepIndex] = { ...teammateSlot, role: tempRole };
      
      // Update ref synchronously
      slotForStepRef.current = newSlots;
      console.log(`[SWAP] Swap complete: user now has role ${teammateSlot.role} at ${currentUserPickIndex}, teammate now has role ${userSlot.role} at ${teammateStepIndex}`);
      return newSlots;
    });
    
    // Update userPickIndex to reflect the swap - user now picks at teammate's position
    // This is necessary so the system knows when it's the user's turn
    setUserPickIndex(teammateStepIndex);
    userPickIndexRef.current = teammateStepIndex; // Update ref synchronously
    
    // CRITICAL: Do NOT restart timers or trigger autoRevealFrom
    // The draft is already in progress, and timers are already running
    // We only swapped roles - the draft order and timing remain unchanged
    // The existing timers will handle the picks when they expire
    
    console.log(`[SWAP] Swap complete: user now at ${teammateStepIndex}, teammate now at ${currentUserPickIndex}. Timers continue unchanged.`);
  }

  const [revealedUntil, setRevealedUntil] = useState<number>(-1);
  const revealedUntilRef = useRef<number>(-1);
  const [board, setBoard] = useState<Record<string, Champ | null>>({});
  const boardRef = useRef<Record<string, Champ | null>>({});

  const [timeLeft, setTimeLeft] = useState<number>(20);
  const [enemyTimeLeft, setEnemyTimeLeft] = useState<number>(0);
  const [teamTimeLeft, setTeamTimeLeft] = useState<number>(0);
  const [isEnemyPicking, setIsEnemyPicking] = useState<boolean>(false);
  const [isTeamPicking, setIsTeamPicking] = useState<boolean>(false);
  const pickTimer = useRef<number | null>(null);
  const enemyTimer = useRef<number | null>(null);
  const teamTimer = useRef<number | null>(null);
  const revealTimer = useRef<number | null>(null);

  const usedNamesRef = useRef<Set<string>>(new Set());
  const [draftToken, setDraftToken] = useState<number>(0);

  const recentPickCountsRef = useRef<Record<string, number>>({});

  const [draftSeed, setDraftSeed] = useState<number>(0);

  function clearTimers() {
    if (pickTimer.current) window.clearInterval(pickTimer.current);
    if (enemyTimer.current) window.clearInterval(enemyTimer.current);
    if (teamTimer.current) window.clearInterval(teamTimer.current);
    if (revealTimer.current) window.clearTimeout(revealTimer.current);
    pickTimer.current = null;
    enemyTimer.current = null;
    teamTimer.current = null;
    revealTimer.current = null;
  }

  function initBoard() {
    const fresh: Record<string, Champ | null> = {};
    for (const side of ["blue", "red"] as Side[]) {
      for (const role of ROLES) fresh[slotKey({ side, role })] = null;
    }
    boardRef.current = fresh;
    return fresh;
  }

  function userSlot(): Slot | null {
    if (userPickIndex < 0 || userPickIndex >= slotForStep.length) return null;
    return slotForStep[userPickIndex];
  }

  const youSlot = userSlot();
  const yourTurn = phase === "draft" && revealedUntil + 1 === userPickIndex;

  function decayRecentPicks() {
    const cur = recentPickCountsRef.current;
    const next: Record<string, number> = {};
    for (const k of Object.keys(cur)) {
      const v = cur[k] * 0.2; // Even faster decay for maximum variety (reduced from 0.3)
      if (v >= 0.5) next[k] = v;
    }
    recentPickCountsRef.current = next;
  }

  function freshSeed() {
    const a = new Uint32Array(1);
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      crypto.getRandomValues(a);
      return a[0] >>> 0;
    }
    return (Math.floor(Math.random() * 2 ** 32) >>> 0) as number;
  }

  function startDraft() {
    clearTimers();
    decayRecentPicks();

    const plan = buildDraftPlan(allChamps, userRole);

    const seed = freshSeed();
    setDraftSeed(seed);

    setUserSide(plan.userSide);
    setEnemySide(plan.enemySide);
    setUserPickIndex(plan.userPickIndex);
    userPickIndexRef.current = plan.userPickIndex; // Update ref synchronously
    setSlotForStep(plan.slotForStep);
    slotForStepRef.current = plan.slotForStep;
    setPlannedPicks(plan.plannedPicks);
    setUserPool(plan.userPool);

    usedNamesRef.current = new Set();
    const freshBoard = initBoard();
    setBoard(freshBoard);
    boardRef.current = freshBoard;
    setRevealedUntil(-1);
    setTimeLeft(20);
    setEnemyTimeLeft(0);
    setTeamTimeLeft(0);
    setIsEnemyPicking(false);
    setIsTeamPicking(false);
    setPhase("draft");
    setDraftToken((t) => t + 1);
  }

  // Helper to check if a champion in teamSoFar is an AP carry (with role context)
  function isAPCarryInTeam(champ: Champ, teamSoFar: Champ[], slotForStep: Slot[], stepIndex: number, side: Side): boolean {
    // Find which role this champion was picked for
    for (let i = 0; i < stepIndex; i++) {
      const prevSlot = slotForStep[i];
      if (prevSlot && prevSlot.side === side) {
        const prevChamp = boardRef.current[slotKey(prevSlot)];
        if (prevChamp && prevChamp.name === champ.name) {
          return isAPCarry(champ, prevSlot.role);
        }
      }
    }
    return isAPCarry(champ); // Fallback if role not found
  }

  // Helper to check if a champion in friendlySoFar is an AP carry (with role context)
  function isAPCarryInFriendlyTeam(champ: Champ, friendlySoFar: Champ[]): boolean {
    // Find which role this champion was picked for
    for (let i = 0; i <= userPickIndex; i++) {
      const slot = slotForStep[i];
      if (!slot) continue;
      if (slot.side !== userSide) continue;
      const c = boardRef.current[slotKey(slot)];
      if (c && c.name === champ.name) {
        return isAPCarry(champ, slot.role);
      }
    }
    return isAPCarry(champ); // Fallback if role not found
  }

  function getRevealedFriendlyChampsSoFar(stepIndex: number) {
    const champs: Champ[] = [];
    for (let i = 0; i <= stepIndex; i++) {
      const slot = slotForStep[i];
      if (!slot) continue;
      if (slot.side !== userSide) continue;
      const c = boardRef.current[slotKey(slot)];
      if (c) champs.push(c);
    }
    return champs;
  }

  function getRevealedEnemyChampsSoFar(stepIndex: number) {
    const champs: Champ[] = [];
    for (let i = 0; i <= stepIndex; i++) {
      const slot = slotForStep[i];
      if (!slot) continue;
      if (slot.side !== enemySide) continue;
      const c = boardRef.current[slotKey(slot)];
      if (c) champs.push(c);
    }
    return champs;
  }

  // Filter pool: remove AP carries, AP tanks, and ADCs if team already has one
  function filterPoolByTeamComposition(pool: Champ[], teamSoFar: Champ[], userRole?: Role): Champ[] {
    // Check if team has AP carry (with role context for Fiddlesticks)
    const hasAPCarry = teamSoFar.some(c => {
      // Find which role this champion was picked for
      for (let i = 0; i < userPickIndex; i++) {
        const slot = slotForStep[i];
        if (!slot) continue;
        if (slot.side !== userSide) continue;
        const prevChamp = boardRef.current[slotKey(slot)];
        if (prevChamp && prevChamp.name === c.name) {
          return isAPCarry(c, slot.role);
        }
      }
      return isAPCarry(c); // Fallback if role not found
    });
    const hasAPTank = teamSoFar.some(isAPTank);
    const hasADC = teamSoFar.some(isADC);
    
    return pool.filter((c) => {
      // If team already has an AP carry, remove all AP carries from pool
      if (hasAPCarry && isAPCarry(c, userRole)) return false;
      // If team already has an AP tank, remove all AP tanks from pool
      if (hasAPTank && isAPTank(c)) return false;
      // If team already has an ADC, remove all ADCs from pool
      if (hasADC && isADC(c)) return false;
      return true;
    });
  }

  function noteRecentPick(name: string) {
    const cur = recentPickCountsRef.current;
    cur[name] = (cur[name] ?? 0) + 200; // EXTREME weight for recent picks to prevent repeats (increased from 100)
  }

  function revealNonUserPick(stepIndex: number) {
    // Use ref for synchronous access (always up-to-date after swaps)
    const slot = slotForStepRef.current[stepIndex] || slotForStep[stepIndex];
    if (!slot) return;
    // Use ref for userPickIndex to ensure we have the latest value after swaps
    if (stepIndex === userPickIndexRef.current) {
      console.log(`revealNonUserPick: Step ${stepIndex} is user's pick, skipping`);
      return;
    }

    const usedNames = new Set<string>(usedNamesRef.current);
    const slotKeyStr = slotKey(slot);
    
    // CRITICAL: Check if there's already a pick at this slot - don't overwrite user picks!
    // This can happen if the user picked and then swapped positions
    const existingPick = boardRef.current[slotKeyStr];
    if (existingPick) {
      // There's already a pick here - don't overwrite it (could be a user pick that was swapped)
      console.log(`revealNonUserPick: Slot ${stepIndex} already has ${existingPick.name}, skipping`);
      return;
    }

    // CRITICAL: Get team composition by reading CURRENT board state synchronously
    // Use boardRef to get the LATEST state immediately (not async React state)
    // This must happen BEFORE any filtering
    let teamSoFar: Champ[] = [];
    if (slot.side === enemySide) {
      for (let i = 0; i < stepIndex; i++) {
        const prevSlot = slotForStep[i];
        if (prevSlot && prevSlot.side === enemySide) {
          const prevChamp = boardRef.current[slotKey(prevSlot)];
          if (prevChamp) {
            teamSoFar.push(prevChamp);
          }
        }
      }
    } else {
      for (let i = 0; i < stepIndex; i++) {
        const prevSlot = slotForStep[i];
        if (prevSlot && prevSlot.side === userSide) {
          const prevChamp = boardRef.current[slotKey(prevSlot)];
          if (prevChamp) {
            teamSoFar.push(prevChamp);
          }
        }
      }
    }

    // Count what the team already has - this is the SOURCE OF TRUTH
    // Need to check each champion with their actual role (for Fiddlesticks support vs jungle)
    const apCarryCount = teamSoFar.filter(c => isAPCarryInTeam(c, teamSoFar, slotForStep, stepIndex, slot.side)).length;
    const apTankCount = teamSoFar.filter(isAPTank).length;
    const adcCount = teamSoFar.filter(isADC).length;
    const tankCount = teamSoFar.filter(isTank).length;
    
    const hasAPCarry = apCarryCount >= 1;
    const hasAPTank = apTankCount >= 1;
    const hasADC = adcCount >= 1;
    const hasTank = tankCount >= 1;
    
    // Calculate how many picks are left for this team
    let picksLeft = 0;
    for (let i = stepIndex + 1; i < slotForStep.length; i++) {
      const futureSlot = slotForStep[i];
      if (futureSlot && futureSlot.side === slot.side) {
        picksLeft++;
      }
    }

    const bruiserCount = teamSoFar.filter(isADBruiser).length;
    const hasBruiser = bruiserCount >= 1;
    
    console.log(`[STEP ${stepIndex}] ${slot.side === enemySide ? 'ENEMY' : 'FRIENDLY'} ${slot.role}: Team has ${apCarryCount} AP carry, ${apTankCount} AP tank, ${adcCount} ADC, ${tankCount} tank, ${bruiserCount} bruiser. Picks left: ${picksLeft}. Team: ${teamSoFar.map(c => c.name).join(', ')}`);

    // STEP 1: Start with all champions that can play this role
    let pool = allChamps.filter((c) => {
      if (!champPlaysRole(c, slot.role)) return false;
      if (usedNames.has(c.name)) return false;
      return true;
    });
    
    // STEP 2: ABSOLUTE HARD BLOCKS - Remove champions that violate limits
    // EXCEPTION: Support picks should NEVER disappear from pool (except duplicates)
    // This allows Neeko, Zyra, Brand, etc. to always be available as supports
    pool = pool.filter((c) => {
      // Support role: Only filter duplicates, never filter by team composition
      if (slot.role === "support") {
        // Only block if it's already picked (duplicate)
        if (usedNames.has(c.name)) return false;
        return true; // Allow all supports regardless of team composition
      }
      
      // For other roles: Apply normal filtering
      // AP Carry rules: Can't have AP carry mid+jungle or mid+top
      // Support can be AP enchanter (not AP carry) with AP jungle
      if (hasAPCarry && isAPCarry(c, slot.role)) {
        // Find where the existing AP carry is
        let existingAPCRole: Role | null = null;
        for (let i = 0; i < stepIndex; i++) {
          const prevSlot = slotForStep[i];
          if (prevSlot && prevSlot.side === slot.side) {
            const prevChamp = boardRef.current[slotKey(prevSlot)];
            if (prevChamp && isAPCarryInTeam(prevChamp, teamSoFar, slotForStep, stepIndex, slot.side)) {
              existingAPCRole = prevSlot.role;
              break;
            }
          }
        }
        
        // HARD BLOCK: Only 1 AP carry per team, regardless of position
        // If team already has an AP carry, block ALL other AP carries
        if (existingAPCRole) {
          return false; // Block all AP carries if team already has one
        }
      }
      // If team already has 1 AP tank, REMOVE ALL AP tanks
      if (hasAPTank && isAPTank(c)) return false;
      // If team already has 1 ADC, REMOVE ALL ADCs
      if (hasADC && isADC(c)) return false;
      // If team already has 1 AD bruiser, REMOVE ALL AD bruisers
      if (hasBruiser && isADBruiser(c)) return false;
      // If team already has 1 tank, REMOVE ALL tanks (prevent tank stacking)
      if (hasTank && isTank(c)) return false;
      return true;
    });
    
    // STEP 3: PREFERENCE REQUIREMENTS - Prefer champions that fulfill missing roles
    // But never filter to empty pool - always keep options available
    // Last pick (picksLeft === 0) can be enchanter, tank, or bruiser
    const isLastPick = picksLeft === 0;
    const preferAPC = !hasAPCarry && (slot.role === "mid" || slot.role === "support" || slot.role === "jungle") && (teamSoFar.length >= 1 || picksLeft <= 1) && !isLastPick;
    const preferADC = !hasADC && slot.role === "bot" && (teamSoFar.length >= 1 || picksLeft <= 1) && !isLastPick;
    // Only prefer tank on last pick if missing - don't force early
    const preferTank = !hasTank && (slot.role === "top" || slot.role === "jungle" || slot.role === "support") && picksLeft === 0;
    const preferBruiser = !hasBruiser && (slot.role === "top" || slot.role === "jungle") && (teamSoFar.length >= 1 || picksLeft <= 1) && !isLastPick;
    
    // Only filter if we have options - never filter to empty pool
    if (preferAPC) {
      const apcsInPool = pool.filter(c => isAPCarry(c, slot.role));
      if (apcsInPool.length > 0) {
        pool = apcsInPool; // Prefer APC - but only if available
      }
      // If no APCs available, keep full pool - better to have a pick than crash
    }
    
    if (preferADC) {
      const adcsInPool = pool.filter(c => isADC(c));
      if (adcsInPool.length > 0) {
        pool = adcsInPool; // Prefer ADC - but only if available
      }
      // If no ADCs available, keep full pool - better to have a pick than crash
    }
    
    if (preferTank) {
      const tanksInPool = pool.filter(c => isTank(c));
      if (tanksInPool.length > 0) {
        pool = tanksInPool; // Prefer tank - but only if available
      }
      // If no tanks available, keep full pool - better to have a pick than crash
    }
    
    if (preferBruiser) {
      const bruisersInPool = pool.filter(c => isADBruiser(c));
      if (bruisersInPool.length > 0) {
        pool = bruisersInPool; // Prefer bruiser - but only if available
      }
      // If no bruisers available, keep full pool - better to have a pick than crash
    }
    
    // Last pick can be enchanter, tank, or bruiser (if support role)
    // But only if we have options - never filter to empty
    if (isLastPick && slot.role === "support") {
      const lastPickOptions = pool.filter(c => isEnchanter(c) || isTank(c) || isADBruiser(c));
      if (lastPickOptions.length > 0) {
        pool = lastPickOptions; // Prefer enchanter, tank, or bruiser for last pick support
      }
      // If no options available, keep full pool - better to have a pick than crash
    }
    
    // Verify pool doesn't contain any invalid champions
    // EXCEPTION: Support picks should NEVER be filtered by team composition (only duplicates)
    // This allows Neeko, Zyra, Brand, Pantheon, Rakan, TahmKench, Taric, etc. to always be available
    const invalidInPool = pool.filter(c => {
      // Support role: Only check for duplicates, never filter by team composition
      if (slot.role === "support") {
        // Only invalid if it's already picked (duplicate)
        if (usedNames.has(c.name)) return true;
        return false; // All supports are valid regardless of team composition
      }
      
      // For other roles: Apply normal filtering
      if (hasAPCarry && isAPCarry(c, slot.role)) return true;
      if (hasAPTank && isAPTank(c)) return true;
      if (hasADC && isADC(c)) return true;
      if (hasBruiser && isADBruiser(c)) return true;
      // Also check the position-specific AP carry rules
      if (hasAPCarry && isAPCarry(c, slot.role)) {
        // Find where the existing AP carry is
        let existingAPCRole: Role | null = null;
        for (let i = 0; i < stepIndex; i++) {
          const prevSlot = slotForStep[i];
          if (prevSlot && prevSlot.side === slot.side) {
            const prevChamp = boardRef.current[slotKey(prevSlot)];
            if (prevChamp && isAPCarryInTeam(prevChamp, teamSoFar, slotForStep, stepIndex, slot.side)) {
              existingAPCRole = prevSlot.role;
              break;
            }
          }
        }
        // Check position conflicts
        if (existingAPCRole && (
          (existingAPCRole === "jungle" && (slot.role === "mid" || slot.role === "top")) ||
          (existingAPCRole === "mid" && (slot.role === "jungle" || slot.role === "top")) ||
          (existingAPCRole === "top" && (slot.role === "mid" || slot.role === "jungle"))
        )) {
          return true; // Invalid: AP carry position conflict
        }
        // Block all other AP carries if existing one is in jungle/mid/top
        if (existingAPCRole && existingAPCRole !== "support" && existingAPCRole !== "bot") {
          return true; // Invalid: already have AP carry in jungle/mid/top
        }
      }
      return false;
    });
    
    if (invalidInPool.length > 0) {
      // Only log error if it's not a support role (support picks are exempt from team comp rules)
      if (slot.role !== "support") {
        console.error(`CRITICAL: Pool contains invalid champions: ${invalidInPool.map(c => c.name).join(', ')}`);
      }
      // Remove them
      pool = pool.filter(c => !invalidInPool.includes(c));
    }

    // If pool is empty, use emergency fallback - but ensure we ALWAYS have a pick
    if (pool.length === 0) {
      console.warn(`[STEP ${stepIndex}] Pool empty for ${slot.role}, using emergency fallback`);
      
      // Emergency pool: Any champion for this role (except duplicates)
      // This should NEVER be empty with 173 champions
      let emergencyPool = allChamps.filter((c) => {
        if (!champPlaysRole(c, slot.role)) return false;
        if (usedNames.has(c.name)) return false;
        // Still block multiple APCs/ADCs/AP tanks (hard rules)
        if (hasAPCarry && isAPCarry(c, slot.role)) return false;
        if (hasAPTank && isAPTank(c)) return false;
        if (hasADC && isADC(c)) return false;
        if (hasBruiser && isADBruiser(c)) return false;
        if (hasTank && isTank(c)) return false;
        return true;
      });
      
      // If emergency pool is still empty (shouldn't happen), remove ALL restrictions except role and duplicates
      if (emergencyPool.length === 0) {
        console.error(`[STEP ${stepIndex}] Emergency pool also empty! Removing all restrictions except role/duplicates`);
        emergencyPool = allChamps.filter((c) => {
          if (!champPlaysRole(c, slot.role)) return false;
          if (usedNames.has(c.name)) return false;
          return true;
        });
      }
      
      // Final safety: If STILL empty (should be impossible), just pick any champion for role
      if (emergencyPool.length === 0) {
        console.error(`[STEP ${stepIndex}] FATAL: No champions available for ${slot.role} even with all restrictions removed!`);
        // This should never happen, but if it does, we'll handle it in the pick logic below
      }
      
      pool = emergencyPool;
    }

    let champToReveal: Champ | null = null;

    if (slot.side === enemySide) {
      const revealedFriendly = getRevealedFriendlyChampsSoFar(stepIndex);
      const friendlySig = revealedFriendly.map((c) => c.name).sort().join(",");
      const enemySig = teamSoFar.map((c) => c.name).sort().join(",");
      const seedStr = `draft=${draftSeed}|step=${stepIndex}|role=${slot.role}|friendly=${friendlySig}|enemy=${enemySig}|userPick=${userPickIndex}`;
      const pickNumberOnEnemySide = teamSoFar.length + 1;

      const picked = pickEnemyWithVariety(pool, revealedFriendly, teamSoFar, usedNames, seedStr, pickNumberOnEnemySide, recentPickCountsRef.current, slot.role);
      let pickedChamp = picked?.champ || null;
      
      // CRITICAL: Verify the picked champion is valid
      if (pickedChamp) {
        const champName = pickedChamp.name;
        const isInFilteredPool = pool.some(c => c.name === champName);
        if (!isInFilteredPool) {
          console.error(`CRITICAL: pickEnemyWithVariety returned ${champName} which is NOT in filtered pool!`);
          pickedChamp = null;
        } else {
          // Double-check it's not invalid
          if ((hasAPCarry && isAPCarry(pickedChamp)) ||
              (hasAPTank && isAPTank(pickedChamp)) ||
              (hasADC && isADC(pickedChamp))) {
            console.error(`CRITICAL: pickEnemyWithVariety returned invalid champion ${champName}!`);
            pickedChamp = null;
          }
        }
      }
      champToReveal = pickedChamp;
    } else {
      // Teammate pick - pick the best counter to enemy team (same logic as enemy picks)
      const revealedEnemy = getRevealedEnemyChampsSoFar(stepIndex);
      const enemySig = revealedEnemy.map((c) => c.name).sort().join(",");
      const friendlySig = teamSoFar.map((c) => c.name).sort().join(",");
      const seedStr = `teammate=${draftSeed}|step=${stepIndex}|role=${slot.role}|friendly=${friendlySig}|enemy=${enemySig}`;
      const pickNumberOnFriendlySide = teamSoFar.length + 1;
      
      const picked = pickEnemyWithVariety(pool, revealedEnemy, teamSoFar, usedNames, seedStr, pickNumberOnFriendlySide, recentPickCountsRef.current, slot.role);
      champToReveal = picked?.champ || null;
      
      // Fallback if pickEnemyWithVariety returns null
      if (!champToReveal && pool.length > 0) {
        console.warn(`pickEnemyWithVariety returned null for teammate pick, using fallback`);
        const rng = mulberry32(stableHash(`fallback-teammate-${stepIndex}-${draftSeed}`));
        const scored = pool.map((c) => {
          const repeatCount = recentPickCountsRef.current[c.name] ?? 0;
          const repeatPenalty = repeatCount * 5000;
          const jitter = (rng() - 0.5) * 2000;
          return { champ: c, score: jitter - repeatPenalty };
        });
        const sorted = [...scored].sort((a, b) => b.score - a.score);
        const k = Math.min(30, sorted.length);
        const top = sorted.slice(0, k);
        champToReveal = sampleOne(top.map(t => t.champ));
      }
    }

    if (!champToReveal) {
      console.error(`No champion selected for step ${stepIndex} - pool may be empty`);
      // Last resort: try to pick ANY champion that can play this role
      const lastResortPool = allChamps.filter(c => {
        if (!champPlaysRole(c, slot.role)) return false;
        if (usedNames.has(c.name)) return false;
        return true;
      });
      if (lastResortPool.length > 0) {
        champToReveal = sampleOne(lastResortPool);
        console.warn(`Using last resort pick: ${champToReveal.name}`);
      } else {
        console.error(`CRITICAL: No valid champions available for ${slot.role} at step ${stepIndex}`);
        // This should never happen with 173 champions, but if it does, we'll handle it below
        // Don't return - let the code continue to try other fallbacks
      }
    }

    // ABSOLUTE FINAL CHECK - use teamSoFar we already calculated (most reliable)
    // This is the team composition BEFORE this pick
    const finalHasAPCarry = teamSoFar.some(c => isAPCarryInTeam(c, teamSoFar, slotForStep, stepIndex, slot.side));
    const finalHasAPTank = teamSoFar.some(isAPTank);
    const finalHasADC = teamSoFar.some(isADC);
    const finalHasBruiser = teamSoFar.some(isADBruiser);
    
    // ABSOLUTE BLOCK - if invalid, DO NOT PROCEED
    if (champToReveal && finalHasAPCarry && isAPCarry(champToReveal, slot.role)) {
      console.error(`ABSOLUTE BLOCK: ${champToReveal.name} is AP carry. Team already has: ${teamSoFar.filter(c => isAPCarryInTeam(c, teamSoFar, slotForStep, stepIndex, slot.side)).map(c => c.name).join(', ')}`);
      // Try emergency retry from completely fresh pool
      const emergencyPool = allChamps.filter(c => {
        if (!champPlaysRole(c, slot.role)) return false;
        if (usedNames.has(c.name)) return false;
        if (isAPCarry(c)) return false; // Block all AP carries
        if (finalHasAPTank && isAPTank(c)) return false;
        if (finalHasADC && isADC(c)) return false;
        if (finalHasBruiser && isADBruiser(c)) return false;
        return true;
      });
      if (emergencyPool.length > 0) {
        // Use variety system even for emergency retries
        const rng = mulberry32(stableHash(`emergency-apc-${stepIndex}-${draftSeed}`));
        const scored = emergencyPool.map((c) => {
          const repeatCount = recentPickCountsRef.current[c.name] ?? 0;
          const repeatPenalty = repeatCount * 2000;
          const jitter = (rng() - 0.5) * 1000;
          return { champ: c, score: jitter - repeatPenalty };
        });
        const sorted = [...scored].sort((a, b) => b.score - a.score);
        const k = Math.min(30, sorted.length);
        const top = sorted.slice(0, k);
        champToReveal = sampleOne(top.map(t => t.champ));
        console.log(`Emergency retry: ${champToReveal.name}`);
      } else {
        // Final fallback: Any champion for this role (except duplicates)
        const finalFallback = allChamps.filter(c => {
          if (!champPlaysRole(c, slot.role)) return false;
          if (usedNames.has(c.name)) return false;
          return true;
        });
        if (finalFallback.length > 0) {
          champToReveal = sampleOne(finalFallback);
          console.warn(`Final fallback selected: ${champToReveal.name}`);
        } else {
          console.error(`CRITICAL: No champions available for ${slot.role} even with all restrictions removed!`);
          return; // Only return if truly impossible (should never happen)
        }
      }
    }
    if (champToReveal && finalHasAPTank && isAPTank(champToReveal)) {
      console.error(`ABSOLUTE BLOCK: ${champToReveal.name} is AP tank. Team already has: ${teamSoFar.filter(isAPTank).map(c => c.name).join(', ')}`);
      const emergencyPool = allChamps.filter(c => {
        if (!champPlaysRole(c, slot.role)) return false;
        if (usedNames.has(c.name)) return false;
        if (finalHasAPCarry && isAPCarry(c, slot.role)) return false;
        if (isAPTank(c)) return false; // Block all AP tanks
        if (finalHasADC && isADC(c)) return false;
        if (finalHasBruiser && isADBruiser(c)) return false;
        return true;
      });
      if (emergencyPool.length > 0) {
        // Use variety system even for emergency retries
        const rng = mulberry32(stableHash(`emergency-aptank-${stepIndex}-${draftSeed}`));
        const scored = emergencyPool.map((c) => {
          const repeatCount = recentPickCountsRef.current[c.name] ?? 0;
          const repeatPenalty = repeatCount * 2000;
          const jitter = (rng() - 0.5) * 1000;
          return { champ: c, score: jitter - repeatPenalty };
        });
        const sorted = [...scored].sort((a, b) => b.score - a.score);
        const k = Math.min(30, sorted.length);
        const top = sorted.slice(0, k);
        champToReveal = sampleOne(top.map(t => t.champ));
        console.log(`Emergency retry: ${champToReveal.name}`);
      } else {
        // Final fallback: Any champion for this role (except duplicates)
        const finalFallback = allChamps.filter(c => {
          if (!champPlaysRole(c, slot.role)) return false;
          if (usedNames.has(c.name)) return false;
          return true;
        });
        if (finalFallback.length > 0) {
          champToReveal = sampleOne(finalFallback);
          console.warn(`Final fallback selected: ${champToReveal.name}`);
        } else {
          console.error(`CRITICAL: No champions available for ${slot.role} even with all restrictions removed!`);
          return; // Only return if truly impossible (should never happen)
        }
      }
    }
    if (champToReveal && finalHasADC && isADC(champToReveal)) {
      console.error(`ABSOLUTE BLOCK: ${champToReveal.name} is ADC. Team already has: ${teamSoFar.filter(isADC).map(c => c.name).join(', ')}`);
      const emergencyPool = allChamps.filter(c => {
        if (!champPlaysRole(c, slot.role)) return false;
        if (usedNames.has(c.name)) return false;
        if (finalHasAPCarry && isAPCarry(c, slot.role)) return false;
        if (finalHasAPTank && isAPTank(c)) return false;
        if (isADC(c)) return false; // Block all ADCs
        if (finalHasBruiser && isADBruiser(c)) return false;
        return true;
      });
      if (emergencyPool.length > 0) {
        // Use variety system even for emergency retries
        const rng = mulberry32(stableHash(`emergency-adc-${stepIndex}-${draftSeed}`));
        const scored = emergencyPool.map((c) => {
          const repeatCount = recentPickCountsRef.current[c.name] ?? 0;
          const repeatPenalty = repeatCount * 2000;
          const jitter = (rng() - 0.5) * 1000;
          return { champ: c, score: jitter - repeatPenalty };
        });
        const sorted = [...scored].sort((a, b) => b.score - a.score);
        const k = Math.min(30, sorted.length);
        const top = sorted.slice(0, k);
        champToReveal = sampleOne(top.map(t => t.champ));
        console.log(`Emergency retry: ${champToReveal.name}`);
      } else {
        // Final fallback: Any champion for this role (except duplicates)
        const finalFallback = allChamps.filter(c => {
          if (!champPlaysRole(c, slot.role)) return false;
          if (usedNames.has(c.name)) return false;
          return true;
        });
        if (finalFallback.length > 0) {
          champToReveal = sampleOne(finalFallback);
          console.warn(`Final fallback selected: ${champToReveal.name}`);
        } else {
          console.error(`CRITICAL: No champions available for ${slot.role} even with all restrictions removed!`);
          return; // Only return if truly impossible (should never happen)
        }
      }
    }
    
    // ONE MORE VERIFICATION before setting - if invalid, retry immediately
    if (champToReveal && ((finalHasAPCarry && isAPCarry(champToReveal)) ||
        (finalHasAPTank && isAPTank(champToReveal)) ||
        (finalHasADC && isADC(champToReveal)) ||
        (finalHasBruiser && isADBruiser(champToReveal)))) {
      console.error(`CRITICAL: ${champToReveal.name} is invalid! Retrying with valid champion...`);
      // Build emergency pool with strict filtering
      const emergencyPool = allChamps.filter(c => {
        if (!champPlaysRole(c, slot.role)) return false;
        if (usedNames.has(c.name)) return false;
        if (finalHasAPCarry && isAPCarry(c, slot.role)) return false;
        if (finalHasAPTank && isAPTank(c)) return false;
        if (finalHasADC && isADC(c)) return false;
        return true;
      });
      if (emergencyPool.length > 0) {
        champToReveal = sampleOne(emergencyPool);
        if (champToReveal) {
          console.log(`Emergency retry selected: ${champToReveal.name}`);
          // Verify the retry is valid
          if ((finalHasAPCarry && isAPCarry(champToReveal)) ||
              (finalHasAPTank && isAPTank(champToReveal)) ||
              (finalHasADC && isADC(champToReveal))) {
            console.error(`CRITICAL: Emergency retry ${champToReveal.name} is still invalid! Using final fallback...`);
            // Final fallback: Any champion for this role (except duplicates)
            const finalFallback = allChamps.filter(c => {
              if (!champPlaysRole(c, slot.role)) return false;
              if (usedNames.has(c.name)) return false;
              return true;
            });
            if (finalFallback.length > 0) {
              champToReveal = sampleOne(finalFallback);
              if (champToReveal) {
                console.warn(`Final fallback selected: ${champToReveal.name}`);
              }
            }
            // If still no pick, continue - will be caught by null check below
          }
        }
      } else {
        // Final fallback: Any champion for this role (except duplicates)
        const finalFallback = allChamps.filter(c => {
          if (!champPlaysRole(c, slot.role)) return false;
          if (usedNames.has(c.name)) return false;
          return true;
        });
        if (finalFallback.length > 0) {
          champToReveal = sampleOne(finalFallback);
          console.warn(`Final fallback selected: ${champToReveal.name}`);
        } else {
          console.error(`CRITICAL: No champions available for ${slot.role} even with all restrictions removed!`);
          return; // Only return if truly impossible (should never happen)
        }
      }
    }

    // Final null check - must be after all retries
    if (!champToReveal) {
      console.error(`CRITICAL: champToReveal is null after all checks! Using absolute last resort...`);
      // Absolute last resort: Any champion for this role (except duplicates)
      const absoluteLastResort = allChamps.filter(c => {
        if (!champPlaysRole(c, slot.role)) return false;
        if (usedNames.has(c.name)) return false;
        return true;
      });
      if (absoluteLastResort.length > 0) {
        champToReveal = sampleOne(absoluteLastResort);
        console.warn(`Absolute last resort selected: ${champToReveal.name}`);
      } else {
        console.error(`FATAL: Truly no champions available for ${slot.role}. This should be impossible.`);
        return; // Only return if truly impossible (should never happen with 173 champions)
      }
    }
    
    // Prevent re-revealing the same pick
    const currentChamp = board[slotKeyStr];
    if (currentChamp && champToReveal && currentChamp.name === champToReveal.name) {
      setRevealedUntil(stepIndex);
      revealedUntilRef.current = stepIndex;
      return;
    }

    // Verify champion is in the filtered pool (safety check)
    if (!champToReveal) {
      console.error(`CRITICAL: champToReveal is null! Using absolute last resort...`);
      // Absolute last resort: Any champion for this role (except duplicates)
      const absoluteLastResort = allChamps.filter(c => {
        if (!champPlaysRole(c, slot.role)) return false;
        if (usedNames.has(c.name)) return false;
        return true;
      });
      if (absoluteLastResort.length > 0) {
        champToReveal = sampleOne(absoluteLastResort);
        console.warn(`Absolute last resort selected: ${champToReveal.name}`);
      } else {
        console.error(`FATAL: Truly no champions available for ${slot.role}. This should be impossible.`);
        return; // Only return if truly impossible (should never happen with 173 champions)
      }
    }
    const champName = champToReveal.name;
    const isInPool = pool.some(c => c.name === champName);
    if (!isInPool) {
      console.error(`CRITICAL: ${champName} is NOT in the filtered pool! Retrying...`);
      // Retry with emergency pool
      const emergencyPool = allChamps.filter(c => {
        if (!champPlaysRole(c, slot.role)) return false;
        if (usedNames.has(c.name)) return false;
        if (finalHasAPCarry && isAPCarry(c, slot.role)) return false;
        if (finalHasAPTank && isAPTank(c)) return false;
        if (finalHasADC && isADC(c)) return false;
        return true;
      });
      if (emergencyPool.length > 0) {
        champToReveal = sampleOne(emergencyPool);
        if (champToReveal) {
          console.log(`Emergency retry from pool check: ${champToReveal.name}`);
          // Verify the retry is valid
          if ((finalHasAPCarry && isAPCarry(champToReveal)) ||
              (finalHasAPTank && isAPTank(champToReveal)) ||
              (finalHasADC && isADC(champToReveal))) {
            console.error(`CRITICAL: Emergency retry ${champToReveal.name} is still invalid! Using final fallback...`);
            // Final fallback: Any champion for this role (except duplicates)
            const finalFallback = allChamps.filter(c => {
              if (!champPlaysRole(c, slot.role)) return false;
              if (usedNames.has(c.name)) return false;
              return true;
            });
            if (finalFallback.length > 0) {
              champToReveal = sampleOne(finalFallback);
              console.warn(`Final fallback selected: ${champToReveal.name}`);
            }
          }
        } else {
          console.error(`No emergency pool available, using final fallback...`);
          // Final fallback: Any champion for this role (except duplicates)
          const finalFallback = allChamps.filter(c => {
            if (!champPlaysRole(c, slot.role)) return false;
            if (usedNames.has(c.name)) return false;
            return true;
          });
          if (finalFallback.length > 0) {
            champToReveal = sampleOne(finalFallback);
            console.warn(`Final fallback selected: ${champToReveal.name}`);
          }
        }
      } else {
        console.error(`No emergency pool available, using final fallback...`);
        // Final fallback: Any champion for this role (except duplicates)
        const finalFallback = allChamps.filter(c => {
          if (!champPlaysRole(c, slot.role)) return false;
          if (usedNames.has(c.name)) return false;
          return true;
        });
        if (finalFallback.length > 0) {
          champToReveal = sampleOne(finalFallback);
          console.warn(`Final fallback selected: ${champToReveal.name}`);
        }
      }
    }
    
    // FINAL ABSOLUTE CHECK - if still invalid, use absolute last resort
    if (!champToReveal) {
      console.error(`ABSOLUTE FAILURE: No valid champion available after all retries! Using absolute last resort...`);
      // Absolute last resort: Any champion for this role (except duplicates)
      const absoluteLastResort = allChamps.filter(c => {
        if (!champPlaysRole(c, slot.role)) return false;
        if (usedNames.has(c.name)) return false;
        return true;
      });
      if (absoluteLastResort.length > 0) {
        champToReveal = sampleOne(absoluteLastResort);
        console.warn(`Absolute last resort selected: ${champToReveal.name}`);
      } else {
        console.error(`FATAL: Truly no champions available for ${slot.role}. This should be impossible.`);
        return; // Only return if truly impossible (should never happen with 173 champions)
      }
    }
    
    // Final validation - if still invalid, accept it (better than crashing)
    if (champToReveal && ((finalHasAPCarry && isAPCarry(champToReveal)) ||
        (finalHasAPTank && isAPTank(champToReveal)) ||
        (finalHasADC && isADC(champToReveal)) ||
        (finalHasBruiser && isADBruiser(champToReveal)))) {
      console.error(`WARNING: ${champToReveal.name} passed all retries but is still invalid. Proceeding anyway to avoid crash.`);
      // Don't return - proceed with the pick to avoid crashing the draft
      // The composition will be suboptimal, but the draft can continue
    }

    console.log(`[REVEAL] Setting ${champToReveal.name} for ${slot.side} ${slot.role} at step ${stepIndex}`);
    
    usedNamesRef.current.add(champToReveal.name);
    noteRecentPick(champToReveal.name);

    // At this point, champToReveal is guaranteed to be valid
    // We've checked it multiple times and retried if needed
    // setBoard should never block - if it does, it means our pre-checks failed
    setBoard((prev) => {
      const copy = { ...prev };
      copy[slotKeyStr] = champToReveal!;
      // Update ref synchronously so next pick can read it immediately
      boardRef.current = copy;
      console.log(`[REVEAL] Board updated: ${slotKeyStr} = ${champToReveal.name}`);
      return copy;
    });

    setRevealedUntil(stepIndex);
    revealedUntilRef.current = stepIndex;
    console.log(`[REVEAL] revealedUntil updated to ${stepIndex}`);
  }

  function lockUserPick(champ: Champ) {
    const slot = userSlot();
    if (!slot) return;

    if (usedNamesRef.current.has(champ.name)) return;
    
    // VALIDATE USER PICK - check team composition
    // Read CURRENT board state (synchronously from ref) - includes all picks up to now
    const friendlySoFar = getRevealedFriendlyChampsSoFar(userPickIndex);
    const hasAPCarry = friendlySoFar.some(c => isAPCarryInFriendlyTeam(c, friendlySoFar));
    const hasAPTank = friendlySoFar.some(isAPTank);
    const hasADC = friendlySoFar.some(isADC);
    
    // ABSOLUTE BLOCK - if team already has one, don't allow another
    if (hasAPCarry && isAPCarry(champ, slot?.role)) {
      console.error(`USER PICK BLOCKED: ${champ.name} is AP carry but team already has: ${friendlySoFar.filter(c => isAPCarryInFriendlyTeam(c, friendlySoFar)).map(c => c.name).join(', ')}`);
      alert(`Cannot pick ${champ.name}: Your team already has an AP carry (${friendlySoFar.filter(c => isAPCarryInFriendlyTeam(c, friendlySoFar)).map(c => c.name).join(', ')})`);
      return; // Don't allow the pick
    }
    if (hasAPTank && isAPTank(champ)) {
      console.error(`USER PICK BLOCKED: ${champ.name} is AP tank but team already has: ${friendlySoFar.filter(isAPTank).map(c => c.name).join(', ')}`);
      alert(`Cannot pick ${champ.name}: Your team already has an AP tank (${friendlySoFar.filter(isAPTank).map(c => c.name).join(', ')})`);
      return;
    }
    if (hasADC && isADC(champ)) {
      console.error(`USER PICK BLOCKED: ${champ.name} is ADC but team already has: ${friendlySoFar.filter(isADC).map(c => c.name).join(', ')}`);
      alert(`Cannot pick ${champ.name}: Your team already has an ADC (${friendlySoFar.filter(isADC).map(c => c.name).join(', ')})`);
      return;
    }
    
    usedNamesRef.current.add(champ.name);
    noteRecentPick(champ.name);

    setBoard((prev) => {
      const copy = { ...prev };
      copy[slotKey(slot)] = champ;
      // Update ref synchronously so next pick can read it immediately
      boardRef.current = copy;
      return copy;
    });

    setRevealedUntil(userPickIndex);
    revealedUntilRef.current = userPickIndex;

    const next = userPickIndex + 1;
    if (next >= PICK_STEPS.length) {
      setPhase("done");
      return;
    }
    continueAfterUserPick(next);
  }

  function autoPickForUser() {
    // Check if user already picked - if so, don't auto-pick
    const slot = userSlot();
    if (!slot) return;
    const slotKeyStr = slotKey(slot);
    if (boardRef.current[slotKeyStr]) {
      // User already picked, don't override
      return;
    }
    
    const usedNames = new Set<string>(usedNamesRef.current);
    const friendlySoFar = getRevealedFriendlyChampsSoFar(userPickIndex);
    let pool = userPool.filter((c) => !usedNames.has(c.name));
    // Remove AP carries and ADCs if team already has one
    pool = filterPoolByTeamComposition(pool, friendlySoFar, slot?.role);
    const pick = pool.length ? pool[Math.floor(Math.random() * pool.length)] : allChamps.find((c) => !usedNames.has(c.name)) ?? allChamps[0];
    lockUserPick(pick);
  }

  function continueAfterUserPick(fromIndex: number) {
    if (pickTimer.current) window.clearInterval(pickTimer.current);
    pickTimer.current = null;
    setTimeLeft(20);
    
    // Clear all timers
    if (enemyTimer.current) {
      window.clearInterval(enemyTimer.current);
      enemyTimer.current = null;
    }
    if (teamTimer.current) {
      window.clearInterval(teamTimer.current);
      teamTimer.current = null;
    }
    setIsEnemyPicking(false);
    setIsTeamPicking(false);
    setEnemyTimeLeft(0);
    setTeamTimeLeft(0);

    revealTimer.current = window.setTimeout(() => {
      autoRevealFrom(fromIndex);
    }, 5000);
  }

  function autoRevealFrom(index: number) {
    if (phase !== "draft") return;

    if (index >= PICK_STEPS.length) {
      setPhase("done");
      return;
    }

    // Get the current slot - use ref for synchronous access (always up-to-date after swaps)
    const currentSlot = slotForStepRef.current[index] || slotForStep[index];
    if (!currentSlot) {
      console.error(`No slot found for index ${index}`);
      return;
    }

    // Check if this is the user's pick - use ref for synchronous access (always up-to-date after swaps)
    const currentUserPickIndex = userPickIndexRef.current;
    if (index === currentUserPickIndex) {
      // Check if user already picked - if so, skip timer and continue
      const slot = userSlot();
      if (slot && boardRef.current[slotKey(slot)]) {
        // User already picked, continue to next pick
        continueAfterUserPick(index + 1);
        return;
      }
      
      // Clear all other timers
      if (enemyTimer.current) {
        window.clearInterval(enemyTimer.current);
        enemyTimer.current = null;
      }
      if (teamTimer.current) {
        window.clearInterval(teamTimer.current);
        teamTimer.current = null;
      }
      setIsEnemyPicking(false);
      setIsTeamPicking(false);
      setEnemyTimeLeft(0);
      setTeamTimeLeft(0);
      
      // Set up user timer - start immediately from 20 and count down
      if (pickTimer.current) window.clearInterval(pickTimer.current);
      setTimeLeft(20);
      // Start counting immediately
      pickTimer.current = window.setInterval(() => {
        setTimeLeft((t) => {
          const next = t - 1;
          if (next <= 0) {
            if (pickTimer.current) window.clearInterval(pickTimer.current);
            pickTimer.current = null;
            autoPickForUser();
            return 0;
          }
          return next;
        });
      }, 1000);
      return;
    }

    // Check if this is an enemy pick or teammate pick
    const isEnemyPick = currentSlot.side === enemySide;
    const isTeamPick = currentSlot.side === userSide;

    if (isEnemyPick) {
      // Enemy pick - show timer starting from 12
      setIsEnemyPicking(true);
      setIsTeamPicking(false);
      if (teamTimer.current) {
        window.clearInterval(teamTimer.current);
        teamTimer.current = null;
      }
      setTeamTimeLeft(0);
      
      if (enemyTimer.current) window.clearInterval(enemyTimer.current);
      setEnemyTimeLeft(12);
      // Start counting immediately
      // CRITICAL: Don't capture index in closure - read it fresh when timer hits 0
      // This ensures that if a swap happens, we use the current slot at this index
      let timeRemaining = 12;
      enemyTimer.current = window.setInterval(() => {
        timeRemaining--;
        setEnemyTimeLeft(timeRemaining);
        if (timeRemaining <= 0) {
          if (enemyTimer.current) window.clearInterval(enemyTimer.current);
          enemyTimer.current = null;
          setIsEnemyPicking(false);
          // Timer hit 0 - NOW pick and reveal (not pre-selected)
          // Use the ref to get the current slot at this index (in case of swaps)
          const slotAtThisIndex = slotForStepRef.current[index] || slotForStep[index];
          if (slotAtThisIndex && slotAtThisIndex.side === enemySide) {
            // This is still a valid enemy pick - proceed with reveal
            console.log(`[ENEMY_TIMER] Timer expired for enemy at step ${index}, revealing pick now`);
            revealNonUserPick(index);
            // Then continue to next pick after a short delay
            setTimeout(() => {
              autoRevealFrom(index + 1);
            }, 500);
          } else {
            // Slot changed (probably due to swap) - this timer is no longer valid
            console.log(`[ENEMY_TIMER] Timer expired but slot at ${index} is no longer valid (swap occurred?), skipping`);
          }
        }
      }, 1000);
    } else if (isTeamPick) {
      // Teammate pick - show "your team picking"
      setIsTeamPicking(true);
      setIsEnemyPicking(false);
      if (enemyTimer.current) {
        window.clearInterval(enemyTimer.current);
        enemyTimer.current = null;
      }
      setEnemyTimeLeft(0);
      
      if (teamTimer.current) window.clearInterval(teamTimer.current);
      setTeamTimeLeft(12);
      // Start counting immediately
      // CRITICAL: Don't capture index in closure - read it fresh when timer hits 0
      // This ensures that if a swap happens, we use the current slot at this index
      let timeRemaining = 12;
      teamTimer.current = window.setInterval(() => {
        timeRemaining--;
        setTeamTimeLeft(timeRemaining);
        if (timeRemaining <= 0) {
          if (teamTimer.current) window.clearInterval(teamTimer.current);
          teamTimer.current = null;
          setIsTeamPicking(false);
          // Timer hit 0 - NOW pick and reveal (not pre-selected)
          // Read the current index from the closure variable, but verify it's still valid
          // Use the ref to get the current slot at this index (in case of swaps)
          const slotAtThisIndex = slotForStepRef.current[index] || slotForStep[index];
          if (slotAtThisIndex && slotAtThisIndex.side === userSide && index !== userPickIndexRef.current) {
            // This is still a valid teammate pick - proceed with reveal
            console.log(`[TEAM_TIMER] Timer expired for teammate at step ${index}, revealing pick now`);
            revealNonUserPick(index);
            // Then continue to next pick after a short delay
            setTimeout(() => {
              autoRevealFrom(index + 1);
            }, 500);
          } else {
            // Slot changed (probably due to swap) - this timer is no longer valid
            console.log(`[TEAM_TIMER] Timer expired but slot at ${index} is no longer valid (swap occurred?), skipping`);
          }
        }
      }, 1000);
    }

    // Only reveal if it's not the user's pick
    // Note: The actual reveal happens when the timer hits 0 (handled in the timer intervals above)
    // This check should have already been handled above, but keeping it as a safety check
    if (index === currentUserPickIndex) {
      // This should not happen - user pick should be handled above
      // But if it does, it means the user pick logic above didn't catch it
      console.warn(`[AUTO_REVEAL] Index ${index} is user's pick but wasn't handled above - this might be a swap timing issue`);
      return;
    }
  }

  useEffect(() => {
    if (phase !== "draft") return;
    if (revealedUntil >= 0) return; // Don't restart if draft already started

    clearTimers();

    const t = window.setTimeout(() => {
      autoRevealFrom(0);
    }, 0);

    return () => {
      window.clearTimeout(t);
      clearTimers();
    };
  }, [phase, draftToken]);

  const youRoleLabel = youSlot ? roleBadge(youSlot.role) : roleBadge(userRole);

  const usedNames = useMemo(() => {
    const s = new Set<string>();
    Object.values(board).forEach((c) => {
      if (c) s.add(c.name);
    });
    return s;
  }, [board]);

  const enemyRevealed = useMemo(() => {
    const out: { stepIndex: number; champ: Champ }[] = [];
    for (let i = 0; i <= revealedUntil; i++) {
      const slot = slotForStep[i];
      if (!slot) continue;
      if (slot.side !== enemySide) continue;
      const c = board[slotKey(slot)];
      if (c) out.push({ stepIndex: i, champ: c });
    }
    return out;
  }, [revealedUntil, slotForStep, enemySide, board]);

  const yourRevealed = useMemo(() => {
    const out: { stepIndex: number; champ: Champ | null; role: Role; isYou: boolean }[] = [];
    // Show ALL teammate slots, not just revealed ones
    for (let i = 0; i < slotForStep.length; i++) {
      const slot = slotForStep[i];
      if (!slot) continue;
      if (slot.side !== userSide) continue;
      const c = i <= revealedUntil ? board[slotKey(slot)] : null;
      out.push({ stepIndex: i, champ: c, role: slot.role, isYou: i === userPickIndex });
    }
    return out;
  }, [revealedUntil, slotForStep, userSide, board, userPickIndex]);

  function Panel(props: { title: string; badge: string; tint: string; children: React.ReactNode }) {
    return (
      <section
        style={{
          background: ui.panel,
          border: `1px solid ${ui.border}`,
          borderRadius: 24,
          padding: 20,
          boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ fontWeight: 600, letterSpacing: 0.3, color: ui.text, fontSize: 18 }}>{props.title}</div>
          <div
            style={{
              padding: "4px 12px",
              borderRadius: 20,
              border: `1px solid ${ui.border}`,
              background: props.tint,
              color: ui.text,
              fontWeight: 500,
              fontSize: 11,
              letterSpacing: 0.5,
            }}
          >
            {props.badge}
          </div>
        </div>

        <div style={{ height: 16 }} />
        {props.children}
      </section>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: 32,
        background: `radial-gradient(800px 800px at 20% 10%, rgba(255,182,193,0.15), transparent 50%),
                     radial-gradient(800px 800px at 80% 20%, rgba(176,224,230,0.15), transparent 50%),
                     radial-gradient(600px 600px at 50% 80%, rgba(255,218,185,0.12), transparent 50%),
                     ${ui.bg}`,
        color: ui.text,
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"',
      }}
    >
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
            {phase === "setup" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 32, marginBottom: 60, position: "relative", minHeight: "80vh", width: "100%" }}>
            {/* Big moon in upper right corner */}
            <div style={{ 
              position: "absolute", 
              top: "5%", 
              right: "5%", 
              fontSize: 200,
              opacity: 0.25,
              zIndex: 1,
              pointerEvents: "none",
              transform: "rotate(-15deg)"
            }}>🌙</div>
            
            {/* Big coffee cup to the left of text */}
            <div style={{ 
              position: "absolute", 
              top: "30%", 
              left: "10%", 
              fontSize: 180,
              opacity: 0.3,
              zIndex: 1,
              pointerEvents: "none",
              transform: "rotate(-10deg)"
            }}>☕</div>
            
            {/* Main content with higher z-index */}
            <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center", gap: 20, marginTop: 40 }}>
              <div style={{ fontSize: 42, fontWeight: 600, letterSpacing: 0.3, color: ui.text }}>Draft Practice</div>
              <div style={{ fontSize: 16, color: ui.text2, fontWeight: 500, marginTop: -8 }}>Choose your role and start drafting!</div>
            
              <div style={{ display: "flex", flexDirection: "column", gap: 20, alignItems: "center", width: "100%", maxWidth: 600 }}>
                <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
                {ROLES.map((r) => (
                <button
                      key={r}
                      onClick={() => setUserRole(r)}
                  style={{
                        ...pillBase(userRole === r),
                        background: userRole === r ? ui.pinkSoft : ui.panel,
                        border: `1px solid ${userRole === r ? "rgba(255,182,193,0.4)" : ui.border}`,
                    color: ui.text,
                        fontWeight: 500,
                        boxShadow: userRole === r ? "0 2px 8px rgba(255,182,193,0.2)" : "none",
                        transition: "all 200ms ease",
                      }}
                    >
                      {roleBadge(r)}
                </button>
                  ))}
                </div>

                <button
                  onClick={startDraft}
                  style={{
                    padding: "14px 32px",
                    borderRadius: 24,
                    border: "1px solid rgba(255,182,193,0.4)",
                    background: "linear-gradient(135deg, rgba(255,182,193,0.3), rgba(255,218,185,0.3))",
                    color: ui.text,
                    cursor: "pointer",
                    fontWeight: 600,
                    letterSpacing: 0.4,
                    fontSize: 16,
                    boxShadow: "0 4px 16px rgba(255,182,193,0.25)",
                    transition: "all 200ms ease",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)";
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 6px 20px rgba(255,182,193,0.3)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 16px rgba(255,182,193,0.25)";
                  }}
                >
                  ✨ Start Draft ✨
                </button>
          </div>
        </div>
            
            {/* Moons and stars underneath the content - evenly distributed */}
            <div style={{ position: "absolute", bottom: "15%", left: "5%", fontSize: 52, opacity: 0.3, transform: "rotate(-12deg)", zIndex: 1 }}>🌙</div>
            <div style={{ position: "absolute", bottom: "12%", right: "8%", fontSize: 44, opacity: 0.35, transform: "rotate(18deg)", zIndex: 1 }}>⭐</div>
            <div style={{ position: "absolute", bottom: "18%", left: "18%", fontSize: 38, opacity: 0.25, transform: "rotate(-8deg)", zIndex: 1 }}>✨</div>
            <div style={{ position: "absolute", bottom: "20%", right: "20%", fontSize: 48, opacity: 0.3, transform: "rotate(22deg)", zIndex: 1 }}>🌙</div>
            <div style={{ position: "absolute", bottom: "10%", left: "32%", fontSize: 36, opacity: 0.35, transform: "rotate(-15deg)", zIndex: 1 }}>⭐</div>
            <div style={{ position: "absolute", bottom: "22%", right: "32%", fontSize: 40, opacity: 0.25, transform: "rotate(12deg)", zIndex: 1 }}>✨</div>
            <div style={{ position: "absolute", bottom: "14%", left: "45%", fontSize: 46, opacity: 0.3, transform: "rotate(-10deg)", zIndex: 1 }}>🌙</div>
            <div style={{ position: "absolute", bottom: "16%", right: "45%", fontSize: 42, opacity: 0.35, transform: "rotate(20deg)", zIndex: 1 }}>⭐</div>
            <div style={{ position: "absolute", bottom: "8%", left: "58%", fontSize: 34, opacity: 0.25, transform: "rotate(-18deg)", zIndex: 1 }}>✨</div>
            <div style={{ position: "absolute", bottom: "24%", right: "58%", fontSize: 50, opacity: 0.3, transform: "rotate(15deg)", zIndex: 1 }}>🌙</div>
            <div style={{ position: "absolute", bottom: "6%", left: "70%", fontSize: 40, opacity: 0.35, transform: "rotate(-12deg)", zIndex: 1 }}>⭐</div>
            <div style={{ position: "absolute", bottom: "26%", right: "70%", fontSize: 36, opacity: 0.25, transform: "rotate(8deg)", zIndex: 1 }}>✨</div>
            <div style={{ position: "absolute", bottom: "12%", left: "82%", fontSize: 44, opacity: 0.3, transform: "rotate(-20deg)", zIndex: 1 }}>🌙</div>
            <div style={{ position: "absolute", bottom: "4%", right: "85%", fontSize: 38, opacity: 0.35, transform: "rotate(25deg)", zIndex: 1 }}>⭐</div>
            <div style={{ position: "absolute", bottom: "28%", left: "92%", fontSize: 32, opacity: 0.25, transform: "rotate(-5deg)", zIndex: 1 }}>✨</div>
            <div style={{ position: "absolute", bottom: "2%", right: "5%", fontSize: 48, opacity: 0.3, transform: "rotate(18deg)", zIndex: 1 }}>🌙</div>
          </div>
        )}

        {phase !== "setup" && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              {yourTurn && (
            <div
              style={{
                    padding: "12px 20px",
                    borderRadius: 20,
                    border: `1px solid rgba(255,182,193,0.4)`,
                    background: ui.pinkSoft,
                color: ui.text,
                    fontWeight: 600,
                    fontSize: 16,
                display: "flex",
                alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span>⏱️</span>
                  <span>{timeLeft}s</span>
            </div>
              )}
              {!yourTurn && phase === "draft" && isEnemyPicking && (
            <div
              style={{
                    padding: "12px 20px",
                    borderRadius: 20,
                    border: `1px solid rgba(176,224,230,0.4)`,
                    background: ui.blueSoft,
                color: ui.text,
                    fontWeight: 600,
                    fontSize: 16,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span>⏱️</span>
                  <span>{enemyTimeLeft}s</span>
            </div>
              )}
              {!yourTurn && phase === "draft" && isTeamPicking && (
            <div
              style={{
                    padding: "12px 20px",
                    borderRadius: 20,
                    border: `1px solid rgba(255,182,193,0.4)`,
                    background: ui.pinkSoft,
                    color: ui.text,
                    fontWeight: 600,
                    fontSize: 16,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span>⏱️</span>
                  <span>{teamTimeLeft}s</span>
                </div>
              )}
            </div>
            <button
              onClick={() => {
                setPhase("setup");
                clearTimers();
              }}
              style={{
                padding: "8px 16px",
                borderRadius: 16,
                border: `1px solid ${ui.border}`,
                background: ui.panel,
                color: ui.text2,
                cursor: "pointer",
                fontWeight: 500,
                fontSize: 13,
              }}
            >
              Reset
            </button>
          </div>
        )}

        {phase !== "setup" && (
          <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Panel title="YOUR TEAM" badge={sideLabel(userSide)} tint={userSide === "blue" ? ui.blueSoft : ui.redSoft}>
              <div style={{ display: "grid", gap: 10 }}>
                {yourRevealed.map(({ stepIndex, champ, role, isYou }) => (
                  <div key={`${stepIndex}`} style={{ display: "flex", alignItems: "center", gap: 14, padding: 14, borderRadius: 20, border: `1px solid ${ui.border}`, background: isYou ? ui.pinkSoft : ui.panel2 }}>
                    {champ ? (
                      <img src={champIconPath(champ.iconKey)} width={56} height={56} alt={champ.name} style={{ borderRadius: 16, border: `1px solid ${ui.border}`, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }} />
                    ) : (
                      <div style={{ width: 56, height: 56, borderRadius: 16, border: `1px solid ${ui.border}`, background: ui.panel2, display: "flex", alignItems: "center", justifyContent: "center", color: ui.text3, fontSize: 20 }}>?</div>
                    )}

                    <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
                      <div style={{ color: ui.text, fontWeight: 600, fontSize: 16 }}>
                        {champ ? champDisplayName(champ.name) : `Pick #${stepIndex + 1}`} {isYou ? <span style={{ color: ui.text2, fontWeight: 500, fontSize: 13 }}>(you)</span> : null}
                    </div>
                      <div style={{ color: ui.text3, fontWeight: 500, fontSize: 12 }}>{roleBadge(role)}</div>
                    </div>

                    {!isYou && phase === "draft" && (
                      <button
                        onClick={() => swapPickOrder(stepIndex)}
                        style={{
                          padding: "6px 12px",
                          borderRadius: 12,
                          border: `1px solid ${ui.border}`,
                          background: ui.panel,
                          color: ui.text,
                          cursor: "pointer",
                          fontWeight: 500,
                          fontSize: 11,
                          whiteSpace: "nowrap"
                        }}
                        title="Swap pick order with this teammate"
                      >
                        Swap
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="ENEMY PICKS" badge={sideLabel(enemySide)} tint={enemySide === "blue" ? ui.blueSoft : ui.redSoft}>
              <div style={{ display: "grid", gap: 10 }}>
                {enemyRevealed.length === 0 && (
                  <div style={{ padding: 20, borderRadius: 20, border: `1px solid ${ui.border}`, background: ui.panel2, color: ui.text3, fontWeight: 500, textAlign: "center" }}>
                    No picks yet
                  </div>
                )}

                {enemyRevealed.map(({ stepIndex, champ }) => (
                  <div key={`${stepIndex}:${champ.name}`} style={{ display: "flex", alignItems: "center", gap: 14, padding: 14, borderRadius: 20, border: `1px solid ${ui.border}`, background: ui.panel2 }}>
                    <img src={champIconPath(champ.iconKey)} width={56} height={56} alt={champ.name} style={{ borderRadius: 16, border: `1px solid ${ui.border}`, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }} />

                    <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
                      <div style={{ color: ui.text, fontWeight: 600, fontSize: 16 }}>
                        {champDisplayName(champ.name)}
                          </div>
                      </div>
                    </div>
                ))}
              </div>
            </Panel>
          </div>
        )}

        {phase !== "setup" && (
          <div style={{ marginTop: 24, background: ui.panel, border: `1px solid ${ui.border}`, borderRadius: 24, padding: 24, boxShadow: "0 4px 20px rgba(0,0,0,0.06)" }}>
            <div style={{ maxHeight: 500, overflow: "auto", paddingRight: 8 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: 12 }}>
                {(() => {
                  // Filter user pool: remove AP carries and ADCs if team already has one
                  // Read CURRENT board state (including user's own pick if they already picked)
                  const friendlySoFar = getRevealedFriendlyChampsSoFar(userPickIndex);
                  const slot = userSlot();
                  const filteredPool = filterPoolByTeamComposition(userPool, friendlySoFar, slot?.role);
                  return filteredPool.map((c) => {
                  const disabled = usedNames.has(c.name) || !yourTurn;

                  return (
                    <button
                      key={c.name}
                      disabled={disabled}
                      onClick={() => lockUserPick(c)}
                      style={{
                        padding: 12,
                        borderRadius: 20,
                        border: `1px solid ${disabled ? ui.border : "rgba(255,182,193,0.3)"}`,
                        background: disabled ? ui.panel2 : ui.panel,
                        cursor: disabled ? "not-allowed" : "pointer",
                        opacity: disabled ? 0.4 : 1,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 8,
                        fontWeight: 500,
                        color: ui.text,
                        boxShadow: disabled ? "none" : "0 2px 8px rgba(0,0,0,0.06)",
                        transition: "all 150ms ease",
                      }}
                      onMouseEnter={(e) => {
                        if (disabled) return;
                        (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-3px)";
                        (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,182,193,0.5)";
                        (e.currentTarget as HTMLButtonElement).style.background = ui.pinkSoft;
                        (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 12px rgba(255,182,193,0.2)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
                        (e.currentTarget as HTMLButtonElement).style.borderColor = disabled ? ui.border : "rgba(255,182,193,0.3)";
                        (e.currentTarget as HTMLButtonElement).style.background = disabled ? ui.panel2 : ui.panel;
                        (e.currentTarget as HTMLButtonElement).style.boxShadow = disabled ? "none" : "0 2px 8px rgba(0,0,0,0.06)";
                      }}
                    >
                      <img src={champIconPath(c.iconKey)} width={64} height={64} alt={c.name} style={{ borderRadius: 18, border: `1px solid ${ui.border}`, boxShadow: "0 2px 6px rgba(0,0,0,0.08)" }} />
                      <div style={{ fontSize: 11, textAlign: "center", lineHeight: "13px", color: ui.text, fontWeight: 500 }}>{champDisplayName(c.name)}</div>
                    </button>
                  );
                });
                })()}
              </div>
            </div>
          </div>
        )}

        <div style={{ height: 22 }} />
      </div>
    </main>
  );
}
