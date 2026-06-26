import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { trackEvent } from "@/services/analytics";

const requestSchema = z.object({
  properties: z.object({
    propertyId: z.number().int().positive(),
    bookingUrl: z.string().url(),
    rank: z.number().int().positive(),
    destinationSlug: z.string().min(1),
    requestId: z.number().int().positive(),
    explanationSource: z.enum(["model", "fallback"]).optional(),
  }),
  sessionId: z.string().uuid().optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  await trackEvent("booking_handoff_clicked", parsed.data.properties, parsed.data.sessionId);

  return NextResponse.json({ ok: true });
}
