"use client";

import type { Box2D } from "@/types";

type Props = {
  label: string;
  box: Box2D; // [ymin, xmin, ymax, xmax] 0..1000
  imageW: number;
  imageH: number;
  onClick: () => void;
};

export default function Marker({ label, box, imageW, imageH, onClick }: Props) {
  const [ymin, xmin, ymax, xmax] = box;

  const left = (xmin / 1000) * imageW;
  const top = (ymin / 1000) * imageH;

  const width = ((xmax - xmin) / 1000) * imageW;
  const height = ((ymax - ymin) / 1000) * imageH;

  return (
    <div className="absolute" style={{ left, top, width, height }}>
      {/* Bounding box outline */}
      <div className="absolute inset-0 rounded-xl border-2 border-white ring-1 ring-black/30 pointer-events-none" />

      {/* Label button */}
      <button
        onClick={onClick}
        className="absolute -top-0.5 -left-0.5 rounded-lg border border-white/60 bg-black/50 text-white px-2 py-0.5 text-xs backdrop-blur hover:bg-black/70"
        title={label}
        type="button"
      >
        {label}
      </button>
    </div>
  );
}
