import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import PostcardViewPage from "./PostcardViewPage";

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
