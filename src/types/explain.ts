// Explanation contract for the /api/explain endpoint (Day 9).
//
// This file defines three distinct layers:
//
//   PromptCard     — internal prompt data only. Server-side, never sent to the client.
//                    Contains grounded facts from the ranking engine used to build
//                    the model prompt. Nothing here is invented or inferred.
//
//   ExplainedCard  — UI-facing output. Returned to the client. Contains copy text only,
//                    no scores, no dimension keys, no model internals.
//
//   Explain*       — Request and response envelopes for POST /api/explain.
//
// The separation ensures the model only receives facts already present in the
// ranking output, and the client only receives text it can render.

import type { ScoringVector } from "@/types";
import type { DimensionKey } from "@/config/scoring";
import type { MatchStrength } from "@/types/ranking";
import type { StayCard, StayDebug } from "@/types/api";

// ─── Prompt layer (server-only) ───────────────────────────────────────────────

// A single dimension fact passed to the model for one card.
// All values come directly from PropertyExplanation / ScoringBreakdown —
// nothing is inferred or paraphrased before it reaches the prompt builder.
export interface PromptDimensionFact {
  dim: DimensionKey; // e.g. "social"
  label: string; // human label from DIMENSIONS config, e.g. "Social"
  userValue: number; // U[d] from the scoring vector, 0–1
  propertyValue: number; // P[d] from the property's scoring config, 0–1
  gap: number; // |U[d] − P[d]|
  strength: MatchStrength; // "strong" | "moderate" | "weak"
  direction: "up" | "down"; // up = match, down = miss
}

// The complete grounded context passed to the model for one card.
// Built by buildExplainPrompt() from StayCard + StayDebug + ScoringVector.
// Never leaves the server.
export interface PromptCard {
  // Identity — used in the prompt header to orient the model.
  propertyId: number;
  title: string; // e.g. "Zostel Manali"
  location: string; // e.g. "Old Manali, Manali"

  // Scoring context — included so the model can frame confidence correctly.
  score: number; // 0–1 normalised rank score
  lowConfidence: boolean;

  // The reason chips that will appear on the card — the model writes sentences
  // only for these labels. It cannot add or remove chips.
  targetReasons: Array<{
    label: string; // must match a PromptDimensionFact.label exactly
    direction: "up" | "down";
  }>;

  // Grounded dimension facts available to write from.
  // Includes all targetReason dimensions plus supporting context dimensions.
  facts: PromptDimensionFact[];
}

// ─── Output layer (UI-facing) ─────────────────────────────────────────────────

// Explanation copy for a single card, as returned by the model or fallback.
// Contains ONLY copy text — no chip metadata, no scores, no ranking data.
//
// The client merges this into a StayCard by:
//   1. Replacing card.summary with cardSummary.
//   2. Adding sentences[chip.label] to each chip in card.reasons.
//
// Chip labels, directions, and strengths always come from the ranking layer
// (StayCard.reasons). ExplainedCard cannot modify or invent chips.
export interface ExplainedCard {
  // Matches StayCard.id so the client can index into the existing cards array.
  id: number;

  // Replaces StayCard.summary on the rendered card.
  // One sentence grounded in the card's top match dimension.
  // Max ~120 characters. Must not mention price, availability, or ratings.
  cardSummary: string;

  // One sentence per reason chip, keyed by the chip's label.
  // Keys must be a subset of the originating StayCard.reasons[].label values.
  // The explanation layer cannot add, remove, or relabel chips.
  sentences: Record<string, string>;

  // Indicates whether this card's copy came from the model or the deterministic
  // fallback. Used by ResultsDebugPanel; never shown to the user.
  explanationSource: "model" | "fallback";
}

// ─── Request envelope ─────────────────────────────────────────────────────────

// Sent from the client to POST /api/explain after /api/recommend resolves.
// Contains only what was already returned by /api/recommend — no extra DB reads.
export interface ExplainRequest {
  // The shortlisted cards from the /api/recommend response.
  // Used by the server to align output (id, reasons) without re-fetching.
  cards: StayCard[];

  // The _debug block from the /api/recommend response.
  // Provides userVector and per-card explanation metadata for prompt building.
  debug: {
    userVector: ScoringVector;
    cards: StayDebug[]; // parallel to cards[] by id
  };
}

// ─── Response envelope ────────────────────────────────────────────────────────

export interface ExplainResponse {
  // One ExplainedCard per input card, in the same order.
  // Always present — model failures produce fallback copy, not missing entries.
  cards: ExplainedCard[];
}

// ─── Error ────────────────────────────────────────────────────────────────────

export interface ExplainErrorResponse {
  error: string;
}

// ─── Model output shape (parsed from raw model response) ─────────────────────

// What the model is instructed to return as JSON for each card.
// Validated by the explanation service before being promoted to ExplainedCard.
// If validation fails, the card falls back to deterministic copy.
export interface ModelCardOutput {
  cardSummary: string;
  reasons: Array<{
    label: string; // must match one of PromptCard.targetReasons[].label
    sentence: string; // one plain-English sentence for this chip
  }>;
}
