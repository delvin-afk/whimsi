"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { fileToBase64 } from "@/lib/utils/image";
import dynamic from "next/dynamic";
const LocationPicker = dynamic(() => import("@/components/LocationPicker"), { ssr: false });
import { getSupabaseBrowser } from "@/lib/supabase/browser";

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

// ── Main component ────────────────────────────────────────────────────────────
export default function CapturePage() {
  const router = useRouter();
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
  // Cut-out popup: shown mid-processing when a photo fails
  const [cutoutModalPhoto, setCutoutModalPhoto] = useState<PhotoItem | null>(null);
  const cutoutResolverRef = useRef<((shape: CutoutShape | null) => void) | null>(null);

  // Caption popup: shown mid-processing after each sticker is ready
  const [captionModalPhoto, setCaptionModalPhoto] = useState<PhotoItem | null>(null);
  const captionResolverRef = useRef<((result: { caption: string; voiceBlob: Blob | null; voiceMimeType: string | null }) => void) | null>(null);
  const [journeyCaptionInput, setJourneyCaptionInput] = useState("");
  const [isJourneyListening, setIsJourneyListening] = useState(false);
  const [journeyInterimText, setJourneyInterimText] = useState("");
  const journeyCommittedRef = useRef("");

  // Journey caption voice memo recorder
  const [journeyCaptionIsRecording, setJourneyCaptionIsRecording] = useState(false);
  const [journeyCaptionVoiceBlob, setJourneyCaptionVoiceBlob] = useState<Blob | null>(null);
  const [journeyCaptionVoicePreviewUrl, setJourneyCaptionVoicePreviewUrl] = useState<string | null>(null);
  const [journeyCaptionRecordingSeconds, setJourneyCaptionRecordingSeconds] = useState(0);
  const journeyCaptionMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const journeyCaptionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

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

    if (files.length === 1) {
      // Single photo — existing flow
      setMode("single");
      const file = files[0];
      setError("");
      setLocalImageUrl(URL.createObjectURL(file));
      setBase64(await fileToBase64(file));
      setMimeType(file.type);
      setStickerDataUrl(null);
      setSaved(false);
      setExifLat(undefined);
      setExifLng(undefined);
      const exif = await extractExif(file);
      if (exif.lat && exif.lng) {
        setExifLat(exif.lat);
        setExifLng(exif.lng);
      }
    } else {
      // Multiple photos — journey mode
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

          // Reverse geocode if we have GPS
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

      // Sort by timestamp if available, otherwise keep file order
      items.sort((a, b) => {
        if (a.photoTakenAt && b.photoTakenAt) {
          return new Date(a.photoTakenAt).getTime() - new Date(b.photoTakenAt).getTime();
        }
        return 0;
      });

      setJourneyPhotos(items);
    }
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

    for (let i = 0; i < results.length; i++) {
      results[i] = { ...results[i], status: "processing" };
      updatePhoto(results[i].id, { status: "processing" });
      setJourneyProgress({ current: i + 1, total: results.length });

      // Try AI sticker extraction
      let stickerDataUrl: string | null = null;
      try {
        const res = await fetch("/api/sticker", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ base64: results[i].base64, mimeType: results[i].mimeType }),
        });
        const json = await res.json();
        if (res.ok) stickerDataUrl = json.sticker;
      } catch { /* fall through to cut-out prompt */ }

      if (stickerDataUrl) {
        results[i] = { ...results[i], stickerDataUrl, status: "done" };
        updatePhoto(results[i].id, { stickerDataUrl, status: "done" });
      } else {
        // ── Pause: show cut-out popup and wait for user choice ──
        results[i] = { ...results[i], status: "error" };
        updatePhoto(results[i].id, { status: "error" });

        const chosenShape = await new Promise<CutoutShape | null>((resolve) => {
          cutoutResolverRef.current = resolve;
          setCutoutModalPhoto({ ...results[i] });
        });
        setCutoutModalPhoto(null);
        cutoutResolverRef.current = null;

        if (chosenShape) {
          // Generate cut-out client-side
          updatePhoto(results[i].id, { status: "processing" });
          try {
            const dataUrl = await generateCutout(results[i].localUrl, chosenShape);
            results[i] = { ...results[i], stickerDataUrl: dataUrl, status: "done" };
            updatePhoto(results[i].id, { stickerDataUrl: dataUrl, status: "done" });
          } catch {
            results[i] = { ...results[i], status: "error", errorMsg: "Cut-out failed" };
            updatePhoto(results[i].id, { status: "error", errorMsg: "Cut-out failed" });
          }
        } else {
          // Skipped — keep as error/skipped
          results[i] = { ...results[i], status: "error", errorMsg: "Skipped" };
          updatePhoto(results[i].id, { status: "error", errorMsg: "Skipped" });
        }
      }

      // ── Pause: ask for a caption if sticker was created ──────────────────
      if (results[i].stickerDataUrl) {
        setJourneyCaptionInput("");
        journeyCommittedRef.current = "";
        setJourneyCaptionIsRecording(false);
        setJourneyCaptionVoiceBlob(null);
        setJourneyCaptionVoicePreviewUrl(null);
        setJourneyCaptionRecordingSeconds(0);
        const { caption: enteredCaption, voiceBlob: enteredVoiceBlob, voiceMimeType: enteredVoiceMimeType } = await new Promise<{ caption: string; voiceBlob: Blob | null; voiceMimeType: string | null }>((resolve) => {
          captionResolverRef.current = resolve;
          setCaptionModalPhoto({ ...results[i] });
        });
        setCaptionModalPhoto(null);
        captionResolverRef.current = null;
        results[i] = { ...results[i], caption: enteredCaption, voiceBlob: enteredVoiceBlob, voiceMimeType: enteredVoiceMimeType };
        updatePhoto(results[i].id, { caption: enteredCaption });
      }
    }

    // All done — save if we have enough
    const validCount = results.filter((p) => p.stickerDataUrl).length;
    if (validCount >= 2) {
      void saveJourney(results);
    } else {
      setJourneySaveError(`Only ${validCount} sticker${validCount === 1 ? "" : "s"} — need at least 2 to create a journey.`);
      setJourneyStep("details");
    }
  }

  function onPickCutout(shape: CutoutShape | null) {
    cutoutResolverRef.current?.(shape);
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

  function onSubmitJourneyCaption(skip: boolean) {
    const value = skip ? "" : journeyCommittedRef.current || journeyCaptionInput;
    stopJourneyListening();
    if (journeyCaptionIsRecording) stopJourneyCaptionRecording();
    setJourneyCaptionInput("");
    captionResolverRef.current?.({
      caption: value.trim(),
      voiceBlob: skip ? null : journeyCaptionVoiceBlob,
      voiceMimeType: skip ? null : (journeyCaptionVoiceBlob?.type ?? null),
    });
    clearJourneyCaptionVoice();
  }


  async function saveJourney(photos: PhotoItem[]) {
    const validPhotos = photos.filter((p) => p.stickerDataUrl);
    if (validPhotos.length < 2) {
      setJourneySaveError("Need at least 2 stickers to save a journey.");
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
  return (
    <>
    <main className="max-w-lg mx-auto p-5 space-y-4 pb-36">
      <h1 className="text-2xl font-bold pt-2">
        {mode === "journey" ? "Create a Journey" : "Create a Sticker"}
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
                  multiple
                  onChange={(e) => onFilesSelected(e.target.files)}
                />
                <div className="flex flex-col items-center justify-center gap-2 h-28 rounded-2xl border-2 border-dashed border-neutral-300 hover:bg-neutral-50 cursor-pointer text-neutral-500">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  <span className="font-medium text-sm">{localImageUrl ? "Change photo" : "Choose photo"}</span>
                  <span className="text-xs text-neutral-400">Select 2+ photos to create a Journey</span>
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
                          <audio src={voicePreviewUrl} controls className="w-full h-10" />
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
          {/* Hidden file input — shared with single mode */}
          <input
            ref={fileRef}
            className="sr-only"
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => onFilesSelected(e.target.files)}
          />

          {journeyStep === "details" && (
            <div className="space-y-4">
              {/* Journey header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-neutral-600">{journeyPhotos.length} photos</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">Journey</span>
                </div>
                <button onClick={resetJourney} className="text-xs text-neutral-400 hover:text-neutral-700">Start over</button>
              </div>

              {/* Journey caption */}
              <div>
                <label className="text-xs text-neutral-500 font-medium uppercase tracking-wide">Journey Title / Caption</label>
                <input
                  value={journeyCaption}
                  onChange={(e) => setJourneyCaption(e.target.value)}
                  placeholder="e.g. Weekend in Tokyo"
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
                Create Journey ({journeyPhotos.length} stickers)
              </button>
            </div>
          )}

          {/* Processing */}
          {journeyStep === "processing" && (
            <div className="space-y-6 py-8 text-center">
              <div className="space-y-2">
                <p className="font-semibold text-lg">Creating your journey…</p>
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
          {journeyStep === "done" && (
            <div className="space-y-4 py-6 text-center">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5"><path d="M5 13l4 4L19 7"/></svg>
              </div>
              <div>
                <p className="font-bold text-xl">Journey created!</p>
                <p className="text-sm text-neutral-500 mt-1">
                  {journeyPhotos.filter((p) => p.status === "done").length} stickers pinned privately on your map
                </p>
              </div>
              <div className="flex flex-col gap-2 pt-2">
                <button
                  onClick={() => router.push("/map")}
                  className="w-full py-4 rounded-2xl bg-[#4ade80] text-black font-bold text-base"
                >
                  View on Map
                </button>
                <button
                  onClick={resetJourney}
                  className="w-full py-3 rounded-2xl border border-neutral-200 text-neutral-600 text-sm font-medium"
                >
                  Create another
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </main>

      {/* ── Cut-out popup modal (mid-processing) ── */}
      {cutoutModalPhoto && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          {/* Sheet */}
          <div className="relative w-full max-w-lg bg-neutral-900 rounded-t-3xl p-6 space-y-5 pb-10">
            {/* Handle */}
            <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-1" />

            {/* Header with photo */}
            <div className="flex items-center gap-4">
              <img
                src={cutoutModalPhoto.localUrl}
                alt=""
                className="w-16 h-16 rounded-xl object-cover shrink-0 border-2 border-red-400/50"
              />
              <div>
                <p className="text-white font-semibold">Couldn&apos;t create sticker</p>
                <p className="text-neutral-400 text-sm mt-0.5">Pick a cut-out shape for this photo instead</p>
              </div>
            </div>

            {/* Shape options */}
            <div className="grid grid-cols-4 gap-3">
              {CUTOUT_SHAPES.map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => onPickCutout(id)}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-neutral-800 hover:bg-neutral-700 active:scale-95 transition"
                >
                  <CutoutShapeIcon shape={id} />
                  <span className="text-white text-xs font-medium">{label}</span>
                </button>
              ))}
            </div>

            {/* Skip */}
            <button
              onClick={() => onPickCutout(null)}
              className="w-full py-3 rounded-2xl border border-white/10 text-neutral-400 text-sm font-medium hover:text-white hover:border-white/20 transition"
            >
              Skip this photo
            </button>
          </div>
        </div>
      )}

      {/* ── Caption popup modal (mid-processing, per sticker) ── */}
      {captionModalPhoto && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-lg bg-neutral-900 rounded-t-3xl p-6 space-y-4 pb-10 mb-20">
            <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-1" />

            {/* Header */}
            <div className="flex items-center gap-4">
              {captionModalPhoto.stickerDataUrl && (
                <img src={captionModalPhoto.stickerDataUrl} alt=""
                  className="w-16 h-16 object-contain rounded-xl shrink-0 bg-neutral-800" />
              )}
              <div>
                <p className="text-white font-semibold">Add a caption?</p>
                <p className="text-neutral-400 text-sm mt-0.5">
                  Photo {journeyPhotos.findIndex((p) => p.id === captionModalPhoto.id) + 1} of {journeyPhotos.length}
                </p>
              </div>
            </div>

            {/* Text input with inline mic */}
            <div className="relative">
              <textarea
                value={journeyCaptionInput + (journeyInterimText ? " " + journeyInterimText : "")}
                onChange={(e) => {
                  journeyCommittedRef.current = e.target.value;
                  setJourneyCaptionInput(e.target.value);
                }}
                placeholder="What's happening here?"
                rows={2}
                className={`w-full bg-neutral-800 text-white placeholder-neutral-500 rounded-2xl px-4 py-3 pr-12 text-sm resize-none outline-none focus:ring-2 transition-colors ${isJourneyListening ? "ring-2 ring-red-500" : "focus:ring-purple-500"}`}
              />
              <button
                type="button"
                onClick={isJourneyListening ? stopJourneyListening : startJourneyListening}
                className={`absolute right-2 bottom-2 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${isJourneyListening ? "bg-red-500 text-white" : "bg-neutral-700 text-neutral-300 hover:bg-neutral-600"}`}
              >
                {isJourneyListening
                  ? <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><rect x="2" y="2" width="8" height="8" rx="1"/></svg>
                  : <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="9" y="2" width="6" height="12" rx="3" stroke="currentColor" strokeWidth="1.5"/><path d="M5 10a7 7 0 0 0 14 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M12 19v3M9 22h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                }
              </button>
            </div>
            {isJourneyListening && (
              <p className="flex items-center gap-1.5 text-xs text-red-400 -mt-2">
                <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                Listening{journeyInterimText ? `… "${journeyInterimText}"` : "…"}
              </p>
            )}

            {/* and/or */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-xs text-neutral-500 font-medium">and/or</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            {/* Record Memo */}
            <div>
              <label className="text-xs text-neutral-500 font-medium uppercase tracking-wide">Record Memo</label>
              <div className="mt-2">
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
                    <audio src={journeyCaptionVoicePreviewUrl} controls className="w-full h-10" />
                    <button type="button" onClick={clearJourneyCaptionVoice}
                      className="text-xs text-neutral-500 hover:text-red-400 underline underline-offset-2">
                      Remove &amp; re-record
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Submit */}
            <button
              onClick={() => onSubmitJourneyCaption(false)}
              disabled={!journeyCaptionInput.trim() && !journeyInterimText.trim() && !journeyCaptionVoiceBlob}
              className="w-full py-2.5 rounded-xl bg-purple-600 text-white text-sm font-semibold disabled:opacity-40 hover:bg-purple-700 transition"
            >
              Add Caption
            </button>

            {/* Skip */}
            <button
              onClick={() => onSubmitJourneyCaption(true)}
              className="w-full py-3 rounded-2xl border border-white/10 text-neutral-400 text-sm font-medium hover:text-white hover:border-white/20 transition"
            >
              Skip
            </button>
          </div>
        </div>
      )}
    </>
  );
}
