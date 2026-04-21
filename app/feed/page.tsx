"use client";

import { useEffect, useState } from "react";
import type { StickerPost, Journey } from "@/types";
import Link from "next/link";
import StickerOptionsSheet from "@/components/StickerOptionsSheet";
import ShareButton from "@/components/ShareButton";
import JourneyShareCardModal from "@/components/JourneyShareCardModal";
import { getSupabaseBrowser } from "@/lib/supabase/browser";

const JOURNEY_COLORS = ["#a855f7", "#3b82f6", "#f97316", "#ec4899", "#14b8a6"];

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function avatarColor(username: string) {
  const colors = ["#f43f5e", "#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#06b6d4", "#ec4899"];
  let hash = 0;
  for (const c of username) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff;
  return colors[Math.abs(hash) % colors.length];
}

function Avatar({ username }: { username: string }) {
  return (
    <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
      style={{ background: avatarColor(username) }}>
      {username[0]?.toUpperCase()}
    </div>
  );
}

// ── Solo sticker card ─────────────────────────────────────────────────────────
function PostCard({ post, currentUserId, onDeleted, onCaptionUpdated }: {
  post: StickerPost;
  currentUserId: string | null;
  onDeleted: (id: string) => void;
  onCaptionUpdated: (id: string, caption: string) => void;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const isOwner = currentUserId === post.user_id;

  async function handleDelete() {
    const res = await fetch(`/api/stickers/${post.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: currentUserId }),
    });
    if (res.ok) onDeleted(post.id);
  }

  async function handleEditCaption(newCaption: string) {
    const res = await fetch(`/api/stickers/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: currentUserId, caption: newCaption || null }),
    });
    if (res.ok) onCaptionUpdated(post.id, newCaption);
  }

  return (
    <>
      <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3">
          <Avatar username={post.username} />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">{post.username}</p>
            {post.location_name && <p className="text-xs text-neutral-400 truncate">📍 {post.location_name}</p>}
          </div>
          <span className="text-xs text-neutral-300 shrink-0">{timeAgo(post.created_at)}</span>
          {isOwner && (
            <button onClick={() => setSheetOpen(true)}
              className="ml-1 w-8 h-8 flex items-center justify-center rounded-full hover:bg-neutral-100 text-neutral-400 font-bold text-lg shrink-0">
              ···
            </button>
          )}
        </div>
        <div className="flex items-center justify-center py-6 px-4"
          style={{ background: "linear-gradient(135deg, #667eea22, #764ba222)" }}>
          <img src={post.image_url} alt={post.caption ?? "sticker"}
            className="max-h-64 max-w-full object-contain rounded-xl"
            style={{ filter: "drop-shadow(0 0 6px rgba(0,0,0,0.4)) drop-shadow(0 4px 12px rgba(0,0,0,0.2))" }} />
        </div>
        {post.caption && (
          <div className="px-4 py-3 border-t border-neutral-50">
            <p className="text-sm text-neutral-700">{post.caption}</p>
          </div>
        )}

        {post.voice_url && (
          <div className="px-4 py-3 border-t border-neutral-50 flex items-center gap-3">
            <span className="w-7 h-7 rounded-full bg-[#4ade80] flex items-center justify-center shrink-0">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <rect x="9" y="2" width="6" height="12" rx="3" stroke="black" strokeWidth="1.5"/>
                <path d="M5 10a7 7 0 0 0 14 0" stroke="black" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </span>
            <audio src={post.voice_url} controls className="flex-1 h-9" />
          </div>
        )}
        <div className="px-4 pb-4 pt-2">
          <ShareButton
            title={post.caption ?? `${post.username}'s sticker`}
            text={[post.caption, post.location_name ? `📍 ${post.location_name}` : null].filter(Boolean).join(" · ") || "Check out this sticker on whimsi!"}
            url={`${typeof window !== "undefined" ? window.location.origin : ""}/s/${post.id}`}
            imageUrl={post.image_url}
          />
        </div>
      </div>
      {isOwner && (
        <StickerOptionsSheet open={sheetOpen} onClose={() => setSheetOpen(false)}
          initialCaption={post.caption} onEditCaption={handleEditCaption} onDelete={handleDelete} />
      )}
    </>
  );
}

