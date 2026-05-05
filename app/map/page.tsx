"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { StickerPost, Journey } from "@/types";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import ExploreSheet from "@/components/map/ExploreSheet";
import MemoryView from "@/components/map/MemoryView";
import JourneyCard from "@/components/map/JourneyCard";
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
  const router = useRouter();

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

  const selectedJourney = journeys.find((j) => j.id === selectedJourneyId) ?? null;

  return (
    <div className="fixed inset-0" style={{ zIndex: 0 }}>
      {/* ── Desktop sidebar (lg+) ───────────────────────────────────────── */}
      <aside
        className="hidden lg:flex flex-col fixed left-0 top-0 bottom-0 z-50"
        style={{ width: 340, background: "#1a1a1e", borderRight: "1px solid rgba(255,255,255,0.06)" }}
      >
        {/* Header */}
        <div className="px-5 pt-8 pb-4 shrink-0">
          <h2 className="text-white font-bold text-xl">Explore Journeys</h2>
          <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
            {journeys.length} journeys
          </p>
        </div>
        <div className="h-px mx-5 shrink-0" style={{ background: "rgba(255,255,255,0.08)" }} />

        {/* Journey list or detail */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {selectedJourney ? (
            /* Detail view */
            <div className="px-4 pt-4 pb-6">
              <button
                onClick={() => setSelectedJourneyId(null)}
                className="flex items-center gap-2 mb-4 text-sm"
                style={{ color: "rgba(255,255,255,0.5)" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
                All journeys
              </button>
              <JourneyCard journey={selectedJourney} isSelected onTap={() => {}} />
              <button
                onClick={() => router.push(`/journey/${selectedJourney.id}`)}
                className="w-full mt-4 py-4 rounded-2xl font-semibold text-base text-white"
                style={{ background: "#22c55e" }}
              >
                Play Journey
              </button>
            </div>
          ) : (
            /* List view */
            <div className="px-4 pt-3 pb-6 flex flex-col gap-3">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="h-6 w-6 rounded-full border-2 border-white/20 border-t-white/60 animate-spin" />
                </div>
              ) : journeys.length === 0 ? (
                <p className="text-center text-sm py-8" style={{ color: "rgba(255,255,255,0.3)" }}>
                  No journeys yet
                </p>
              ) : (
                journeys.map((journey) => (
                  <JourneyCard
                    key={journey.id}
                    journey={journey}
                    isSelected={selectedJourneyId === journey.id}
                    onTap={() => setSelectedJourneyId(journey.id)}
                  />
                ))
              )}
            </div>
          )}
        </div>
      </aside>

      {/* ── Map (offset on desktop) ─────────────────────────────────────── */}
      <div className="absolute inset-0 lg:left-[340px]">
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
      </div>

      {/* ── Mobile bottom sheet (hidden on lg+) ─────────────────────────── */}
      <ExploreSheet
        journeys={journeys}
        selectedJourneyId={selectedJourneyId}
        onJourneySelect={setSelectedJourneyId}
        hidden={!!memory}
      />

      {/* ── Memory overlay (both breakpoints) ───────────────────────────── */}
      {memory && (
        <MemoryView
          stop={memory.stop}
          stopIndex={memory.stopIndex}
          journeyStops={memory.journeyStops}
          journeyTitle={memory.journeyTitle}
          color={memory.color}
          onClose={() => setMemory(null)}
          onNavigate={handleMemoryNavigate}
        />
      )}
    </div>
  );
}
