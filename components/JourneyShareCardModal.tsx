"use client";

import { useState } from "react";

interface Props {
  journeyId: string;
  journeyUrl: string;
  onClose: () => void;
}

export default function JourneyShareCardModal({ journeyId, journeyUrl, onClose }: Props) {
  const [sharing, setSharing] = useState(false);
  const cardSrc = `/api/share/journey/${journeyId}`;

  async function shareCard() {
    setSharing(true);
    try {
      if (navigator.share) {
        await navigator.share({ url: journeyUrl });
      } else {
        const res = await fetch(cardSrc);
        const blob = await res.blob();
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "whimsi-journey.png";
        a.click();
      }
    } catch {
      // User cancelled
    } finally {
      setSharing(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Sheet */}
      <div
        className="relative w-full max-w-lg rounded-t-3xl flex flex-col"
        style={{
          background: "#1c1c1e",
          paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))",
          maxHeight: "92dvh",
        }}
      >
        {/* Handle */}
        <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mt-4 mb-3 shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 mb-4 shrink-0">
          <p className="text-white font-bold text-lg">Share Journey Card</p>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full text-white/50 hover:text-white transition"
            style={{ background: "#2c2c2e" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Card preview — scrollable area so it never clips the button */}
        <div className="px-5 overflow-y-auto flex-1 min-h-0">
          <div className="rounded-2xl overflow-hidden aspect-square w-full mb-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cardSrc}
              alt="Journey share card"
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        {/* Share button — always visible at bottom */}
        <div className="px-5 pt-3 shrink-0">
          <button
            onClick={shareCard}
            disabled={sharing}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-white font-bold text-base disabled:opacity-50 transition active:scale-[0.98]"
            style={{ background: "#a855f7" }}
          >
            {sharing ? (
              <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            ) : (
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                <polyline points="16 6 12 2 8 6"/>
                <line x1="12" y1="2" x2="12" y2="15"/>
              </svg>
            )}
            {sharing ? "Preparing…" : "Share Card"}
          </button>
        </div>
      </div>
    </div>
  );
}
