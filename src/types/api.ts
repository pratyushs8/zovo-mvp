// Client-safe API contract types for the /api/recommend endpoint.
//
// This file has no server-only imports (no DB, no env.ts) so it is safe to
// import from both server components/routes and client components.
// Frontend code should import types from here, not from
// @/services/recommendation which carries server-side runtime dependencies.

import type { PersonaKey, StayPriority, SocialEnergy, RoomType, BudgetLevel } from "@/types";
import type {
  ScoringBreakdown,
  ConfidenceLevel,
  FallbackMode,
  PropertyExplanation,
  RankingExplanation,
  MatchStrength,
} from "@/types/ranking";

// ─── Request ──────────────────────────────────────────────────────────────────

export interface RecommendationRequest {
  sessionId: string;
  personaKey: PersonaKey;
  priority: StayPriority;
  socialEnergy: SocialEnergy;
  roomType: RoomType;
  budget?: BudgetLevel;
}

// ─── Response — UI-facing fields ─────────────────────────────────────────────

// Pre-computed reason chip for a single card. The `label` is the human name of
// the top-matching scoring dimension; `strength` is its match quality.
// Day 9 adds a `sentence` field here for the full explanation layer.
export interface CardReason {
  label: string; // e.g. "Social vibe", "Scenic", "Budget fit"
  strength: MatchStrength; // "strong" | "moderate" | "weak"
}

// UI-facing projection of a ranked property. Contains exactly what a
// ShortlistCard component needs — no dimension keys, no raw scores.
export interface StayCard {
  id: number;
  rank: number;
  title: string; // property display name
  location: string; // area within destination
  summary: string; // 1–2 sentence property blurb
  reason: CardReason; // top match reason chip
  lowConfidence: boolean;
  bookingUrl: string;
}

// Contextual banner metadata. bannerMessage is null when confidence is high
// and fallback is null — the UI renders no banner in that case.
export interface ShortlistMeta {
  confidence: ConfidenceLevel;
  fallback: FallbackMode;
  bannerMessage: string | null;
  totalFiltered: number;
  poolSize: number;
}

// Debug data quarantined from UI-facing fields. Populated server-side;
// the UI ignores this block — it exists for Day 9 / admin tooling.
export interface StayDebug {
  id: number;
  score: number;
  breakdown: ScoringBreakdown;
  hardFilterExempted: boolean;
  explanation: PropertyExplanation;
}

// ─── Response envelope ────────────────────────────────────────────────────────

export interface RecommendationResponse {
  cards: StayCard[]; // 0–5 items; empty when fallback === "empty"
  meta: ShortlistMeta;
  _debug: {
    rankingExplanation: RankingExplanation;
    cards: StayDebug[];
  };
}

// ─── Error ────────────────────────────────────────────────────────────────────

export interface RecommendationErrorResponse {
  error: string;
  detail?: Record<string, unknown>;
}
