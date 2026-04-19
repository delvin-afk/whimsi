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
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState("");
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const committedRef = useRef("");

  // ── Journey mode state ─────────────────────────────────────────────────────
  const [journeyPhotos, setJourneyPhotos] = useState<PhotoItem[]>([]);
  const [journeyCaption, setJourneyCaption] = useState("");
  const [journeyStep, setJourneyStep] = useState<"details" | "processing" | "done">("details");
  const [journeyProgress, setJourneyProgress] = useState({ current: 0, total: 0 });
  const [journeySaveError, setJourneySaveError] = useState("");

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

  async function shareSingle() {
    if (!stickerDataUrl) return;
    const uname = username.trim();
    if (!uname) { alert("Enter a username first"); return; }
    if (!userId) { router.push("/auth"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/sticker/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stickerBase64: stickerDataUrl, caption: caption.trim() || null, locationName: locationName.trim() || null, lat, lng, userId, username: uname }),
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

    const processed: PhotoItem[] = [];

    // Extract stickers sequentially
    for (let i = 0; i < journeyPhotos.length; i++) {
      const photo = journeyPhotos[i];
      updatePhoto(photo.id, { status: "processing" });
      setJourneyProgress({ current: i + 1, total: journeyPhotos.length });

      try {
        const res = await fetch("/api/sticker", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ base64: photo.base64, mimeType: photo.mimeType }),
        });
        const json = await res.json();
        if (res.ok) {
          const updated = { ...photo, stickerDataUrl: json.sticker, status: "done" as const };
          processed.push(updated);
          updatePhoto(photo.id, { stickerDataUrl: json.sticker, status: "done" });
        } else {
          const updated = { ...photo, status: "error" as const, errorMsg: json.error ?? "Failed" };
          processed.push(updated);
          updatePhoto(photo.id, { status: "error", errorMsg: json.error ?? "Failed" });
        }
      } catch {
        const updated = { ...photo, status: "error" as const, errorMsg: "Network error" };
        processed.push(updated);
        updatePhoto(photo.id, { status: "error", errorMsg: "Network error" });
      }
    }

    // Save journey (include photos that succeeded)
    const validPhotos = processed.filter((p) => p.stickerDataUrl);
    if (validPhotos.length === 0) {
      setJourneySaveError("None of the photos could be turned into stickers. Try different photos.");
      setJourneyStep("details");
      return;
    }

    try {
      const res = await fetch("/api/journey/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          username,
          caption: journeyCaption.trim() || null,
          stickers: validPhotos.map((p, i) => ({
            stickerBase64: p.stickerDataUrl,
            locationName: p.locationName || null,
            lat: p.lat,
            lng: p.lng,
            photoTakenAt: p.photoTakenAt ?? null,
            orderIndex: i,
          })),
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setJourneyStep("done");
      } else {
        setJourneySaveError(json.error ?? "Failed to save journey");
        setJourneyStep("details");
      }
    } catch {
      setJourneySaveError("Network error saving journey");
      setJourneyStep("details");
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
    <main className="max-w-lg mx-auto p-5 space-y-4 pb-10">
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

          {showShareForm && !saved && (
            <div className="rounded-2xl border border-neutral-200 bg-white p-5 space-y-4 shadow-sm">
              <p className="font-semibold">Share your sticker</p>
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
  );
}
