import { NextResponse } from "next/server";
import { genAI } from "@/lib/gemini";
import { DetectionsSchema } from "@/lib/validators/vision";

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
    const { base64, mimeType } = await req.json();

    if (!base64 || !mimeType) {
      return NextResponse.json(
        { error: "Missing base64 or mimeType" },
        { status: 400 },
      );
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      systemInstruction:
        'Analyze this image. Detect 3 significant objects for a language learner. Return ONLY a JSON array: [{"label":"English Word","box_2d":[ymin,xmin,ymax,xmax]}]. Coordinates must be normalized 0-1000.',
    });

    const result = await model.generateContent([
      {
        inlineData: { data: base64, mimeType },
      },
      "Return only JSON.",
    ]);

    const raw = result.response.text();
    const cleaned = stripFences(raw);

    const parsed = JSON.parse(cleaned);
    const detections = DetectionsSchema.parse(parsed);

    return NextResponse.json({ detections });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Vision error" },
      { status: 500 },
    );
  }
}
