"use client";

import type { Journey, StickerPost } from "@/types";

function avatarColor(username: string) {
  const colors = ["#f43f5e", "#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#06b6d4"];
  let hash = 0;
  for (const c of username) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff;
  return colors[Math.abs(hash) % colors.length];
}

function travelDays(stickers: StickerPost[]): number | null {
  const dates = stickers
    .map((s) => (s.photo_taken_at ? new Date(s.photo_taken_at).getTime() : null))
    .filter((d): d is number => d !== null);
  if (dates.length < 2) return null;
  const span = Math.max(...dates) - Math.min(...dates);
  return Math.max(1, Math.round(span / 86400000) + 1);
}

interface Props {
  journey: Journey;
  isSelected?: boolean;
  onTap: () => void;
}

export default function JourneyCard({ journey, isSelected, onTap }: Props) {
  const color = avatarColor(journey.username);
  const title = journey.caption ?? `${journey.username}'s Journey`;
  const firstLocation = journey.stickers.find((s) => s.location_name)?.location_name ?? null;
  const stopCount = journey.stickers.length;
  const days = travelDays(journey.stickers);

  const dateDisplay = new Date(journey.created_at).toLocaleDateString(undefined, {
    month: "numeric",
    day: "numeric",
    year: "numeric",
  });

  // Up to 4 stickers with images for the preview grid
  const previews = journey.stickers.filter((s) => s.image_url).slice(0, 4);

  return (
    <div
      onClick={onTap}
      className="rounded-2xl cursor-pointer overflow-hidden"
      style={{
        background: isSelected ? "#2a2a2e" : "#242428",
        border: isSelected ? `1.5px solid ${color}60` : "1.5px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* User info row */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
          style={{ background: color }}
        >
          {journey.username[0]?.toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="text-white text-sm font-semibold leading-tight">{journey.username}</p>
          <p className="text-xs leading-tight truncate" style={{ color: "rgba(255,255,255,0.45)" }}>
            {dateDisplay}
            {firstLocation ? ` · ${firstLocation}` : ""}
          </p>
        </div>
      </div>

      {/* Title */}
      <p className="px-4 pb-3 text-white font-bold text-base leading-snug">{title}</p>

      {/* Images + stats row */}
      <div className="flex gap-2 mx-4 mb-4" style={{ height: 110 }}>
        {/* Sticker image grid */}
        <div className="flex-1 grid gap-1 overflow-hidden rounded-xl min-w-0"
          style={{ gridTemplateColumns: previews.length >= 2 ? "1fr 1fr" : "1fr",
                   gridTemplateRows: previews.length >= 3 ? "1fr 1fr" : "1fr" }}>
          {previews.length === 0 ? (
            <div className="rounded-xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.05)" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5">
                <rect x="3" y="3" width="18" height="18" rx="3" />
                <circle cx="8.5" cy="8.5" r="1.5" fill="rgba(255,255,255,0.2)" stroke="none" />
                <path d="M21 15l-5-5L5 21" strokeLinecap="round" />
              </svg>
            </div>
          ) : (
            previews.map((s, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={s.id}
                src={s.image_url}
                alt=""
                className="w-full h-full object-cover"
                style={{
                  borderRadius: i === 0 && previews.length === 1 ? "12px" : undefined,
                  gridColumn: previews.length === 3 && i === 0 ? "1 / 2" : undefined,
                }}
              />
            ))
          )}
        </div>

        {/* Stats panel */}
        <div
          className="flex flex-col justify-center gap-3 px-4 rounded-xl shrink-0"
          style={{ background: "rgba(255,255,255,0.05)", minWidth: 120 }}
        >
          <div>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>Number of Entries</p>
            <p className="text-white font-bold text-xl leading-tight">{stopCount}</p>
          </div>
          {days != null && (
            <div>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>Travel Time</p>
              <p className="text-white font-bold text-xl leading-tight">
                {days} {days === 1 ? "day" : "days"}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
