// Server-side explanation service.
//
// Responsibility: build PromptCards from ranking data, call the OpenAI
// Responses API once for all cards, validate and sanitize per-card output,
// and fall back to deterministic copy for any card that fails.
//
// The OpenAI client lives in openaiClient.ts — this file is pure business logic
// and can be tested without a live API key.

import type { StayCard, StayDebug } from "@/types/api";
import type { ScoringVector } from "@/types";
import type {
  PromptCard,
  PromptDimensionFact,
  ExplainedCard,
  ModelCardOutput,
} from "@/types/explain";
import type { DimensionKey } from "@/config/scoring";
import { DIMENSIONS, DIMENSION_KEYS } from "@/config/scoring";
import { classifyStrength } from "@/lib/generateExplanation";
import { EXPLAIN_SYSTEM_PROMPT, buildExplainUserMessage } from "@/lib/buildExplainPrompt";
import { buildFallbackCard } from "@/lib/deterministicCopy";
import { getOpenAIClient, EXPLAIN_MODEL, EXPLAIN_TIMEOUT_MS } from "@/lib/openaiClient";
import { sanitizeAndValidate } from "@/lib/validateExplanationText";
import { logExplainFailure, logExplainBatch, type ExplainFailure } from "@/lib/explainLogger";

// ─── Build PromptCard ─────────────────────────────────────────────────────────
//
// Assembles the grounded context sent to the model for one card.
//
// Direction is resolved in priority order:
//   1. The chip's direction from card.reasons — source of truth, already
//      produced by the Day 8 pipeline from topMatches / topMisses.
//   2. Whether the dimension appears in debug.explanation.topMatches ("up")
//      or topMisses ("down").
//   3. Gap threshold fallback (gap ≤ 0.3 → "up") for non-chip dimensions.
//
// Strength is taken from debug.explanation.dimensions — pre-classified by
// classifyStrength() using the ranking config thresholds, not hardcoded here.

function buildPromptCard(card: StayCard, debug: StayDebug, userVector: ScoringVector): PromptCard {
  // Build lookup structures from Day 8 output.
  const chipDirectionByLabel = new Map(card.reasons.map((r) => [r.label, r.direction]));
  const topMatchDims = new Set<DimensionKey>(debug.explanation.topMatches.map((m) => m.dim));
  const topMissDims = new Set<DimensionKey>(debug.explanation.topMisses.map((m) => m.dim));
  const strengthByDim = new Map(debug.explanation.dimensions.map((d) => [d.dim, d.strength]));

  const facts: PromptDimensionFact[] = DIMENSION_KEYS.map((dim) => {
    const bd = debug.breakdown[dim];
    const label = DIMENSIONS[dim].label;

    // Resolve direction: chip → Day 8 classification → gap threshold
    let direction: "up" | "down";
    const chipDir = chipDirectionByLabel.get(label);
    if (chipDir !== undefined) {
      direction = chipDir;
    } else if (topMatchDims.has(dim)) {
      direction = "up";
    } else if (topMissDims.has(dim)) {
      direction = "down";
    } else {
      direction = bd.gap <= 0.3 ? "up" : "down";
    }

    return {
      dim,
      label,
      userValue: userVector[dim],
      propertyValue: bd.propertyValue,
      gap: bd.gap,
      // Use the pre-classified strength from the ranking pipeline, not a
      // local threshold, so facts agree with what the chips already show.
      strength: strengthByDim.get(dim) ?? classifyStrength(bd.gap),
      direction,
    };
  });

  return {
    propertyId: card.id,
    title: card.title,
    location: card.location,
    score: debug.score,
    lowConfidence: card.lowConfidence,
    targetReasons: card.reasons.map((r) => ({ label: r.label, direction: r.direction })),
    facts,
  };
}

// ─── Validate + sanitize one model card ──────────────────────────────────────
//
// Structural checks (shape, label membership, coverage) run first.
// Text-level checks (length, banned phrases, overconfidence) run per field
// via sanitizeAndValidate — a single field failure rejects the whole card.
//
// Returns null — and the caller falls back — on any of:
//   • wrong shape (missing fields, wrong types)
//   • any reason label not in the card's targetReasons
//   • fewer reason entries than targetReasons (incomplete coverage)
//   • cardSummary or any sentence that fails text validation

