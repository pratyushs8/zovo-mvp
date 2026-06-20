import type {
  PersonaKey,
  StayPriority,
  SocialEnergy,
  RoomType,
  BudgetLevel,
  ScoringVector,
} from "@/types";
import type { RecommendationRequest } from "@/services/recommendation";

// ─── Types ────────────────────────────────────────────────────────────────────

// scoringOverride: dimensions this answer directly sets on the user vector.
// Partial — only the dimensions the answer affects are listed.
// Day 4 scoring merges these overrides on top of the persona baseline.
export interface QuestionOption<T extends string> {
  value: T;
  label: string;
  scoringOverride: Partial<ScoringVector>;
}

export interface IntakeQuestion<T extends string> {
  key: string;
  label: string;
  required: boolean;
  // Which field in RecommendationRequest this answer populates.
  requestField: keyof RecommendationRequest;
  options: QuestionOption<T>[];
}

// ─── Questions ────────────────────────────────────────────────────────────────

// Q1 — Persona selection.
// Sets the full baseline scoring vector via PERSONAS[value].scoring.
// scoringOverride is empty here — the engine does a persona lookup instead.
const tripType: IntakeQuestion<PersonaKey> = {
  key: "trip_type",
  label: "What kind of trip is this?",
  required: true,
  requestField: "personaKey",
  options: [
    { value: "solo_social",       label: "Solo social escape",  scoringOverride: {} },
    { value: "solo_quiet",        label: "Quiet solo reset",    scoringOverride: {} },
    { value: "friends_getaway",   label: "Friends getaway",     scoringOverride: {} },
    { value: "couple_retreat",    label: "Couple retreat",      scoringOverride: {} },
    { value: "workation",         label: "Workation",           scoringOverride: {} },
    { value: "budget_backpacker", label: "Budget backpacking",  scoringOverride: {} },
  ],
};

// Q2 — Stay priority.
// Amplifies one dimension from the persona baseline.
const stayPriority: IntakeQuestion<StayPriority> = {
  key: "stay_priority",
  label: "What matters most for this stay?",
  required: true,
  requestField: "priority",
  options: [
    { value: "social_vibe",      label: "Social vibe",       scoringOverride: { social: 0.9, calm: 0.1 } },
    { value: "calm_quiet",       label: "Calm and quiet",    scoringOverride: { calm: 0.9, social: 0.1 } },
    { value: "scenic_views",     label: "Scenic views",      scoringOverride: { scenic: 0.9 } },
    { value: "adventure_access", label: "Adventure access",  scoringOverride: { adventure: 0.9 } },
    { value: "work_setup",       label: "Good work setup",   scoringOverride: { workation: 1.0, calm: 0.8 } },
    { value: "best_value",       label: "Best value",        scoringOverride: { budget_fit: 1.0 } },
  ],
};

// Q3 — Social energy.
// Primary signal for social vs. calm. Key differentiator between solo_social and solo_quiet.
const socialEnergy: IntakeQuestion<SocialEnergy> = {
  key: "social_energy",
  label: "How social do you want to be?",
  required: true,
  requestField: "socialEnergy",
  options: [
    { value: "very_social",    label: "Very social — I'm here to meet people", scoringOverride: { social: 1.0, calm: 0.0 } },
    { value: "balanced",       label: "Balanced — open to it, not seeking it", scoringOverride: { social: 0.5, calm: 0.5 } },
    { value: "mostly_private", label: "Mostly private — I need my own space",  scoringOverride: { social: 0.1, calm: 0.9 } },
  ],
};

// Q4 — Room type.
// Direct and complete override of room_type_fit. Persona default is ignored.
const roomType: IntakeQuestion<RoomType> = {
  key: "room_type",
  label: "Which room type do you prefer?",
  required: true,
  requestField: "roomType",
  options: [
    { value: "dorm",     label: "Dorm — fine with sharing", scoringOverride: { room_type_fit: 0.0 } },
    { value: "private",  label: "Private room",             scoringOverride: { room_type_fit: 1.0 } },
    { value: "flexible", label: "Either is fine",           scoringOverride: { room_type_fit: 0.5 } },
  ],
};

// Q5 — Budget. Optional: if absent, the persona default for budget_fit holds.
const budget: IntakeQuestion<BudgetLevel> = {
  key: "budget",
  label: "What's your budget comfort level?",
  required: false,
  requestField: "budget",
  options: [
    { value: "lowest",   label: "Lowest price possible",         scoringOverride: { budget_fit: 1.0 } },
    { value: "moderate", label: "Moderate — value matters",      scoringOverride: { budget_fit: 0.5 } },
    { value: "flexible", label: "Flexible if the stay feels right", scoringOverride: { budget_fit: 0.0 } },
  ],
};

// ─── Exports ──────────────────────────────────────────────────────────────────

// Ordered intake sequence. Render in this order.
export const QUESTIONS = [tripType, stayPriority, socialEnergy, roomType, budget] as const;

export const REQUIRED_QUESTIONS = QUESTIONS.filter((q) => q.required);
export const OPTIONAL_QUESTIONS = QUESTIONS.filter((q) => !q.required);
