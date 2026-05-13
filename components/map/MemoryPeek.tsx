"use client";

import { useRef } from "react";
import AudioPlayer from "@/components/AudioPlayer";
import type { StickerPost } from "@/types";

interface Props {
  stop: StickerPost;
  stopIndex: number | null;
  journeyStops: StickerPost[] | null;
  color: string;
  navigating?: boolean;
  mapZoom?: number;
  onClose: () => void;
  onExpand: () => void;
  onNavigate: (stop: StickerPost, index: number) => void;
}

export default function MemoryPeek({
  stop,
  stopIndex,
  journeyStops,
  color,
  navigating = false,
  mapZoom = 16,
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
      {/* Sticker image — outer wrapper follows map zoom, inner wrapper handles navigation fade+pop */}
      {stop.image_url && (
        <div
          className="absolute"
          style={{
            left: "50%",
            top: "16%",
            // Shrinks proportionally as the user zooms out on the map
            transform: `translateX(-50%) scale(${Math.max(0.2, Math.min(1, 1 - (16 - mapZoom) * 0.15))})`,
            transformOrigin: "top center",
            transition: "transform 0.15s ease",
          }}
        >
          <div
            style={{
              // Single constant transition — no toggling the transition property
              opacity: navigating ? 0 : 1,
              transform: navigating ? "scale(0.75)" : "scale(1)",
              transition: "opacity 0.35s ease, transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={stop.id}
              src={stop.image_url}
              alt={stop.caption ?? "memory"}
              style={{
                width: "min(65vw, 260px)",
                height: "min(65vw, 260px)",
                objectFit: "contain",
                filter: `drop-shadow(0 6px 16px rgba(0,0,0,0.7))`,
              }}
            />
          </div>
        </div>
      )}

      {/* Suspended floating tile — clears the nav bar, fully rounded */}
      <div
        className="absolute rounded-2xl shadow-2xl pointer-events-auto flex flex-col"
        style={{ left: "50%", transform: "translateX(-50%)", width: "calc(100% - 24px)", maxWidth: 480 }}
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

          {/* View Memory button */}
          <button
            onClick={(e) => { e.stopPropagation(); onExpand(); }}
            className="w-full py-3 rounded-lg font-semibold text-sm text-white my-3"
            style={{ background: "#22c55e" }}
          >
            View Memory
          </button>

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
