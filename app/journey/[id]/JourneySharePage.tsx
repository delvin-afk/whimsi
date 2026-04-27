"use client";

import { useEffect, useRef, useState } from "react";
import type { Journey, StickerPost } from "@/types";
import Link from "next/link";

const COLOR = "#a855f7";

function avatarColor(username: string) {
  const colors = ["#f43f5e", "#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#06b6d4"];
  let hash = 0;
  for (const c of username) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff;
  return colors[Math.abs(hash) % colors.length];
}

// ── Stop detail bottom sheet ──────────────────────────────────────────────────
function StopSheet({
  stop,
  stopIndex,
  totalStops,
  journeyTitle,
  onClose,
  onPrev,
  onNext,
}: {
  stop: StickerPost;
  stopIndex: number;
  totalStops: number;
  journeyTitle: string;
  onClose: () => void;
  onPrev: (() => void) | null;
  onNext: (() => void) | null;
}) {
  const touchStartX = useRef<number | null>(null);

  const takenAt = stop.photo_taken_at
    ? new Date(stop.photo_taken_at).toLocaleString(undefined, {
        month: "numeric", day: "numeric", year: "numeric",
        hour: "numeric", minute: "2-digit",
      })
    : null;

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < 50) return;
    if (dx > 0 && onPrev) onPrev();
    else if (dx < 0 && onNext) onNext();
  }

  return (
    <>
      <div className="absolute inset-0 z-20" onClick={onClose} />
      <div
        className="absolute bottom-0 left-0 right-0 z-30 rounded-t-3xl overflow-hidden"
        style={{ background: "#1c1c1e" }}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Stop counter */}
        <div className="flex items-center justify-between px-4 pt-1 pb-2">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: `${COLOR}22`, color: COLOR }}>
            Stop {stopIndex} of {totalStops}
          </span>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full text-neutral-500 hover:text-neutral-300" style={{ background: "#2c2c2e" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Sticker image with prev/next arrows */}
        <div
          className="mx-4 mb-3 rounded-2xl flex items-center justify-center overflow-hidden relative"
          style={{ height: 190, background: "rgba(255,255,255,0.05)" }}
        >
          {onPrev && (
            <button
              onClick={onPrev}
              className="absolute left-2 z-10 w-8 h-8 rounded-full flex items-center justify-center transition-opacity"
              style={{ background: "rgba(0,0,0,0.4)" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={stop.image_url}
            alt={stop.caption ?? "sticker"}
            className="max-h-full max-w-full object-contain"
            style={{ filter: "drop-shadow(0 4px 16px rgba(0,0,0,0.6))" }}
          />
          {onNext && (
            <button
              onClick={onNext}
              className="absolute right-2 z-10 w-8 h-8 rounded-full flex items-center justify-center transition-opacity"
              style={{ background: "rgba(0,0,0,0.4)" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
            </button>
          )}
        </div>

        {/* User info */}
        <div className="flex items-center gap-3 px-4 mb-3">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
            style={{ background: avatarColor(stop.username) }}
          >
            {stop.username[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm leading-tight">{stop.username}</p>
            <p className="text-neutral-500 text-xs truncate">
              {takenAt ?? ""}
              {stop.location_name ? (takenAt ? ` · ${stop.location_name}` : stop.location_name) : ""}
            </p>
          </div>
        </div>

        {/* Caption */}
        {stop.caption ? (
          <div className="px-4 mb-3">
            <p className="text-white font-semibold text-base leading-snug">{stop.caption}</p>
            <p className="text-neutral-500 text-xs mt-0.5">{journeyTitle}</p>
          </div>
        ) : (
          <div className="px-4 mb-3">
            <p className="text-neutral-400 text-sm italic">{journeyTitle}</p>
          </div>
        )}

        {/* Audio */}
        {stop.voice_url && (
          <div className="mx-4 mb-3 rounded-2xl px-3 py-2.5 flex items-center gap-3" style={{ background: "rgba(255,255,255,0.06)" }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: COLOR }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <rect x="9" y="2" width="6" height="12" rx="3" stroke="white" strokeWidth="1.8"/>
                <path d="M5 10a7 7 0 0 0 14 0" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </div>
            <audio src={stop.voice_url} controls className="flex-1 h-8" />
          </div>
        )}

        {/* Location */}
        {stop.location_name && (
          <div className="flex items-center gap-2 px-4 mb-4">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
            </svg>
            <p className="text-neutral-500 text-xs">{stop.location_name}</p>
          </div>
        )}

        <div style={{ height: "calc(0.75rem + env(safe-area-inset-bottom))" }} />
      </div>
    </>
  );
}

// ── Journey share page ────────────────────────────────────────────────────────
export default function JourneySharePage({ journey }: { journey: Journey }) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  const [activeStop, setActiveStop] = useState(0);
  const [selectedStop, setSelectedStop] = useState<{ stop: StickerPost; index: number } | null>(null);
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
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

  function flyToStop(index: number) {
    const stop = validStops[index];
    if (!stop || !mapRef.current) return;
    setActiveStop(index);
    mapRef.current.flyTo({ center: [stop.lng!, stop.lat!], zoom: 15, duration: 900 });
  }

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

        // Sticker markers — click opens bottom sheet
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
            setActiveStop(i);
            setSelectedStop({ stop, index: i + 1 });
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
          <div ref={containerRef} className="w-full h-full" />
        )}

        {/* Stop detail sheet */}
        {selectedStop && (
          <StopSheet
            stop={selectedStop.stop}
            stopIndex={selectedStop.index}
            totalStops={validStops.length}
            journeyTitle={journeyTitle}
            onClose={() => setSelectedStop(null)}
            onPrev={selectedStop.index > 1 ? () => {
              const newIdx = selectedStop.index - 2;
              flyToStop(newIdx);
              setSelectedStop({ stop: validStops[newIdx], index: newIdx + 1 });
            } : null}
            onNext={selectedStop.index < validStops.length ? () => {
              const newIdx = selectedStop.index;
              flyToStop(newIdx);
              setSelectedStop({ stop: validStops[newIdx], index: newIdx + 1 });
            } : null}
          />
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
