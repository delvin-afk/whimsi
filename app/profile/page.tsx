"use client";

import { useEffect, useRef, useState } from "react";
import type { Journey } from "@/types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabase/browser";

const ACCENT = "#4ade80";
const MAP_LINE = "#a855f7";
const STICKER_SIZE = 44;

function avatarColor(username: string) {
  const colors = ["#f43f5e", "#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#06b6d4", "#ec4899"];
  let hash = 0;
  for (const c of username) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff;
  return colors[Math.abs(hash) % colors.length];
}

function travelDays(stickers: Journey["stickers"]): number | null {
  const times = stickers
    .filter((s) => s.photo_taken_at)
    .map((s) => new Date(s.photo_taken_at!).getTime())
    .sort((a, b) => a - b);
  if (times.length < 2) return null;
  return Math.max(1, Math.ceil((times[times.length - 1] - times[0]) / 86400000));
}

function journeyMatchesSearch(journey: Journey, query: string): boolean {
  if (!query.trim()) return true;
  const q = query.toLowerCase();
  if (journey.caption?.toLowerCase().includes(q)) return true;
  for (const s of journey.stickers) {
    if (s.caption?.toLowerCase().includes(q)) return true;
    if (s.location_name?.toLowerCase().includes(q)) return true;
  }
  return false;
}

// ── Mini map per card ─────────────────────────────────────────────────────────
function JourneyMiniMap({ journey, mapboxToken }: { journey: Journey; mapboxToken: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  const [inView, setInView] = useState(false);
  const located = journey.stickers.filter((s) => s.lat != null && s.lng != null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setInView(true); },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!inView || !containerRef.current || mapRef.current || !mapboxToken || located.length === 0) return;
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
          map.addLayer({ id: "r-glow", type: "line", source: "r", layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": MAP_LINE, "line-width": 10, "line-opacity": 0.2 } });
          map.addLayer({ id: "r-line", type: "line", source: "r", layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": MAP_LINE, "line-width": 4, "line-opacity": 0.9 } });
        }

        located.forEach((stop, i) => {
          const wrapper = document.createElement("div");
          wrapper.style.cssText = "display:flex;flex-direction:column;align-items:center;";
          const sWrap = document.createElement("div");
          sWrap.style.cssText = `position:relative;width:${STICKER_SIZE}px;height:${STICKER_SIZE}px;`;
          const img = document.createElement("img");
          img.src = stop.image_url;
          img.style.cssText = `width:${STICKER_SIZE}px;height:${STICKER_SIZE}px;object-fit:contain;filter:drop-shadow(0 2px 6px rgba(0,0,0,0.5));`;
          const badge = document.createElement("div");
          badge.style.cssText = `position:absolute;top:-5px;left:-5px;width:18px;height:18px;border-radius:50%;background:${MAP_LINE};color:white;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;font-family:sans-serif;border:1.5px solid white;`;
          badge.textContent = String(i + 1);
          sWrap.appendChild(img); sWrap.appendChild(badge);
          const pin = document.createElement("div");
          pin.style.cssText = `width:7px;height:7px;border-radius:50%;background:${MAP_LINE};border:2px solid white;margin-top:2px;flex-shrink:0;`;
          wrapper.appendChild(sWrap); wrapper.appendChild(pin);
          new mapboxgl.Marker({ element: wrapper, anchor: "bottom" }).setLngLat([stop.lng!, stop.lat!]).addTo(map);
        });

        if (located.length > 1) {
          const lngs = located.map((s) => s.lng!);
          const lats = located.map((s) => s.lat!);
          map.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], {
            padding: { top: STICKER_SIZE + 20, bottom: 20, left: 44, right: 44 }, duration: 0, maxZoom: 16,
          });
        }
      });
    });

    return () => { destroyed = true; mapRef.current?.remove(); mapRef.current = null; };
  }, [inView]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={containerRef} className="w-full h-full" />;
}

