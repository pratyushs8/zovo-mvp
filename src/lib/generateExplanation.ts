import type { ScoringVector } from "@/types";
import type {
  RankedProperty,
  PropertyExplanation,
  RankingExplanation,
  DimensionMatch,
  MatchStrength,
  FilterPassMode,
  ConfidenceReason,
  ConfidenceLevel,
  FallbackMode,
} from "@/types/ranking";
import { DIMENSION_KEYS } from "@/config/scoring";
import {
  WORKATION_USER_THRESHOLD,
  HIGH_CONFIDENCE_THRESHOLD,
  LOW_CONFIDENCE_THRESHOLD,
  TOP_N_DIMENSIONS,
  MISS_GAP_THRESHOLD,
} from "@/config/ranking";
import { config } from "@/lib/config";

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function classifyStrength(gap: number): MatchStrength {
  if (gap <= 0.2) return "strong";
  if (gap <= 0.4) return "moderate";
  return "weak";
}

// ─── Per-property explanation ─────────────────────────────────────────────────

// Derives a PropertyExplanation from a fully scored RankedProperty.
// hardFilterTriggered must be passed in because it is a function of the user
// vector, not of the individual property.
export function explainProperty(
  ranked: RankedProperty,
  hardFilterTriggered: boolean,
): PropertyExplanation {
  const { breakdown, hardFilterExempted, property } = ranked;

  // Build a DimensionMatch for every dimension from the existing breakdown.
  const allDims: DimensionMatch[] = DIMENSION_KEYS.map((dim) => ({
    dim,
    contribution: breakdown[dim].contribution,
    gap:          breakdown[dim].gap,
    strength:     classifyStrength(breakdown[dim].gap),
  }));

  // Sort by contribution descending: "what most explained this property's rank."
  const dimensions = [...allDims].sort((a, b) => b.contribution - a.contribution);

  // Top 3 contributors — direct slice of the sorted array.
  const topMatches = dimensions.slice(0, TOP_N_DIMENSIONS);

  // Top misses — dimensions where the user–property gap is large.
  // Only surfaces gaps worth noting (> MISS_GAP_THRESHOLD).
  const topMisses = [...allDims]
    .filter((d) => d.gap > MISS_GAP_THRESHOLD)
    .sort((a, b) => b.gap - a.gap)
    .slice(0, TOP_N_DIMENSIONS);

  const passMode: FilterPassMode = !hardFilterTriggered
    ? "not_applicable"
    : hardFilterExempted
      ? "passed_relaxed"
      : "passed_strict";

  return {
    dimensions,
    topMatches,
    topMisses,
    filterTrace: {
      hardFilterTriggered,
      passMode,
      workationScore: property.scoring.workation,
    },
  };
}

// ─── Ranking-level explanation ────────────────────────────────────────────────

// Derives the ConfidenceReason that explains why a given confidence level was
// assigned. Mirrors the priority order in resolveConfidence / resolveFallback.
function resolveConfidenceReason(
  poolSize: number,
  topScore: number,
  fallback: FallbackMode,
  maxResults: number,
): ConfidenceReason {
  if (poolSize === 0) return "empty_pool";
  if (fallback === "hard_filter_relaxed") return "hard_filter_relaxed";
  if (poolSize < maxResults) return "thin_pool";
  if (topScore >= HIGH_CONFIDENCE_THRESHOLD) return "top_score_high";
  if (topScore >= LOW_CONFIDENCE_THRESHOLD) return "top_score_moderate";
  return "top_score_low";
}

// Produces the RankingExplanation that is attached to the top-level payload.
// Takes explicit params instead of the full RankingPayload to avoid a circular
// module dependency (rankProperties → generateExplanation → rankProperties).
export function explainRanking(params: {
  userVector:        ScoringVector;
  poolSize:          number;
  hardFilteredCount: number;
  topScore:          number;
  fallback:          FallbackMode;
  confidence:        ConfidenceLevel;
}): RankingExplanation {
  const maxResults = config.recommendation.maxResults;
  const { userVector, poolSize, hardFilteredCount, topScore, fallback, confidence } = params;

  return {
    hardFilterTriggered: userVector.workation >= WORKATION_USER_THRESHOLD,
    hardFilteredCount,
    relaxedModeUsed:     fallback === "hard_filter_relaxed",
    poolSize,
    fallback,
    confidence,
    confidenceReason: resolveConfidenceReason(poolSize, topScore, fallback, maxResults),
  };
}
