"use client";

import { useEffect, useRef, useState } from "react";
import { fileToBase64 } from "@/lib/utils/image";
import CollageBoard, { type CollageBoardHandle } from "@/components/CollageBoard";
import LocationInput from "@/components/LocationInput";

function getUserId(): string {
  let id = localStorage.getItem("sticker_user_id");
  if (!id) { id = crypto.randomUUID(); localStorage.setItem("sticker_user_id", id); }
  return id;
}

type StickerSlot = {
  key: string;
  localImageUrl: string;
  base64: string;
  mimeType: string;
  stickerDataUrl: string | null;
  loading: boolean;
};

function emptySlot(): StickerSlot {
  return { key: crypto.randomUUID(), localImageUrl: "", base64: "", mimeType: "", stickerDataUrl: null, loading: false };
}

export default function CapturePage() {
  const [slots, setSlots] = useState<StickerSlot[]>([emptySlot()]);
  const [showShareForm, setShowShareForm] = useState(false);
  const [caption, setCaption] = useState("");
  const [locationName, setLocationName] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [username, setUsername] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const boardRef = useRef<CollageBoardHandle>(null);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    setUsername(localStorage.getItem("sticker_username") ?? "");
  }, []);

  function updateSlot(key: string, patch: Partial<StickerSlot>) {
    setSlots((prev) => prev.map((s) => s.key === key ? { ...s, ...patch } : s));
  }

  async function onFileChange(key: string, file: File | null) {
    if (!file) return;
    updateSlot(key, {
      localImageUrl: URL.createObjectURL(file),
      base64: await fileToBase64(file),
      mimeType: file.type,
      stickerDataUrl: null,
    });
    setSaved(false);
  }

  async function extractSticker(key: string) {
    const slot = slots.find((s) => s.key === key);
    if (!slot?.base64) return;
    updateSlot(key, { loading: true });
    try {
      const res = await fetch("/api/sticker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base64: slot.base64, mimeType: slot.mimeType }),
      });
      const json = await res.json();
      if (res.ok) updateSlot(key, { stickerDataUrl: json.sticker });
      else alert(json.error ?? "Sticker extraction failed");
    } catch { alert("Sticker service unavailable."); }
    finally { updateSlot(key, { loading: false }); }
  }

  async function share() {
    if (!boardRef.current) return;
    const uname = username.trim();
    if (!uname) { alert("Enter a username first"); return; }
    localStorage.setItem("sticker_username", uname);
    setSaving(true);
    try {
      const compositeDataUrl = await boardRef.current.toDataURL();
      const res = await fetch("/api/sticker/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stickerBase64: compositeDataUrl,
          caption: caption.trim() || null,
          locationName: locationName.trim() || null,
          lat, lng,
          userId: getUserId(),
          username: uname,
        }),
      });
      const json = await res.json();
      if (res.ok) { setSaved(true); setShowShareForm(false); }
      else alert(json.error ?? "Failed to share");
    } catch { alert("Network error"); }
    finally { setSaving(false); }
  }

  const readyStickers = slots
    .filter((s) => s.stickerDataUrl)
    .map((s) => ({ id: s.key, url: s.stickerDataUrl! }));

  const anyLoading = slots.some((s) => s.loading);

  return (
    <main className="max-w-lg mx-auto p-5 space-y-4">
      <h1 className="text-2xl font-bold pt-2">Make a Sticker</h1>

      {/* Sticker slots — compact once board is visible */}
      <div className={`space-y-3 ${readyStickers.length > 0 ? "hidden" : ""}`}>
        {slots.map((slot) => (
          <div key={slot.key} className="space-y-2">
            <label>
              <input
                ref={(el) => { fileRefs.current[slot.key] = el; }}
                className="sr-only"
                type="file"
                accept="image/*"
                onChange={(e) => onFileChange(slot.key, e.target.files?.[0] ?? null)}
              />
              <div
                onClick={() => fileRefs.current[slot.key]?.click()}
                className="flex items-center justify-center gap-3 h-28 rounded-2xl border-2 border-dashed border-neutral-300 hover:bg-neutral-50 cursor-pointer text-neutral-500"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <span className="font-medium text-sm">
                  {slot.localImageUrl ? "Change photo" : "Choose photo"}
                </span>
              </div>
            </label>

            {slot.localImageUrl && (
              <div className="rounded-2xl overflow-hidden border bg-white shadow-sm max-h-52 flex items-center justify-center">
                <img src={slot.localImageUrl} alt="Uploaded" className="max-h-52 w-full object-contain" />
              </div>
            )}

            {slot.localImageUrl && !slot.stickerDataUrl && (
              <button
                onClick={() => extractSticker(slot.key)}
                disabled={slot.loading}
                className="w-full py-3 rounded-2xl bg-linear-to-r from-pink-500 to-yellow-400 text-white font-semibold text-base shadow disabled:opacity-50"
              >
                {slot.loading ? "Creating sticker…" : "🎨 Make Sticker"}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Collage board — shown once at least one sticker is ready */}
      {readyStickers.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-sm text-neutral-700">
              Arrange your sticker{readyStickers.length > 1 ? "s" : ""}
            </p>
            <span className="text-xs text-neutral-400">drag to reposition</span>
          </div>

          <CollageBoard ref={boardRef} stickers={readyStickers} />

          {/* Per-slot status row */}
          <div className="flex flex-wrap gap-2">
            {slots.map((slot, idx) => (
              <div key={slot.key} className="flex items-center gap-1.5">
                {slot.stickerDataUrl ? (
                  <div className="relative">
                    <img
                      src={slot.stickerDataUrl}
                      alt="s"
                      className="w-10 h-10 object-contain rounded-xl border border-neutral-100 bg-neutral-50"
                    />
                    <button
                      onClick={() => updateSlot(slot.key, { stickerDataUrl: null })}
                      className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-neutral-500 text-white text-[9px] rounded-full flex items-center justify-center"
                    >✕</button>
                  </div>
                ) : slot.localImageUrl ? (
                  <button
                    onClick={() => extractSticker(slot.key)}
                    disabled={slot.loading}
                    className="px-3 py-1.5 rounded-xl bg-pink-50 text-pink-600 text-xs font-semibold border border-pink-200 disabled:opacity-50"
                  >
                    {slot.loading ? "…" : `Make #${idx + 1}`}
                  </button>
                ) : null}
              </div>
            ))}

            {/* Add another photo */}
            {!anyLoading && (
              <label className="cursor-pointer">
                <input
                  className="sr-only"
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const newSlot = emptySlot();
                    setSlots((prev) => [...prev, newSlot]);
                    // slight delay so the slot is in state
                    setTimeout(() => onFileChange(newSlot.key, file), 10);
                  }}
                />
                <div className="flex items-center gap-1 px-3 py-1.5 rounded-xl border-2 border-dashed border-pink-300 text-pink-500 text-xs font-semibold hover:bg-pink-50">
                  <span>+ Add photo</span>
                </div>
              </label>
            )}
          </div>
        </div>
      )}

      {/* Share */}
      {readyStickers.length > 0 && !saved && (
        <button
          onClick={() => setShowShareForm((v) => !v)}
          className="w-full py-3 rounded-2xl bg-black text-white font-semibold text-base"
        >
          📍 Share to Map & Feed
        </button>
      )}

      {saved && (
        <div className="rounded-2xl bg-green-50 border border-green-200 p-4 text-center text-green-700 font-medium">
          ✅ Shared! Check the feed.
        </div>
      )}

      {/* Share form */}
      {showShareForm && !saved && (
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 space-y-4 shadow-sm">
          <p className="font-semibold">Share your post</p>

          <div>
            <label className="text-xs text-neutral-500 font-medium uppercase tracking-wide">Your name</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. Jess"
              className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
            />
          </div>

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
            <div className="mt-1">
              <LocationInput
                value={locationName}
                onChange={(name, newLat, newLng) => {
                  setLocationName(name);
                  if (newLat !== undefined) setLat(newLat);
                  if (newLng !== undefined) setLng(newLng);
                }}
              />
            </div>
            {lat && lng && <p className="text-xs text-neutral-400 mt-1">{lat.toFixed(4)}, {lng.toFixed(4)}</p>}
          </div>

          <button
            onClick={share}
            disabled={saving}
            className="w-full py-3 rounded-2xl bg-linear-to-r from-pink-500 to-yellow-400 text-white font-semibold disabled:opacity-50"
          >
            {saving ? "Composing & sharing…" : "🚀 Share"}
          </button>
        </div>
      )}
    </main>
  );
}
