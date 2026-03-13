export type Box2D = [number, number, number, number]; // [ymin, xmin, ymax, xmax] in 0..1000

export type Detection = {
  id?: string;
  label: string;
  box_2d: Box2D;
};

export type LessonPayload = {
  label: string;
  target_lang: string;
  meaning: string;
  examples: Array<{ target: string; english: string }>;
  related_words: string[];
  exercises: Array<
    | { type: "flashcard"; front: string; back: string }
    | { type: "fill_blank"; prompt: string; answer: string }
  >;
};

export type LessonRow = {
  id: string;
  detection_id: string | null;
  target_lang: string;
  payload: LessonPayload;
  created_at: string;
};

export type PostRow = {
  id: string;
  image_path: string;
  image_width: number | null;
  image_height: number | null;
  created_at: string;
  detections?: Detection[];
  lessons?: LessonRow[];
};

// ── New types for the sticker social app ──────────────────────────────────────

export type Profile = {
  id: string;       // localStorage UUID
  username: string;
  created_at?: string;
};

export type StickerPost = {
  id: string;
  user_id: string;
  username: string;
  image_url: string;   // Supabase Storage public URL
  caption: string | null;
  location_name: string | null;
  lat: number | null;
  lng: number | null;
  is_public: boolean;
  created_at: string;
  group_id: string | null;
};
