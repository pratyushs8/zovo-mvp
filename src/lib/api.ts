import type { RecommendationRequest, RecommendationResponse } from "@/types/api";
import type { ExplainRequest, ExplainResponse } from "@/types/explain";
import type { IntakeAnswers } from "@/hooks/useIntakeSession";
import type { EventProperties } from "@/lib/analytics";

export async function submitRecommendation(
  req: RecommendationRequest
): Promise<RecommendationResponse> {
  const res = await fetch("/api/recommend", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string; detail?: unknown };
    if (err.error === "validation_failed") {
      console.error("[submitRecommendation] validation_failed — field errors:", err.detail);
    }
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }

  return res.json() as Promise<RecommendationResponse>;
}

// Creates the session row server-side. Idempotent — safe to call on every
// intake load. Throws on network or server error so the caller can track
// whether the session was successfully persisted and retry before submit.
export async function createSession(
  sessionId: string,
  opts?: { referrer?: string; userAgent?: string }
): Promise<void> {
  const res = await fetch("/api/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, ...opts }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

export async function fetchExplanations(req: ExplainRequest): Promise<ExplainResponse> {
  const res = await fetch("/api/explain", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<ExplainResponse>;
}

// Fire-and-forget — must never throw or block navigation.
// keepalive: true ensures the request completes even if the user closes the tab
// immediately after clicking, which can happen when _blank opens on mobile.
export function trackHandoffClick(
  properties: EventProperties<"booking_handoff_clicked">,
  sessionId?: string | null
): void {
  fetch("/api/track/booking-handoff-clicked", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ properties, ...(sessionId ? { sessionId } : {}) }),
    keepalive: true,
  }).catch(() => undefined);
}

// Persists current step + accumulated answers on each step advance.
// Best-effort — errors are silently swallowed so they don't interrupt the flow.
export async function updateSessionProgress(
  sessionId: string,
  step: number,
  answers: IntakeAnswers
): Promise<void> {
  await fetch("/api/session", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, step, answers }),
  }).catch(() => undefined);
}