function validateModelCard(
  raw: unknown,
  card: PromptCard,
  failures: ExplainFailure[]
): ModelCardOutput | null {
  if (typeof raw !== "object" || raw === null) return null;
  const obj = raw as Record<string, unknown>;

  if (typeof obj.cardSummary !== "string") return null;

  const summaryOpts = { maxLength: 300, lowConfidence: card.lowConfidence };
  const sentenceOpts = { maxLength: 100, lowConfidence: card.lowConfidence };

  const summaryResult = sanitizeAndValidate(obj.cardSummary, summaryOpts);
  if (!summaryResult.ok) {
    const failure: ExplainFailure = {
      category: "validation",
      cardId: card.propertyId,
      detail: `cardSummary: ${summaryResult.reason}`,
    };
    failures.push(failure);
    logExplainFailure(failure);
    return null;
  }

  if (!Array.isArray(obj.reasons)) return null;

  const expectedLabels = new Set(card.targetReasons.map((r) => r.label));
  const seenLabels = new Set<string>();
  const reasons: ModelCardOutput["reasons"] = [];

  for (const r of obj.reasons) {
    if (typeof r !== "object" || r === null) return null;
    const { label, sentence } = r as Record<string, unknown>;
    if (typeof label !== "string" || typeof sentence !== "string") return null;
    // Reject any label the model invented — it cannot add chips.
    if (!expectedLabels.has(label)) return null;
    // Reject duplicate labels — model must supply each chip exactly once.
    if (seenLabels.has(label)) return null;
    seenLabels.add(label);

    const sentenceResult = sanitizeAndValidate(sentence, sentenceOpts);
    if (!sentenceResult.ok) {
      const failure: ExplainFailure = {
        category: "validation",
        cardId: card.propertyId,
        detail: `sentence[${label}]: ${sentenceResult.reason}`,
      };
      failures.push(failure);
      logExplainFailure(failure);
      return null;
    }

    reasons.push({ label, sentence: sentenceResult.text });
  }

  // All target chips must have a sentence — reject partial coverage.
  const coveredLabels = new Set(reasons.map((r) => r.label));
  for (const l of expectedLabels) {
    if (!coveredLabels.has(l)) return null;
  }

  return { cardSummary: summaryResult.text, reasons };
}

// ─── Promote validated output → ExplainedCard ────────────────────────────────

function promoteToExplained(card: StayCard, model: ModelCardOutput): ExplainedCard {
  return {
    id: card.id,
    cardSummary: model.cardSummary,
    sentences: Object.fromEntries(model.reasons.map((r) => [r.label, r.sentence])),
    explanationSource: "model",
  };
}

// ─── Transport ────────────────────────────────────────────────────────────────
//
// One Responses API call covers all cards.
// Returns { text, durationMs } on success, or { text: null, category, durationMs }
// on any transport / API error — caller falls back for all cards.

type APIResult =
  | { text: string; durationMs: number }
  | { text: null; category: "api_timeout" | "api_error"; detail: string; durationMs: number };

