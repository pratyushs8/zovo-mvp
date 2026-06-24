import type { DimensionWeights } from "@/config/scoring";

// Weights for the Day 5 ranking formula:
//   score = Σ W[d] × (1 − |U[d] − P[d]|)
//
// The single file to change when tuning the ranking model.
//
// adventure (0.20) — raised from 0.15; now the strongest discriminator.
//   When a user selects adventure_access priority, adventure properties
//   clearly outrank scenic-calm properties that compensate on other dims.
// social (0.15) — reduced from 0.20: was over-pulling social beach
//   destinations (Goa) ahead of adventure/quiet properties for users who
//   didn't explicitly prioritise social energy.
// calm (0.15) — unchanged. Anti-correlated with social; together they form
//   the dominant quiet/social axis at combined 0.30.
// workation (0.15) — unchanged. Soft gradient above the hard filter floor.
//   The hard filter (src/config/ranking.ts) enforces the minimum bar
//   (property must have workation > 0.2); this weight then rewards degree
//   of fit above that floor.
// room_type_fit (0.15) — raised from 0.10. All properties carry private
//   rooms (at 2× dorm price), so this dimension measures experience
//   character (hostel-vibe vs private-vibe), not availability. Couples and
//   solo-quiet users wanting private feel are now properly differentiated.
// scenic (0.10) — reduced from 0.15 to absorb the room_type_fit increase.
//   Scenic is correlated with calm for mountain/nature destinations; the
//   priority scoringOverride (scenic: 0.9) still boosts it strongly in the
//   user vector when scenic_views is the stated priority.
// budget_fit (0.10) — unchanged.
export const WEIGHTS: DimensionWeights = {
  social:        0.15,
  calm:          0.15,
  scenic:        0.10,
  workation:     0.15,
  adventure:     0.20,
  budget_fit:    0.10,
  room_type_fit: 0.15,
} satisfies DimensionWeights;

// Fail fast if weights drift from 1.0 during tuning sessions.
// Floating-point arithmetic allows a 0.1% margin before this fires.
const _weightSum = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
if (Math.abs(_weightSum - 1.0) > 0.001) {
  throw new Error(
    `WEIGHTS must sum to 1.0 — got ${_weightSum.toFixed(4)}. ` +
    `Adjust weights.ts before proceeding.`,
  );
}
