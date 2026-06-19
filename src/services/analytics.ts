import { db } from "@/db/client";
import { events } from "@/db/schema";
import type { EventName, EventProperties } from "@/lib/analytics";

// Persists an analytics event to the events table.
// sessionId is nullable — events may fire before a session is confirmed.
//
// To swap to PostHog:
//   1. Replace the db.insert call with posthog.capture(...)
//   2. Keep this function signature — call sites are unchanged.
export async function trackEvent<T extends EventName>(
  name: T,
  properties: EventProperties<T>,
  sessionId?: string
): Promise<void> {
  try {
    await db.insert(events).values({
      name,
      properties: properties as Record<string, unknown>,
      sessionId: sessionId ?? null,
    });
  } catch (err) {
    // Non-fatal — analytics must never break the main flow
    console.error("[analytics] trackEvent failed:", name, err);
  }
}
