import type { IntakeSession } from "@/hooks/useIntakeSession";
import type { RecommendationRequest } from "@/types/api";
import { recommendationRequestSchema } from "@/lib/schemas/recommendationRequest";

/**
 * Normalizes an IntakeSession into a RecommendationRequest.
 *
 * Returns null if any required field is missing OR if any stored value is not
 * a valid enum member — for example, a string from a stale localStorage entry
 * that was written against an older schema version.
 *
 * Uses the same Zod schema that /api/recommend uses at the API boundary, so
 * there is exactly one definition of "valid request" in the codebase.
 */
export function buildRequest(session: IntakeSession): RecommendationRequest | null {
  const result = recommendationRequestSchema.safeParse({
    sessionId: session.sessionId,
    ...session.answers,
  });
  return result.success ? result.data : null;
}
