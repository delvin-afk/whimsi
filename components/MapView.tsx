"use client";

import { useEffect, useRef } from "react";
import type { StickerPost } from "@/types";

interface Props {
  stickers: StickerPost[];
}

export default function MapView({ stickers }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) return;

    // Dynamically import mapbox-gl to avoid SSR issues
    import("mapbox-gl").then(({ default: mapboxgl }) => {
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

      // Add sticker markers after map loads
      map.on("load", () => {
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
            transition: transform 0.15s;
          `;
          el.onmouseenter = () => (el.style.transform = "scale(1.15)");
          el.onmouseleave = () => (el.style.transform = "scale(1)");

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

        // Fit map to markers if any
        if (located.length > 0) {
          const bounds = located.reduce(
            (b, s) => b.extend([s.lng!, s.lat!] as [number, number]),
            new mapboxgl.LngLatBounds(
              [located[0].lng!, located[0].lat!],
              [located[0].lng!, located[0].lat!]
            )
          );
          map.fitBounds(bounds, { padding: 80, maxZoom: 10, duration: 800 });
        }
      });
    });

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []); // only mount once

  // Re-add markers when stickers change (simple approach: rebuild map)
  // For prototype, a full re-mount on sticker change is acceptable

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

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

  return <div ref={containerRef} className="w-full h-full rounded-2xl overflow-hidden" />;
}
