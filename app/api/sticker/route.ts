import { NextResponse } from "next/server";
import sharp from "sharp";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { base64, mimeType } = await req.json();

    const apiKey = process.env.REMOVE_BG_API_KEY;
    if (!apiKey) throw new Error("Missing REMOVE_BG_API_KEY");

    if (!base64 || !mimeType) {
      return NextResponse.json(
        { error: "Expected { base64, mimeType }" },
        { status: 400 },
      );
    }

    // 1) Auto-rotate + resize to max 1500px (remove.bg has a 22MB file limit)
    const rotated = await sharp(Buffer.from(base64, "base64"))
      .rotate()
      .resize({ width: 1500, height: 1500, fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer();

    const formData = new FormData();
    formData.append(
      "image_file",
      new Blob([new Uint8Array(rotated)], { type: "image/png" as `${string}/${string}` }),
      "image.png",
    );
    formData.append("size", "auto");

    const removeBgRes = await fetch("https://api.remove.bg/v1.0/removebg", {
      method: "POST",
      headers: { "X-Api-Key": apiKey },
      body: formData,
    });

    if (!removeBgRes.ok) {
      const errText = await removeBgRes.text();
      throw new Error(`remove.bg error ${removeBgRes.status}: ${errText}`);
    }

    const cutout = Buffer.from(await removeBgRes.arrayBuffer());

    // 2) Build thick rough-edged white border matching the cutout shape aesthetic (~5% of image size)
    const cutoutMeta = await sharp(cutout).metadata();
    const tw = cutoutMeta.width ?? 0;
    const th = cutoutMeta.height ?? 0;
    if (!tw || !th) throw new Error("remove.bg returned empty image");

    // Scale border to ~5% of the larger dimension — same proportion as the canvas cutout shapes
    const borderSize = Math.round(Math.max(tw, th) * 0.05);
    const pad = Math.round(borderSize * 0.7);

    const alphaChannelPng = await sharp(cutout)
      .ensureAlpha()
      .extractChannel(3)
      .png()
      .toBuffer();

    const dilatedAlphaPng = await sharp(alphaChannelPng)
      .extend({
        top: borderSize,
        bottom: borderSize,
        left: borderSize,
        right: borderSize,
        background: { r: 0, g: 0, b: 0 },
      })
      // Larger blur spread + high threshold = hard chunky edge that reads as rough
      .blur(borderSize * 0.7)
      .threshold(110)
      .png()
      .toBuffer();

    const dilatedMeta = await sharp(dilatedAlphaPng).metadata();
    const dilatedW = dilatedMeta.width ?? tw + borderSize * 2;
    const dilatedH = dilatedMeta.height ?? th + borderSize * 2;

    const { data: dilatedRaw } = await sharp(dilatedAlphaPng)
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const outlineRaw = Buffer.alloc(dilatedW * dilatedH * 4);
    for (let i = 0; i < dilatedW * dilatedH; i++) {
      outlineRaw[i * 4 + 0] = 255;
      outlineRaw[i * 4 + 1] = 255;
      outlineRaw[i * 4 + 2] = 255;
      outlineRaw[i * 4 + 3] = dilatedRaw[i];
    }

    const outlinePng = await sharp(outlineRaw, {
      raw: { width: dilatedW, height: dilatedH, channels: 4 },
    })
      .png()
      .toBuffer();

    // 3) Composite: white border behind cutout, add transparent breathing room
    const sticker = await sharp(outlinePng)
      .composite([
        { input: cutout, top: borderSize, left: borderSize, blend: "over" },
      ])
      .extend({
        top: pad,
        bottom: pad,
        left: pad,
        right: pad,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();

    return NextResponse.json({
      sticker: `data:image/png;base64,${sticker.toString("base64")}`,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Sticker error" },
      { status: 500 },
    );
  }
}
