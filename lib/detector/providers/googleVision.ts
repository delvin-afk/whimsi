import type { DetectorProvider } from "../types";
import type { Detection } from "@/types";
import vision from "@google-cloud/vision";

type NormalizedVertex = { x?: number; y?: number };

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

function polyToBox2d(
  normVerts: NormalizedVertex[],
): [number, number, number, number] {
  const xs = normVerts.map((v) => clamp01(v.x ?? 0));
  const ys = normVerts.map((v) => clamp01(v.y ?? 0));

  const xmin = Math.min(...xs);
  const xmax = Math.max(...xs);
  const ymin = Math.min(...ys);
  const ymax = Math.max(...ys);

  return [
    Math.round(ymin * 1000),
    Math.round(xmin * 1000),
    Math.round(ymax * 1000),
    Math.round(xmax * 1000),
  ];
}

export class GoogleVisionDetector implements DetectorProvider {
  private client: vision.ImageAnnotatorClient;

  constructor() {
    // Uses GOOGLE_APPLICATION_CREDENTIALS automatically
    this.client = new vision.ImageAnnotatorClient();
  }

  async detect({
    base64,
  }: {
    base64: string;
    mimeType: string;
  }): Promise<Detection[]> {
    // objectLocalization returns localizedObjectAnnotations with boundingPoly.normalizedVertices
    const [result] = await this.client.objectLocalization({
      image: { content: Buffer.from(base64, "base64") },
    });

    const objects = result.localizedObjectAnnotations ?? [];

    const detections = objects
      .map((obj) => {
        const name = obj.name;
        const verts = obj.boundingPoly?.normalizedVertices ?? [];
        const score = obj.score ?? 0;

        if (!name || verts.length === 0) return null;

        return {
          label: name,
          box_2d: polyToBox2d(verts as any),
          score,
        } as any;
      })
      .filter(Boolean) as any[];

    detections.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    return detections.slice(0, 3).map(({ score, ...d }) => d);
  }
}
