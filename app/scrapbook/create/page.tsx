"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { StickerPost } from "@/types";
import CollageBoard, { type CollageBoardHandle } from "@/components/CollageBoard";
import { getSupabaseBrowser } from "@/lib/supabase/browser";

export default function CreateScrapbookPage() {
  const router = useRouter();
  const [shelf, setShelf] = useState<StickerPost[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [caption, setCaption] = useState("");
  const [username, setUsername] = useState("");
  const [userId, setUserId] = useState("");
  const [saving, setSaving] = useState(false);
  const boardRef = useRef<CollageBoardHandle>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowser();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push("/auth?redirect=/scrapbook/create"); return; }
      const uid = data.user.id;
      setUserId(uid);

      supabase
        .from("profiles")
        .select("username")
        .eq("id", uid)
        .single()
        .then(({ data: profile }) => {
          if (profile?.username) setUsername(profile.username);
        });

      fetch(`/api/stickers?user_id=${uid}`)
        .then((r) => r.json())
        .then((j) => setShelf(j.stickers ?? []))
        .catch(() => {})
        .finally(() => setLoading(false));
    });
  }, [router]);

  function toggleSticker(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function saveCollage() {
    if (!boardRef.current || selected.size === 0) return;
    const uname = username.trim();
    if (!uname) { alert("Enter a username first"); return; }
    if (!userId) { router.push("/auth"); return; }
    setSaving(true);
    try {
      const compositeDataUrl = await boardRef.current.toDataURL();
      const res = await fetch("/api/sticker/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stickerBase64: compositeDataUrl,
          caption: caption.trim() || null,
          locationName: null,
          lat: null,
          lng: null,
          userId,
          username: uname,
          isPublic: false,
        }),
      });
      const json = await res.json();
      if (res.ok) router.push("/scrapbook");
      else alert(json.error ?? "Failed to save");
    } catch { alert("Network error"); }
    finally { setSaving(false); }
  }

  const boardStickers = shelf
    .filter((s) => selected.has(s.id))
    .map((s) => ({ id: s.id, url: s.image_url }));

  return (
    <main className="max-w-lg mx-auto p-5 space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-neutral-400 hover:text-neutral-700">
          ← Back
        </button>
        <h1 className="text-xl font-bold">Build a Collage</h1>
      </div>

      {/* Sticker shelf */}
      <div className="space-y-2">
        <p className="text-xs text-neutral-500 font-semibold uppercase tracking-wide">
          Your stickers — tap to add
        </p>

        {loading && (
          <div className="flex justify-center py-8">
            <div className="h-7 w-7 rounded-full border-2 border-neutral-200 border-t-pink-500 animate-spin" />
          </div>
        )}

        {!loading && shelf.length === 0 && (
          <p className="text-sm text-neutral-400 py-4 text-center">
            No stickers yet — make some from the Create tab!
          </p>
        )}

        {!loading && shelf.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {shelf.map((s) => {
              const isSelected = selected.has(s.id);
              return (
                <button
                  key={s.id}
                  onClick={() => toggleSticker(s.id)}
                  className={`relative w-16 h-16 rounded-xl border-2 transition-all ${
                    isSelected
                      ? "border-pink-500 ring-2 ring-pink-300 scale-105"
                      : "border-neutral-200 hover:border-neutral-400"
                  }`}
                  style={{ background: "linear-gradient(135deg, #667eea15, #764ba215)" }}
                >
                  <img
                    src={s.image_url}
                    alt="sticker"
                    className="w-full h-full object-contain p-1"
                    style={{ filter: "drop-shadow(0 1px 4px rgba(0,0,0,0.3))" }}
                  />
                  {isSelected && (
                    <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-pink-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Collage board */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs text-neutral-500 font-semibold uppercase tracking-wide">
            Canvas {selected.size > 0 ? `— ${selected.size} sticker${selected.size > 1 ? "s" : ""}` : ""}
          </p>
          {selected.size > 0 && (
            <span className="text-xs text-neutral-400">drag to arrange</span>
          )}
        </div>
        <CollageBoard ref={boardRef} stickers={boardStickers} />
      </div>

      {/* Save form */}
      {selected.size > 0 && (
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 space-y-4 shadow-sm">
          <p className="font-semibold">Save to your scrapbook</p>
          <p className="text-xs text-neutral-400">Collages are saved privately — they won't appear on the map.</p>

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
              placeholder="What's this collection about?"
              rows={2}
              className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-pink-300"
            />
          </div>

          <button
            onClick={saveCollage}
            disabled={saving}
            className="w-full py-4 rounded-2xl bg-[#4ade80] text-black font-bold disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save Collage"}
          </button>
        </div>
      )}
    </main>
  );
}