// ── Journey card ──────────────────────────────────────────────────────────────
function ProfileJourneyCard({
  journey, mapboxToken, userId, onDeleted,
}: {
  journey: Journey;
  mapboxToken: string;
  userId: string;
  onDeleted: (id: string) => void;
}) {
  const cardRouter = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [isPublic, setIsPublic] = useState(journey.is_public);

  async function handleDelete() {
    setDeleting(true);
    const res = await fetch(`/api/journeys/${journey.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (res.ok) onDeleted(journey.id);
    else setDeleting(false);
  }

  async function handleToggleVisibility() {
    setToggling(true);
    const next = !isPublic;
    const res = await fetch(`/api/journeys/${journey.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, is_public: next }),
    });
    if (res.ok) setIsPublic(next);
    setToggling(false);
    setSheetOpen(false);
  }

  return (
    <>
      <div className="rounded-2xl overflow-hidden" style={{ background: "#1c1c1e" }}>
        {/* Title row */}
        <div className="px-4 pt-4 pb-3 flex items-center gap-2">
          <div className="flex-1 min-w-0">
            {journey.caption
              ? <p className="text-white font-bold text-base truncate">{journey.caption}</p>
              : <p className="text-neutral-500 text-sm italic">No caption</p>
            }
          </div>
          {!isPublic && (
            <span className="shrink-0 text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "rgba(74,222,128,0.15)", color: ACCENT }}>
              Private
            </span>
          )}
          <button
            onClick={() => setSheetOpen(true)}
            className="w-8 h-8 flex items-center justify-center rounded-full text-neutral-500 hover:text-neutral-300 shrink-0"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
            </svg>
          </button>
        </div>

        {/* Map full width, square */}
        <div className="px-4 aspect-square">
          <Link href={`/map?journey=${journey.id}`} className="relative block w-full h-full rounded-lg overflow-hidden bg-neutral-800">
            <JourneyMiniMap journey={journey} mapboxToken={mapboxToken} />
            <div className="absolute inset-0" />
          </Link>
        </div>

        {/* Stats below map */}
        <div className="px-4 pt-3">
          <div className="flex rounded-lg overflow-hidden" style={{ background: "#2c2c2e" }}>
            <div className="flex-1 flex flex-col items-center justify-center py-3">
              <p className="text-xs text-neutral-500 mb-1 text-center leading-tight">Number of Entries</p>
              <p className="text-white font-bold text-2xl">{journey.stickers.length}</p>
            </div>
            <div className="w-px self-stretch my-3" style={{ background: "#3c3c3e" }} />
            <div className="flex-1 flex flex-col items-center justify-center py-3">
              <p className="text-xs text-neutral-500 mb-1 text-center leading-tight">Travel Time</p>
              {(() => { const d = travelDays(journey.stickers); return <p className="text-white font-bold text-2xl">{d != null ? `${d} day${d !== 1 ? "s" : ""}` : "—"}</p>; })()}
            </div>
          </div>
        </div>

        {/* Create Post Card */}
        <div className="px-4 py-4">
          <Link
            href={`/postcard/create?journey=${journey.id}`}
            className="w-full py-4 rounded-2xl flex items-center justify-center gap-2 text-black font-bold text-base"
            style={{ background: ACCENT }}
          >
            Create Post Card
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2"/>
              <path d="M7 15h3M7 11h5"/>
            </svg>
          </Link>
        </div>
      </div>

      {sheetOpen && (
        <>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={() => setSheetOpen(false)} />
          <div className="fixed left-0 right-0 z-50 flex justify-center" style={{ bottom: "calc(64px + env(safe-area-inset-bottom))" }}>
            <div className="w-full max-w-lg rounded-3xl shadow-2xl mx-3" style={{ background: "#1c1c1e" }}>
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-white/20" />
              </div>
              <div className="px-4 pt-2 pb-4 space-y-1">
                {/* Edit post */}
                <button
                  onClick={() => { setSheetOpen(false); cardRouter.push(`/capture?flow=journey&edit=${journey.id}`); }}
                  className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl hover:bg-white/10 text-left transition-colors"
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#a3a3a3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                  <div>
                    <p className="font-semibold text-sm text-white">Edit post</p>
                    <p className="text-xs text-neutral-500">Update captions, voice memos, and title</p>
                  </div>
                </button>

                {/* Visibility toggle */}
                <button
                  onClick={handleToggleVisibility}
                  disabled={toggling}
                  className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl hover:bg-white/10 text-left disabled:opacity-40 transition-colors"
                >
                  {isPublic ? (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#a3a3a3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                      <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                  ) : (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#a3a3a3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                      <circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10A15.3 15.3 0 0 1 8 12a15.3 15.3 0 0 1 4-10z"/>
                    </svg>
                  )}
                  <div>
                    <p className="font-semibold text-sm text-white">
                      {toggling ? "Updating…" : isPublic ? "Make private" : "Make public"}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {isPublic ? "Only you will see this journey" : "Share this journey with everyone"}
                    </p>
                  </div>
                </button>

                {/* Delete */}
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl hover:bg-white/10 text-left disabled:opacity-40 transition-colors"
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                  </svg>
                  <div>
                    <p className="font-semibold text-sm text-red-400">{deleting ? "Deleting…" : "Delete story"}</p>
                    <p className="text-xs text-neutral-500">Permanently remove this journey</p>
                  </div>
                </button>

                {/* Cancel */}
                <button
                  onClick={() => setSheetOpen(false)}
                  className="w-full py-3 mt-1 rounded-2xl border border-white/10 text-sm font-medium text-neutral-400 hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}

// ── Create card placeholder ───────────────────────────────────────────────────
function CreateCard() {
  return (
    <Link
      href="/capture?flow=journey"
      className="flex flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed py-10 transition-colors"
      style={{ borderColor: "rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)" }}
    >
      <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: ACCENT }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.5" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </div>
      <p className="text-white font-semibold text-sm">Create a Journey</p>
    </Link>
  );
}

// ── Profile page ──────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [userId, setUserId] = useState("");
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

  useEffect(() => {
    getSupabaseBrowser().auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push("/auth?redirect=/profile"); return; }

      const uid = data.user.id;
      setUserId(uid);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: profile } = await (getSupabaseBrowser() as any)
        .from("profiles")
        .select("username, avatar_url")
        .eq("id", uid)
        .single();
      if (profile?.username) setUsername(profile.username);
      if (profile?.avatar_url) setAvatarUrl(profile.avatar_url);

      // Fetch only this user's journeys
      const res = await fetch(`/api/journeys?user_id=${uid}`).then((r) => r.json()).catch(() => ({ journeys: [] }));
      // Filter to only own journeys (API returns public + own, we want own only)
      const own = (res.journeys ?? []).filter((j: Journey) => j.user_id === uid);
      setJourneys(own);
      setLoading(false);
    });
  }, [router]);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("userId", userId);
      const res = await fetch("/api/profile/avatar", { method: "POST", body: form });
      const json = await res.json();
      if (json.avatar_url) {
        setAvatarUrl(json.avatar_url);
        window.dispatchEvent(new CustomEvent("avatar-updated", { detail: { url: json.avatar_url } }));
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const filtered = journeys.filter((j) => journeyMatchesSearch(j, searchQuery));
  const locationsDocumented = new Set(
    journeys.flatMap((j) => j.stickers.map((s) => s.location_name).filter(Boolean))
  ).size;

  return (
    <main className="min-h-dvh pb-28" style={{ background: "#0f0f0f" }}>
      <div className="sticky top-0 z-10" style={{ background: "#0f0f0f", paddingTop: "env(safe-area-inset-top)" }}>
      <div className="mx-auto w-full max-w-xl px-4">

        {/* Header */}
        <div className="pt-14 pb-5 flex items-center gap-4">
          <div className="flex flex-col items-center gap-1 shrink-0">
            <button
              type="button"
              className="relative w-14 h-14 shrink-0"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="avatar" className="w-14 h-14 rounded-full object-cover" />
              ) : (
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-xl"
                  style={{ background: username ? avatarColor(username) : "#2c2c2e" }}
                >
                  {username ? username[0].toUpperCase() : ""}
                </div>
              )}
              {/* Camera badge */}
              <div
                className="absolute bottom-0 right-0 w-5 h-5 rounded-full flex items-center justify-center border-2"
                style={{ background: "#2c2c2e", borderColor: "#0f0f0f" }}
              >
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
              </div>
              {/* Upload spinner */}
              {uploading && (
                <div className="absolute inset-0 rounded-full flex items-center justify-center" style={{ background: "rgba(0,0,0,0.55)" }}>
                  <div className="h-5 w-5 rounded-full border-2 border-neutral-400 border-t-white animate-spin" />
                </div>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
            <p className="text-neutral-500 text-xs font-medium">Journey</p>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-black text-2xl leading-tight">{username || "…"}</p>
          </div>
        </div>

        {/* Journeys heading */}
        <p className="text-white font-bold text-lg mb-3">Journeys</p>

        {/* Search */}
        <div className="mb-6">
          <div className="flex items-center gap-2 px-4 py-3 rounded-2xl" style={{ background: "#1c1c1e" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8e8e93" strokeWidth="2.5" strokeLinecap="round" className="shrink-0">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search your journeys…"
              className="flex-1 bg-transparent text-white placeholder-[#8e8e93] text-sm outline-none"
              style={{ fontSize: 16 }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="text-[#8e8e93] hover:text-white shrink-0">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
      </div>

      <div className="mx-auto w-full max-w-xl px-4">
        {/* Stats banner */}
        {!loading && (
          <div className="rounded-2xl mb-5 flex divide-x" style={{ background: "#1c1c1e", borderColor: "#2c2c2e" }}>
            <div className="flex-1 px-4 py-4 text-center">
              <p className="text-xs text-neutral-500 mb-1">Number of Journeys</p>
              <p className="text-white font-bold text-2xl">{journeys.length}</p>
            </div>
            <div className="flex-1 px-4 py-4 text-center">
              <p className="text-xs text-neutral-500 mb-1">Locations Documented</p>
              <p className="text-white font-bold text-2xl">{locationsDocumented}</p>
            </div>
          </div>
        )}

        {/* Cards */}
        <div className="space-y-4">
          {loading && (
            <div className="flex justify-center py-20">
              <div className="h-8 w-8 rounded-full border-2 border-neutral-800 animate-spin" style={{ borderTopColor: ACCENT }} />
            </div>
          )}

          {!loading && journeys.length === 0 && (
            <div className="text-center py-16 space-y-3">
              <p className="text-4xl">🗺️</p>
              <p className="font-semibold text-white">No journeys yet</p>
              <p className="text-sm text-neutral-500">Create your first journey to see it here</p>
            </div>
          )}

          {!loading && journeys.length > 0 && filtered.length === 0 && (
            <div className="text-center py-16 space-y-2">
              <p className="text-3xl">🔍</p>
              <p className="font-semibold text-white">No results for &ldquo;{searchQuery}&rdquo;</p>
            </div>
          )}

          {!loading && filtered.map((journey) => (
            <ProfileJourneyCard
              key={journey.id}
              journey={journey}
              mapboxToken={mapboxToken}
              userId={userId}
              onDeleted={(id) => setJourneys((prev) => prev.filter((j) => j.id !== id))}
            />
          ))}

          {/* Create card always at the bottom */}
          {!loading && <CreateCard />}
        </div>
      </div>
    </main>
  );
}
