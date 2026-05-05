"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { fileToBase64 } from "@/lib/utils/image";
import dynamic from "next/dynamic";
const LocationPicker = dynamic(() => import("@/components/LocationPicker"), { ssr: false });
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import JourneyShareCardModal from "@/components/JourneyShareCardModal";
import AudioPlayer from "@/components/AudioPlayer";

// ── SpeechRecognition types ───────────────────────────────────────────────────
interface ISpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): { transcript: string };
  [index: number]: { transcript: string };
}
interface ISpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: { length: number; item(i: number): ISpeechRecognitionResult; [i: number]: ISpeechRecognitionResult };
}
interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((e: ISpeechRecognitionEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}
declare global {
  interface Window {
    SpeechRecognition: new () => ISpeechRecognition;
    webkitSpeechRecognition: new () => ISpeechRecognition;
  }
}

// ── Cut-out shapes ────────────────────────────────────────────────────────────
type CutoutShape = "circle" | "star" | "square" | "diamond";

type CustomizeResult =
  | { type: "original" }
  | { type: "cutout"; shape: CutoutShape; dataUrl: string }
  | { type: "ai"; dataUrl: string }
  | { type: "back" }
  | { type: "jump"; targetIndex: number }
  | { type: "jumpForward"; targetIndex: number; currentStickerDataUrl: string | null };

const CUTOUT_SHAPES: { id: CutoutShape; label: string }[] = [
  { id: "circle",  label: "Circle"  },
  { id: "star",    label: "Star"    },
  { id: "square",  label: "Square"  },
  { id: "diamond", label: "Diamond" },
];

function buildShapePath(
  ctx: CanvasRenderingContext2D,
  shape: CutoutShape,
  cx: number, cy: number, r: number,
  rough: boolean,
) {
  const n = (scale: number) => rough ? (Math.random() - 0.5) * scale : 0;
  ctx.beginPath();
  switch (shape) {
    case "circle": {
      const steps = 80;
      for (let i = 0; i <= steps; i++) {
        const a = (i / steps) * Math.PI * 2 - Math.PI / 2;
        const rr = r + n(r * 0.07);
        const x = cx + rr * Math.cos(a);
        const y = cy + rr * Math.sin(a);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      break;
    }
    case "star": {
      const pts = 12;
      const inner = r * 0.42;
      for (let i = 0; i < pts * 2; i++) {
        const a = (i / (pts * 2)) * Math.PI * 2 - Math.PI / 2;
        const rr = (i % 2 === 0 ? r : inner) + n(r * 0.06);
        const x = cx + rr * Math.cos(a);
        const y = cy + rr * Math.sin(a);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      break;
    }
    case "square": {
      if (rough) {
        const sides = 4;
        const corners: [number, number][] = [[-r,-r],[r,-r],[r,r],[-r,r]];
        const steps = 20;
        for (let s = 0; s < sides; s++) {
          const [x1,y1] = corners[s];
          const [x2,y2] = corners[(s+1)%sides];
          for (let j = 0; j <= steps; j++) {
            const t = j / steps;
            const x = cx + x1 + (x2-x1)*t + n(r * 0.05);
            const y = cy + y1 + (y2-y1)*t + n(r * 0.05);
            s===0 && j===0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
          }
        }
      } else {
        ctx.rect(cx-r, cy-r, r*2, r*2);
      }
      break;
    }
    case "diamond": {
      const tips: [number,number][] = [
        [cx,       cy-r+n(r*.05)],
        [cx+r+n(r*.05), cy      ],
        [cx,       cy+r+n(r*.05)],
        [cx-r+n(r*.05), cy      ],
      ];
      const steps = 15;
      for (let i = 0; i < 4; i++) {
        const [x1,y1] = tips[i];
        const [x2,y2] = tips[(i+1)%4];
        for (let j = 0; j <= steps; j++) {
          const t = j / steps;
          const x = x1 + (x2-x1)*t + n(r*.05);
          const y = y1 + (y2-y1)*t + n(r*.05);
          i===0 && j===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
        }
      }
      break;
    }
  }
  ctx.closePath();
}

function generateCutout(localUrl: string, shape: CutoutShape): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const SIZE = 500;
      const BORDER = 26;
      const canvas = document.createElement("canvas");
      canvas.width = SIZE; canvas.height = SIZE;
      const ctx = canvas.getContext("2d")!;
      ctx.clearRect(0, 0, SIZE, SIZE);
      const cx = SIZE / 2, cy = SIZE / 2;
      const outerR = SIZE / 2 - 8;
      const innerR = outerR - BORDER;
      // White rough border
      ctx.save();
      buildShapePath(ctx, shape, cx, cy, outerR, true);
      ctx.fillStyle = "white";
      ctx.fill();
      ctx.restore();
      // Image clipped to inner shape
      ctx.save();
      buildShapePath(ctx, shape, cx, cy, innerR, false);
      ctx.clip();
      const scale = Math.max(SIZE / img.width, SIZE / img.height);
      const w = img.width * scale, h = img.height * scale;
      ctx.drawImage(img, (SIZE-w)/2, (SIZE-h)/2, w, h);
      ctx.restore();
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = localUrl;
  });
}

function CutoutShapeIcon({ shape }: { shape: CutoutShape }) {
  const s = 48;
  const cx = s/2, cy = s/2, r = s/2 - 4;
  switch (shape) {
    case "circle":
      return <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}><circle cx={cx} cy={cy} r={r} fill="white"/></svg>;
    case "star": {
      const pts = 12, inner = r*.42;
      const d = Array.from({length: pts*2}, (_,i) => {
        const a = (i/(pts*2))*Math.PI*2 - Math.PI/2;
        const rr = i%2===0 ? r : inner;
        return `${i===0?"M":"L"}${cx+rr*Math.cos(a)} ${cy+rr*Math.sin(a)}`;
      }).join(" ")+"Z";
      return <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}><path d={d} fill="white"/></svg>;
    }
    case "square":
      return <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}><rect x={4} y={4} width={s-8} height={s-8} fill="white"/></svg>;
    case "diamond": {
      const d = `M${cx} ${4} L${s-4} ${cy} L${cx} ${s-4} L${4} ${cy}Z`;
      return <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}><path d={d} fill="white"/></svg>;
    }
  }
}

