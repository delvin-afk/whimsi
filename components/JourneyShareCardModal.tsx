"use client";

import { useState } from "react";

interface Props {
  journeyId: string;
  journeyTitle: string;
  journeyUrl: string;
  onClose: () => void;
}

export default function JourneyShareCardModal({ journeyId, journeyTitle, journeyUrl, onClose }: Props) {
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  const cardSrc = `/api/share/journey/${journeyId}`;

  async function shareCard() {
    setSharing(true);
    try {
      const res = await fetch(cardSrc);
      const blob = await res.blob();
      const file = new File([blob], "whimsi-journey.png", { type: "image/png" });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: journeyTitle,
          text: journeyTitle,
          url: journeyUrl,
        });
      } else if (navigator.share) {
        await navigator.share({ title: journeyTitle, text: journeyTitle, url: journeyUrl });
      } else {
        // Fallback: download the image
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

  async function copyLink() {
    await navigator.clipboard.writeText(journeyUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Sheet */}
      <div className="relative w-full max-w-lg bg-neutral-900 rounded-t-3xl overflow-hidden pb-10">
        {/* Handle */}
        <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mt-4 mb-4" />

        <div className="px-5 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <p className="text-white font-semibold text-base">Share Journey Card</p>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 text-white/60 hover:bg-white/20 transition">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          {/* Card preview */}
          <div className="rounded-2xl overflow-hidden bg-neutral-800 aspect-square">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cardSrc}
              alt="Journey share card"
              className="w-full h-full object-cover"
            />
          </div>

          {/* Action buttons */}
          <button
            onClick={shareCard}
            disabled={sharing}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-[#a855f7] text-white font-semibold text-sm disabled:opacity-50 transition active:scale-95"
          >
            {sharing ? (
              <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                <polyline points="16 6 12 2 8 6"/>
                <line x1="12" y1="2" x2="12" y2="15"/>
              </svg>
            )}
            {sharing ? "Preparing…" : "Share Card"}
          </button>

          <button
            onClick={copyLink}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-white/10 text-neutral-300 text-sm font-medium hover:bg-white/5 transition active:scale-95"
          >
            {copied ? (
              <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 13l4 4L19 7"/></svg>
                Link copied!
              </>
            ) : (
              <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
                Copy Link
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
