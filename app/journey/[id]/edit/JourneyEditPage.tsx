"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabase/browser";
import AudioPlayer from "@/components/AudioPlayer";

type EditSticker = {
  id: string;
  image_url: string;
  caption: string;
  voice_url: string | null;
  newVoiceBlob: Blob | null;
  newVoiceMimeType: string | null;
  newVoicePreviewUrl: string | null;
  voiceCleared: boolean;
};

export default function JourneyEditPage() {
  const router = useRouter();
  const params = useParams();
  const journeyId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [journeyCaption, setJourneyCaption] = useState("");
  const [stickers, setStickers] = useState<EditSticker[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    getSupabaseBrowser().auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id ?? null;
      if (!uid) { router.push("/auth"); return; }
      setUserId(uid);

      const supabase = getSupabaseBrowser();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: journey } = await (supabase as any)
        .from("journeys")
        .select("*")
        .eq("id", journeyId)
        .eq("user_id", uid)
        .single() as { data: { caption: string | null } | null };

      if (!journey) { router.push("/feed"); return; }
      setJourneyCaption(journey.caption ?? "");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: rows } = await (supabase as any)
        .from("stickers")
        .select("*")
        .eq("journey_id", journeyId)
        .order("order_index", { ascending: true }) as { data: Array<{ id: string; image_url: string; caption: string | null; voice_url: string | null }> | null };

      setStickers((rows ?? []).map((s) => ({
        id: s.id,
        image_url: s.image_url,
        caption: s.caption ?? "",
        voice_url: s.voice_url ?? null,
        newVoiceBlob: null,
        newVoiceMimeType: null,
        newVoicePreviewUrl: null,
        voiceCleared: false,
      })));
      setLoading(false);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const current = stickers[currentIndex];
  const total = stickers.length;
  const isLast = currentIndex === total - 1;

  function updateCaption(caption: string) {
    setStickers((prev) => prev.map((s, i) => i === currentIndex ? { ...s, caption } : s));
  }

  function clearVoice() {
    setStickers((prev) => prev.map((s, i) =>
      i === currentIndex
        ? { ...s, voice_url: null, newVoiceBlob: null, newVoiceMimeType: null, newVoicePreviewUrl: null, voiceCleared: true }
        : s
    ));
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/mp4")
        ? "audio/mp4"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "";
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        const previewUrl = URL.createObjectURL(blob);
        setStickers((prev) => prev.map((s, i) =>
          i === currentIndex
            ? { ...s, newVoiceBlob: blob, newVoiceMimeType: blob.type, newVoicePreviewUrl: previewUrl, voice_url: null, voiceCleared: false }
            : s
        ));
        setIsRecording(false);
        if (timerRef.current) clearInterval(timerRef.current);
        setRecordingSeconds(0);
      };
      recorder.start();
      recorderRef.current = recorder;
      setIsRecording(true);
      setRecordingSeconds(0);
      timerRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
    } catch {
      alert("Microphone access denied");
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    recorderRef.current = null;
  }

  function goNext() {
    if (isRecording) stopRecording();
    setCurrentIndex((i) => Math.min(i + 1, total - 1));
  }

  function goPrev() {
    if (isRecording) stopRecording();
    setCurrentIndex((i) => Math.max(i - 1, 0));
  }

  async function handleSave() {
    if (!userId) return;
    setSaving(true);

    const stickersPayload = await Promise.all(stickers.map(async (s) => {
      let voiceBase64: string | null = null;
      let voiceMimeType: string | null = null;
      if (s.newVoiceBlob) {
        voiceBase64 = await new Promise<string | null>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(",")[1] ?? null);
          };
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(s.newVoiceBlob!);
        });
        voiceMimeType = s.newVoiceMimeType;
      }
      return {
        id: s.id,
        caption: s.caption.trim() || null,
        voiceBase64,
        voiceMimeType,
        clearVoice: s.voiceCleared,
      };
    }));

    const res = await fetch("/api/journey/edit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        journeyId,
        caption: journeyCaption.trim() || null,
        stickers: stickersPayload,
      }),
    });

    setSaving(false);
    if (res.ok) {
      router.push("/feed");
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: "#000" }}>
        <div className="h-8 w-8 rounded-full border-2 border-neutral-700 border-t-white animate-spin" />
      </div>
    );
  }

  if (!current) {
    return null;
  }

  const hasVoice = current.voice_url || current.newVoicePreviewUrl;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col" style={{ background: "#000", paddingBottom: "env(safe-area-inset-bottom)" }}>
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 shrink-0"
        style={{ paddingTop: "max(env(safe-area-inset-top), 16px)", paddingBottom: 12 }}
      >
        <button
          onClick={() => router.back()}
          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
          style={{ background: "rgba(255,255,255,0.08)" }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <span className="font-semibold text-base text-white truncate flex-1">Edit Story</span>
        <span
          className="shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full"
          style={{ background: "rgba(74,222,128,0.15)", color: "#4ade80" }}
        >
          {currentIndex + 1} / {total}
        </span>
      </div>

      {/* Journey title (editable, shown only on first sticker) */}
      {currentIndex === 0 && total > 1 && (
        <div className="px-4 pb-3 shrink-0">
          <label className="text-neutral-400 text-sm font-medium">Journey Title:</label>
          <input
            value={journeyCaption}
            onChange={(e) => setJourneyCaption(e.target.value)}
            placeholder="e.g. Greece Trip 2025"
            className="mt-1.5 w-full bg-neutral-800 text-white placeholder-neutral-600 rounded-lg px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#4ade80]"
            style={{ fontSize: 16 }}
          />
        </div>
      )}

      {/* Sticker image */}
      <div className="px-4 pb-3 shrink-0">
        <div
          className="w-full rounded-lg overflow-hidden flex items-center justify-center"
          style={{ background: "#111", minHeight: 200, maxHeight: 280 }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={current.image_url}
            alt="sticker"
            className="object-contain"
            style={{ maxHeight: 280, maxWidth: "100%" }}
          />
        </div>
      </div>

      {/* Scrollable caption + voice section */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-4 space-y-4">
        {/* Caption */}
        <div>
          <label className="text-neutral-400 text-sm font-medium">Write Caption:</label>
          <div className="mt-1.5">
            <textarea
              value={current.caption}
              onChange={(e) => updateCaption(e.target.value)}
              placeholder="Ex: What happened here?"
              rows={3}
              className="w-full bg-neutral-800 text-white placeholder-neutral-600 rounded-lg px-4 py-3 text-sm resize-none outline-none focus:ring-2 focus:ring-[#4ade80]"
              style={{ fontSize: 16 }}
            />
          </div>
        </div>

        {/* Voice memo */}
        <div>
          <label className="text-neutral-400 text-sm font-medium">Record Memo:</label>
          <div className="mt-1.5">
            {!hasVoice && !isRecording && (
              <button
                type="button"
                onClick={startRecording}
                className="w-full flex items-center gap-3 py-3 px-4 rounded-lg border border-white/10 bg-neutral-800 hover:bg-neutral-700 transition-colors"
              >
                <span className="w-8 h-8 rounded-full border-2 border-[#4ade80] flex items-center justify-center shrink-0">
                  <span className="w-3 h-3 rounded-full bg-[#4ade80]" />
                </span>
                <span className="text-sm text-neutral-400 italic">Tap to share the story with your voice</span>
              </button>
            )}
            {isRecording && (
              <div className="flex items-center gap-3 py-3 px-4 rounded-lg border border-[#4ade80] bg-green-950/30">
                <span className="w-3 h-3 rounded-full bg-[#4ade80] animate-pulse shrink-0" />
                <span className="flex-1 text-sm text-neutral-300 font-mono">
                  {String(Math.floor(recordingSeconds / 60)).padStart(2, "0")}:{String(recordingSeconds % 60).padStart(2, "0")}
                </span>
                <button
                  type="button"
                  onClick={stopRecording}
                  className="px-3 py-1.5 rounded-lg bg-neutral-100 text-neutral-900 text-xs font-bold"
                >
                  Stop
                </button>
              </div>
            )}
            {hasVoice && !isRecording && (
              <div className="space-y-2">
                <AudioPlayer src={current.newVoicePreviewUrl ?? current.voice_url!} />
                <button
                  type="button"
                  onClick={clearVoice}
                  className="text-xs text-neutral-500 hover:text-red-400 underline underline-offset-2"
                >
                  Remove &amp; re-record
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="shrink-0 px-4 pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))] border-t border-white/10 flex flex-col gap-2">
        {currentIndex > 0 && (
          <button
            onClick={goPrev}
            className="w-full py-3.5 rounded-lg font-semibold text-sm text-white"
            style={{ background: "#1a1a1e" }}
          >
            Previous
          </button>
        )}
        {!isLast ? (
          <button
            onClick={goNext}
            className="w-full py-3.5 rounded-lg font-semibold text-sm text-black"
            style={{ background: "#22c55e" }}
          >
            Next →
          </button>
        ) : (
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3.5 rounded-lg font-semibold text-sm text-black disabled:opacity-40"
            style={{ background: "#22c55e" }}
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        )}
      </div>
    </div>
  );
}
