"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { fileToBase64 } from "@/lib/utils/image";
import dynamic from "next/dynamic";
const LocationPicker = dynamic(() => import("@/components/LocationPicker"), { ssr: false });
import { getSupabaseBrowser } from "@/lib/supabase/browser";

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
  const [username, setUsername] = useState("");
  const [userId, setUserId] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

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
    setError("");
  }

  return (
    <main className="max-w-lg mx-auto p-5 space-y-4">
      <h1 className="text-2xl font-bold pt-2">Make a Sticker</h1>

      {/* Photo picker — hidden once sticker is ready */}
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
            <div
              onClick={() => fileRef.current?.click()}
              className="flex items-center justify-center gap-3 h-28 rounded-2xl border-2 border-dashed border-neutral-300 hover:bg-neutral-50 cursor-pointer text-neutral-500"
            >
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
            <button
              onClick={extractSticker}
              disabled={loading}
              className="w-full py-4 rounded-2xl bg-[#4ade80] text-black font-bold text-base disabled:opacity-50"
            >
              {loading ? "Creating sticker…" : "Make Sticker"}
            </button>
          )}

          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 flex items-start gap-3">
              <span className="text-red-500 text-lg leading-none mt-0.5">⚠</span>
              <div className="flex-1 min-w-0">
                <p className="text-red-700 text-sm font-medium">Couldn't make a sticker</p>
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
            <button
              onClick={reset}
              className="text-xs text-neutral-400 hover:text-neutral-700"
            >
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

          <div>
            <label className="text-xs text-neutral-500 font-medium uppercase tracking-wide">Caption</label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Write something…"
              rows={2}
              className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-pink-300"
            />
          </div>

          <div>
            <label className="text-xs text-neutral-500 font-medium uppercase tracking-wide">Location</label>
            <div className="mt-2">
              <LocationPicker
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
