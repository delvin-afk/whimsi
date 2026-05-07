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
    <div className="overflow-hidden flex w-full" style={{ height: 340, background: "#f5f0e8" }}>
      {/* Left: journey map — exactly half */}
      <div className="relative shrink-0" style={{ width: "50%" }}>
        <JourneyMapThumb journey={journey} mapboxToken={mapboxToken} />
      </div>

      {/* Right: postcard panel — exactly half */}
      <div className="relative" style={{ width: "50%", background: "#f5f0e8" }}>

        {/* Wavy lines + sparkles — upper-right area */}
        <div className="absolute" style={{ top: 14, left: 10, right: 52 }}>
          <svg width="100%" height="52" viewBox="0 0 130 52" preserveAspectRatio="none">
            {[0, 12, 24].map((y) => (
              <path
                key={y}
                d={`M0,${y + 8} C22,${y + 2} 44,${y + 14} 66,${y + 8} C88,${y + 2} 110,${y + 14} 130,${y + 8}`}
                fill="none"
                stroke="#8a8a8a"
                strokeWidth="1.2"
                opacity="0.55"
              />
            ))}
            {/* sparkles */}
            <text x="18" y="6" fontSize="8" fill="#aaa" opacity="0.7">✦</text>
            <text x="72" y="10" fontSize="7" fill="#aaa" opacity="0.6">✦</text>
            <text x="108" y="4" fontSize="6" fill="#aaa" opacity="0.5">✦</text>
            <text x="48" y="38" fontSize="6" fill="#aaa" opacity="0.5">✦</text>
          </svg>
        </div>

        {/* whimsi badge — top right (scalloped burst) */}
        <div className="absolute" style={{ top: 8, right: 8 }}>
          <svg width="52" height="52" viewBox="0 0 52 52">
            <path d="M26,2 L29,10 L37,7 L35,15 L43,16 L38,22 L45,27 L38,32 L43,38 L35,39 L37,47 L29,44 L26,52 L23,44 L15,47 L17,39 L9,38 L14,32 L7,27 L14,22 L9,16 L17,15 L15,7 L23,10 Z"
              fill="#4ade80" />
            <text x="26" y="28" textAnchor="middle" fontSize="7.5" fontWeight="700" fill="black" fontFamily="sans-serif">whimsi</text>
          </svg>
        </div>

        {/* Postmark stamp — center of right panel */}
        <div className="absolute" style={{ top: 80, left: "50%", transform: "translateX(-50%)" }}>
          <svg width="78" height="78" viewBox="0 0 78 78">
            <circle cx="39" cy="39" r="36" fill="none" stroke="#b0a090" strokeWidth="1.5" />
            <circle cx="39" cy="39" r="30" fill="none" stroke="#b0a090" strokeWidth="0.75" strokeDasharray="4 2.5" />
            <text x="39" y="33" textAnchor="middle" fontSize="7" fill="#9c8878" fontFamily="monospace" letterSpacing="3">·  ·  ·  ·</text>
            <text x="39" y="43" textAnchor="middle" fontSize="10" fill="#9c8878" fontFamily="monospace" letterSpacing="1">{dateStr}</text>
            <text x="39" y="53" textAnchor="middle" fontSize="7" fill="#9c8878" fontFamily="monospace" letterSpacing="3">·  ·  ·  ·</text>
          </svg>
        </div>

        {/* Bottom: name + ruled lines */}
        <div className="absolute left-4 right-4" style={{ bottom: 20 }}>
          {location && (
            <p className="mb-1.5" style={{ color: "#9c8468", fontFamily: "monospace", fontSize: 9, letterSpacing: "0.07em" }}>
              {location.toUpperCase()}
            </p>
          )}
          {caption && (
            <p className="mb-2 leading-snug" style={{ color: "#6b5740", fontFamily: "Georgia, serif", fontSize: 10 }}>
              {caption}
            </p>
          )}
          <p
            className="border-b pb-1 mb-3"
            style={{ color: "#1a0f0a", fontFamily: "Georgia, serif", fontSize: 18, fontStyle: "italic", borderColor: "#b0a090", minHeight: 24 }}
          >
            {recipientName}
          </p>
          <div className="space-y-3">
            {[0, 1].map((i) => (
              <div key={i} style={{ height: 1, background: "#c8b89a" }} />
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
        <div className="flex items-center justify-center" style={{ height: 340, background: "#1c1c1e" }}>
          <div className="w-8 h-8 rounded-full border-2 border-neutral-800 animate-spin" style={{ borderTopColor: "#4ade80" }} />
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
