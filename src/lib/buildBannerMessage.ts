import type { ConfidenceLevel, FallbackMode } from "@/types/ranking";

export function buildBannerMessage(
  confidence: ConfidenceLevel,
  fallback: FallbackMode
): string | null {
  if (fallback === "empty") return null;
  if (fallback === "thin_pool")
    return "Fewer properties matched your filters — showing the closest options.";
  if (fallback === "weak_match")
    return "These are the closest matches we found — not a perfect fit for every preference.";
  if (fallback === "hard_filter_relaxed")
    return "We relaxed the work-setup filter to show more options.";
  if (confidence === "moderate")
    return "Good matches found — some properties are a closer fit than others.";
  if (confidence === "low")
    return "These are the closest options we found. They may not be a perfect fit.";
  return null;
}
