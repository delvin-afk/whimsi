"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabase/browser";

const INTERESTS = [
  { emoji: "🍜", label: "Food & Drink" },
  { emoji: "🌿", label: "Scenery & Nature" },
  { emoji: "🏛️", label: "Culture & History" },
  { emoji: "✨", label: "Vibe & Mood" },
  { emoji: "✈️", label: "Travel Journey" },
  { emoji: "👥", label: "People & Moments" },
  { emoji: "🎨", label: "Art & Aesthetics" },
  { emoji: "🛍️", label: "Shopping & Finds" },
  { emoji: "🎡", label: "Activities & Experiences" },
];

type Step = "name" | "birthday" | "interests" | "camera" | "photos" | "location";
const STEPS: Step[] = ["name", "birthday", "interests", "camera", "photos", "location"];
const PERMISSION_STEPS: Step[] = ["camera", "photos", "location"];

const PERMISSION_INFO: Record<string, { title: string; button: string; icon: string; why: string }> = {
  camera: {
    title: "Allow Whimsi to access your camera",
    button: "Allow access to camera",
    icon: "📷",
    why: "To take photos for creating stickers and memories in your album",
  },
  photos: {
    title: "Allow Whimsi to access your Photo Album",
    button: "Allow access to photo album",
    icon: "🖼️",
    why: "To pick photos from your library for creating stickers",
  },
  location: {
    title: "Allow Whimsi to access your Location",
    button: "Allow access to Location",
    icon: "📍",
    why: "To pin your stickers on the map where you took them",
  },
};

