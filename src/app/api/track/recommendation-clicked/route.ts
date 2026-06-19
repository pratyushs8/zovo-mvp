import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { trackEvent } from "@/services/analytics";

const requestSchema = z.object({
  properties: z.object({
    requestId: z.number(),
    propertyId: z.number(),
    rank: z.number(),
  }),
  sessionId: z.string().uuid().optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  await trackEvent("recommendation_clicked", parsed.data.properties, parsed.data.sessionId);

  return NextResponse.json({ ok: true });
}
