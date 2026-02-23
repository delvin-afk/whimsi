// "use client";

// import { useMemo, useState } from "react";
// import PhotoCanvas from "@/components/PhotoCanvas";
// import type { Detection, LessonRow, PostRow } from "@/types";
// import { fileToBase64 } from "@/lib/utils/image";

// export default function CapturePage() {
//   const [localImageUrl, setLocalImageUrl] = useState<string>("");
//   const [mimeType, setMimeType] = useState<string>("");
//   const [base64, setBase64] = useState<string>("");

//   const [detections, setDetections] = useState<Detection[]>([]);
//   const [loadingVision, setLoadingVision] = useState(false);
//   const [saving, setSaving] = useState(false);

//   const [savedPost, setSavedPost] = useState<PostRow | null>(null);

//   const [lessons, setLessons] = useState<LessonRow[]>([]);
//   const [loadingLessonId, setLoadingLessonId] = useState<string | null>(null);

//   const targetLang = "es"; // MVP default; later pull from profile table

//   const canSave = base64 && mimeType && detections.length > 0 && !saving;

//   async function onFileChange(file: File | null) {
//     if (!file) return;

//     setSavedPost(null);
//     setLessons([]);
//     setDetections([]);

//     setMimeType(file.type);
//     setLocalImageUrl(URL.createObjectURL(file));
//     setBase64(await fileToBase64(file));

//     // call vision
//     setLoadingVision(true);
//     const res = await fetch("/api/vision", {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({
//         base64: await fileToBase64(file),
//         mimeType: file.type,
//       }),
//     });

//     const json = await res.json();
//     if (res.ok) setDetections(json.detections ?? []);
//     else alert(json.error ?? "Vision failed");
//     setLoadingVision(false);
//   }

//   async function savePost() {
//     if (!canSave) return;
//     setSaving(true);

//     // best effort image dimensions from browser
//     let imageWidth: number | null = null;
//     let imageHeight: number | null = null;

//     try {
//       const img = new Image();
//       img.src = localImageUrl;
//       await new Promise((r) => (img.onload = r));
//       imageWidth = img.width;
//       imageHeight = img.height;
//     } catch {}

//     const res = await fetch("/api/posts", {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({
//         base64,
//         mimeType,
//         imageWidth,
//         imageHeight,
//         detections,
//       }),
//     });

//     const json = await res.json();
//     if (res.ok) {
//       setSavedPost(json.post);
//       // replace detections with DB rows (now have ids)
//       setDetections(json.post.detections ?? []);
//     } else {
//       alert(json.error ?? "Save failed");
//     }

//     setSaving(false);
//   }

//   async function generateLesson(d: Detection) {
//     if (!savedPost) {
//       alert("Save the post first (so we can attach the lesson).");
//       return;
//     }

//     setLoadingLessonId(d.id ?? d.label);

//     const res = await fetch("/api/lesson", {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({
//         postId: savedPost.id,
//         detectionId: d.id ?? null,
//         label: d.label,
//         targetLang,
//       }),
//     });

//     const json = await res.json();
//     if (res.ok) {
//       setLessons((prev) => [json.lesson, ...prev]);
//     } else {
//       alert(json.error ?? "Lesson failed");
//     }

//     setLoadingLessonId(null);
//   }

//   const lessonText = useMemo(() => {
//     if (!lessons.length) return null;
//     const l = lessons[0];
//     return (
//       <div className="rounded-2xl border p-4 space-y-2">
//         <div className="font-semibold">
//           {l.payload.label} → {l.payload.meaning} ({l.payload.target_lang})
//         </div>
//         <div className="text-sm opacity-90">
//           Examples:
//           <ul className="list-disc pl-5 mt-1">
//             {l.payload.examples.slice(0, 3).map((ex, i) => (
//               <li key={i}>
//                 {ex.target} — <span className="opacity-80">{ex.english}</span>
//               </li>
//             ))}
//           </ul>
//         </div>
//       </div>
//     );
//   }, [lessons]);

//   return (
//     <main className="space-y-4">
//       <h1 className="text-2xl font-semibold">Capture</h1>

//       <input
//         type="file"
//         accept="image/*"
//         onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
//       />

