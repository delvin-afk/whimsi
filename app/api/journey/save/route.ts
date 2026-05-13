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

    // 2) Upload ALL images and voice files to storage in parallel — before touching the DB.
    //    If any upload fails the journey row is never created, so no orphaned journeys.
    const uploaded = await Promise.all(stickers.map(async (s) => {
      const mimeMatch = s.stickerBase64.match(/^data:([^;]+);base64,/);
      const mimeType = mimeMatch?.[1] ?? "image/png";
      const ext = mimeType === "image/jpeg" ? "jpg" : mimeType.split("/")[1] ?? "png";
      const base64Data = s.stickerBase64.replace(/^data:[^;]+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      const filename = `${userId}/${Date.now()}-${s.orderIndex}.${ext}`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from("Stickers")
        .upload(filename, buffer, { contentType: mimeType, upsert: false });

      if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);

      const { data: { publicUrl } } = supabaseAdmin.storage.from("Stickers").getPublicUrl(filename);

      let voiceUrl: string | null = null;
      if (s.voiceBase64) {
        const vMime = s.voiceMimeType || "audio/webm";
        const vBuffer = Buffer.from(s.voiceBase64, "base64");
        const vExt = vMime.includes("mp4") ? "m4a" : vMime.includes("ogg") ? "ogg" : "webm";
        const vFilename = `audio/${userId}/${Date.now()}-${s.orderIndex}.${vExt}`;
        const { error: voiceUploadError } = await supabaseAdmin.storage
          .from("Stickers")
          .upload(vFilename, vBuffer, { contentType: vMime, upsert: false });
        if (!voiceUploadError) {
          const { data: { publicUrl: vUrl } } = supabaseAdmin.storage.from("Stickers").getPublicUrl(vFilename);
          voiceUrl = vUrl;
        } else {
          console.error(`Voice upload failed for sticker ${s.orderIndex}:`, voiceUploadError.message);
        }
      }

      return { ...s, publicUrl, voiceUrl };
    }));

    // 3) All uploads succeeded — now create the journey row
    const { data: journey, error: journeyError } = await supabaseAdmin
      .from("journeys")
      .insert({ user_id: userId, username, caption: caption ?? null, is_public: false })
      .select()
      .single();

    if (journeyError || !journey) {
      throw new Error(`Journey insert failed: ${journeyError?.message}`);
    }

    // 4) Insert all sticker rows in parallel
    const insertedStickers = await Promise.all(uploaded.map(async (s) => {
      const { data: sticker, error: insertError } = await supabaseAdmin
        .from("stickers")
        .insert({
          user_id: userId,
          username,
          image_url: s.publicUrl,
          caption: s.caption ?? null,
          voice_url: s.voiceUrl,
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
      return sticker;
    }));

    return NextResponse.json({ journey: { ...journey, stickers: insertedStickers } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Save failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
