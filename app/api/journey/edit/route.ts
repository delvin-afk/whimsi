import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

interface StickerEdit {
  id: string;
  caption: string | null;
  voiceBase64: string | null;
  voiceMimeType: string | null;
  clearVoice: boolean;
}

export async function POST(req: Request) {
  try {
    const { userId, journeyId, caption, stickers } = await req.json() as {
      userId: string;
      journeyId: string;
      caption: string | null;
      stickers: StickerEdit[];
    };

    if (!userId || !journeyId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Verify ownership
    const { data: journey } = await supabaseAdmin
      .from("journeys")
      .select("user_id")
      .eq("id", journeyId)
      .single();

    if (!journey || journey.user_id !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Update journey caption
    await supabaseAdmin
      .from("journeys")
      .update({ caption: caption ?? null })
      .eq("id", journeyId);

    // Update each sticker
    for (const s of stickers) {
      let voiceUrl: string | null | undefined = undefined; // undefined = don't change

      if (s.clearVoice) {
        voiceUrl = null;
      } else if (s.voiceBase64) {
        const mimeType = s.voiceMimeType || "audio/webm";
        const ext = mimeType.includes("mp4") ? "m4a" : mimeType.includes("ogg") ? "ogg" : "webm";
        const voiceFilename = `audio/${userId}/${Date.now()}-${s.id}.${ext}`;
        const voiceBuffer = Buffer.from(s.voiceBase64, "base64");

        const { error: uploadError } = await supabaseAdmin.storage
          .from("Stickers")
          .upload(voiceFilename, voiceBuffer, { contentType: mimeType, upsert: false });

        if (!uploadError) {
          const { data: { publicUrl } } = supabaseAdmin.storage
            .from("Stickers")
            .getPublicUrl(voiceFilename);
          voiceUrl = publicUrl;
        }
      }

      const update: Record<string, unknown> = { caption: s.caption };
      if (voiceUrl !== undefined) update.voice_url = voiceUrl;

      await supabaseAdmin.from("stickers").update(update).eq("id", s.id);
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Edit failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
