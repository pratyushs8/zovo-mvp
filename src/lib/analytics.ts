// Analytics event definitions for ZoCo MVP.
// To swap to PostHog: replace the body of trackEvent — call sites are unchanged.

export type AnalyticsEvent =
  | { name: "session_started"; properties: { referrer?: string; userAgent?: string } }
  | { name: "question_answered"; properties: { question: "persona" | "vibe"; answer: string } }
  | {
      name: "recommendations_shown";
      properties: { requestId: number; propertyIds: number[]; count: number };
    }
  | {
      name: "recommendation_clicked";
      properties: { requestId: number; propertyId: number; rank: number };
    }
  | {
      name: "booking_handoff_clicked";
      properties: {
        propertyId: number;
        bookingUrl: string; // raw base URL before UTM append
        rank: number;
        destinationSlug: string;
        requestId: number;
        explanationSource?: "model" | "fallback"; // present only when explanation layer has loaded
      };
    };

export type EventName = AnalyticsEvent["name"];

export type EventProperties<T extends EventName> = Extract<
  AnalyticsEvent,
  { name: T }
>["properties"];
