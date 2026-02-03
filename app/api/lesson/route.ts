import { NextResponse } from "next/server";
import { genAI } from "@/lib/gemini";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { LessonPayloadSchema } from "@/lib/validators/lesson";

export const runtime = "nodejs";

function stripFences(text: string) {
  return text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}

export async function POST(req: Request) {
  try {
    const { postId, detectionId, label, targetLang } = await req.json();

    if (!postId || !label || !targetLang) {
      return NextResponse.json(
        { error: "Missing postId, label, or targetLang" },
        { status: 400 },
      );
    }

    const systemInstruction = `
You are a language tutor.
Generate a micro-lesson for the object label: "${label}".
Target language: "${targetLang}".
Return ONLY valid JSON with this shape:
{
  "label": string,
  "target_lang": string,
  "meaning": string,
  "examples": [{"target": string, "english": string}],
  "related_words": string[],
  "exercises": [
    {"type":"flashcard","front":string,"back":string},
    {"type":"fill_blank","prompt":string,"answer":string}
  ]
}
Keep it short, practical, beginner-friendly.
`;

    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      systemInstruction,
    });

    const result = await model.generateContent(["Return only JSON."]);
    const raw = result.response.text();
    const cleaned = stripFences(raw);

    const parsed = JSON.parse(cleaned);
    const payload = LessonPayloadSchema.parse(parsed);

    const { data, error } = await supabaseAdmin
      .from("lessons")
      .insert({
        post_id: postId,
        detection_id: detectionId ?? null,
        target_lang: payload.target_lang,
        payload,
      })
      .select("id,created_at,target_lang,detection_id,payload")
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({ lesson: data });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Lesson error" },
      { status: 500 },
    );
  }
}
