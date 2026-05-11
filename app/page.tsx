"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabaseBrowser } from "@/lib/supabase/browser";

export default function Home() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    getSupabaseBrowser()
      .auth.getUser()
      .then(({ data }) => {
        if (data.user) {
          router.replace("/feed");
        } else {
          setReady(true);
        }
      });
  }, [router]);

  if (!ready) {
    return (
      <div className="fixed inset-0 bg-[#0b0b0b] flex items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-512.png" alt="whimsi" className="w-14 h-14 rounded-2xl opacity-90" />
      </div>
    );
  }

  return <LandingPage />;
}

function LandingPage() {
  return (
    <div className="fixed inset-0 bg-[#0b0b0b] flex flex-col">
      {/* Full-screen background image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/landing-page.jpeg"
        alt=""
        className="absolute inset-0 w-full h-full"
        style={{ objectFit: "cover", objectPosition: "center" }}
      />

      {/* Bottom gradient so buttons stay readable */}
      <div
        className="absolute inset-x-0 bottom-0 pointer-events-none"
        style={{
          height: "55%",
          background: "linear-gradient(to bottom, transparent, rgba(11,11,11,0.85) 50%, #0b0b0b 100%)",
        }}
      />

      {/* Spacer pushes buttons to bottom */}
      <div className="flex-1" />

      {/* CTA buttons */}
      <div className="relative z-10 px-8 pb-14 space-y-3">
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
