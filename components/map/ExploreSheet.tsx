"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Journey } from "@/types";
import JourneyCard from "./JourneyCard";

type SheetState = "peeked" | "open" | "journey_detail";

interface Props {
  journeys: Journey[];
  selectedJourneyId: string | null;
  onJourneySelect: (id: string | null) => void;
  hidden?: boolean;
}

const SHEET_VH = 75;
const PEEK_PX = 56;

export default function ExploreSheet({ journeys, selectedJourneyId, onJourneySelect, hidden }: Props) {
  const [state, setState] = useState<SheetState>("peeked");
  const router = useRouter();

  const selectedJourney = journeys.find((j) => j.id === selectedJourneyId) ?? null;

  // When a journey is selected externally (e.g. from map line click), open detail
  useEffect(() => {
    if (selectedJourneyId && state === "peeked") setState("open");
  }, [selectedJourneyId]); // eslint-disable-line react-hooks/exhaustive-deps

  const translateY =
    hidden
      ? "100%"
      : state === "peeked"
      ? `calc(${SHEET_VH}vh - ${PEEK_PX}px)`
      : "0px";

  function openSheet() {
    setState("open");
  }

  function closeToDetail() {
    setState("journey_detail");
  }

  function backToList() {
    setState("open");
    onJourneySelect(null);
  }

  return (
    <div
      className="fixed left-0 right-0 z-40 flex flex-col"
      style={{
        bottom: 64,
        height: `${SHEET_VH}vh`,
        background: "white",
        borderRadius: "20px 20px 0 0",
        boxShadow: "0 -4px 24px rgba(0,0,0,0.10)",
        transform: `translateY(${translateY})`,
        transition: "transform 0.35s cubic-bezier(0.32,0.72,0,1)",
        willChange: "transform",
      }}
    >
      {/* Drag handle bar */}
      <div
        className="flex flex-col items-center pt-3 shrink-0 cursor-pointer select-none"
        onClick={() => state === "peeked" ? openSheet() : setState("peeked")}
      >
        <div className="w-10 h-1 rounded-full bg-neutral-200" />
      </div>

      {/* Header row */}
      <div className="px-5 pt-3 pb-3 shrink-0">
        {state === "journey_detail" && selectedJourney ? (
          <div className="flex items-center gap-3">
            <button
              onClick={backToList}
              className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-600 hover:bg-neutral-100 shrink-0"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <span className="font-semibold text-base text-neutral-900 truncate">
              {selectedJourney.caption ?? `${selectedJourney.username}'s Journey`}
            </span>
          </div>
        ) : (
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => state === "peeked" ? openSheet() : undefined}
          >
            <span className="font-semibold text-base text-neutral-900">Explore Journeys</span>
            <span className="text-sm text-neutral-400">{journeys.length} journeys</span>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="h-px bg-neutral-100 mx-5 shrink-0" />

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        {state === "open" && (
          <div className="px-4 pt-3 pb-6 flex flex-col gap-2">
            {journeys.length === 0 ? (
              <p className="text-center text-neutral-400 text-sm py-8">No journeys yet</p>
            ) : (
              journeys.map((journey) => (
                <JourneyCard
                  key={journey.id}
                  journey={journey}
                  isSelected={selectedJourneyId === journey.id}
                  onTap={() => {
                    onJourneySelect(journey.id);
                    closeToDetail();
                  }}
                />
              ))
            )}
          </div>
        )}

        {state === "journey_detail" && selectedJourney && (
          <div className="px-4 pt-3 pb-6">
            <JourneyCard
              journey={selectedJourney}
              isSelected
              onTap={() => {}}
            />
            <button
              onClick={() => router.push(`/journey/${selectedJourney.id}`)}
              className="w-full mt-4 py-4 rounded-2xl font-semibold text-base text-white"
              style={{ background: "#22c55e" }}
            >
              Play Journey
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