//       {loadingVision && (
//         <p className="text-sm opacity-70">Detecting objects…</p>
//       )}

//       {localImageUrl && (
//         <div className="space-y-3">
//           <PhotoCanvas
//             src={localImageUrl}
//             detections={detections}
//             onMarkerClick={generateLesson}
//           />

//           <div className="flex items-center gap-3">
//             <button
//               className="px-4 py-2 rounded-xl border disabled:opacity-50"
//               onClick={savePost}
//               disabled={!canSave}
//               type="button"
//             >
//               {saving ? "Saving…" : savedPost ? "Saved ✅" : "Save Post"}
//             </button>

//             <div className="text-sm opacity-70">
//               Tip: Save first, then tap markers to generate lessons.
//             </div>
//           </div>

//           {loadingLessonId && (
//             <p className="text-sm opacity-70">Generating lesson…</p>
//           )}

//           {lessonText}
//         </div>
//       )}
//     </main>
//   );
// }

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
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [activeLesson, setActiveLesson] = useState<LessonRow | null>(null);
  const [loadingStickerId, setLoadingStickerId] = useState<string | null>(null);

  const targetLang = "es";
  const canSave = base64 && mimeType && detections.length > 0 && !saving;

  async function onFileChange(file: File | null) {
    if (!file) return;
    setSavedPost(null);
    setLessons([]);
    setDetections([]);
    setActiveLesson(null);
    setCarouselIndex(0);
    setMimeType(file.type);
    setLocalImageUrl(URL.createObjectURL(file));
    setBase64(await fileToBase64(file));

    setLoadingVision(true);
    const res = await fetch("/api/vision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ base64: await fileToBase64(file), mimeType: file.type }),
    });
    const json = await res.json();
    if (res.ok) {
      const d = json.detections;
      setDetections(Array.isArray(d) ? d : d?.items ?? []);
    } else {
      alert(json.error ?? "Vision failed");
    }
    setLoadingVision(false);
  }

  async function savePost() {
    if (!canSave) return;
    setSaving(true);
    let imageWidth: number | null = null;
    let imageHeight: number | null = null;
    try {
      const img = new Image();
      img.src = localImageUrl;
      await new Promise((r) => (img.onload = r));
      imageWidth = img.width;
      imageHeight = img.height;
    } catch {}

    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base64, mimeType, imageWidth, imageHeight, detections }),
      });
      
      const json = await res.json();
      
      if (res.ok) {
        setSavedPost(json.post);
        // Sync local detections with DB detections (including new IDs)
        setDetections(json.post.detections ?? []);
      } else {
        alert(json.error ?? "Save failed");
      }
    } catch (err) {
      alert("Save failed due to a network error.");
    } finally {
      setSaving(false);
    }
  }

  async function generateLesson(d: Detection) {
    if (!savedPost) { alert("Save the post first."); return; }
    const existing = lessons.find(
      (l) => l.payload?.label?.toLowerCase() === d.label?.toLowerCase()
    );
    if (existing) { setActiveLesson(existing); return; }

    setLoadingLessonId(d.id ?? d.label);
    const res = await fetch("/api/lesson", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId: savedPost.id, detectionId: d.id ?? null, label: d.label, targetLang }),
    });
    const json = await res.json();
    if (res.ok) {
      setLessons((prev) => [json.lesson, ...prev]);
      setActiveLesson(json.lesson);
    } else {
      alert(json.error ?? "Lesson failed");
    }
    setLoadingLessonId(null);
  }

  async function extractSticker(d: Detection) {
    const box = d.box_2d;
    if (!box || !Array.isArray(box)) {
      alert("No bounding box available. Save the post first.");
      return;
    }
  
    setLoadingStickerId(d.id ?? d.label);
  
    try {
      const res = await fetch("/api/sticker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base64, mimeType, box_2d: box }),
      });
  
      const json = await res.json();
      if (res.ok) {
        // Downloads the isolated object (no background)
        const a = document.createElement("a");
        a.href = json.sticker;
        a.download = `${d.label}-sticker.png`;
        a.click();
      } else {
        alert(json.error ?? "Sticker extraction failed");
      }
    } catch (error) {
      console.error("Sticker error:", error);
      alert("Background removal service is currently unavailable.");
    } finally {
      setLoadingStickerId(null);
    }
  }

  function prevCard() {
    setCarouselIndex((i) => (i - 1 + detections.length) % detections.length);
    setActiveLesson(null);
  }

  function nextCard() {
    setCarouselIndex((i) => (i + 1) % detections.length);
    setActiveLesson(null);
  }

  const currentDetection = detections[carouselIndex];

  const currentLesson = useMemo(() => {
    if (activeLesson) return activeLesson;
    if (!currentDetection) return null;
    return lessons.find(
      (l) => l.payload?.label?.toLowerCase() === currentDetection.label?.toLowerCase()
    ) ?? null;
  }, [activeLesson, currentDetection, lessons]);

  return (
    <main className="space-y-4">
      <h1 className="text-2xl font-semibold">Capture</h1>
      <input
        type="file"
        accept="image/*"
        onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
      />

      {loadingVision && <p className="text-sm opacity-70">Detecting objects…</p>}

      {localImageUrl && (
        <div className="space-y-4">
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
            {!savedPost && (
              <p className="text-sm opacity-70">Tip: Save first, then explore lessons.</p>
            )}
          </div>

          {savedPost && detections.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-medium opacity-70">
                {detections.length} item{detections.length !== 1 ? "s" : ""} detected — explore lessons
              </p>

              <div className="rounded-2xl border p-5 space-y-4 min-h-[160px]">
                <div className="flex items-center justify-between">
                  <button
                    onClick={prevCard}
                    disabled={detections.length <= 1}
                    className="text-xl px-2 py-1 rounded-lg hover:bg-gray-100 disabled:opacity-30"
                  >
                    ←
                  </button>
                  <div className="text-center">
                    <span className="text-lg font-semibold capitalize">
                      {currentDetection?.label}
                    </span>
                    <div className="text-xs opacity-50 mt-0.5">
                      {carouselIndex + 1} / {detections.length}
                    </div>
                  </div>
                  <button
                    onClick={nextCard}
                    disabled={detections.length <= 1}
                    className="text-xl px-2 py-1 rounded-lg hover:bg-gray-100 disabled:opacity-30"
                  >
                    →
                  </button>
                </div>

                {loadingLessonId === (currentDetection?.id ?? currentDetection?.label) ? (
                  <p className="text-sm opacity-60 text-center py-2">Generating lesson…</p>
                ) : currentLesson ? (
                  <div className="space-y-2 text-sm">
                    <div className="font-medium">
                      {currentLesson.payload.label} → {currentLesson.payload.meaning}{" "}
                      <span className="opacity-50">({currentLesson.payload.target_lang})</span>
                    </div>
                    <ul className="list-disc pl-5 space-y-1 opacity-80">
                      {currentLesson.payload.examples.slice(0, 3).map((ex, i) => (
                        <li key={i}>
                          {ex.target} — <span className="opacity-70">{ex.english}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="text-center pt-1">
                    <button
                      onClick={() => generateLesson(currentDetection)}
                      className="px-5 py-2 rounded-xl bg-black text-white text-sm hover:opacity-80 transition-opacity"
                    >
                      Learn "{currentDetection?.label}" in Spanish
                    </button>
                  </div>
                )}

                <div className="text-center border-t pt-3">
                  <button
                    onClick={() => extractSticker(currentDetection)}
                    disabled={loadingStickerId === (currentDetection?.id ?? currentDetection?.label)}
                    className="px-4 py-1.5 rounded-xl border text-sm hover:bg-gray-50 disabled:opacity-50 transition-colors"
                  >
                    {loadingStickerId === (currentDetection?.id ?? currentDetection?.label)
                      ? "Extracting…"
                      : "🎨 Extract Sticker"}
                  </button>
                </div>
              </div>

              <div className="flex justify-center gap-1.5">
                {detections.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => { setCarouselIndex(i); setActiveLesson(null); }}
                    className={`w-2 h-2 rounded-full transition-all ${
                      i === carouselIndex ? "bg-black scale-125" : "bg-gray-300"
                    }`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}