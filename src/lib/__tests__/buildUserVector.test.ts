import { buildUserVector } from "@/lib/buildUserVector";
import { PERSONAS } from "@/config/personas";
import type { RecommendationRequest } from "@/types/api";

// Minimal valid request — only personaKey and required fields.
function req(overrides: Partial<RecommendationRequest> = {}): RecommendationRequest {
  return {
    sessionId:    "00000000-0000-0000-0000-000000000001",
    personaKey:   "solo_social",
    priority:     "social_vibe",
    socialEnergy: "very_social",
    roomType:     "dorm",
    ...overrides,
  };
}

// ─── Persona baseline ─────────────────────────────────────────────────────────

describe("buildUserVector — persona baseline", () => {
  test("applies the selected persona's scoring vector as the starting point", () => {
    const vector = buildUserVector(req({ personaKey: "couple_retreat" }));
    const baseline = PERSONAS.couple_retreat.scoring;

    // Dimensions not overridden by Q2–Q5 should match the persona baseline.
    // couple_retreat has scenic: 0.7, workation: 0.0, adventure: 0.3.
    // None of the default req overrides touch those dimensions.
    expect(vector.workation).toBe(baseline.workation);
    expect(vector.adventure).toBe(baseline.adventure);
  });

  test("each persona produces a distinct vector", () => {
    const social  = buildUserVector(req({ personaKey: "solo_social",   priority: "social_vibe",   socialEnergy: "very_social",    roomType: "dorm" }));
    const quiet   = buildUserVector(req({ personaKey: "solo_quiet",    priority: "calm_quiet",    socialEnergy: "mostly_private", roomType: "private" }));
    const work    = buildUserVector(req({ personaKey: "workation",     priority: "work_setup",    socialEnergy: "mostly_private", roomType: "private" }));

    expect(social.social).toBeGreaterThan(quiet.social);
    expect(quiet.calm).toBeGreaterThan(social.calm);
    expect(work.workation).toBeGreaterThan(social.workation);
  });
});

// ─── Q2 priority override ─────────────────────────────────────────────────────

describe("buildUserVector — Q2 priority override", () => {
  test("work_setup sets workation:1.0 regardless of persona", () => {
    // Q2 work_setup also writes calm:0.8, but Q3 always runs after Q2 and
    // overwrites calm (very_social→0.0, balanced→0.5, mostly_private→0.9).
    // Testing only workation here; calm interaction is tested in the Q3 section.
    const vector = buildUserVector(req({ personaKey: "solo_social", priority: "work_setup" }));
    expect(vector.workation).toBe(1.0);
  });

  test("best_value sets budget_fit:1.0", () => {
    const vector = buildUserVector(req({ priority: "best_value" }));
    expect(vector.budget_fit).toBe(1.0);
  });

  test("scenic_views raises scenic to 0.9 and does not touch adventure or workation", () => {
    const persona = PERSONAS.solo_social.scoring;
    const vector  = buildUserVector(req({ personaKey: "solo_social", priority: "scenic_views" }));
    expect(vector.scenic).toBe(0.9);
    // Q2 scenic_views and Q3 very_social (default) neither touch adventure nor workation,
    // so these should retain their persona baseline values.
    expect(vector.adventure).toBe(persona.adventure);
    expect(vector.workation).toBe(persona.workation);
  });
});

// ─── Q3 social energy override ────────────────────────────────────────────────

describe("buildUserVector — Q3 social energy override", () => {
  test("very_social sets social:1.0 and calm:0.0", () => {
    const vector = buildUserVector(req({ socialEnergy: "very_social" }));
    expect(vector.social).toBe(1.0);
    expect(vector.calm).toBe(0.0);
  });

  test("mostly_private sets social:0.1 and calm:0.9", () => {
    const vector = buildUserVector(req({ socialEnergy: "mostly_private" }));
    expect(vector.social).toBe(0.1);
    expect(vector.calm).toBe(0.9);
  });

  // Q3 writes social/calm AFTER Q2 — it wins on those dimensions.
  test("Q3 overwrites Q2 on shared dimensions (last-write-wins)", () => {
    // Q2 calm_quiet sets calm:0.9, social:0.1.
    // Q3 very_social sets social:1.0, calm:0.0.
    // Q3 should win on both.
    const vector = buildUserVector(req({ priority: "calm_quiet", socialEnergy: "very_social" }));
    expect(vector.social).toBe(1.0);
    expect(vector.calm).toBe(0.0);
  });
});

// ─── Q4 room type override ────────────────────────────────────────────────────

describe("buildUserVector — Q4 room type override", () => {
  test("dorm sets room_type_fit:0.0", () => {
    const vector = buildUserVector(req({ roomType: "dorm" }));
    expect(vector.room_type_fit).toBe(0.0);
  });

  test("private sets room_type_fit:1.0", () => {
    const vector = buildUserVector(req({ roomType: "private" }));
    expect(vector.room_type_fit).toBe(1.0);
  });

  test("flexible sets room_type_fit:0.5", () => {
    const vector = buildUserVector(req({ roomType: "flexible" }));
    expect(vector.room_type_fit).toBe(0.5);
  });
});

// ─── Q5 budget override (optional) ───────────────────────────────────────────

describe("buildUserVector — Q5 budget override", () => {
  test("lowest sets budget_fit:1.0", () => {
    const vector = buildUserVector(req({ budget: "lowest" }));
    expect(vector.budget_fit).toBe(1.0);
  });

  test("omitting budget leaves budget_fit at the persona baseline value", () => {
    const persona = PERSONAS.workation.scoring;
    const vector  = buildUserVector(req({ personaKey: "workation", priority: "work_setup", socialEnergy: "mostly_private", roomType: "private", budget: undefined }));
    // workation persona baseline budget_fit is 0.2; no Q5 → should be 0.2.
    expect(vector.budget_fit).toBe(persona.budget_fit);
  });
});
