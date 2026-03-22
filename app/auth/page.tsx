"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import Link from "next/link";

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

type Step = "email" | "password" | "name" | "birthday" | "interests";
const STEPS: Step[] = ["email", "password", "name", "birthday", "interests"];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [bdMm, setBdMm] = useState("");
  const [bdDd, setBdDd] = useState("");
  const [bdYyyy, setBdYyyy] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const stepIndex = STEPS.indexOf(step);

  function back() {
    if (stepIndex > 0) {
      setError("");
      setStep(STEPS[stepIndex - 1]);
    }
  }

  async function next() {
    setError("");
    if (step === "email") {
      if (!email.trim() || !email.includes("@")) {
        setError("Enter a valid email address");
        return;
      }
      setStep("password");
    } else if (step === "password") {
      if (password.length < 6) {
        setError("Password must be at least 6 characters");
        return;
      }
      setStep("name");
    } else if (step === "name") {
      if (!name.trim()) {
        setError("Enter your name");
        return;
      }
      setStep("birthday");
    } else if (step === "birthday") {
      setStep("interests");
    } else if (step === "interests") {
      await signUp();
    }
  }

  async function signUp() {
    setLoading(true);
    try {
      const supabase = getSupabaseBrowser();

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (signUpError) {
        setError(signUpError.message);
        return;
      }
      if (!data.user) {
        setError("Sign up failed. Try again.");
        return;
      }

      const birthdayStr =
        bdMm && bdDd && bdYyyy
          ? `${bdYyyy}-${bdMm.padStart(2, "0")}-${bdDd.padStart(2, "0")}`
          : null;

      await supabase.from("profiles").upsert({
        id: data.user.id,
        username: name.trim(),
        birthday: birthdayStr,
        interests,
      });

      router.push("/feed");
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function continueWithGoogle() {
    const supabase = getSupabaseBrowser();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/feed` },
    });
  }

  function toggleInterest(label: string) {
    setInterests((prev) =>
      prev.includes(label) ? prev.filter((i) => i !== label) : [...prev, label]
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0b0b] text-white flex flex-col">
      {/* Header */}
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

      {/* Main content */}
      <div className="flex-1 flex flex-col px-8 pt-8 pb-4">
        {step !== "interests" && step !== "birthday" && (
          <p className="text-neutral-500 text-sm mb-1">Let&apos;s get started</p>
        )}

        <h1 className="text-3xl font-bold mb-8 leading-tight">
          {step === "email" && "What's your email?"}
          {step === "password" && "Create a password"}
          {step === "name" && "Whats your name?"}
          {step === "birthday" && (
            <>When&apos;s your birthday{name ? `, ${name}` : ""}?</>
          )}
          {step === "interests" && (
            <>What are your interests{name ? `, ${name}` : ""}?</>
          )}
        </h1>

        {/* Email */}
        {step === "email" && (
          <div className="space-y-5">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && next()}
              placeholder="you@example.com"
              autoFocus
              className="w-full bg-transparent border-b border-white/25 focus:border-white pb-3 text-xl text-white placeholder:text-white/25 outline-none transition-colors"
            />
            <div className="flex items-center gap-3 pt-2">
              <div className="flex-1 h-px bg-white/15" />
              <span className="text-white/35 text-sm">or</span>
              <div className="flex-1 h-px bg-white/15" />
            </div>
            <button
              onClick={continueWithGoogle}
              className="w-full py-3.5 rounded-2xl bg-white/8 border border-white/15 flex items-center justify-center gap-3 text-sm font-medium hover:bg-white/12 transition"
            >
              <GoogleIcon />
              Continue with Google
            </button>
          </div>
        )}

        {/* Password */}
        {step === "password" && (
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && next()}
            placeholder="••••••••"
            autoFocus
            className="w-full bg-transparent border-b border-white/25 focus:border-white pb-3 text-xl text-white placeholder:text-white/25 outline-none transition-colors"
          />
        )}

        {/* Name */}
        {step === "name" && (
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && next()}
            placeholder="Your name"
            autoFocus
            className="w-full bg-transparent border-b border-white/25 focus:border-white pb-3 text-xl text-white placeholder:text-white/25 outline-none transition-colors"
          />
        )}

        {/* Birthday */}
        {step === "birthday" && (
          <div className="flex items-end gap-3">
            <div className="flex flex-col items-center gap-2">
              <input
                type="text"
                inputMode="numeric"
                value={bdMm}
                onChange={(e) => setBdMm(e.target.value.replace(/\D/g, "").slice(0, 2))}
                placeholder="MM"
                autoFocus
                className="w-16 bg-transparent border-b border-white/25 focus:border-white pb-3 text-3xl font-bold text-white placeholder:text-white/20 outline-none text-center transition-colors"
              />
            </div>
            <span className="text-white/30 text-3xl pb-3">/</span>
            <div className="flex flex-col items-center gap-2">
              <input
                type="text"
                inputMode="numeric"
                value={bdDd}
                onChange={(e) => setBdDd(e.target.value.replace(/\D/g, "").slice(0, 2))}
                placeholder="DD"
                className="w-16 bg-transparent border-b border-white/25 focus:border-white pb-3 text-3xl font-bold text-white placeholder:text-white/20 outline-none text-center transition-colors"
              />
            </div>
            <span className="text-white/30 text-3xl pb-3">/</span>
            <div className="flex flex-col items-center gap-2">
              <input
                type="text"
                inputMode="numeric"
                value={bdYyyy}
                onChange={(e) => setBdYyyy(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="YYYY"
                className="w-24 bg-transparent border-b border-white/25 focus:border-white pb-3 text-3xl font-bold text-white placeholder:text-white/20 outline-none text-center transition-colors"
              />
            </div>
          </div>
        )}

        {/* Interests */}
        {step === "interests" && (
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
        )}

        {error && <p className="mt-4 text-red-400 text-sm">{error}</p>}

        {/* Wave decoration */}
        <div className="flex-1 flex items-center justify-center pointer-events-none select-none my-6">
          <WaveDecoration />
        </div>
      </div>

      {/* Bottom actions */}
      <div className="px-8 pb-10 space-y-3">
        <button
          onClick={next}
          disabled={loading}
          className="w-full py-4 rounded-2xl bg-[#4ade80] text-black font-bold text-base disabled:opacity-50 transition"
        >
          {loading ? "Creating account…" : "Continue"}
        </button>

        {(step === "birthday" || step === "interests") && (
          <button
            onClick={() =>
              step === "birthday" ? setStep("interests") : signUp()
            }
            className="w-full py-2 text-center text-sm text-white/35 underline underline-offset-2"
          >
            Skip for now
          </button>
        )}

        {step === "email" && (
          <p className="text-center text-sm text-white/35">
            Already have an account?{" "}
            <Link href="/auth/login" className="text-white underline underline-offset-2">
              Sign in
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.909-2.259c-.806.54-1.837.86-3.047.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

function WaveDecoration() {
  return (
    <svg viewBox="0 0 360 180" fill="none" className="w-full max-w-sm opacity-60">
      <path
        d="M-10 110 C40 70 100 130 170 90 C240 50 300 120 370 80"
        stroke="white"
        strokeWidth="1.2"
        opacity="0.35"
      />
      <path
        d="M-10 140 C50 100 115 150 190 115 C265 80 320 145 370 110"
        stroke="#4ade80"
        strokeWidth="1.3"
        opacity="0.65"
      />
      <g stroke="white" strokeWidth="1.3" opacity="0.5" strokeLinecap="round">
        <line x1="168" y1="86" x2="168" y2="94"/>
        <line x1="164" y1="90" x2="172" y2="90"/>
      </g>
      <g stroke="white" strokeWidth="1.2" opacity="0.35" strokeLinecap="round">
        <line x1="260" y1="74" x2="260" y2="82"/>
        <line x1="256" y1="78" x2="264" y2="78"/>
      </g>
      <g stroke="#4ade80" strokeWidth="1.3" opacity="0.7" strokeLinecap="round">
        <line x1="110" y1="147" x2="110" y2="155"/>
        <line x1="106" y1="151" x2="114" y2="151"/>
      </g>
      <g stroke="white" strokeWidth="1" opacity="0.25" strokeLinecap="round">
        <line x1="310" y1="108" x2="310" y2="118"/>
        <line x1="305" y1="113" x2="315" y2="113"/>
      </g>
    </svg>
  );
}
