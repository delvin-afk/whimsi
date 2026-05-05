"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { StickerPost, Journey } from "@/types";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import ExploreSheet from "@/components/map/ExploreSheet";
import MemoryView from "@/components/map/MemoryView";
import type { StickerClickPayload } from "@/components/MapView";

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

type MemoryState = {
  stop: StickerPost;
  stopIndex: number | null;
  journeyStops: StickerPost[] | null;
  journeyTitle: string | null;
  color: string;
};

export default function MapPage() {
  const [stickers, setStickers] = useState<StickerPost[]>([]);
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialJourneyId, setInitialJourneyId] = useState<string | null>(null);
  const [selectedJourneyId, setSelectedJourneyId] = useState<string | null>(null);
  const [memory, setMemory] = useState<MemoryState | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setInitialJourneyId(params.get("journey"));
  }, []);

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

  function handleStickerClick(payload: StickerClickPayload) {
    setMemory({
      stop: payload.stop,
      stopIndex: payload.stopIndex,
      journeyStops: payload.journeyStops,
      journeyTitle: payload.journeyTitle,
      color: payload.color,
    });
  }

  function handleMemoryNavigate(stop: StickerPost, index: number) {
    setMemory((prev) => prev ? { ...prev, stop, stopIndex: index } : prev);
  }

  function handleMemoryClose() {
    setMemory(null);
  }

  return (
    <div className="fixed inset-0" style={{ zIndex: 0 }}>
      {loading ? (
        <div className="w-full h-full flex items-center justify-center bg-neutral-100">
          <div className="h-8 w-8 rounded-full border-2 border-neutral-300 border-t-neutral-700 animate-spin" />
        </div>
      ) : (
        <MapView
          stickers={stickers}
          journeys={journeys}
          initialJourneyId={initialJourneyId}
          selectedJourneyId={selectedJourneyId}
          onJourneySelect={setSelectedJourneyId}
          onStickerClick={handleStickerClick}
        />
      )}

      <ExploreSheet
        journeys={journeys}
        selectedJourneyId={selectedJourneyId}
        onJourneySelect={setSelectedJourneyId}
        hidden={!!memory}
      />

      {memory && (
        <MemoryView
          stop={memory.stop}
          stopIndex={memory.stopIndex}
          journeyStops={memory.journeyStops}
          journeyTitle={memory.journeyTitle}
          color={memory.color}
          onClose={handleMemoryClose}
          onNavigate={handleMemoryNavigate}
        />
      )}
    </div>
  );
}
