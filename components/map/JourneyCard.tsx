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

function buildMapUrl(stickers: StickerPost[], token: string): string | null {
  const located = stickers.filter((s) => s.lat != null && s.lng != null);
  if (!located.length || !token) return null;

  const pins = located
    .slice(0, 10)
    .map((s) => `pin-s+f43f5e(${s.lng},${s.lat})`)
    .join(",");

  if (located.length === 1) {
    return `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${pins}/${located[0].lng},${located[0].lat},13/280x180@2x?access_token=${token}`;
  }
  return `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${pins}/auto/280x180@2x?padding=30&access_token=${token}`;
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
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";
  const mapUrl = buildMapUrl(journey.stickers, token);

  const dateDisplay = new Date(journey.created_at).toLocaleDateString(undefined, {
    month: "numeric",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div
      onClick={onTap}
      className="rounded-2xl cursor-pointer overflow-hidden"
      style={{
        background: isSelected ? "#2a2a2e" : "#242428",
        border: isSelected ? `1.5px solid ${color}60` : "1.5px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* Top: user info */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
          style={{ background: color }}
        >
          {journey.username[0]?.toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="text-white text-sm font-semibold leading-tight">{journey.username}</p>
          <p className="text-xs leading-tight" style={{ color: "rgba(255,255,255,0.45)" }}>
            {dateDisplay}
            {firstLocation ? ` · ${firstLocation}` : ""}
          </p>
        </div>
      </div>

      {/* Journey title */}
      <p className="px-4 pb-3 text-white font-bold text-base leading-snug">{title}</p>

      {/* Map + stats row */}
      <div className="flex gap-0 mx-4 mb-4 rounded-xl overflow-hidden" style={{ height: 110 }}>
        {/* Map thumbnail */}
        <div className="flex-1 relative overflow-hidden rounded-xl" style={{ background: "#1a1a1e" }}>
          {mapUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={mapUrl}
              alt="route map"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center" style={{ color: "rgba(255,255,255,0.2)" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 9m0 8V9M9 7l6 2" />
              </svg>
            </div>
          )}
        </div>

        {/* Stats */}
        <div
          className="flex flex-col justify-center gap-3 px-4 rounded-xl ml-2 shrink-0"
          style={{ background: "rgba(255,255,255,0.05)", minWidth: 130 }}
        >
          <div>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>Number of Entries</p>
            <p className="text-white font-bold text-xl leading-tight">{stopCount}</p>
          </div>
          {days != null && (
            <div>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>Travel Time</p>
              <p className="text-white font-bold text-xl leading-tight">{days} {days === 1 ? "day" : "days"}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
