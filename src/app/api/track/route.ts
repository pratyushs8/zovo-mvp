import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { trackEvent } from "@/services/analytics";
import type { EventName } from "@/lib/analytics";

const requestSchema = z.object({
  name: z.enum([
    "session_started",
    "question_answered",
    "recommendations_shown",
    "recommendation_clicked",
    "booking_handoff_clicked",
  ]),
  properties: z.record(z.string(), z.unknown()),
  sessionId: z.string().uuid().optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { name, properties, sessionId } = parsed.data;

  // properties is validated as Record<string, unknown> at the boundary;
  // cast is safe — trackEvent's generic constraint holds at call sites
  await trackEvent(name as EventName, properties as never, sessionId);

  return NextResponse.json({ ok: true });
}