export default function OnboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/feed";

  const [checking, setChecking] = useState(true);
  const [userId, setUserId] = useState("");
  const [step, setStep] = useState<Step>("name");
  const [name, setName] = useState("");
  const [bdMm, setBdMm] = useState("");
  const [bdDd, setBdDd] = useState("");
  const [bdYyyy, setBdYyyy] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const stepIndex = STEPS.indexOf(step);
  const isPermissionStep = PERMISSION_STEPS.includes(step);
  const permissionIndex = PERMISSION_STEPS.indexOf(step);

  useEffect(() => {
    const supabase = getSupabaseBrowser();
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        router.replace("/auth");
        return;
      }
      setUserId(data.user.id);

      // Returning user who already has a profile — skip onboarding
      const { data: profile } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", data.user.id)
        .single();

      if (profile?.username) {
        router.replace(redirectTo);
      } else {
        setChecking(false);
      }
    });
  }, [router, redirectTo]);

  if (checking) return null;

  function back() {
    if (stepIndex > 0) {
      setError("");
      setStep(STEPS[stepIndex - 1]);
    }
  }

  async function next() {
    setError("");
    if (step === "name") {
      if (!name.trim()) { setError("Enter your name"); return; }
      setStep("birthday");
    } else if (step === "birthday") {
      setStep("interests");
    } else if (step === "interests") {
      await saveProfile();
    }
  }

  async function saveProfile() {
    if (!userId) return;
    setLoading(true);
    try {
      const supabase = getSupabaseBrowser();
      const birthdayStr =
        bdMm && bdDd && bdYyyy
          ? `${bdYyyy}-${bdMm.padStart(2, "0")}-${bdDd.padStart(2, "0")}`
          : null;

      await supabase.from("profiles").upsert({
        id: userId,
        username: name.trim(),
        birthday: birthdayStr,
        interests,
      });

      setStep("camera");
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  function advancePermission() {
    const nextIndex = permissionIndex + 1;
    if (nextIndex < PERMISSION_STEPS.length) {
      setStep(PERMISSION_STEPS[nextIndex]);
    } else {
      router.push(redirectTo);
    }
  }

  async function allowPermission() {
    if (step === "camera") {
      try {
        const stream = await navigator.mediaDevices?.getUserMedia({ video: true });
        stream?.getTracks().forEach((t) => t.stop());
      } catch {}
    } else if (step === "location") {
      await new Promise<void>((resolve) => {
        navigator.geolocation?.getCurrentPosition(() => resolve(), () => resolve());
      });
    }
    advancePermission();
  }

  function toggleInterest(label: string) {
    setInterests((prev) =>
      prev.includes(label) ? prev.filter((i) => i !== label) : [...prev, label]
    );
  }

  // ── Permission step UI ──────────────────────────────────────────────────────
  if (isPermissionStep) {
    const info = PERMISSION_INFO[step];
    return (
      <div className="min-h-screen bg-[#0b0b0b] text-white flex flex-col">
        <div className="flex items-center gap-3 px-6 pt-10 pb-4">
          <button
            onClick={back}
            className="w-8 h-8 flex items-center justify-center text-white/50 hover:text-white text-2xl shrink-0"
          >
            ‹
          </button>
          <div className="flex flex-1 gap-1.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={`flex-1 h-1 rounded-full transition-colors ${
                  i <= permissionIndex ? "bg-[#4ade80]" : "bg-white/15"
                }`}
              />
            ))}
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center px-8 pt-4 pb-4">
          <h1 className="text-2xl font-bold text-center mb-8 leading-snug">{info.title}</h1>

          <div className="w-full rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-8 h-44">
            <span className="text-7xl">{info.icon}</span>
          </div>

          <div className="w-full space-y-5">
            <BulletRow
              icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 12a11 11 0 11-22 0 11 11 0 0122 0z"/><path d="M12 7v5l3 3"/></svg>}
              title="How you will use this"
              body={info.why}
            />
            <BulletRow
              icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>}
              title="How we will use this"
              body="To offer sticker creating interactions and effects"
            />
            <BulletRow
              icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l2 2"/></svg>}
              title="How these settings work"
              body="You can change your choices at any time in your browser or device settings."
            />
          </div>
        </div>

        <div className="px-8 pb-10 space-y-3">
          <button
            onClick={allowPermission}
            className="w-full py-4 rounded-2xl bg-[#4ade80] text-black font-bold text-base"
          >
            {info.button}
          </button>
          <button
            onClick={advancePermission}
            className="w-full py-2 text-center text-sm text-white/35 underline underline-offset-2"
          >
            Skip for now
          </button>
        </div>
      </div>
    );
  }

  // ── Profile setup UI ────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0b0b0b] text-white flex flex-col">
      <div className="relative flex items-center justify-center pt-12 pb-2 px-6">
        {stepIndex > 0 && (
          <button
            onClick={back}
            className="absolute left-6 w-8 h-8 flex items-center justify-center text-white/50 hover:text-white text-2xl"
          >
            ‹
          </button>
        )}
        <span className="text-lg font-semibold tracking-tight">whimsi</span>
      </div>

      <div className="flex-1 flex flex-col px-8 pt-8 pb-4">
        {step === "name" && (
          <>
            <p className="text-neutral-500 text-sm mb-1">Let&apos;s get started</p>
            <h1 className="text-3xl font-bold mb-8">Whats your name?</h1>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && next()}
              placeholder="Your name"
              autoFocus
              className="w-full bg-transparent border-b border-white/25 focus:border-white pb-3 text-xl text-white placeholder:text-white/25 outline-none transition-colors"
            />
            <div className="flex-1 flex items-center justify-center pointer-events-none select-none my-6">
              <WaveDecoration />
            </div>
          </>
        )}

        {step === "birthday" && (
          <>
            <h1 className="text-3xl font-bold mb-8 leading-tight">
              When&apos;s your birthday{name ? `, ${name}` : ""}?
            </h1>
            <div className="flex items-end gap-3">
              <input
                type="text" inputMode="numeric" value={bdMm}
                onChange={(e) => setBdMm(e.target.value.replace(/\D/g, "").slice(0, 2))}
                placeholder="MM" autoFocus
                className="w-16 bg-transparent border-b border-white/25 focus:border-white pb-3 text-3xl font-bold text-white placeholder:text-white/20 outline-none text-center transition-colors"
              />
              <span className="text-white/30 text-3xl pb-3">/</span>
              <input
                type="text" inputMode="numeric" value={bdDd}
                onChange={(e) => setBdDd(e.target.value.replace(/\D/g, "").slice(0, 2))}
                placeholder="DD"
                className="w-16 bg-transparent border-b border-white/25 focus:border-white pb-3 text-3xl font-bold text-white placeholder:text-white/20 outline-none text-center transition-colors"
              />
              <span className="text-white/30 text-3xl pb-3">/</span>
              <input
                type="text" inputMode="numeric" value={bdYyyy}
                onChange={(e) => setBdYyyy(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="YYYY"
                className="w-24 bg-transparent border-b border-white/25 focus:border-white pb-3 text-3xl font-bold text-white placeholder:text-white/20 outline-none text-center transition-colors"
              />
            </div>
            <div className="flex-1 flex items-center justify-center pointer-events-none select-none my-6">
              <WaveDecoration />
            </div>
          </>
        )}

        {step === "interests" && (
          <>
            <h1 className="text-3xl font-bold mb-8 leading-tight">
              What are your interests{name ? `, ${name}` : ""}?
            </h1>
            <div className="flex flex-wrap gap-2">
              {INTERESTS.map(({ emoji, label }) => {
                const active = interests.includes(label);
                return (
                  <button
                    key={label}
                    onClick={() => toggleInterest(label)}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium border transition-all ${
                      active
                        ? "bg-white text-black border-white"
                        : "bg-transparent text-white/60 border-white/20 hover:border-white/40"
                    }`}
                  >
                    <span>{emoji}</span>
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
            <div className="flex-1" />
          </>
        )}

        {error && <p className="mt-4 text-red-400 text-sm">{error}</p>}
      </div>

      <div className="px-8 pb-10 space-y-3">
        <button
          onClick={next}
          disabled={loading}
          className="w-full py-4 rounded-2xl bg-[#4ade80] text-black font-bold text-base disabled:opacity-50 transition"
        >
          {loading ? "Saving…" : "Continue"}
        </button>

        {(step === "birthday" || step === "interests") && (
          <button
            onClick={() => (step === "birthday" ? setStep("interests") : saveProfile())}
            className="w-full py-2 text-center text-sm text-white/35 underline underline-offset-2"
          >
            Skip for now
          </button>
        )}
      </div>
    </div>
  );
}

function BulletRow({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex gap-3">
      <div className="w-9 h-9 rounded-full bg-white/8 flex items-center justify-center shrink-0 text-white/70">
        {icon}
      </div>
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-white/50 mt-0.5">{body}</p>
      </div>
    </div>
  );
}

function WaveDecoration() {
  return (
    <svg viewBox="0 0 360 180" fill="none" className="w-full max-w-sm opacity-60">
      <path d="M-10 110 C40 70 100 130 170 90 C240 50 300 120 370 80" stroke="white" strokeWidth="1.2" opacity="0.35"/>
      <path d="M-10 140 C50 100 115 150 190 115 C265 80 320 145 370 110" stroke="#4ade80" strokeWidth="1.3" opacity="0.65"/>
      <g stroke="white" strokeWidth="1.3" opacity="0.5" strokeLinecap="round">
        <line x1="168" y1="86" x2="168" y2="94"/>
        <line x1="164" y1="90" x2="172" y2="90"/>
      </g>
      <g stroke="#4ade80" strokeWidth="1.3" opacity="0.7" strokeLinecap="round">
        <line x1="110" y1="147" x2="110" y2="155"/>
        <line x1="106" y1="151" x2="114" y2="151"/>
      </g>
    </svg>
  );
}
