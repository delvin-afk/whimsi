import { NextResponse } from "next/server";
import { getDetector } from "@/lib/detector";

export const runtime = "nodejs";

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
    const detections = await detector.detect({ base64, mimeType });

    return NextResponse.json({ detections });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Vision error" },
      { status: 500 },
    );
  }
}
