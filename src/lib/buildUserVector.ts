import type { ScoringVector } from "@/types";
import type { RecommendationRequest } from "@/services/recommendation";
import type { OverrideQuestion } from "@/config/questions";
import { PERSONAS } from "@/config/personas";
import { QUESTIONS } from "@/config/questions";
import { DIMENSION_KEYS } from "@/config/scoring";

// Build the user's ScoringVector from a RecommendationRequest.
//
// Layer 1: persona baseline from Q1 (all 7 dimensions).
// Layers 2–5: Q2–Q5 override merge — each answer writes only its named
// dimensions; all others inherit from the previous layer (last-write-wins).
// Final step: clamp every dimension to [0, 1] so the scoring formula's
// assumptions hold regardless of future question additions or override chains.
export function buildUserVector(req: RecommendationRequest): ScoringVector {
  const vector: ScoringVector = { ...PERSONAS[req.personaKey].scoring };

  for (const question of QUESTIONS) {
    if (question.resolveVia !== "scoring_override") continue;

    // Safe: every OverrideQuestion<T> option carries a Partial<ScoringVector>.
    const q = question as OverrideQuestion<string>;
    const answer = req[q.requestField as keyof RecommendationRequest] as string | undefined;
    if (answer == null) continue;

    const option = q.options.find((o) => o.value === answer);
    if (!option) continue;

    Object.assign(vector, option.scoringOverride);
  }

  for (const dim of DIMENSION_KEYS) {
    vector[dim] = Math.max(0, Math.min(1, vector[dim]));
  }

  return vector;
}
