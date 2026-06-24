import type { ScoringVector } from "@/types";
import type { DimensionWeights } from "@/config/scoring";
import { DIMENSION_KEYS } from "@/config/scoring";
import { WEIGHTS } from "@/config/weights";
import {
  WORKATION_USER_THRESHOLD,
  WORKATION_PROP_STRICT,
  WORKATION_PROP_RELAXED,
  HIGH_CONFIDENCE_THRESHOLD,
  LOW_CONFIDENCE_THRESHOLD,
  MAX_RESULTS,
} from "@/config/ranking";
import { explainProperty, explainRanking } from "@/lib/generateExplanation";
import type {
  RankingInput,
  CandidateProperty,
  FilterResult,
  ScoringBreakdown,
  RankedProperty,
  RankingPayload,
  ConfidenceLevel,
  FallbackMode,
} from "@/types/ranking";

// Re-export ranking config so unit tests can import from either location.
export {
  WORKATION_USER_THRESHOLD,
  WORKATION_PROP_STRICT,
  WORKATION_PROP_RELAXED,
  HIGH_CONFIDENCE_THRESHOLD,
  LOW_CONFIDENCE_THRESHOLD,
  MAX_RESULTS,
} from "@/config/ranking";

// ─── Hard filter ─────────────────────────────────────────────────────────────

