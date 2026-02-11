import type { DetectorProvider } from "./types";
import { GoogleVisionDetector } from "./providers/googleVision";

export function getDetector(): DetectorProvider {
  const provider = (
    process.env.DETECTOR_PROVIDER || "google_vision"
  ).toLowerCase();

  switch (provider) {
    case "google_vision":
      return new GoogleVisionDetector();
    default:
      throw new Error(`Unknown DETECTOR_PROVIDER: ${provider}`);
  }
}
