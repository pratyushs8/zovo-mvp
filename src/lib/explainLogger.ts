// Observability for the Day 9 explanation pipeline.
//
// Two emission points:
//   logExplainFailure — called whenever a single card falls back, with a typed
//     category so failure modes can be bucketed without parsing free-form text.
//   logExplainBatch — called once per request with aggregate counts and timing.
//
// Emission rules:
//   • Local / staging: per-card failures AND batch summary (full diagnostic signal)
//   • Production: batch summary only (no per-card noise on a hot path)
//
// Nothing here logs prompt text, user vectors, property titles, or API keys.

import { isProduction, isLocal, isStaging } from "@/lib/env";

// ─── Failure categories ───────────────────────────────────────────────────────
//
// Each value maps to one recoverable path in the explanation pipeline.
// Keep these stable — Day 12 QA and Day 14 review will filter/group by them.

export type ExplainFailureCategory =
  | "api_error"     // network error, auth failure, rate limit, server 5xx
  | "api_timeout"   // request exceeded EXPLAIN_TIMEOUT_MS
  | "json_parse"    // model returned non-JSON or structurally invalid envelope
  | "validation"    // per-card text failed sanitize/validate checks
  | "missing_card"; // model returned fewer cards than were requested

export interface ExplainFailure {
  category: ExplainFailureCategory;
  cardId?: number;
  detail?: string; // short human label — never prompt text or user data
}

// ─── Batch summary ────────────────────────────────────────────────────────────

export interface ExplainBatchSummary {
  total: number;
  model: number;
  fallback: number;
  durationMs: number;
  failures: ExplainFailure[];
}

// ─── Emission ─────────────────────────────────────────────────────────────────

export function logExplainFailure(failure: ExplainFailure): void {
  if (isProduction) return;
  const scope = failure.cardId !== undefined ? `card ${failure.cardId}` : "batch";
  const detail = failure.detail ? ` — ${failure.detail}` : "";
  console.warn(`[explain] fallback (${scope}): ${failure.category}${detail}`);
}

export function logExplainBatch(summary: ExplainBatchSummary): void {
  if (isProduction && summary.fallback === 0) return; // quiet on a clean prod run
  const { total, model, fallback, durationMs, failures } = summary;
  const label = isProduction ? "[explain:prod]" : "[explain]";
  console.info(
    `${label} batch complete — ${model}/${total} model, ${fallback} fallback, ${durationMs}ms`
  );
  if (!isProduction && failures.length > 0) {
    const byCategory = failures.reduce<Record<string, number>>((acc, f) => {
      acc[f.category] = (acc[f.category] ?? 0) + 1;
      return acc;
    }, {});
    console.info(`[explain] failure breakdown:`, byCategory);
  }
}
