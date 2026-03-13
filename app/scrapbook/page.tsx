"use client";

import { useEffect, useState } from "react";
import type { StickerPost } from "@/types";
import Link from "next/link";
import StickerOptionsSheet from "@/components/StickerOptionsSheet";

function StickerCard({
  sticker,
  userId,
  onDeleted,
  onCaptionUpdated,
}: {
  sticker: StickerPost;
  userId: string;
  onDeleted: (id: string) => void;
  onCaptionUpdated: (id: string, caption: string) => void;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);

  async function handleDelete() {
    const res = await fetch(`/api/stickers/${sticker.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (res.ok) onDeleted(sticker.id);
  }

  async function handleEditCaption(newCaption: string) {
    const res = await fetch(`/api/stickers/${sticker.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, caption: newCaption || null }),
    });
    if (res.ok) onCaptionUpdated(sticker.id, newCaption);
  }

  return (
    <>
      <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden flex flex-col">
        <div
          className="relative flex items-center justify-center p-3 min-h-28"
          style={{ background: "linear-gradient(135deg, #667eea22, #764ba222)" }}
        >
          <img
            src={sticker.image_url}
            alt={sticker.caption ?? "sticker"}
            className="max-h-28 max-w-full object-contain"
            style={{ filter: "drop-shadow(0 0 5px rgba(0,0,0,0.5)) drop-shadow(0 3px 8px rgba(0,0,0,0.3))" }}
          />
          <button
            onClick={() => setSheetOpen(true)}
            className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-full bg-white/70 hover:bg-white text-neutral-500 text-sm font-bold shadow-sm"
          >
            ···
          </button>
        </div>

        {sticker.caption && (
          <div className="px-2.5 py-2 border-t border-neutral-50">
            <p className="text-xs text-neutral-600 truncate">{sticker.caption}</p>
          </div>
        )}
      </div>

      <StickerOptionsSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        initialCaption={sticker.caption}
        onEditCaption={handleEditCaption}
        onDelete={handleDelete}
      />
    </>
  );
}

export default function ScrapbookPage() {
  const [stickers, setStickers] = useState<StickerPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const id = localStorage.getItem("sticker_user_id");
    setUserId(id);
    if (!id) { setLoading(false); return; }

    fetch(`/api/stickers?user_id=${id}`)
      .then((r) => r.json())
      .then((j) => setStickers(j.stickers ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Group by location
  const grouped = stickers.reduce<Record<string, StickerPost[]>>((acc, s) => {
    const key = s.location_name ?? "Unsorted";
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {});

  return (
    <main className="max-w-lg mx-auto px-4 pt-5 pb-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Scrapbook</h1>
        <Link href="/capture" className="text-sm text-pink-500 font-medium">+ New</Link>
      </div>

      {/* Build scrapbook CTA */}
      {!loading && userId && stickers.length >= 2 && (
        <Link
          href="/scrapbook/create"
          className="flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 border-dashed border-purple-300 bg-purple-50/50 hover:bg-purple-50"
        >
          <span className="text-2xl">📖</span>
          <div>
            <p className="font-semibold text-sm text-purple-700">Build a scrapbook page</p>
            <p className="text-xs text-purple-400">Combine your stickers into a collage & share</p>
          </div>
          <span className="ml-auto text-purple-300 text-lg">→</span>
        </Link>
      )}

      {loading && (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 rounded-full border-2 border-neutral-200 border-t-pink-500 animate-spin" />
        </div>
      )}

      {!loading && !userId && (
        <div className="text-center py-20 space-y-3">
          <p className="text-4xl">📖</p>
          <p className="font-semibold text-neutral-700">Your scrapbook is empty</p>
          <p className="text-sm text-neutral-400">Make a sticker and share it to start your collection.</p>
          <Link href="/capture"
            className="inline-block mt-2 px-5 py-2.5 rounded-xl bg-black text-white text-sm font-medium">
            Make a Sticker
          </Link>
        </div>
      )}

      {!loading && userId && stickers.length === 0 && (
        <div className="text-center py-20 space-y-3">
          <p className="text-4xl">📖</p>
          <p className="font-semibold text-neutral-700">No stickers yet</p>
          <p className="text-sm text-neutral-400">Create and share stickers to fill your scrapbook.</p>
          <Link href="/capture"
            className="inline-block mt-2 px-5 py-2.5 rounded-xl bg-black text-white text-sm font-medium">
            Make a Sticker
          </Link>
        </div>
      )}

      {!loading && userId && Object.entries(grouped).map(([location, items]) => (
        <section key={location} className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-base">📍</span>
            <h2 className="font-semibold text-base">{location}</h2>
            <span className="text-xs text-neutral-400">{items.length} post{items.length !== 1 ? "s" : ""}</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {items.map((sticker) => (
              <StickerCard
                key={sticker.id}
                sticker={sticker}
                userId={userId}
                onDeleted={(id) => setStickers((prev) => prev.filter((x) => x.id !== id))}
                onCaptionUpdated={(id, cap) =>
                  setStickers((prev) => prev.map((x) => x.id === id ? { ...x, caption: cap || null } : x))
                }
              />
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
