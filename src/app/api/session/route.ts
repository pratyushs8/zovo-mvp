import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { sessions } from "@/db/schema";
import {
  personaKeySchema,
  stayPrioritySchema,
  socialEnergySchema,
  roomTypeSchema,
  budgetLevelSchema,
} from "@/lib/schemas/recommendationRequest";

// ─── Schemas ─────────────────────────────────────────────────────────────────

const createSessionSchema = z.object({
  sessionId: z.string().uuid(),
  referrer: z.string().optional(),
  userAgent: z.string().optional(),
});

const updateSessionSchema = z.object({
  sessionId: z.string().uuid(),
  step: z.number().int().min(0).max(4),
  answers: z.object({
    personaKey: personaKeySchema.optional(),
    priority: stayPrioritySchema.optional(),
    socialEnergy: socialEnergySchema.optional(),
    roomType: roomTypeSchema.optional(),
    budget: budgetLevelSchema.optional(),
  }),
});

// ─── POST /api/session — create session ──────────────────────────────────────
//
// Idempotent: if the sessionId already exists, updates lastSeenAt and returns.
// The client generates the UUID and owns the session identity.

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = createSessionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", detail: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { sessionId, referrer, userAgent } = parsed.data;

  try {
    await db
      .insert(sessions)
      .values({
        id: sessionId,
        referrer: referrer ?? null,
        userAgent: userAgent ?? null,
        intakeStep: 0,
        intakeAnswers: null,
      })
      .onConflictDoUpdate({
        target: sessions.id,
        set: { lastSeenAt: sql`now()` },
      });

    return NextResponse.json({ sessionId }, { status: 200 });
  } catch (err) {
    console.error("[POST /api/session]", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

// ─── PATCH /api/session — update intake progress ─────────────────────────────
//
// Called on each step advance. Persists the current step and accumulated
// answers so a session can be inspected or recovered server-side.

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = updateSessionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", detail: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { sessionId, step, answers } = parsed.data;

  try {
    const updated = await db
      .update(sessions)
      .set({
        intakeStep: step,
        intakeAnswers: answers,
        lastSeenAt: sql`now()`,
      })
      .where(eq(sessions.id, sessionId))
      .returning({ id: sessions.id });

    if (updated.length === 0) {
      return NextResponse.json({ error: "session_not_found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("[PATCH /api/session]", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
