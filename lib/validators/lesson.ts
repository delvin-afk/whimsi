import { z } from "zod";

export const LessonPayloadSchema = z.object({
  label: z.string().min(1),
  target_lang: z.string().min(1),
  meaning: z.string().min(1),
  examples: z
    .array(z.object({ target: z.string().min(1), english: z.string().min(1) }))
    .min(2)
    .max(6),
  related_words: z.array(z.string().min(1)).min(3).max(12),
  exercises: z
    .array(
      z.union([
        z.object({
          type: z.literal("flashcard"),
          front: z.string(),
          back: z.string(),
        }),
        z.object({
          type: z.literal("fill_blank"),
          prompt: z.string(),
          answer: z.string(),
        }),
      ]),
    )
    .min(2)
    .max(6),
});

export type LessonPayloadOutput = z.infer<typeof LessonPayloadSchema>;
