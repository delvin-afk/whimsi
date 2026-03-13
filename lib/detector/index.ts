import type { DetectorProvider } from "./types";
import { GoogleVisionDetector } from "./providers/googleVision";
import { GeminiDetector } from "./providers/gemini";

export function getDetector(): DetectorProvider {
  const provider = (
    process.env.DETECTOR_PROVIDER || "google_vision"
  ).toLowerCase();

  switch (provider) {
    case "google_vision":
      return new GoogleVisionDetector();
    case "gemini":
      return new GeminiDetector();
    default:
      throw new Error(`Unknown DETECTOR_PROVIDER: ${provider}`);
  }
}
