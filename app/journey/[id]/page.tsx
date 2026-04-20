import { Metadata } from "next";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import JourneySharePage from "./JourneySharePage";

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id } = await params;
  const { data: journey } = await supabaseAdmin
    .from("journeys")
    .select("caption, username")
    .eq("id", id)
    .eq("is_public", true)
    .single();

  if (!journey) return { title: "whimsi" };

  const title = journey.caption
    ? `${journey.caption} — by ${journey.username}`
    : `${journey.username}'s journey`;
  const description = `A whimsi journey by ${journey.username}`;

  const { data: stickers } = await supabaseAdmin
    .from("stickers")
    .select("image_url")
    .eq("journey_id", id)
    .order("order_index", { ascending: true })
    .limit(1);

  const coverImage = stickers?.[0]?.image_url;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: coverImage ? [{ url: coverImage, width: 500, height: 500 }] : [],
      siteName: "whimsi",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: coverImage ? [coverImage] : [],
    },
  };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data: journey } = await supabaseAdmin
    .from("journeys")
    .select("*")
    .eq("id", id)
    .eq("is_public", true)
    .single();

  if (!journey) notFound();

  const { data: stickers } = await supabaseAdmin
    .from("stickers")
    .select("*")
    .eq("journey_id", id)
    .order("order_index", { ascending: true });

  return <JourneySharePage journey={{ ...journey, stickers: stickers ?? [] }} />;
}
