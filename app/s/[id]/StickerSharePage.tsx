"use client";

import type { StickerPost } from "@/types";
import ShareButton from "@/components/ShareButton";
import Link from "next/link";

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function StickerSharePage({ sticker }: { sticker: StickerPost }) {
  return (
    <main className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm space-y-4">
        {/* Card */}
        <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="w-9 h-9 rounded-full bg-pink-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
              {sticker.username[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">{sticker.username}</p>
              {sticker.location_name && (
                <p className="text-xs text-neutral-400 truncate">📍 {sticker.location_name}</p>
              )}
            </div>
            <span className="text-xs text-neutral-300 shrink-0">{timeAgo(sticker.created_at)}</span>
          </div>

          {/* Sticker image */}
          <div className="flex items-center justify-center py-8 px-4"
            style={{ background: "linear-gradient(135deg, #667eea22, #764ba222)" }}>
            <img
              src={sticker.image_url}
              alt={sticker.caption ?? "sticker"}
              className="max-h-64 max-w-full object-contain rounded-xl"
              style={{ filter: "drop-shadow(0 0 6px rgba(0,0,0,0.4)) drop-shadow(0 4px 12px rgba(0,0,0,0.2))" }}
            />
          </div>

          {/* Caption */}
          {sticker.caption && (
            <div className="px-4 py-3 border-t border-neutral-50">
              <p className="text-sm text-neutral-700">{sticker.caption}</p>
            </div>
          )}
        </div>

        {/* Share + CTA */}
        <ShareButton
          title={sticker.caption ?? `${sticker.username}'s sticker`}
          text={[sticker.caption, sticker.location_name ? `📍 ${sticker.location_name}` : null]
            .filter(Boolean).join(" · ") || "Check out this sticker on whimsi!"}
          imageUrl={sticker.image_url}
          className="w-full"
        />

        <Link href="/"
          className="block text-center text-sm text-neutral-400 hover:text-neutral-600 transition">
          Discover more on whimsi →
        </Link>
      </div>
    </main>
  );
}
