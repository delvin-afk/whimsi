import { Metadata } from "next";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import StickerSharePage from "./StickerSharePage";

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id } = await params;
  const { data } = await supabaseAdmin
    .from("stickers")
    .select("image_url, caption, username, location_name")
    .eq("id", id)
    .eq("is_public", true)
    .single();

  if (!data) return { title: "whimsi" };

  const title = data.caption
    ? `${data.caption} — by ${data.username}`
    : `${data.username}'s sticker`;
  const description = [
    data.caption,
    data.location_name ? `📍 ${data.location_name}` : null,
  ].filter(Boolean).join(" · ") || "Check out this sticker on whimsi!";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: data.image_url, width: 500, height: 500 }],
      siteName: "whimsi",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [data.image_url],
    },
  };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data } = await supabaseAdmin
    .from("stickers")
    .select("*")
    .eq("id", id)
    .eq("is_public", true)
    .single();

  if (!data) notFound();
  return <StickerSharePage sticker={data} />;
}
