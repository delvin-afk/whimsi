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

      {/* Left: map inset — cream border visible on all sides */}
      <div className="shrink-0" style={{ width: "50%", padding: "6px 6px 6px 6px" }}>
        <div className="w-full h-full overflow-hidden">
          <JourneyMapThumb journey={journey} mapboxToken={mapboxToken} />
        </div>
      </div>

      {/* Vertical divider */}
      <div className="shrink-0" style={{ width: 1, background: "#a09080" }} />

      {/* Right: postcard panel */}
      <div className="relative flex-1" style={{ background: "#f5f0e8" }}>

        {/* Wavy lines — top left, slightly smaller, with 3 stars */}
        <div className="absolute" style={{ top: 10, left: 10, right: 58 }}>
          <svg width="100%" height="54" viewBox="0 0 150 54" preserveAspectRatio="none">
            {[0, 15, 30].map((y) => (
              <path
                key={y}
                d={`M0,${y + 10} C25,${y + 3} 50,${y + 18} 75,${y + 10} C100,${y + 3} 125,${y + 18} 150,${y + 10}`}
                fill="none"
                stroke="#777"
                strokeWidth="1.4"
                opacity="0.5"
              />
            ))}
            <text x="6"   y="7"  fontSize="10" fill="#888" opacity="0.7">✦</text>
            <text x="76"  y="28" fontSize="9"  fill="#888" opacity="0.6">✦</text>
            <text x="130" y="48" fontSize="8"  fill="#888" opacity="0.5">✦</text>
          </svg>
        </div>

        {/* whimsi burst badge — top right, bigger */}
        <div className="absolute" style={{ top: 5, right: 5 }}>
          <svg width="62" height="62" viewBox="0 0 50 50">
            <path d="M25,1 L28,10 L37,6 L34,15 L43,15 L37,22 L45,27 L37,32 L43,39 L34,39 L37,48 L28,44 L25,53 L22,44 L13,48 L16,39 L7,39 L13,32 L5,27 L13,22 L7,15 L16,15 L13,6 L22,10 Z"
              fill="#4ade80" />
            <text x="25" y="29" textAnchor="middle" fontSize="7" fontWeight="700" fill="black" fontFamily="sans-serif">whimsi</text>
          </svg>
        </div>

        {/* Postmark stamp — directly below the wavy lines */}
        <div className="absolute" style={{ top: 70, left: "50%", transform: "translateX(-50%)" }}>
          <svg width="80" height="80" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="37" fill="none" stroke="#a09080" strokeWidth="1.5" />
            <circle cx="40" cy="40" r="31" fill="none" stroke="#a09080" strokeWidth="0.8" strokeDasharray="4 2.5" />
            <text x="40" y="33" textAnchor="middle" fontSize="7" fill="#9c8878" fontFamily="monospace" letterSpacing="2">·  ·  ·  ·</text>
            <text x="40" y="44" textAnchor="middle" fontSize="11" fill="#9c8878" fontFamily="monospace">{dateStr}</text>
            <text x="40" y="55" textAnchor="middle" fontSize="7" fill="#9c8878" fontFamily="monospace" letterSpacing="2">·  ·  ·  ·</text>
          </svg>
        </div>

        {/* Bottom: 3 ruled lines — name (biggest), location, caption (smallest) */}
        <div className="absolute left-4 right-4 space-y-2" style={{ bottom: 16 }}>
          <div className="border-b pb-0.5" style={{ borderColor: "#c4b49a" }}>
            <p style={{ color: "#1a0f0a", fontFamily: "Georgia, serif", fontSize: 15, fontStyle: "italic", minHeight: 18 }}>
              {recipientName}
            </p>
          </div>
          <div className="border-b pb-0.5" style={{ borderColor: "#c4b49a" }}>
            <p style={{ color: "#5a4030", fontFamily: "Georgia, serif", fontSize: 11, fontStyle: "italic", minHeight: 15 }}>
              {location}
            </p>
          </div>
          <div className="border-b pb-0.5" style={{ borderColor: "#c4b49a" }}>
            <p style={{ color: "#7a6050", fontFamily: "Georgia, serif", fontSize: 9, fontStyle: "italic", minHeight: 13 }}>
              {caption}
            </p>
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
