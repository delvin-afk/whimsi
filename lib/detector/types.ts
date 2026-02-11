import type { Detection } from "@/types";

export type DetectorInput = {
  base64: string; // base64 bytes only (no data:image/... prefix)
  mimeType: string; // e.g. image/jpeg
};

export interface DetectorProvider {
  detect(input: DetectorInput): Promise<Detection[]>;
}
