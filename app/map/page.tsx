"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { StickerPost } from "@/types";

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

export default function MapPage() {
  const [stickers, setStickers] = useState<StickerPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/stickers")
      .then((r) => r.json())
      .then((j) => setStickers(j.stickers ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <h1 className="text-xl font-bold">Sticker Map</h1>
        <span className="text-sm text-neutral-400">
          {stickers.filter((s) => s.lat).length} pinned
        </span>
      </div>

      {/* Map — fills remaining viewport minus header + bottom nav */}
      <div className="flex-1 px-4 pb-4 min-h-0">
        {loading ? (
          <div className="w-full h-full rounded-2xl bg-neutral-100 flex items-center justify-center">
            <div className="h-8 w-8 rounded-full border-2 border-neutral-300 border-t-neutral-700 animate-spin" />
          </div>
        ) : (
          <MapView stickers={stickers} />
        )}
      </div>
    </div>
  );
}