async function callResponsesAPI(promptCards: PromptCard[]): Promise<APIResult> {
  const t0 = Date.now();
  try {
    const response = await getOpenAIClient().responses.create(
      {
        model: EXPLAIN_MODEL,
        instructions: EXPLAIN_SYSTEM_PROMPT,
        input: buildExplainUserMessage(promptCards),
        text: { format: { type: "json_object" } },
        max_output_tokens: 2048,
      },
      { timeout: EXPLAIN_TIMEOUT_MS }
    );
    const text = response.output_text ?? null;
    if (text === null) {
      return {
        text: null,
        category: "api_error",
        detail: "empty output_text",
        durationMs: Date.now() - t0,
      };
    }
    return { text, durationMs: Date.now() - t0 };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isTimeout = /timeout|timed out|ETIMEDOUT/i.test(msg);
    return {
      text: null,
      category: isTimeout ? "api_timeout" : "api_error",
      detail: msg,
      durationMs: Date.now() - t0,
    };
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function generateExplanations(
  cards: StayCard[],
  debugCards: StayDebug[],
  userVector: ScoringVector
): Promise<ExplainedCard[]> {
  const t0 = Date.now();
  const failures: ExplainFailure[] = [];

  // Build a PromptCard for every card.
  // Missing debug data is treated as a per-card fallback rather than a hard
  // throw — a stale or truncated _debug payload should not 500 the whole batch.
  const debugById = new Map(debugCards.map((d) => [d.id, d]));
  const promptCardResults = cards.map((card) => {
    const debug = debugById.get(card.id);
    if (!debug) {
      const failure: ExplainFailure = {
        category: "missing_card",
        cardId: card.id,
        detail: "no debug data — cannot build prompt",
      };
      failures.push(failure);
      logExplainFailure(failure);
      return null;
    }
    return buildPromptCard(card, debug, userVector);
  });

  // If every card is missing debug data there is nothing to send to the model.
  const promptCards = promptCardResults.filter((p): p is NonNullable<typeof p> => p !== null);
  if (promptCards.length === 0) {
    logExplainBatch({
      total: cards.length,
      model: 0,
      fallback: cards.length,
      durationMs: Date.now() - t0,
      failures,
    });
    // Return deterministic fallback for every card using a minimal PromptCard.
    return cards.map((card) =>
      buildFallbackCard({
        propertyId: card.id,
        title: card.title,
        location: card.location,
        score: 0,
        lowConfidence: card.lowConfidence,
        targetReasons: card.reasons.map((r) => ({ label: r.label, direction: r.direction })),
        facts: [],
      })
    );
  }

  // Transport: one call covers all cards. failure → full-batch fallback.
  const apiResult = await callResponsesAPI(promptCards);
  if (apiResult.text === null) {
    const failure: ExplainFailure = { category: apiResult.category, detail: apiResult.detail };
    failures.push(failure);
    logExplainFailure(failure);
    logExplainBatch({
      total: cards.length,
      model: 0,
      fallback: cards.length,
      durationMs: apiResult.durationMs,
      failures,
    });
    return cards.map((card, i) =>
      buildFallbackCard(
        promptCardResults[i] ?? {
          propertyId: card.id,
          title: card.title,
          location: card.location,
          score: 0,
          lowConfidence: card.lowConfidence,
          targetReasons: card.reasons.map((r) => ({ label: r.label, direction: r.direction })),
          facts: [],
        }
      )
    );
  }

  // Parse the JSON envelope. On failure, retry once — transient truncations
  // or whitespace-padded responses can produce valid JSON on a second attempt.
  let parsed: { cards?: unknown[] } | null = null;
  const parseAttempt = (text: string) => {
    try {
      return JSON.parse(text) as { cards?: unknown[] };
    } catch {
      return null;
    }
  };

  parsed = parseAttempt(apiResult.text);
  if (parsed === null) {
    const retryResult = await callResponsesAPI(promptCards);
    if (retryResult.text !== null) parsed = parseAttempt(retryResult.text);
  }

  if (parsed === null) {
    const failure: ExplainFailure = { category: "json_parse" };
    failures.push(failure);
    logExplainFailure(failure);
    logExplainBatch({
      total: cards.length,
      model: 0,
      fallback: cards.length,
      durationMs: Date.now() - t0,
      failures,
    });
    return cards.map((card, i) =>
      buildFallbackCard(
        promptCardResults[i] ?? {
          propertyId: card.id,
          title: card.title,
          location: card.location,
          score: 0,
          lowConfidence: card.lowConfidence,
          targetReasons: card.reasons.map((r) => ({ label: r.label, direction: r.direction })),
          facts: [],
        }
      )
    );
  }

  const modelCards: unknown[] = Array.isArray(parsed?.cards) ? parsed.cards : [];

  // Per-card: validate + sanitize, then promote or fall back.
  // promptCardResults[i] is aligned with cards[i] by construction; null entries
  // are cards that had no debug data and already have a failure recorded.
  const results = cards.map((card, i) => {
    const promptCard = promptCardResults[i];

    // No debug data — build a minimal fallback directly from the StayCard.
    if (promptCard === null) {
      return buildFallbackCard({
        propertyId: card.id,
        title: card.title,
        location: card.location,
        score: 0,
        lowConfidence: card.lowConfidence,
        targetReasons: card.reasons.map((r) => ({ label: r.label, direction: r.direction })),
        facts: [],
      });
    }

    const rawCard = modelCards.find(
      (c) => typeof c === "object" && c !== null && (c as Record<string, unknown>).id === card.id
    );

    if (!rawCard) {
      const failure: ExplainFailure = { category: "missing_card", cardId: card.id };
      failures.push(failure);
      logExplainFailure(failure);
      return buildFallbackCard(promptCard);
    }

    const validated = validateModelCard(rawCard, promptCard, failures);
    if (!validated) return buildFallbackCard(promptCard);
    return promoteToExplained(card, validated);
  });

  const modelCount = results.filter((r) => r.explanationSource === "model").length;
  logExplainBatch({
    total: cards.length,
    model: modelCount,
    fallback: cards.length - modelCount,
    durationMs: Date.now() - t0,
    failures,
  });

  return results;
}
