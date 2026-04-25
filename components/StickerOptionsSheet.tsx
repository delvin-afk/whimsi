"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  initialCaption: string | null;
  onEditCaption: (caption: string) => Promise<void>;
  onDelete: () => Promise<void>;
}

export default function StickerOptionsSheet({
  open,
  onClose,
  initialCaption,
  onEditCaption,
  onDelete,
}: Props) {
  const [mode, setMode] = useState<"menu" | "edit">("menu");
  const [caption, setCaption] = useState(initialCaption ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Reset state when sheet opens
  useEffect(() => {
    if (open) {
      setMode("menu");
      setCaption(initialCaption ?? "");
    }
  }, [open, initialCaption]);

  useEffect(() => {
    if (mode === "edit") inputRef.current?.focus();
  }, [mode]);

  async function handleSaveCaption() {
    setSaving(true);
    await onEditCaption(caption);
    setSaving(false);
    onClose();
  }

  async function handleDelete() {
    setDeleting(true);
    await onDelete();
    setDeleting(false);
    onClose();
  }

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center">
        <div className="w-full max-w-lg bg-neutral-900 rounded-t-3xl shadow-2xl overflow-hidden mb-20">
          {/* Handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-white/20" />
          </div>

          {mode === "menu" && (
            <div className="px-4 pb-8 pt-2 space-y-1">
              <button
                onClick={() => setMode("edit")}
                className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl hover:bg-white/10 text-left transition-colors"
              >
                <span className="text-xl">✏️</span>
                <div>
                  <p className="font-semibold text-sm text-white">Edit caption</p>
                  <p className="text-xs text-neutral-500">Update the caption on this post</p>
                </div>
              </button>

              <button
                onClick={handleDelete}
                disabled={deleting}
                className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl hover:bg-white/10 text-left disabled:opacity-40 transition-colors"
              >
                <span className="text-xl">🗑️</span>
                <div>
                  <p className="font-semibold text-sm text-red-400">
                    {deleting ? "Removing…" : "Remove post"}
                  </p>
                  <p className="text-xs text-neutral-500">Permanently delete this sticker post</p>
                </div>
              </button>

              <button
                onClick={onClose}
                className="w-full py-3 mt-2 rounded-2xl border border-white/10 text-sm font-medium text-neutral-400 hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
            </div>
          )}

          {mode === "edit" && (
            <div className="px-4 pb-8 pt-2 space-y-4">
              <p className="font-semibold px-1 text-white">Edit caption</p>
              <textarea
                ref={inputRef}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={3}
                placeholder="Write a caption…"
                className="w-full bg-neutral-800 text-white placeholder-neutral-500 rounded-2xl px-4 py-3 text-sm resize-none outline-none focus:ring-2 focus:ring-purple-500 transition-colors"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setMode("menu")}
                  className="flex-1 py-3 rounded-2xl border border-white/10 text-sm font-medium text-neutral-400 hover:bg-white/10 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleSaveCaption}
                  disabled={saving}
                  className="flex-1 py-3 rounded-2xl bg-[#4ade80] text-black text-sm font-bold disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
