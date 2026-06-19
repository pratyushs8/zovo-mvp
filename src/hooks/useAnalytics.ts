"use client";

import type { EventProperties } from "@/lib/analytics";

// Client-side hook for recommendation_clicked only.
// All other events fire server-side via trackEvent() in src/services/analytics.ts.
// To swap to PostHog: replace the fetch call — call sites unchanged.
export function useAnalytics() {
  function trackRecommendationClicked(
    properties: EventProperties<"recommendation_clicked">,
    sessionId?: string
  ) {
    if (process.env.NODE_ENV === "development") {
      console.debug("[analytics] recommendation_clicked", properties);
    }

    fetch("/api/track/recommendation-clicked", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ properties, sessionId }),
    }).catch(() => {
      // fire-and-forget — analytics must never break the UI
    });
  }

  return { trackRecommendationClicked };
}
