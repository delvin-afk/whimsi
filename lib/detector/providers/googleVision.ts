import vision from "@google-cloud/vision";
import type { Detection } from "@/types";
import type { DetectorProvider, VisionResult } from "../types";

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
  private client = new vision.ImageAnnotatorClient();

  async detectAll({
    base64,
  }: {
    base64: string;
    mimeType: string;
  }): Promise<VisionResult> {
    const image = { content: Buffer.from(base64, "base64") };

    // Run object + label detection in parallel
    const [[objectRes], [labelRes]] = await Promise.all([
      this.client.objectLocalization({ image }),
      this.client.labelDetection({ image }),
    ]);

    const objects: Detection[] = (objectRes.localizedObjectAnnotations ?? [])
      .map((obj: any) => {
        const name = obj.name as string | undefined;
        const verts: NormalizedVertex[] =
          obj.boundingPoly?.normalizedVertices ?? [];

        if (!name || verts.length === 0) return null;

        return {
          label: name,
          box_2d: polyToBox2d(verts),
        } as Detection;
      })
      .filter(Boolean) as Detection[];

    const labels = (labelRes.labelAnnotations ?? [])
      .map((l: any) => ({
        label: l.description as string,
        score: l.score as number | undefined,
      }))
      .filter((x: any) => (x.score ?? 0) >= 0.6)
      .slice(0, 10);

    return {
      objects: objects.slice(0, 3), // keep your top-3 object logic
      labels,
    };
  }
}
