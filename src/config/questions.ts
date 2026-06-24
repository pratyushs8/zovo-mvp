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

// PersonaQuestion — Q1 only.
// resolveVia: "persona_lookup" signals the engine to call PERSONAS[value].scoring
// to get the full baseline vector. Options carry no scoringOverride.
export interface PersonaQuestionOption {
  value: PersonaKey;
  label: string;
}

export interface PersonaQuestion {
  key: string;
  label: string;
  required: true;
  requestField: "personaKey";
  resolveVia: "persona_lookup";
  options: PersonaQuestionOption[];
}

// OverrideQuestion — Q2–Q5.
// resolveVia: "scoring_override" signals the engine to merge the selected
// option's scoringOverride on top of the persona baseline.
export interface OverrideQuestionOption<T extends string> {
  value: T;
  label: string;
  scoringOverride: Partial<ScoringVector>;
}

export interface OverrideQuestion<T extends string> {
  key: string;
  label: string;
  required: boolean;
  requestField: Exclude<keyof RecommendationRequest, "personaKey" | "sessionId">;
  resolveVia: "scoring_override";
  options: OverrideQuestionOption<T>[];
}

export type IntakeQuestion<T extends string = string> = PersonaQuestion | OverrideQuestion<T>;

// ─── Questions ────────────────────────────────────────────────────────────────

// Q1 — Persona selection.
// Engine reads resolveVia: "persona_lookup" and calls PERSONAS[value].scoring.
const tripType: PersonaQuestion = {
  key: "trip_type",
  label: "What kind of trip is this?",
  required: true,
  requestField: "personaKey",
  resolveVia: "persona_lookup",
  options: [
    { value: "solo_social", label: "Solo social escape" },
    { value: "solo_quiet", label: "Quiet solo reset" },
    { value: "friends_getaway", label: "Friends getaway" },
    { value: "couple_retreat", label: "Couple retreat" },
    { value: "workation", label: "Workation" },
    { value: "budget_backpacker", label: "Budget backpacking" },
  ],
};

// Q2 — Stay priority. Amplifies one dimension from the persona baseline.
const stayPriority: OverrideQuestion<StayPriority> = {
  key: "stay_priority",
  label: "What matters most for this stay?",
  required: true,
  requestField: "priority",
  resolveVia: "scoring_override",
  options: [
    { value: "social_vibe", label: "Social vibe", scoringOverride: { social: 0.9, calm: 0.1 } },
    { value: "calm_quiet", label: "Calm and quiet", scoringOverride: { calm: 0.9, social: 0.1 } },
    { value: "scenic_views", label: "Scenic views", scoringOverride: { scenic: 0.9 } },
    { value: "adventure_access", label: "Adventure access", scoringOverride: { adventure: 0.9 } },
    {
      value: "work_setup",
      label: "Good work setup",
      scoringOverride: { workation: 1.0, calm: 0.8 },
    },
    { value: "best_value", label: "Best value", scoringOverride: { budget_fit: 1.0 } },
  ],
};

// Q3 — Social energy. Key differentiator between solo_social and solo_quiet.
const socialEnergy: OverrideQuestion<SocialEnergy> = {
  key: "social_energy",
  label: "How social do you want to be?",
  required: true,
  requestField: "socialEnergy",
  resolveVia: "scoring_override",
  options: [
    {
      value: "very_social",
      label: "Very social — I'm here to meet people",
      scoringOverride: { social: 1.0, calm: 0.0 },
    },
    {
      value: "balanced",
      label: "Balanced — open to it, not seeking it",
      scoringOverride: { social: 0.5, calm: 0.5 },
    },
    {
      value: "mostly_private",
      label: "Mostly private — I need my own space",
      scoringOverride: { social: 0.1 },
    },
  ],
};

// Q4 — Room type. Directly sets room_type_fit; persona default is ignored.
const roomType: OverrideQuestion<RoomType> = {
  key: "room_type",
  label: "Which room type do you prefer?",
  required: true,
  requestField: "roomType",
  resolveVia: "scoring_override",
  options: [
    { value: "dorm", label: "Dorm — fine with sharing", scoringOverride: { room_type_fit: 0.0 } },
    { value: "private", label: "Private room", scoringOverride: { room_type_fit: 1.0 } },
    { value: "flexible", label: "Either is fine", scoringOverride: { room_type_fit: 0.5 } },
  ],
};

// Q5 — Budget. Optional: persona default for budget_fit applies if skipped.
const budget: OverrideQuestion<BudgetLevel> = {
  key: "budget",
  label: "What's your budget comfort level?",
  required: false,
  requestField: "budget",
  resolveVia: "scoring_override",
  options: [
    { value: "lowest", label: "Lowest price possible", scoringOverride: { budget_fit: 1.0 } },
    { value: "moderate", label: "Moderate — value matters", scoringOverride: { budget_fit: 0.5 } },
    {
      value: "flexible",
      label: "Flexible if the stay feels right",
      scoringOverride: { budget_fit: 0.0 },
    },
  ],
};

// ─── Exports ──────────────────────────────────────────────────────────────────

export const QUESTIONS = [tripType, stayPriority, socialEnergy, roomType, budget] as const;