// ── Journey card ──────────────────────────────────────────────────────────────
function JourneyCard({ journey, currentUserId, colorIndex, onMadePublic }: {
  journey: Journey;
  currentUserId: string | null;
  colorIndex: number;
  onMadePublic: (id: string) => void;
}) {
  const isOwner = currentUserId === journey.user_id;
  const color = JOURNEY_COLORS[colorIndex % JOURNEY_COLORS.length];
  const stops = journey.stickers.filter((s) => s.lat != null);
  const [sharing, setSharing] = useState(false);
  const [shared, setShared] = useState(journey.is_public);
  const [showShareCard, setShowShareCard] = useState(false);

  const dateRange = (() => {
    const withTime = journey.stickers.filter((s) => s.photo_taken_at);
    if (withTime.length < 2) return timeAgo(journey.created_at);
    const sorted = [...withTime].sort((a, b) =>
      new Date(a.photo_taken_at!).getTime() - new Date(b.photo_taken_at!).getTime()
    );
    const first = new Date(sorted[0].photo_taken_at!);
    const last = new Date(sorted[sorted.length - 1].photo_taken_at!);
    const sameDay = first.toDateString() === last.toDateString();
    return sameDay
      ? first.toLocaleDateString(undefined, { dateStyle: "medium" })
      : `${first.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${last.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
  })();

  const uniqueLocations = [...new Set(
    journey.stickers.map((s) => s.location_name).filter(Boolean)
  )].slice(0, 3);

  async function shareToFeed() {
    setSharing(true);
    try {
      const res = await fetch(`/api/journeys/${journey.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUserId, is_public: true }),
      });
      if (res.ok) { setShared(true); onMadePublic(journey.id); }
    } finally {
      setSharing(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
      {/* Coloured top bar */}
      <div className="h-1.5 w-full" style={{ background: color }} />

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <Avatar username={journey.username} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="font-semibold text-sm">{journey.username}</p>
            {!shared && isOwner && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-600 font-medium">Private</span>
            )}
          </div>
          <p className="text-xs text-neutral-400">{dateRange}</p>
        </div>
        <span className="text-xs text-neutral-300 shrink-0">{timeAgo(journey.created_at)}</span>
      </div>

      {/* Caption */}
      {journey.caption && (
        <div className="px-4 pb-2">
          <p className="font-semibold text-base">{journey.caption}</p>
        </div>
      )}

      {/* Sticker strip */}
      <div className="px-4 pb-3">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {journey.stickers.map((s, i) => (
            <div key={s.id} className="relative shrink-0">
              <div className="w-20 h-20 rounded-xl overflow-hidden border border-neutral-100 bg-neutral-50 flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, #667eea18, #764ba218)" }}>
                <img src={s.image_url} alt="" className="max-w-full max-h-full object-contain p-1"
                  style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.25))" }} />
              </div>
              {/* Stop number badge */}
              <span className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full text-white text-xs font-bold flex items-center justify-center shadow"
                style={{ background: color }}>
                {i + 1}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Stats row */}
      <div className="px-4 pb-3 flex items-center gap-3 flex-wrap">
        <span className="flex items-center gap-1 text-xs text-neutral-500">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
          {journey.stickers.length} stops
        </span>
        {stops.length > 0 && (
          <span className="flex items-center gap-1 text-xs text-neutral-500">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            {stops.length} pinned
          </span>
        )}
        {uniqueLocations.length > 0 && (
          <span className="text-xs text-neutral-400 truncate">
            {uniqueLocations.join(" → ")}
          </span>
        )}
      </div>

      {/* Share to feed button — only owner sees it when still private */}
      {isOwner && !shared && (
        <div className="px-4 pb-4">
          <button onClick={shareToFeed} disabled={sharing}
            className="w-full py-2.5 rounded-xl border-2 text-sm font-semibold transition disabled:opacity-50"
            style={{ borderColor: color, color }}>
            {sharing ? "Sharing…" : "Share Journey to Feed"}
          </button>
        </div>
      )}

      {shared && !isOwner && (
        <div className="px-4 pb-4 space-y-2">
          <Link href="/map" className="block text-center py-2.5 rounded-xl text-sm font-semibold text-white"
            style={{ background: color }}>
            View on Map
          </Link>
          <button
            onClick={() => setShowShareCard(true)}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold text-white transition active:scale-95"
            style={{ background: color }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
            Share Card
          </button>
        </div>
      )}

      {shared && isOwner && (
        <div className="px-4 pb-4 space-y-2">
          <div className="flex gap-2">
            <span className="flex-1 text-center py-2 rounded-xl text-xs font-medium text-neutral-400 border border-neutral-100">
              Shared publicly
            </span>
            <Link href="/map" className="flex-1 block text-center py-2 rounded-xl text-xs font-semibold text-white"
              style={{ background: color }}>
              View on Map
            </Link>
          </div>
          <button
            onClick={() => setShowShareCard(true)}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold text-white transition active:scale-95"
            style={{ background: color }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
            Share Card
          </button>
        </div>
      )}

      {showShareCard && (
        <JourneyShareCardModal
          journeyId={journey.id}
          journeyUrl={`${typeof window !== "undefined" ? window.location.origin : ""}/journey/${journey.id}`}
          onClose={() => setShowShareCard(false)}
        />
      )}
    </div>
  );
}

