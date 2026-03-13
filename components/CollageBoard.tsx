"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

const BOARD_W = 360;
const BOARD_H = 440;
const EXPORT_SCALE = 2;

type StickerState = {
  id: string;
  url: string;
  x: number;       // 0..BOARD_W
  y: number;       // 0..BOARD_H
  rotation: number; // degrees
  size: number;    // px on the board
};

export interface CollageBoardHandle {
  toDataURL: () => Promise<string>;
}

export interface CollageBoardSticker {
  id: string;
  url: string;
}

interface Props {
  stickers: CollageBoardSticker[];
  editable?: boolean;
  className?: string;
}

// deterministic pseudo-random from seed
function rng(seed: number) {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

function initState(s: CollageBoardSticker, idx: number, total: number): StickerState {
  const cols = Math.ceil(Math.sqrt(total));
  const rows = Math.ceil(total / cols);
  const col = idx % cols;
  const row = Math.floor(idx / cols);
  const cellW = BOARD_W / cols;
  const cellH = BOARD_H / rows;
  const size = 90 + rng(idx * 5) * 60;           // 90–150 px
  const jitterX = rng(idx * 5 + 1) * (cellW - size);
  const jitterY = rng(idx * 5 + 2) * (cellH - size);
  const rotation = (rng(idx * 5 + 3) - 0.5) * 28; // ±14°

  return {
    id: s.id,
    url: s.url,
    x: Math.max(0, Math.min(BOARD_W - size, col * cellW + jitterX)),
    y: Math.max(0, Math.min(BOARD_H - size, row * cellH + jitterY)),
    rotation,
    size,
  };
}

const CollageBoard = forwardRef<CollageBoardHandle, Props>(function CollageBoard(
  { stickers, editable = true, className = "" },
  ref
) {
  const [items, setItems] = useState<StickerState[]>([]);
  const boardRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: string; sx: number; sy: number; ox: number; oy: number } | null>(null);

  // Sync stickers prop → keep existing positions, init new ones
  useEffect(() => {
    setItems((prev) => {
      const prevMap = new Map(prev.map((i) => [i.id, i]));
      return stickers.map((s, idx) =>
        prevMap.get(s.id) ?? initState(s, idx, stickers.length)
      );
    });
  }, [stickers]);

  useImperativeHandle(ref, () => ({
    async toDataURL() {
      const canvas = document.createElement("canvas");
      const W = BOARD_W * EXPORT_SCALE;
      const H = BOARD_H * EXPORT_SCALE;
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d")!;

      // Paper background
      ctx.fillStyle = "#fefefe";
      ctx.fillRect(0, 0, W, H);

      for (const item of items) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        await new Promise<void>((res) => {
          img.onload = () => res();
          img.onerror = () => res();
          img.src = item.url;
        });
        const s = EXPORT_SCALE;
        const cx = (item.x + item.size / 2) * s;
        const cy = (item.y + item.size / 2) * s;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate((item.rotation * Math.PI) / 180);
        ctx.drawImage(img, (-item.size / 2) * s, (-item.size / 2) * s, item.size * s, item.size * s);
        ctx.restore();
      }

      return canvas.toDataURL("image/png");
    },
  }));

  // Drag handlers (pointer events for mouse + touch)
  function onPointerDown(e: React.PointerEvent, id: string) {
    if (!editable) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const item = items.find((i) => i.id === id)!;
    drag.current = { id, sx: e.clientX, sy: e.clientY, ox: item.x, oy: item.y };
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current || !boardRef.current) return;
    const rect = boardRef.current.getBoundingClientRect();
    const scale = BOARD_W / rect.width;
    const dx = (e.clientX - drag.current.sx) * scale;
    const dy = (e.clientY - drag.current.sy) * scale;
    const { id, ox, oy } = drag.current;
    setItems((prev) =>
      prev.map((item) =>
        item.id !== id ? item : {
          ...item,
          x: Math.max(0, Math.min(BOARD_W - item.size, ox + dx)),
          y: Math.max(0, Math.min(BOARD_H - item.size, oy + dy)),
        }
      )
    );
  }

  function onPointerUp() { drag.current = null; }

  return (
    <div
      ref={boardRef}
      className={`relative w-full rounded-2xl overflow-hidden shadow-md select-none ${className}`}
      style={{ aspectRatio: `${BOARD_W}/${BOARD_H}`, background: "#fefefe",
        backgroundImage: "radial-gradient(circle, #e5e7eb 1px, transparent 1px)",
        backgroundSize: "22px 22px" }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      {items.map((item, idx) => (
        <div
          key={item.id}
          className={`absolute ${editable ? "cursor-grab active:cursor-grabbing" : ""}`}
          style={{
            left: `${(item.x / BOARD_W) * 100}%`,
            top: `${(item.y / BOARD_H) * 100}%`,
            width: `${(item.size / BOARD_W) * 100}%`,
            transform: `rotate(${item.rotation}deg)`,
            zIndex: 10 + idx,
            touchAction: "none",
          }}
          onPointerDown={(e) => onPointerDown(e, item.id)}
        >
          <img
            src={item.url}
            alt="sticker"
            className="w-full h-auto"
            style={{ filter: "drop-shadow(0 2px 10px rgba(0,0,0,0.4)) drop-shadow(0 0 4px rgba(0,0,0,0.2))" }}
            draggable={false}
          />
        </div>
      ))}

      {items.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-neutral-300 text-sm">
          Stickers will appear here
        </div>
      )}
    </div>
  );
});

export default CollageBoard;
