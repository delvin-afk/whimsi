import { NextResponse } from "next/server";
import sharp from "sharp";

export async function POST(req: Request) {
  try {
    const { base64, mimeType, box_2d } = await req.json();
    const apiKey = process.env.REMOVEBG_API_KEY;

    if (!apiKey) throw new Error("Missing REMOVEBG_API_KEY");

    // 1. Initial Crop
    const imageBuffer = Buffer.from(base64, "base64");
    const metadata = await sharp(imageBuffer).metadata();
    const { width = 0, height = 0 } = metadata;
    const [ymin, xmin, ymax, xmax] = box_2d.map((v: number) => v / 1000);
    
    const croppedBuffer = await sharp(imageBuffer)
      .extract({
        left: Math.round(xmin * width),
        top: Math.round(ymin * height),
        width: Math.round((xmax - xmin) * width),
        height: Math.round((ymax - ymin) * height),
      })
      .toFormat("png")
      .toBuffer();

    // 2. Remove Background
    const formData = new FormData();
    formData.append("image_file", new Blob([croppedBuffer]), "sticker.png");
    const bgRes = await fetch("https://api.remove.bg/v1.0/removebg", {
      method: "POST",
      headers: { "X-Api-Key": apiKey },
      body: formData,
    });

    if (!bgRes.ok) throw new Error("Background removal failed");
    const isolatedBuffer = Buffer.from(await bgRes.arrayBuffer());

    // 3. Add Sticker Border and Shadow using Sharp
    // We pad the image so the border doesn't get cut off at the edges
// Replace section 3 in your app/api/sticker/route.ts
const borderSize = 12; // Adjust for thickness

// 1. Create a "thickened" white mask for the border
const mask = await sharp(isolatedBuffer)
  .ensureAlpha()
  .extractChannel('alpha') // Get just the shape
  .toBuffer();

const thickenedMask = await sharp(mask)
  .extend({ top: borderSize, bottom: borderSize, left: borderSize, right: borderSize, background: 'transparent' })
  .blur(borderSize / 2) // Soften for expansion
  .threshold(1) // Solidify the softened edges into a thick border
  .toBuffer();

// 2. Color that mask white and place the original on top
const finalSticker = await sharp(thickenedMask)
  .tint({ r: 255, g: 255, b: 255 }) // Make it pure white
  .composite([{ 
    input: isolatedBuffer, 
    gravity: 'center', 
    blend: 'over' 
  }])
  .toFormat('png')
  .toBuffer();

const finalBase64 = finalSticker.toString("base64");

    return NextResponse.json({
      sticker: `data:image/png;base64,${finalBase64}`,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}