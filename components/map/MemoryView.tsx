"use client";

import AudioPlayer from "@/components/AudioPlayer";
import type { StickerPost } from "@/types";

function avatarColor(username: string) {
  const colors = ["#f43f5e", "#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#06b6d4"];
  let hash = 0;
  for (const c of username) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff;
  return colors[Math.abs(hash) % colors.length];
}

interface Props {
  stop: StickerPost;
  stopIndex: number | null;
  journeyStops: StickerPost[] | null;
  journeyTitle: string | null;
  color: string;
  onClose: () => void;
  onNavigate: (stop: StickerPost, index: number) => void;
}

export default function MemoryView({
  stop,
  stopIndex,
  journeyStops,
  journeyTitle,
  color,
  onClose,
  onNavigate,
}: Props) {
  const totalStops = journeyStops?.length ?? null;
  const hasPrev = stopIndex != null && stopIndex > 1;
  const hasNext = stopIndex != null && totalStops != null && stopIndex < totalStops;

  const dateDisplay = stop.photo_taken_at
    ? new Date(stop.photo_taken_at).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : new Date(stop.created_at).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });

  const memoryTitle = stop.caption ?? (stopIndex != null ? `Memory ${stopIndex}` : "Memory");

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-white overflow-hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 shrink-0"
        style={{ paddingTop: "max(env(safe-area-inset-top), 16px)", paddingBottom: 12 }}
      >
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full flex items-center justify-center text-neutral-700 hover:bg-neutral-100 shrink-0"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <span className="font-semibold text-base text-neutral-900 truncate">
          {journeyTitle ?? "Memory"}
        </span>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        {/* User info row */}
        <div className="flex items-center gap-3 px-4 pb-4">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
            style={{ background: avatarColor(stop.username) }}
          >
            {stop.username[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-neutral-900 leading-tight">{stop.username}</p>
            <p className="text-xs text-neutral-400 truncate">
              {dateDisplay}
              {stop.location_name ? ` · ${stop.location_name}` : ""}
            </p>
          </div>
          {stopIndex != null && totalStops != null && (
            <span
              className="shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{ background: `${color}18`, color }}
            >
              {stopIndex} / {totalStops}
            </span>
          )}
        </div>

        {/* Memory title */}
        <div className="px-4 pb-4">
          <h2 className="text-xl font-bold text-neutral-900 leading-snug">{memoryTitle}</h2>
        </div>

        {/* Image */}
        {stop.image_url && (
          <div className="px-4 pb-4">
            <div className="w-full rounded-2xl overflow-hidden bg-neutral-100 flex items-center justify-center" style={{ minHeight: 220 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={stop.image_url}
                alt={stop.caption ?? "memory"}
                className="w-full object-contain"
                style={{ maxHeight: 360 }}
              />
            </div>
          </div>
        )}

        {/* Audio player */}
        {stop.voice_url && (
          <div className="px-4 pb-4">
            <AudioPlayer src={stop.voice_url} />
          </div>
        )}

        {/* Caption */}
        {stop.caption && (
          <div className="px-4 pb-4">
            <p className="text-neutral-700 text-base leading-relaxed">{stop.caption}</p>
          </div>
        )}

        {/* Location */}
        {stop.location_name && (
          <div className="flex items-center gap-2 px-4 pb-6">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
            </svg>
            <p className="text-neutral-400 text-sm">{stop.location_name}</p>
          </div>
        )}

        <div className="h-4" />
      </div>

      {/* Prev / Next buttons — only for journey stops */}
      {journeyStops && journeyStops.length > 1 && (
        <div className="px-4 pt-3 pb-4 flex gap-3 shrink-0 border-t border-neutral-100">
          <button
            onClick={() => hasPrev && onNavigate(journeyStops[stopIndex! - 2], stopIndex! - 1)}
            disabled={!hasPrev}
            className="flex-1 py-3.5 rounded-2xl font-semibold text-sm transition-opacity"
            style={{
              background: "#1a1a1e",
              color: "white",
              opacity: hasPrev ? 1 : 0.3,
            }}
          >
            ← Previous
          </button>
          <button
            onClick={() => hasNext && onNavigate(journeyStops[stopIndex!], stopIndex! + 1)}
            disabled={!hasNext}
            className="flex-1 py-3.5 rounded-2xl font-semibold text-sm transition-opacity"
            style={{
              background: hasNext ? "#22c55e" : "#e5e7eb",
              color: hasNext ? "white" : "#9ca3af",
            }}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
