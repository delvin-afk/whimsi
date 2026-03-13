import type { Detection } from "@/types";

export type VisionLabel = {
  label: string;
  score?: number;
};

export type DetectorInput = {
  base64: string;
  mimeType: string;
};

export type VisionResult = {
  objects: Detection[];
  labels: VisionLabel[];
};

export interface DetectorProvider {
  detectAll(input: DetectorInput): Promise<VisionResult>;
}
