"use client";

import { useRef } from "react";
import AudioPlayer from "@/components/AudioPlayer";
import type { StickerPost } from "@/types";

interface Props {
  stop: StickerPost;
  stopIndex: number | null;
  journeyStops: StickerPost[] | null;
  color: string;
  onClose: () => void;
  onExpand: () => void;
  onNavigate: (stop: StickerPost, index: number) => void;
}

export default function MemoryPeek({
  stop,
  stopIndex,
  journeyStops,
  color,
  onClose,
  onExpand,
  onNavigate,
}: Props) {
  const touchStartX = useRef(0);
  const totalStops = journeyStops?.length ?? null;
  const hasPrev = stopIndex != null && stopIndex > 1;
  const hasNext = stopIndex != null && totalStops != null && stopIndex < totalStops;

  const dateDisplay = stop.photo_taken_at
    ? new Date(stop.photo_taken_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : new Date(stop.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

  function onTileTouch(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }

  function onTileTouchEnd(e: React.TouchEvent) {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) < 40) return;
    e.stopPropagation();
    if (dx < 0 && hasNext) onNavigate(journeyStops![stopIndex!], stopIndex! + 1);
    else if (dx > 0 && hasPrev) onNavigate(journeyStops![stopIndex! - 2], stopIndex! - 1);
  }

  return (
    <div className="fixed inset-0 z-[55]">
      {/* Dismiss backdrop */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Sticker image — centered upper portion */}
      {stop.image_url && (
        <div
          className="absolute pointer-events-none flex items-center justify-center"
          style={{ left: "50%", top: "18%", transform: "translateX(-50%)" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={stop.image_url}
            alt={stop.caption ?? "memory"}
            style={{
              width: "min(65vw, 280px)",
              height: "min(65vw, 280px)",
              objectFit: "contain",
              filter: `drop-shadow(0 0 28px ${color}77) drop-shadow(0 6px 16px rgba(0,0,0,0.7))`,
            }}
          />
        </div>
      )}

      {/* Bottom tile */}
      <div
        className="absolute left-0 right-0 bottom-0 rounded-t-3xl"
        style={{
          background: "#111113",
          border: "1px solid rgba(255,255,255,0.08)",
          paddingBottom: "calc(env(safe-area-inset-bottom) + 68px)",
        }}
        onTouchStart={onTileTouch}
        onTouchEnd={onTileTouchEnd}
        onClick={onExpand}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.2)" }} />
        </div>

        <div className="px-5 pt-2 pb-2">
          {/* Title + counter */}
          <div className="flex items-center justify-between gap-3 mb-1">
            <p className="font-semibold text-white text-base leading-snug line-clamp-1 flex-1">
              {stop.caption ?? (stopIndex != null ? `Memory ${stopIndex}` : "Memory")}
            </p>
            {stopIndex != null && totalStops != null && (
              <span
                className="shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full"
                style={{ background: `${color}22`, color }}
              >
                {stopIndex} / {totalStops}
              </span>
            )}
          </div>

          {/* Date + location */}
          <p className="text-xs mb-3" style={{ color: "rgba(255,255,255,0.4)" }}>
            {dateDisplay}
            {stop.location_name ? ` · ${stop.location_name}` : ""}
          </p>

          {/* Audio player (stop propagation so tapping it doesn't expand) */}
          {stop.voice_url && (
            <div className="mb-3" onClick={(e) => e.stopPropagation()}>
              <AudioPlayer src={stop.voice_url} />
            </div>
          )}

          {/* Dots + prev/next */}
          {journeyStops && journeyStops.length > 1 && (
            <div className="flex items-center justify-between mt-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  hasPrev && onNavigate(journeyStops[stopIndex! - 2], stopIndex! - 1);
                }}
                disabled={!hasPrev}
                className="w-9 h-9 rounded-full flex items-center justify-center transition-opacity shrink-0"
                style={{ background: "rgba(255,255,255,0.08)", opacity: hasPrev ? 1 : 0.3 }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>

              <div className="flex items-center gap-1.5">
                {journeyStops.map((_, i) => (
                  <div
                    key={i}
                    className="rounded-full transition-all duration-200"
                    style={{
                      width: i + 1 === stopIndex ? 16 : 6,
                      height: 6,
                      background: i + 1 === stopIndex ? color : "rgba(255,255,255,0.2)",
                    }}
                  />
                ))}
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  hasNext && onNavigate(journeyStops[stopIndex!], stopIndex! + 1);
                }}
                disabled={!hasNext}
                className="w-9 h-9 rounded-full flex items-center justify-center transition-opacity shrink-0"
                style={{ background: hasNext ? color : "rgba(255,255,255,0.08)", opacity: hasNext ? 1 : 0.3 }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
