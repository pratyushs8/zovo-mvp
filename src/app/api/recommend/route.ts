import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const requestSchema = z.object({
  persona: z.enum(["solo", "couple", "group", "family"]),
  vibe: z.enum(["adventure", "chill", "cultural", "party", "workation"]),
});

// POST /api/recommend
// Accepts a traveler persona + trip vibe; returns ranked Zostel stays.
// Day 2+: wire to recommendStays() in src/services/recommendation.ts
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  // TODO: return recommendStays(parsed.data)
  return NextResponse.json({ stays: [] }, { status: 200 });
}
