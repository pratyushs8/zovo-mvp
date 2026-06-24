import type { DimensionWeights } from "@/config/scoring";

// Weights for the Day 5 ranking formula:
//   score = Σ W[d] × (1 − |U[d] − P[d]|)
//
// The single file to change when tuning the ranking model.
//
// social (0.20) — the strongest single discriminator in the network.
// calm  (0.15) — anti-correlated with social in the property data, so
//   social+calm combined (0.35) acts as the dominant axis: quiet users
//   are doubly penalised by social properties and vice versa. This is
//   intentional — the social/calm axis is the sharpest user split.
// workation (0.15) — the soft gradient above the hard filter floor.
//   The hard filter (src/config/ranking.ts) enforces the minimum bar
//   (property must have workation > 0.2); this weight then rewards degree
//   of fit above that floor. Intentionally kept equal to other mid-tier
//   dimensions rather than inflated, so scenic/calm preferences still
//   differentiate within the surviving workation pool.
// scenic, adventure (0.15) — equal weight; neither dominates by default.
// budget_fit, room_type_fit (0.10) — refining signals. A 0.10 weight
//   means a full mismatch on room type costs 0.10, not a disqualifier.
//   Room type is a soft preference, not a hard filter.
export const WEIGHTS: DimensionWeights = {
  social:        0.20,
  calm:          0.15,
  scenic:        0.15,
  workation:     0.15,
  adventure:     0.15,
  budget_fit:    0.10,
  room_type_fit: 0.10,
} satisfies DimensionWeights;
