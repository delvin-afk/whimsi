"use client";

import { useEffect, useRef, useState } from "react";
import type { Journey } from "@/types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabase/browser";

const ACCENT = "#4ade80";
const MAP_LINE = "#a855f7";
const STICKER_SIZE = 44;

function avatarColor(username: string) {
  const colors = ["#f43f5e", "#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#06b6d4", "#ec4899"];
  let hash = 0;
  for (const c of username) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff;
  return colors[Math.abs(hash) % colors.length];
}

function uniqueLocationCount(stickers: Journey["stickers"]): number {
  return new Set(stickers.map((s) => s.location_name).filter(Boolean)).size;
}

function journeyMatchesSearch(journey: Journey, query: string): boolean {
  if (!query.trim()) return true;
  const q = query.toLowerCase();
  if (journey.caption?.toLowerCase().includes(q)) return true;
  for (const s of journey.stickers) {
    if (s.caption?.toLowerCase().includes(q)) return true;
    if (s.location_name?.toLowerCase().includes(q)) return true;
  }
  return false;
}

// ── Mini map per card ─────────────────────────────────────────────────────────
function JourneyMiniMap({ journey, mapboxToken }: { journey: Journey; mapboxToken: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  const located = journey.stickers.filter((s) => s.lat != null && s.lng != null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current || !mapboxToken || located.length === 0) return;
    let destroyed = false;

    import("mapbox-gl").then(({ default: mapboxgl }) => {
      import("mapbox-gl/dist/mapbox-gl.css");
      if (destroyed || !containerRef.current) return;

      mapboxgl.accessToken = mapboxToken;
      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center: [located[0].lng!, located[0].lat!],
        zoom: 12,
        interactive: false,
      });
      mapRef.current = map;

      map.on("load", async () => {
        if (destroyed) return;

        if (located.length >= 2) {
          const straight = located.map((s) => [s.lng!, s.lat!]);
          let coords: number[][] = [];
          for (let i = 0; i < straight.length - 1; i++) {
            const [lng1, lat1] = straight[i];
            const [lng2, lat2] = straight[i + 1];
            try {
              const res = await fetch(
                `https://api.mapbox.com/directions/v5/mapbox/driving/${lng1},${lat1};${lng2},${lat2}?geometries=geojson&overview=full&access_token=${mapboxToken}`
              );
              const json = await res.json();
              const leg: number[][] | undefined = json.routes?.[0]?.geometry?.coordinates;
              if (leg?.length) { if (coords.length) leg.shift(); coords = coords.concat(leg); }
              else { if (!coords.length) coords.push(straight[i]); coords.push(straight[i + 1]); }
            } catch {
              if (!coords.length) coords.push(straight[i]); coords.push(straight[i + 1]);
            }
          }
          if (destroyed) return;
          const finalCoords = coords.length >= 2 ? coords : straight;
          map.addSource("r", { type: "geojson", data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: finalCoords } } });
          map.addLayer({ id: "r-glow", type: "line", source: "r", layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": MAP_LINE, "line-width": 10, "line-opacity": 0.2 } });
          map.addLayer({ id: "r-line", type: "line", source: "r", layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": MAP_LINE, "line-width": 4, "line-opacity": 0.9 } });
        }

        located.forEach((stop, i) => {
          const wrapper = document.createElement("div");
          wrapper.style.cssText = "display:flex;flex-direction:column;align-items:center;";
          const sWrap = document.createElement("div");
          sWrap.style.cssText = `position:relative;width:${STICKER_SIZE}px;height:${STICKER_SIZE}px;`;
          const img = document.createElement("img");
          img.src = stop.image_url;
          img.style.cssText = `width:${STICKER_SIZE}px;height:${STICKER_SIZE}px;object-fit:contain;filter:drop-shadow(0 2px 6px rgba(0,0,0,0.5));`;
          const badge = document.createElement("div");
          badge.style.cssText = `position:absolute;top:-5px;left:-5px;width:18px;height:18px;border-radius:50%;background:${MAP_LINE};color:white;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;font-family:sans-serif;border:1.5px solid white;`;
          badge.textContent = String(i + 1);
          sWrap.appendChild(img); sWrap.appendChild(badge);
          const pin = document.createElement("div");
          pin.style.cssText = `width:7px;height:7px;border-radius:50%;background:${MAP_LINE};border:2px solid white;margin-top:2px;flex-shrink:0;`;
          wrapper.appendChild(sWrap); wrapper.appendChild(pin);
          new mapboxgl.Marker({ element: wrapper, anchor: "bottom" }).setLngLat([stop.lng!, stop.lat!]).addTo(map);
        });

        if (located.length > 1) {
          const lngs = located.map((s) => s.lng!);
          const lats = located.map((s) => s.lat!);
          map.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], {
            padding: { top: STICKER_SIZE + 20, bottom: 20, left: 44, right: 44 }, duration: 0, maxZoom: 16,
          });
        }
      });
    });

    return () => { destroyed = true; mapRef.current?.remove(); mapRef.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={containerRef} className="w-full h-full" />;
}

