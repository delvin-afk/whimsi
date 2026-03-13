import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { stickerBase64, caption, locationName, lat, lng, userId, username, groupId } =
      await req.json();

    if (!stickerBase64 || !userId || !username) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 1) Upsert profile
    await supabaseAdmin.from("profiles").upsert(
      { id: userId, username },
      { onConflict: "id" }
    );

    // 2) Upload PNG to Supabase Storage
    const buffer = Buffer.from(stickerBase64.replace(/^data:image\/png;base64,/, ""), "base64");
    const filename = `${userId}/${Date.now()}.png`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from("Stickers")
      .upload(filename, buffer, { contentType: "image/png", upsert: false });

    if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from("Stickers")
      .getPublicUrl(filename);

    // 3) Insert sticker row
    const { data: sticker, error: insertError } = await supabaseAdmin
      .from("stickers")
      .insert({
        user_id: userId,
        username,
        image_url: publicUrl,
        caption: caption || null,
        location_name: locationName || null,
        lat: lat ?? null,
        lng: lng ?? null,
        is_public: true,
        group_id: groupId ?? null,
      })
      .select()
      .single();

    if (insertError) throw new Error(`DB insert failed: ${insertError.message}`);

    return NextResponse.json({ sticker });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Save failed" }, { status: 500 });
  }
}
