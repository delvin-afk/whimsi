import { ImageResponse } from "next/og";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "edge";

// Mapbox uses 512px tiles (GL convention)
const TILE_SIZE = 512;

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

function lngToWorld(lng: number): number {
  return ((lng + 180) / 360) * TILE_SIZE;
}

function latToWorld(lat: number): number {
  const latRad = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * TILE_SIZE;
}

interface Viewport {
  centerLng: number;
  centerLat: number;
  zoom: number;
}

function computeMapViewport(
  located: Array<{ lat: number; lng: number }>,
  mapW: number,
  mapH: number,
  padding: number
): Viewport {
  if (located.length === 0) return { centerLng: 0, centerLat: 20, zoom: 1 };
  if (located.length === 1) return { centerLng: located[0].lng, centerLat: located[0].lat, zoom: 13 };

  const lngs = located.map((s) => s.lng);
  const lats = located.map((s) => s.lat);
  const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
  const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;

  const usableW = mapW - 2 * padding;
  const usableH = mapH - 2 * padding;

  let zoom = 0;
  for (let z = 16; z >= 0; z--) {
    const scale = Math.pow(2, z);
    const x1 = lngToWorld(Math.min(...lngs)) * scale;
    const x2 = lngToWorld(Math.max(...lngs)) * scale;
    const y1 = latToWorld(Math.max(...lats)) * scale;
    const y2 = latToWorld(Math.min(...lats)) * scale;
    if (x2 - x1 <= usableW && y2 - y1 <= usableH) {
      zoom = z;
      break;
    }
  }

  return { centerLng, centerLat, zoom };
}

function lngLatToPixel(
  lng: number,
  lat: number,
  vp: Viewport,
  mapW: number,
  mapH: number
): { x: number; y: number } {
  const scale = Math.pow(2, vp.zoom);
  const cx = lngToWorld(vp.centerLng) * scale;
  const cy = latToWorld(vp.centerLat) * scale;
  const px = lngToWorld(lng) * scale;
  const py = latToWorld(lat) * scale;
  return {
    x: mapW / 2 + (px - cx),
    y: mapH / 2 + (py - cy),
  };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

  const { data: journey } = await supabaseAdmin
    .from("journeys")
    .select("*")
    .eq("id", id)
    .single();

  if (!journey) return new Response("Not found", { status: 404 });

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

  type LocatedStop = { lat: number; lng: number; image_url: string };
  const located = stops.filter((s) => s.lat != null && s.lng != null) as LocatedStop[];

  // Card dimensions
  const CARD_W = 1080;
  const CARD_H = 1080;
  const MAP_W = CARD_W;
  const MAP_H = 600;
  const STICKER_SIZE = 68;
  const STICKER_PADDING = STICKER_SIZE + 24;

  const vp = computeMapViewport(located, MAP_W, MAP_H, STICKER_PADDING);

  // Compute pixel positions
  const stickerPositions = located.map((s) =>
    lngLatToPixel(s.lng, s.lat, vp, MAP_W, MAP_H)
  );

  // Build static map URL (base map + route line, no pin markers)
  let mapUrl: string | null = null;
  if (token) {
    let overlayParam = "";
    if (located.length >= 2) {
      const coords = located.map((s) => [s.lng, s.lat]);
      const geojson = JSON.stringify({
        type: "Feature",
        properties: { stroke: "#a855f7", "stroke-width": 4, "stroke-opacity": 0.9 },
        geometry: { type: "LineString", coordinates: coords },
      });
      overlayParam = `geojson(${encodeURIComponent(geojson)})/`;
    }
    if (located.length > 0) {
      mapUrl = `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${overlayParam}${vp.centerLng},${vp.centerLat},${vp.zoom},0/${MAP_W}x${MAP_H}?access_token=${token}`;
    } else {
      mapUrl = `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/0,20,1,0/${MAP_W}x${MAP_H}?access_token=${token}`;
    }
  }

  // Fetch all images in parallel
  const [mapDataUrl, ...stickerDataUrls] = await Promise.all([
    mapUrl ? toDataUrl(mapUrl) : Promise.resolve(null),
    ...located.map((s) => toDataUrl(s.image_url)),
  ]);

  const title = (journey.caption as string | null) ?? `${journey.username}'s Journey`;

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          background: "#1c1c1e",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        {/* Map section with sticker overlays */}
        <div
          style={{
            display: "flex",
            width: `${MAP_W}px`,
            height: `${MAP_H}px`,
            position: "relative",
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          {mapDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={mapDataUrl}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <div style={{ width: "100%", height: "100%", background: "#2c2c2e", display: "flex" }} />
          )}

          {/* Sticker images overlaid at their GPS positions */}
          {stickerDataUrls.map((src, i) => {
            if (!src) return null;
            const pos = stickerPositions[i];
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: pos.x - STICKER_SIZE / 2,
                  top: pos.y - STICKER_SIZE - 6,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt=""
                  style={{
                    width: STICKER_SIZE,
                    height: STICKER_SIZE,
                    objectFit: "contain",
                  }}
                />
                {/* Number badge */}
                <div
                  style={{
                    position: "absolute",
                    top: -8,
                    left: -8,
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    background: "#a855f7",
                    color: "white",
                    fontSize: 13,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "2px solid white",
                  }}
                >
                  {i + 1}
                </div>
                {/* Dot pin */}
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: "#a855f7",
                    border: "2.5px solid white",
                    marginTop: 2,
                    flexShrink: 0,
                  }}
                />
              </div>
            );
          })}

          {/* Bottom fade into card background */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: 110,
              background: "linear-gradient(to bottom, transparent, #1c1c1e)",
              display: "flex",
            }}
          />
        </div>

        {/* Info section */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            padding: "28px 44px 40px",
          }}
        >
          {/* Journey title */}
          <div
            style={{
              color: "white",
              fontSize: 46,
              fontWeight: 800,
              lineHeight: 1.15,
              marginBottom: "24px",
              maxWidth: "900px",
            }}
          >
            {title}
          </div>

          {/* Stats row */}
          <div style={{ display: "flex", gap: "48px", marginBottom: "20px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
              <span style={{ color: "#6b7280", fontSize: 16 }}>Stops</span>
              <span style={{ color: "white", fontSize: 34, fontWeight: 800 }}>{stops.length}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
              <span style={{ color: "#6b7280", fontSize: 16 }}>Date</span>
              <span style={{ color: "white", fontSize: 26, fontWeight: 700 }}>{dateRange}</span>
            </div>
            {uniqueLocations.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                <span style={{ color: "#6b7280", fontSize: 16 }}>Route</span>
                <span style={{ color: "white", fontSize: 22, fontWeight: 600, maxWidth: "520px" }}>
                  {uniqueLocations.join(" → ")}
                </span>
              </div>
            )}
          </div>

          {/* Username + branding */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: "auto",
            }}
          >
            <span style={{ color: "#9ca3af", fontSize: 20 }}>{journey.username}</span>
            <span style={{ color: "#a855f7", fontSize: 34, fontWeight: 900, letterSpacing: "-0.5px" }}>
              whimsi
            </span>
          </div>
        </div>
      </div>
    ),
    { width: CARD_W, height: CARD_H }
  );
}
