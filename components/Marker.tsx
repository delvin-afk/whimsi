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
    <button
      onClick={onClick}
      className="absolute rounded-xl border border-white/60 bg-black/40 text-white px-2 py-1 text-xs backdrop-blur hover:bg-black/55"
      style={{ left, top }}
      title={label}
      type="button"
    >
      {label}
      <span
        className="absolute left-0 top-0 rounded-xl border border-white/40"
        style={{ width, height }}
      />
    </button>
  );
}
