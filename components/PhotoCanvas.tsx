"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Detection } from "@/types";
import Marker from "@/components/Marker";

type Props = {
  src: string;
  detections: Detection[];
  onMarkerClick: (d: Detection) => void;
};

export default function PhotoCanvas({ src, detections, onMarkerClick }: Props) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const [dims, setDims] = useState({ w: 0, h: 0 });
  const [loading, setLoading] = useState(true);

  // Recompute dims whenever rendered size changes
  useEffect(() => {
    const wrap = wrapRef.current;
    const img = imgRef.current;
    if (!wrap || !img) return;

    const update = () => {
      // display size (what user sees)
      setDims({ w: img.clientWidth, h: img.clientHeight });
    };

    const ro = new ResizeObserver(() => update());
    ro.observe(wrap);

    update();
    return () => ro.disconnect();
  }, [src]);

  const boxedDetections = useMemo(
    () =>
      detections.filter(
        (d) => Array.isArray(d.box_2d) && d.box_2d.length === 4,
      ),
    [detections],
  );

  const canPlaceMarkers = useMemo(
    () => dims.w > 0 && dims.h > 0 && !loading,
    [dims.w, dims.h, loading],
  );

  return (
    // ✅ attach wrapRef
    <div
      ref={wrapRef}
      className="relative w-full overflow-hidden rounded-2xl border bg-white"
    >
      {/* Skeleton overlay */}
      {loading && (
        <div className="absolute inset-0 grid place-items-center bg-gray-100">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-700" />
        </div>
      )}

      {/* ✅ IMPORTANT: remove h-full so height is based on image */}
      <img
        ref={imgRef}
        src={src}
        alt="Photo"
        className="block w-full h-auto"
        onLoad={() => {
          setLoading(false);
          const img = imgRef.current;
          if (!img) return;
          setDims({ w: img.clientWidth, h: img.clientHeight });
        }}
      />

      {/* ✅ only render markers when we can place them */}
      {canPlaceMarkers &&
        boxedDetections.map((d, idx) => (
          <Marker
            key={`${d.id ?? d.label}-${idx}`}
            label={d.label}
            box={d.box_2d as any}
            imageW={dims.w}
            imageH={dims.h}
            onClick={() => onMarkerClick(d)}
          />
        ))}
    </div>
  );
}
