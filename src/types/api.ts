// Client-safe API contract types for the /api/recommend endpoint.
//
// This file has no server-only imports (no DB, no env.ts) so it is safe to
// import from both server components/routes and client components.
// Day 8 frontend code should import types from here, not from
// @/services/recommendation which carries server-side runtime dependencies.

import type { PersonaKey, StayPriority, SocialEnergy, RoomType, BudgetLevel } from "@/types";
import type {
  ScoringBreakdown,
  ConfidenceLevel,
  FallbackMode,
  PropertyExplanation,
  RankingExplanation,
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

// ─── Response ─────────────────────────────────────────────────────────────────

// A single ranked property in the response. score and breakdown are included
// for the Day 6 debug panel; the production UI can ignore them.
export interface StayResult {
  id: number;
  name: string;
  location: string;
  bookingUrl: string;
  rank: number;
  score: number; // 0.0–1.0
  breakdown: ScoringBreakdown;
  hardFilterExempted: boolean;
  lowConfidence: boolean;
  explanation: PropertyExplanation;
}

// Top-level response envelope from POST /api/recommend.
export interface RecommendationResponse {
  results: StayResult[];
  confidence: ConfidenceLevel;
  fallback: FallbackMode;
  hardFilteredCount: number;
  poolSize: number;
  rankingExplanation: RankingExplanation;
}

// ─── Error ────────────────────────────────────────────────────────────────────

export interface RecommendationErrorResponse {
  error: string; // machine-readable error key
  detail?: Record<string, unknown>; // validation field errors when error === "validation_failed"
}
