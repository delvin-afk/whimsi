"use client";

import { useEffect, useRef, useState } from "react";
import type { Journey } from "@/types";
import Link from "next/link";

const COLOR = "#a855f7";

export default function JourneySharePage({ journey }: { journey: Journey }) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  const [activeStop, setActiveStop] = useState(0);
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const validStops = journey.stickers.filter((s) => s.lat != null && s.lng != null);

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

  function flyToStop(index: number) {
    const stop = validStops[index];
    if (!stop || !mapRef.current) return;
    setActiveStop(index);
    mapRef.current.flyTo({ center: [stop.lng!, stop.lat!], zoom: 15, duration: 900 });
  }

  useEffect(() => {
    if (!containerRef.current || mapRef.current || !token || validStops.length === 0) return;

    import("mapbox-gl").then(({ default: mapboxgl }) => {
      // non-awaited side-effect — same as MapView.tsx
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
        // Fit to journey bounds
        if (validStops.length > 1) {
          const lngs = validStops.map((s) => s.lng!);
          const lats = validStops.map((s) => s.lat!);
          map.fitBounds(
            [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
            { padding: 80, duration: 800 }
          );
        }

        // Route line
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

        // Sticker markers
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

          // Clicking a marker also highlights the pill
          wrapper.addEventListener("click", () => setActiveStop(i));

          const popup = new mapboxgl.Popup({ offset: [0, -56], closeButton: false }).setHTML(`
            <div style="font-family:sans-serif;max-width:180px">
              <p style="font-weight:700;margin:0 0 2px;color:${COLOR}">Stop ${i + 1}</p>
              ${stop.caption ? `<p style="font-size:13px;margin:0 0 4px">${stop.caption}</p>` : ""}
              ${stop.location_name ? `<p style="font-size:12px;color:#555;margin:0">📍 ${stop.location_name}</p>` : ""}
            </div>
          `);
          new mapboxgl.Marker({ element: wrapper, anchor: "bottom" })
            .setLngLat([stop.lng!, stop.lat!])
            .setPopup(popup)
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
    <div className="flex flex-col h-screen">
      {/* Top info bar */}
      <div className="shrink-0 bg-white border-b border-neutral-100 px-4 py-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
          style={{ background: COLOR }}>
          {journey.username[0]?.toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm truncate">{journey.caption ?? `${journey.username}'s Journey`}</p>
          <p className="text-xs text-neutral-400">
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
          <div ref={containerRef} className="w-full h-full" />
        )}

        {/* Stop navigator */}
        {validStops.length > 0 && (
          <div className="absolute bottom-3 left-3 right-3 z-10">
            <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg px-3 py-2.5 flex items-center gap-2">
              {/* Prev */}
              <button
                onClick={() => flyToStop(Math.max(0, activeStop - 1))}
                disabled={activeStop === 0}
                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 disabled:opacity-30 transition-opacity hover:bg-neutral-100"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
              </button>

              {/* Scrollable stop pills */}
              <div className="flex gap-2 overflow-x-auto flex-1 scrollbar-none">
                {validStops.map((s, i) => (
                  <button
                    key={s.id}
                    onClick={() => flyToStop(i)}
                    className="flex items-center gap-1.5 rounded-full px-3 py-1.5 shrink-0 transition-all text-xs font-medium"
                    style={
                      activeStop === i
                        ? { background: COLOR, color: "white" }
                        : { background: "#f3f4f6", color: "#374151" }
                    }
                  >
                    <span
                      className="w-4 h-4 rounded-full flex items-center justify-center font-bold shrink-0"
                      style={{
                        background: activeStop === i ? "rgba(255,255,255,0.3)" : COLOR,
                        color: "white",
                        fontSize: "10px",
                      }}
                    >
                      {i + 1}
                    </span>
                    <span className="max-w-28 truncate">
                      {s.location_name ?? s.caption ?? `Stop ${i + 1}`}
                    </span>
                  </button>
                ))}
              </div>

              {/* Next */}
              <button
                onClick={() => flyToStop(Math.min(validStops.length - 1, activeStop + 1))}
                disabled={activeStop === validStops.length - 1}
                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 disabled:opacity-30 transition-opacity hover:bg-neutral-100"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom CTA */}
      <div className="shrink-0 bg-white border-t border-neutral-100 px-4 py-3 flex items-center gap-3">
        <p className="flex-1 text-xs text-neutral-500">Want to create your own journey?</p>
        <Link href="/auth" className="shrink-0 px-4 py-2 rounded-xl text-sm font-bold text-white"
          style={{ background: COLOR }}>
          Join whimsi
        </Link>
      </div>
    </div>
  );
}
