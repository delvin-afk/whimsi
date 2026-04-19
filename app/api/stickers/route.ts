import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("user_id"); // for scrapbook (own stickers)

    const excludeJourney = searchParams.get("exclude_journey") === "true";

    let query = supabaseAdmin
      .from("stickers")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (userId) {
      query = query.eq("user_id", userId);
    } else {
      query = query.eq("is_public", true);
    }

    // Exclude stickers that belong to a journey (they're rendered via journey lines)
    if (excludeJourney) {
      query = query.is("journey_id", null);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return NextResponse.json({ stickers: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Fetch failed" }, { status: 500 });
  }
}
