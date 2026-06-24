import type { DimensionWeights } from "@/config/scoring";

// Weights for the Day 5 ranking formula:
//   score = Σ W[d] × (1 − |U[d] − P[d]|)
//
// social carries the highest weight because the social/calm axis is the
// sharpest discriminator in the network. All other dimensions are equal at
// 0.15, with budget_fit and room_type_fit as refining signals at 0.10.
// The single file to change when tuning the ranking model.
export const WEIGHTS: DimensionWeights = {
  social:        0.20,
  calm:          0.15,
  scenic:        0.15,
  workation:     0.15,
  adventure:     0.15,
  budget_fit:    0.10,
  room_type_fit: 0.10,
} satisfies DimensionWeights;
