import { type NextRequest, NextResponse } from "next/server";
import { recommendationRequestSchema } from "@/lib/schemas/recommendationRequest";

// POST /api/recommend
// Accepts a structured intake payload; returns ranked Zostel stays.
// Day 4: wire to recommendStays() in src/services/recommendation.ts
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = recommendationRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  // TODO: return recommendStays(parsed.data)
  return NextResponse.json({ stays: [] }, { status: 200 });
}
