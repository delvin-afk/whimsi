"use client";

import type { Journey, StickerPost } from "@/types";

function avatarColor(username: string) {
  const colors = ["#f43f5e", "#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#06b6d4"];
  let hash = 0;
  for (const c of username) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff;
  return colors[Math.abs(hash) % colors.length];
}

function formatDateSpan(stickers: StickerPost[]): string | null {
  const dates = stickers
    .map((s) => (s.photo_taken_at ? new Date(s.photo_taken_at) : null))
    .filter(Boolean) as Date[];
  if (dates.length < 2) return null;
  const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());
  const diffDays = Math.round(
    (sorted[sorted.length - 1].getTime() - sorted[0].getTime()) / 86400000
  );
  return diffDays === 0 ? "1 day" : `${diffDays + 1} days`;
}

interface Props {
  journey: Journey;
  isSelected?: boolean;
  onTap: () => void;
}

export default function JourneyCard({ journey, isSelected, onTap }: Props) {
  const color = avatarColor(journey.username);
  const title = journey.caption ?? `${journey.username}'s Journey`;
  const originStop = journey.stickers.find((s) => s.location_name);
  const originLocation = originStop?.location_name ?? null;
  const stopCount = journey.stickers.length;
  const dateSpan = formatDateSpan(journey.stickers);

  const dateDisplay = new Date(journey.created_at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div
      onClick={onTap}
      className="flex gap-3 p-4 rounded-2xl cursor-pointer transition-colors active:bg-neutral-100"
      style={{
        background: isSelected ? `${color}10` : "#f8f8fa",
        border: isSelected ? `1.5px solid ${color}40` : "1.5px solid transparent",
      }}
    >
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
        style={{ background: color }}
      >
        {journey.username[0]?.toUpperCase()}
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-semibold text-neutral-900 text-sm leading-tight truncate">{title}</p>
        <p className="text-xs text-neutral-500 mt-0.5">
          {journey.username} · {dateDisplay}
        </p>
        {originLocation && (
          <p className="text-xs text-neutral-400 mt-0.5 flex items-center gap-1 truncate">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="shrink-0">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
            </svg>
            {originLocation}
          </p>
        )}
        <p className="text-xs text-neutral-400 mt-1">
          {stopCount} {stopCount === 1 ? "stop" : "stops"}
          {dateSpan ? ` · ${dateSpan}` : ""}
        </p>
      </div>
    </div>
  );
}
