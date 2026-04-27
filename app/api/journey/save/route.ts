import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

interface StickerInput {
  stickerBase64: string;
  caption: string | null;
  locationName: string | null;
  lat: number | null;
  lng: number | null;
  photoTakenAt: string | null;
  orderIndex: number;
  voiceBase64: string | null;
  voiceMimeType: string | null;
}

export async function POST(req: Request) {
  try {
    const { userId, username, caption, stickers } = await req.json() as {
      userId: string;
      username: string;
      caption: string | null;
      stickers: StickerInput[];
    };

    if (!userId || !username || !Array.isArray(stickers) || stickers.length < 1) {
      return NextResponse.json({ error: "Missing required fields or no stickers provided" }, { status: 400 });
    }

    // 1) Upsert profile
    await supabaseAdmin.from("profiles").upsert({ id: userId, username }, { onConflict: "id" });

    // 2) Create journey row (private by default)
    const { data: journey, error: journeyError } = await supabaseAdmin
      .from("journeys")
      .insert({ user_id: userId, username, caption: caption ?? null, is_public: false })
      .select()
      .single();

    if (journeyError || !journey) {
      throw new Error(`Journey insert failed: ${journeyError?.message}`);
    }

    // 3) Upload each sticker image and insert sticker rows
    const insertedStickers = [];
    for (const s of stickers) {
      const buffer = Buffer.from(
        s.stickerBase64.replace(/^data:image\/png;base64,/, ""),
        "base64"
      );
      const filename = `${userId}/${Date.now()}-${s.orderIndex}.png`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from("Stickers")
        .upload(filename, buffer, { contentType: "image/png", upsert: false });

      if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);

      const { data: { publicUrl } } = supabaseAdmin.storage
        .from("Stickers")
        .getPublicUrl(filename);

      let voiceUrl: string | null = null;
      if (s.voiceBase64 && s.voiceMimeType) {
        const voiceBuffer = Buffer.from(s.voiceBase64, "base64");
        const ext = s.voiceMimeType.includes("mp4") ? "m4a" : "webm";
        const voiceFilename = `audio/${userId}/${Date.now()}-${s.orderIndex}.${ext}`;
        const { error: voiceUploadError } = await supabaseAdmin.storage
          .from("Stickers")
          .upload(voiceFilename, voiceBuffer, { contentType: s.voiceMimeType, upsert: false });
        if (!voiceUploadError) {
          const { data: { publicUrl: voicePublicUrl } } = supabaseAdmin.storage
            .from("Stickers")
            .getPublicUrl(voiceFilename);
          voiceUrl = voicePublicUrl;
        }
      }

      const { data: sticker, error: insertError } = await supabaseAdmin
        .from("stickers")
        .insert({
          user_id: userId,
          username,
          image_url: publicUrl,
          caption: s.caption ?? null,
          voice_url: voiceUrl,
          location_name: s.locationName ?? null,
          lat: s.lat ?? null,
          lng: s.lng ?? null,
          is_public: false,
          journey_id: journey.id,
          photo_taken_at: s.photoTakenAt ?? null,
          order_index: s.orderIndex,
        })
        .select()
        .single();

      if (insertError) throw new Error(`Sticker insert failed: ${insertError.message}`);
      insertedStickers.push(sticker);
    }

    return NextResponse.json({ journey: { ...journey, stickers: insertedStickers } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Save failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
