"use client";

import { useEffect, useRef, useState } from "react";
import type { StickerPost } from "@/types";

interface Props {
  stickers: StickerPost[];
}

export default function MapView({ stickers }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  useEffect(() => {
    if (!containerRef.current || mapRef.current || !token) return;

    const FALLBACK: [number, number] = [-122.4783, 37.8199];

    // Request geolocation in parallel with map load
    const geoPromise = new Promise<[number, number]>((resolve) => {
      if (!navigator.geolocation) { resolve(FALLBACK); return; }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve([pos.coords.longitude, pos.coords.latitude]),
        () => resolve(FALLBACK),
        { timeout: 6000 }
      );
    });

    import("mapbox-gl").then(async ({ default: mapboxgl }) => {
      import("mapbox-gl/dist/mapbox-gl.css");

      if (!containerRef.current) return;

      mapboxgl.accessToken = token;

      // Start zoomed out on the globe
      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center: [0, 20],
        zoom: 1.5,
      });

      mapRef.current = map;

      map.addControl(new mapboxgl.NavigationControl(), "top-right");

      map.on("load", () => {
        // Add sticker markers
        const located = stickers.filter((s) => s.lat != null && s.lng != null);

        located.forEach((sticker) => {
          const el = document.createElement("div");
          el.style.cssText = `
            width: 72px; height: 72px;
            background-image: url(${sticker.image_url});
            background-size: contain;
            background-repeat: no-repeat;
            background-position: center;
            cursor: pointer;
            filter: drop-shadow(0 0 5px rgba(0,0,0,0.6)) drop-shadow(0 3px 10px rgba(0,0,0,0.4));
          `;

          const popup = new mapboxgl.Popup({ offset: 28, closeButton: false })
            .setHTML(`
              <div style="font-family:sans-serif;max-width:160px">
                <p style="font-weight:600;margin:0 0 2px">${sticker.username}</p>
                ${sticker.location_name ? `<p style="font-size:12px;color:#666;margin:0 0 4px">📍 ${sticker.location_name}</p>` : ""}
                ${sticker.caption ? `<p style="font-size:13px;margin:0">${sticker.caption}</p>` : ""}
              </div>
            `);

          new mapboxgl.Marker({ element: el })
            .setLngLat([sticker.lng!, sticker.lat!])
            .setPopup(popup)
            .addTo(map);
        });

        // Once geolocation resolves, fly in — this runs independently of marker setup
        // so fitBounds / other calls can't cancel the animation
        geoPromise.then((center) => {
          map.flyTo({
            center,
            zoom: 15,
            duration: 4500,
            curve: 1.8,
            essential: true,
          });
        });
      });
    });

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []); // only mount once

  async function searchCity(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!query.trim() || !token || !mapRef.current) return;
    setSearching(true);
    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query.trim())}.json?access_token=${token}&types=place,region,country&limit=1`
      );
      const json = await res.json();
      const feature = json.features?.[0];
      if (feature) {
        const [lng, lat] = feature.center;
        mapRef.current.flyTo({ center: [lng, lat], zoom: 10, duration: 1000 });
        setQuery("");
      }
    } finally {
      setSearching(false);
    }
  }

  function locateMe() {
    if (!mapRef.current) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        mapRef.current.flyTo({
          center: [pos.coords.longitude, pos.coords.latitude],
          zoom: 13,
          duration: 1000,
        });
        setLocating(false);
      },
      () => setLocating(false)
    );
  }

  if (!token) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-neutral-100 rounded-2xl">
        <div className="text-center p-6 text-neutral-500">
          <p className="font-semibold mb-1">Map unavailable</p>
          <p className="text-sm">Add <code className="bg-neutral-200 px-1 rounded">NEXT_PUBLIC_MAPBOX_TOKEN</code> to .env.local</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      {/* Search bar */}
      <form
        onSubmit={searchCity}
        className="absolute top-3 left-3 right-14 z-10 flex gap-2"
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search city or place…"
          className="flex-1 h-10 rounded-xl bg-white shadow-md border border-neutral-200 px-3 text-sm outline-none focus:ring-2 focus:ring-pink-300"
        />
        <button
          type="submit"
          disabled={searching || !query.trim()}
          className="h-10 px-3 rounded-xl bg-white shadow-md border border-neutral-200 text-sm font-medium text-neutral-700 disabled:opacity-50 hover:bg-neutral-50"
        >
          {searching ? "…" : "Go"}
        </button>
      </form>

      {/* Locate me button */}
      <button
        onClick={locateMe}
        disabled={locating}
        title="Center on my location"
        className="absolute bottom-10 right-3 z-10 w-10 h-10 rounded-xl bg-white shadow-md border border-neutral-200 flex items-center justify-center text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
      >
        {locating ? (
          <div className="w-4 h-4 rounded-full border-2 border-neutral-300 border-t-pink-500 animate-spin" />
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
          </svg>
        )}
      </button>

      <div ref={containerRef} className="w-full h-full rounded-2xl overflow-hidden" />
    </div>
  );
}
