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

  diagnostics: DebugDiagnostics;

  // PM fills these in — null until reviewed.
  pmNote:               string | null;
  overallClassification: "strong" | "acceptable" | "poor" | null;
  issueType:            "none" | "algorithm" | "metadata" | "both" | null;
}

// ─── Diagnostics schema ───────────────────────────────────────────────────────

/**
 * One of four root causes for a weak or surprising ranking result.
 * "none" means no signals were triggered — the result looks healthy.
 */
export type DiagnosticCause =
  | "weight_logic"  // score spread is too flat; ranking order is fragile
  | "hard_filter"   // filter is too aggressive or needed the relaxed fallback
  | "metadata"      // property dimension values look miscalibrated for this user
  | "coverage"      // pool is too small or all top results are the same archetype
  | "none";

export interface WeightLogicDiagnostic {
  scoreSpread:          number;  // topScore − last result score
  minGapBetweenResults: number;  // smallest adjacent-score gap in the top results
  spreadFlat:           boolean; // spread < 0.04 with ≥ 3 results
  note:                 string;
}

export interface HardFilterDiagnostic {
  triggered:        boolean;
  filteredCount:    number;
  filteredFraction: number;  // filteredCount / (poolSize + filteredCount)
  relaxedModeUsed:  boolean;
  tooAggressive:    boolean; // filteredFraction > 0.40 AND confidence !== "high"
  note:             string;
}

export interface MetadataSuspect {
  resultRank:    number;
  propertyName:  string;
  dim:           string;
  userValue:     number; // what the user wants
  propertyValue: number; // what the property has
  gap:           number;
  // Human-readable action hint — what a PM should verify in properties.json.
  note:          string;
}

export interface MetadataDiagnostic {
  suspects: MetadataSuspect[]; // gaps ≥ 0.40 on dimensions the user values ≥ 0.60
  note:     string;
}

export interface CoverageDiagnostic {
  poolSize:         number;
  thinPool:         boolean; // poolSize < 10
  lowScoreCeiling:  boolean; // topScore < 0.65 with poolSize ≥ 10 (no good match exists)
  archetypeCount:   number;  // distinct archetypes in top results
  archetypes:       string[];
  homogeneous:      boolean; // archetypeCount === 1 AND topScore < 0.72 AND poolSize ≥ 5
  note:             string;
}

