// Builds the outbound "View Stay" URL for a recommendation card CTA.
//
// Contract: baseUrl is opaque — we only append query params, never rewrite
// path segments. UTM params provide cross-domain attribution without leaking
// internal fields (propertyId, requestId, scores stay server-side only).
//
// Returns null when the baseUrl fails validation — the caller should hide
// the CTA rather than render a broken or unsafe link.

const ZOSTEL_ORIGIN = "https://www.zostel.com";

export interface ViewStayInput {
  bookingUrl: string;
  rank: number;
  sessionId?: string | null;
}

export type ViewStayResult = { ok: true; url: string } | { ok: false; reason: string };

export function buildViewStayUrl(input: ViewStayInput): ViewStayResult {
  const { bookingUrl, rank, sessionId } = input;

  if (!bookingUrl || typeof bookingUrl !== "string") {
    return { ok: false, reason: "missing bookingUrl" };
  }

  if (!bookingUrl.startsWith(`${ZOSTEL_ORIGIN}/`)) {
    return { ok: false, reason: "bookingUrl must be a zostel.com URL" };
  }

  if (!Number.isInteger(rank) || rank < 1) {
    return { ok: false, reason: "rank must be a positive integer" };
  }

  const params: Record<string, string> = {
    utm_source: "zoco",
    utm_medium: "recommendation",
    utm_content: `rank_${rank}`,
  };

  if (sessionId) {
    params.utm_campaign = sessionId;
  }

  const qs = new URLSearchParams(params).toString();
  const separator = bookingUrl.includes("?") ? "&" : "?";

  return { ok: true, url: `${bookingUrl}${separator}${qs}` };
}
