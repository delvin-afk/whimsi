import { ImageResponse } from "next/og";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "edge";

// Fetch a remote image and return it as a base64 data URL
async function toDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const mime = res.headers.get("content-type") ?? "image/png";
    const b64 = Buffer.from(buf).toString("base64");
    return `data:${mime};base64,${b64}`;
  } catch {
    return null;
  }
}

function buildMapUrl(stickers: Array<{ lat: number | null; lng: number | null }>, token: string) {
  const located = stickers.filter((s) => s.lat != null && s.lng != null);
  if (located.length === 0) {
    // Generic world map — dark style, no overlay
    return `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/0,20,1/900x420@2x?access_token=${token}`;
  }

  // Pin markers: pin-s-{number}+{color}({lng},{lat})
  const pinColor = "a855f7";
  const markers = located
    .slice(0, 9) // Mapbox has URL length limits
    .map((s, i) => `pin-s-${i + 1}+${pinColor}(${s.lng},${s.lat})`)
    .join(",");

  // Connecting path via GeoJSON overlay (straight lines between stops)
  const coords = located.map((s) => [s.lng, s.lat]);
  const geojson = JSON.stringify({
    type: "Feature",
    properties: { stroke: "#a855f7", "stroke-width": 3, "stroke-opacity": 0.9 },
    geometry: { type: "LineString", coordinates: coords },
  });
  const path = `geojson(${encodeURIComponent(geojson)})`;

  return `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/${path},${markers}/auto/900x420@2x?access_token=${token}&padding=60,60,60,60`;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

  // Fetch journey
  const { data: journey } = await supabaseAdmin
    .from("journeys")
    .select("*")
    .eq("id", id)
    .single();

  if (!journey) {
    return new Response("Not found", { status: 404 });
  }

  // Fetch stickers
  const { data: stickers } = await supabaseAdmin
    .from("stickers")
    .select("*")
    .eq("journey_id", id)
    .order("order_index", { ascending: true });

  const stops = stickers ?? [];

  // Date range
  const withTime = stops.filter((s) => s.photo_taken_at);
  let dateRange = new Date(journey.created_at).toLocaleDateString("en-US", { dateStyle: "medium" });
  if (withTime.length >= 2) {
    const sorted = [...withTime].sort(
      (a, b) => new Date(a.photo_taken_at).getTime() - new Date(b.photo_taken_at).getTime()
    );
    const first = new Date(sorted[0].photo_taken_at);
    const last = new Date(sorted[sorted.length - 1].photo_taken_at);
    const sameDay = first.toDateString() === last.toDateString();
    dateRange = sameDay
      ? first.toLocaleDateString("en-US", { dateStyle: "medium" })
      : `${first.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${last.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
  }

  const uniqueLocations = [
    ...new Set(stops.map((s) => s.location_name).filter(Boolean)),
  ].slice(0, 3) as string[];

  // Fetch map + sticker images in parallel
  const mapUrl = token ? buildMapUrl(stops, token) : null;
  const [mapDataUrl, ...stickerDataUrls] = await Promise.all([
    mapUrl ? toDataUrl(mapUrl) : Promise.resolve(null),
    ...stops.slice(0, 5).map((s) => toDataUrl(s.image_url)),
  ]);

  const avatarLetter = (journey.username as string)[0]?.toUpperCase() ?? "?";
  const title = (journey.caption as string | null) ?? `${journey.username}'s Journey`;

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          background: "#0f0f1a",
          fontFamily: "system-ui, -apple-system, sans-serif",
          position: "relative",
        }}
      >
        {/* Map area */}
        <div style={{ display: "flex", width: "100%", height: "420px", position: "relative" }}>
          {mapDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={mapDataUrl}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <div style={{ width: "100%", height: "100%", background: "#1a1a2e", display: "flex" }} />
          )}
          {/* Bottom fade from map into dark bg */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: "120px",
              background: "linear-gradient(to bottom, transparent, #0f0f1a)",
              display: "flex",
            }}
          />
        </div>

        {/* Content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            padding: "28px 40px 40px",
            gap: "0px",
          }}
        >
          {/* Username row */}
          <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "16px" }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                background: "#a855f7",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontWeight: 700,
                fontSize: 22,
              }}
            >
              {avatarLetter}
            </div>
            <span style={{ color: "#9ca3af", fontSize: 20 }}>{journey.username}</span>
          </div>

          {/* Journey title */}
          <div
            style={{
              color: "white",
              fontSize: 44,
              fontWeight: 800,
              lineHeight: 1.15,
              marginBottom: "28px",
              maxWidth: "860px",
            }}
          >
            {title}
          </div>

          {/* Stats row */}
          <div style={{ display: "flex", gap: "48px", marginBottom: "28px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={{ color: "#6b7280", fontSize: 16 }}>Stops</span>
              <span style={{ color: "white", fontSize: 36, fontWeight: 800 }}>{stops.length}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={{ color: "#6b7280", fontSize: 16 }}>Date</span>
              <span style={{ color: "white", fontSize: 28, fontWeight: 700 }}>{dateRange}</span>
            </div>
            {uniqueLocations.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <span style={{ color: "#6b7280", fontSize: 16 }}>Route</span>
                <span style={{ color: "white", fontSize: 22, fontWeight: 600, maxWidth: "500px" }}>
                  {uniqueLocations.join(" → ")}
                </span>
              </div>
            )}
          </div>

          {/* Sticker thumbnails */}
          {stickerDataUrls.filter(Boolean).length > 0 && (
            <div style={{ display: "flex", gap: "16px", marginBottom: "28px" }}>
              {stickerDataUrls.filter(Boolean).map((src, i) => (
                <div
                  key={i}
                  style={{
                    width: 100,
                    height: 100,
                    borderRadius: 16,
                    background: "rgba(255,255,255,0.06)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src!} alt="" style={{ width: "88px", height: "88px", objectFit: "contain" }} />
                  {/* Stop number badge */}
                  <div
                    style={{
                      position: "absolute",
                      top: 4,
                      left: 4,
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      background: "#a855f7",
                      color: "white",
                      fontSize: 12,
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {i + 1}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Branding */}
          <div style={{ display: "flex", marginTop: "auto", justifyContent: "flex-end" }}>
            <span
              style={{
                color: "#a855f7",
                fontSize: 32,
                fontWeight: 900,
                letterSpacing: "-0.5px",
              }}
            >
              whimsi
            </span>
          </div>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1080,
    }
  );
}
