"use client";

import type { EventProperties } from "@/lib/analytics";

// Client-side analytics helpers for events that need to fire from the browser.
// All helpers are fire-and-forget — errors are swallowed so they never break the UI.
// To swap to PostHog: replace the fetch calls — call sites are unchanged.
export function useAnalytics() {
  function trackRecommendationClicked(
    properties: EventProperties<"recommendation_clicked">,
    sessionId?: string | null
  ) {
    fetch("/api/track/recommendation-clicked", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ properties, ...(sessionId ? { sessionId } : {}) }),
    }).catch(() => undefined);
  }

  return { trackRecommendationClicked };
}
