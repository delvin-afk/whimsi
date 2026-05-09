"use client";

import { useState } from "react";
import type { Journey } from "@/types";
import JourneyCard from "./JourneyCard";

interface Props {
  journeys: Journey[];
  selectedJourneyId: string | null;
  onJourneySelect: (id: string | null) => void;
  hidden?: boolean;
}

const SHEET_VH = 60;
const PEEK_PX = 60;

export default function ExploreSheet({ journeys, selectedJourneyId, onJourneySelect, hidden }: Props) {
  const [open, setOpen] = useState(false);

  const translateY = hidden
    ? "100%"
    : open
    ? "0px"
    : `calc(${SHEET_VH}vh - ${PEEK_PX}px)`;

  return (
    <div
      className="lg:hidden fixed left-0 right-0 z-40 flex flex-col"
      style={{
        bottom: 64,
        height: `${SHEET_VH}vh`,
        background: "#1a1a1e",
        borderRadius: "24px 24px 0 0",
        boxShadow: "0 -8px 32px rgba(0,0,0,0.4)",
        transform: `translateY(${translateY})`,
        transition: "transform 0.35s cubic-bezier(0.32,0.72,0,1)",
        willChange: "transform",
      }}
    >
      {/* Drag handle */}
      <div
        className="flex flex-col items-center pt-3 pb-1 shrink-0 cursor-pointer select-none"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="w-10 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.2)" }} />
      </div>

      {/* Header */}
      <div
        className="px-2 pt-2 pb-2 shrink-0 flex items-center justify-between cursor-pointer"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="text-sm" style={{ color: "rgba(255,255,255,0.4)", minWidth: 60 }}>
          {journeys.length} journeys
        </span>
        <span className="font-semibold text-base text-white text-center flex-1">Explore Journeys</span>
        <span style={{ minWidth: 60 }} />
      </div>

      {/* Divider */}
      <div className="h-px mx-5 shrink-0" style={{ background: "rgba(255,255,255,0.08)" }} />

      {/* Scrollable journey list */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        <div className="px-4 pt-3 pb-6 flex flex-col gap-3">
          {journeys.length === 0 ? (
            <p className="text-center text-sm py-8" style={{ color: "rgba(255,255,255,0.3)" }}>
              No journeys yet
            </p>
          ) : (
            journeys.map((journey) => (
              <JourneyCard
                key={journey.id}
                journey={journey}
                isSelected={selectedJourneyId === journey.id}
                onTap={() => {
                  onJourneySelect(journey.id);
                  setOpen(false);
                }}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
