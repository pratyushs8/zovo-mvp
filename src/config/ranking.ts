// Ranking engine constants — imported by both rankProperties and generateExplanation
// to prevent circular imports between those two modules.

// ─── Hard filter ──────────────────────────────────────────────────────────────

// User vector: workation >= this value triggers the hard filter.
export const WORKATION_USER_THRESHOLD = 0.8;
// Property: excluded in strict mode if workation <= this.
export const WORKATION_PROP_STRICT = 0.2;
// Property: excluded in relaxed fallback if workation <= this.
// Relaxed mode activates only when strict mode produces 0 survivors.
export const WORKATION_PROP_RELAXED = 0.1;

// ─── Confidence ───────────────────────────────────────────────────────────────

export const HIGH_CONFIDENCE_THRESHOLD = 0.70;
export const LOW_CONFIDENCE_THRESHOLD = 0.55;

// ─── Explanation ──────────────────────────────────────────────────────────────

// Number of dimensions to surface in topMatches / topMisses.
export const TOP_N_DIMENSIONS = 3;
// Minimum gap to qualify as a reported miss.
// Gaps at or below this are near-matches and not surfaced as misses.
export const MISS_GAP_THRESHOLD = 0.2;
