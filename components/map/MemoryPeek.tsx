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
    <div className="fixed inset-0 z-[55] pointer-events-none">
      {/* Sticker image — floats in the map area above the tile, keyed so it swaps on stop change */}
      {stop.image_url && (
        <div
          key={stop.id}
          className="absolute flex items-center justify-center"
          style={{ left: "50%", top: "16%", transform: "translateX(-50%)" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={stop.image_url}
            alt={stop.caption ?? "memory"}
            style={{
              width: "min(65vw, 260px)",
              height: "min(65vw, 260px)",
              objectFit: "contain",
              filter: `drop-shadow(0 0 28px ${color}77) drop-shadow(0 6px 16px rgba(0,0,0,0.7))`,
            }}
          />
        </div>
      )}

      {/* Suspended floating tile — clears the nav bar, fully rounded */}
      <div
        className="absolute left-3 right-3 rounded-2xl shadow-2xl pointer-events-auto flex flex-col"
        style={{
          bottom: "calc(env(safe-area-inset-bottom) + 72px)",
          background: "#111113",
          border: "1px solid rgba(255,255,255,0.1)",
          minHeight: 200,
        }}
        onTouchStart={onTileTouch}
        onTouchEnd={onTileTouchEnd}
        onClick={onExpand}
      >
        <div className="px-4 pt-4 pb-4 flex flex-col flex-1 justify-between">
          {/* Title + counter + close */}
          <div className="flex items-center justify-between gap-3 mb-1">
            <p className="font-semibold text-white text-base leading-snug line-clamp-1 flex-1">
              {stop.caption ?? (stopIndex != null ? `Memory ${stopIndex}` : "Memory")}
            </p>
            <div className="flex items-center gap-2 shrink-0">
              {stopIndex != null && totalStops != null && (
                <span
                  className="text-xs font-semibold px-2.5 py-1 rounded-full"
                  style={{ background: `${color}22`, color }}
                >
                  {stopIndex} / {totalStops}
                </span>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); onClose(); }}
                className="w-7 h-7 rounded-full flex items-center justify-center"
                style={{ background: "rgba(255,255,255,0.1)" }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
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
