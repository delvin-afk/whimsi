import { ImageResponse } from "next/og";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "edge";

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

function lngToWorld(lng: number) { return ((lng + 180) / 360) * 512; }
function latToWorld(lat: number) {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 512;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const journeyId = searchParams.get("journey");
  const to   = searchParams.get("to")  ?? "";
  const loc  = searchParams.get("loc") ?? "";
  const cap  = searchParams.get("cap") ?? "";
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

  if (!journeyId) return new Response("Missing journey", { status: 400 });

  const { data: journey } = await supabaseAdmin.from("journeys").select("*").eq("id", journeyId).single();
  if (!journey) return new Response("Not found", { status: 404 });

  const { data: stickers } = await supabaseAdmin.from("stickers").select("*").eq("journey_id", journeyId).order("order_index", { ascending: true });
  const stops = stickers ?? [];

  // OG card is 1200×630; left 50% = map, right 50% = postcard
  const CARD_W = 1200;
  const CARD_H = 630;
  const MAP_W  = 600;
  const MAP_H  = CARD_H;

  type Located = { lat: number; lng: number };
  const located = stops.filter((s) => s.lat != null && s.lng != null) as Located[];

  // Build Mapbox static map URL
  let mapUrl: string | null = null;
  if (token && located.length > 0) {
    const lngs = located.map((s) => s.lng);
    const lats = located.map((s) => s.lat);
    const cLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
    const cLat = (Math.min(...lats) + Math.max(...lats)) / 2;

    let zoom = 1;
    for (let z = 14; z >= 1; z--) {
      const sc = Math.pow(2, z);
      const dx = (lngToWorld(Math.max(...lngs)) - lngToWorld(Math.min(...lngs))) * sc;
      const dy = (latToWorld(Math.min(...lats)) - latToWorld(Math.max(...lats))) * sc;
      if (dx <= MAP_W - 80 && dy <= MAP_H - 80) { zoom = z; break; }
    }

    let overlay = "";
    if (located.length >= 2) {
      const geojson = JSON.stringify({
        type: "Feature", properties: { stroke: "#a855f7", "stroke-width": 4, "stroke-opacity": 0.9 },
        geometry: { type: "LineString", coordinates: located.map((s) => [s.lng, s.lat]) },
      });
      overlay = `geojson(${encodeURIComponent(geojson)})/`;
    }
    mapUrl = `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${overlay}${cLng},${cLat},${zoom},0/${MAP_W}x${MAP_H}?access_token=${token}`;
  }

  const mapDataUrl = mapUrl ? await toDataUrl(mapUrl) : null;

  const now = new Date();
  const dateStr = `${String(now.getMonth() + 1).padStart(2, "0")} ${String(now.getDate()).padStart(2, "0")} ${String(now.getFullYear()).slice(-2)}`;

  return new ImageResponse(
    (
      <div style={{ display: "flex", width: CARD_W, height: CARD_H, fontFamily: "system-ui, sans-serif" }}>

        {/* Left: map */}
        <div style={{ display: "flex", width: MAP_W, height: CARD_H, flexShrink: 0, position: "relative" }}>
          {mapDataUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={mapDataUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />
            : <div style={{ width: "100%", height: "100%", background: "#d4c8b0", display: "flex" }} />
          }
        </div>

        {/* Divider */}
        <div style={{ width: 2, background: "#a09080", flexShrink: 0, display: "flex" }} />

        {/* Right: postcard cream panel */}
        <div style={{ display: "flex", flexDirection: "column", flex: 1, background: "#f5f0e8", padding: "36px 36px 36px 36px", position: "relative" }}>

          {/* Decorative lines at top */}
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ height: 2, background: "#c8b89a", borderRadius: 2, opacity: 0.55, display: "flex", marginBottom: i < 2 ? 14 : 0 }} />
          ))}

          {/* whimsi badge */}
          <div style={{ position: "absolute", top: 28, right: 28, background: "#4ade80", borderRadius: "50%", width: 76, height: 76, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "black", fontWeight: 900, fontSize: 14 }}>whimsi</span>
          </div>

          {/* Stamp */}
          <div style={{
            width: 150, height: 150, borderRadius: "50%",
            border: "3px solid #a09080", display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            marginTop: 36, marginLeft: "auto", marginRight: "auto",
          }}>
            <span style={{ color: "#9c8878", fontSize: 13, fontFamily: "monospace" }}>· · · ·</span>
            <span style={{ color: "#9c8878", fontSize: 22, fontFamily: "monospace", marginTop: 4 }}>{dateStr}</span>
            <span style={{ color: "#9c8878", fontSize: 13, fontFamily: "monospace", marginTop: 4 }}>· · · ·</span>
          </div>

          {/* Ruled lines with text */}
          <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: "auto" }}>
            <div style={{ borderBottom: "2px solid #c4b49a", paddingBottom: 6, display: "flex" }}>
              <span style={{ color: "#1a0f0a", fontSize: 34, fontStyle: "italic" }}>{to}</span>
            </div>
            <div style={{ borderBottom: "2px solid #c4b49a", paddingBottom: 6, display: "flex" }}>
              <span style={{ color: "#5a4030", fontSize: 26, fontStyle: "italic" }}>{loc}</span>
            </div>
            <div style={{ borderBottom: "2px solid #c4b49a", paddingBottom: 6, display: "flex" }}>
              <span style={{ color: "#7a6050", fontSize: 20, fontStyle: "italic" }}>{cap}</span>
            </div>
          </div>
        </div>
      </div>
    ),
    { width: CARD_W, height: CARD_H }
  );
}
