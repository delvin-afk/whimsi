"use client";

import { useMemo, useState } from "react";
import PhotoCanvas from "@/components/PhotoCanvas";
import type { Detection, LessonRow, PostRow } from "@/types";
import { fileToBase64 } from "@/lib/utils/image";

export default function CapturePage() {
  const [localImageUrl, setLocalImageUrl] = useState<string>("");
  const [mimeType, setMimeType] = useState<string>("");
  const [base64, setBase64] = useState<string>("");

  const [detections, setDetections] = useState<Detection[]>([]);
  const [loadingVision, setLoadingVision] = useState(false);
  const [saving, setSaving] = useState(false);

  const [savedPost, setSavedPost] = useState<PostRow | null>(null);

  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [loadingLessonId, setLoadingLessonId] = useState<string | null>(null);

  const targetLang = "es"; // MVP default; later pull from profile table

  const canSave = base64 && mimeType && detections.length > 0 && !saving;

  async function onFileChange(file: File | null) {
    if (!file) return;

    setSavedPost(null);
    setLessons([]);
    setDetections([]);

    setMimeType(file.type);
    setLocalImageUrl(URL.createObjectURL(file));
    setBase64(await fileToBase64(file));

    // call vision
    setLoadingVision(true);
    const res = await fetch("/api/vision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        base64: await fileToBase64(file),
        mimeType: file.type,
      }),
    });

    const json = await res.json();
    if (res.ok) setDetections(json.detections ?? []);
    else alert(json.error ?? "Vision failed");
    setLoadingVision(false);
  }

  async function savePost() {
    if (!canSave) return;
    setSaving(true);

    // best effort image dimensions from browser
    let imageWidth: number | null = null;
    let imageHeight: number | null = null;

    try {
      const img = new Image();
      img.src = localImageUrl;
      await new Promise((r) => (img.onload = r));
      imageWidth = img.width;
      imageHeight = img.height;
    } catch {}

    const res = await fetch("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        base64,
        mimeType,
        imageWidth,
        imageHeight,
        detections,
      }),
    });

    const json = await res.json();
    if (res.ok) {
      setSavedPost(json.post);
      // replace detections with DB rows (now have ids)
      setDetections(json.post.detections ?? []);
    } else {
      alert(json.error ?? "Save failed");
    }

    setSaving(false);
  }

  async function generateLesson(d: Detection) {
    if (!savedPost) {
      alert("Save the post first (so we can attach the lesson).");
      return;
    }

    setLoadingLessonId(d.id ?? d.label);

    const res = await fetch("/api/lesson", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        postId: savedPost.id,
        detectionId: d.id ?? null,
        label: d.label,
        targetLang,
      }),
    });

    const json = await res.json();
    if (res.ok) {
      setLessons((prev) => [json.lesson, ...prev]);
    } else {
      alert(json.error ?? "Lesson failed");
    }

    setLoadingLessonId(null);
  }

  const lessonText = useMemo(() => {
    if (!lessons.length) return null;
    const l = lessons[0];
    return (
      <div className="rounded-2xl border p-4 space-y-2">
        <div className="font-semibold">
          {l.payload.label} → {l.payload.meaning} ({l.payload.target_lang})
        </div>
        <div className="text-sm opacity-90">
          Examples:
          <ul className="list-disc pl-5 mt-1">
            {l.payload.examples.slice(0, 3).map((ex, i) => (
              <li key={i}>
                {ex.target} — <span className="opacity-80">{ex.english}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }, [lessons]);

  return (
    <main className="space-y-4">
      <h1 className="text-2xl font-semibold">Capture</h1>

      <input
        type="file"
        accept="image/*"
        onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
      />

      {loadingVision && (
        <p className="text-sm opacity-70">Detecting objects…</p>
      )}

      {localImageUrl && (
        <div className="space-y-3">
          <PhotoCanvas
            src={localImageUrl}
            detections={detections}
            onMarkerClick={generateLesson}
          />

          <div className="flex items-center gap-3">
            <button
              className="px-4 py-2 rounded-xl border disabled:opacity-50"
              onClick={savePost}
              disabled={!canSave}
              type="button"
            >
              {saving ? "Saving…" : savedPost ? "Saved ✅" : "Save Post"}
            </button>

            <div className="text-sm opacity-70">
              Tip: Save first, then tap markers to generate lessons.
            </div>
          </div>

          {loadingLessonId && (
            <p className="text-sm opacity-70">Generating lesson…</p>
          )}

          {lessonText}
        </div>
      )}
    </main>
  );
}
