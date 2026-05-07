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
    <div className="flex w-full" style={{ height: 340, background: "#f5f0e8" }}>

      {/* Left: map inset — small cream border visible on top/left/bottom edges */}
      <div className="shrink-0" style={{ width: "50%", padding: "6px 0 6px 6px" }}>
        <div className="w-full h-full overflow-hidden">
          <JourneyMapThumb journey={journey} mapboxToken={mapboxToken} />
        </div>
      </div>

      {/* Vertical divider */}
      <div className="shrink-0" style={{ width: 1, background: "#a09080" }} />

      {/* Right: postcard panel */}
      <div className="relative flex-1" style={{ background: "#f5f0e8" }}>

        {/* Wavy lines — upper right, beside the stamp */}
        <div className="absolute" style={{ top: 12, left: 86, right: 56 }}>
          <svg width="100%" height="48" viewBox="0 0 120 48" preserveAspectRatio="none">
            {[0, 13, 26].map((y) => (
              <path
                key={y}
                d={`M0,${y + 8} C20,${y + 2} 40,${y + 14} 60,${y + 8} C80,${y + 2} 100,${y + 14} 120,${y + 8}`}
                fill="none"
                stroke="#888"
                strokeWidth="1.3"
                opacity="0.5"
              />
            ))}
            <text x="10"  y="6"  fontSize="8" fill="#999" opacity="0.7">✦</text>
            <text x="68"  y="10" fontSize="7" fill="#999" opacity="0.55">✦</text>
            <text x="105" y="5"  fontSize="6" fill="#999" opacity="0.45">✦</text>
            <text x="42"  y="40" fontSize="6" fill="#999" opacity="0.4">✦</text>
          </svg>
        </div>

        {/* whimsi burst badge — top right */}
        <div className="absolute" style={{ top: 6, right: 6 }}>
          <svg width="50" height="50" viewBox="0 0 50 50">
            <path d="M25,1 L28,10 L37,6 L34,15 L43,15 L37,22 L45,27 L37,32 L43,39 L34,39 L37,48 L28,44 L25,53 L22,44 L13,48 L16,39 L7,39 L13,32 L5,27 L13,22 L7,15 L16,15 L13,6 L22,10 Z"
              fill="#4ade80" />
            <text x="25" y="29" textAnchor="middle" fontSize="7" fontWeight="700" fill="black" fontFamily="sans-serif">whimsi</text>
          </svg>
        </div>

        {/* Postmark stamp — upper left of right panel */}
        <div className="absolute" style={{ top: 14, left: 10 }}>
          <svg width="76" height="76" viewBox="0 0 76 76">
            <circle cx="38" cy="38" r="35" fill="none" stroke="#a09080" strokeWidth="1.5" />
            <circle cx="38" cy="38" r="29" fill="none" stroke="#a09080" strokeWidth="0.8" strokeDasharray="4 2.5" />
            <text x="38" y="31" textAnchor="middle" fontSize="7" fill="#9c8878" fontFamily="monospace" letterSpacing="2">·  ·  ·  ·</text>
            <text x="38" y="41" textAnchor="middle" fontSize="10" fill="#9c8878" fontFamily="monospace">{dateStr}</text>
            <text x="38" y="51" textAnchor="middle" fontSize="7" fill="#9c8878" fontFamily="monospace" letterSpacing="2">·  ·  ·  ·</text>
          </svg>
        </div>

        {/* Bottom: recipient name + ruled lines */}
        <div className="absolute left-4 right-4" style={{ bottom: 18 }}>
          {(location || caption) && (
            <div className="mb-2">
              {location && (
                <p style={{ color: "#9c8468", fontFamily: "monospace", fontSize: 9, letterSpacing: "0.07em" }}>
                  {location.toUpperCase()}
                </p>
              )}
              {caption && (
                <p className="leading-snug" style={{ color: "#6b5740", fontFamily: "Georgia, serif", fontSize: 9 }}>
                  {caption}
                </p>
              )}
            </div>
          )}
          <p
            className="border-b pb-1 mb-3"
            style={{ color: "#1a0f0a", fontFamily: "Georgia, serif", fontSize: 18, fontStyle: "italic", borderColor: "#a09080", minHeight: 26 }}
          >
            {recipientName}
          </p>
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ height: 1, background: "#c4b49a" }} />
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

      {/* Postcard preview — full width, no side padding */}
      {journey ? (
        <PostcardPreview
          journey={journey}
          recipientName={recipientName}
          location={location}
          caption={caption}
          mapboxToken={mapboxToken}
        />
      ) : (
        <div className="w-full flex items-center justify-center" style={{ height: 340, background: "#f5f0e8" }}>
          <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: "#c4b49a", borderTopColor: "#4ade80" }} />
        </div>
      )}

      {/* Form */}
      <div className="px-4 space-y-5 mt-6">
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
