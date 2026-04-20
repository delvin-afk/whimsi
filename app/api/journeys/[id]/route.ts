import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { data: journey, error } = await supabaseAdmin
    .from("journeys")
    .select("*")
    .eq("id", id)
    .eq("is_public", true)
    .single();
  if (error || !journey) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: stickers } = await supabaseAdmin
    .from("stickers")
    .select("*")
    .eq("journey_id", id)
    .order("order_index", { ascending: true });

  return NextResponse.json({ journey: { ...journey, stickers: stickers ?? [] } });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { userId, is_public } = await req.json();

    if (!userId || typeof is_public !== "boolean") {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Verify ownership
    const { data: journey } = await supabaseAdmin
      .from("journeys")
      .select("user_id")
      .eq("id", id)
      .single();

    if (!journey || journey.user_id !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Update journey visibility
    const { error } = await supabaseAdmin
      .from("journeys")
      .update({ is_public })
      .eq("id", id);

    if (error) throw new Error(error.message);

    // When making public, also make all journey stickers public
    if (is_public) {
      await supabaseAdmin
        .from("stickers")
        .update({ is_public: true })
        .eq("journey_id", id);
    }

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Update failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
