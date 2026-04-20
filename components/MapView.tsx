"use client";

import { useEffect, useRef, useState } from "react";
import type { StickerPost, Journey } from "@/types";

// Journey line colours — cycles through these for multiple journeys
const JOURNEY_COLORS = ["#a855f7", "#3b82f6", "#f97316", "#ec4899", "#14b8a6"];

interface Props {
  stickers: StickerPost[];
  journeys?: Journey[];
}

export default function MapView({ stickers, journeys = [] }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  useEffect(() => {
    if (!containerRef.current || mapRef.current || !token) return;

    const FALLBACK: [number, number] = [-122.4783, 37.8199];

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

      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center: [0, 20],
        zoom: 1.5,
      });

      mapRef.current = map;
      map.addControl(new mapboxgl.NavigationControl(), "top-right");

      map.on("load", async () => {
        // ── Solo sticker markers ──────────────────────────────────────────────
        const located = stickers.filter((s) => s.lat != null && s.lng != null);
        located.forEach((sticker) => {
          // Wrapper: sticker image on top, tiny pin dot at the bottom.
          // anchor:'bottom' puts the dot tip exactly at the coordinate at every zoom.
          const wrapper = document.createElement("div");
          wrapper.style.cssText = `
            display: flex; flex-direction: column; align-items: center;
            cursor: pointer;
          `;
          const img = document.createElement("img");
          img.src = sticker.image_url;
          img.style.cssText = `
            width: 40px; height: 40px;
            object-fit: contain;
            display: block;
            filter: drop-shadow(0 0 4px rgba(0,0,0,0.5));
          `;
          const pin = document.createElement("div");
          pin.style.cssText = `
            width: 8px; height: 8px; border-radius: 50%;
            background: #f43f5e; border: 2px solid white;
            box-shadow: 0 1px 3px rgba(0,0,0,0.5);
            margin-top: 2px; flex-shrink: 0;
          `;
          wrapper.appendChild(img);
          wrapper.appendChild(pin);

          const popup = new mapboxgl.Popup({ offset: [0, -52], closeButton: false })
            .setHTML(`
              <div style="font-family:sans-serif;max-width:160px">
                <p style="font-weight:600;margin:0 0 2px">${sticker.username}</p>
                ${sticker.location_name ? `<p style="font-size:12px;color:#666;margin:0 0 4px">📍 ${sticker.location_name}</p>` : ""}
                ${sticker.caption ? `<p style="font-size:13px;margin:0">${sticker.caption}</p>` : ""}
              </div>
            `);
          new mapboxgl.Marker({ element: wrapper, anchor: "bottom" })
            .setLngLat([sticker.lng!, sticker.lat!])
            .setPopup(popup)
            .addTo(map);
        });

        // ── Journey lines + numbered markers ─────────────────────────────────
        const journeyPromises = journeys.map(async (journey, journeyIndex) => {
          const color = JOURNEY_COLORS[journeyIndex % JOURNEY_COLORS.length];
          const validStops = journey.stickers.filter((s) => s.lat != null && s.lng != null);
          if (validStops.length < 2) return;

          // Fetch road-following route between each consecutive pair of stops
          const straightCoords = validStops.map((s) => [s.lng!, s.lat!]);
          let routeCoordinates: number[][] = [];

          for (let i = 0; i < straightCoords.length - 1; i++) {
            const [lng1, lat1] = straightCoords[i];
            const [lng2, lat2] = straightCoords[i + 1];
            try {
              const res = await fetch(
                `https://api.mapbox.com/directions/v5/mapbox/driving/${lng1},${lat1};${lng2},${lat2}?geometries=geojson&overview=full&access_token=${token}`
              );
              const json = await res.json();
              const leg: number[][] | undefined = json.routes?.[0]?.geometry?.coordinates;
              if (leg && leg.length > 0) {
                // Avoid duplicate point at segment join
                if (routeCoordinates.length > 0) leg.shift();
                routeCoordinates = routeCoordinates.concat(leg);
              } else {
                // Fallback: straight line for this segment
                if (routeCoordinates.length === 0) routeCoordinates.push(straightCoords[i]);
                routeCoordinates.push(straightCoords[i + 1]);
              }
            } catch {
              // Fallback: straight line for this segment
              if (routeCoordinates.length === 0) routeCoordinates.push(straightCoords[i]);
              routeCoordinates.push(straightCoords[i + 1]);
            }
          }

          const coordinates = routeCoordinates.length >= 2 ? routeCoordinates : straightCoords;

          // Add GeoJSON line source + layer
          const sourceId = `journey-${journey.id}`;
          const layerId = `journey-line-${journey.id}`;

          map.addSource(sourceId, {
            type: "geojson",
            data: {
              type: "Feature",
              properties: {},
              geometry: { type: "LineString", coordinates },
            },
          });

          // Outer glow
          map.addLayer({
            id: `${layerId}-glow`,
            type: "line",
            source: sourceId,
            layout: { "line-join": "round", "line-cap": "round" },
            paint: {
              "line-color": color,
              "line-width": 8,
              "line-opacity": 0.25,
            },
          });

          // Main line
          map.addLayer({
            id: layerId,
            type: "line",
            source: sourceId,
            layout: { "line-join": "round", "line-cap": "round" },
            paint: {
              "line-color": color,
              "line-width": 3.5,
              "line-opacity": 0.85,
              "line-dasharray": [1, 0], // solid; change to [2, 2] for dashed
            },
          });

          // Numbered sticker markers along the route
          validStops.forEach((stop, stopIndex) => {
            // Wrapper: sticker+badge on top, journey-coloured pin dot at bottom.
            // anchor:'bottom' keeps the dot exactly at the coordinate at every zoom level.
            const wrapper = document.createElement("div");
            wrapper.style.cssText = `
              display: flex; flex-direction: column; align-items: center;
              cursor: pointer;
            `;

            const stickerWrap = document.createElement("div");
            stickerWrap.style.cssText = `position: relative; width: 40px; height: 40px;`;

            const img = document.createElement("img");
            img.src = stop.image_url;
            img.style.cssText = `
              width: 40px; height: 40px;
              object-fit: contain;
              display: block;
              filter: drop-shadow(0 0 3px rgba(0,0,0,0.45));
            `;
            stickerWrap.appendChild(img);

            const badge = document.createElement("div");
            badge.style.cssText = `
              position: absolute;
              top: -5px; left: -5px;
              width: 17px; height: 17px;
              border-radius: 50%;
              background: ${color};
              color: white;
              font-size: 10px;
              font-weight: 700;
              display: flex;
              align-items: center;
              justify-content: center;
              font-family: sans-serif;
              box-shadow: 0 1px 3px rgba(0,0,0,0.4);
              border: 1.5px solid white;
            `;
            badge.textContent = String(stopIndex + 1);
            stickerWrap.appendChild(badge);

            const pin = document.createElement("div");
            pin.style.cssText = `
              width: 8px; height: 8px; border-radius: 50%;
              background: ${color}; border: 2px solid white;
              box-shadow: 0 1px 3px rgba(0,0,0,0.45);
              margin-top: 2px; flex-shrink: 0;
            `;

            wrapper.appendChild(stickerWrap);
            wrapper.appendChild(pin);

            const takenAt = stop.photo_taken_at
              ? new Date(stop.photo_taken_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
              : null;

            const popup = new mapboxgl.Popup({ offset: [0, -54], closeButton: false })
              .setHTML(`
                <div style="font-family:sans-serif;max-width:180px">
                  <p style="font-weight:700;margin:0 0 2px;color:${color}">
                    Stop ${stopIndex + 1} · ${journey.caption ?? journey.username + "'s Journey"}
                  </p>
                  ${stop.caption ? `<p style="font-size:13px;margin:0 0 4px">${stop.caption}</p>` : ""}
                  ${stop.location_name ? `<p style="font-size:12px;color:#555;margin:0 0 3px">📍 ${stop.location_name}</p>` : ""}
                  ${takenAt ? `<p style="font-size:11px;color:#888;margin:0">🕐 ${takenAt}</p>` : ""}
                  ${!journey.is_public ? `<p style="font-size:11px;color:#a855f7;margin:4px 0 0">🔒 Private journey</p>` : ""}
                </div>
              `);

            new mapboxgl.Marker({ element: wrapper, anchor: "bottom" })
              .setLngLat([stop.lng!, stop.lat!])
              .setPopup(popup)
              .addTo(map);
          });

          // Start flag marker
          const startEl = document.createElement("div");
          startEl.style.cssText = `
            width: 28px; height: 28px;
            border-radius: 50%;
            background: ${color};
            border: 2.5px solid white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.35);
            display: flex; align-items: center; justify-content: center;
            font-size: 13px;
          `;
          startEl.textContent = "🚩";
          new mapboxgl.Marker({ element: startEl, anchor: "center" })
            .setLngLat(coordinates[0] as [number, number])
            .addTo(map);
        });

        await Promise.all(journeyPromises);

        // Fly to user location
        geoPromise.then((center) => {
          map.flyTo({ center, zoom: 15, duration: 4500, curve: 1.8, essential: true });
        });
      });
    });

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
        mapRef.current.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 13, duration: 1000 });
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
      <form onSubmit={searchCity} className="absolute top-3 left-3 right-14 z-10 flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search city or place…"
          className="flex-1 h-10 rounded-xl bg-white shadow-md border border-neutral-200 px-3 text-sm outline-none focus:ring-2 focus:ring-pink-300"
        />
        <button type="submit" disabled={searching || !query.trim()}
          className="h-10 px-3 rounded-xl bg-white shadow-md border border-neutral-200 text-sm font-medium text-neutral-700 disabled:opacity-50 hover:bg-neutral-50">
          {searching ? "…" : "Go"}
        </button>
      </form>

      {/* Locate me */}
      <button onClick={locateMe} disabled={locating} title="Center on my location"
        className="absolute bottom-10 right-3 z-10 w-10 h-10 rounded-xl bg-white shadow-md border border-neutral-200 flex items-center justify-center text-neutral-700 hover:bg-neutral-50 disabled:opacity-50">
        {locating
          ? <div className="w-4 h-4 rounded-full border-2 border-neutral-300 border-t-pink-500 animate-spin" />
          : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>
        }
      </button>

      {/* Journey legend */}
      {journeys.length > 0 && (
        <div className="absolute bottom-10 left-3 z-10 space-y-1">
          {journeys.slice(0, 5).map((journey, i) => (
            <div key={journey.id}
              className="flex items-center gap-1.5 bg-white/90 backdrop-blur-sm rounded-lg px-2 py-1 shadow-sm border border-neutral-100">
              <div className="w-3 h-3 rounded-full shrink-0" style={{ background: JOURNEY_COLORS[i % JOURNEY_COLORS.length] }} />
              <span className="text-xs font-medium text-neutral-700 max-w-30 truncate">
                {journey.caption ?? `${journey.username}'s Journey`}
              </span>
              {!journey.is_public && <span className="text-xs">🔒</span>}
            </div>
          ))}
        </div>
      )}

      <div ref={containerRef} className="w-full h-full rounded-2xl overflow-hidden" />
    </div>
  );
}