// ── Journey photo item ────────────────────────────────────────────────────────
type PhotoItem = {
  id: string;
  file: File;
  localUrl: string;
  base64: string;
  mimeType: string;
  stickerDataUrl: string | null;
  exifLat?: number;
  exifLng?: number;
  photoTakenAt?: string; // ISO string from EXIF DateTimeOriginal
  locationName: string;
  lat: number | null;
  lng: number | null;
  status: "pending" | "processing" | "done" | "error";
  errorMsg: string;
  showLocationPicker: boolean;
  caption: string;
  voiceBlob: Blob | null;
  voiceMimeType: string | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────
async function extractExif(file: File): Promise<{ lat?: number; lng?: number; takenAt?: string }> {
  try {
    const exifr = (await import("exifr")).default;
    const [gps, tags] = await Promise.all([
      exifr.gps(file).catch(() => null),
      exifr.parse(file, ["DateTimeOriginal"]).catch(() => null),
    ]);
    const takenAt = tags?.DateTimeOriginal instanceof Date
      ? tags.DateTimeOriginal.toISOString()
      : undefined;
    return {
      lat: gps?.latitude,
      lng: gps?.longitude,
      takenAt,
    };
  } catch {
    return {};
  }
}

async function reverseGeocode(lat: number, lng: number, token: string): Promise<string> {
  try {
    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${token}&types=place,locality,neighborhood,address&limit=1`
    );
    const json = await res.json();
    const name = json.features?.[0]?.place_name ?? "";
    const parts = name.split(", ");
    return parts.slice(0, 2).join(", ");
  } catch {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
}

function formatTimestamp(iso?: string) {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

// Convert a UTC ISO string to a value suitable for <input type="datetime-local">
// The input expects local time, not UTC, so we shift by the timezone offset.
function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

// ── Main component ────────────────────────────────────────────────────────────
// ── Journey done / success screen ────────────────────────────────────────────
const DONE_COLOR = "#a855f7";
const DONE_STICKER_SIZE = 60;

function JourneyDoneScreen({
  journeyPhotos, username, journeyCaption, savedJourneyId, mapboxToken, onViewMap, onReset,
}: {
  journeyPhotos: PhotoItem[];
  username: string;
  journeyCaption: string;
  savedJourneyId: string;
  mapboxToken: string;
  onViewMap: () => void;
  onReset: () => void;
}) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  const [showShareCard, setShowShareCard] = useState(false);
  const [makingPublic, setMakingPublic] = useState(false);

  const donePhotos = journeyPhotos.filter((p) => p.status === "done");
  const stickersWithLoc = donePhotos.filter((p) => p.lat != null && p.lng != null);

  const withTime = donePhotos.filter((p) => p.photoTakenAt);
  const times = withTime.map((p) => new Date(p.photoTakenAt!).getTime()).sort((a, b) => a - b);
  const travelDays = times.length >= 2
    ? Math.max(1, Math.ceil((times[times.length - 1] - times[0]) / 86400000))
    : null;
  const fmt = (ms: number) => new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  const dateRange = times.length >= 2 ? `${fmt(times[0])} – ${fmt(times[times.length - 1])}` : null;
  const locationSummary = donePhotos.find((p) => p.locationName)?.locationName ?? "";

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current || stickersWithLoc.length === 0 || !mapboxToken) return;

    import("mapbox-gl").then(({ default: mapboxgl }) => {
      import("mapbox-gl/dist/mapbox-gl.css");
      if (!mapContainerRef.current) return;
      mapboxgl.accessToken = mapboxToken;
      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center: [stickersWithLoc[0].lng!, stickersWithLoc[0].lat!],
        zoom: 13,
        interactive: false,
      });
      mapRef.current = map;

      map.on("load", async () => {
        // Route line — fetch driving directions, fall back to straight line
        if (stickersWithLoc.length >= 2) {
          const straight = stickersWithLoc.map((s) => [s.lng!, s.lat!]);
          let routeCoords: number[][] = [];
          for (let i = 0; i < straight.length - 1; i++) {
            const [lng1, lat1] = straight[i];
            const [lng2, lat2] = straight[i + 1];
            try {
              const res = await fetch(
                `https://api.mapbox.com/directions/v5/mapbox/driving/${lng1},${lat1};${lng2},${lat2}?geometries=geojson&overview=full&access_token=${mapboxToken}`
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
          const coords = routeCoords.length >= 2 ? routeCoords : straight;
          map.addSource("done-route", {
            type: "geojson",
            data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } },
          });
          map.addLayer({ id: "done-glow", type: "line", source: "done-route", layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": DONE_COLOR, "line-width": 12, "line-opacity": 0.2 } });
          map.addLayer({ id: "done-line", type: "line", source: "done-route", layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": DONE_COLOR, "line-width": 5, "line-opacity": 0.95 } });
        }

        // Sticker markers
        stickersWithLoc.forEach((stop, i) => {
          const wrapper = document.createElement("div");
          wrapper.style.cssText = "display:flex;flex-direction:column;align-items:center;";
          const stickerWrap = document.createElement("div");
          stickerWrap.style.cssText = `position:relative;width:${DONE_STICKER_SIZE}px;height:${DONE_STICKER_SIZE}px;`;
          const img = document.createElement("img");
          img.src = stop.stickerDataUrl ?? stop.localUrl;
          img.style.cssText = `width:${DONE_STICKER_SIZE}px;height:${DONE_STICKER_SIZE}px;object-fit:contain;filter:drop-shadow(0 2px 8px rgba(0,0,0,0.55));`;
          const badge = document.createElement("div");
          badge.style.cssText = `position:absolute;top:-6px;left:-6px;width:20px;height:20px;border-radius:50%;background:${DONE_COLOR};color:white;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;font-family:sans-serif;box-shadow:0 1px 4px rgba(0,0,0,0.4);border:2px solid white;`;
          badge.textContent = String(i + 1);
          stickerWrap.appendChild(img);
          stickerWrap.appendChild(badge);
          const pin = document.createElement("div");
          pin.style.cssText = `width:8px;height:8px;border-radius:50%;background:${DONE_COLOR};border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.45);margin-top:2px;flex-shrink:0;`;
          wrapper.appendChild(stickerWrap);
          wrapper.appendChild(pin);
          new mapboxgl.Marker({ element: wrapper, anchor: "bottom" })
            .setLngLat([stop.lng!, stop.lat!])
            .addTo(map);
        });

        // Fit to bounds — top needs room for sticker images (anchor bottom), sides minimal
        if (stickersWithLoc.length > 1) {
          const lngs = stickersWithLoc.map((s) => s.lng!);
          const lats = stickersWithLoc.map((s) => s.lat!);
          map.fitBounds(
            [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
            { padding: { top: DONE_STICKER_SIZE + 20, bottom: 24, left: 48, right: 48 }, duration: 0, maxZoom: 16 },
          );
        }
      });
    });

    return () => { mapRef.current?.remove(); mapRef.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function openShareCard() {
    if (!savedJourneyId) return;
    setMakingPublic(true);
    await fetch(`/api/journeys/${savedJourneyId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_public: true }),
    }).catch(() => {});
    setMakingPublic(false);
    setShowShareCard(true);
  }

  return (
    <div className="fixed inset-0 z-[80] flex flex-col" style={{ background: "#4ade80" }}>
      <div className="shrink-0 pt-14 pb-5 px-5 text-center">
        <p className="text-3xl font-black text-black">Story is created! 🤩</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="bg-neutral-900 rounded-3xl overflow-hidden shadow-xl">
          {/* User row */}
          <div className="px-4 py-3 flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-[#a855f7] flex items-center justify-center text-white font-bold text-base shrink-0">
              {username[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-white truncate">{username} shared a story</p>
              <p className="text-xs text-neutral-400 truncate">
                {dateRange}{locationSummary ? (dateRange ? ` · ${locationSummary}` : locationSummary) : ""}
              </p>
            </div>
          </div>

          {/* Journey title */}
          {journeyCaption ? (
            <div className="px-4 pb-2">
              <p className="font-semibold text-white text-sm">{journeyCaption}</p>
            </div>
          ) : null}

          {/* Interactive Mapbox GL map with sticker images */}
          <div className="h-72">
            {stickersWithLoc.length > 0 && mapboxToken ? (
              <div ref={mapContainerRef} className="w-full h-full" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-neutral-500 text-sm bg-neutral-800">
                No location data
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="flex divide-x divide-neutral-800">
            <div className="flex-1 px-4 py-4 text-center">
              <p className="text-xs text-neutral-500">Number of Entries</p>
              <p className="font-bold text-2xl text-white">{donePhotos.length}</p>
            </div>
            <div className="flex-1 px-4 py-4 text-center">
              <p className="text-xs text-neutral-500">Travel Time</p>
              <p className="font-bold text-2xl text-white">
                {travelDays != null ? `${travelDays} day${travelDays !== 1 ? "s" : ""}` : "—"}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="shrink-0 px-4 pt-2 space-y-3"
        style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}>
        <button onClick={onViewMap}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-white/25 text-black font-bold text-base active:scale-[0.98] transition">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/>
            <line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/>
          </svg>
          View on Map
        </button>
        <button onClick={openShareCard} disabled={makingPublic}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-black text-white font-bold text-base active:scale-[0.98] transition disabled:opacity-60">
          {makingPublic ? (
            <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>
            </svg>
          )}
          {makingPublic ? "Preparing…" : "Share Card"}
        </button>
        <button onClick={onReset} className="w-full py-3 text-black/60 text-sm font-medium">
          Create another
        </button>
      </div>

      {showShareCard && savedJourneyId && (
        <JourneyShareCardModal
          journeyId={savedJourneyId}
          journeyUrl={`${typeof window !== "undefined" ? window.location.origin : ""}/journey/${savedJourneyId}`}
          onClose={() => setShowShareCard(false)}
        />
      )}
    </div>
  );
}

function CapturePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const flow = searchParams.get("flow") ?? "sticker"; // "sticker" | "journey"
  const [username, setUsername] = useState("");
  const [userId, setUserId] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // mode
  const [mode, setMode] = useState<"single" | "journey">("single");

  // ── Single mode state ──────────────────────────────────────────────────────
  const [localImageUrl, setLocalImageUrl] = useState("");
  const [base64, setBase64] = useState("");
  const [mimeType, setMimeType] = useState("");
  const [stickerDataUrl, setStickerDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showShareForm, setShowShareForm] = useState(false);
  const [caption, setCaption] = useState("");
  const [locationName, setLocationName] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [exifLat, setExifLat] = useState<number | undefined>(undefined);
  const [exifLng, setExifLng] = useState<number | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [cuttingOut, setCuttingOut] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState("");
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const committedRef = useRef("");

  // Voice memo recorder
  const [isRecording, setIsRecording] = useState(false);
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null);
  const [voicePreviewUrl, setVoicePreviewUrl] = useState<string | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Journey mode state ─────────────────────────────────────────────────────
  const [journeyPhotos, setJourneyPhotos] = useState<PhotoItem[]>([]);
  const [journeyCaption, setJourneyCaption] = useState("");
  const [journeyStep, setJourneyStep] = useState<"details" | "processing" | "saving" | "done" | "rescue">("details");
  const [journeyProgress, setJourneyProgress] = useState({ current: 0, total: 0 });
  const [journeySaveError, setJourneySaveError] = useState("");
  const [savedJourneyId, setSavedJourneyId] = useState("");
  // Customize sticker modal: shown per photo during journey creation
  const [customizeModalPhoto, setCustomizeModalPhoto] = useState<PhotoItem | null>(null);
  const customizeResolverRef = useRef<((r: CustomizeResult) => void) | null>(null);
  const [customizeSelectedMode, setCustomizeSelectedMode] = useState<"original" | CutoutShape | "ai-done">("original");
  const [customizeCurrentDataUrl, setCustomizeCurrentDataUrl] = useState<string | null>(null);
  const [customizeShapePreviews, setCustomizeShapePreviews] = useState<Partial<Record<CutoutShape, string>>>({});
  const [customizeAiLoading, setCustomizeAiLoading] = useState(false);
  const [customizeAiError, setCustomizeAiError] = useState("");

  // Caption popup: shown mid-processing after each sticker is ready
  const [captionModalPhoto, setCaptionModalPhoto] = useState<PhotoItem | null>(null);
  const [captionModalIndex, setCaptionModalIndex] = useState(0); // 0-based index within valid photos
  const [captionModalTotal, setCaptionModalTotal] = useState(0);
  type CaptionResult = { caption: string; voiceBlob: Blob | null; voiceMimeType: string | null; photoTakenAt?: string; locationName?: string; lat?: number | null; lng?: number | null } | { type: "back" };
  const captionResolverRef = useRef<((result: CaptionResult) => void) | null>(null);
  const [journeyCaptionInput, setJourneyCaptionInput] = useState("");
  const [isJourneyListening, setIsJourneyListening] = useState(false);
  const [journeyInterimText, setJourneyInterimText] = useState("");
  const journeyCommittedRef = useRef("");
  const [journeyCaptionTimestamp, setJourneyCaptionTimestamp] = useState("");
  const [journeyCaptionLocationName, setJourneyCaptionLocationName] = useState("");
  const [journeyCaptionLat, setJourneyCaptionLat] = useState<number | null>(null);
  const [journeyCaptionLng, setJourneyCaptionLng] = useState<number | null>(null);

  // Journey caption voice memo recorder
  const [journeyCaptionIsRecording, setJourneyCaptionIsRecording] = useState(false);
  const [journeyCaptionVoiceBlob, setJourneyCaptionVoiceBlob] = useState<Blob | null>(null);
  const [journeyCaptionVoicePreviewUrl, setJourneyCaptionVoicePreviewUrl] = useState<string | null>(null);
  const [journeyCaptionRecordingSeconds, setJourneyCaptionRecordingSeconds] = useState(0);
  const journeyCaptionMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const journeyCaptionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

  // ── Camera-first state (mobile) ───────────────────────────────────────────
  type PendingPhoto = { file: File; takenAt: string; lat?: number; lng?: number };
  const [cameraStep, setCameraStep] = useState<"camera" | "preview" | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [cameraError, setCameraError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const capturedGpsRef = useRef<{ lat: number; lng: number } | null>(null);
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);

  // Detect mobile and launch camera
  useEffect(() => {
    const mobile = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
    if (mobile) setCameraStep("camera");
  }, []);

  // Start/restart camera stream; also fetch GPS when camera opens
  useEffect(() => {
    if (cameraStep !== "camera") {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      return;
    }
    setCameraError(false);
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => setCameraError(true));
    // Pre-fetch GPS so it's ready at capture time
    navigator.geolocation?.getCurrentPosition(
      (pos) => { capturedGpsRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude }; },
      () => { capturedGpsRef.current = null; },
      { timeout: 8000 }
    );
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [cameraStep, facingMode]);

  // Initialise caption modal timestamp + location when it opens
  useEffect(() => {
    if (!captionModalPhoto) return;
    const iso = captionModalPhoto.photoTakenAt;
    setJourneyCaptionTimestamp(iso ? toLocalInputValue(iso) : "");
    setJourneyCaptionLocationName(captionModalPhoto.locationName ?? "");
    setJourneyCaptionLat(captionModalPhoto.lat ?? null);
    setJourneyCaptionLng(captionModalPhoto.lng ?? null);
  }, [captionModalPhoto]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pre-generate shape preview thumbnails when customize modal opens
  useEffect(() => {
    if (!customizeModalPhoto) return;
    setCustomizeSelectedMode("original");
    setCustomizeCurrentDataUrl(null);
    setCustomizeShapePreviews({});
    setCustomizeAiLoading(false);
    setCustomizeAiError("");
    const url = customizeModalPhoto.localUrl;
    for (const { id } of CUTOUT_SHAPES) {
      generateCutout(url, id).then((dataUrl) => {
        setCustomizeShapePreviews((prev) => ({ ...prev, [id]: dataUrl }));
      }).catch(() => {});
    }
  }, [customizeModalPhoto]); // eslint-disable-line react-hooks/exhaustive-deps

  function flipCamera() {
    setFacingMode((f) => (f === "environment" ? "user" : "environment"));
  }

  function captureFrame() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")!.drawImage(video, 0, 0);
    const gps = capturedGpsRef.current;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `capture-${Date.now()}.jpg`, { type: "image/jpeg" });
      setPendingPhotos((prev) => [...prev, {
        file,
        takenAt: new Date().toISOString(),
        lat: gps?.lat,
        lng: gps?.lng,
      }]);
      setCameraStep("preview");
    }, "image/jpeg", 0.92);
  }

  function addAnotherPhoto() {
    setCameraStep("camera");
  }

  async function proceedFromPreview() {
    // If GPS wasn't ready at capture time, try one more time now (3s timeout)
    if (!capturedGpsRef.current && navigator.geolocation) {
      await new Promise<void>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => { capturedGpsRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude }; resolve(); },
          () => resolve(),
          { timeout: 3000, maximumAge: 30000 }
        );
      });
    }

    // Snapshot GPS before any async work
    const gpsNow = capturedGpsRef.current;

    // Merge fallback GPS into each pending photo that lacks it
    const photos = pendingPhotos.map((p) => ({
      ...p,
      lat: p.lat ?? gpsNow?.lat,
      lng: p.lng ?? gpsNow?.lng,
    }));

    // Build DataTransfer for the existing file-handling logic
    const dt = new DataTransfer();
    photos.forEach((p) => dt.items.add(p.file));
    await onFilesSelected(dt.files);

    // Inject captured GPS + timestamp since canvas photos have no EXIF
    setJourneyPhotos((prev) => prev.map((item, i) => {
      const meta = photos[i];
      if (!meta) return item;
      return {
        ...item,
        photoTakenAt: meta.takenAt ?? item.photoTakenAt,
        lat: meta.lat ?? item.lat,
        lng: meta.lng ?? item.lng,
      };
    }));
    photos.forEach((meta, i) => {
      if (meta.lat != null && meta.lng != null && mapboxToken) {
        reverseGeocode(meta.lat, meta.lng, mapboxToken).then((name) => {
          setJourneyPhotos((prev) => prev.map((item, idx) =>
            idx === i ? { ...item, locationName: name } : item
          ));
        });
      }
    });

    setCameraStep(null);
    setPendingPhotos([]);
  }

  function removePendingPhoto(index: number) {
    setPendingPhotos((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (next.length === 0) setCameraStep("camera");
      return next;
    });
  }

  useEffect(() => {
    const supabase = getSupabaseBrowser();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push("/auth?redirect=/capture"); return; }
      setUserId(data.user.id);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from("profiles")
        .select("username")
        .eq("id", data.user.id)
        .single()
        .then(({ data: profile }: { data: { username?: string } | null }) => {
          if (profile?.username) setUsername(profile.username);
        });
    });
  }, [router]);

  // ── File picker handler ───────────────────────────────────────────────────
  async function onFilesSelected(files: FileList | null) {
    if (!files || files.length === 0) return;

    // Both single and multi-photo go through journey mode
    setMode("journey");
    setJourneyStep("details");
    setJourneyCaption("");
    setJourneySaveError("");

    const items: PhotoItem[] = await Promise.all(
      Array.from(files).map(async (file, i) => {
        const [localUrl, base64, exif] = await Promise.all([
          Promise.resolve(URL.createObjectURL(file)),
          fileToBase64(file),
          extractExif(file),
        ]);

        let locationName = "";
        if (exif.lat && exif.lng && mapboxToken) {
          locationName = await reverseGeocode(exif.lat, exif.lng, mapboxToken);
        }

        return {
          id: `${file.name}-${i}`,
          file,
          localUrl,
          base64,
          mimeType: file.type,
          stickerDataUrl: null,
          exifLat: exif.lat,
          exifLng: exif.lng,
          photoTakenAt: exif.takenAt,
          locationName,
          lat: exif.lat ?? null,
          lng: exif.lng ?? null,
          status: "pending" as const,
          errorMsg: "",
          showLocationPicker: false,
          caption: "",
          voiceBlob: null,
          voiceMimeType: null,
        };
      })
    );

    items.sort((a, b) => {
      if (a.photoTakenAt && b.photoTakenAt) {
        return new Date(a.photoTakenAt).getTime() - new Date(b.photoTakenAt).getTime();
      }
      return 0;
    });

    setJourneyPhotos(items);
  }

  // ── Single mode functions ─────────────────────────────────────────────────
  async function extractSticker() {
    if (!base64) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/sticker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base64, mimeType }),
      });
      const json = await res.json();
      if (res.ok) setStickerDataUrl(json.sticker);
      else setError(json.error ?? "Couldn't create a sticker. Try a clearer image with a distinct subject.");
    } catch { setError("Sticker service unavailable. Please try again."); }
    finally { setLoading(false); }
  }

  async function applyCutout(shape: CutoutShape) {
    if (!localImageUrl) return;
    setCuttingOut(true);
    setError("");
    try {
      const dataUrl = await generateCutout(localImageUrl, shape);
      setStickerDataUrl(dataUrl);
    } catch {
      setError("Could not generate cut-out. Try a different photo.");
    } finally {
      setCuttingOut(false);
    }
  }

  function startListening() {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SR) { alert("Speech recognition isn't supported in this browser."); return; }
    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    committedRef.current = caption;
    recognition.onresult = (e: ISpeechRecognitionEvent) => {
      let interim = "";
      let newCommitted = committedRef.current;
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const text = e.results[i][0].transcript;
        if (e.results[i].isFinal) { newCommitted += (newCommitted ? " " : "") + text.trim(); committedRef.current = newCommitted; }
        else interim += text;
      }
      setCaption(newCommitted + (interim ? " " + interim : ""));
      setInterimText(interim);
    };
    recognition.onerror = () => stopListening();
    recognition.onend = () => { setIsListening(false); setInterimText(""); };
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }

  function stopListening() {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListening(false);
    setInterimText("");
    setCaption(committedRef.current);
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: recorder.mimeType });
        setVoiceBlob(blob);
        setVoicePreviewUrl(URL.createObjectURL(blob));
        if (timerRef.current) clearInterval(timerRef.current);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      timerRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
    } catch { alert("Microphone access denied."); }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }

  function clearVoiceMemo() {
    setVoiceBlob(null);
    setVoicePreviewUrl(null);
    setRecordingSeconds(0);
  }

  async function shareSingle() {
    if (!stickerDataUrl) return;
    const uname = username.trim();
    if (!uname) { alert("Enter a username first"); return; }
    if (!userId) { router.push("/auth"); return; }
    setSaving(true);
    try {
      let voiceBase64: string | null = null;
      let voiceMimeType: string | null = null;
      if (voiceBlob) {
        voiceBase64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result as string;
            resolve(dataUrl.split(",")[1]);
          };
          reader.readAsDataURL(voiceBlob!);
        });
        voiceMimeType = voiceBlob.type;
      }
      const res = await fetch("/api/sticker/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stickerBase64: stickerDataUrl, voiceBase64, voiceMimeType, caption: caption.trim() || null, locationName: locationName.trim() || null, lat, lng, userId, username: uname }),
      });
      const json = await res.json();
      if (res.ok) { setSaved(true); setShowShareForm(false); }
      else alert(json.error ?? "Failed to share");
    } catch { alert("Network error"); }
    finally { setSaving(false); }
  }

  function resetSingle() {
    setLocalImageUrl(""); setBase64(""); setMimeType("");
    setStickerDataUrl(null); setSaved(false); setShowShareForm(false);
    setCaption(""); setLocationName(""); setLat(null); setLng(null);
    setExifLat(undefined); setExifLng(undefined); setError("");
    clearVoiceMemo(); stopRecording();
    stopListening();
  }

  // ── Journey mode functions ────────────────────────────────────────────────
  function updatePhoto(id: string, patch: Partial<PhotoItem>) {
    setJourneyPhotos((prev) => prev.map((p) => p.id === id ? { ...p, ...patch } : p));
  }

  async function createJourney() {
    if (!userId || !username) { router.push("/auth"); return; }
    setJourneyStep("processing");
    setJourneyProgress({ current: 0, total: journeyPhotos.length });
    setJourneySaveError("");

    const results: PhotoItem[] = journeyPhotos.map((p) => ({ ...p }));

    // ── Phases loop (caption back can return to customize) ──────────────────
    let customizeStart = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      // ── Phase 1: Customize all stickers ──────────────────────────────────
      let i = customizeStart;
      while (i < results.length) {
        results[i] = { ...results[i], status: "processing" };
        updatePhoto(results[i].id, { status: "processing" });
        setJourneyProgress({ current: i + 1, total: results.length });

        const customizeResult = await new Promise<CustomizeResult>((resolve) => {
          customizeResolverRef.current = resolve;
          setCustomizeModalPhoto({ ...results[i] });
        });
        setCustomizeModalPhoto(null);
        customizeResolverRef.current = null;

        if (customizeResult.type === "back") {
          results[i] = { ...results[i], status: "pending", stickerDataUrl: null };
          updatePhoto(results[i].id, { status: "pending", stickerDataUrl: null });
          if (i > 0) {
            i--;
            results[i] = { ...results[i], status: "pending", stickerDataUrl: null };
            updatePhoto(results[i].id, { status: "pending", stickerDataUrl: null });
          }
          continue;
        }

        if (customizeResult.type === "jump") {
          for (let j = customizeResult.targetIndex; j <= i; j++) {
            results[j] = { ...results[j], status: "pending", stickerDataUrl: null };
            updatePhoto(results[j].id, { status: "pending", stickerDataUrl: null });
          }
          i = customizeResult.targetIndex;
          continue;
        }

        if (customizeResult.type === "jumpForward") {
          const curUrl = customizeResult.currentStickerDataUrl
            ?? `data:${results[i].mimeType};base64,${results[i].base64}`;
          results[i] = { ...results[i], stickerDataUrl: curUrl, status: "done" };
          updatePhoto(results[i].id, { stickerDataUrl: curUrl, status: "done" });
          for (let j = i + 1; j < customizeResult.targetIndex; j++) {
            const origUrl = `data:${results[j].mimeType};base64,${results[j].base64}`;
            results[j] = { ...results[j], stickerDataUrl: origUrl, status: "done" };
            updatePhoto(results[j].id, { stickerDataUrl: origUrl, status: "done" });
          }
          i = customizeResult.targetIndex;
          continue;
        }

        let stickerDataUrl: string | null = null;
        if (customizeResult.type === "original") {
          stickerDataUrl = `data:${results[i].mimeType};base64,${results[i].base64}`;
        } else {
          stickerDataUrl = customizeResult.dataUrl;
        }

        if (stickerDataUrl) {
          results[i] = { ...results[i], stickerDataUrl, status: "done" };
          updatePhoto(results[i].id, { stickerDataUrl, status: "done" });
        } else {
          results[i] = { ...results[i], status: "error", errorMsg: "Skipped" };
          updatePhoto(results[i].id, { status: "error", errorMsg: "Skipped" });
        }
        i++;
      }

      // ── Phase 2: Caption all stickers ──────────────────────────────────────
      const validForCaption = results.filter((r) => r.stickerDataUrl);
      let ci = 0;
      let backToCustomize = false;

      while (ci < validForCaption.length) {
        const photo = validForCaption[ci];
        setJourneyCaptionInput(photo.caption ?? "");
        journeyCommittedRef.current = photo.caption ?? "";
        setJourneyCaptionIsRecording(false);
        setJourneyCaptionVoiceBlob(null);
        setJourneyCaptionVoicePreviewUrl(null);
        setJourneyCaptionRecordingSeconds(0);
        setCaptionModalIndex(ci);
        setCaptionModalTotal(validForCaption.length);

        const captionResult = await new Promise<CaptionResult>((resolve) => {
          captionResolverRef.current = resolve;
          setCaptionModalPhoto({ ...photo });
        });
        setCaptionModalPhoto(null);
        captionResolverRef.current = null;

        if ("type" in captionResult && captionResult.type === "back") {
          if (ci > 0) {
            ci--;
          } else {
            // Back from first caption → return to last customize
            backToCustomize = true;
            const lastIdx = results.length - 1;
            results[lastIdx] = { ...results[lastIdx], status: "pending", stickerDataUrl: null };
            updatePhoto(results[lastIdx].id, { status: "pending", stickerDataUrl: null });
            customizeStart = lastIdx;
          }
          continue;
        }

        const cr = captionResult as Exclude<CaptionResult, { type: "back" }>;
        const resultIdx = results.findIndex((r) => r.id === photo.id);
        results[resultIdx] = {
          ...results[resultIdx],
          caption: cr.caption,
          voiceBlob: cr.voiceBlob,
          voiceMimeType: cr.voiceMimeType,
          photoTakenAt: cr.photoTakenAt ?? results[resultIdx].photoTakenAt,
          locationName: cr.locationName ?? results[resultIdx].locationName,
          lat: cr.lat ?? results[resultIdx].lat,
          lng: cr.lng ?? results[resultIdx].lng,
        };
        updatePhoto(results[resultIdx].id, { caption: cr.caption, locationName: results[resultIdx].locationName });
        ci++;
      }

      if (!backToCustomize) break; // both phases complete — exit outer loop
      // else loop back: re-run Phase 1 from customizeStart
    }

    // All done — save if we have at least 1
    const validCount = results.filter((p) => p.stickerDataUrl).length;
    if (validCount >= 1) {
      void saveJourney(results);
    } else {
      setJourneySaveError("No stickers could be created. Please try again.");
      setJourneyStep("details");
    }
  }

  // ── Customize sticker modal handlers ─────────────────────────────────────
  function onCustomizeSelectOriginal() {
    setCustomizeSelectedMode("original");
    setCustomizeCurrentDataUrl(null);
  }

  async function onCustomizeSelectShape(shape: CutoutShape) {
    setCustomizeSelectedMode(shape);
    if (customizeShapePreviews[shape]) {
      setCustomizeCurrentDataUrl(customizeShapePreviews[shape]!);
    } else if (customizeModalPhoto) {
      const dataUrl = await generateCutout(customizeModalPhoto.localUrl, shape);
      setCustomizeShapePreviews((prev) => ({ ...prev, [shape]: dataUrl }));
      setCustomizeCurrentDataUrl(dataUrl);
    }
  }

  async function onCustomizeUseAI() {
    if (!customizeModalPhoto) return;
    setCustomizeAiLoading(true);
    setCustomizeAiError("");
    try {
      const res = await fetch("/api/sticker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base64: customizeModalPhoto.base64, mimeType: customizeModalPhoto.mimeType }),
      });
      const json = await res.json();
      if (res.ok) {
        setCustomizeCurrentDataUrl(json.sticker);
        setCustomizeSelectedMode("ai-done");
      } else {
        setCustomizeAiError("AI couldn't isolate a subject. Try a shape instead.");
      }
    } catch {
      setCustomizeAiError("Sticker service unavailable.");
    } finally {
      setCustomizeAiLoading(false);
    }
  }

  function onCustomizeBack() {
    customizeResolverRef.current?.({ type: "back" });
  }

  function onCustomizeJump(targetIndex: number) {
    customizeResolverRef.current?.({ type: "jump", targetIndex });
  }

  function onCustomizeJumpForward(targetIndex: number) {
    if (!customizeResolverRef.current) return;
    const currentStickerDataUrl = customizeSelectedMode === "original" ? null : customizeCurrentDataUrl;
    customizeResolverRef.current({ type: "jumpForward", targetIndex, currentStickerDataUrl });
  }

  function onCustomizeConfirm() {
    if (!customizeResolverRef.current) return;
    if (customizeSelectedMode === "original") {
      customizeResolverRef.current({ type: "original" });
    } else if (customizeSelectedMode === "ai-done" && customizeCurrentDataUrl) {
      customizeResolverRef.current({ type: "ai", dataUrl: customizeCurrentDataUrl });
    } else if (customizeCurrentDataUrl) {
      customizeResolverRef.current({ type: "cutout", shape: customizeSelectedMode as CutoutShape, dataUrl: customizeCurrentDataUrl });
    }
  }

  // ── Journey caption voice helpers ─────────────────────────────────────────
  function startJourneyListening() {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SR) { alert("Speech recognition isn't supported in this browser."); return; }
    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    journeyCommittedRef.current = journeyCaptionInput;
    recognition.onresult = (e: ISpeechRecognitionEvent) => {
      let interim = "";
      let newCommitted = journeyCommittedRef.current;
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const text = e.results[i][0].transcript;
        if (e.results[i].isFinal) { newCommitted += (newCommitted ? " " : "") + text.trim(); journeyCommittedRef.current = newCommitted; }
        else interim += text;
      }
      setJourneyCaptionInput(newCommitted + (interim ? " " + interim : ""));
      setJourneyInterimText(interim);
    };
    recognition.onerror = () => stopJourneyListening();
    recognition.onend = () => { setIsJourneyListening(false); setJourneyInterimText(""); };
    recognitionRef.current = recognition;
    recognition.start();
    setIsJourneyListening(true);
  }

  function stopJourneyListening() {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsJourneyListening(false);
    setJourneyInterimText("");
    setJourneyCaptionInput(journeyCommittedRef.current);
  }

  async function startJourneyCaptionRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: recorder.mimeType });
        setJourneyCaptionVoiceBlob(blob);
        setJourneyCaptionVoicePreviewUrl(URL.createObjectURL(blob));
        if (journeyCaptionTimerRef.current) clearInterval(journeyCaptionTimerRef.current);
      };
      journeyCaptionMediaRecorderRef.current = recorder;
      recorder.start();
      setJourneyCaptionIsRecording(true);
      setJourneyCaptionRecordingSeconds(0);
      journeyCaptionTimerRef.current = setInterval(() => setJourneyCaptionRecordingSeconds((s) => s + 1), 1000);
    } catch { alert("Microphone access denied."); }
  }

  function stopJourneyCaptionRecording() {
    journeyCaptionMediaRecorderRef.current?.stop();
    setJourneyCaptionIsRecording(false);
    if (journeyCaptionTimerRef.current) clearInterval(journeyCaptionTimerRef.current);
  }

  function clearJourneyCaptionVoice() {
    setJourneyCaptionVoiceBlob(null);
    setJourneyCaptionVoicePreviewUrl(null);
    setJourneyCaptionRecordingSeconds(0);
  }

  function onCaptionBack() {
    stopJourneyListening();
    if (journeyCaptionIsRecording) stopJourneyCaptionRecording();
    setJourneyCaptionInput("");
    captionResolverRef.current?.({ type: "back" });
    clearJourneyCaptionVoice();
  }

  function onSubmitJourneyCaption(skip: boolean) {
    const value = skip ? "" : (journeyCommittedRef.current || journeyCaptionInput).trim();
    stopJourneyListening();
    if (journeyCaptionIsRecording) stopJourneyCaptionRecording();
    setJourneyCaptionInput("");
    captionResolverRef.current?.({
      caption: value,
      voiceBlob: skip ? null : journeyCaptionVoiceBlob,
      voiceMimeType: skip ? null : (journeyCaptionVoiceBlob?.type ?? null),
      photoTakenAt: journeyCaptionTimestamp ? new Date(journeyCaptionTimestamp).toISOString() : undefined,
      locationName: journeyCaptionLocationName.trim() || undefined,
      lat: journeyCaptionLat,
      lng: journeyCaptionLng,
    });
    clearJourneyCaptionVoice();
  }


  async function saveJourney(photos: PhotoItem[]) {
    const validPhotos = photos.filter((p) => p.stickerDataUrl);
    if (validPhotos.length < 1) {
      setJourneySaveError("No stickers to save.");
      return;
    }
    setJourneyStep("saving");
    setJourneySaveError("");
    try {
      const stickersPayload = await Promise.all(validPhotos.map(async (p, i) => {
        let voiceBase64: string | null = null;
        let voiceMimeType: string | null = null;
        if (p.voiceBlob) {
          voiceBase64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve((reader.result as string).split(",")[1]);
            reader.readAsDataURL(p.voiceBlob!);
          });
          voiceMimeType = p.voiceMimeType ?? null;
        }
        return {
          stickerBase64: p.stickerDataUrl,
          caption: p.caption || null,
          locationName: p.locationName || null,
          lat: p.lat,
          lng: p.lng,
          photoTakenAt: p.photoTakenAt ?? null,
          orderIndex: i,
          voiceBase64,
          voiceMimeType,
        };
      }));

      const res = await fetch("/api/journey/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          username,
          caption: journeyCaption.trim() || null,
          stickers: stickersPayload,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setSavedJourneyId(json.journey?.id ?? "");
        setJourneyStep("done");
      } else {
        setJourneySaveError(json.error ?? "Failed to save journey");
        setJourneyStep("rescue");
      }
    } catch {
      setJourneySaveError("Network error saving journey");
      setJourneyStep("rescue");
    }
  }

  function resetJourney() {
    setJourneyPhotos([]);
    setJourneyCaption("");
    setJourneyStep("details");
    setJourneyProgress({ current: 0, total: 0 });
    setJourneySaveError("");
    setMode("single");
  }

  // ── Render ────────────────────────────────────────────────────────────────

  // ── Camera screen ──────────────────────────────────────────────────────────
  if (cameraStep === "camera") {
    return (
      <div className="fixed inset-0 bg-black flex flex-col z-[60]">
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 pt-12 pb-4">
          <button
            onClick={() => { streamRef.current?.getTracks().forEach((t) => t.stop()); router.push("/feed"); }}
            className="flex items-center gap-1.5 text-white font-semibold text-base"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            Create a New Story
          </button>
          {username && (
            <div className="w-9 h-9 rounded-full bg-[#a855f7] flex items-center justify-center text-white font-bold text-sm">
              {username[0]?.toUpperCase()}
            </div>
          )}
        </div>

        {/* Camera preview */}
        <div className="flex-1 relative overflow-hidden">
          {cameraError ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-white/60 px-8 text-center">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
              <p className="text-sm">Camera not available.<br/>Use the gallery button to pick a photo.</p>
            </div>
          ) : (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}
        </div>

        {/* Controls — pb clears bottom nav (64px) + iOS safe area */}
        <div className="absolute bottom-0 left-0 right-0 pt-6 flex items-center justify-around px-12"
          style={{ paddingBottom: "calc(4rem + env(safe-area-inset-bottom))" }}>
          {/* Flip */}
          <button onClick={flipCamera}
            className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center active:scale-90 transition">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
              <path d="M1 4v6h6"/><path d="M23 20v-6h-6"/>
              <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
            </svg>
          </button>

          {/* Capture */}
          <button
            onClick={captureFrame}
            disabled={cameraError}
            className="w-20 h-20 rounded-full border-4 border-white bg-white/20 flex items-center justify-center active:scale-90 transition disabled:opacity-40"
          >
            <div className="w-14 h-14 rounded-full bg-white" />
          </button>

          {/* Gallery */}
          <label className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center active:scale-90 transition cursor-pointer">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={(e) => {
                if (!e.target.files?.length) return;
                const gps = capturedGpsRef.current;
                const files: PendingPhoto[] = Array.from(e.target.files).map((f) => ({
                  file: f,
                  takenAt: new Date().toISOString(),
                  lat: gps?.lat,
                  lng: gps?.lng,
                }));
                setPendingPhotos((prev) => [...prev, ...files]);
                setCameraStep("preview");
              }}
            />
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
          </label>
        </div>
      </div>
    );
  }

  // ── Preview screen ─────────────────────────────────────────────────────────
  if (cameraStep === "preview" && pendingPhotos.length > 0) {
    const mainPhoto = pendingPhotos[pendingPhotos.length - 1];
    const mainUrl = URL.createObjectURL(mainPhoto.file);

    return (
      <div className="fixed inset-0 bg-neutral-950 flex flex-col z-[60]">
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center px-4 pt-12 pb-4">
          <button
            onClick={() => setCameraStep("camera")}
            className="flex items-center gap-1.5 text-white font-semibold text-base"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            Create a New Story
          </button>
        </div>

        {/* Photo preview */}
        <div className="flex-1 flex items-center justify-center relative overflow-hidden pt-20">
          <img
            src={mainUrl}
            alt="Preview"
            className="max-w-full max-h-full object-contain rounded-2xl"
          />
          {/* Thumbnail strip if multiple */}
          {pendingPhotos.length > 0 && (
            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 px-4">
              {pendingPhotos.map((f, i) => {
                const url = URL.createObjectURL(f.file);
                return (
                  <div key={i} className="relative">
                    <img src={url} alt="" className="w-14 h-14 object-cover rounded-xl border-2 border-white/30" />
                    <button
                      onClick={() => removePendingPhoto(i)}
                      className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full text-white text-xs flex items-center justify-center font-bold"
                    >×</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Actions — pb clears bottom nav (64px) + iOS safe area */}
        <div className="shrink-0 px-5 pt-4 space-y-3"
          style={{ paddingBottom: "calc(4rem + env(safe-area-inset-bottom))" }}>
          <button
            onClick={addAnotherPhoto}
            className="w-full py-4 rounded-2xl bg-neutral-800 text-white font-bold text-base flex items-center justify-center gap-2"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
            Add Another Photo
          </button>
          <button
            onClick={proceedFromPreview}
            className="w-full py-4 rounded-2xl bg-[#4ade80] text-black font-bold text-base flex items-center justify-center gap-2"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            Make Sticker
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
    <main className="max-w-lg mx-auto p-5 space-y-4 pb-36">
      <h1 className="text-2xl font-bold pt-2" suppressHydrationWarning>
        {flow === "journey" ? "Create a Journey" : "Create a New Story"}
      </h1>

      {/* ── SINGLE MODE ── */}
      {mode === "single" && (
        <>
          {!stickerDataUrl && (
            <div className="space-y-3">
              <label>
                <input
                  ref={fileRef}
                  className="sr-only"
                  type="file"
                  accept="image/*"
                  multiple={flow !== "sticker"}
                  onChange={(e) => onFilesSelected(e.target.files)}
                />
                <div className="flex flex-col items-center justify-center gap-2 h-28 rounded-2xl border-2 border-dashed border-neutral-300 hover:bg-neutral-50 cursor-pointer text-neutral-500">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  <span className="font-medium text-sm">{localImageUrl ? "Change photo" : flow === "journey" ? "Choose photos" : "Choose photo"}</span>
                  <span className="text-xs text-neutral-400">{flow === "journey" ? "Select 2+ photos for your story" : "1 photo becomes a sticker"}</span>
                </div>
              </label>

              {localImageUrl && (
                <div className="rounded-2xl overflow-hidden border bg-white shadow-sm max-h-52 flex items-center justify-center">
                  <img src={localImageUrl} alt="Uploaded" className="max-h-52 w-full object-contain" />
                </div>
              )}

              {localImageUrl && (
                <div className="space-y-3">
                  <button onClick={() => { resetSingle(); fileRef.current?.click(); }}
                    className="w-full py-4 rounded-2xl bg-neutral-800 text-white font-bold text-base flex items-center justify-center gap-2">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <circle cx="12" cy="13" r="4" stroke="currentColor" strokeWidth="1.5"/>
                    </svg>
                    Retake Photo
                  </button>
                  <button onClick={extractSticker} disabled={loading}
                    className="w-full py-4 rounded-2xl bg-[#4ade80] text-black font-bold text-base disabled:opacity-50">
                    {loading ? "Creating sticker…" : "Make Sticker"}
                  </button>
                </div>
              )}

              {error && (
                <div className="space-y-3">
                  {/* Error message */}
                  <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 flex items-start gap-3">
                    <span className="text-red-500 text-lg leading-none mt-0.5">⚠</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-red-700 text-sm font-medium">Couldn&apos;t make a sticker</p>
                      <p className="text-red-500 text-sm mt-0.5">{error}</p>
                      <button onClick={() => { setError(""); fileRef.current?.click(); }}
                        className="mt-2 text-xs text-red-600 underline underline-offset-2">
                        Try a different photo
                      </button>
                    </div>
                  </div>

                  {/* Cut-out fallback */}
                  <div className="rounded-2xl bg-neutral-900 p-4 space-y-3">
                    <p className="text-white font-semibold text-sm">Choose Cut Out</p>
                    <p className="text-neutral-400 text-xs">Pick a shape to cut your photo into instead</p>
                    <div className="grid grid-cols-4 gap-3">
                      {CUTOUT_SHAPES.map(({ id, label }) => (
                        <button
                          key={id}
                          onClick={() => applyCutout(id)}
                          disabled={cuttingOut}
                          className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 active:scale-95 transition disabled:opacity-50"
                        >
                          <CutoutShapeIcon shape={id} />
                          <span className="text-white text-xs font-medium">{label}</span>
                        </button>
                      ))}
                    </div>
                    {cuttingOut && (
                      <p className="text-neutral-400 text-xs text-center animate-pulse">Generating cut-out…</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {stickerDataUrl && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-sm text-neutral-700">Your sticker</p>
                <button onClick={resetSingle} className="text-xs text-neutral-400 hover:text-neutral-700">Start over</button>
              </div>
              <div className="rounded-2xl bg-neutral-50 border border-neutral-100 flex items-center justify-center p-6">
                <img src={stickerDataUrl} alt="Sticker" className="max-h-64 object-contain" style={{ filter: "drop-shadow(0 4px 16px rgba(0,0,0,0.15))" }} />
              </div>
            </div>
          )}

          {stickerDataUrl && !saved && (
            <button onClick={() => setShowShareForm((v) => !v)}
              className="w-full py-4 rounded-2xl bg-[#4ade80] text-black font-bold text-base">
              Share to Map &amp; Feed
            </button>
          )}

          {saved && (
            <div className="rounded-2xl bg-green-50 border border-green-200 p-4 text-center space-y-2">
              <p className="text-green-700 font-medium">Shared! Your sticker is on the map.</p>
              <button onClick={resetSingle} className="text-sm text-green-600 underline">Make another sticker</button>
            </div>
          )}

          {/* Share form — fixed bottom sheet so it's always reachable on mobile */}
          {showShareForm && !saved && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 bg-black/40 z-40"
                onClick={() => setShowShareForm(false)}
              />
              {/* Sheet */}
              <div className="fixed bottom-0 inset-x-0 z-50 bg-white rounded-t-3xl shadow-2xl flex flex-col max-h-[85vh]">
                {/* Drag handle + header */}
                <div className="flex items-center justify-between px-5 pt-4 pb-3 shrink-0">
                  <p className="font-bold text-base">Share your sticker</p>
                  <button onClick={() => setShowShareForm(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-neutral-100 text-neutral-500">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                  </button>
                </div>

                {/* Scrollable content */}
                <div className="overflow-y-auto flex-1 px-5 pb-10 space-y-4">
                  {/* Caption */}
                  <div>
                    <label className="text-xs text-neutral-500 font-medium uppercase tracking-wide">Caption</label>
                    <div className="mt-1 relative">
                      <textarea value={caption}
                        onChange={(e) => { committedRef.current = e.target.value; setCaption(e.target.value); }}
                        placeholder="Write something…" rows={3}
                        className={`w-full rounded-xl border px-3 py-2 pr-11 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#4ade80] transition-colors ${isListening ? "border-red-400 bg-red-50" : "border-neutral-200"}`}
                      />
                      <button type="button" onClick={isListening ? stopListening : startListening}
                        className={`absolute right-2 bottom-2 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${isListening ? "bg-red-500 text-white" : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"}`}>
                        {isListening
                          ? <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><rect x="2" y="2" width="8" height="8" rx="1"/></svg>
                          : <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="9" y="2" width="6" height="12" rx="3" stroke="currentColor" strokeWidth="1.5"/><path d="M5 10a7 7 0 0 0 14 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M12 19v3M9 22h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                        }
                      </button>
                    </div>
                    {isListening && (
                      <p className="mt-1.5 flex items-center gap-1.5 text-xs text-red-500">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        Listening{interimText ? `… "${interimText}"` : "…"}
                      </p>
                    )}
                  </div>

                  {/* and/or */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-neutral-200" />
                    <span className="text-xs text-neutral-400 font-medium">and/or</span>
                    <div className="flex-1 h-px bg-neutral-200" />
                  </div>

                  {/* Record Memo */}
                  <div>
                    <label className="text-xs text-neutral-500 font-medium uppercase tracking-wide">Record Memo</label>
                    <div className="mt-2">
                      {!voicePreviewUrl && !isRecording && (
                        <button type="button" onClick={startRecording}
                          className="w-full flex items-center gap-3 py-3 px-4 rounded-2xl border border-neutral-200 bg-neutral-50 hover:bg-neutral-100 transition-colors">
                          <span className="w-8 h-8 rounded-full bg-[#4ade80] flex items-center justify-center shrink-0">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                              <rect x="9" y="2" width="6" height="12" rx="3" stroke="black" strokeWidth="1.5"/>
                              <path d="M5 10a7 7 0 0 0 14 0" stroke="black" strokeWidth="1.5" strokeLinecap="round"/>
                              <path d="M12 19v3M9 22h6" stroke="black" strokeWidth="1.5" strokeLinecap="round"/>
                            </svg>
                          </span>
                          <span className="text-sm text-neutral-500">Tap to share the story with your voice</span>
                        </button>
                      )}
                      {isRecording && (
                        <div className="flex items-center gap-3 py-3 px-4 rounded-2xl border border-[#4ade80] bg-green-50">
                          <span className="w-3 h-3 rounded-full bg-[#4ade80] animate-pulse shrink-0" />
                          <span className="flex-1 text-sm text-neutral-600 font-mono">
                            {String(Math.floor(recordingSeconds / 60)).padStart(2, "0")}:{String(recordingSeconds % 60).padStart(2, "0")}
                          </span>
                          <button type="button" onClick={stopRecording}
                            className="px-3 py-1.5 rounded-xl bg-neutral-800 text-white text-xs font-bold">Stop</button>
                        </div>
                      )}
                      {voicePreviewUrl && !isRecording && (
                        <div className="space-y-2">
                          <AudioPlayer src={voicePreviewUrl} />
                          <button type="button" onClick={clearVoiceMemo}
                            className="text-xs text-neutral-400 hover:text-red-500 underline underline-offset-2">
                            Remove &amp; re-record
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Location */}
                  <div>
                    <label className="text-xs text-neutral-500 font-medium uppercase tracking-wide">Location</label>
                    <div className="mt-2">
                      <LocationPicker defaultLat={exifLat} defaultLng={exifLng}
                        onChange={(name, newLat, newLng) => { setLocationName(name); setLat(newLat); setLng(newLng); }} />
                    </div>
                  </div>

                  <button onClick={shareSingle} disabled={saving}
                    className="w-full py-4 rounded-2xl bg-[#4ade80] text-black font-bold disabled:opacity-50">
                    {saving ? "Sharing…" : "Share"}
                  </button>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ── JOURNEY MODE ── */}
      {mode === "journey" && (
        <>
          {/* Hidden file input */}
          <input
            ref={fileRef}
            className="sr-only"
            type="file"
            accept="image/*"
            multiple={flow !== "sticker"}
            onChange={(e) => onFilesSelected(e.target.files)}
          />

          {journeyStep === "details" && (
            <div className="space-y-4">
              {/* Journey header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-neutral-600">{journeyPhotos.length} {journeyPhotos.length === 1 ? "photo" : "photos"}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">{journeyPhotos.length === 1 ? "Story" : "Journey"}</span>
                </div>
                <button onClick={resetJourney} className="text-xs text-neutral-400 hover:text-neutral-700">Start over</button>
              </div>

              {/* Caption */}
              <div>
                <label className="text-xs text-neutral-500 font-medium uppercase tracking-wide">{journeyPhotos.length === 1 ? "Story Caption" : "Journey Title / Caption"}</label>
                <input
                  value={journeyCaption}
                  onChange={(e) => setJourneyCaption(e.target.value)}
                  placeholder={journeyPhotos.length === 1 ? "e.g. A day in the city" : "e.g. Weekend in Tokyo"}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4ade80]"
                />
              </div>

              {/* Photo list */}
              <div className="space-y-3">
                {journeyPhotos.map((photo, index) => (
                  <div key={photo.id} className="rounded-2xl border border-neutral-200 bg-white overflow-hidden shadow-sm">
                    <div className="flex gap-3 p-3">
                      {/* Order badge + thumbnail */}
                      <div className="relative shrink-0">
                        <img src={photo.localUrl} alt="" className="w-20 h-20 object-cover rounded-xl" />
                        <span className="absolute -top-1.5 -left-1.5 w-6 h-6 rounded-full bg-purple-600 text-white text-xs font-bold flex items-center justify-center shadow">
                          {index + 1}
                        </span>
                      </div>

                      {/* Details */}
                      <div className="flex-1 min-w-0 space-y-1.5">
                        {photo.photoTakenAt ? (
                          <p className="text-xs text-neutral-400 flex items-center gap-1">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                            {formatTimestamp(photo.photoTakenAt)}
                          </p>
                        ) : (
                          <p className="text-xs text-neutral-300">No timestamp</p>
                        )}

                        {/* Location */}
                        {!photo.showLocationPicker ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs">📍</span>
                            <span className="text-xs text-neutral-600 truncate flex-1">
                              {photo.locationName || <span className="text-neutral-300">No location detected</span>}
                            </span>
                            <button
                              onClick={() => updatePhoto(photo.id, { showLocationPicker: true })}
                              className="text-xs text-purple-600 underline underline-offset-2 shrink-0"
                            >
                              {photo.locationName ? "Edit" : "Set"}
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <LocationPicker
                              defaultLat={photo.exifLat}
                              defaultLng={photo.exifLng}
                              onChange={(name, newLat, newLng) =>
                                updatePhoto(photo.id, { locationName: name, lat: newLat, lng: newLng })
                              }
                            />
                            <button
                              onClick={() => updatePhoto(photo.id, { showLocationPicker: false })}
                              className="text-xs text-neutral-500 underline underline-offset-2"
                            >
                              Done
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {journeySaveError && (
                <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                  {journeySaveError}
                </div>
              )}

              <button
                onClick={createJourney}
                className="w-full py-4 rounded-2xl bg-[#4ade80] text-black font-bold text-base"
              >
                {journeyPhotos.length === 1 ? "Create Story" : `Create Journey (${journeyPhotos.length} stickers)`}
              </button>
            </div>
          )}

          {/* Processing */}
          {journeyStep === "processing" && (
            <div className="space-y-6 py-8 text-center">
              <div className="space-y-2">
                <p className="font-semibold text-lg">{journeyPhotos.length === 1 ? "Creating your story…" : "Creating your journey…"}</p>
                <p className="text-sm text-neutral-500">
                  Processing photo {journeyProgress.current} of {journeyProgress.total}
                </p>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-neutral-100 rounded-full h-2.5 overflow-hidden">
                <div
                  className="h-2.5 rounded-full bg-[#4ade80] transition-all duration-500"
                  style={{ width: `${(journeyProgress.current / journeyProgress.total) * 100}%` }}
                />
              </div>

              {/* Thumbnails with status */}
              <div className="flex gap-2 justify-center flex-wrap">
                {journeyPhotos.map((photo, index) => (
                  <div key={photo.id} className="relative w-14 h-14 rounded-xl overflow-hidden border-2"
                    style={{ borderColor: photo.status === "done" ? "#4ade80" : photo.status === "error" ? "#f87171" : photo.status === "processing" ? "#a855f7" : "#e5e7eb" }}>
                    <img src={photo.localUrl} alt="" className="w-full h-full object-cover" />
                    <span className="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-purple-600 text-white text-xs font-bold flex items-center justify-center">
                      {index + 1}
                    </span>
                    {photo.status === "done" && (
                      <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><path d="M5 13l4 4L19 7"/></svg>
                      </div>
                    )}
                    {photo.status === "processing" && (
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                        <div className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Done */}
          {/* done step renders as full-screen overlay below */}
        </>
      )}
    </main>

      {/* ── Customize Sticker modal (full-screen, per photo) ── */}
      {customizeModalPhoto && (
        <div className="fixed inset-0 z-[70] bg-neutral-950 flex flex-col">
          {/* Header */}
          <div className="shrink-0 flex items-center justify-between px-5 pt-12 pb-3">
            <p className="text-white/50 text-sm">
              Photo {journeyPhotos.findIndex((p) => p.id === customizeModalPhoto.id) + 1} of {journeyPhotos.length}
            </p>
            <p className="text-white font-semibold text-sm">Create a Sticker</p>
            <div className="w-20" />
          </div>

          {/* Large sticker preview */}
          <div className="flex-1 flex items-center justify-center px-10">
            {customizeAiLoading ? (
              <div className="w-64 h-64 rounded-3xl bg-neutral-800 flex flex-col items-center justify-center gap-3">
                <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                <p className="text-white/50 text-sm">Creating AI sticker…</p>
              </div>
            ) : (
              <img
                src={customizeCurrentDataUrl ?? customizeModalPhoto.localUrl}
                alt="Sticker preview"
                className="max-w-64 max-h-64 w-full object-contain"
                style={{ filter: "drop-shadow(0 8px 32px rgba(168,85,247,0.35))" }}
              />
            )}
          </div>

          {/* Bottom panel */}
          <div className="shrink-0 bg-neutral-900 rounded-t-3xl px-5 pt-5 space-y-4"
            style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}>
            <p className="text-white font-bold text-lg text-center">Customize Sticker</p>

            {/* Shape row + Use AI button */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <p className="text-neutral-400 text-sm font-medium">Choose Sticker Shape</p>
                <button
                  onClick={onCustomizeUseAI}
                  disabled={customizeAiLoading}
                  className="flex items-center gap-1.5 text-[#a855f7] text-sm font-semibold disabled:opacity-40 active:scale-95 transition"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                  </svg>
                  Use AI
                </button>
              </div>

              {/* Thumbnail row: original + 4 shapes */}
              <div className="flex gap-2 overflow-x-auto pb-1">
                {/* Original */}
                <button
                  onClick={onCustomizeSelectOriginal}
                  className={`shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition ${
                    customizeSelectedMode === "original" ? "border-white" : "border-neutral-700"
                  }`}
                >
                  <img src={customizeModalPhoto.localUrl} alt="Original" className="w-full h-full object-cover" />
                </button>

                {/* Shape previews */}
                {CUTOUT_SHAPES.map(({ id, label }) => (
                  <button
                    key={id}
                    onClick={() => onCustomizeSelectShape(id)}
                    className={`shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 bg-neutral-800 transition flex items-center justify-center ${
                      customizeSelectedMode === id ? "border-white" : "border-neutral-700"
                    }`}
                  >
                    {customizeShapePreviews[id] ? (
                      <img src={customizeShapePreviews[id]} alt={label} className="w-full h-full object-contain" />
                    ) : (
                      <div className="opacity-50"><CutoutShapeIcon shape={id} /></div>
                    )}
                  </button>
                ))}
              </div>

              {customizeAiError && (
                <p className="text-red-400 text-xs">{customizeAiError}</p>
              )}
            </div>

            {/* Journey strip + Back/Next buttons */}
            <div className="flex items-center gap-3">
              {journeyPhotos.findIndex((p) => p.id === customizeModalPhoto.id) > 0 ? (
                <button
                  onClick={onCustomizeBack}
                  className="shrink-0 w-12 h-12 rounded-full bg-neutral-700 flex items-center justify-center active:scale-95 transition"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M19 12H5M12 19l-7-7 7-7"/>
                  </svg>
                </button>
              ) : (
                <div className="shrink-0 w-12 h-12" />
              )}
              <div className="flex gap-1.5 flex-1 overflow-x-auto pb-1">
                {(() => {
                  const currentIdx = journeyPhotos.findIndex((p) => p.id === customizeModalPhoto.id);
                  return journeyPhotos.map((p, idx) => {
                    const isCurrent = idx === currentIdx;
                    const isPrev = idx < currentIdx;
                    return (
                      <button
                        key={p.id}
                        onClick={() => {
                          if (isPrev) onCustomizeJump(idx);
                          else if (!isCurrent) onCustomizeJumpForward(idx);
                        }}
                        disabled={isCurrent}
                        className={`shrink-0 w-10 h-10 rounded-lg overflow-hidden border-2 transition ${
                          isCurrent
                            ? "border-white"
                            : isPrev
                            ? "border-neutral-500 hover:border-white active:scale-95 cursor-pointer"
                            : "border-neutral-700/40 hover:border-neutral-400 active:scale-95 cursor-pointer opacity-60"
                        }`}
                      >
                        <img src={p.localUrl} alt="" className="w-full h-full object-cover" />
                      </button>
                    );
                  });
                })()}
              </div>
              <button
                onClick={onCustomizeConfirm}
                disabled={customizeAiLoading}
                className="shrink-0 w-12 h-12 rounded-full bg-[#4ade80] flex items-center justify-center disabled:opacity-40 active:scale-95 transition"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Caption / details modal (full-screen, per sticker) ── */}
      {captionModalPhoto && (
        <div className="fixed inset-0 z-[75] bg-neutral-950 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="shrink-0 flex items-center gap-3 px-5 pt-12 pb-4">
            <button
              onClick={onCaptionBack}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-neutral-800 text-neutral-400 hover:text-white shrink-0 transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
            {captionModalPhoto.stickerDataUrl && (
              <img src={captionModalPhoto.stickerDataUrl} alt=""
                className="w-12 h-12 object-contain rounded-xl shrink-0 bg-neutral-800" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-lg">Add Details</p>
              <p className="text-neutral-400 text-sm">
                {captionModalIndex + 1} of {captionModalTotal}
              </p>
            </div>
          </div>

          {/* Scrollable form */}
          <div className="flex-1 overflow-y-auto px-5 space-y-4 pb-4">

            {/* Write Caption */}
            <div>
              <label className="text-neutral-400 text-sm font-medium">Write Caption:</label>
              <div className="mt-1.5 relative">
                <textarea
                  value={journeyCaptionInput + (journeyInterimText ? " " + journeyInterimText : "")}
                  onChange={(e) => { journeyCommittedRef.current = e.target.value; setJourneyCaptionInput(e.target.value); }}
                  placeholder="Ex: What happened here?"
                  rows={3}
                  className={`w-full bg-neutral-800 text-white placeholder-neutral-600 rounded-2xl px-4 py-3 pr-12 text-sm resize-none outline-none focus:ring-2 transition-colors ${isJourneyListening ? "ring-2 ring-red-500" : "focus:ring-purple-500"}`}
                />
                <button
                  type="button"
                  onClick={isJourneyListening ? stopJourneyListening : startJourneyListening}
                  className={`absolute right-2 bottom-2 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${isJourneyListening ? "bg-red-500 text-white" : "bg-neutral-700 text-neutral-400 hover:bg-neutral-600"}`}
                >
                  {isJourneyListening
                    ? <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><rect x="2" y="2" width="8" height="8" rx="1"/></svg>
                    : <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="9" y="2" width="6" height="12" rx="3" stroke="currentColor" strokeWidth="1.5"/><path d="M5 10a7 7 0 0 0 14 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M12 19v3M9 22h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                  }
                </button>
              </div>
              {isJourneyListening && (
                <p className="mt-1.5 flex items-center gap-1.5 text-xs text-red-400">
                  <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                  Listening{journeyInterimText ? `… "${journeyInterimText}"` : "…"}
                </p>
              )}
            </div>

            {/* Record Memo */}
            <div>
              <label className="text-neutral-400 text-sm font-medium">Record Memo:</label>
              <div className="mt-1.5">
                {!journeyCaptionVoicePreviewUrl && !journeyCaptionIsRecording && (
                  <button type="button" onClick={startJourneyCaptionRecording}
                    className="w-full flex items-center gap-3 py-3 px-4 rounded-2xl border border-white/10 bg-neutral-800 hover:bg-neutral-700 transition-colors">
                    <span className="w-8 h-8 rounded-full bg-[#4ade80] flex items-center justify-center shrink-0">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <rect x="9" y="2" width="6" height="12" rx="3" stroke="black" strokeWidth="1.5"/>
                        <path d="M5 10a7 7 0 0 0 14 0" stroke="black" strokeWidth="1.5" strokeLinecap="round"/>
                        <path d="M12 19v3M9 22h6" stroke="black" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                    </span>
                    <span className="text-sm text-neutral-400">Tap to share the story with your voice</span>
                  </button>
                )}
                {journeyCaptionIsRecording && (
                  <div className="flex items-center gap-3 py-3 px-4 rounded-2xl border border-[#4ade80] bg-green-950/30">
                    <span className="w-3 h-3 rounded-full bg-[#4ade80] animate-pulse shrink-0" />
                    <span className="flex-1 text-sm text-neutral-300 font-mono">
                      {String(Math.floor(journeyCaptionRecordingSeconds / 60)).padStart(2, "0")}:{String(journeyCaptionRecordingSeconds % 60).padStart(2, "0")}
                    </span>
                    <button type="button" onClick={stopJourneyCaptionRecording}
                      className="px-3 py-1.5 rounded-xl bg-neutral-100 text-neutral-900 text-xs font-bold">Stop</button>
                  </div>
                )}
                {journeyCaptionVoicePreviewUrl && !journeyCaptionIsRecording && (
                  <div className="space-y-2">
                    <AudioPlayer src={journeyCaptionVoicePreviewUrl} />
                    <button type="button" onClick={clearJourneyCaptionVoice}
                      className="text-xs text-neutral-500 hover:text-red-400 underline underline-offset-2">
                      Remove &amp; re-record
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Select Date (timestamp) */}
            <div>
              <label className="text-neutral-400 text-sm font-medium">Select Date</label>
              <input
                type="datetime-local"
                value={journeyCaptionTimestamp}
                onChange={(e) => setJourneyCaptionTimestamp(e.target.value)}
                className="mt-1.5 w-full bg-neutral-800 text-white rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-purple-500 [color-scheme:dark]"
              />
            </div>

            {/* Select Location */}
            <div>
              <label className="text-neutral-400 text-sm font-medium">Select Location</label>
              <input
                type="text"
                value={journeyCaptionLocationName}
                onChange={(e) => setJourneyCaptionLocationName(e.target.value)}
                placeholder="Ex: Athens, Greece"
                className="mt-1.5 w-full bg-neutral-800 text-white placeholder-neutral-600 rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-purple-500"
              />
              {/* Static map preview if we have coordinates */}
              {journeyCaptionLat != null && journeyCaptionLng != null && mapboxToken && (
                <div className="mt-2 rounded-2xl overflow-hidden h-36 relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${journeyCaptionLng},${journeyCaptionLat},13/600x300?access_token=${mapboxToken}`}
                    alt="Location map"
                    className="w-full h-full object-cover"
                  />
                  {captionModalPhoto.stickerDataUrl && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <img src={captionModalPhoto.stickerDataUrl} alt=""
                        className="w-14 h-14 object-contain drop-shadow-lg" />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Sticky action buttons */}
          <div className="shrink-0 px-5 pt-3 space-y-2.5"
            style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}>
            <button
              onClick={() => onSubmitJourneyCaption(false)}
              className="w-full py-3.5 rounded-2xl bg-purple-600 text-white font-semibold text-sm hover:bg-purple-700 active:scale-[0.98] transition"
            >
              Next →
            </button>
            <button
              onClick={() => onSubmitJourneyCaption(true)}
              className="w-full py-3 rounded-2xl border border-white/10 text-neutral-400 text-sm font-medium hover:text-white hover:border-white/20 transition"
            >
              Skip
            </button>
          </div>
        </div>
      )}

      {/* ── Journey "done" success screen ── */}
      {journeyStep === "done" && (
        <JourneyDoneScreen
          journeyPhotos={journeyPhotos}
          username={username}
          journeyCaption={journeyCaption}
          savedJourneyId={savedJourneyId}
          mapboxToken={mapboxToken}
          onViewMap={() => router.push("/map")}
          onReset={resetJourney}
        />
      )}
    </>
  );
}

export default function CapturePage() {
  return (
    <Suspense>
      <CapturePageInner />
    </Suspense>
  );
}
