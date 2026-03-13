import { NextResponse } from "next/server";
import { getDetector } from "@/lib/detector";
import type { Detection } from "@/types";

export const runtime = "nodejs";

// Intersection-over-union for two [ymin,xmin,ymax,xmax] boxes
function iou(a: Detection["box_2d"], b: Detection["box_2d"]) {
  const [ay1, ax1, ay2, ax2] = a;
  const [by1, bx1, by2, bx2] = b;
  const iy1 = Math.max(ay1, by1), ix1 = Math.max(ax1, bx1);
  const iy2 = Math.min(ay2, by2), ix2 = Math.min(ax2, bx2);
  const inter = Math.max(0, iy2 - iy1) * Math.max(0, ix2 - ix1);
  const aArea = (ay2 - ay1) * (ax2 - ax1);
  const bArea = (by2 - by1) * (bx2 - bx1);
  return inter / (aArea + bArea - inter);
}

// Keep more specific (smaller) boxes when overlap is high
function nms(detections: Detection[], threshold = 0.4): Detection[] {
  const sorted = [...detections].sort((a, b) => {
    const area = (d: Detection) => (d.box_2d[2] - d.box_2d[0]) * (d.box_2d[3] - d.box_2d[1]);
    return area(a) - area(b); // smallest first = most specific
  });
  const kept: Detection[] = [];
  for (const det of sorted) {
    if (!kept.some((k) => iou(det.box_2d, k.box_2d) > threshold)) {
      kept.push(det);
    }
  }
  return kept;
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

    const detector = getDetector();
    const result = await detector.detectAll({ base64, mimeType });

    return NextResponse.json({
      ...result,
      objects: nms(result.objects),
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Vision error" },
      { status: 500 },
    );
  }
}
