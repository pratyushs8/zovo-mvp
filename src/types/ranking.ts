import type { ScoringVector, PropertySeed } from "@/types";
import type { DimensionKey } from "@/config/scoring";

// ─── Ranking input ────────────────────────────────────────────────────────────

export interface RankingInput {
  userVector: ScoringVector;
  destinationSlug?: string;
}

// ─── Candidate property ───────────────────────────────────────────────────────

export interface CandidateProperty extends PropertySeed {
  id: number;
}

// ─── Filter result ────────────────────────────────────────────────────────────

export interface FilterResult {
  survivors: CandidateProperty[];
  hardFilteredCount: number;
  relaxedModeActivated: boolean;
  exemptedBookingUrls: string[];
}

// ─── Scoring breakdown ────────────────────────────────────────────────────────

export interface DimensionBreakdown {
  userValue: number; // U[d]
  propertyValue: number; // P[d]
  gap: number; // |U[d] − P[d]|
  contribution: number; // W[d] × (1 − gap)
}

export type ScoringBreakdown = Record<DimensionKey, DimensionBreakdown>;

// ─── Explanation types ────────────────────────────────────────────────────────

// Categorical match quality derived from gap size.
// strong: gap <= 0.2 | moderate: 0.2 < gap <= 0.4 | weak: gap > 0.4
export type MatchStrength = "strong" | "moderate" | "weak";

// Per-dimension match summary produced by generateExplanation.
export interface DimensionMatch {
  dim: DimensionKey;
  contribution: number; // W[d] × (1 − gap)       — raw score contribution
  matchScore: number; // W[d] × U[d] × (1 − gap) — "did the property deliver on what the user wanted?"
  gap: number; // |U[d] − P[d]|
  strength: MatchStrength;
}

// How a property moved through the workation hard filter.
export type FilterPassMode =
  | "not_applicable" // user.workation below trigger threshold; filter not applied
  | "passed_strict" // survived the strict workation threshold
  | "passed_relaxed"; // admitted only under the relaxed fallback threshold

export interface PropertyFilterTrace {
  hardFilterTriggered: boolean;
  passMode: FilterPassMode;
  workationScore: number; // property's scoring.workation value
}

// Full explanation for a single ranked property.
export interface PropertyExplanation {
  // All 7 dimensions sorted by matchScore descending.
  // Primary signal: "these dimensions explain why this property ranked here."
  dimensions: DimensionMatch[];
  // Shortcut: top 3 by matchScore — dimensions the user cared about AND the property delivered.
  topMatches: DimensionMatch[];
  // Shortcut: top 3 by gap where gap > MISS_GAP_THRESHOLD (notable mismatches).
  // Empty if all gaps are small (near-match on all dimensions).
  topMisses: DimensionMatch[];
  // How this property moved through the hard filter.
  filterTrace: PropertyFilterTrace;
}

// Machine-readable reason assigned to the confidence level.
export type ConfidenceReason =
  | "top_score_high" // topScore >= HIGH_CONFIDENCE_THRESHOLD, full pool
  | "top_score_moderate" // topScore in [LOW_CONFIDENCE_THRESHOLD, HIGH_CONFIDENCE_THRESHOLD)
  | "top_score_low" // topScore < LOW_CONFIDENCE_THRESHOLD
  | "thin_pool" // fewer survivors than maxResults after hard filter
  | "hard_filter_relaxed" // relaxed workation threshold was used
  | "empty_pool"; // 0 survivors even after relaxed filter

// Ranking-level explanation — one per response, same context for all results.
export interface RankingExplanation {
  hardFilterTriggered: boolean; // user.workation >= WORKATION_USER_THRESHOLD?
  hardFilteredCount: number; // properties removed by the filter
  relaxedModeUsed: boolean; // fallback === "hard_filter_relaxed"
  poolSize: number; // survivors after filter, before scoring
  fallback: FallbackMode;
  confidence: ConfidenceLevel;
  confidenceReason: ConfidenceReason;
}

// ─── Ranked property result ───────────────────────────────────────────────────

export interface RankedProperty {
  property: CandidateProperty;
  score: number;
  breakdown: ScoringBreakdown;
  rank: number;
  hardFilterExempted: boolean;
  lowConfidence: boolean;
  explanation: PropertyExplanation;
}

// ─── Ranking response payload ─────────────────────────────────────────────────

export type ConfidenceLevel = "high" | "moderate" | "low";

export type FallbackMode = "thin_pool" | "weak_match" | "hard_filter_relaxed" | "empty" | null;

export interface RankingPayload {
  results: RankedProperty[];
  userVector: ScoringVector;
  poolSize: number;
  hardFilteredCount: number;
  topScore: number;
  confidence: ConfidenceLevel;
  fallback: FallbackMode;
  rankingExplanation: RankingExplanation;
}