export function applyHardFilter(
  pool: CandidateProperty[],
  userVector: ScoringVector,
): FilterResult {
  if (userVector.workation < WORKATION_USER_THRESHOLD) {
    return {
      survivors: pool,
      hardFilteredCount: 0,
      relaxedModeActivated: false,
      exemptedBookingUrls: [],
    };
  }

  const strictSurvivors = pool.filter(
    (c) => c.scoring.workation > WORKATION_PROP_STRICT,
  );

  if (strictSurvivors.length > 0) {
    return {
      survivors: strictSurvivors,
      hardFilteredCount: pool.length - strictSurvivors.length,
      relaxedModeActivated: false,
      exemptedBookingUrls: [],
    };
  }

  // Zero strict survivors — activate relaxed mode.
  const relaxedSurvivors = pool.filter(
    (c) => c.scoring.workation > WORKATION_PROP_RELAXED,
  );
  const exempted = relaxedSurvivors.filter(
    (c) => c.scoring.workation <= WORKATION_PROP_STRICT,
  );

  return {
    survivors: relaxedSurvivors,
    hardFilteredCount: pool.length - relaxedSurvivors.length,
    relaxedModeActivated: true,
    exemptedBookingUrls: exempted.map((c) => c.bookingUrl),
  };
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

export function scoreProperty(
  userVector: ScoringVector,
  candidate: CandidateProperty,
  weights: DimensionWeights = WEIGHTS,
): { score: number; breakdown: ScoringBreakdown } {
  let total = 0;
  const breakdown = {} as ScoringBreakdown;

  for (const dim of DIMENSION_KEYS) {
    const userValue = userVector[dim];
    const propertyValue = candidate.scoring[dim];
    const gap = Math.abs(userValue - propertyValue);
    const contribution = weights[dim] * (1 - gap);
    total += contribution;
    breakdown[dim] = { userValue, propertyValue, gap, contribution };
  }

  return { score: Math.round(total * 1000) / 1000, breakdown };
}

// ─── Confidence and fallback helpers ─────────────────────────────────────────

function resolveConfidence(
  topScore: number,
  poolSize: number,
  maxResults: number,
): ConfidenceLevel {
  if (poolSize === 0) return "low";
  if (poolSize < maxResults) return "moderate";
  if (topScore >= HIGH_CONFIDENCE_THRESHOLD) return "high";
  if (topScore >= LOW_CONFIDENCE_THRESHOLD) return "moderate";
  return "low";
}

function resolveFallback(
  poolSize: number,
  topScore: number,
  relaxedModeActivated: boolean,
  maxResults: number,
): FallbackMode {
  if (poolSize === 0) return "empty";
  if (relaxedModeActivated) return "hard_filter_relaxed";
  if (poolSize < maxResults) return "thin_pool";
  if (topScore < LOW_CONFIDENCE_THRESHOLD) return "weak_match";
  return null;
}

// ─── Main ranking function ────────────────────────────────────────────────────

// Pure synchronous function — no I/O.
// Stages: destination pre-filter → hard filter → score → sort → slice →
//         explanation generation.
export function rankProperties(
  input: RankingInput,
  candidates: CandidateProperty[],
): RankingPayload {
  const { userVector } = input;
  const maxResults = MAX_RESULTS;

  // Stage 1: optional destination pre-filter.
  const pool = input.destinationSlug
    ? candidates.filter((c) => c.destinationSlug === input.destinationSlug)
    : candidates;

  // Stage 2: hard filter.
  const { survivors, hardFilteredCount, relaxedModeActivated, exemptedBookingUrls } =
    applyHardFilter(pool, userVector);

  if (survivors.length === 0) {
    return {
      results: [],
      userVector,
      poolSize: 0,
      hardFilteredCount,
      topScore: 0,
      confidence: "low",
      fallback: "empty",
      rankingExplanation: explainRanking({
        userVector,
        poolSize: 0,
        hardFilteredCount,
        topScore: 0,
        fallback: "empty",
        confidence: "low",
      }),
    };
  }

  // Stage 3: score each survivor.
  const hardFilterTriggered = userVector.workation >= WORKATION_USER_THRESHOLD;
  const exemptedSet = new Set(exemptedBookingUrls);

  const scored = survivors.map((property) => {
    const { score, breakdown } = scoreProperty(userVector, property);
    return {
      property,
      score,
      breakdown,
      hardFilterExempted: exemptedSet.has(property.bookingUrl),
    };
  });

  // Stage 4: sort descending by score.
  // Tie-break: higher matchScore sum wins — matchScore = Σ contribution × userValue,
  // which measures "did the property deliver on dimensions the user actually cared
  // about." A property with a perfect adventure score beats one with a perfect scenic
  // score for a user with adventure=0.9, scenic=0.4, even when total scores tie.
  // matchScore data is already in the breakdown — no extra computation needed.
  // Final tie-break: ascending property.id for full determinism.
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const msA = DIMENSION_KEYS.reduce(
      (sum, d) => sum + a.breakdown[d].contribution * a.breakdown[d].userValue, 0,
    );
    const msB = DIMENSION_KEYS.reduce(
      (sum, d) => sum + b.breakdown[d].contribution * b.breakdown[d].userValue, 0,
    );
    if (msB !== msA) return msB - msA;
    return a.property.id - b.property.id;
  });

  // Stage 5: slice to maxResults, assign rank and confidence flags.
  const topScore = scored[0].score;
  const isLowConfidence = topScore < LOW_CONFIDENCE_THRESHOLD;
  const finalFallback = resolveFallback(survivors.length, topScore, relaxedModeActivated, maxResults);
  const finalConfidence = resolveConfidence(topScore, survivors.length, maxResults);

  // Stage 6: generate per-property explanations.
  const results: RankedProperty[] = scored.slice(0, maxResults).map((r, i) => {
    const partial = {
      ...r,
      rank: i + 1,
      lowConfidence: isLowConfidence,
      // Placeholder — explanation populated immediately below.
      explanation: undefined as unknown as RankedProperty["explanation"],
    };
    partial.explanation = explainProperty(
      partial as RankedProperty,
      hardFilterTriggered,
    );
    return partial as RankedProperty;
  });

  return {
    results,
    userVector,
    poolSize: survivors.length,
    hardFilteredCount,
    topScore,
    confidence: finalConfidence,
    fallback: finalFallback,
    rankingExplanation: explainRanking({
      userVector,
      poolSize: survivors.length,
      hardFilteredCount,
      topScore,
      fallback: finalFallback,
      confidence: finalConfidence,
    }),
  };
}
