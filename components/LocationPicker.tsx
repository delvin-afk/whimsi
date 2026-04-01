"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  onChange: (name: string, lat: number, lng: number) => void;
}

function shortName(placeName: string): string {
  const parts = placeName.split(", ");
  return parts.slice(0, 2).join(", ");
}

export default function LocationPicker({ onChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const tokenRef = useRef(process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "");

  const [query, setQuery] = useState("");
  const [pinLabel, setPinLabel] = useState("");
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(true);

  async function reverseGeocode(lat: number, lng: number) {
    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${tokenRef.current}&types=place,locality,neighborhood,address&limit=1`
      );
      const json = await res.json();
      const feature = json.features?.[0];
      const name = feature ? shortName(feature.place_name) : `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      setPinLabel(name);
      setQuery(name);
      onChange(name, lat, lng);
    } catch {
      const name = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      setPinLabel(name);
      setQuery(name);
      onChange(name, lat, lng);
    }
  }

  useEffect(() => {
    if (!containerRef.current || mapRef.current || !tokenRef.current) return;

    import("mapbox-gl").then(({ default: mapboxgl }) => {
      import("mapbox-gl/dist/mapbox-gl.css");
      if (!containerRef.current) return;

      mapboxgl.accessToken = tokenRef.current;

      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center: [0, 20],
        zoom: 2,
        attributionControl: false,
      });

      mapRef.current = map;

      const marker = new mapboxgl.Marker({ draggable: true, color: "#ec4899" })
        .setLngLat([0, 20])
        .addTo(map);

      markerRef.current = marker;

      marker.on("dragend", () => {
        const { lng, lat } = marker.getLngLat();
        reverseGeocode(lat, lng);
      });

      map.on("click", (e: any) => {
        const { lng, lat } = e.lngLat;
        marker.setLngLat([lng, lat]);
        reverseGeocode(lat, lng);
      });

      map.on("load", () => {
        navigator.geolocation?.getCurrentPosition(
          ({ coords: { latitude: lat, longitude: lng } }) => {
            map.flyTo({ center: [lng, lat], zoom: 13, duration: 800 });
            marker.setLngLat([lng, lat]);
            reverseGeocode(lat, lng);
            setLocating(false);
          },
          () => setLocating(false)
        );
      });
    });

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function searchPlace(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim() || !tokenRef.current || !mapRef.current) return;
    setSearching(true);
    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query.trim())}.json?access_token=${tokenRef.current}&limit=1`
      );
      const json = await res.json();
      const feature = json.features?.[0];
      if (feature) {
        const [lng, lat] = feature.center;
        mapRef.current.flyTo({ center: [lng, lat], zoom: 13, duration: 800 });
        markerRef.current?.setLngLat([lng, lat]);
        const name = shortName(feature.place_name);
        setPinLabel(name);
        onChange(name, lat, lng);
      }
    } finally {
      setSearching(false);
    }
  }

  if (!tokenRef.current) {
    return (
      <input
        value={query}
        onChange={(e) => { setQuery(e.target.value); }}
        placeholder="Enter location…"
        className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
      />
    );
  }

  return (
    <div className="space-y-2">
      {/* Search bar */}
      <form onSubmit={searchPlace} className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for a place…"
          className="flex-1 rounded-xl border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
        />
        <button
          type="submit"
          disabled={searching || !query.trim()}
          className="px-3 py-2 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 text-sm font-medium disabled:opacity-50"
        >
          {searching ? "…" : "Go"}
        </button>
      </form>

      {/* Map */}
      <div className="relative w-full h-48 rounded-xl overflow-hidden border border-neutral-200">
        <div ref={containerRef} className="w-full h-full" />
        {locating && (
          <div className="absolute inset-0 flex items-center justify-center bg-neutral-50/80">
            <div className="h-5 w-5 rounded-full border-2 border-neutral-300 border-t-pink-500 animate-spin" />
          </div>
        )}
      </div>

      {pinLabel ? (
        <p className="text-xs text-neutral-500 flex items-center gap-1">
          <span>📍</span>
          <span>{pinLabel}</span>
        </p>
      ) : (
        <p className="text-xs text-neutral-400">Drag the pin or click the map to set location</p>
      )}
    </div>
  );
}
