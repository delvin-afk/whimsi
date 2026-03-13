import type { DetectorProvider, VisionResult } from "../types";
import type { Detection } from "@/types";
import { GoogleGenerativeAI } from "@google/generative-ai";

function stripDataUrl(b64: string) {
  return b64.includes(",") ? b64.split(",")[1] : b64;
}

export class GeminiDetector implements DetectorProvider {
  private model;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("Missing GEMINI_API_KEY");
    const genAI = new GoogleGenerativeAI(apiKey);
    this.model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  }

  async detectAll({
    base64,
    mimeType,
  }: {
    base64: string;
    mimeType: string;
  }): Promise<VisionResult> {
    const cleaned = stripDataUrl(base64);

    // Ask for BOTH: objects + “features”
    const prompt = `
You are a vision detector for a language-learning app.

Task:
1) Identify 3-6 concrete objects (nouns) that a learner can tap (e.g., “coca-cola bottle”, “plate of food”, “person”, “table”).
2) Identify 2-6 scene features (e.g., “restaurant”, “meal”, “table setting”, “drink”, “blurred background”).
3) Return ONLY JSON (no markdown).

Schema:
{
  “objects”: [
    { “label”: string, “box_2d”: [ymin,xmin,ymax,xmax] }
  ],
  “features”: [
    { “label”: string, “score”: number }
  ]
}

Rules:
- box_2d is REQUIRED for every object. Estimate it as best you can — never omit or set to null.
- box_2d coords are normalized 0-1000 integers: [ymin, xmin, ymax, xmax].
- labels should be short, lowercase, and learner-friendly.
- score is 0..1 confidence for features.
`;

    const result = await this.model.generateContent([
      { text: prompt },
      {
        inlineData: {
          data: cleaned,
          mimeType,
        },
      },
    ]);

    // Always extract the first complete {...} block — works regardless of markdown fences
    const raw = result.response.text();
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start < 0 || end <= start) throw new Error("Gemini returned non-JSON output");

    let parsed: any;
    try {
      parsed = JSON.parse(raw.slice(start, end + 1));
    } catch (err) {
      throw new Error(`Gemini JSON parse failed: ${err}`);
    }

    const objects: Detection[] = Array.isArray(parsed.objects)
      ? parsed.objects
          .map((o: any) => ({
            label: String(o.label ?? "").trim(),
            box_2d: Array.isArray(o.box_2d) ? o.box_2d : null,
          }))
          .filter((o: any) => o.label.length > 0 && Array.isArray(o.box_2d))
      : [];

    const labels = Array.isArray(parsed.features)
      ? parsed.features
          .map((f: any) => ({
            label: String(f.label ?? "").trim(),
            score: typeof f.score === "number" ? f.score : undefined,
          }))
          .filter((x: any) => x.label.length > 0)
      : [];

    return { objects, labels };
  }
}
