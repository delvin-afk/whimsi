"use client";

import { useEffect, useRef, useState } from "react";
import type { Journey, StickerPost } from "@/types";

const ROUTE_COLOR = "#22c55e";

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

function JourneyMiniMap({ stickers }: { stickers: StickerPost[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  const [inView, setInView] = useState(false);
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const locs = stickers.filter((s) => s.lat != null && s.lng != null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setInView(true); },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!inView || !containerRef.current || mapRef.current || !token || locs.length === 0) return;
    let destroyed = false;

    import("mapbox-gl").then(({ default: mapboxgl }) => {
      import("mapbox-gl/dist/mapbox-gl.css");
      if (destroyed || !containerRef.current) return;

      mapboxgl.accessToken = token;
      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center: [locs[0].lng!, locs[0].lat!],
        zoom: 12,
        interactive: false,
      });
      mapRef.current = map;

      map.on("load", async () => {
        if (destroyed) return;

        if (locs.length >= 2) {
          const straight = locs.map((s) => [s.lng!, s.lat!]);
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
          if (destroyed) return;
          const coords = routeCoords.length >= 2 ? routeCoords : straight;
          map.addSource("route", {
            type: "geojson",
            data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } },
          });
          map.addLayer({ id: "route-glow", type: "line", source: "route", layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": ROUTE_COLOR, "line-width": 8, "line-opacity": 0.2 } });
          map.addLayer({ id: "route-line", type: "line", source: "route", layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": ROUTE_COLOR, "line-width": 3.5, "line-opacity": 0.9 } });
        }

        locs.forEach((stop, i) => {
          const el = document.createElement("div");
          el.style.cssText = `width:20px;height:20px;border-radius:50%;background:${ROUTE_COLOR};color:white;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;font-family:sans-serif;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.35);flex-shrink:0;`;
          el.textContent = String(i + 1);
          new mapboxgl.Marker({ element: el, anchor: "center" })
            .setLngLat([stop.lng!, stop.lat!])
            .addTo(map);
        });

        if (locs.length > 1) {
          const lngs = locs.map((s) => s.lng!);
          const lats = locs.map((s) => s.lat!);
          map.fitBounds(
            [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
            { padding: 28, duration: 0, maxZoom: 15 }
          );
        } else {
          map.flyTo({ center: [locs[0].lng!, locs[0].lat!], zoom: 14, duration: 0 });
        }
      });
    });

    return () => { destroyed = true; mapRef.current?.remove(); mapRef.current = null; };
  }, [inView]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={containerRef} className="w-full h-full" />;
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
  const hasLocations = journey.stickers.some((s) => s.lat != null && s.lng != null);

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
      {/* User info row */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <div
          className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center text-white font-bold text-sm shrink-0"
          style={{ background: journey.avatar_url ? "transparent" : color }}
        >
          {journey.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={journey.avatar_url} alt={journey.username} className="w-full h-full object-cover" />
          ) : (
            journey.username[0]?.toUpperCase()
          )}
        </div>
        <div className="min-w-0">
          <p className="text-white text-sm font-semibold leading-tight">{journey.username}</p>
          <p className="text-xs leading-tight truncate" style={{ color: "rgba(255,255,255,0.45)" }}>
            {dateDisplay}{firstLocation ? ` · ${firstLocation}` : ""}
          </p>
        </div>
      </div>

      {/* Title */}
      <p className="px-4 pb-3 text-white font-bold text-base leading-snug">{title}</p>

      {/* Map thumbnail + stats */}
      <div className="flex gap-2 mx-4 mb-4">
        <div className="w-1/2 aspect-square rounded-lg overflow-hidden" style={{ background: "#2c2c2e" }}>
          {hasLocations ? (
            <JourneyMiniMap stickers={journey.stickers} />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeLinecap="round">
                <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/>
                <line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/>
              </svg>
            </div>
          )}
        </div>

        <div
          className="w-1/2 flex flex-col justify-center gap-3 px-4 rounded-lg"
          style={{ background: "rgba(255,255,255,0.05)" }}
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
