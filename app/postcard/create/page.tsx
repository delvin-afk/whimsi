"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import type { Journey } from "@/types";

const MAP_LINE = "#a855f7";
const STICKER_SIZE = 30;

// ── Mini map ──────────────────────────────────────────────────────────────────
function JourneyMapThumb({ journey, mapboxToken }: { journey: Journey; mapboxToken: string }) {
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
          map.addLayer({ id: "r-glow", type: "line", source: "r", layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": MAP_LINE, "line-width": 8, "line-opacity": 0.2 } });
          map.addLayer({ id: "r-line", type: "line", source: "r", layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": MAP_LINE, "line-width": 3, "line-opacity": 0.9 } });
        }

        located.forEach((stop, i) => {
          const wrapper = document.createElement("div");
          wrapper.style.cssText = "display:flex;flex-direction:column;align-items:center;";
          const sWrap = document.createElement("div");
          sWrap.style.cssText = `position:relative;width:${STICKER_SIZE}px;height:${STICKER_SIZE}px;`;
          const img = document.createElement("img");
          img.src = stop.image_url;
          img.style.cssText = `width:${STICKER_SIZE}px;height:${STICKER_SIZE}px;object-fit:contain;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.4));`;
          const badge = document.createElement("div");
          badge.style.cssText = `position:absolute;top:-4px;left:-4px;width:14px;height:14px;border-radius:50%;background:${MAP_LINE};color:white;font-size:7px;font-weight:700;display:flex;align-items:center;justify-content:center;font-family:sans-serif;border:1px solid white;`;
          badge.textContent = String(i + 1);
          sWrap.appendChild(img); sWrap.appendChild(badge);
          const pin = document.createElement("div");
          pin.style.cssText = `width:5px;height:5px;border-radius:50%;background:${MAP_LINE};border:1.5px solid white;margin-top:1px;flex-shrink:0;`;
          wrapper.appendChild(sWrap); wrapper.appendChild(pin);
          new mapboxgl.Marker({ element: wrapper, anchor: "bottom" }).setLngLat([stop.lng!, stop.lat!]).addTo(map);
        });

        if (located.length > 1) {
          const lngs = located.map((s) => s.lng!);
          const lats = located.map((s) => s.lat!);
          map.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], {
            padding: { top: STICKER_SIZE + 14, bottom: 10, left: 28, right: 28 }, duration: 0, maxZoom: 16,
          });
        }
      });
    });

    return () => { destroyed = true; mapRef.current?.remove(); mapRef.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={containerRef} className="w-full h-full" />;
}

