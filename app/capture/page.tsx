"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { fileToBase64 } from "@/lib/utils/image";
import dynamic from "next/dynamic";
const LocationPicker = dynamic(() => import("@/components/LocationPicker"), { ssr: false });
import { getSupabaseBrowser } from "@/lib/supabase/browser";

// SpeechRecognition is not in TypeScript's default lib — declare it manually
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

export default function CapturePage() {
  const router = useRouter();
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
  const [username, setUsername] = useState("");
  const [userId, setUserId] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Speech-to-text
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState("");
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const committedRef = useRef(""); // tracks confirmed transcript so edits aren't overwritten

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

  async function onFileChange(file: File | null) {
    if (!file) return;
    setError("");
    setLocalImageUrl(URL.createObjectURL(file));
    setBase64(await fileToBase64(file));
    setMimeType(file.type);
    setStickerDataUrl(null);
    setSaved(false);
    // Reset EXIF coords so LocationPicker re-initialises correctly
    setExifLat(undefined);
    setExifLng(undefined);
    // Try to extract GPS from EXIF metadata
    try {
      const exifr = (await import("exifr")).default;
      const gps = await exifr.gps(file);
      if (gps?.latitude && gps?.longitude) {
        setExifLat(gps.latitude);
        setExifLng(gps.longitude);
      }
    } catch {
      // No EXIF or no GPS — LocationPicker will fall back to browser geolocation
    }
  }

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
      else setError(json.error ?? "Couldn't create a sticker from this photo. Try a clearer image with a distinct subject.");
    } catch { setError("Sticker service unavailable. Please try again."); }
    finally { setLoading(false); }
  }

  function startListening() {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SR) { alert("Speech recognition isn't supported in this browser. Try Chrome or Safari."); return; }

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    // Snapshot whatever the user has already typed so we append to it
    committedRef.current = caption;

    recognition.onresult = (e: ISpeechRecognitionEvent) => {
      let interim = "";
      let newCommitted = committedRef.current;

      for (let i = e.resultIndex; i < e.results.length; i++) {
        const text = e.results[i][0].transcript;
        if (e.results[i].isFinal) {
          newCommitted += (newCommitted ? " " : "") + text.trim();
          committedRef.current = newCommitted;
        } else {
          interim += text;
        }
      }

      setCaption(newCommitted + (interim ? " " + interim : ""));
      setInterimText(interim);
    };

    recognition.onerror = () => stopListening();
    recognition.onend = () => {
      setIsListening(false);
      setInterimText("");
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }

  function stopListening() {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListening(false);
    setInterimText("");
    // Trim any trailing interim text from caption
    setCaption(committedRef.current);
  }

  async function share() {
    if (!stickerDataUrl) return;
    const uname = username.trim();
    if (!uname) { alert("Enter a username first"); return; }
    if (!userId) { router.push("/auth"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/sticker/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stickerBase64: stickerDataUrl,
          caption: caption.trim() || null,
          locationName: locationName.trim() || null,
          lat, lng,
          userId,
          username: uname,
        }),
      });
      const json = await res.json();
      if (res.ok) { setSaved(true); setShowShareForm(false); }
      else alert(json.error ?? "Failed to share");
    } catch { alert("Network error"); }
    finally { setSaving(false); }
  }

  function reset() {
    setLocalImageUrl("");
    setBase64("");
    setMimeType("");
    setStickerDataUrl(null);
    setSaved(false);
    setShowShareForm(false);
    setCaption("");
    setLocationName("");
    setLat(null);
    setLng(null);
    setExifLat(undefined);
    setExifLng(undefined);
    setError("");
    stopListening();
  }

  return (
    <main className="max-w-lg mx-auto p-5 space-y-4">
      <h1 className="text-2xl font-bold pt-2">Create a Sticker</h1>

      {/* Photo picker */}
      {!stickerDataUrl && (
        <div className="space-y-3">
          <label>
            <input
              ref={fileRef}
              className="sr-only"
              type="file"
              accept="image/*"
              onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
            />
            <div className="flex items-center justify-center gap-3 h-28 rounded-2xl border-2 border-dashed border-neutral-300 hover:bg-neutral-50 cursor-pointer text-neutral-500">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <span className="font-medium text-sm">
                {localImageUrl ? "Change photo" : "Choose photo"}
              </span>
            </div>
          </label>

          {localImageUrl && (
            <div className="rounded-2xl overflow-hidden border bg-white shadow-sm max-h-52 flex items-center justify-center">
              <img src={localImageUrl} alt="Uploaded" className="max-h-52 w-full object-contain" />
            </div>
          )}

          {localImageUrl && (
            <div className="space-y-3">
              <button
                onClick={() => { reset(); fileRef.current?.click(); }}
                className="w-full py-4 rounded-2xl bg-neutral-800 text-white font-bold text-base flex items-center justify-center gap-2"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="12" cy="13" r="4" stroke="currentColor" strokeWidth="1.5"/>
                </svg>
                Retake Photo
              </button>
              <button
                onClick={extractSticker}
                disabled={loading}
                className="w-full py-4 rounded-2xl bg-[#4ade80] text-black font-bold text-base disabled:opacity-50"
              >
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
                <button
                  onClick={() => { setError(""); fileRef.current?.click(); }}
                  className="mt-2 text-xs text-red-600 underline underline-offset-2"
                >
                  Try a different photo
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sticker preview */}
      {stickerDataUrl && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-sm text-neutral-700">Your sticker</p>
            <button onClick={reset} className="text-xs text-neutral-400 hover:text-neutral-700">
              Start over
            </button>
          </div>
          <div className="rounded-2xl bg-neutral-50 border border-neutral-100 flex items-center justify-center p-6">
            <img src={stickerDataUrl} alt="Sticker" className="max-h-64 object-contain" style={{ filter: "drop-shadow(0 4px 16px rgba(0,0,0,0.15))" }} />
          </div>
        </div>
      )}

      {/* Share button */}
      {stickerDataUrl && !saved && (
        <button
          onClick={() => setShowShareForm((v) => !v)}
          className="w-full py-4 rounded-2xl bg-[#4ade80] text-black font-bold text-base"
        >
          Share to Map & Feed
        </button>
      )}

      {saved && (
        <div className="rounded-2xl bg-green-50 border border-green-200 p-4 text-center space-y-2">
          <p className="text-green-700 font-medium">Shared! Your sticker is on the map.</p>
          <button onClick={reset} className="text-sm text-green-600 underline">Make another sticker</button>
        </div>
      )}

      {/* Share form */}
      {showShareForm && !saved && (
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 space-y-4 shadow-sm">
          <p className="font-semibold">Share your sticker</p>

          {/* Caption: type or dictate */}
          <div>
            <label className="text-xs text-neutral-500 font-medium uppercase tracking-wide">Caption</label>
            <div className="mt-1 relative">
              <textarea
                value={caption}
                onChange={(e) => {
                  committedRef.current = e.target.value;
                  setCaption(e.target.value);
                }}
                placeholder="Write something…"
                rows={3}
                className={`w-full rounded-xl border px-3 py-2 pr-11 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#4ade80] transition-colors ${
                  isListening ? "border-red-400 bg-red-50" : "border-neutral-200"
                }`}
              />
              {/* Mic button inside textarea */}
              <button
                type="button"
                onClick={isListening ? stopListening : startListening}
                title={isListening ? "Stop dictation" : "Dictate caption"}
                className={`absolute right-2 bottom-2 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                  isListening
                    ? "bg-red-500 text-white"
                    : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
                }`}
              >
                {isListening ? (
                  /* Stop icon */
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                    <rect x="2" y="2" width="8" height="8" rx="1"/>
                  </svg>
                ) : (
                  /* Mic icon */
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <rect x="9" y="2" width="6" height="12" rx="3" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M5 10a7 7 0 0 0 14 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    <path d="M12 19v3M9 22h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                )}
              </button>
            </div>

            {/* Status line */}
            {isListening && (
              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-red-500">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                Listening{interimText ? `… "${interimText}"` : "…"}
              </p>
            )}
            {!isListening && (
              <p className="mt-1.5 text-xs text-neutral-400">
                Tap the mic to dictate instead of typing
              </p>
            )}
          </div>

          {/* Location */}
          <div>
            <label className="text-xs text-neutral-500 font-medium uppercase tracking-wide">Location</label>
            <div className="mt-2">
              <LocationPicker
                defaultLat={exifLat}
                defaultLng={exifLng}
                onChange={(name, newLat, newLng) => {
                  setLocationName(name);
                  setLat(newLat);
                  setLng(newLng);
                }}
              />
            </div>
          </div>

          <button
            onClick={share}
            disabled={saving}
            className="w-full py-4 rounded-2xl bg-[#4ade80] text-black font-bold disabled:opacity-50"
          >
            {saving ? "Sharing…" : "Share"}
          </button>
        </div>
      )}
    </main>
  );
}
