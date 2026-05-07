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
  const to  = searchParams.get("to")  ?? "";
  const loc = searchParams.get("loc") ?? "";
  const cap = searchParams.get("cap") ?? "";
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

  if (!journeyId) return new Response("Missing journey", { status: 400 });

  const { data: journey } = await supabaseAdmin.from("journeys").select("*").eq("id", journeyId).single();
  if (!journey) return new Response("Not found", { status: 404 });

  const { data: stickers } = await supabaseAdmin.from("stickers").select("*").eq("journey_id", journeyId).order("order_index", { ascending: true });
  const stops = stickers ?? [];

  const CARD_W = 1200;
  const CARD_H = 630;
  const MAP_W  = 600;
  const MAP_H  = CARD_H;

  type Located = { lat: number; lng: number };
  const located = stops.filter((s) => s.lat != null && s.lng != null) as Located[];

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

  // Scale factor: app postcard right panel ≈ 200px wide, OG right panel = 598px wide → ~3x scale
  const S = 3;

  return new ImageResponse(
    (
      <div style={{ display: "flex", width: CARD_W, height: CARD_H, background: "#f5f0e8", fontFamily: "system-ui, sans-serif" }}>

        {/* Left: map */}
        <div style={{ display: "flex", width: MAP_W, height: CARD_H, flexShrink: 0, padding: `${6 * S}px ${6 * S}px ${6 * S}px ${6 * S}px` }}>
          <div style={{ display: "flex", width: "100%", height: "100%", overflow: "hidden" }}>
            {mapDataUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={mapDataUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />
              : <div style={{ width: "100%", height: "100%", background: "#d4c8b0", display: "flex" }} />
            }
          </div>
        </div>

        {/* Vertical divider */}
        <div style={{ width: 2, background: "#a09080", flexShrink: 0, display: "flex" }} />

        {/* Right: cream postcard panel */}
        <div style={{ display: "flex", flexDirection: "column", flex: 1, background: "#f5f0e8", position: "relative" }}>

          {/* Wavy lines — top left (SVG matching the app) */}
          <div style={{ position: "absolute", top: 30, left: 30, right: 180, display: "flex" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`data:image/svg+xml;base64,${Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 150 54" preserveAspectRatio="none"><path d="M0,10 C25,3 50,18 75,10 C100,3 125,18 150,10" fill="none" stroke="#777" stroke-width="1.4" opacity="0.5"/><path d="M0,25 C25,18 50,33 75,25 C100,18 125,33 150,25" fill="none" stroke="#777" stroke-width="1.4" opacity="0.5"/><path d="M0,40 C25,33 50,48 75,40 C100,33 125,48 150,40" fill="none" stroke="#777" stroke-width="1.4" opacity="0.5"/><text x="6" y="7" font-size="10" fill="#888" opacity="0.7">&#x2736;</text><text x="76" y="28" font-size="9" fill="#888" opacity="0.6">&#x2736;</text><text x="130" y="48" font-size="8" fill="#888" opacity="0.5">&#x2736;</text></svg>`).toString("base64")}`}
              alt=""
              style={{ width: "100%", height: 162 }}
            />
          </div>

          {/* whimsi burst badge — top right (SVG matching the app exactly) */}
          <div style={{ position: "absolute", top: 15, right: 15, display: "flex" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`data:image/svg+xml;base64,${Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50"><path d="M25,1 L28,10 L37,6 L34,15 L43,15 L37,22 L45,27 L37,32 L43,39 L34,39 L37,48 L28,44 L25,53 L22,44 L13,48 L16,39 L7,39 L13,32 L5,27 L13,22 L7,15 L16,15 L13,6 L22,10 Z" fill="#4ade80"/><text x="25" y="29" text-anchor="middle" font-size="7" font-weight="700" fill="black" font-family="sans-serif">whimsi</text></svg>`).toString("base64")}`}
              alt=""
              style={{ width: 186, height: 186 }}
            />
          </div>

          {/* Postmark stamp — matching the app SVG exactly */}
          <div style={{ position: "absolute", top: 210, left: "50%", marginLeft: -120, display: "flex" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`data:image/svg+xml;base64,${Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><circle cx="40" cy="40" r="37" fill="none" stroke="#a09080" stroke-width="1.5"/><circle cx="40" cy="40" r="31" fill="none" stroke="#a09080" stroke-width="0.8" stroke-dasharray="4 2.5"/><text x="40" y="33" text-anchor="middle" font-size="7" fill="#9c8878" font-family="monospace" letter-spacing="2">&#xB7;  &#xB7;  &#xB7;  &#xB7;</text><text x="40" y="44" text-anchor="middle" font-size="11" fill="#9c8878" font-family="monospace">${dateStr}</text><text x="40" y="55" text-anchor="middle" font-size="7" fill="#9c8878" font-family="monospace" letter-spacing="2">&#xB7;  &#xB7;  &#xB7;  &#xB7;</text></svg>`).toString("base64")}`}
              alt=""
              style={{ width: 240, height: 240 }}
            />
          </div>

          {/* Bottom ruled lines with text */}
          <div style={{ position: "absolute", bottom: 54, left: 48, right: 48, display: "flex", flexDirection: "column", gap: 24 }}>
            <div style={{ borderBottom: "2px solid #c4b49a", paddingBottom: 8, display: "flex" }}>
              <span style={{ color: "#1a0f0a", fontSize: 40, fontStyle: "italic" }}>{to}</span>
            </div>
            <div style={{ borderBottom: "2px solid #c4b49a", paddingBottom: 8, display: "flex" }}>
              <span style={{ color: "#5a4030", fontSize: 30, fontStyle: "italic" }}>{loc}</span>
            </div>
            <div style={{ borderBottom: "2px solid #c4b49a", paddingBottom: 8, display: "flex" }}>
              <span style={{ color: "#7a6050", fontSize: 24, fontStyle: "italic" }}>{cap}</span>
            </div>
          </div>
        </div>
      </div>
    ),
    { width: CARD_W, height: CARD_H }
  );
}