export interface DebugDiagnostics {
  // Ordered list of triggered causes. ["none"] when everything looks healthy.
  causes:      DiagnosticCause[];
  weightLogic: WeightLogicDiagnostic;
  hardFilter:  HardFilterDiagnostic;
  metadata:    MetadataDiagnostic;
  coverage:    CoverageDiagnostic;
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

// ─── Diagnostic thresholds ────────────────────────────────────────────────────
// Centralised so they're easy to adjust during Day 6 validation.

const SPREAD_FLAT_THRESHOLD        = 0.04;  // top results span < 4 pts — ranking is fragile
const FILTER_AGGRESSIVE_FRACTION   = 0.40;  // > 40% removed AND not high confidence
const METADATA_SUSPECT_USER_VALUE  = 0.60;  // user must care about a dim to flag it
const METADATA_SUSPECT_GAP         = 0.40;  // gap must be at least "moderate+weak" to flag
const THIN_POOL_THRESHOLD          = 10;    // fewer than 10 survivors = coverage problem
const LOW_SCORE_CEILING            = 0.65;  // top score < 0.65 with a full pool = no good match
const HOMOGENEOUS_SCORE_CAP        = 0.72;  // homogeneous is only a concern if top score < this

function computeDiagnostics(payload: RankingPayload): DebugDiagnostics {
  const results = payload.results;

  // ── Weight logic ──────────────────────────────────────────────────────────
  const scores = results.map((r) => r.score);
  const scoreSpread = scores.length > 1 ? r3(scores[0] - scores[scores.length - 1]) : 0;
  const minGap = scores.length > 1
    ? r3(Math.min(...scores.slice(1).map((s, i) => scores[i] - s)))
    : 0;
  // Suppress flat-spread signal on thin pools — compressed spread is expected there.
  const thinPool = payload.poolSize < THIN_POOL_THRESHOLD;
  const spreadFlat = !thinPool && scores.length >= 3 && scoreSpread < SPREAD_FLAT_THRESHOLD;

  const weightLogic: WeightLogicDiagnostic = {
    scoreSpread,
    minGapBetweenResults: minGap,
    spreadFlat,
    note: spreadFlat
      ? `Top ${results.length} results span only ${(scoreSpread * 100).toFixed(1)} pts — small weight changes could reshuffle rankings. Identify which dimension(s) are pulling multiple properties to the same score.`
      : `Score spread of ${(scoreSpread * 100).toFixed(1)} pts across ${results.length} results. Ranking order looks stable.`,
  };

  // ── Hard filter ───────────────────────────────────────────────────────────
  const totalInPool = payload.poolSize + payload.hardFilteredCount;
  const filteredFraction = totalInPool > 0 ? r3(payload.hardFilteredCount / totalInPool) : 0;
  const relaxedModeUsed  = payload.rankingExplanation.relaxedModeUsed;
  const tooAggressive    = payload.rankingExplanation.hardFilterTriggered
    && filteredFraction > FILTER_AGGRESSIVE_FRACTION
    && payload.confidence !== "high";

  const hardFilter: HardFilterDiagnostic = {
    triggered:        payload.rankingExplanation.hardFilterTriggered,
    filteredCount:    payload.hardFilteredCount,
    filteredFraction,
    relaxedModeUsed,
    tooAggressive,
    note: !payload.rankingExplanation.hardFilterTriggered
      ? "Workation hard filter not active for this request."
      : relaxedModeUsed
      ? "Strict filter found no survivors — relaxed threshold was used. Check workation tagging for destination properties; they may be under-tagged."
      : tooAggressive
      ? `Filter removed ${(filteredFraction * 100).toFixed(0)}% of pool with only ${payload.confidence} confidence. Consider whether WORKATION_PROP_STRICT (${0.2}) is too high for this destination.`
      : `Filter removed ${(filteredFraction * 100).toFixed(0)}% of pool — within expected range.`,
  };

  // ── Metadata ──────────────────────────────────────────────────────────────
  // Flag gaps on dimensions the user actually cares about (userValue ≥ 0.60).
  // A large gap on a high-user-value dimension means the property doesn't deliver
  // what the user wanted — this may be a correct match (property is genuinely weak
  // on that dim) or a tagging error. PM should verify in properties.json.
  const suspects: MetadataSuspect[] = [];
  for (const r of results.slice(0, 3)) {
    for (const [dim, bd] of Object.entries(r.breakdown)) {
      if (bd.userValue >= METADATA_SUSPECT_USER_VALUE && bd.gap >= METADATA_SUSPECT_GAP) {
        suspects.push({
          resultRank:    r.rank,
          propertyName:  r.property.name,
          dim,
          userValue:     r3(bd.userValue),
          propertyValue: r3(bd.propertyValue),
          gap:           r3(bd.gap),
          note:          `#${r.rank} ${r.property.name.replace("Zostel ", "")} has ${dim}=${bd.propertyValue.toFixed(2)} but user wants ${bd.userValue.toFixed(2)} (gap ${bd.gap.toFixed(2)}) — verify tag in properties.json`,
        });
      }
    }
  }

  const metadata: MetadataDiagnostic = {
    suspects,
    note: suspects.length === 0
      ? "No dimension mismatches in top 3 results on dimensions the user cares about."
      : `${suspects.length} suspect gap${suspects.length > 1 ? "s" : ""} in top 3 results. These may be correct (property genuinely weak on that dim) or tagging errors — verify in properties.json.`,
  };

  // ── Coverage ──────────────────────────────────────────────────────────────
  const lowScoreCeiling = payload.topScore < LOW_SCORE_CEILING && !thinPool && !relaxedModeUsed;
  const archetypes = [...new Set(results.map((r) => r.property.archetype as string))];
  const homogeneous = archetypes.length === 1
    && payload.topScore < HOMOGENEOUS_SCORE_CAP
    && payload.poolSize >= 5;

  const coverage: CoverageDiagnostic = {
    poolSize: payload.poolSize,
    thinPool,
    lowScoreCeiling,
    archetypeCount: archetypes.length,
    archetypes,
    homogeneous,
    note: thinPool
      ? `Pool has only ${payload.poolSize} propert${payload.poolSize === 1 ? "y" : "ies"} after filtering — results reflect coverage limits, not ranking quality. Add more properties for this destination.`
      : lowScoreCeiling
      ? `Best score is ${payload.topScore.toFixed(3)} with ${payload.poolSize} candidates — no existing property closely matches this persona. New property types needed.`
      : homogeneous
      ? `All top results share archetype "${archetypes[0]}" with a moderate top score — the engine found only one type of property. More diverse properties could improve results.`
      : `${payload.poolSize} properties, ${archetypes.length} distinct archetype${archetypes.length > 1 ? "s" : ""} in top results.`,
  };

  // ── Root cause summary ────────────────────────────────────────────────────
  const causes: DiagnosticCause[] = [];
  if (spreadFlat)                                          causes.push("weight_logic");
  if (tooAggressive || relaxedModeUsed)                   causes.push("hard_filter");
  if (suspects.length > 0)                                causes.push("metadata");
  if (thinPool || lowScoreCeiling || homogeneous)         causes.push("coverage");
  if (causes.length === 0)                                causes.push("none");

  return { causes, weightLogic, hardFilter, metadata, coverage };
}

/**
 * Serialize a live RankingPayload + scenario context into a PM-reviewable
 * DebugOutput record. Rounds all floats to 3 decimal places.
 */
export function toDebugOutput(
  scenario:        TestScenario,
  payload:         RankingPayload,
  assertions:      DebugAssertion[],
  totalCandidates: number, // total property count before destination pre-filter
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
    userVector:   payload.userVector,
    pipeline,
    results:      payload.results.map(toDebugResult),
    assertions,
    diagnostics:  computeDiagnostics(payload),
    pmNote:               null,
    overallClassification: null,
    issueType:            null,
  };
}
