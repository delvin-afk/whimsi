"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

function CreateMenu({ onClose }: { onClose: () => void }) {
  const router = useRouter();

  function go(href: string) {
    onClose();
    router.push(href);
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative z-50 w-full max-w-sm mx-4 mb-20 rounded-2xl overflow-hidden"
        style={{ background: "rgba(30,30,35,0.97)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => go("/capture?flow=journey")}
          className="w-full flex items-center gap-4 px-6 py-5 text-white active:bg-white/10 transition-colors"
        >
          <span className="text-xl font-light leading-none">+</span>
          <span className="text-base font-medium">Create Journey</span>
        </button>
        <div className="h-px bg-white/10 mx-6" />
        <button
          onClick={() => go("/capture?flow=sticker")}
          className="w-full flex items-center gap-4 px-6 py-5 text-white active:bg-white/10 transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="opacity-80">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="12" cy="12" r="3.5" fill="currentColor" opacity=".5" />
            <circle cx="8.5" cy="9" r="1" fill="currentColor" />
            <circle cx="15.5" cy="9" r="1" fill="currentColor" />
          </svg>
          <span className="text-base font-medium">Create Sticker</span>
        </button>
      </div>
    </div>
  );
}

export default function BottomNav() {
  const pathname = usePathname();
  const [showCreate, setShowCreate] = useState(false);

  if (pathname.startsWith("/auth")) return null;

  const isCreateActive = pathname.startsWith("/capture") || pathname.startsWith("/scrapbook/create");
  const feedActive = pathname === "/feed";
  const mapActive = pathname.startsWith("/map");
  const scrapbookActive = pathname.startsWith("/scrapbook") && !pathname.startsWith("/scrapbook/create");
  const profileActive = pathname.startsWith("/profile");
  const createActive = isCreateActive || showCreate;

  return (
    <>
      {showCreate && <CreateMenu onClose={() => setShowCreate(false)} />}
      <nav className="fixed bottom-0 inset-x-0 z-50 bg-white border-t border-neutral-200 flex items-center justify-around h-16 px-2 pb-[env(safe-area-inset-bottom)]">
        <Link
          href="/feed"
          onClick={() => setShowCreate(false)}
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

        <button
          onClick={() => setShowCreate(true)}
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
        </button>

        <Link
          href="/map"
          onClick={() => setShowCreate(false)}
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
          onClick={() => setShowCreate(false)}
          className={`flex flex-col items-center gap-0.5 px-4 py-1 rounded-xl transition-colors ${profileActive ? "text-pink-500" : "text-neutral-400 hover:text-neutral-700"}`}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth={profileActive ? 2.5 : 1.5} fill={profileActive ? "currentColor" : "none"} fillOpacity={profileActive ? 0.15 : 0} />
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth={profileActive ? 2.5 : 1.5} strokeLinecap="round" />
          </svg>
          <span className="text-[10px] font-medium">Profile</span>
        </Link>
      </nav>
    </>
  );
}
