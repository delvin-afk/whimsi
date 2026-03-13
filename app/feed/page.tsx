"use client";

import { useEffect, useState } from "react";
import type { StickerPost } from "@/types";
import Link from "next/link";
import StickerOptionsSheet from "@/components/StickerOptionsSheet";

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
    <div
      className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
      style={{ background: avatarColor(username) }}
    >
      {username[0]?.toUpperCase()}
    </div>
  );
}

function PostCard({
  post,
  currentUserId,
  onDeleted,
  onCaptionUpdated,
}: {
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
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3">
          <Avatar username={post.username} />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">{post.username}</p>
            {post.location_name && (
              <p className="text-xs text-neutral-400 truncate">📍 {post.location_name}</p>
            )}
          </div>
          <span className="text-xs text-neutral-300 shrink-0">{timeAgo(post.created_at)}</span>
          {isOwner && (
            <button
              onClick={() => setSheetOpen(true)}
              className="ml-1 w-8 h-8 flex items-center justify-center rounded-full hover:bg-neutral-100 text-neutral-400 font-bold text-lg shrink-0"
            >
              ···
            </button>
          )}
        </div>

        {/* Image */}
        <div
          className="flex items-center justify-center py-6 px-4"
          style={{ background: "linear-gradient(135deg, #667eea22, #764ba222)" }}
        >
          <img
            src={post.image_url}
            alt={post.caption ?? "sticker"}
            className="max-h-64 max-w-full object-contain rounded-xl"
            style={{ filter: "drop-shadow(0 0 6px rgba(0,0,0,0.4)) drop-shadow(0 4px 12px rgba(0,0,0,0.2))" }}
          />
        </div>

        {post.caption && (
          <div className="px-4 py-3 border-t border-neutral-50">
            <p className="text-sm text-neutral-700">{post.caption}</p>
          </div>
        )}
      </div>

      {isOwner && (
        <StickerOptionsSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          initialCaption={post.caption}
          onEditCaption={handleEditCaption}
          onDelete={handleDelete}
        />
      )}
    </>
  );
}

export default function FeedPage() {
  const [posts, setPosts] = useState<StickerPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    setCurrentUserId(localStorage.getItem("sticker_user_id"));
    fetch("/api/stickers")
      .then((r) => r.json())
      .then((j) => setPosts(j.stickers ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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

      {!loading && posts.length === 0 && (
        <div className="text-center py-20 space-y-3">
          <p className="text-4xl">🎨</p>
          <p className="font-semibold text-neutral-700">No stickers yet</p>
          <p className="text-sm text-neutral-400">Be the first — make a sticker and share it!</p>
          <Link href="/capture"
            className="inline-block mt-2 px-5 py-2.5 rounded-xl bg-black text-white text-sm font-medium">
            Make a Sticker
          </Link>
        </div>
      )}

      {!loading && posts.map((p) => (
        <PostCard
          key={p.id}
          post={p}
          currentUserId={currentUserId}
          onDeleted={(id) => setPosts((prev) => prev.filter((x) => x.id !== id))}
          onCaptionUpdated={(id, cap) =>
            setPosts((prev) => prev.map((x) => x.id === id ? { ...x, caption: cap || null } : x))
          }
        />
      ))}
    </main>
  );
}
