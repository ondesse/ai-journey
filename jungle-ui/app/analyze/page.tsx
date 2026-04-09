"use client";

import { useState, FormEvent } from "react";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";

import SakuraBackground from "./components/SakuraBackground";
import WinconProfileCard from "./components/WinconProfileCard";
import { WinconCard } from "./components/WinconCard";
import { Badge } from "./components/ui/badge";


const MATCH_COUNT = 100;

interface CoachCategory {
  id: string;
  label: string;
  rating: string;
  summary: string;
  details: string[];
}

interface AiCoach {
  overall_summary: string;
  focus_next_block: string[];
  categories: CoachCategory[];
}

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

interface PlayerGame {
  match_id: string;
  champion: string;
  enemy_jungle_champion: string;
  win: boolean;
  ally_champs: string[];
  enemy_champs: string[];
  wincon?: WinconResult;
}

interface AnalyzeResult {
  profile: Record<string, any>;
  games_analyzed: number;
  report_text: string;
  ai_coach: AiCoach;
  player_games?: PlayerGame[];
}

interface CelinicaProfile {
  id: string;
  title: string;
  animeMirror: string; // now direct anime character comparison
  description: string;
  artists: string[];
  fortune: string;
  lastWords: string;
}

const CELINICA_PROFILES: CelinicaProfile[] = [
  {
    id: "honored-one",
    title: "The Honored One",
    animeMirror:
      "Gojo Satoru (Jujutsu Kaisen) with a touch of Lelouch vi Britannia (Code Geass).",
    description:
      "You play as if gravity doesn't apply to you. When you are focused, games bend around your decisions.",
    artists: ["The Weeknd", "Lana Del Rey", "Arctic Monkeys"],
    fortune:
      "You’ll meet someone who can see through you more clearly than you’d like. It will force you to decide what parts of yourself you still want to hide ",
    lastWords: "Power isolates. The silence just makes it obvious"
  },
  {
    id: "oracle-in-pink",
    title: "The Oracle in Pink",
    animeMirror:
      "Makima (Chainsaw Man) wrapped in Madoka Kaname’s softness (Puella Magi Madoka Magica).",
    description:
      "You notice patterns before everyone else does. Your calm reads as softness, but it hides a ruthless willingness to do whatever it takes.",
    artists: ["Billie Eilish", "SZA", "Taylor Swift"],
    fortune:
      "You’ll get exactly what you’ve been moving toward. The cost will come later, and it will surprise even you",
    lastWords:
      "Obedience isn’t something I ask for. People offer it."
  },
  {
    id: "blossom-hashira",
    title: "The Blossom Hashira",
    animeMirror:
      "Mitsuri Kanroji (Demon Slayer) with a dash of Usagi Tsukino (Sailor Moon).",
    description:
      "You are emotionally reckless in the most charming way. Some games you are a love letter to tempo; others you are a glittering tragedy written in shutdown gold.",
    artists: ["Grent Pérez", "Olivia Rodrigo", "Doja Cat"],
    fortune:
      "Someone will match the pace of your heart without asking you to shrink. You won’t realize it at first, but it will steady you.",
    lastWords: "If caring too much is a flaw, it’s one I’ll keep."
  },
  {
    id: "smile-behind-the-curse",
    title: "The Smile Behind the Curse",
    animeMirror:
      "Ryomen Sukuna (Jujutsu Kaisen) smiling with Hisoka’s energy (Hunter x Hunter).",
    description:
      "You queue up like a curse that happens to main jungle. Even your mistakes feel intentional, like they were part of a darker script you forgot to show your team.",
    artists: ["Travis Scott", "Metro Boomin", "Kanye West"],
    fortune:
      "A threat you don’t take seriously will grow sharper in your absence. When you finally face it, the outcome will matter more than you expect.",
    lastWords:
      "You call it cruelty. I call it clarity."
  },
  {
    id: "beautiful-catastrophe",
    title: "The Beautiful Catastrophe",
    animeMirror:
      "Jinx (Arcane/League of Legends) crashing through the plot with Power’s chaos (Chainsaw Man).",
    description:
      "You chase momentum like it owes you money. When you snowball, the game is a movie; when you don’t, it's slow, cinematic ruin.",
    artists: ["Halsey", "PVRIS", "Imagine Dragons"],
    fortune:
      "Your impulses will pull you into trouble before the week ends. Strangely enough, it’ll turn out in your favor.",
    lastWords:
      "If I win, I was brilliant. If I lose, someone cheated."
  },
  {
    id: "baroness-of-quiet-ruin",
    title: "The Baroness of Quiet Ruin",
    animeMirror:
      "Shinobu Kocho (Demon Slayer) with C.C.’s patience (Code Geass).",
    description:
      "You do not rush; you erode. Gold leads appear without anyone remembering when you took them, and by the time they notice, the map belongs to you.",
    artists: ["Lorde", "Florence + The Machine", "AURORA"],
    fortune:
      "A choice you thought you’d already made will present itself again. This time, you won’t be able to avoid the consequence",
    lastWords:
      "“Don’t make me waste time."
  },
  {
    id: "jungler-he-warned-you-about",
    title: "The Jungler He Warned You About",
    animeMirror:
      "Levi Ackerman (Attack on Titan) pathing like Chrollo in a good mood (Hunter x Hunter).",
    description:
      "You play like you are always slightly late for something better. You appear, win a lane, and leave before anyone can type a single thank you.",
    artists: ["Drake", "Rihanna", "Kendrick Lamar"],
    fortune:
      "You’ll have to rely on someone you don’t fully trust. It won’t feel good, but it will work.",
    lastWords:
      "If you know better, act like it."
  },
];

