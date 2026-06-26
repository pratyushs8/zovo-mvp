import { type NextRequest, NextResponse } from "next/server";
import type { ExplainRequest, ExplainResponse, ExplainErrorResponse } from "@/types/explain";
import { generateExplanations } from "@/services/explanation";
import { DIMENSION_KEYS } from "@/config/scoring";

// Raise the Vercel function timeout above the OpenAI client timeout (15 s)
// so the serverless function never terminates before the client does.
export const maxDuration = 30;

type OkResponse = NextResponse<ExplainResponse>;
type ErrResponse = NextResponse<ExplainErrorResponse>;

// ─── IP rate limiter ──────────────────────────────────────────────────────────
// Simple in-memory window: 10 requests per IP per 60 seconds.
// Single-instance only — good enough for closed beta / Day 10 rollout.
// Replace with a Redis-backed limiter before wider exposure.

const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;
const ipWindows = new Map<string, { count: number; resetsAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const window = ipWindows.get(ip);
  if (!window || now >= window.resetsAt) {
    ipWindows.set(ip, { count: 1, resetsAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  if (window.count >= RATE_LIMIT_MAX) return true;
  window.count += 1;
  return false;
}

// ─── Structural body validation ───────────────────────────────────────────────
// Checks that every card has an id and that every debug card's breakdown
// contains all seven dimension keys — catches stale / truncated _debug payloads
// before they reach generateExplanations and produce unhelpful 500s.

function isValidBody(body: unknown): body is ExplainRequest {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  if (!Array.isArray(b.cards) || !b.debug || typeof b.debug !== "object") return false;
  const d = b.debug as Record<string, unknown>;
  if (!d.userVector || !Array.isArray(d.cards)) return false;

  for (const card of b.cards as unknown[]) {
    if (typeof (card as Record<string, unknown>)?.id !== "number") return false;
  }
  for (const dc of d.cards as unknown[]) {
    const breakdown = (dc as Record<string, unknown>)?.breakdown;
    if (!breakdown || typeof breakdown !== "object") return false;
    for (const dim of DIMENSION_KEYS) {
      if (!(dim in (breakdown as object))) return false;
    }
  }
  return true;
}

// ─── Route ────────────────────────────────────────────────────────────────────
//
// POST /api/explain
// Request body: ExplainRequest  (cards + _debug from /api/recommend)
// Success 200:  ExplainResponse  { cards: ExplainedCard[] }
// Error   400:  { error: "invalid_request" }
// Error   429:  { error: "rate_limited" }
// Error   500:  { error: "internal_error" }

export async function POST(req: NextRequest): Promise<OkResponse | ErrResponse> {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  if (!isValidBody(body)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  try {
    const explained = await generateExplanations(
      body.cards,
      body.debug.cards,
      body.debug.userVector
    );
    return NextResponse.json({ cards: explained });
  } catch {
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
