import { buildRequest } from "@/lib/buildRequest";
import type { IntakeSession } from "@/hooks/useIntakeSession";

// A valid v4 UUID (version nibble = 4, variant nibble = a).
const TEST_UUID = "550e8400-e29b-41d4-a716-446655440000";

function session(overrides: Partial<IntakeSession["answers"]> = {}): IntakeSession {
  return {
    version: 1,
    sessionId: TEST_UUID,
    currentStep: 4,
    answers: {
      personaKey: "solo_social",
      priority: "social_vibe",
      socialEnergy: "very_social",
      roomType: "dorm",
      ...overrides,
    },
  };
}

describe("buildRequest", () => {
  // ── happy paths ────────────────────────────────────────────────────────────

  test("returns a valid request when all required answers are present", () => {
    const req = buildRequest(session());
    expect(req).not.toBeNull();
    expect(req?.personaKey).toBe("solo_social");
    expect(req?.priority).toBe("social_vibe");
    expect(req?.socialEnergy).toBe("very_social");
    expect(req?.roomType).toBe("dorm");
    expect(req?.sessionId).toBe(TEST_UUID);
  });

  test("includes budget when provided", () => {
    const req = buildRequest(session({ budget: "lowest" }));
    expect(req?.budget).toBe("lowest");
  });

  test("omits budget when not answered (optional field)", () => {
    const req = buildRequest(session());
    expect(req?.budget).toBeUndefined();
  });

  test("returns a request that satisfies all field types", () => {
    const req = buildRequest(session({ roomType: "private", budget: "moderate" }));
    expect(req).toMatchObject({
      sessionId: expect.stringMatching(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      ),
      personaKey: "solo_social",
      priority: "social_vibe",
      socialEnergy: "very_social",
      roomType: "private",
      budget: "moderate",
    });
  });

  // ── missing required fields ────────────────────────────────────────────────

  test("returns null when personaKey is missing", () => {
    const s = session();
    delete s.answers.personaKey;
    expect(buildRequest(s)).toBeNull();
  });

  test("returns null when priority is missing", () => {
    const s = session();
    delete s.answers.priority;
    expect(buildRequest(s)).toBeNull();
  });

  test("returns null when socialEnergy is missing", () => {
    const s = session();
    delete s.answers.socialEnergy;
    expect(buildRequest(s)).toBeNull();
  });

  test("returns null when roomType is missing", () => {
    const s = session();
    delete s.answers.roomType;
    expect(buildRequest(s)).toBeNull();
  });

  // ── invalid values (stale localStorage) ───────────────────────────────────

  test("returns null when personaKey is not a valid enum member", () => {
    const s = session({ personaKey: "unknown_persona" as never });
    expect(buildRequest(s)).toBeNull();
  });

  test("returns null when priority is not a valid enum member", () => {
    const s = session({ priority: "vibes_only" as never });
    expect(buildRequest(s)).toBeNull();
  });

  test("returns null when budget is present but not a valid enum member", () => {
    const s = session({ budget: "splurge" as never });
    expect(buildRequest(s)).toBeNull();
  });

  test("returns null when sessionId is not a UUID", () => {
    const s = session();
    s.sessionId = "not-a-uuid";
    expect(buildRequest(s)).toBeNull();
  });

  // ── all persona / priority / room combinations round-trip cleanly ─────────

  test.each([
    "solo_social",
    "solo_quiet",
    "friends_getaway",
    "couple_retreat",
    "workation",
    "budget_backpacker",
  ] as const)("accepts personaKey '%s'", (personaKey) => {
    expect(buildRequest(session({ personaKey }))).not.toBeNull();
  });

  test.each(["dorm", "private", "flexible"] as const)("accepts roomType '%s'", (roomType) => {
    expect(buildRequest(session({ roomType }))).not.toBeNull();
  });
});
