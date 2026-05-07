"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  onChange: (name: string, lat: number, lng: number) => void;
  defaultLat?: number;
  defaultLng?: number;
}

function shortName(placeName: string): string {
  const parts = placeName.split(", ");
  return parts.slice(0, 2).join(", ");
}

interface Suggestion {
  id: string;
  place_name: string;
  center: [number, number];
}

export default function LocationPicker({ onChange, defaultLat, defaultLng }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const tokenRef = useRef(process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [query, setQuery] = useState("");
  const [pinLabel, setPinLabel] = useState("");
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(true);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

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
        if (defaultLat !== undefined && defaultLng !== undefined) {
          map.flyTo({ center: [defaultLng, defaultLat], zoom: 15, duration: 800 });
          marker.setLngLat([defaultLng, defaultLat]);
          reverseGeocode(defaultLat, defaultLng);
          setLocating(false);
          return;
        }
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

  function handleQueryChange(value: string) {
    setQuery(value);
    setSuggestions([]);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim() || !tokenRef.current) {
      setShowSuggestions(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(value.trim())}.json?access_token=${tokenRef.current}&limit=5`
        );
        const json = await res.json();
        if (json.features?.length) {
          setSuggestions(json.features);
          setShowSuggestions(true);
        } else {
          setShowSuggestions(false);
        }
      } catch {
        setShowSuggestions(false);
      }
    }, 300);
  }

  function selectSuggestion(s: Suggestion) {
    const [lng, lat] = s.center;
    const name = shortName(s.place_name);
    setQuery(name);
    setPinLabel(name);
    setSuggestions([]);
    setShowSuggestions(false);
    mapRef.current?.flyTo({ center: [lng, lat], zoom: 14, duration: 800 });
    markerRef.current?.setLngLat([lng, lat]);
    onChange(name, lat, lng);
  }

  async function searchPlace(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim() || !tokenRef.current || !mapRef.current) return;
    setSearching(true);
    setShowSuggestions(false);
    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query.trim())}.json?access_token=${tokenRef.current}&limit=1`
      );
      const json = await res.json();
      const feature = json.features?.[0];
      if (feature) {
        const [lng, lat] = feature.center;
        mapRef.current.flyTo({ center: [lng, lat], zoom: 14, duration: 800 });
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
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Enter location…"
        className="w-full rounded-xl px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
        style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}
      />
    );
  }

  return (
    <div className="space-y-2">
      {/* Search bar with suggestions */}
      <form onSubmit={searchPlace} className="relative flex gap-2">
        <div className="relative flex-1">
          <input
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            placeholder="Search for a place…"
            className="w-full rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
            style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}
          />

          {/* Suggestions dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div
              className="absolute left-0 right-0 top-full mt-1 z-[80] rounded-xl overflow-hidden shadow-2xl"
              style={{ background: "#2a2a2e", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              {suggestions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onMouseDown={() => selectSuggestion(s)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left hover:bg-white/5 transition-colors"
                  style={{ color: "rgba(255,255,255,0.85)" }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0" style={{ color: "#22c55e" }}>
                    <path d="M12 21s-8-6.5-8-12a8 8 0 0116 0c0 5.5-8 12-8 12z"/><circle cx="12" cy="9" r="2.5"/>
                  </svg>
                  <span className="truncate">{s.place_name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={searching || !query.trim()}
          className="px-4 py-2 rounded-xl text-sm font-semibold text-black disabled:opacity-40 shrink-0"
          style={{ background: "#22c55e" }}
        >
          {searching ? "…" : "Go"}
        </button>
      </form>

      {/* Map */}
      <div className="relative w-full h-48 rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
        <div ref={containerRef} className="w-full h-full" />
        {locating && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.4)" }}>
            <div className="h-5 w-5 rounded-full border-2 border-white/20 border-t-white animate-spin" />
          </div>
        )}
      </div>

      {pinLabel ? (
        <p className="text-xs flex items-center gap-1" style={{ color: "rgba(255,255,255,0.5)" }}>
          <span>📍</span>
          <span>{pinLabel}</span>
        </p>
      ) : (
        <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>Drag the pin or click the map to set location</p>
      )}
    </div>
  );
}
