"use client";

import { useEffect, useRef, useState } from "react";
import type { Journey, StickerPost } from "@/types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import MemoryPeek from "@/components/map/MemoryPeek";
import MemoryView from "@/components/map/MemoryView";

const COLOR = "#22c55e";

type MemoryState = {
  stop: StickerPost;
  stopIndex: number;
  mode: "peek" | "full";
};

export default function JourneySharePage({ journey }: { journey: Journey }) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  const [activeStop, setActiveStop] = useState(0);
  const [memory, setMemory] = useState<MemoryState | null>(null);
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  useEffect(() => {
    getSupabaseBrowser().auth.getSession().then(({ data }) => setIsAuthed(!!data.session));
  }, []);

  const validStops = journey.stickers.filter((s) => s.lat != null && s.lng != null);
  const journeyTitle = journey.caption ?? `${journey.username}'s Journey`;

  const dateRange = (() => {
    const withTime = journey.stickers.filter((s) => s.photo_taken_at);
    if (withTime.length < 2) return null;
    const sorted = [...withTime].sort((a, b) =>
      new Date(a.photo_taken_at!).getTime() - new Date(b.photo_taken_at!).getTime()
    );
    const first = new Date(sorted[0].photo_taken_at!);
    const last = new Date(sorted[sorted.length - 1].photo_taken_at!);
    return first.toDateString() === last.toDateString()
      ? first.toLocaleDateString(undefined, { dateStyle: "medium" })
      : `${first.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${last.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
  })();

  function flyToStop(index: number, sheetOpen = false) {
    const stop = validStops[index];
    if (!stop || !mapRef.current) return;
    setActiveStop(index);
    // 280px accounts for suspended tile height + nav bar + margins
    const bottomPad = sheetOpen ? 280 : 80;
    mapRef.current.flyTo({
      center: [stop.lng!, stop.lat!],
      zoom: 16,
      duration: 900,
      padding: { top: 60, bottom: bottomPad, left: 60, right: 60 },
    });
  }

  function handleNavigate(stop: StickerPost, index: number) {
    const idx = validStops.findIndex((s) => s.id === stop.id);
    if (idx >= 0) flyToStop(idx, true);
    setMemory((prev) => prev ? { ...prev, stop, stopIndex: index } : prev);
  }

  // Auto-open peek for stop 1 so the user immediately knows they can swipe
  useEffect(() => {
    if (validStops.length > 0) {
      setMemory({ stop: validStops[0], stopIndex: 1, mode: "peek" });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!containerRef.current || mapRef.current || !token || validStops.length === 0) return;

    import("mapbox-gl").then(({ default: mapboxgl }) => {
      import("mapbox-gl/dist/mapbox-gl.css");
      if (!containerRef.current) return;

      mapboxgl.accessToken = token;
      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center: [validStops[0].lng!, validStops[0].lat!],
        zoom: 12,
      });
      mapRef.current = map;

      map.on("load", async () => {
        setMapReady(true);
        flyToStop(0, true);

        if (validStops.length >= 2) {
          const straight = validStops.map((s) => [s.lng!, s.lat!]);
          let routeCoords: number[][] = [];
          for (let i = 0; i < straight.length - 1; i++) {
            const [lng1, lat1] = straight[i];
            const [lng2, lat2] = straight[i + 1];
            try {
              const res = await fetch(
                `https://api.mapbox.com/directions/v5/mapbox/driving/${lng1},${lat1};${lng2},${lat2}?geometries=geojson&overview=full&access_token=${token}`
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
          map.addSource("journey", {
            type: "geojson",
            data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } },
          });
          map.addLayer({ id: "journey-glow", type: "line", source: "journey", layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": COLOR, "line-width": 8, "line-opacity": 0.25 } });
          map.addLayer({ id: "journey-line", type: "line", source: "journey", layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": COLOR, "line-width": 3.5, "line-opacity": 0.9 } });
        }

        validStops.forEach((stop, i) => {
          const wrapper = document.createElement("div");
          wrapper.style.cssText = "display:flex;flex-direction:column;align-items:center;cursor:pointer;";
          const stickerWrap = document.createElement("div");
          stickerWrap.style.cssText = "position:relative;width:44px;height:44px;";
          const img = document.createElement("img");
          img.src = stop.image_url;
          img.style.cssText = "width:44px;height:44px;object-fit:contain;filter:drop-shadow(0 0 4px rgba(0,0,0,0.5));";
          const badge = document.createElement("div");
          badge.style.cssText = `position:absolute;top:-5px;left:-5px;width:18px;height:18px;border-radius:50%;background:${COLOR};color:white;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;font-family:sans-serif;box-shadow:0 1px 3px rgba(0,0,0,0.4);border:1.5px solid white;`;
          badge.textContent = String(i + 1);
          stickerWrap.appendChild(img);
          stickerWrap.appendChild(badge);
          const pin = document.createElement("div");
          pin.style.cssText = `width:8px;height:8px;border-radius:50%;background:${COLOR};border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.45);margin-top:2px;flex-shrink:0;`;
          wrapper.appendChild(stickerWrap);
          wrapper.appendChild(pin);

          wrapper.addEventListener("click", () => {
            flyToStop(i, true);
            setMemory({ stop, stopIndex: i + 1, mode: "peek" });
          });

          new mapboxgl.Marker({ element: wrapper, anchor: "bottom" })
            .setLngLat([stop.lng!, stop.lat!])
            .addTo(map);
        });
      });
    });

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <div className="flex flex-col" style={{ height: "calc(100dvh - 64px - env(safe-area-inset-bottom))" }}>
        {/* Top info bar */}
        <div className="shrink-0 px-3 py-3 flex items-center gap-2" style={{ background: "#1a1a1e", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <button
            onClick={() => router.back()}
            className="w-8 h-8 flex items-center justify-center rounded-full shrink-0 transition"
            style={{ background: "rgba(255,255,255,0.08)" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
          </button>
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0"
            style={{ background: COLOR }}>
            {journey.username[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm text-white truncate">{journey.caption ?? `${journey.username}'s Journey`}</p>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
              {journey.username}{dateRange ? ` · ${dateRange}` : ""} · {journey.stickers.length} stop{journey.stickers.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <div className="w-2 h-2 rounded-full" style={{ background: COLOR }} />
            <span className="text-xs font-semibold" style={{ color: COLOR }}>whimsi</span>
          </div>
        </div>

        {/* Map */}
        <div className="flex-1 min-h-0 relative">
          {validStops.length === 0 || !token ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 px-6">
              <div className="flex gap-3 overflow-x-auto">
                {journey.stickers.map((s, i) => (
                  <div key={s.id} className="relative shrink-0 w-20 h-20">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={s.image_url} alt="" className="w-full h-full object-contain"
                      style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.2))" }} />
                    <span className="absolute -top-1 -left-1 w-5 h-5 rounded-full text-white text-xs font-bold flex items-center justify-center shadow"
                      style={{ background: COLOR }}>{i + 1}</span>
                  </div>
                ))}
              </div>
              <p className="text-sm text-neutral-400 text-center">No location data for this journey</p>
            </div>
          ) : (
            <>
              <div ref={containerRef} className="w-full h-full" />
              {!mapReady && (
                <div className="absolute inset-0 flex items-center justify-center" style={{ background: "#f4f0e8" }}>
                  <div className="h-8 w-8 rounded-full border-2 border-neutral-300 border-t-neutral-600 animate-spin" />
                </div>
              )}
            </>
          )}
        </div>

        {/* Bottom CTA — only for unauthenticated viewers (null = still checking, hide until known) */}
        {isAuthed === false && (
          <div className="shrink-0 bg-white border-t border-neutral-100 px-4 py-3 flex items-center gap-3">
            <p className="flex-1 text-xs text-neutral-500">Want to create your own journey?</p>
            <Link href="/auth" className="shrink-0 px-4 py-2 rounded-xl text-sm font-bold text-white"
              style={{ background: COLOR }}>
              Join whimsi
            </Link>
          </div>
        )}
      </div>

      {/* ── Memory peek — outside main container to clear BottomNav z-index ── */}
      {memory?.mode === "peek" && (
        <MemoryPeek
          stop={memory.stop}
          stopIndex={memory.stopIndex}
          journeyStops={validStops}
          color={COLOR}
          onClose={() => setMemory(null)}
          onExpand={() => setMemory((prev) => prev ? { ...prev, mode: "full" } : prev)}
          onNavigate={handleNavigate}
        />
      )}

      {/* ── Memory full detail — outside main container to clear BottomNav z-index ── */}
      {memory?.mode === "full" && (
        <MemoryView
          stop={memory.stop}
          stopIndex={memory.stopIndex}
          journeyStops={validStops}
          journeyTitle={journeyTitle}
          color={COLOR}
          onClose={() => setMemory((prev) => prev ? { ...prev, mode: "peek" } : prev)}
          onNavigate={handleNavigate}
        />
      )}
    </>
  );
}
