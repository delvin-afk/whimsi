"use client";

import { useState } from "react";

interface Props {
  title: string;
  text: string;
  /** Full URL to share. Defaults to current page URL if omitted. */
  url?: string;
  /** If provided, also offers "Share Image" option via Web Share API files */
  imageUrl?: string;
  className?: string;
}

export default function ShareButton({ title, text, url, imageUrl, className = "" }: Props) {
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);

  const shareUrl = url ?? (typeof window !== "undefined" ? window.location.href : "");

  async function shareLink() {
    if (navigator.share) {
      try {
        setSharing(true);
        await navigator.share({ title, text, url: shareUrl });
      } catch {
        // User cancelled — do nothing
      } finally {
        setSharing(false);
      }
    } else {
      // Fallback: copy to clipboard
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  async function shareImage() {
    if (!imageUrl) return;
    try {
      setSharing(true);
      const res = await fetch(imageUrl);
      const blob = await res.blob();
      const file = new File([blob], "sticker.png", { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title, text });
      } else {
        // Fallback: open image in new tab so user can save/share manually
        window.open(imageUrl, "_blank");
      }
    } catch {
      // User cancelled
    } finally {
      setSharing(false);
    }
  }

  const canShareFiles = typeof navigator !== "undefined" && !!navigator.share;

  return (
    <div className={`flex gap-2 ${className}`}>
      <button
        onClick={shareLink}
        disabled={sharing}
        className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-[#4ade80] text-black font-semibold text-sm disabled:opacity-50 transition active:scale-95"
      >
        {copied ? (
          <>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 13l4 4L19 7"/></svg>
            Link copied!
          </>
        ) : (
          <>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
              <polyline points="16 6 12 2 8 6"/>
              <line x1="12" y1="2" x2="12" y2="15"/>
            </svg>
            {canShareFiles ? "Share" : "Copy Link"}
          </>
        )}
      </button>

      {imageUrl && (
        <button
          onClick={shareImage}
          disabled={sharing}
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border border-neutral-200 bg-white text-neutral-700 font-medium text-sm disabled:opacity-50 transition active:scale-95 hover:bg-neutral-50"
          title="Share sticker image"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
          Image
        </button>
      )}
    </div>
  );
}
