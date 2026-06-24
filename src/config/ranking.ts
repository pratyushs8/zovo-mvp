// Ranking engine constants — imported by both rankProperties and generateExplanation
// to prevent circular imports between those two modules.

// ─── Hard filter ──────────────────────────────────────────────────────────────

// User vector: workation >= this value triggers the hard filter.
export const WORKATION_USER_THRESHOLD = 0.8;

// Property workation tier boundaries (tagging-rubric-v1.md convention):
//   > 0.2  → has meaningful remote-work infrastructure; survives strict filter
//   0.1–0.2 → leisure-only; admitted only under relaxed fallback
//   ≤ 0.1  → no workation value; excluded even under relaxed filter
// Strict inequality (>) is intentional — properties tagged exactly at 0.2
// are leisure-only by rubric and should not reach workation users.
// See src/config/weights.ts for how the soft weight complements this hard floor.
export const WORKATION_PROP_STRICT = 0.2;
// Relaxed fallback threshold — activated only when strict mode produces 0 survivors.
export const WORKATION_PROP_RELAXED = 0.1;

// ─── Confidence ───────────────────────────────────────────────────────────────

// Score thresholds that determine the confidence label on a result set.
// Calibrated against the current 50-property dataset where real top scores
// range from ~0.71 (workation + calm persona) to ~0.86 (couple retreat).
// HIGH_CONFIDENCE fires for most well-matched personas; LOW_CONFIDENCE is a
// conservative floor — the "weak_match" fallback mode only activates when
// topScore < LOW_CONFIDENCE_THRESHOLD, which does not occur with the current
// property set. It is intentional future-proofing for unusual user vectors
// that find no close match (e.g. extreme multi-axis combinations not
// represented in the property data).
export const HIGH_CONFIDENCE_THRESHOLD = 0.70;
export const LOW_CONFIDENCE_THRESHOLD  = 0.55;

// ─── Results ──────────────────────────────────────────────────────────────────

// Number of ranked properties returned to the caller.
// Raising this to 10 is safe; the full candidate pool is always scored first.
export const MAX_RESULTS = 5;

// ─── Explanation ──────────────────────────────────────────────────────────────

// Number of dimensions to surface in topMatches / topMisses.
export const TOP_N_DIMENSIONS = 3;
// Minimum gap to qualify as a reported miss.
// Gaps at or below this are near-matches and not surfaced as misses.
export const MISS_GAP_THRESHOLD = 0.2;
