// ─── Persona ──────────────────────────────────────────────────────────────────

export type PersonaKey =
  | "solo_social"
  | "solo_quiet"
  | "friends_getaway"
  | "couple_retreat"
  | "workation"
  | "budget_backpacker";

// ─── Scoring ──────────────────────────────────────────────────────────────────

// Each dimension is a float 0.0–1.0.
// Higher always means "more of that quality", never "better".
// Users and properties both carry a ScoringVector.
// The recommendation engine compares them to produce a ranked result.
export interface ScoringVector {
  social: number;        // preference for communal interaction
  calm: number;          // preference for quiet, low-stimulation environments
  scenic: number;        // preference for natural landscape over urban setting
  workation: number;     // need for wifi, quiet workspace (only hard-filterable dimension)
  adventure: number;     // appetite for physical activity and outdoor pursuits
  budget_fit: number;    // price sensitivity (1 = cost is the primary constraint)
  room_type_fit: number; // 0 = dorm preferred, 1 = private room required
}

// ─── Intake ───────────────────────────────────────────────────────────────────

export type StayPriority =
  | "social_vibe"
  | "calm_quiet"
  | "scenic_views"
  | "adventure_access"
  | "work_setup"
  | "best_value";

export type SocialEnergy = "very_social" | "balanced" | "mostly_private";

export type RoomType = "dorm" | "private" | "flexible";

export type BudgetLevel = "lowest" | "moderate" | "flexible";