// ── Journey card ──────────────────────────────────────────────────────────────
function ProfileJourneyCard({ journey, mapboxToken }: { journey: Journey; mapboxToken: string }) {
  const locCount = uniqueLocationCount(journey.stickers);

  return (
    <div className="rounded-3xl overflow-hidden" style={{ background: "#1c1c1e" }}>
      {/* Header row */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between gap-2">
          {journey.caption
            ? <p className="text-white font-bold text-base truncate">{journey.caption}</p>
            : <p className="text-neutral-500 text-sm italic">No caption</p>
          }
          {!journey.is_public && (
            <span className="shrink-0 text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "rgba(74,222,128,0.15)", color: ACCENT }}>
              Private
            </span>
          )}
        </div>
      </div>

      {/* Map — tapping opens this journey on the map */}
      <Link href={`/map?journey=${journey.id}`} className="block h-56 w-full bg-neutral-800 relative">
        <JourneyMiniMap journey={journey} mapboxToken={mapboxToken} />
        <div className="absolute inset-0" />
      </Link>

      {/* Stats */}
      <div className="flex divide-x" style={{ borderColor: "#2c2c2e" }}>
        <div className="flex-1 px-4 py-3 text-center">
          <p className="text-xs text-neutral-500 mb-0.5">Entries</p>
          <p className="text-white font-bold text-xl">{journey.stickers.length}</p>
        </div>
        <div className="flex-1 px-4 py-3 text-center">
          <p className="text-xs text-neutral-500 mb-0.5">Locations</p>
          <p className="text-white font-bold text-xl">{locCount || "—"}</p>
        </div>
      </div>
    </div>
  );
}

// ── Create card placeholder ───────────────────────────────────────────────────
function CreateCard() {
  return (
    <Link
      href="/capture?flow=journey"
      className="flex flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed py-10 transition-colors"
      style={{ borderColor: "rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)" }}
    >
      <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: ACCENT }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.5" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </div>
      <p className="text-white font-semibold text-sm">Create a Journey</p>
    </Link>
  );
}

// ── Profile page ──────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

  useEffect(() => {
    getSupabaseBrowser().auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push("/auth?redirect=/profile"); return; }

      const uid = data.user.id;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: profile } = await (getSupabaseBrowser() as any)
        .from("profiles")
        .select("username")
        .eq("id", uid)
        .single();
      if (profile?.username) setUsername(profile.username);

      // Fetch only this user's journeys
      const res = await fetch(`/api/journeys?user_id=${uid}`).then((r) => r.json()).catch(() => ({ journeys: [] }));
      // Filter to only own journeys (API returns public + own, we want own only)
      const own = (res.journeys ?? []).filter((j: Journey) => j.user_id === uid);
      setJourneys(own);
      setLoading(false);
    });
  }, [router]);

  const filtered = journeys.filter((j) => journeyMatchesSearch(j, searchQuery));

  return (
    <main className="min-h-screen pb-28" style={{ background: "#0f0f0f" }}>
      <div className="mx-auto w-full max-w-xl px-4">

        {/* Header */}
        <div className="pt-14 pb-5 flex items-center gap-4">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-xl shrink-0"
            style={{ background: username ? avatarColor(username) : "#2c2c2e" }}
          >
            {username ? username[0].toUpperCase() : ""}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-black text-2xl leading-tight">{username || "…"}</p>
            <p className="text-neutral-500 text-sm">{journeys.length} {journeys.length === 1 ? "journey" : "journeys"}</p>
          </div>
        </div>

        {/* Search */}
        <div className="mb-5">
          <div className="flex items-center gap-2 px-4 py-3 rounded-2xl" style={{ background: "#1c1c1e" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8e8e93" strokeWidth="2.5" strokeLinecap="round" className="shrink-0">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search your journeys…"
              className="flex-1 bg-transparent text-white placeholder-[#8e8e93] text-sm outline-none"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="text-[#8e8e93] hover:text-white shrink-0">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Cards */}
        <div className="space-y-4">
          {loading && (
            <div className="flex justify-center py-20">
              <div className="h-8 w-8 rounded-full border-2 border-neutral-800 animate-spin" style={{ borderTopColor: ACCENT }} />
            </div>
          )}

          {!loading && journeys.length === 0 && (
            <div className="text-center py-16 space-y-3">
              <p className="text-4xl">🗺️</p>
              <p className="font-semibold text-white">No journeys yet</p>
              <p className="text-sm text-neutral-500">Create your first journey to see it here</p>
            </div>
          )}

          {!loading && journeys.length > 0 && filtered.length === 0 && (
            <div className="text-center py-16 space-y-2">
              <p className="text-3xl">🔍</p>
              <p className="font-semibold text-white">No results for &ldquo;{searchQuery}&rdquo;</p>
            </div>
          )}

          {!loading && filtered.map((journey) => (
            <ProfileJourneyCard
              key={journey.id}
              journey={journey}
              mapboxToken={mapboxToken}
            />
          ))}

          {/* Create card always at the bottom */}
          {!loading && <CreateCard />}
        </div>
      </div>
    </main>
  );
}
