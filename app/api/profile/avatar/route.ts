import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const userId = formData.get("userId") as string | null;

    if (!file || !userId) {
      return NextResponse.json({ error: "Missing file or userId" }, { status: 400 });
    }

    const mimeType = file.type || "image/jpeg";
    const buffer = Buffer.from(await file.arrayBuffer());

    // Always write to the same path per user so upsert overwrites the old photo
    const filename = `avatars/${userId}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from("Stickers")
      .upload(filename, buffer, { contentType: mimeType, upsert: true });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from("Stickers")
      .getPublicUrl(filename);

    // Add a cache-bust timestamp so the browser fetches the new photo
    const avatarUrl = `${publicUrl}?v=${Date.now()}`;

    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({ avatar_url: publicUrl })
      .eq("id", userId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ avatar_url: avatarUrl });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
