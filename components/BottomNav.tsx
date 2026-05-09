"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/browser";

const ACTIVE = "#4ade80";
const INACTIVE = "#6b7280";

export default function BottomNav() {
  const pathname = usePathname();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAvatar() {
      const supabase = getSupabaseBrowser();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: profile } = await (supabase as any)
        .from("profiles").select("avatar_url").eq("id", auth.user.id).single();
      if (profile?.avatar_url) setAvatarUrl(profile.avatar_url);
    }
    fetchAvatar();

    const handleAvatarUpdate = (e: Event) => {
      const url = (e as CustomEvent<{ url: string }>).detail?.url;
      if (url) setAvatarUrl(url);
    };
    window.addEventListener("avatar-updated", handleAvatarUpdate);
    return () => window.removeEventListener("avatar-updated", handleAvatarUpdate);
  }, []);

  if (pathname.startsWith("/auth")) return null;

  const feedActive    = pathname === "/feed";
  const createActive  = pathname.startsWith("/capture") || pathname.startsWith("/scrapbook/create");
  const mapActive     = pathname.startsWith("/map");
  const profileActive = pathname.startsWith("/profile");

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-50 flex items-center justify-around px-2"
      style={{
        background: "#000",
        height: `calc(64px + env(safe-area-inset-bottom))`,
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {/* Feed */}
      <Link
        href="/feed"
        onClick={() => { if (pathname === "/feed") window.scrollTo({ top: 0, behavior: "smooth" }); }}
        className="flex flex-col items-center justify-center gap-1 w-14 h-14"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={feedActive ? ACTIVE : INACTIVE} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
        <span style={{ fontSize: 10, color: feedActive ? ACTIVE : INACTIVE }}>Feed</span>
      </Link>

      {/* Create */}
      <Link
        href="/capture"
        className="flex flex-col items-center justify-center gap-1 w-14 h-14"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={createActive ? ACTIVE : INACTIVE} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
          <circle cx="12" cy="13" r="4"/>
        </svg>
        <span style={{ fontSize: 10, color: createActive ? ACTIVE : INACTIVE }}>Create</span>
      </Link>

      {/* Map */}
      <Link
        href="/map"
        className="flex flex-col items-center justify-center gap-1 w-14 h-14"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={mapActive ? ACTIVE : INACTIVE} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/>
          <line x1="9" y1="3" x2="9" y2="18"/>
          <line x1="15" y1="6" x2="15" y2="21"/>
        </svg>
        <span style={{ fontSize: 10, color: mapActive ? ACTIVE : INACTIVE }}>Map</span>
      </Link>

      {/* Profile — star icon */}
      <Link
        href="/profile"
        onClick={() => { if (pathname.startsWith("/profile")) window.scrollTo({ top: 0, behavior: "smooth" }); }}
        className="flex flex-col items-center justify-center gap-1 w-14 h-14"
      >
        {avatarUrl && profileActive ? (
          <div className="w-6 h-6 rounded-full overflow-hidden" style={{ border: `2px solid ${ACTIVE}` }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={avatarUrl} alt="profile" className="w-full h-full object-cover" />
          </div>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={profileActive ? ACTIVE : INACTIVE} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
        )}
        <span style={{ fontSize: 10, color: profileActive ? ACTIVE : INACTIVE }}>Profile</span>
      </Link>
    </nav>
  );
}
