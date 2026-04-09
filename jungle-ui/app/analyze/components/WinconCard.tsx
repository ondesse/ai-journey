"use client";

import { Badge } from "./ui/badge";

type ScalingLabel = "early" | "mid" | "late" | "mixed";
type LevelLabel = "low" | "medium" | "high";
type DamageLabel = "physical" | "magic" | "mixed";

interface TeamCompSummary {
  champs: string[];
  scaling: ScalingLabel;
  frontline: LevelLabel;
  peel: LevelLabel;
  engage: LevelLabel;
  damage_profile: DamageLabel;
  has_hypercarry: boolean;
  hypercarries: string[];
  tags: string[];
}

interface WinconSide {
  label: string;
  short: string;
  detailed: string;
  summary: TeamCompSummary;
}

interface WinconResult {
  status: string;
  missing_champions: string[];
  ally: WinconSide | null;
  enemy: WinconSide | null;
}

interface WinconCardProps {
  matchId: string;
  yourChamp: string;
  enemyJungleChamp: string;
  didWin: boolean;
  allyChamps: string[];
  enemyChamps: string[];
  wincon?: WinconResult;
}

export function WinconCard({
  matchId,
  yourChamp,
  enemyJungleChamp,
  didWin,
  allyChamps,
  enemyChamps,
  wincon,
}: WinconCardProps) {
  const shortId = matchId.split("_").pop() ?? matchId;
  const ally = wincon?.ally;
  const enemy = wincon?.enemy;

  const incomplete =
    wincon && wincon.status !== "ok" && wincon.missing_champions?.length > 0;

  return (
    <div className="rounded-2xl border border-pink-200/80 bg-gradient-to-br from-pink-50/95 via-pink-50/80 to-pink-100/80 px-3 py-2 shadow-sm">
      {/* header row */}
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex flex-col">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-pink-400">
            Game · {shortId}
          </span>
          <span className="text-[11px] text-pink-700 font-medium">
            {yourChamp} vs {enemyJungleChamp}
          </span>
        </div>

        <Badge
          variant="outline"
          className={`h-5 px-2 text-[10px] rounded-full border-[1.5px] ${
            didWin
              ? "border-emerald-400/80 bg-emerald-50/90 text-emerald-700"
              : "border-rose-300/80 bg-rose-50/90 text-rose-700"
          }`}
        >
          {didWin ? "Victory" : "Defeat"}
        </Badge>
      </div>

      {/* comps */}
      <div className="grid grid-cols-2 gap-2 text-[10px] text-pink-700">
        <div className="space-y-0.5">
          <p className="text-[9px] uppercase tracking-wide text-pink-400 font-semibold">
            Your comp
          </p>
          <p className="font-semibold">
            {ally?.label ?? "Wincon unknown"}
          </p>
          <p className="text-[10px] text-pink-600 line-clamp-2">
            {ally?.short ??
              "Mapper was incomplete for this game."}
          </p>
          <p className="mt-0.5 text-[10px] text-pink-500">
            <span className="font-semibold">Your team: </span>
            {allyChamps.join(" · ")}
          </p>
        </div>

        <div className="space-y-0.5">
          <p className="text-[9px] uppercase tracking-wide text-pink-400 font-semibold text-right">
            Enemy comp
          </p>
          <p className="font-semibold text-right">
            {enemy?.label ?? "Wincon unknown"}
          </p>
          <p className="text-[10px] text-pink-600 line-clamp-2 text-right">
            {enemy?.short ??
              "Missing champs: " +
                (wincon?.missing_champions?.join(", ") || "unknown")}
          </p>
          <p className="mt-0.5 text-[10px] text-pink-500 text-right">
            <span className="font-semibold">Enemy team: </span>
            {enemyChamps.join(" · ")}
          </p>
        </div>
      </div>

      {/* tiny footer prompt */}
      {!incomplete && (
        <p className="mt-1 text-[9px] text-pink-500">
          Use this game to ask:{" "}
          <span className="italic">
            did I actually play towards this win condition?
          </span>
        </p>
      )}
      {incomplete && (
        <p className="mt-1 text-[9px] text-rose-500">
          Wincon mapper was incomplete for this game. Missing champs:{" "}
          {wincon?.missing_champions?.join(", ") || "unknown"}.
        </p>
      )}
    </div>
  );
}
