/**
 * Debug output format for Day 6 ranking validation.
 *
 * Defines a PM-readable JSON schema for ranking results and a serializer that
 * maps the live RankingPayload → DebugOutput. The format is:
 *
 *   - Complete: includes dimension contributions, gaps, and filter traces
 *     so a reviewer understands *why* each property ranked where it did.
 *   - Curated: strips internal plumbing fields that carry no review signal.
 *   - Annotatable: every result and the top-level record carry `pmComment`
 *     and `pmNote` null fields that a PM can fill in-place in the JSON file.
 *
 * Consumers:
 *   validate-scenarios.ts  --json flag
 *   validate-scenarios.ts  --save flag (writes one file per scenario)
 */

import type { RankingPayload, RankedProperty } from "@/types/ranking";
import type { ScoringVector, PersonaKey, StayPriority, SocialEnergy, RoomType, BudgetLevel } from "@/types";
import type { TestScenario } from "./scenarios";

// ─── Schema ───────────────────────────────────────────────────────────────────

/**
 * Full breakdown for one scoring dimension.
 * Values are rounded to 3 decimal places throughout.
 */
export interface DebugDimension {
  userValue:     number; // U[d]  — from the user's intake answers
  propertyValue: number; // P[d]  — from property metadata
  gap:           number; // |U[d] − P[d]|
  contribution:  number; // W[d] × (1 − gap)
  matchScore:    number; // W[d] × U[d] × (1 − gap) — "did the property deliver on what the user wanted?"
  strength:      "strong" | "moderate" | "weak"; // gap ≤ 0.2 | 0.2–0.4 | > 0.4
}

/** Compact summary used in topMatches and topMisses shortlists. */
export interface DebugDimensionSummary {
  dim:          string;
  contribution: number;
  matchScore:   number;
  gap:          number;
  strength:     "strong" | "moderate" | "weak";
}

/** How a property moved through the workation hard filter. */
export interface DebugFilterTrace {
  hardFilterTriggered: boolean;
  // "not_applicable" — filter was not active (user workation < threshold)
  // "passed_strict"  — survived the main workation filter
  // "passed_relaxed" — only admitted under the looser fallback threshold
  passMode:            "not_applicable" | "passed_strict" | "passed_relaxed";
  workationScore:      number; // the property's own workation tag value
}

/** One ranked property in debug format. */
export interface DebugResult {
  rank:          number;
  name:          string;
  location:      string;
  score:         number;
  // Top 3 dimensions by matchScore — "what the user wanted AND the property delivered".
  topMatches:    DebugDimensionSummary[];
  // Dimensions where |gap| > threshold — notable mismatches worth reviewing.
  topMisses:     DebugDimensionSummary[];
  // Full 7-dimension breakdown as an object keyed by dimension name.
  // Easier to read than an array — no mental index lookup needed.
  dimensions:    Record<string, DebugDimension>;
  filterTrace:   DebugFilterTrace;
  lowConfidence: boolean;
  // PM fills this in — leave as null in the generated file.
  pmComment:     string | null;
}

/** Pipeline metadata for one scenario run. */
export interface DebugPipeline {
  totalCandidates:   number;
  hardFilteredCount: number;
  hardFilterRelaxed: boolean; // true when the relaxed workation threshold was used
  poolAfterFilter:   number;
  topScore:          number;
  fallback:          string | null;
  confidence:        "high" | "moderate" | "low";
  confidenceReason:  string;
}

/** Assertion result produced by the runner — included so the PM sees failures alongside results. */
export interface DebugAssertion {
  name:   string;
  pass:   boolean;
  detail: string;
}

/**
 * Root debug output record — one per scenario run.
 *
 * Designed to be written as-is to a .json file and opened by a PM.
 * Fields are ordered from coarse to fine: id → request → pipeline → results.
 */
export interface DebugOutput {
  scenarioId:   string;
  scenarioLabel: string;
  category:     string;
  runAt:        string; // ISO-8601

