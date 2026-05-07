import { notFound } from "next/navigation";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { supabaseAdmin } from "@/lib/supabase/admin";
import PostcardViewPage from "./PostcardViewPage";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ journey?: string; to?: string; loc?: string; cap?: string }>;
}): Promise<Metadata> {
  const { journey: journeyId, to = "", loc = "", cap = "" } = await searchParams;
  if (!journeyId) return { title: "whimsi" };

  const { data: journey } = await supabaseAdmin
    .from("journeys")
    .select("caption, username")
    .eq("id", journeyId)
    .single();

  const title = to
    ? `A postcard for ${to}`
    : (journey?.caption ?? `${journey?.username ?? "Someone"}'s Journey`);
  const description = loc
    ? `From ${loc} · on whimsi`
    : `A journey by ${journey?.username ?? "someone"} on whimsi`;

  const host = (await headers()).get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  const imageUrl = `${protocol}://${host}/api/share/postcard?journey=${journeyId}&to=${encodeURIComponent(to)}&loc=${encodeURIComponent(loc)}&cap=${encodeURIComponent(cap)}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: imageUrl, width: 1200, height: 630 }],
      siteName: "whimsi",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ journey?: string; to?: string; loc?: string; cap?: string }>;
}) {
  const { journey: journeyId, to = "", loc = "", cap = "" } = await searchParams;

  if (!journeyId) notFound();

  const { data: journey } = await supabaseAdmin
    .from("journeys")
    .select("*")
    .eq("id", journeyId)
    .single();

  if (!journey) notFound();

  const { data: stickers } = await supabaseAdmin
    .from("stickers")
    .select("*")
    .eq("journey_id", journeyId)
    .order("order_index", { ascending: true });

  return (
    <PostcardViewPage
      journey={{ ...journey, stickers: stickers ?? [] }}
      recipientName={to}
      location={loc}
      caption={cap}
    />
  );
}
