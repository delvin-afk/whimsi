"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function BottomNav() {
  const pathname = usePathname();

  if (pathname.startsWith("/auth")) return null;

  const createActive = pathname.startsWith("/capture") || pathname.startsWith("/scrapbook/create");
  const feedActive = pathname === "/feed";
  const mapActive = pathname.startsWith("/map");
  const profileActive = pathname.startsWith("/profile");

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 bg-white border-t border-neutral-200 flex items-center justify-around h-16 px-2 pb-[env(safe-area-inset-bottom)]">
      <Link
        href="/feed"
        className={`flex flex-col items-center gap-0.5 px-4 py-1 rounded-xl transition-colors ${feedActive ? "text-pink-500" : "text-neutral-400 hover:text-neutral-700"}`}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path
            d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
            stroke="currentColor"
            strokeWidth={feedActive ? 2.5 : 1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill={feedActive ? "currentColor" : "none"}
            fillOpacity={feedActive ? 0.15 : 0}
          />
        </svg>
        <span className="text-[10px] font-medium">Feed</span>
      </Link>

      <Link
        href="/capture"
        className={`flex flex-col items-center gap-0.5 px-4 py-1 rounded-xl transition-colors ${createActive ? "text-pink-500" : "text-neutral-400 hover:text-neutral-700"}`}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <circle
            cx="12" cy="12" r="9"
            stroke="currentColor"
            strokeWidth={createActive ? 2.5 : 1.5}
            fill={createActive ? "currentColor" : "none"}
            fillOpacity={createActive ? 0.15 : 0}
          />
          <path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth={createActive ? 2.5 : 1.5} strokeLinecap="round" />
        </svg>
        <span className="text-[10px] font-medium">Create</span>
      </Link>

      <Link
        href="/map"
        className={`flex flex-col items-center gap-0.5 px-4 py-1 rounded-xl transition-colors ${mapActive ? "text-pink-500" : "text-neutral-400 hover:text-neutral-700"}`}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path
            d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 9m0 8V9M9 7l6 2"
            stroke="currentColor"
            strokeWidth={mapActive ? 2.5 : 1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="text-[10px] font-medium">Map</span>
      </Link>

      <Link
        href="/profile"
        className={`flex flex-col items-center gap-0.5 px-4 py-1 rounded-xl transition-colors ${profileActive ? "text-pink-500" : "text-neutral-400 hover:text-neutral-700"}`}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth={profileActive ? 2.5 : 1.5} fill={profileActive ? "currentColor" : "none"} fillOpacity={profileActive ? 0.15 : 0} />
          <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth={profileActive ? 2.5 : 1.5} strokeLinecap="round" />
        </svg>
        <span className="text-[10px] font-medium">Profile</span>
      </Link>
    </nav>
  );
}