  request: {
    personaKey:       PersonaKey;
    priority:         StayPriority;
    socialEnergy:     SocialEnergy;
    roomType:         RoomType;
    budget?:          BudgetLevel;
    destinationSlug?: string;
  };

  // Post-override user vector — the exact numbers used for scoring.
  userVector: ScoringVector;

  pipeline: DebugPipeline;

  results: DebugResult[];

  assertions: DebugAssertion[];

  // PM fills these in — null until reviewed.
  pmNote:               string | null;
  overallClassification: "strong" | "acceptable" | "poor" | null;
  issueType:            "none" | "algorithm" | "metadata" | "both" | null;
}

// ─── Serializer ───────────────────────────────────────────────────────────────

function r3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function toDebugResult(ranked: RankedProperty): DebugResult {
  const { property, score, breakdown, explanation, rank, lowConfidence, hardFilterExempted } = ranked;

  // Build the full dimensions object keyed by dim name.
  const dimensions: Record<string, DebugDimension> = {};
  for (const [dim, bd] of Object.entries(breakdown)) {
    const match = explanation.dimensions.find((d) => d.dim === dim);
    dimensions[dim] = {
      userValue:     r3(bd.userValue),
      propertyValue: r3(bd.propertyValue),
      gap:           r3(bd.gap),
      contribution:  r3(bd.contribution),
      matchScore:    r3(match?.matchScore ?? bd.contribution * bd.userValue),
      strength:      match?.strength ?? (bd.gap <= 0.2 ? "strong" : bd.gap <= 0.4 ? "moderate" : "weak"),
    };
  }

  const topMatches: DebugDimensionSummary[] = explanation.topMatches.map((m) => ({
    dim:          m.dim,
    contribution: r3(m.contribution),
    matchScore:   r3(m.matchScore),
    gap:          r3(m.gap),
    strength:     m.strength,
  }));

  const topMisses: DebugDimensionSummary[] = explanation.topMisses.map((m) => ({
    dim:          m.dim,
    contribution: r3(m.contribution),
    matchScore:   r3(m.matchScore),
    gap:          r3(m.gap),
    strength:     m.strength,
  }));

  return {
    rank,
    name:     property.name,
    location: property.location,
    score:    r3(score),
    topMatches,
    topMisses,
    dimensions,
    filterTrace: {
      hardFilterTriggered: explanation.filterTrace.hardFilterTriggered,
      passMode:            explanation.filterTrace.passMode,
      workationScore:      r3(explanation.filterTrace.workationScore),
    },
    lowConfidence,
    pmComment: null,
  };
}

/**
 * Serialize a live RankingPayload + scenario context into a PM-reviewable
 * DebugOutput record. Rounds all floats to 3 decimal places.
 */
export function toDebugOutput(
  scenario:   TestScenario,
  payload:    RankingPayload,
  assertions: DebugAssertion[],
  totalCandidates: number,
): DebugOutput {
  const pipeline: DebugPipeline = {
    totalCandidates,
    hardFilteredCount: payload.hardFilteredCount,
    hardFilterRelaxed: payload.rankingExplanation.relaxedModeUsed,
    poolAfterFilter:   payload.poolSize,
    topScore:          r3(payload.topScore),
    fallback:          payload.fallback,
    confidence:        payload.confidence,
    confidenceReason:  payload.rankingExplanation.confidenceReason,
  };

  return {
    scenarioId:    scenario.id,
    scenarioLabel: scenario.label,
    category:      scenario.category,
    runAt:         new Date().toISOString(),
    request: {
      personaKey:       scenario.request.personaKey,
      priority:         scenario.request.priority,
      socialEnergy:     scenario.request.socialEnergy,
      roomType:         scenario.request.roomType,
      budget:           scenario.request.budget,
      destinationSlug:  scenario.request.destinationSlug,
    },
    userVector:  payload.userVector,
    pipeline,
    results:     payload.results.map(toDebugResult),
    assertions,
    pmNote:               null,
    overallClassification: null,
    issueType:            null,
  };
}
