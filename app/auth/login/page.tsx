"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import Link from "next/link";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/feed";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function signIn() {
    setError("");
    if (!email.trim() || !password) {
      setError("Enter your email and password");
      return;
    }
    setLoading(true);
    try {
      const supabase = getSupabaseBrowser();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) {
        setError(signInError.message);
        return;
      }
      router.push(redirectTo);
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
      options: {
        redirectTo: `${window.location.origin}/auth/onboard?redirect=${encodeURIComponent(redirectTo)}`,
      },
    });
  }

  return (
    <div className="min-h-screen bg-[#0b0b0b] text-white flex flex-col">
      {/* Header */}
      <div className="relative flex items-center justify-center pt-12 pb-2 px-6">
        <Link
          href="/auth"
          className="absolute left-6 w-8 h-8 flex items-center justify-center text-white/50 hover:text-white text-2xl"
        >
          ‹
        </Link>
        <span className="text-lg font-semibold tracking-tight">whimsi</span>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col px-8 pt-8 pb-4">
        <p className="text-neutral-500 text-sm mb-1">Welcome back</p>
        <h1 className="text-3xl font-bold mb-8">Sign in</h1>

        <div className="space-y-6">
          <div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoFocus
              className="w-full bg-transparent border-b border-white/25 focus:border-white pb-3 text-xl text-white placeholder:text-white/25 outline-none transition-colors"
            />
          </div>
          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && signIn()}
              placeholder="••••••••"
              className="w-full bg-transparent border-b border-white/25 focus:border-white pb-3 text-xl text-white placeholder:text-white/25 outline-none transition-colors"
            />
          </div>
        </div>

        {error && <p className="mt-4 text-red-400 text-sm">{error}</p>}

        <div className="flex items-center gap-3 mt-8">
          <div className="flex-1 h-px bg-white/15" />
          <span className="text-white/35 text-sm">or</span>
          <div className="flex-1 h-px bg-white/15" />
        </div>
        <button
          onClick={continueWithGoogle}
          className="mt-4 w-full py-3.5 rounded-2xl bg-white/8 border border-white/15 flex items-center justify-center gap-3 text-sm font-medium hover:bg-white/12 transition"
        >
          <GoogleIcon />
          Continue with Google
        </button>

        <div className="flex-1 flex items-center justify-center pointer-events-none select-none my-6">
          <WaveDecoration />
        </div>
      </div>

      {/* Bottom */}
      <div className="px-8 pb-10 space-y-3">
        <button
          onClick={signIn}
          disabled={loading}
          className="w-full py-4 rounded-2xl bg-[#4ade80] text-black font-bold text-base disabled:opacity-50 transition"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
        <p className="text-center text-sm text-white/35">
          Don&apos;t have an account?{" "}
          <Link href="/auth" className="text-white underline underline-offset-2">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
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
