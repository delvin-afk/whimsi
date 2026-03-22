"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  {
    href: "/feed",
    label: "Feed",
    icon: (active: boolean) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path
          d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
          stroke="currentColor"
          strokeWidth={active ? 2.5 : 1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill={active ? "currentColor" : "none"}
          fillOpacity={active ? 0.15 : 0}
        />
      </svg>
    ),
  },
  {
    href: "/capture",
    label: "Create",
    icon: (active: boolean) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <circle
          cx="12" cy="12" r="9"
          stroke="currentColor"
          strokeWidth={active ? 2.5 : 1.5}
          fill={active ? "currentColor" : "none"}
          fillOpacity={active ? 0.15 : 0}
        />
        <path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth={active ? 2.5 : 1.5} strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/map",
    label: "Map",
    icon: (active: boolean) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path
          d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 9m0 8V9M9 7l6 2"
          stroke="currentColor"
          strokeWidth={active ? 2.5 : 1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    href: "/scrapbook",
    label: "Scrapbook",
    icon: (active: boolean) => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path
          d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
          stroke="currentColor"
          strokeWidth={active ? 2.5 : 1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
];

export default function BottomNav() {
  const pathname = usePathname();

  if (pathname.startsWith("/auth")) return null;

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 bg-white border-t border-neutral-200 flex items-center justify-around h-16 px-2">
      {tabs.map((tab) => {
        const active = pathname === tab.href || (tab.href !== "/feed" && pathname.startsWith(tab.href));
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex flex-col items-center gap-0.5 px-4 py-1 rounded-xl transition-colors ${
              active ? "text-pink-500" : "text-neutral-400 hover:text-neutral-700"
            }`}
          >
            {tab.icon(active)}
            <span className="text-[10px] font-medium">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
