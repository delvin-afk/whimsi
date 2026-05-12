"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { Journey } from "@/types";

const ACCENT = "#22c55e";

function avatarColor(username: string) {
  const colors = ["#f43f5e", "#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#06b6d4"];
  let hash = 0;
  for (const c of username) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff;
  return colors[Math.abs(hash) % colors.length];
}

export default function PublicProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const router = useRouter();
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/journeys?profile_user_id=${userId}`)
      .then((r) => r.json())
      .then((data) => {
        setJourneys(data.journeys ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [userId]);

  const profile = journeys[0] ?? null;
  const username = profile?.username ?? "…";
  const avatarUrl = profile?.avatar_url ?? null;
  const color = profile ? avatarColor(profile.username) : "#888";

  return (
    <div className="min-h-dvh" style={{ background: "#0f0f11" }}>
      {/* Header */}
      <div
        className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3"
        style={{
          background: "rgba(15,15,17,0.92)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          paddingTop: "max(env(safe-area-inset-top), 12px)",
        }}
      >
        <button
          onClick={() => router.back()}
          className="w-8 h-8 flex items-center justify-center rounded-full shrink-0"
          style={{ background: "rgba(255,255,255,0.08)" }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <p className="text-white font-bold text-base flex-1 truncate">{username}</p>
      </div>

      {/* Profile hero */}
      <div className="flex flex-col items-center gap-3 px-4 pt-8 pb-6">
        <div
          className="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center text-white font-bold text-2xl"
          style={{ background: avatarUrl ? "transparent" : color }}
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt={username} className="w-full h-full object-cover" />
          ) : (
            username[0]?.toUpperCase()
          )}
        </div>
        <p className="text-white font-bold text-xl">{username}</p>
        {!loading && (
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>
            {journeys.length} {journeys.length === 1 ? "journey" : "journeys"}
          </p>
        )}
      </div>

      {/* Journeys list */}
      <div className="px-4 pb-24 space-y-3">
        {loading && (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 rounded-full border-2 border-neutral-700 border-t-neutral-300 animate-spin" />
          </div>
        )}

        {!loading && journeys.length === 0 && (
          <p className="text-center py-12 text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>
            No public journeys yet
          </p>
        )}

        {journeys.map((journey) => {
          const stopCount = journey.stickers.length;
          const firstLocation = journey.stickers.find((s) => s.location_name)?.location_name ?? null;
          const dateDisplay = new Date(journey.created_at).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          });

          return (
            <Link
              key={journey.id}
              href={`/journey/${journey.id}`}
              className="block rounded-2xl px-4 py-4 active:opacity-70 transition-opacity"
              style={{
                background: "#1c1c1e",
                border: "1.5px solid rgba(255,255,255,0.06)",
              }}
            >
              <p className="text-white font-bold text-base leading-snug mb-1">
                {journey.caption ?? `${journey.username}'s Journey`}
              </p>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>
                {dateDisplay}
                {firstLocation ? ` · ${firstLocation}` : ""}
                {" · "}
                {stopCount} {stopCount === 1 ? "stop" : "stops"}
              </p>
              <div className="mt-3 flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ background: ACCENT }} />
                <span className="text-xs font-medium" style={{ color: ACCENT }}>
                  View journey
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
