import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("user_id");

    // Fetch journeys: public ones + owner's private ones
    let journeyQuery = supabaseAdmin
      .from("journeys")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (userId) {
      // Return public journeys OR journeys owned by this user
      journeyQuery = journeyQuery.or(`is_public.eq.true,user_id.eq.${userId}`);
    } else {
      journeyQuery = journeyQuery.eq("is_public", true);
    }

    const { data: journeys, error: journeyError } = await journeyQuery;
    if (journeyError) throw new Error(journeyError.message);
    if (!journeys || journeys.length === 0) {
      return NextResponse.json({ journeys: [] });
    }

    // Fetch all stickers for these journeys in one query
    const journeyIds = journeys.map((j) => j.id);
    const { data: stickers, error: stickerError } = await supabaseAdmin
      .from("stickers")
      .select("*")
      .in("journey_id", journeyIds)
      .order("order_index", { ascending: true });

    if (stickerError) throw new Error(stickerError.message);

    // Group stickers by journey_id
    const stickersByJourney = (stickers ?? []).reduce<Record<string, typeof stickers>>((acc, s) => {
      if (!s.journey_id) return acc;
      if (!acc[s.journey_id]) acc[s.journey_id] = [];
      acc[s.journey_id]!.push(s);
      return acc;
    }, {});

    // Sort each journey's stickers by photo_taken_at, fallback to order_index
    const result = journeys.map((j) => {
      const jStickers = (stickersByJourney[j.id] ?? []).sort((a, b) => {
        if (a.photo_taken_at && b.photo_taken_at) {
          return new Date(a.photo_taken_at).getTime() - new Date(b.photo_taken_at).getTime();
        }
        return (a.order_index ?? 0) - (b.order_index ?? 0);
      });
      return { ...j, stickers: jStickers };
    });

    return NextResponse.json({ journeys: result });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Fetch failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
