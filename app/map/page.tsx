"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { StickerPost, Journey } from "@/types";
import { getSupabaseBrowser } from "@/lib/supabase/browser";

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

export default function MapPage() {
  const [stickers, setStickers] = useState<StickerPost[]>([]);
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSupabaseBrowser().auth.getUser().then(async ({ data }) => {
      const userId = data.user?.id ?? null;
      const params = userId ? `?user_id=${userId}` : "";
      const excludeParams = userId
        ? `?exclude_journey=true&user_id=${userId}`
        : "?exclude_journey=true";

      const [stickersRes, journeysRes] = await Promise.all([
        fetch(`/api/stickers${excludeParams}`).then((r) => r.json()).catch(() => ({ stickers: [] })),
        fetch(`/api/journeys${params}`).then((r) => r.json()).catch(() => ({ journeys: [] })),
      ]);

      setStickers(stickersRes.stickers ?? []);
      setJourneys(journeysRes.journeys ?? []);
      setLoading(false);
    });
  }, []);

  return (
    <div className="flex flex-col h-screen">
      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <h1 className="text-xl font-bold">Sticker Map</h1>
        <span className="text-sm text-neutral-400">
          {stickers.filter((s) => s.lat).length} stickers · {journeys.length} journeys
        </span>
      </div>
      <div className="flex-1 px-4 pb-4 min-h-0">
        {loading ? (
          <div className="w-full h-full rounded-2xl bg-neutral-100 flex items-center justify-center">
            <div className="h-8 w-8 rounded-full border-2 border-neutral-300 border-t-neutral-700 animate-spin" />
          </div>
        ) : (
          <MapView stickers={stickers} journeys={journeys} />
        )}
      </div>
    </div>
  );
}
