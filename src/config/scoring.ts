import type { ScoringVector } from "@/types";

// ─── Keys ─────────────────────────────────────────────────────────────────────

export type DimensionKey = keyof ScoringVector;

export const DIMENSION_KEYS: DimensionKey[] = [
  "social",
  "calm",
  "scenic",
  "workation",
  "adventure",
  "budget_fit",
  "room_type_fit",
];

// ─── Dimension metadata ───────────────────────────────────────────────────────

export interface ScoringDimension {
  key: DimensionKey;
  label: string;
  description: string;
  // Whether a large mismatch on this dimension should exclude a property
  // entirely rather than just rank it lower.
  canHardFilter: boolean;
}

export const DIMENSIONS: Record<DimensionKey, ScoringDimension> = {
  social: {
    key: "social",
    label: "Social",
    description: "Preference for communal interaction and meeting other travelers.",
    canHardFilter: false,
  },
  calm: {
    key: "calm",
    label: "Calm",
    description: "Preference for quiet, low-stimulation environments.",
    canHardFilter: false,
  },
  scenic: {
    key: "scenic",
    label: "Scenic",
    description: "Preference for natural landscape and dramatic settings over urban convenience.",
    canHardFilter: false,
  },
  workation: {
    key: "workation",
    label: "Workation",
    description: "Need for reliable wifi, quiet workspace, and stable power.",
    // A user with workation ≥ 0.8 matched to a property with workation ≤ 0.2
    // is a bad recommendation regardless of other scores.
    canHardFilter: true,
  },
  adventure: {
    key: "adventure",
    label: "Adventure",
    description: "Appetite for physical activity, trekking, rafting, and outdoor pursuits.",
    canHardFilter: false,
  },
  budget_fit: {
    key: "budget_fit",
    label: "Budget fit",
    description:
      "Price sensitivity. 1 = cost is the primary constraint; 0 = price is not a factor.",
    canHardFilter: false,
  },
  room_type_fit: {
    key: "room_type_fit",
    label: "Room type fit",
    description: "Room privacy preference. 0 = dorm preferred; 1 = private room required.",
    canHardFilter: false,
  },
};

// ─── Utility types ────────────────────────────────────────────────────────────

// A map of per-dimension weights used by the ranking function.
// Weights sum to 1.0 by convention but are not enforced here —
// the ranking function is responsible for normalising.
export type DimensionWeights = Record<DimensionKey, number>;

// A partial scoring vector used to override specific dimensions.
// Produced by question answers and merged onto the persona baseline.
export type ScoringOverride = Partial<ScoringVector>;

// A scored property candidate produced during ranking.
// score is the raw dot-product result before normalisation.
export interface ScoredCandidate {
  propertyId: number;
  score: number;
  // Per-dimension breakdown kept for debugging and future explainability.
  breakdown: Record<DimensionKey, number>;
}
