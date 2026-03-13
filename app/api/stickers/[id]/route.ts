import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await req.json();
    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    // Fetch the target sticker to verify ownership
    const { data: sticker, error: fetchError } = await supabaseAdmin
      .from("stickers")
      .select("user_id, image_url, group_id")
      .eq("id", params.id)
      .single();

    if (fetchError || !sticker) {
      return NextResponse.json({ error: "Sticker not found" }, { status: 404 });
    }
    if (sticker.user_id !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // If part of a group, delete all stickers in the group
    const scope = sticker.group_id
      ? supabaseAdmin.from("stickers").select("id, image_url").eq("group_id", sticker.group_id)
      : supabaseAdmin.from("stickers").select("id, image_url").eq("id", params.id);

    const { data: toDelete } = await scope;

    if (toDelete?.length) {
      // Remove storage files
      const paths = toDelete
        .map((s) => {
          try {
            const url = new URL(s.image_url);
            const m = url.pathname.match(/\/Stickers\/(.+)$/);
            return m ? m[1] : null;
          } catch { return null; }
        })
        .filter(Boolean) as string[];
      if (paths.length) await supabaseAdmin.storage.from("Stickers").remove(paths);

      // Delete DB rows
      const ids = toDelete.map((s) => s.id);
      await supabaseAdmin.from("stickers").delete().in("id", ids);
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Delete failed" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { userId, caption } = await req.json();
    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    // Verify ownership
    const { data: sticker, error: fetchError } = await supabaseAdmin
      .from("stickers")
      .select("user_id, group_id")
      .eq("id", params.id)
      .single();

    if (fetchError || !sticker) {
      return NextResponse.json({ error: "Sticker not found" }, { status: 404 });
    }
    if (sticker.user_id !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Update caption for entire group or just this sticker
    const update = supabaseAdmin.from("stickers").update({ caption: caption ?? null });
    if (sticker.group_id) {
      await update.eq("group_id", sticker.group_id);
    } else {
      await update.eq("id", params.id);
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Update failed" }, { status: 500 });
  }
}
