"use client";

import React, {
  useEffect,
  useState,
  useRef,
  type CSSProperties,
  type ReactNode,
} from "react";
import Image from "next/image";

type Props = {
  children: ReactNode;
};

type PetalStyle = CSSProperties;

export default function SakuraBackground({ children }: Props) {
  const [petalStyles, setPetalStyles] = useState<PetalStyle[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // 🌸 generate falling petals
  useEffect(() => {
    const PETAL_COUNT = 25;
    const styles: PetalStyle[] = Array.from({ length: PETAL_COUNT }).map(
      () => ({
        left: `${Math.random() * 100}%`,
        animationDelay: `${Math.random() * 8}s`,
        animationDuration: `${12 + Math.random() * 10}s`,
      }),
    );

    setPetalStyles(styles);
  }, []);

  // 🎵 set volume AFTER audio loads
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = 0.6; // <— WORKS!
    }
  }, []);

  return (
    <div className="sakura-bg relative min-h-screen overflow-hidden">

      {/* 🌸 Autoplay Music */}
      <audio
        ref={audioRef}
        src="/blade.mp3"
        autoPlay
        loop
      />

      {/* soft halo glow */}
      <div className="sakura-halo" />

      {/* top lantern / florals */}
      <Image
        src="/noodle.png"
        alt="noodle"
        width={300}
        height={300}
        className="corner-branch corner-branch-left"
        priority
      />
      <Image
        src="/sakura-branch-right.png"
        alt="Sakura florals"
        width={260}
        height={260}
        className="corner-branch corner-branch-right"
        priority
      />

      {/* bottom friends */}
      <div className="pointer-events-none absolute bottom-0 left-6 z-10">
        <Image
          src="/catleft.png"
          alt="Left sakura cat"
          width={340}
          height={340}
        />
      </div>

      <div className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-[52%] z-10 flex items-end gap-6">
        <Image
          src="/catmiddle.png"
          alt="Middle sakura cat"
          width={350}
          height={400}
        />

        {/* tree lowered slightly */}
        <div className="relative translate-y-16 md:translate-y-20">
          <Image
            src="/treemiddle.png"
            alt="Middle sakura tree"
            width={400}
            height={400}
          />
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-0 right-6 z-10">
        <Image
          src="/catright.png"
          alt="Right sakura cat"
          width={340}
          height={340}
        />
      </div>

      {/* falling petals */}
      <div className="sakura-petals">
        {petalStyles.map((style, idx) => (
          <div key={idx} className="petal" style={style} />
        ))}
      </div>

      {/* main content layer */}
      <div className="relative z-20">{children}</div>
    </div>
  );
}