export default function AnalyzePage() {
  const [gameName, setGameName] = useState("");
  const [tagLine, setTagLine] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [celinicaProfile, setCelinicaProfile] = useState<CelinicaProfile | null>(
    null,
  );

  const hasResult = !!result;

  async function submit() {
    setError(null);
    setCelinicaProfile(null);

    if (!gameName.trim() || !tagLine.trim()) {
      setError("Please enter both your IGN and tag.");
      return;
    }

    try {
      setLoading(true);

      const res = await fetch(
        `http://127.0.0.1:8000/analyze?gameName=${encodeURIComponent(
          gameName.trim(),
        )}&tagLine=${encodeURIComponent(
          tagLine.trim(),
        )}&count=${MATCH_COUNT}&includeGames=true`,
      );

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(
          (payload as any).detail ||
            "Something went wrong talking to the coach API.",
        );
      }

      const json: AnalyzeResult = await res.json();
      setResult(json);
      const random =
        CELINICA_PROFILES[
          Math.floor(Math.random() * CELINICA_PROFILES.length)
        ];
      setCelinicaProfile(random);
    } catch (e: any) {
      setResult(null);
      setError(e.message || "Unexpected error.");
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    submit();
  }

  if (!result) {
    return (
      <SakuraBackground>
        <div className="relative z-10 flex items-center justify-center min-h-screen px-4 text-pink-900">
          <div className="relative max-w-3xl w-full space-y-6">
            {!hasResult && (
              <div className="pointer-events-none absolute -left-72 top-1/2 -translate-y-1/2 hidden md:block">
                <Image
                  src="/griffith.png"
                  alt="Griffith"
                  width={260}
                  height={260}
                  className="drop-shadow-[0_18px_40px_rgba(0,0,0,0.45)]"
                  priority
                />
              </div>
            )}

            <Card className="border-pink-300 bg-white/80 backdrop-blur-2xl shadow-2xl rounded-3xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-3xl font-bold text-pink-700 tracking-wide flex items-center gap-2">
                  Jungle Protocols
                  <span className="text-pink-500 text-2xl">🌸</span>
                </CardTitle>

                {!hasResult ? (
                  <p className="text-sm font-medium text-pink-600 mt-1">
                    Enter your Riot ID. Rise from the ashes and be reborn.
                    <span className="font-bold"> SALVATION AWAITS.</span>
                  </p>
                ) : (
                  <div className="mt-1 flex flex-col gap-1">
                    <p className="text-sm font-semibold text-pink-700">
                      {gameName.trim() || "Unknown"}{" "}
                      <span className="text-pink-400">#{tagLine.trim()}</span>
                    </p>
                    <p className="text-xs text-pink-600">
                      Analyzing your last{" "}
                      <span className="font-bold text-pink-700">
                        {MATCH_COUNT}
                      </span>{" "}
                      jungle games.
                    </p>
                  </div>
                )}
              </CardHeader>

              {!hasResult && (
                <CardContent className="space-y-4 pt-0">
                  <form className="space-y-4" onSubmit={handleSubmit}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs uppercase tracking-wide text-pink-600 font-semibold">
                          Game Name
                        </label>
                        <Input
                          placeholder="strangelove"
                          value={gameName}
                          onChange={(e) => setGameName(e.target.value)}
                          className="bg-white border-pink-300 focus-visible:ring-pink-400 rounded-xl"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs uppercase tracking-wide text-pink-600 font-semibold">
                          Tag
                        </label>
                        <Input
                          placeholder="NA1"
                          value={tagLine}
                          onChange={(e) => setTagLine(e.target.value)}
                          className="bg-white border-pink-300 focus-visible:ring-pink-400 rounded-xl"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <p className="text-xs text-pink-600">
                        Analyzing your last{" "}
                        <span className="text-pink-700 font-bold">
                          {MATCH_COUNT}
                        </span>{" "}
                        jungle games.
                      </p>

                      <Button
                        type="submit"
                        size="sm"
                        disabled={loading}
                        className="bg-pink-500 hover:bg-pink-400 text-white rounded-xl px-5"
                      >
                        {loading ? "Summoning..." : "Run Analysis"}
                      </Button>
                    </div>

                    {error && (
                      <p className="text-xs text-red-600 bg-red-100 border border-red-300 rounded-xl px-3 py-2 mt-1">
                        {error}
                      </p>
                    )}
                  </form>
                </CardContent>
              )}
            </Card>
          </div>
        </div>
      </SakuraBackground>
    );
  }

  const coach = result.ai_coach;
  const profile = result.profile as any;
  const games: PlayerGame[] = result.player_games ?? [];
  const winconProfile = profile?.wincon_profile;
  const styleTags = profile?.style_tags;

  return (
    <SakuraBackground>
      <div className="relative z-10 min-h-screen px-4 text-pink-900 flex justify-center">
        {games.length > 0 && (
          <aside className="hidden xl:flex flex-col fixed left-10 top-[210px] bottom-10 w-[48rem] z-20">
            <Card className="h-full border-pink-300 bg-white/88 backdrop-blur-2xl rounded-3xl shadow-[0_18px_45px_rgba(0,0,0,0.25)]">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold text-pink-700 flex items-center justify-between">
                  Drafts &amp; win conditions
                  <span className="text-[11px] text-pink-500">
                    Scroll to browse
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="h-full pt-0">
                <div className="relative h-full">
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-white/95 to-transparent rounded-t-3xl" />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-white/95 to-transparent rounded-b-3xl" />
                  <div className="h-full overflow-y-auto pr-2 pt-1 pb-3 space-y-1.5">
                    {games.map((g) => (
                      <WinconCard
                        key={g.match_id}
                        matchId={g.match_id}
                        yourChamp={g.champion}
                        enemyJungleChamp={g.enemy_jungle_champion}
                        didWin={g.win}
                        allyChamps={g.ally_champs}
                        enemyChamps={g.enemy_champs}
                        wincon={g.wincon}
                      />
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </aside>
        )}

        <div className="relative max-w-3xl w-full space-y-6 py-8">
          <Card className="border-pink-300 bg-white/80 backdrop-blur-2xl shadow-2xl rounded-3xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-3xl font-bold text-pink-700 tracking-wide flex items-center gap-2">
                Jungle Protocols
                <span className="text-pink-500 text-2xl">🌸</span>
              </CardTitle>

              <div className="mt-1 flex flex-col gap-1">
                <p className="text-sm font-semibold text-pink-700">
                  {gameName.trim() || "Unknown"}{" "}
                  <span className="text-pink-400">#{tagLine.trim()}</span>
                </p>
                <p className="text-xs text-pink-600">
                  Analyzing your last{" "}
                  <span className="font-bold text-pink-700">
                    {MATCH_COUNT}
                  </span>{" "}
                  jungle games.
                </p>
              </div>
            </CardHeader>
          </Card>

          <Card className="border-pink-300 bg-white/75 backdrop-blur-2xl rounded-3xl shadow-[0_16px_40px_rgba(0,0,0,0.2)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-pink-700 flex items-center justify-between">
                Coaching Report
                {typeof result.games_analyzed === "number" && (
                  <span className="text-xs font-normal text-pink-500">
                    {result.games_analyzed} games analyzed
                  </span>
                )}
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-5">
              {winconProfile && (
                <WinconProfileCard
                  winconProfile={winconProfile}
                  styleTags={styleTags}
                />
              )}

              {winconProfile && (
                <div className="h-px w-full bg-gradient-to-r from-transparent via-pink-200/70 to-transparent" />
              )}

              {coach && (
                <div className="space-y-3">
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-pink-700">
                      Jungle Protocols v2
                    </h3>
                    <span className="text-[11px] text-pink-400">
                      High-level coaching notes
                    </span>
                  </div>

                  <p className="text-xs text-pink-700">
                    {coach.overall_summary}
                  </p>

                  {coach.focus_next_block?.length > 0 && (
                    <div className="bg-pink-50/80 border border-pink-200 rounded-2xl p-3">
                      <p className="text-xs font-semibold text-pink-700 mb-1">
                        Focus for your next games:
                      </p>
                      <ul className="list-disc list-inside space-y-1 text-[11px] text-pink-800">
                        {coach.focus_next_block.map((item, idx) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {coach.categories?.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {coach.categories.map((cat) => (
                        <div
                          key={cat.id}
                          className="bg-pink-50/90 border border-pink-200 rounded-2xl p-3 flex flex-col gap-1 shadow-sm"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-pink-700">
                              {cat.label}
                            </span>
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-pink-100 text-pink-700 shadow-sm">
                              {cat.rating}
                            </span>
                          </div>
                          <p className="text-[11px] text-pink-800">
                            {cat.summary}
                          </p>
                          {cat.details && cat.details.length > 0 && (
                            <ul className="list-disc list-inside space-y-0.5 text-[11px] text-pink-800 mt-1">
                              {cat.details.slice(0, 3).map((line, idx) => (
                                <li key={idx}>{line}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {result.report_text && (
                <div className="pt-1">
                  <p className="text-[10px] uppercase tracking-wide text-pink-400 font-semibold mb-1">
                    Raw jungle report
                  </p>
                  <pre className="font-mono text-[11px] text-pink-800 whitespace-pre-wrap bg-pink-50/90 border border-pink-200 rounded-2xl p-4 max-h-[360px] overflow-y-auto shadow-inner">
                    {result.report_text}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {celinicaProfile && (
          <aside className="hidden xl:flex flex-col fixed right-10 top-[210px] bottom-10 w-[48rem] z-20">
            <Card className="h-full border-pink-300 bg-white/90 backdrop-blur-2xl rounded-3xl shadow-[0_18px_45px_rgba(0,0,0,0.25)]">
              <CardHeader className="pb-2 flex flex-col items-center gap-1">
                <CardTitle className="text-base font-semibold text-pink-700 tracking-wide text-center">
                  Celinica AI
                </CardTitle>
                <p className="text-[11px] text-pink-400 text-center">
                  Personality reading
                </p>
              </CardHeader>

              <CardContent className="h-full pt-0">
                <div className="h-full flex flex-col gap-4 overflow-y-auto pr-3 pb-4">
                  <div className="flex flex-col items-center gap-2">
                    <div className="relative w-70 h-80 rounded-full overflow-hidden ring-2 ring-pink-300 shadow-[0_18px_40px_rgba(0,0,0,0.32)]">
                      <Image
                        src="/celinica.png"
                        alt="Celinica avatar"
                        fill
                        className="object-cover"
                      />
                    </div>
                    <p className="text-[10px] uppercase tracking-[0.22em] text-pink-400">
                      Current file
                    </p>
                    <p className="text-sm font-semibold text-pink-700 text-center">
                      {celinicaProfile.title}
                    </p>
                  </div>

                  <div className="bg-pink-50/80 border border-pink-200 rounded-2xl p-3 space-y-1.5">
                    <p className="text-[11px] font-semibold text-pink-700">
                      Anime mirror
                    </p>
                    <p className="text-[13px] text-pink-800 leading-relaxed">
                      {celinicaProfile.animeMirror}
                    </p>
                  </div>

                  <p className="text-[13px] text-pink-800 leading-relaxed">
                    {celinicaProfile.description}
                  </p>

                  <div className="bg-pink-50/80 border border-pink-200 rounded-2xl p-3 space-y-2">
                    <p className="text-[11px] font-semibold text-pink-700">
                      Artists you would like
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {celinicaProfile.artists.map((name) => (
                        <Badge
                          key={name}
                          className="bg-pink-100 text-pink-700 border border-pink-200 text-[11px] px-2 py-0.5 rounded-full"
                        >
                          {name}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-pink-50 via-pink-100 to-rose-100 border border-pink-200 rounded-2xl p-3 space-y-1.5">
                    <p className="text-[11px] font-semibold text-pink-700">
                      Fortune
                    </p>
                    <p className="text-[13px] text-pink-800 leading-relaxed">
                      {celinicaProfile.fortune}
                    </p>
                  </div>

                  <div className="border border-pink-200 rounded-2xl p-3 bg-pink-50/80">
                    <p className="text-[11px] font-semibold text-pink-700 mb-1">
                      Last words
                    </p>
                    <p className="text-[13px] font-medium text-pink-800 italic leading-relaxed">
                      {celinicaProfile.lastWords}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </aside>
        )}
      </div>
    </SakuraBackground>
  );
}
