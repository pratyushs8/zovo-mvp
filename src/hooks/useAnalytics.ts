"use client";

import type { EventName, EventProperties } from "@/lib/analytics";

// Client-side analytics hook.
// Fires a POST to /api/track, which calls trackEvent server-side.
// To swap to PostHog: replace the fetch with posthog.capture — call sites unchanged.
export function useAnalytics() {
  function track<T extends EventName>(
    name: T,
    properties: EventProperties<T>,
    sessionId?: string
  ) {
    if (process.env.NODE_ENV === "development") {
      console.debug("[analytics]", name, properties);
    }

    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, properties, sessionId }),
    }).catch(() => {
      // fire-and-forget — analytics must never break the UI
    });
  }

  return { track };
}
