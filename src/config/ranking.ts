// Single file for all ranking tuning values.
// Edit here during Day 6 validation; imports cascade to the engine, explanation
// layer, and PM diagnostic scripts automatically.

// ─── Hard filter ──────────────────────────────────────────────────────────────

// User vector: workation >= this value triggers the hard filter.
export const WORKATION_USER_THRESHOLD = 0.8;

// Property workation tier boundaries (tagging-rubric-v1.md convention):
//   > STRICT  → has meaningful remote-work infrastructure; survives strict filter
//   RELAXED–STRICT → leisure-only; admitted only under relaxed fallback
//   ≤ RELAXED → no workation value; excluded even under relaxed filter
// Strict inequality (>) is intentional — properties tagged exactly at STRICT
// are leisure-only by rubric and should not reach workation users.
export const WORKATION_PROP_STRICT  = 0.2;
export const WORKATION_PROP_RELAXED = 0.1;

// ─── Confidence ───────────────────────────────────────────────────────────────

// Thresholds for the confidence label attached to a result set.
// Calibrated against the 50-property dataset (top scores ~0.71–0.90).
// HIGH fires for most well-matched personas. LOW is a conservative floor —
// "weak_match" fallback only activates below it; rare with current property set.
export const HIGH_CONFIDENCE_THRESHOLD = 0.70;
export const LOW_CONFIDENCE_THRESHOLD  = 0.55;

// ─── Results ──────────────────────────────────────────────────────────────────

// Properties returned to the caller. Raising to 10 is safe — full pool is
// scored before slicing.
export const MAX_RESULTS = 5;

// ─── Explanation — dimension summary ──────────────────────────────────────────

// How many dimensions surface in topMatches / topMisses.
export const TOP_N_DIMENSIONS = 3;

// A gap at or below this is a near-match; not surfaced as a miss.
export const MISS_GAP_THRESHOLD = 0.2;

// Gap thresholds for the strength label on each dimension match.
// gap ≤ STRONG → "strong"  |  gap ≤ MODERATE → "moderate"  |  else → "weak"
export const STRENGTH_STRONG_MAX_GAP   = 0.2;
export const STRENGTH_MODERATE_MAX_GAP = 0.4;

// ─── Diagnostics (PM review / debug-output.ts) ────────────────────────────────
// These control what the validate-scenarios script flags for PM inspection.
// Tuning these does NOT change the ranking itself — only what gets highlighted.

// weight_logic flag: top results span < this many score points → ranking is fragile.
export const DIAG_SPREAD_FLAT_THRESHOLD = 0.04;

// hard_filter flag: fraction of pool removed AND confidence is not high.
export const DIAG_FILTER_AGGRESSIVE_FRACTION = 0.40;

// metadata flag: only raised for dimensions the user cares about (value ≥ this).
export const DIAG_METADATA_SUSPECT_USER_VALUE = 0.60;
// metadata flag: gap must be at least this large to qualify as a suspect.
export const DIAG_METADATA_SUSPECT_GAP = 0.40;

// coverage flag: pool smaller than this → thin_pool, not a ranking signal.
export const DIAG_THIN_POOL_THRESHOLD = 10;

// coverage flag: top score below this with a full pool → no good property match.
export const DIAG_LOW_SCORE_CEILING = 0.65;

// coverage flag: homogeneous archetype distribution is only a concern when the
// top score is below this value (strong results don't need diversity).
export const DIAG_HOMOGENEOUS_SCORE_CAP = 0.72;

// coverage flag: minimum pool size before homogeneity is worth flagging.
export const DIAG_HOMOGENEOUS_MIN_POOL = 5;

// ─── Data quality notes ───────────────────────────────────────────────────────
// These are not thresholds — they document known property-data concentrations
// that limit how much a dimension can actually discriminate rankings.
// Review whenever the property dataset grows significantly.

// 36/50 properties have scenic >= 0.8. As a result the scenic dimension adds
// ~0.08 points to almost every property regardless of user preference, and a
// user with scenic=0.9 vs scenic=0.1 sees only ~0.05 score spread difference
// in the top 10. Raising the scenic weight further will not help until more
// urban / low-scenic properties are added to the dataset.
// To fix: tag city and urban properties with scenic 0.1–0.4.
export const DATA_NOTE_SCENIC_CONCENTRATION = 0.72; // fraction of pool at scenic >= 0.8
