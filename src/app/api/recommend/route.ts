import { type NextRequest, NextResponse } from "next/server";
import { recommendationRequestSchema } from "@/lib/schemas/recommendationRequest";
import { recommendStays } from "@/services/recommendation";
import type { RecommendationResponse, RecommendationErrorResponse } from "@/types/api";

type OkResponse = NextResponse<RecommendationResponse>;
type ErrResponse = NextResponse<RecommendationErrorResponse>;

// POST /api/recommend
//
// Request body: RecommendationRequest (see src/types/api.ts)
// Success 200:  RecommendationResponse
// Error   400:  { error: "validation_failed", detail: { field: [messages] } }
// Error   500:  { error: "internal_error" }
export async function POST(req: NextRequest): Promise<OkResponse | ErrResponse> {
  // Parse and validate the request body at the API boundary.
  const body = await req.json().catch(() => null);
  const parsed = recommendationRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", detail: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  try {
    const response = await recommendStays(parsed.data);
    return NextResponse.json(response, { status: 200 });
  } catch (err) {
    console.error("[POST /api/recommend] recommendStays threw:", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
