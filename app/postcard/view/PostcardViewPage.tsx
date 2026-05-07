"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PostcardViewPage({ journeyId }: { journeyId: string }) {
  const router = useRouter();

  useEffect(() => {
    router.replace(`/journey/${journeyId}`);
  }, [journeyId, router]);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#f5f0e8" }}>
      <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: "#c4b49a", borderTopColor: "#4ade80" }} />
    </div>
  );
}
