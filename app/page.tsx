"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabaseBrowser } from "@/lib/supabase/browser";

export default function Home() {
  const router = useRouter();
  const [showButtons, setShowButtons] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseBrowser();
    const minDelay = new Promise<void>((res) => setTimeout(res, 1800));

    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        await minDelay;
        setShowButtons(true);
        return;
      }

      const uid = data.user.id;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const profileFetch = (supabase as any)
        .from("profiles").select("username, avatar_url").eq("id", uid).single()
        .then((res: { data: { username?: string; avatar_url?: string } | null }) => res.data)
        .catch(() => null);

      const [, profile] = await Promise.all([minDelay, profileFetch]);

      // New user (Google sign-up with no profile yet) — send to onboarding
      if (!profile?.username) {
        router.replace("/auth/onboard");
        return;
      }

      // Existing user — prefetch feed data and go straight in
      const journeysFetch = fetch(`/api/journeys?user_id=${uid}`)
        .then((r) => r.json())
        .catch(() => null);

      const [journeysData] = await Promise.all([journeysFetch]);

      try {
        sessionStorage.setItem("whimsi_feed_preload", JSON.stringify({
          journeys: journeysData?.journeys ?? [],
          avatarUrl: profile.avatar_url ?? null,
          ts: Date.now(),
        }));
      } catch {}

      router.replace("/feed");
    });
  }, [router]);

  return <LandingPage showButtons={showButtons} />;
}

function LandingPage({ showButtons }: { showButtons: boolean }) {
  return (
    <div className="fixed inset-0 bg-[#0b0b0b] flex flex-col select-none">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/landing-page.png"
        alt=""
        className="absolute inset-0 w-full h-full"
        style={{ objectFit: "cover", objectPosition: "center" }}
      />

      {showButtons && (
        <div
          className="absolute inset-x-0 bottom-0 pointer-events-none"
          style={{
            height: "50%",
            background: "linear-gradient(to bottom, transparent, rgba(11,11,11,0.9) 55%, #0b0b0b 100%)",
          }}
        />
      )}

      {showButtons && (
        <div className="relative z-10 mt-auto px-8 pb-14 space-y-3">
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
      )}
    </div>
  );
}
