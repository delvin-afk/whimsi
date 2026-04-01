"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabase/browser";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    getSupabaseBrowser()
      .auth.getUser()
      .then(({ data }) => {
        router.replace(data.user ? "/feed" : "/auth");
      });
  }, [router]);

  return null;
}
