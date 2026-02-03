import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { mimeToExt } from "@/lib/utils/image";
import { DetectionsSchema } from "@/lib/validators/vision";

export const runtime = "nodejs";

const BUCKET = "moments";

function decodeBase64(base64: string) {
  return Buffer.from(base64, "base64");
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { base64, mimeType, imageWidth, imageHeight, detections } = body;

    if (!base64 || !mimeType || !detections) {
      return NextResponse.json(
        { error: "Missing base64, mimeType, or detections" },
        { status: 400 },
      );
    }

    const validatedDetections = DetectionsSchema.parse(detections);

    // 1) Create post row first (we need id)
    const { data: post, error: postErr } = await supabaseAdmin
      .from("posts")
      .insert({
        // If your table requires user_id with RLS, remove it or supply a server-defined user later.
        // For MVP with service role, we can omit user_id IF your schema allows it.
        image_path: "pending",
        image_width: imageWidth ?? null,
        image_height: imageHeight ?? null,
      })
      .select("id,created_at,image_path,image_width,image_height")
      .single();

    if (postErr) throw new Error(`posts insert failed: ${postErr.message}`);

    const ext = mimeToExt(mimeType);
    const objectPath = `${post.id}.${ext}`;

    // 2) Upload to storage
    const fileBytes = decodeBase64(base64);

    const { error: uploadErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(objectPath, fileBytes, {
        contentType: mimeType,
        upsert: true,
      });

    if (uploadErr)
      throw new Error(`storage upload failed: ${uploadErr.message}`);

    // 3) Update post with real image_path
    const { data: updatedPost, error: updErr } = await supabaseAdmin
      .from("posts")
      .update({ image_path: objectPath })
      .eq("id", post.id)
      .select("id,created_at,image_path,image_width,image_height")
      .single();

    if (updErr) throw new Error(`posts update failed: ${updErr.message}`);

    // 4) Insert detections
    const rows = validatedDetections.map((d) => ({
      post_id: updatedPost.id,
      label: d.label,
      box_2d: d.box_2d,
    }));

    const { data: detRows, error: detErr } = await supabaseAdmin
      .from("detections")
      .insert(rows)
      .select("id,label,box_2d,post_id");

    if (detErr) throw new Error(`detections insert failed: ${detErr.message}`);

    return NextResponse.json({
      post: { ...updatedPost, detections: detRows ?? [] },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Posts error" },
      { status: 500 },
    );
  }
}

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("posts")
      .select(
        "id,created_at,image_path,image_width,image_height,detections(id,label,box_2d),lessons(id,created_at,target_lang,detection_id,payload)",
      )
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw new Error(error.message);

    return NextResponse.json({ posts: data ?? [] });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Feed error" },
      { status: 500 },
    );
  }
}