// ── Feed page ─────────────────────────────────────────────────────────────────
export default function FeedPage() {
  const [posts, setPosts] = useState<StickerPost[]>([]);
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    getSupabaseBrowser().auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id ?? null;
      setCurrentUserId(uid);
      const params = uid ? `?user_id=${uid}` : "";

      const [postsRes, journeysRes] = await Promise.all([
        fetch("/api/stickers?exclude_journey=true").then((r) => r.json()).catch(() => ({ stickers: [] })),
        fetch(`/api/journeys${params}`).then((r) => r.json()).catch(() => ({ journeys: [] })),
      ]);

      setPosts(postsRes.stickers ?? []);
      setJourneys(journeysRes.journeys ?? []);
      setLoading(false);
    });
  }, []);

  // Merge posts + journeys into a single time-sorted list
  type FeedItem =
    | { type: "post"; data: StickerPost; time: number }
    | { type: "journey"; data: Journey; time: number };

  const feedItems: FeedItem[] = [
    ...posts.map((p) => ({ type: "post" as const, data: p, time: new Date(p.created_at).getTime() })),
    ...journeys.map((j) => ({ type: "journey" as const, data: j, time: new Date(j.created_at).getTime() })),
  ].sort((a, b) => b.time - a.time);

  const isEmpty = !loading && feedItems.length === 0;

  return (
    <main className="max-w-lg mx-auto px-4 pt-5 pb-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Feed</h1>
        <Link href="/map" className="text-sm text-pink-500 font-medium">View map →</Link>
      </div>

      {loading && (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 rounded-full border-2 border-neutral-200 border-t-pink-500 animate-spin" />
        </div>
      )}

      {isEmpty && (
        <div className="text-center py-20 space-y-3">
          <p className="text-4xl">🎨</p>
          <p className="font-semibold text-neutral-700">No stickers yet</p>
          <p className="text-sm text-neutral-400">Be the first — make a sticker and share it!</p>
          <Link href="/capture"
            className="inline-block mt-2 px-5 py-2.5 rounded-xl bg-[#4ade80] text-black text-sm font-bold">
            Make a Sticker
          </Link>
        </div>
      )}

      {!loading && feedItems.map((item, i) => {
        if (item.type === "post") {
          return (
            <PostCard key={item.data.id} post={item.data} currentUserId={currentUserId}
              onDeleted={(id) => setPosts((prev) => prev.filter((x) => x.id !== id))}
              onCaptionUpdated={(id, cap) =>
                setPosts((prev) => prev.map((x) => x.id === id ? { ...x, caption: cap || null } : x))
              }
            />
          );
        }
        return (
          <JourneyCard key={item.data.id} journey={item.data} currentUserId={currentUserId}
            colorIndex={i}
            onMadePublic={(id) =>
              setJourneys((prev) => prev.map((j) => j.id === id ? { ...j, is_public: true } : j))
            }
          />
        );
      })}
    </main>
  );
}
