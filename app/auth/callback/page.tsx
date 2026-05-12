"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabase/browser";

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const code = searchParams.get("code");

    if (!code) {
      router.replace("/auth");
      return;
    }

    getSupabaseBrowser()
      .auth.exchangeCodeForSession(code)
      .then(({ error }) => {
        router.replace(error ? "/auth" : "/auth/onboard");
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-dvh bg-[#0b0b0b] flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-neutral-700 border-t-neutral-300 animate-spin" />
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense>
      <CallbackHandler />
    </Suspense>
  );
}
