"use client";

import { useEffect, useRef, useState } from "react";
import type { Journey } from "@/types";
import Link from "next/link";
import JourneyShareCardModal from "@/components/JourneyShareCardModal";
import { getSupabaseBrowser } from "@/lib/supabase/browser";

const ACCENT = "#4ade80";   // UI color: buttons, badges
const MAP_LINE = "#a855f7"; // Map route line color — purple for visibility on streets map
const STICKER_SIZE = 48;

function formatDateRange(stickers: Journey["stickers"], createdAt: string) {
  const withTime = stickers.filter((s) => s.photo_taken_at);
  if (withTime.length < 2) return new Date(createdAt).toLocaleDateString(undefined, { dateStyle: "medium" });
  const sorted = [...withTime].sort(
    (a, b) => new Date(a.photo_taken_at!).getTime() - new Date(b.photo_taken_at!).getTime()
  );
  const first = new Date(sorted[0].photo_taken_at!);
  const last = new Date(sorted[sorted.length - 1].photo_taken_at!);
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: "numeric", day: "numeric", year: "numeric" });
  return first.toDateString() === last.toDateString() ? fmt(first) : `${fmt(first)} – ${fmt(last)}`;
}

function travelDays(stickers: Journey["stickers"]): number | null {
  const times = stickers
    .filter((s) => s.photo_taken_at)
    .map((s) => new Date(s.photo_taken_at!).getTime())
    .sort((a, b) => a - b);
  if (times.length < 2) return null;
  return Math.max(1, Math.ceil((times[times.length - 1] - times[0]) / 86400000));
}

function avatarColor(username: string) {
  const colors = ["#f43f5e", "#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#06b6d4", "#ec4899"];
  let hash = 0;
  for (const c of username) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff;
  return colors[Math.abs(hash) % colors.length];
}

