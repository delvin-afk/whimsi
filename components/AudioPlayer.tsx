"use client";

import { useEffect, useRef, useState } from "react";

const BAR_COUNT = 42;

function generateBars(): number[] {
  return Array.from({ length: BAR_COUNT }, (_, i) => {
    const t = i / (BAR_COUNT - 1);
    const envelope = Math.sin(t * Math.PI) * 0.65 + 0.2;
    return Math.min(1, envelope * (0.4 + Math.random() * 0.85));
  });
}

export default function AudioPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [bars] = useState<number[]>(generateBars);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    function onTimeUpdate() {
      if (audio!.duration) setProgress(audio!.currentTime / audio!.duration);
    }
    function onEnded() {
      setPlaying(false);
      setProgress(0);
      audio!.currentTime = 0;
    }

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
    };
  }, []);

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play();
      setPlaying(true);
    }
  }

  function seek(e: React.MouseEvent<HTMLDivElement>) {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = frac * audio.duration;
    setProgress(frac);
  }

  const filledCount = Math.round(progress * BAR_COUNT);

  return (
    <div
      className="flex items-center gap-3 px-3 py-3 rounded-2xl"
      style={{ background: "#1a1a1e" }}
    >
      <audio ref={audioRef} src={src} preload="metadata" />

      <button
        onClick={togglePlay}
        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-white"
        style={{ border: "1.5px solid rgba(255,255,255,0.3)" }}
      >
        {playing ? (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
            <rect x="4" y="3" width="5" height="18" rx="1.5" />
            <rect x="15" y="3" width="5" height="18" rx="1.5" />
          </svg>
        ) : (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" style={{ marginLeft: 2 }}>
            <path d="M5 3l14 9-14 9V3z" />
          </svg>
        )}
      </button>

      <div
        className="flex-1 flex items-center gap-px cursor-pointer select-none"
        style={{ height: 40 }}
        onClick={seek}
      >
        {bars.map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-full"
            style={{
              height: `${Math.round(h * 100)}%`,
              background: i < filledCount ? "#4ade80" : "rgba(255,255,255,0.4)",
              minWidth: 2,
            }}
          />
        ))}
      </div>
    </div>
  );
}
