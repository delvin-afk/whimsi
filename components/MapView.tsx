"use client";

import { useEffect, useRef, useState } from "react";
import type { StickerPost, Journey } from "@/types";

const JOURNEY_COLORS = ["#a855f7", "#3b82f6", "#f97316", "#ec4899", "#14b8a6"];

type SuggestionFeature = {
  id: string;
  text: string;
  place_name: string;
  center: [number, number];
  place_type: string[];
};

export type StickerClickPayload = {
  stop: StickerPost;
  stopIndex: number | null;
  journeyStops: StickerPost[] | null;
  journeyTitle: string | null;
  color: string;
};

interface Props {
  stickers: StickerPost[];
  journeys?: Journey[];
  initialJourneyId?: string | null;
  selectedJourneyId: string | null;
  onJourneySelect: (id: string | null) => void;
  onStickerClick: (payload: StickerClickPayload) => void;
}

export default function MapView({
  stickers,
  journeys = [],
  initialJourneyId,
  selectedJourneyId,
  onJourneySelect,
  onStickerClick,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<SuggestionFeature[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userLocationRef = useRef<[number, number] | null>(null);

  const clickedJourneyRef = useRef(false);
  const selectedMarkerElRef = useRef<HTMLElement | null>(null);
  const markerInfoRef = useRef<Map<string, { el: HTMLElement; coords: [number, number]; journeyId: string | null }>>(new Map());
  const selectedJourneyIdRef = useRef<string | null>(null);

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  useEffect(() => { selectedJourneyIdRef.current = selectedJourneyId; }, [selectedJourneyId]);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => { userLocationRef.current = [pos.coords.longitude, pos.coords.latitude]; },
      () => {}
    );
  }, []);

  function selectMarker(el: HTMLElement) {
    if (selectedMarkerElRef.current && selectedMarkerElRef.current !== el) {
      selectedMarkerElRef.current.style.transform = "";
      selectedMarkerElRef.current.style.zIndex = "";
    }
    selectedMarkerElRef.current = el;
    el.style.transform = "scale(1.3)";
    el.style.transition = "transform 0.2s";
    el.style.zIndex = "10";
  }

  function deselectMarker() {
    if (selectedMarkerElRef.current) {
      selectedMarkerElRef.current.style.transform = "";
      selectedMarkerElRef.current.style.zIndex = "";
      selectedMarkerElRef.current = null;
    }
  }

  function applyMarkerDisplay(el: HTMLElement) {
    const clustered = el.dataset.clustered === "1";
    const journeyId = el.dataset.journeyId ?? null;
    const journeyHidden =
      journeyId !== null &&
      selectedJourneyIdRef.current !== null &&
      selectedJourneyIdRef.current !== journeyId;
    el.style.display = clustered || journeyHidden ? "none" : "flex";
  }

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    journeys.forEach((journey) => {
      const active = selectedJourneyId === null || selectedJourneyId === journey.id;
      const lineId = `journey-line-${journey.id}`;
      const glowId = `${lineId}-glow`;

      if (map.getLayer(lineId)) {
        map.setPaintProperty(lineId, "line-opacity", active ? 0.9 : 0.08);
        map.setPaintProperty(lineId, "line-width", active ? 4.5 : 2);
      }
      if (map.getLayer(glowId)) {
        map.setPaintProperty(glowId, "line-opacity", active ? 0.25 : 0.04);
        map.setPaintProperty(glowId, "line-width", active ? 10 : 6);
      }
    });

    markerInfoRef.current.forEach(({ el }) => applyMarkerDisplay(el));

    containerRef.current?.querySelectorAll<HTMLElement>("[data-journey-id]").forEach((el) => {
      const active = selectedJourneyId === null || el.dataset.journeyId === selectedJourneyId;
      el.style.opacity = active ? "1" : "0.15";
      el.style.transition = "opacity 0.25s";
    });
  }, [selectedJourneyId, journeys]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!containerRef.current || mapRef.current || !token) return;

    const FALLBACK: [number, number] = [-122.2596, 37.8724];
    const geoPromise = new Promise<[number, number]>((resolve) => {
      if (!navigator.geolocation) { resolve(FALLBACK); return; }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve([pos.coords.longitude, pos.coords.latitude]),
        () => resolve(FALLBACK),
        { timeout: 6000 }
      );
    });

    let destroyed = false;

    import("mapbox-gl").then(async ({ default: mapboxgl }) => {
      import("mapbox-gl/dist/mapbox-gl.css");
      if (destroyed || !containerRef.current) return;

      mapboxgl.accessToken = token;
      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center: [0, 20],
        zoom: 1.5,
      });
      mapRef.current = map;
      map.addControl(new mapboxgl.NavigationControl(), "top-right");

      map.on("click", () => {
        if (clickedJourneyRef.current) { clickedJourneyRef.current = false; return; }
        onJourneySelect(null);
        deselectMarker();
      });

      map.on("load", async () => {
        if (destroyed) return;

        // ── Solo sticker markers ──────────────────────────────────────────────
        const located = stickers.filter((s) => s.lat != null && s.lng != null);
        located.forEach((sticker) => {
          const wrapper = document.createElement("div");
          wrapper.style.cssText = "display:flex;flex-direction:column;align-items:center;cursor:pointer;";
          const img = document.createElement("img");
          img.src = sticker.image_url;
          img.style.cssText = "width:52px;height:52px;object-fit:contain;display:block;filter:drop-shadow(0 0 4px rgba(0,0,0,0.5));";
          const pin = document.createElement("div");
          pin.style.cssText = "width:8px;height:8px;border-radius:50%;background:#f43f5e;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.5);margin-top:2px;flex-shrink:0;";
          wrapper.appendChild(img);
          wrapper.appendChild(pin);
          wrapper.addEventListener("click", (e) => {
            e.stopPropagation();
            clickedJourneyRef.current = true;
            selectMarker(wrapper);
            onStickerClick({ stop: sticker, color: "#f43f5e", journeyTitle: null, stopIndex: null, journeyStops: null });
            const mapH = containerRef.current?.clientHeight ?? 600;
            map.flyTo({
              center: [sticker.lng!, sticker.lat!],
              zoom: Math.max(map.getZoom(), 13),
              duration: 500,
              padding: { top: 60, bottom: Math.round(mapH * 0.58), left: 60, right: 60 },
            });
          });
          markerInfoRef.current.set(sticker.id, { el: wrapper, coords: [sticker.lng!, sticker.lat!], journeyId: null });
          new mapboxgl.Marker({ element: wrapper, anchor: "bottom" })
            .setLngLat([sticker.lng!, sticker.lat!])
            .addTo(map);
        });

        // ── Journey lines + markers ───────────────────────────────────────────
        const journeyPromises = journeys.map(async (journey, journeyIndex) => {
          const color = JOURNEY_COLORS[journeyIndex % JOURNEY_COLORS.length];
          const validStops = journey.stickers.filter((s) => s.lat != null && s.lng != null);
          if (validStops.length < 2) return;

          const straight = validStops.map((s) => [s.lng!, s.lat!]);
          let routeCoords: number[][] = [];
          for (let i = 0; i < straight.length - 1; i++) {
            const [lng1, lat1] = straight[i];
            const [lng2, lat2] = straight[i + 1];
            try {
              const res = await fetch(
                `https://api.mapbox.com/directions/v5/mapbox/driving/${lng1},${lat1};${lng2},${lat2}?geometries=geojson&overview=full&access_token=${token}`
              );
              const json = await res.json();
              const leg: number[][] | undefined = json.routes?.[0]?.geometry?.coordinates;
              if (leg?.length) {
                if (routeCoords.length > 0) leg.shift();
                routeCoords = routeCoords.concat(leg);
              } else {
                if (routeCoords.length === 0) routeCoords.push(straight[i]);
                routeCoords.push(straight[i + 1]);
              }
            } catch {
              if (routeCoords.length === 0) routeCoords.push(straight[i]);
              routeCoords.push(straight[i + 1]);
            }
          }

          const coordinates = routeCoords.length >= 2 ? routeCoords : straight;
          const sourceId = `journey-${journey.id}`;
          const lineId = `journey-line-${journey.id}`;

          map.addSource(sourceId, {
            type: "geojson",
            data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates } },
          });

          map.addLayer({ id: `${lineId}-glow`, type: "line", source: sourceId, layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": color, "line-width": 10, "line-opacity": 0.25 } });
          map.addLayer({ id: lineId, type: "line", source: sourceId, layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": color, "line-width": 3.5, "line-opacity": 0.85 } });
          map.addLayer({ id: `${lineId}-hit`, type: "line", source: sourceId, layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": color, "line-width": 24, "line-opacity": 0 } });

          map.on("click", `${lineId}-hit`, () => {
            clickedJourneyRef.current = true;
            onJourneySelect(selectedJourneyIdRef.current === journey.id ? null : journey.id);
          });
          map.on("mouseenter", `${lineId}-hit`, () => { map.getCanvas().style.cursor = "pointer"; });
          map.on("mouseleave", `${lineId}-hit`, () => { map.getCanvas().style.cursor = ""; });

          validStops.forEach((stop, stopIndex) => {
            const wrapper = document.createElement("div");
            wrapper.dataset.journeyId = journey.id;
            wrapper.style.cssText = "display:flex;flex-direction:column;align-items:center;cursor:pointer;transition:opacity 0.25s;";
            const stickerWrap = document.createElement("div");
            stickerWrap.style.cssText = "position:relative;width:56px;height:56px;";
            const img = document.createElement("img");
            img.src = stop.image_url;
            img.style.cssText = "width:56px;height:56px;object-fit:contain;display:block;filter:drop-shadow(0 0 3px rgba(0,0,0,0.45));";
            stickerWrap.appendChild(img);
            const pin = document.createElement("div");
            pin.style.cssText = `width:8px;height:8px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.45);margin-top:2px;flex-shrink:0;`;
            wrapper.appendChild(stickerWrap);
            wrapper.appendChild(pin);

            wrapper.addEventListener("click", (e) => {
              e.stopPropagation();
              clickedJourneyRef.current = true;
              selectMarker(wrapper);
              onJourneySelect(journey.id);
              onStickerClick({
                stop,
                color,
                journeyTitle: journey.caption ?? `${journey.username}'s Journey`,
                stopIndex: stopIndex + 1,
                journeyStops: validStops,
              });
              const mapH = containerRef.current?.clientHeight ?? 600;
              map.flyTo({
                center: [stop.lng!, stop.lat!],
                zoom: Math.max(map.getZoom(), 13),
                duration: 500,
                padding: { top: 60, bottom: Math.round(mapH * 0.58), left: 60, right: 60 },
              });
            });

            markerInfoRef.current.set(stop.id, { el: wrapper, coords: [stop.lng!, stop.lat!], journeyId: journey.id });
            new mapboxgl.Marker({ element: wrapper, anchor: "bottom" })
              .setLngLat([stop.lng!, stop.lat!])
              .addTo(map);
          });
        });

        await Promise.all(journeyPromises);
        if (destroyed) return;

        // ── Cluster source + layers ───────────────────────────────────────────
        const clusterFeatures = Array.from(markerInfoRef.current.entries()).map(([id, { coords }]) => ({
          type: "Feature" as const,
          properties: { stickerId: id },
          geometry: { type: "Point" as const, coordinates: coords },
        }));

        if (clusterFeatures.length > 0) {
          map.addSource("stickers-cluster", {
            type: "geojson",
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            data: { type: "FeatureCollection", features: clusterFeatures } as any,
            cluster: true,
            clusterRadius: 50,
            clusterMaxZoom: 14,
          });

          map.addLayer({
            id: "stickers-clusters",
            type: "circle",
            source: "stickers-cluster",
            filter: ["has", "point_count"],
            paint: {
              "circle-color": "#f43f5e",
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              "circle-radius": ["step", ["get", "point_count"], 18, 10, 22, 30, 26] as any,
              "circle-stroke-width": 2,
              "circle-stroke-color": "#ffffff",
              "circle-opacity": 0.9,
            },
          });

          map.addLayer({
            id: "stickers-cluster-count",
            type: "symbol",
            source: "stickers-cluster",
            filter: ["has", "point_count"],
            layout: {
              "text-field": "{point_count_abbreviated}",
              "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
              "text-size": 13,
            },
            paint: { "text-color": "#ffffff" },
          });

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          map.on("click", "stickers-clusters", (e: any) => {
            const features = map.queryRenderedFeatures(e.point, { layers: ["stickers-clusters"] });
            if (!features.length) return;
            const clusterId = features[0].properties?.cluster_id;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (map.getSource("stickers-cluster") as any).getClusterExpansionZoom(clusterId, (err: any, zoom: number) => {
              if (err) return;
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              map.easeTo({ center: (features[0].geometry as any).coordinates, zoom: zoom + 0.5 });
            });
          });
          map.on("mouseenter", "stickers-clusters", () => { map.getCanvas().style.cursor = "pointer"; });
          map.on("mouseleave", "stickers-clusters", () => { map.getCanvas().style.cursor = ""; });

          function updateClusterVisibility() {
            if (!map.isSourceLoaded("stickers-cluster")) return;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const unclustered: any[] = map.querySourceFeatures("stickers-cluster", {
              filter: ["!", ["has", "point_count"]],
            });
            const visibleIds = new Set<string>(
              unclustered.map((f) => f.properties?.stickerId as string).filter(Boolean)
            );
            const bounds = map.getBounds();
            markerInfoRef.current.forEach(({ el, coords }, stickerId) => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const inViewport = bounds.contains(coords as any);
              el.dataset.clustered = inViewport && !visibleIds.has(stickerId) ? "1" : "";
              applyMarkerDisplay(el);
            });
          }

          map.on("moveend", updateClusterVisibility);
          map.on("zoomend", updateClusterVisibility);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          map.on("sourcedata", (e: any) => {
            if (e.sourceId === "stickers-cluster" && e.isSourceLoaded) updateClusterVisibility();
          });
        }

        if (initialJourneyId) {
          const target = journeys.find((j) => j.id === initialJourneyId);
          if (target) {
            onJourneySelect(initialJourneyId);
            const locs = target.stickers.filter((s) => s.lat != null && s.lng != null);
            if (locs.length === 1) {
              map.flyTo({ center: [locs[0].lng!, locs[0].lat!], zoom: 14, duration: 1500 });
            } else if (locs.length >= 2) {
              const lngs = locs.map((s) => s.lng!);
              const lats = locs.map((s) => s.lat!);
              map.fitBounds(
                [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
                { padding: 80, duration: 1500, maxZoom: 15 }
              );
            }
          }
        } else {
          geoPromise.then((center) => {
            map.flyTo({ center, zoom: 15, duration: 4500, curve: 1.8, essential: true });
          });
        }
      });
    });

    return () => { destroyed = true; mapRef.current?.remove(); mapRef.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function onQueryChange(value: string) {
    setQuery(value);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (!value.trim() || !token) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    searchDebounceRef.current = setTimeout(async () => {
      try {
        const prox = userLocationRef.current
          ? `&proximity=${userLocationRef.current[0]},${userLocationRef.current[1]}`
          : "";
        const res = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(value.trim())}.json?access_token=${token}&types=poi,address,place,region,country&limit=5&language=en${prox}`
        );
        const json = await res.json();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const features: SuggestionFeature[] = (json.features ?? []).map((f: any) => ({
          id: f.id,
          text: f.text,
          place_name: f.place_name,
          center: f.center,
          place_type: f.place_type,
        }));
        setSuggestions(features);
        setShowSuggestions(features.length > 0);
      } catch {
        // ignore
      }
    }, 300);
  }

  function selectSuggestion(s: SuggestionFeature) {
    const [lng, lat] = s.center;
    const isPoi = s.place_type.includes("poi");
    const isAddress = s.place_type.includes("address");
    const isPlace = s.place_type.includes("place");
    const zoom = isPoi || isAddress ? 17 : isPlace ? 12 : 9;
    mapRef.current?.flyTo({ center: [lng, lat], zoom, duration: 1000 });
    setQuery(s.text);
    setSuggestions([]);
    setShowSuggestions(false);
  }

  async function searchCity(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!query.trim() || !token || !mapRef.current) return;
    if (suggestions.length > 0) { selectSuggestion(suggestions[0]); return; }
    setSearching(true);
    try {
      const prox = userLocationRef.current
        ? `&proximity=${userLocationRef.current[0]},${userLocationRef.current[1]}`
        : "";
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query.trim())}.json?access_token=${token}&types=poi,address,place,region,country&limit=1&language=en${prox}`
      );
      const json = await res.json();
      const feature = json.features?.[0];
      if (feature) {
        const [lng, lat] = feature.center;
        const isPoi = feature.place_type.includes("poi");
        const isAddress = feature.place_type.includes("address");
        const zoom = isPoi || isAddress ? 17 : feature.place_type.includes("place") ? 12 : 9;
        mapRef.current.flyTo({ center: [lng, lat], zoom, duration: 1000 });
        setQuery("");
        setSuggestions([]);
        setShowSuggestions(false);
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
      <div className="w-full h-full flex items-center justify-center bg-neutral-100">
        <div className="text-center p-6 text-neutral-500">
          <p className="font-semibold mb-1">Map unavailable</p>
          <p className="text-sm">
            Add <code className="bg-neutral-200 px-1 rounded">NEXT_PUBLIC_MAPBOX_TOKEN</code> to .env.local
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      {/* Search bar */}
      <div className="absolute top-3 left-3 right-14 z-10">
        <form onSubmit={searchCity} className="flex gap-2">
          <input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            placeholder="Search places, restaurants…"
            className="flex-1 h-10 rounded-xl px-3 text-sm outline-none text-white placeholder-neutral-500 focus:ring-2 focus:ring-purple-500"
            style={{ background: "#1c1c1e", border: "1px solid rgba(255,255,255,0.08)" }}
          />
          <button
            type="submit"
            disabled={searching || !query.trim()}
            className="h-10 px-3 rounded-xl text-sm font-medium text-white disabled:opacity-40"
            style={{ background: "#1c1c1e", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            {searching ? "…" : "Go"}
          </button>
        </form>

        {showSuggestions && suggestions.length > 0 && (
          <div className="mt-1 rounded-xl overflow-hidden shadow-xl" style={{ background: "#1c1c1e", border: "1px solid rgba(255,255,255,0.08)" }}>
            {suggestions.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onMouseDown={() => selectSuggestion(s)}
                className={`w-full flex flex-col px-3 py-2.5 text-left transition-colors ${i < suggestions.length - 1 ? "border-b" : ""}`}
                style={{ borderColor: "rgba(255,255,255,0.06)" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.07)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "")}
              >
                <span className="text-sm font-medium text-white truncate">{s.text}</span>
                <span className="text-xs text-neutral-500 truncate">{s.place_name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Locate me */}
      <button
        onClick={locateMe}
        disabled={locating}
        className="absolute top-3 right-3 z-10 w-10 h-10 rounded-xl flex items-center justify-center text-white disabled:opacity-40"
        style={{ background: "#1c1c1e", border: "1px solid rgba(255,255,255,0.08)" }}
      >
        {locating ? (
          <div className="w-4 h-4 rounded-full border-2 border-neutral-300 border-t-purple-500 animate-spin" />
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
          </svg>
        )}
      </button>

      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
