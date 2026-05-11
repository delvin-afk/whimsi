"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabaseBrowser } from "@/lib/supabase/browser";

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    getSupabaseBrowser()
      .auth.getUser()
      .then(({ data }) => {
        if (data.user) router.replace("/feed");
      });
  }, [router]);

  return <LandingPage />;
}

function LandingPage() {
  return (
    <div className="fixed inset-0 bg-[#0b0b0b] flex flex-col select-none">
      {/* Image container — upper 65% of screen */}
      <div className="relative flex items-center justify-center overflow-hidden" style={{ height: "65%" }}>
        {/* Top fade */}
        <div
          className="absolute inset-x-0 top-0 z-10 pointer-events-none"
          style={{ height: "20%", background: "linear-gradient(to bottom, #0b0b0b, transparent)" }}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/landing-page.jpeg"
          alt=""
          className="w-full"
          style={{ objectFit: "contain" }}
        />
        {/* Bottom fade */}
        <div
          className="absolute inset-x-0 bottom-0 z-10 pointer-events-none"
          style={{ height: "30%", background: "linear-gradient(to bottom, transparent, #0b0b0b)" }}
        />
      </div>

      {/* CTA buttons pinned to bottom */}
      <div className="flex-1 flex flex-col justify-end px-8 pb-14 space-y-3">
        <Link
          href="/auth"
          className="block w-full py-4 rounded-2xl bg-[#4ade80] text-black font-bold text-base text-center"
        >
          Get Started
        </Link>
        <Link
          href="/auth/login"
          className="block w-full py-4 rounded-2xl bg-white/8 border border-white/12 text-white font-semibold text-base text-center"
        >
          Sign In
        </Link>
      </div>
    </div>
  );
}
