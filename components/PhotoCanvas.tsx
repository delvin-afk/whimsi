"use client";

import { useEffect, useRef, useState } from "react";
import type { Detection } from "@/types";
import Marker from "@/components/Marker";

type Props = {
  src: string;
  detections: Detection[];
  onMarkerClick: (d: Detection) => void;
};

export default function PhotoCanvas({ src, detections, onMarkerClick }: Props) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;

    const update = () => setDims({ w: img.clientWidth, h: img.clientHeight });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [src]);

  return (
    <div className="relative inline-block max-w-full">
      <img
        ref={imgRef}
        src={src}
        alt="preview"
        className="max-w-full rounded-2xl border"
        onLoad={() => {
          const img = imgRef.current;
          if (!img) return;
          setDims({ w: img.clientWidth, h: img.clientHeight });
        }}
      />

      {detections.map((d, idx) => (
        <Marker
          key={`${d.label}-${idx}`}
          label={d.label}
          box={d.box_2d}
          imageW={dims.w}
          imageH={dims.h}
          onClick={() => onMarkerClick(d)}
        />
      ))}
    </div>
  );
}
