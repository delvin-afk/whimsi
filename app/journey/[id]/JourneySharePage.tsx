"use client";

import type { Journey } from "@/types";
import ShareButton from "@/components/ShareButton";
import Link from "next/link";

const JOURNEY_COLORS = ["#a855f7", "#3b82f6", "#f97316", "#ec4899", "#14b8a6"];

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function JourneySharePage({ journey }: { journey: Journey }) {
  const color = JOURNEY_COLORS[0];

  const dateRange = (() => {
    const withTime = journey.stickers.filter((s) => s.photo_taken_at);
    if (withTime.length < 2) return timeAgo(journey.created_at);
    const sorted = [...withTime].sort((a, b) =>
      new Date(a.photo_taken_at!).getTime() - new Date(b.photo_taken_at!).getTime()
    );
    const first = new Date(sorted[0].photo_taken_at!);
    const last = new Date(sorted[sorted.length - 1].photo_taken_at!);
    const sameDay = first.toDateString() === last.toDateString();
    return sameDay
      ? first.toLocaleDateString(undefined, { dateStyle: "medium" })
      : `${first.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${last.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
  })();

  const uniqueLocations = [...new Set(
    journey.stickers.map((s) => s.location_name).filter(Boolean)
  )].slice(0, 3) as string[];

  const shareText = [
    journey.caption ?? `${journey.username}'s journey`,
    uniqueLocations.length ? uniqueLocations.join(" → ") : null,
    `${journey.stickers.length} stops`,
  ].filter(Boolean).join(" · ");

  return (
    <main className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm space-y-4">
        {/* Card */}
        <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
          <div className="h-1.5 w-full" style={{ background: color }} />

          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
              style={{ background: color }}>
              {journey.username[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">{journey.username}</p>
              <p className="text-xs text-neutral-400">{dateRange}</p>
            </div>
            <span className="text-xs text-neutral-300 shrink-0">{timeAgo(journey.created_at)}</span>
          </div>

          {/* Caption */}
          {journey.caption && (
            <div className="px-4 pb-2">
              <p className="font-semibold text-base">{journey.caption}</p>
            </div>
          )}

          {/* Sticker strip */}
          <div className="px-4 pb-3">
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {journey.stickers.map((s, i) => (
                <div key={s.id} className="relative shrink-0">
                  <div className="w-20 h-20 rounded-xl overflow-hidden border border-neutral-100 bg-neutral-50 flex items-center justify-center"
                    style={{ background: "linear-gradient(135deg, #667eea18, #764ba218)" }}>
                    <img src={s.image_url} alt="" className="max-w-full max-h-full object-contain p-1"
                      style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.25))" }} />
                  </div>
                  <span className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full text-white text-xs font-bold flex items-center justify-center shadow"
                    style={{ background: color }}>
                    {i + 1}
                  </span>
                  {s.caption && (
                    <p className="text-xs text-neutral-500 mt-1 w-20 truncate text-center">{s.caption}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Stats */}
          <div className="px-4 pb-4 flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-1 text-xs text-neutral-500">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
              {journey.stickers.length} stops
            </span>
            {uniqueLocations.length > 0 && (
              <span className="text-xs text-neutral-400 truncate">{uniqueLocations.join(" → ")}</span>
            )}
          </div>
        </div>

        {/* Share + CTA */}
        <ShareButton
          title={journey.caption ?? `${journey.username}'s journey on whimsi`}
          text={shareText}
          className="w-full"
        />

        <Link href="/"
          className="block text-center text-sm text-neutral-400 hover:text-neutral-600 transition">
          Discover more on whimsi →
        </Link>
      </div>
    </main>
  );
}
