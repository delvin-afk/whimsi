import type { PostRow, Detection, LessonRow } from "@/types";

function publicImageUrl(imagePath: string) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return `${base}/storage/v1/object/public/moments/${imagePath}`;
}

export default function PostCard({ post }: { post: PostRow }) {
  const detections = post.detections ?? [];
  const lessons = post.lessons ?? [];

  const lessonByDetection = new Map<string, LessonRow>();
  for (const l of lessons) {
    if (l.detection_id) lessonByDetection.set(l.detection_id, l);
  }

  // ✅ Stable formatting: use ISO date string (same server/client)
  const created = new Date(post.created_at)
    .toISOString()
    .replace("T", " ")
    .slice(0, 16);

  return (
    <div className="rounded-2xl border p-4 space-y-3">
      <img
        src={publicImageUrl(post.image_path)}
        alt="moment"
        className="w-full rounded-2xl border"
      />

      <div className="flex flex-wrap gap-2">
        {detections.map((d: Detection) => (
          <span
            key={d.id ?? d.label}
            className="text-xs px-2 py-1 rounded-full border"
          >
            {d.label}
          </span>
        ))}
      </div>

      <div className="space-y-2">
        {detections.map((d) => {
          const lesson = d.id ? lessonByDetection.get(d.id) : undefined;
          if (!lesson) return null;

          const payload = lesson.payload;
          return (
            <div key={lesson.id} className="rounded-xl border p-3">
              <div className="font-semibold">
                {payload.label} → {payload.meaning} ({payload.target_lang})
              </div>
              <ul className="list-disc pl-5 text-sm opacity-90 mt-2">
                {payload.examples.slice(0, 3).map((ex, i) => (
                  <li key={i}>
                    {ex.target} —{" "}
                    <span className="opacity-80">{ex.english}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <div className="text-xs opacity-60">{created}</div>
    </div>
  );
}