// ── Postcard preview ──────────────────────────────────────────────────────────
function PostcardPreview({
  journey, recipientName, location, caption, mapboxToken,
}: {
  journey: Journey;
  recipientName: string;
  location: string;
  caption: string;
  mapboxToken: string;
}) {
  const now = new Date();
  const dateStr = `${String(now.getMonth() + 1).padStart(2, "0")} ${String(now.getDate()).padStart(2, "0")} ${String(now.getFullYear()).slice(-2)}`;

  return (
    <div className="rounded-2xl overflow-hidden flex shadow-xl" style={{ height: 260 }}>
      {/* Left: journey map */}
      <div className="relative shrink-0" style={{ width: "54%" }}>
        <JourneyMapThumb journey={journey} mapboxToken={mapboxToken} />
      </div>

      {/* Right: postcard panel */}
      <div className="relative flex-1" style={{ background: "#f5f0e8" }}>
        {/* Wavy decoration lines — upper portion */}
        <div className="absolute inset-x-0 top-0" style={{ height: 72, padding: "8px 10px 0 10px" }}>
          <svg width="100%" height="60" viewBox="0 0 120 60" preserveAspectRatio="none">
            {[0, 10, 20, 30, 40].map((y) => (
              <path
                key={y}
                d={`M0,${y + 6} C20,${y + 2} 40,${y + 10} 60,${y + 6} C80,${y + 2} 100,${y + 10} 120,${y + 6}`}
                fill="none"
                stroke="#c8b89a"
                strokeWidth="1"
                opacity="0.65"
              />
            ))}
          </svg>
        </div>

        {/* whimsi badge — top right */}
        <div
          className="absolute top-2 right-2 px-2 py-0.5 rounded-full font-bold text-black z-10"
          style={{ background: "#4ade80", fontSize: 9 }}
        >
          whimsi
        </div>

        {/* Postmark stamp — center */}
        <div className="absolute" style={{ top: 56, left: "50%", transform: "translateX(-50%)" }}>
          <svg width="62" height="62" viewBox="0 0 62 62">
            <circle cx="31" cy="31" r="29" fill="none" stroke="#b8a48a" strokeWidth="1.5" />
            <circle cx="31" cy="31" r="24" fill="none" stroke="#b8a48a" strokeWidth="0.75" strokeDasharray="3 2" />
            <text x="31" y="26" textAnchor="middle" fontSize="6.5" fill="#9c8468" fontFamily="monospace" letterSpacing="2">· · · ·</text>
            <text x="31" y="34" textAnchor="middle" fontSize="8" fill="#9c8468" fontFamily="monospace">{dateStr}</text>
            <text x="31" y="42" textAnchor="middle" fontSize="6.5" fill="#9c8468" fontFamily="monospace" letterSpacing="2">· · · ·</text>
          </svg>
        </div>

        {/* Bottom section: location, name, lines */}
        <div className="absolute bottom-3 left-3 right-3">
          {location && (
            <p className="mb-1" style={{ color: "#9c8468", fontFamily: "monospace", fontSize: 8, letterSpacing: "0.08em" }}>
              {location.toUpperCase()}
            </p>
          )}
          {caption && (
            <p className="mb-1.5 leading-tight" style={{ color: "#6b5740", fontFamily: "Georgia, serif", fontSize: 9 }}>
              {caption}
            </p>
          )}
          <p
            className="border-b pb-0.5 mb-2"
            style={{ color: "#2d2016", fontFamily: "Georgia, serif", fontSize: 14, fontStyle: "italic", borderColor: "#c8b89a", minHeight: 20 }}
          >
            {recipientName}
          </p>
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ height: 1, background: "#d6c9b0" }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Page content ──────────────────────────────────────────────────────────────
function CreatePostcardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const journeyId = searchParams.get("journey");
  const [journey, setJourney] = useState<Journey | null>(null);
  const [recipientName, setRecipientName] = useState("");
  const [location, setLocation] = useState("");
  const [caption, setCaption] = useState("");
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

  useEffect(() => {
    if (!journeyId) return;
    getSupabaseBrowser().auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id;
      if (!uid) return;
      const res = await fetch(`/api/journeys?user_id=${uid}`).then((r) => r.json()).catch(() => ({ journeys: [] }));
      const found = (res.journeys ?? []).find((j: Journey) => j.id === journeyId);
      if (found) setJourney(found);
    });
  }, [journeyId]);

  return (
    <main className="min-h-screen pb-20" style={{ background: "#0f0f0f" }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-14 pb-6">
        <button
          onClick={() => router.back()}
          className="text-white p-1 -ml-1"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
        </button>
        <h1 className="text-white font-bold text-2xl">Create Post Card</h1>
      </div>

      <div className="px-4 space-y-6">
        {/* Postcard preview */}
        {journey ? (
          <PostcardPreview
            journey={journey}
            recipientName={recipientName}
            location={location}
            caption={caption}
            mapboxToken={mapboxToken}
          />
        ) : (
          <div className="rounded-2xl flex items-center justify-center" style={{ height: 260, background: "#1c1c1e" }}>
            <div className="w-8 h-8 rounded-full border-2 border-neutral-800 animate-spin" style={{ borderTopColor: "#4ade80" }} />
          </div>
        )}

        {/* Form */}
        <div className="space-y-5">
          <div>
            <p className="text-white text-sm font-medium mb-2">Enter Recipient&apos;s Name:</p>
            <input
              type="text"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              placeholder="To Whom?"
              className="w-full px-4 py-4 rounded-2xl text-white placeholder-neutral-600 text-sm outline-none"
              style={{ background: "#1c1c1e" }}
            />
          </div>

          <div>
            <p className="text-white text-sm font-medium mb-2">Select Location</p>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Ex: Athens, Greece"
              className="w-full px-4 py-4 rounded-2xl text-white placeholder-neutral-600 text-sm outline-none"
              style={{ background: "#1c1c1e" }}
            />
          </div>

          <div>
            <p className="text-white text-sm font-medium mb-2">Write Caption:</p>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Ex: What happened here?"
              rows={5}
              className="w-full px-4 py-4 rounded-2xl text-white placeholder-neutral-600 text-sm outline-none resize-none"
              style={{ background: "#1c1c1e" }}
            />
          </div>
        </div>
      </div>
    </main>
  );
}

export default function CreatePostcardPage() {
  return (
    <Suspense>
      <CreatePostcardContent />
    </Suspense>
  );
}
