import { z } from "zod";

export const DetectionSchema = z.object({
  label: z.string().min(1),
  box_2d: z
    .tuple([z.number(), z.number(), z.number(), z.number()])
    .refine(
      ([ymin, xmin, ymax, xmax]) =>
        [ymin, xmin, ymax, xmax].every((n) => n >= 0 && n <= 1000) &&
        ymax > ymin &&
        xmax > xmin,
      "Invalid box coordinates",
    ),
});

export const DetectionsSchema = z.array(DetectionSchema).min(1).max(10);

export type DetectionOutput = z.infer<typeof DetectionSchema>;