// ── Mapbox map embedded in each journey card ──────────────────────────────────
function JourneyMapView({ journey, mapboxToken }: { journey: Journey; mapboxToken: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  const stickersWithLoc = journey.stickers.filter((s) => s.lat != null && s.lng != null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current || !mapboxToken || stickersWithLoc.length === 0) return;

    import("mapbox-gl").then(({ default: mapboxgl }) => {
      import("mapbox-gl/dist/mapbox-gl.css");
      if (!containerRef.current) return;

      mapboxgl.accessToken = mapboxToken;
      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center: [stickersWithLoc[0].lng!, stickersWithLoc[0].lat!],
        zoom: 12,
        interactive: false,
      });
      mapRef.current = map;

      map.on("load", async () => {
        // Route — driving directions with straight-line fallback
        if (stickersWithLoc.length >= 2) {
          const straight = stickersWithLoc.map((s) => [s.lng!, s.lat!]);
          let routeCoords: number[][] = [];
          for (let i = 0; i < straight.length - 1; i++) {
            const [lng1, lat1] = straight[i];
            const [lng2, lat2] = straight[i + 1];
            try {
              const res = await fetch(
                `https://api.mapbox.com/directions/v5/mapbox/driving/${lng1},${lat1};${lng2},${lat2}?geometries=geojson&overview=full&access_token=${mapboxToken}`
              );
              const json = await res.json();
              const leg: number[][] | undefined = json.routes?.[0]?.geometry?.coordinates;
              if (leg?.length) {
                if (routeCoords.length > 0) leg.shift();
                routeCoords = routeCoords.concat(leg);
              } else {
                if (routeCoords.length === 0) routeCoords.push(straight[i]);
                routeCoords.push(straight[i + 1]);
              }
            } catch {
              if (routeCoords.length === 0) routeCoords.push(straight[i]);
              routeCoords.push(straight[i + 1]);
            }
          }
          const coords = routeCoords.length >= 2 ? routeCoords : straight;
          map.addSource("route", {
            type: "geojson",
            data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } },
          });
          map.addLayer({ id: "route-glow", type: "line", source: "route", layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": MAP_LINE, "line-width": 10, "line-opacity": 0.2 } });
          map.addLayer({ id: "route-line", type: "line", source: "route", layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": MAP_LINE, "line-width": 4, "line-opacity": 0.9 } });
        }

        // Sticker markers
        stickersWithLoc.forEach((stop, i) => {
          const wrapper = document.createElement("div");
          wrapper.style.cssText = "display:flex;flex-direction:column;align-items:center;";
          const stickerWrap = document.createElement("div");
          stickerWrap.style.cssText = `position:relative;width:${STICKER_SIZE}px;height:${STICKER_SIZE}px;`;
          const img = document.createElement("img");
          img.src = stop.image_url;
          img.style.cssText = `width:${STICKER_SIZE}px;height:${STICKER_SIZE}px;object-fit:contain;filter:drop-shadow(0 2px 6px rgba(0,0,0,0.5));`;
          const badge = document.createElement("div");
          badge.style.cssText = `position:absolute;top:-5px;left:-5px;width:18px;height:18px;border-radius:50%;background:${MAP_LINE};color:white;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;font-family:sans-serif;border:1.5px solid white;`;
          badge.textContent = String(i + 1);
          stickerWrap.appendChild(img);
          stickerWrap.appendChild(badge);
          const pin = document.createElement("div");
          pin.style.cssText = `width:7px;height:7px;border-radius:50%;background:${MAP_LINE};border:2px solid white;margin-top:2px;flex-shrink:0;`;
          wrapper.appendChild(stickerWrap);
          wrapper.appendChild(pin);

          new mapboxgl.Marker({ element: wrapper, anchor: "bottom" })
            .setLngLat([stop.lng!, stop.lat!])
            .addTo(map);
        });

        // Fit bounds
        if (stickersWithLoc.length > 1) {
          const lngs = stickersWithLoc.map((s) => s.lng!);
          const lats = stickersWithLoc.map((s) => s.lat!);
          map.fitBounds(
            [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
            { padding: { top: STICKER_SIZE + 20, bottom: 20, left: 44, right: 44 }, duration: 0, maxZoom: 16 }
          );
        }
      });
    });

    return () => { mapRef.current?.remove(); mapRef.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={containerRef} className="w-full h-full" />;
}

// ── Journey card ──────────────────────────────────────────────────────────────
function JourneyCard({
  journey, currentUserId, mapboxToken, onMadePublic, onDeleted,
}: {
  journey: Journey;
  currentUserId: string | null;
  mapboxToken: string;
  onMadePublic: (id: string) => void;
  onDeleted: (id: string) => void;
}) {
  const isOwner = currentUserId === journey.user_id;
  const [shared, setShared] = useState(journey.is_public);
  const [sharing, setSharing] = useState(false);
  const [showShareCard, setShowShareCard] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const dateRange = formatDateRange(journey.stickers, journey.created_at);
  const days = travelDays(journey.stickers);
  const uniqueLocations = [...new Set(journey.stickers.map((s) => s.location_name).filter(Boolean))].slice(0, 2);
  const locationStr = uniqueLocations.join(", ");

  const actionLabel = shared ? "shared a story" : "created a story";

  async function handleShare() {
    setSharing(true);
    try {
      const res = await fetch(`/api/journeys/${journey.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUserId, is_public: true }),
      });
      if (res.ok) { setShared(true); onMadePublic(journey.id); }
    } finally {
      setSharing(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    const res = await fetch(`/api/journeys/${journey.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: currentUserId }),
    });
    if (res.ok) onDeleted(journey.id);
    else setDeleting(false);
  }

  return (
    <>
      <div className="rounded-3xl overflow-hidden" style={{ background: "#1c1c1e" }}>
        {/* Header */}
        <div className="flex items-center gap-3 px-4 pt-4 pb-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
            style={{ background: avatarColor(journey.username) }}
          >
            {journey.username[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm leading-tight">
              {journey.username} <span className="font-normal text-neutral-400">{actionLabel}</span>
            </p>
            <p className="text-xs text-neutral-500 truncate">
              {dateRange}{locationStr ? ` · ${locationStr}` : ""}
            </p>
          </div>
          {!shared && isOwner && (
            <span className="shrink-0 text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "rgba(74,222,128,0.15)", color: ACCENT }}>
              Private
            </span>
          )}
          {isOwner && (
            <button
              onClick={() => setSheetOpen(true)}
              className="w-8 h-8 flex items-center justify-center rounded-full text-neutral-500 hover:text-neutral-300 shrink-0"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
              </svg>
            </button>
          )}
        </div>

        {/* Journey title */}
        {journey.caption && (
          <div className="px-4 pb-2">
            <p className="text-white font-bold text-base">{journey.caption}</p>
          </div>
        )}

        {/* Map */}
        <div className="h-64 w-full bg-neutral-800">
          <JourneyMapView journey={journey} mapboxToken={mapboxToken} />
        </div>

        {/* Stats */}
        <div className="flex divide-x" style={{ borderColor: "#2c2c2e" }}>
          <div className="flex-1 px-4 py-4 text-center">
            <p className="text-xs text-neutral-500 mb-1">Number of Entries</p>
            <p className="text-white font-bold text-2xl">{journey.stickers.length}</p>
          </div>
          <div className="flex-1 px-4 py-4 text-center" style={{ borderColor: "#2c2c2e" }}>
            <p className="text-xs text-neutral-500 mb-1">Travel Time</p>
            <p className="text-white font-bold text-2xl">
              {days != null ? `${days} day${days !== 1 ? "s" : ""}` : "—"}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="px-4 pb-4 pt-1 space-y-2">
          {isOwner && !shared && (
            <button
              onClick={handleShare}
              disabled={sharing}
              className="w-full py-3 rounded-2xl text-black text-sm font-semibold disabled:opacity-50 transition active:scale-[0.98]"
              style={{ background: ACCENT }}
            >
              {sharing ? "Sharing…" : "Share to Feed"}
            </button>
          )}
          {shared && (
            <div className="flex gap-2">
              <Link
                href={`/journey/${journey.id}`}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-white text-sm font-semibold"
                style={{ background: "#2c2c2e" }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/>
                  <line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/>
                </svg>
                View
              </Link>
              <button
                onClick={() => setShowShareCard(true)}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-black text-sm font-semibold transition active:scale-[0.98]"
                style={{ background: ACCENT }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>
                </svg>
                Share Card
              </button>
            </div>
          )}
        </div>
      </div>

      {showShareCard && (
        <JourneyShareCardModal
          journeyId={journey.id}
          journeyUrl={`${typeof window !== "undefined" ? window.location.origin : ""}/journey/${journey.id}`}
          onClose={() => setShowShareCard(false)}
        />
      )}

      {isOwner && sheetOpen && (
        <>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={() => setSheetOpen(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center">
            <div className="w-full max-w-lg rounded-t-3xl shadow-2xl overflow-hidden mb-0" style={{ background: "#1c1c1e" }}>
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-white/20" />
              </div>
              <div className="px-4 pb-8 pt-2 space-y-1">
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl hover:bg-white/10 text-left disabled:opacity-40 transition-colors"
                >
                  <span className="text-xl">🗑️</span>
                  <div>
                    <p className="font-semibold text-sm text-red-400">
                      {deleting ? "Deleting…" : "Delete story"}
                    </p>
                    <p className="text-xs text-neutral-500">Permanently remove this journey</p>
                  </div>
                </button>
                <button
                  onClick={() => setSheetOpen(false)}
                  className="w-full py-3 mt-2 rounded-2xl border border-white/10 text-sm font-medium text-neutral-400 hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}

// ── Feed page ─────────────────────────────────────────────────────────────────
export default function FeedPage() {
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

  useEffect(() => {
    getSupabaseBrowser().auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id ?? null;
      setCurrentUserId(uid);
      if (data.user?.user_metadata?.username) setUsername(data.user.user_metadata.username);

      const params = uid ? `?user_id=${uid}` : "";
      const res = await fetch(`/api/journeys${params}`).then((r) => r.json()).catch(() => ({ journeys: [] }));
      setJourneys(res.journeys ?? []);
      setLoading(false);
    });
  }, []);

  return (
    <main className="min-h-screen pb-24" style={{ background: "#0f0f0f" }}>
      <div className="mx-auto w-full max-w-xl px-4">
      {/* Header */}
      <div className="pt-14 pb-4 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">Bonjour</h1>
          <p className="text-neutral-500 text-sm mt-0.5">Your Feed</p>
        </div>
        <Link href="/map" className="w-9 h-9 flex items-center justify-center rounded-xl mt-1" style={{ background: "#1c1c1e" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
            <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/>
            <line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/>
          </svg>
        </Link>
      </div>

      <div className="space-y-4">
        {loading && (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 rounded-full border-2 border-neutral-800 animate-spin" style={{ borderTopColor: ACCENT }} />
          </div>
        )}

        {!loading && journeys.length === 0 && (
          <div className="text-center py-24 space-y-3">
            <p className="text-4xl">🗺️</p>
            <p className="font-semibold text-white">No stories yet</p>
            <p className="text-sm text-neutral-500">Create your first journey to see it here</p>
            <Link href="/capture?flow=journey"
              className="inline-block mt-2 px-6 py-3 rounded-2xl text-black text-sm font-bold"
              style={{ background: ACCENT }}>
              Create a Story
            </Link>
          </div>
        )}

        {!loading && journeys.map((journey) => (
          <JourneyCard
            key={journey.id}
            journey={journey}
            currentUserId={currentUserId}
            mapboxToken={mapboxToken}
            onMadePublic={(id) => setJourneys((prev) => prev.map((j) => j.id === id ? { ...j, is_public: true } : j))}
            onDeleted={(id) => setJourneys((prev) => prev.filter((j) => j.id !== id))}
          />
        ))}
      </div>
      </div>
    </main>
  );
}
