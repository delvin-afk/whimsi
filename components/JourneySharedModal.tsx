"use client";

import { useRouter } from "next/navigation";
import type { Journey } from "@/types";

function avatarColor(username: string) {
  const colors = ["#f43f5e", "#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#06b6d4", "#ec4899"];
  let hash = 0;
  for (const c of username) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff;
  return colors[Math.abs(hash) % colors.length];
}

function buildMapUrl(journey: Journey): string {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) return "";

  const stops = journey.stickers.filter((s) => s.lat != null && s.lng != null);
  if (stops.length === 0) {
    return `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/0,20,1/700x380@2x?access_token=${token}`;
  }

  const markers = stops
    .map((s) => `pin-s+6366f1(${s.lng},${s.lat})`)
    .join(",");

  const path =
    stops.length > 1
      ? `path-3+6366f1-0.8(${encodeURIComponent(
          stops.map((s) => `${s.lng},${s.lat}`).join(";")
        )})`
      : "";

  const overlay = path ? `${path},${markers}` : markers;
  return `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${overlay}/auto/700x380@2x?access_token=${token}&padding=60,60,60,60`;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: "numeric",
    day: "numeric",
    year: "numeric",
  });
}

function travelDays(journey: Journey): number {
  const withTime = journey.stickers.filter((s) => s.photo_taken_at);
  if (withTime.length < 2) return 1;
  const sorted = [...withTime].sort(
    (a, b) => new Date(a.photo_taken_at!).getTime() - new Date(b.photo_taken_at!).getTime()
  );
  const ms =
    new Date(sorted[sorted.length - 1].photo_taken_at!).getTime() -
    new Date(sorted[0].photo_taken_at!).getTime();
  return Math.max(1, Math.round(ms / 86400000) + 1);
}

function dateRange(journey: Journey): string {
  const withTime = journey.stickers.filter((s) => s.photo_taken_at);
  if (withTime.length === 0) return formatDate(journey.created_at);
  const sorted = [...withTime].sort(
    (a, b) => new Date(a.photo_taken_at!).getTime() - new Date(b.photo_taken_at!).getTime()
  );
  const first = formatDate(sorted[0].photo_taken_at!);
  const last = formatDate(sorted[sorted.length - 1].photo_taken_at!);
  return first === last ? first : `${first} - ${last}`;
}

function primaryLocation(journey: Journey): string {
  const names = journey.stickers.map((s) => s.location_name).filter(Boolean) as string[];
  if (names.length === 0) return "";
  // pick the most-repeated location name
  const counts: Record<string, number> = {};
  for (const n of names) counts[n] = (counts[n] ?? 0) + 1;
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

interface Props {
  journey: Journey;
  onClose: () => void;
}

export default function JourneySharedModal({ journey, onClose }: Props) {
  const router = useRouter();
  const mapUrl = buildMapUrl(journey);
  const days = travelDays(journey);
  const range = dateRange(journey);
  const location = primaryLocation(journey);
  const color = avatarColor(journey.username);

  function goToMap() {
    onClose();
    router.push("/map");
  }

  function createAnother() {
    onClose();
    router.push("/capture?flow=journey");
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-y-auto"
      style={{ background: "#4ade80" }}>
      <div className="w-full max-w-sm mx-auto px-5 py-8 flex flex-col gap-5">

        {/* Title */}
        <h1 className="text-3xl font-extrabold text-center text-black">
          Story is shared 🤩
        </h1>

        {/* Card */}
        <div className="rounded-2xl overflow-hidden border-2 border-indigo-400/60 border-dashed"
          style={{ background: "#1a1a1f" }}>

          {/* Header row */}
          <div className="flex items-center gap-3 px-4 py-3" style={{ background: "#111116" }}>
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
              style={{ background: color }}>
              {journey.username[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm">
                {journey.username} shared a story
              </p>
              <p className="text-neutral-400 text-xs truncate">
                {range}{location ? `  ${location}` : ""}
              </p>
            </div>
          </div>

          {/* Caption */}
          {journey.caption && (
            <div className="px-4 pt-3 pb-1">
              <p className="text-white font-bold text-base">{journey.caption}</p>
            </div>
          )}

          {/* Map */}
          {mapUrl && (
            <div className="mx-3 my-2 rounded-xl overflow-hidden">
              <img
                src={mapUrl}
                alt="Journey map"
                className="w-full object-cover"
                style={{ maxHeight: 220 }}
              />
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 divide-x divide-white/10 mx-3 mb-3 rounded-xl overflow-hidden"
            style={{ background: "#111116" }}>
            <div className="flex flex-col items-center py-3 px-4 gap-0.5">
              <span className="text-neutral-400 text-xs">Number of Entries</span>
              <span className="text-white font-bold text-xl">{journey.stickers.length}</span>
            </div>
            <div className="flex flex-col items-center py-3 px-4 gap-0.5">
              <span className="text-neutral-400 text-xs">Travel Time</span>
              <span className="text-white font-bold text-xl">
                {days} {days === 1 ? "day" : "days"}
              </span>
            </div>
          </div>
        </div>

        {/* View on Map */}
        <button
          onClick={goToMap}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-black font-semibold text-base transition active:scale-95"
          style={{ background: "rgba(0,0,0,0.12)" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 9m0 8V9M9 7l6 2"
              strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          View Sticker on Map
        </button>

        {/* Create Another */}
        <button
          onClick={createAnother}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-white font-semibold text-base bg-black transition active:scale-95">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
          Create Another Story
        </button>

      </div>
    </div>
  );
}
