"use client";

// Thin analytics hook. Swap the no-op implementation for a real provider
// (Mixpanel, PostHog, Amplitude) without touching call sites.
export function useAnalytics() {
  function track(event: string, properties?: Record<string, unknown>) {
    if (process.env.NODE_ENV === "development") {
      console.debug("[analytics]", event, properties);
    }
    // TODO: analytics.track(event, properties)
  }

  return { track };
}
