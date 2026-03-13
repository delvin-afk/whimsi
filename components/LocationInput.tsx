"use client";

import { useEffect, useRef, useState } from "react";

interface Suggestion {
  shortName: string;
  fullName: string;
  lat: number;
  lng: number;
}

interface Props {
  value: string;
  onChange: (name: string, lat?: number, lng?: number) => void;
}

export default function LocationInput({ value, onChange }: Props) {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [locLoading, setLocLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Keep local query in sync when parent resets value
  useEffect(() => { setQuery(value); }, [value]);

  function handleInput(val: string) {
    setQuery(val);
    onChange(val); // let parent know text changed (no coords yet)
    clearTimeout(debounceRef.current);
    if (val.trim().length < 2) { setSuggestions([]); setOpen(false); return; }
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 350);
  }

  async function fetchSuggestions(q: string) {
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&addressdetails=1`,
        { headers: { "Accept-Language": "en" } }
      );
      const data: any[] = await res.json();
      const mapped = data.map((item) => {
        const a = item.address ?? {};
        const city = a.city || a.town || a.village || a.suburb || a.county || "";
        const state = a.state || "";
        const country = a.country || "";
        const parts = [city, state !== city ? state : "", country].filter(Boolean);
        const shortName = [...new Set(parts)].join(", ") || item.display_name;
        return {
          shortName,
          fullName: item.display_name,
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon),
        };
      });
      setSuggestions(mapped);
      setOpen(mapped.length > 0);
    } catch { /* silent */ }
    finally { setSearching(false); }
  }

  function select(s: Suggestion) {
    setQuery(s.shortName);
    onChange(s.shortName, s.lat, s.lng);
    setSuggestions([]);
    setOpen(false);
  }

  async function useCurrentLocation() {
    if (!navigator.geolocation) { alert("Geolocation not supported"); return; }
    setLocLoading(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords: { latitude: lat, longitude: lng } }) => {
        try {
          const r = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
            { headers: { "Accept-Language": "en" } }
          );
          const geo = await r.json();
          const a = geo.address ?? {};
          const city = a.city || a.town || a.village || a.county || "";
          const country = a.country || "";
          const name = [city, country].filter(Boolean).join(", ") || `${lat.toFixed(3)}, ${lng.toFixed(3)}`;
          setQuery(name);
          onChange(name, lat, lng);
        } catch {
          const name = `${lat.toFixed(3)}, ${lng.toFixed(3)}`;
          setQuery(name);
          onChange(name, lat, lng);
        }
        setLocLoading(false);
      },
      () => { alert("Could not get location"); setLocLoading(false); }
    );
  }

  return (
    <div className="relative">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            value={query}
            onChange={(e) => handleInput(e.target.value)}
            onFocus={() => suggestions.length > 0 && setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder="Search for a place…"
            className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300 pr-8"
          />
          {searching && (
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-neutral-200 border-t-pink-400 rounded-full animate-spin" />
          )}
        </div>
        <button
          type="button"
          onClick={useCurrentLocation}
          disabled={locLoading}
          className="px-3 py-2 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 disabled:opacity-50 text-base shrink-0"
          title="Use my location"
        >
          {locLoading ? "…" : "📍"}
        </button>
      </div>

      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 top-full left-0 right-12 mt-1 bg-white border border-neutral-200 rounded-2xl shadow-xl overflow-hidden">
          {suggestions.map((s, i) => (
            <li key={i} className="border-b border-neutral-50 last:border-0">
              <button
                type="button"
                onMouseDown={() => select(s)}
                className="w-full text-left px-4 py-3 hover:bg-neutral-50"
              >
                <p className="text-sm font-medium text-neutral-800">{s.shortName}</p>
                {s.shortName !== s.fullName && (
                  <p className="text-xs text-neutral-400 truncate mt-0.5">{s.fullName}</p>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
