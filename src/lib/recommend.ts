import type {
  RecommendationRequest,
  RecommendationResponse,
  RecommendationErrorResponse,
} from "@/types/api";

// Client-side helper for POST /api/recommend.
//
// Usage (Day 8 page component):
//   const response = await getRecommendations(intakeData);
//   // response.results → ranked StayResult[]
//   // response.rankingExplanation → debug metadata
//
// Throws RecommendationClientError on HTTP errors.
// The caller is responsible for rendering the error state.

export class RecommendationClientError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    public readonly detail?: Record<string, unknown>
  ) {
    super(`Recommendation request failed: ${code} (HTTP ${status})`);
    this.name = "RecommendationClientError";
  }
}

export async function getRecommendations(
  req: RecommendationRequest
): Promise<RecommendationResponse> {
  const res = await fetch("/api/recommend", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    const errBody = (await res
      .json()
      .catch(() => ({ error: "unknown_error" }))) as RecommendationErrorResponse;
    throw new RecommendationClientError(
      errBody.error ?? "unknown_error",
      res.status,
      errBody.detail
    );
  }

  return res.json() as Promise<RecommendationResponse>;
}
