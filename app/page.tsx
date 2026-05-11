"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabaseBrowser } from "@/lib/supabase/browser";

export default function Home() {
  const router = useRouter();
  const [showButtons, setShowButtons] = useState(false);

  useEffect(() => {
    const authCheck = getSupabaseBrowser().auth.getUser();
    const minDelay = new Promise<void>((res) => setTimeout(res, 1800));

    Promise.all([authCheck, minDelay]).then(([{ data }]) => {
      if (data.user) {
        router.replace("/feed");
      } else {
        setShowButtons(true);
      }
    });
  }, [router]);

  return <LandingPage showButtons={showButtons} />;
}

function LandingPage({ showButtons }: { showButtons: boolean }) {
  return (
    <div className="fixed inset-0 bg-[#0b0b0b] flex flex-col select-none">
      {/* Full-screen image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/landing-page.jpeg"
        alt=""
        className="absolute inset-0 w-full h-full"
        style={{ objectFit: "cover", objectPosition: "center" }}
      />

      {/* Bottom gradient — only visible when buttons are shown */}
      {showButtons && (
        <div
          className="absolute inset-x-0 bottom-0 pointer-events-none"
          style={{
            height: "50%",
            background: "linear-gradient(to bottom, transparent, rgba(11,11,11,0.9) 55%, #0b0b0b 100%)",
          }}
        />
      )}

      {/* CTA buttons — only for unauthenticated users */}
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
