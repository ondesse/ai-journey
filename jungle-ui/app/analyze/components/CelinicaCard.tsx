import Image from "next/image";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { CelinicaProfile } from "./celinicaProfiles";

type CelinicaCardProps = {
  profile: CelinicaProfile;
};

export function CelinicaCard({ profile }: CelinicaCardProps) {
  return (
    <Card className="border-pink-300 bg-white/90 backdrop-blur-2xl rounded-3xl shadow-[0_18px_45px_rgba(0,0,0,0.25)] h-full flex flex-col">
      <CardHeader className="pb-3 flex items-center gap-3">
        <div className="relative h-[72px] w-[72px] shrink-0 rounded-full overflow-hidden ring-2 ring-pink-300 shadow-[0_12px_30px_rgba(0,0,0,0.3)]">
          <Image
            src="/celinica.png"
            alt="Celinica AI"
            fill
            className="object-cover"
          />
        </div>
        <div className="flex flex-col gap-1">
          <CardTitle className="text-xl font-semibold tracking-wide text-pink-700">
            Celinica AI
          </CardTitle>
          <p className="text-[11px] uppercase tracking-[0.22em] text-pink-400">
            Assigned archetype
          </p>
          <p className="text-sm font-semibold text-pink-700">
            {profile.title}
          </p>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col gap-4 pt-0 text-pink-800">
        <section className="space-y-1">
          <p className="text-[11px] uppercase tracking-[0.22em] text-pink-400">
            Anime mirror
          </p>
          <p className="text-[13px] leading-relaxed">
            {profile.animeMirror}
          </p>
        </section>

        <section className="space-y-1">
          <p className="text-[11px] uppercase tracking-[0.22em] text-pink-400">
            Artists you&apos;d like
          </p>
          <p className="text-[13px] leading-relaxed">
            {profile.artists.join(" • ")}
          </p>
        </section>

        <section className="space-y-2 flex-1">
          <p className="text-[11px] uppercase tracking-[0.22em] text-pink-400">
            Your fortune
          </p>
          <div className="bg-gradient-to-br from-pink-50 via-pink-100 to-rose-100 border border-pink-200 rounded-2xl p-3">
            <p className="text-[13px] leading-relaxed">
              {profile.fortune}
            </p>
          </div>
        </section>

        <section className="space-y-1">
          <p className="text-[11px] uppercase tracking-[0.22em] text-pink-400">
            Last words
          </p>
          <p className="text-[13px] font-medium italic text-pink-700 leading-relaxed">
            {profile.lastWords}
          </p>
        </section>
      </CardContent>
    </Card>
  );
}
