"use client";

import React from "react";

type WinconProfile = {
  games_with_wincon: number;
  archetype_counts: Record<string, number>;
  primary_archetype: string | null;
  primary_archetype_pct: number;
  scaling_counts: Record<string, number>;
  damage_profile_counts: Record<string, number>;
};

type StyleTags = {
  overall: string;
  tempo: string;
  gank_timing: string;
  gank_lane: string;
  objectives: string;
  invading: string;
};

interface WinconProfileCardProps {
  winconProfile: WinconProfile;
  styleTags?: StyleTags;
}

const archetypePretty: Record<string, string> = {
  front_to_back: "Front-to-back teamfights",
  early_skirmish: "Early skirmish / tempo",
  poke_siege: "Poke & siege",
  hard_engage_wombo: "Hard engage wombo",
  scaling_teamfight: "Scaling teamfight",
  balanced: "Balanced / flexible",
};

const WinconProfileCard: React.FC<WinconProfileCardProps> = ({
  winconProfile,
  styleTags,
}) => {
  if (!winconProfile || winconProfile.games_with_wincon === 0) {
    return null;
  }

  const primary = winconProfile.primary_archetype;
  const prettyPrimary = primary
    ? archetypePretty[primary] ?? primary
    : "Unknown";

  const overallStyle = styleTags?.overall ?? "balanced-jungler";
  const tempo = styleTags?.tempo;
  const gankTiming = styleTags?.gank_timing;
  const gankLane = styleTags?.gank_lane;
  const objectives = styleTags?.objectives;

  return (
    <div className="relative mb-1 overflow-hidden rounded-3xl border border-rose-100/70 bg-gradient-to-br from-rose-50/90 via-pink-50/90 to-fuchsia-50/90 p-4 text-sm text-rose-900 shadow-md transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-lg">
      {/* soft sakura glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0_0,rgba(244,114,182,0.24)_0,transparent_60%),radial-gradient(circle_at_100%_100%,rgba(217,70,239,0.22)_0,transparent_60%)] opacity-90" />

      <div className="relative flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-rose-500">
              Jungle Protocols · Draft Identity
            </div>
            <div className="text-xs text-rose-700">
              {winconProfile.games_with_wincon} games with win-condition data
            </div>
          </div>
          {overallStyle && (
            <span className="rounded-full border border-pink-200/80 bg-white/70 px-3 py-1 text-[11px] font-medium text-pink-700 shadow-sm backdrop-blur">
              Your playstyle: {overallStyle}
            </span>
          )}
        </div>

        <div className="grid gap-3 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.2fr)]">
          {/* Left: what your drafts want */}
          <div className="rounded-2xl border border-rose-100/80 bg-white/85 p-3 backdrop-blur-sm">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-rose-500">
              What your drafts want to do
            </div>
            <div className="mb-2 text-sm font-semibold text-rose-900">
              Mostly{" "}
              <span className="text-pink-700">{prettyPrimary}</span>{" "}
              ({winconProfile.primary_archetype_pct.toFixed(1)}% of games)
            </div>

            <div className="mb-2 text-[11px] text-rose-700 leading-snug">
              You most often queue up with comps that want to play{" "}
              <span className="font-semibold text-rose-900">
                {prettyPrimary.toLowerCase()}
              </span>
              . This is your default win-condition pattern based on{" "}
              champions, not gameplay decisions.
            </div>

            <div className="mt-2 grid grid-cols-2 gap-1.5 text-[11px]">
              <div className="rounded-xl border border-rose-100 bg-rose-50/80 px-2 py-1">
                <div className="text-[10px] uppercase tracking-wide text-rose-500">
                  Scaling
                </div>
                <div className="mt-0.5 text-rose-800">
                  {Object.entries(winconProfile.scaling_counts)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(" · ")}
                </div>
              </div>
              <div className="rounded-xl border border-pink-100 bg-pink-50/80 px-2 py-1">
                <div className="text-[10px] uppercase tracking-wide text-pink-500">
                  Damage profile
                </div>
                <div className="mt-0.5 text-rose-800">
                  {Object.entries(winconProfile.damage_profile_counts)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(" · ")}
                </div>
              </div>
            </div>
          </div>

          {/* Right: how you actually play */}
          <div className="rounded-2xl border border-fuchsia-100/80 bg-white/85 p-3 backdrop-blur-sm">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-fuchsia-500">
              How you actually play as a jungler
            </div>
            <ul className="space-y-1.5 text-[11px] text-rose-800 leading-snug">
              {tempo && (
                <li>
                  <span className="font-semibold text-rose-900">Tempo: </span>
                  {tempo}.
                </li>
              )}
              {gankTiming && (
                <li>
                  <span className="font-semibold text-rose-900">
                    Gank timing:{" "}
                  </span>
                  {gankTiming}.
                </li>
              )}
              {gankLane && (
                <li>
                  <span className="font-semibold text-rose-900">
                    Lane focus:{" "}
                  </span>
                  {gankLane}.
                </li>
              )}
              {objectives && (
                <li>
                  <span className="font-semibold text-rose-900">
                    Objectives:{" "}
                  </span>
                  {objectives}.
                </li>
              )}
            </ul>

            {primary && tempo && (
              <p className="mt-2 text-[11px] text-rose-800 leading-snug">
              <span className="font-semibold text-fuchsia-800">
              Coach note:
              </span>{" "}
              Put the full clear in the bag lil gup.
            </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WinconProfileCard;
