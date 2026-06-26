// Tests for the Day 9 explanation generation service.
//
// The OpenAI client is replaced with a controllable fake via setOpenAIClient.
// The logger is mocked to keep test output clean. buildFallbackCard is the
// real implementation so fallback copy still passes structural checks.

import { generateExplanations } from "@/services/explanation";
import { setOpenAIClient } from "@/lib/openaiClient";
import type { StayCard, StayDebug } from "@/types/api";
import type { ScoringVector } from "@/types";
import type { ScoringBreakdown } from "@/types/ranking";

// ─── Env mock — must come first so openaiClient doesn't throw on import ───────

jest.mock("@/lib/env", () => ({
  env: { OPENAI_API_KEY: "test-key", DATABASE_URL: "postgres://localhost/test", APP_ENV: "local" },
  isLocal: true,
  isStaging: false,
  isProduction: false,
}));

// ─── Silence logger ───────────────────────────────────────────────────────────

jest.mock("@/lib/explainLogger", () => ({
  logExplainFailure: jest.fn(),
  logExplainBatch: jest.fn(),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const USER_VECTOR: ScoringVector = {
  scenic: 0.9,
  calm: 0.3,
  social: 0.7,
  workation: 0.4,
  adventure: 0.2,
  budget_fit: 0.8,
  room_type_fit: 0.6,
};

function makeBreakdown(overrides: Partial<ScoringBreakdown> = {}): ScoringBreakdown {
  const dim = (propertyValue: number, gap: number) => ({
    userValue: 0.7,
    propertyValue,
    gap,
    contribution: 0.1,
  });
  return {
    scenic: dim(0.85, 0.05),
    calm: dim(0.6, 0.3),
    social: dim(0.75, 0.05),
    workation: dim(0.5, 0.1),
    adventure: dim(0.3, 0.4),
    budget_fit: dim(0.7, 0.1),
    room_type_fit: dim(0.6, 0.0),
    ...overrides,
  };
}

function makeDebug(id: number, overrides: Partial<StayDebug> = {}): StayDebug {
  return {
    id,
    score: 0.75,
    hardFilterExempted: false,
    breakdown: makeBreakdown(),
    explanation: {
      dimensions: [
        { dim: "scenic", contribution: 0.15, matchScore: 0.14, gap: 0.05, strength: "strong" },
        { dim: "social", contribution: 0.12, matchScore: 0.11, gap: 0.05, strength: "strong" },
        { dim: "calm", contribution: 0.08, matchScore: 0.07, gap: 0.3, strength: "moderate" },
        { dim: "budget_fit", contribution: 0.09, matchScore: 0.08, gap: 0.1, strength: "strong" },
        { dim: "workation", contribution: 0.06, matchScore: 0.05, gap: 0.1, strength: "strong" },
        { dim: "adventure", contribution: 0.04, matchScore: 0.03, gap: 0.4, strength: "moderate" },
        {
          dim: "room_type_fit",
          contribution: 0.07,
          matchScore: 0.06,
          gap: 0.0,
          strength: "strong",
        },
      ],
      topMatches: [
        { dim: "scenic", contribution: 0.15, matchScore: 0.14, gap: 0.05, strength: "strong" },
        { dim: "social", contribution: 0.12, matchScore: 0.11, gap: 0.05, strength: "strong" },
      ],
      topMisses: [],
      filterTrace: {
        hardFilterTriggered: false,
        passMode: "not_applicable",
        workationScore: 0.5,
      },
    },
    ...overrides,
  };
}

function makeCard(id: number, rank: number, overrides: Partial<StayCard> = {}): StayCard {
  return {
    id,
    rank,
    title: `Zostel Test ${id}`,
    destinationSlug: "manali",
    location: "Old Manali, Manali",
    summary: "A scenic mountain stay.",
    priceInr: 700,
    lowConfidence: false,
    bookingUrl: "https://zostel.com",
    reasons: [
      { label: "Scenic", strength: "strong", direction: "up" },
      { label: "Social vibe", strength: "moderate", direction: "up" },
    ],
    ...overrides,
  };
}

// ─── OpenAI client fake ───────────────────────────────────────────────────────
//
// Returns whatever `responseText` is set to for the next call, then resets.

function makeOpenAIFake(responseText: string) {
  return {
    responses: {
      create: jest.fn().mockResolvedValue({ output_text: responseText }),
    },
  } as unknown as import("openai").default;
}

function makeOpenAIError(message: string) {
  return {
    responses: {
      create: jest.fn().mockRejectedValue(new Error(message)),
    },
  } as unknown as import("openai").default;
}

function modelEnvelope(cards: unknown[]): string {
  return JSON.stringify({ cards });
}

function validCard(id: number) {
  return {
    id,
    cardSummary: "A scenic stay well-suited to what you described.",
    reasons: [
      { label: "Scenic", sentence: "Sits amid mountain scenery that matches your preference." },
      {
        label: "Social vibe",
        sentence: "Communal spaces tend toward a lively, sociable atmosphere.",
      },
    ],
  };
}

afterEach(() => {
  setOpenAIClient(null);
  jest.clearAllMocks();
});

// ─── Happy path ───────────────────────────────────────────────────────────────

describe("generateExplanations — valid model output", () => {
  it("returns model explanationSource when model output is valid", async () => {
    setOpenAIClient(makeOpenAIFake(modelEnvelope([validCard(1)])));
    const results = await generateExplanations([makeCard(1, 1)], [makeDebug(1)], USER_VECTOR);
    expect(results[0].explanationSource).toBe("model");
  });

  it("uses cardSummary from the model response", async () => {
    setOpenAIClient(makeOpenAIFake(modelEnvelope([validCard(1)])));
    const results = await generateExplanations([makeCard(1, 1)], [makeDebug(1)], USER_VECTOR);
    expect(results[0].cardSummary).toBe("A scenic stay well-suited to what you described.");
  });

  it("maps chip sentences by label", async () => {
    setOpenAIClient(makeOpenAIFake(modelEnvelope([validCard(1)])));
    const results = await generateExplanations([makeCard(1, 1)], [makeDebug(1)], USER_VECTOR);
    expect(results[0].sentences["Scenic"]).toBe(
      "Sits amid mountain scenery that matches your preference."
    );
    expect(results[0].sentences["Social vibe"]).toBe(
      "Communal spaces tend toward a lively, sociable atmosphere."
    );
  });

  it("handles multiple cards in one call — each card gets its own explanation", async () => {
    setOpenAIClient(makeOpenAIFake(modelEnvelope([validCard(1), validCard(2)])));
    const results = await generateExplanations(
      [makeCard(1, 1), makeCard(2, 2)],
      [makeDebug(1), makeDebug(2)],
      USER_VECTOR
    );
    expect(results).toHaveLength(2);
    expect(results[0].id).toBe(1);
    expect(results[1].id).toBe(2);
    expect(results[0].explanationSource).toBe("model");
    expect(results[1].explanationSource).toBe("model");
  });

  it("strips markdown from model output before accepting it", async () => {
    const cardWithMarkdown = {
      id: 1,
      cardSummary: "A **scenic** stay.",
      reasons: [
        { label: "Scenic", sentence: "Great *mountain* setting." },
        { label: "Social vibe", sentence: "Lively communal spaces." },
      ],
    };
    setOpenAIClient(makeOpenAIFake(modelEnvelope([cardWithMarkdown])));
    const results = await generateExplanations([makeCard(1, 1)], [makeDebug(1)], USER_VECTOR);
    expect(results[0].cardSummary).toBe("A scenic stay.");
    expect(results[0].sentences["Scenic"]).toBe("Great mountain setting.");
  });
});

// ─── API failure → full-batch fallback ───────────────────────────────────────

describe("generateExplanations — API failure", () => {
  it("returns fallback cards when the API throws a network error", async () => {
    setOpenAIClient(makeOpenAIError("fetch failed"));
    const results = await generateExplanations(
      [makeCard(1, 1), makeCard(2, 2)],
      [makeDebug(1), makeDebug(2)],
      USER_VECTOR
    );
    expect(results[0].explanationSource).toBe("fallback");
    expect(results[1].explanationSource).toBe("fallback");
  });

  it("returns one fallback per card — count is preserved", async () => {
    setOpenAIClient(makeOpenAIError("connection reset"));
    const results = await generateExplanations(
      [makeCard(1, 1), makeCard(2, 2), makeCard(3, 3)],
      [makeDebug(1), makeDebug(2), makeDebug(3)],
      USER_VECTOR
    );
    expect(results).toHaveLength(3);
  });

  it("fallback cards have non-empty cardSummary", async () => {
    setOpenAIClient(makeOpenAIError("timeout"));
    const results = await generateExplanations([makeCard(1, 1)], [makeDebug(1)], USER_VECTOR);
    expect(results[0].cardSummary.length).toBeGreaterThan(0);
  });

  it("fallback cards contain a sentence for every chip label", async () => {
    setOpenAIClient(makeOpenAIError("timeout"));
    const results = await generateExplanations([makeCard(1, 1)], [makeDebug(1)], USER_VECTOR);
    expect(results[0].sentences["Scenic"]).toBeDefined();
    expect(results[0].sentences["Social vibe"]).toBeDefined();
  });
});

// ─── JSON parse failure ───────────────────────────────────────────────────────

describe("generateExplanations — malformed model output", () => {
  it("falls back when the model returns non-JSON", async () => {
    setOpenAIClient(makeOpenAIFake("Sure! Here are the explanations: ..."));
    const results = await generateExplanations([makeCard(1, 1)], [makeDebug(1)], USER_VECTOR);
    expect(results[0].explanationSource).toBe("fallback");
  });

  it("falls back when the JSON envelope is missing the cards array", async () => {
    setOpenAIClient(makeOpenAIFake(JSON.stringify({ result: [] })));
    const results = await generateExplanations([makeCard(1, 1)], [makeDebug(1)], USER_VECTOR);
    expect(results[0].explanationSource).toBe("fallback");
  });
});

// ─── Per-card validation failures ─────────────────────────────────────────────

describe("generateExplanations — per-card validation", () => {
  it("falls back for a card whose cardSummary exceeds 200 characters", async () => {
    const tooLong = { ...validCard(1), cardSummary: "A".repeat(201) };
    setOpenAIClient(makeOpenAIFake(modelEnvelope([tooLong])));
    const results = await generateExplanations([makeCard(1, 1)], [makeDebug(1)], USER_VECTOR);
    expect(results[0].explanationSource).toBe("fallback");
  });

  it("falls back for a card with a sentence that mentions a price figure", async () => {
    const withPrice = {
      id: 1,
      cardSummary: "A scenic stay.",
      reasons: [
        { label: "Scenic", sentence: "Costs ₹1200 per night." },
        { label: "Social vibe", sentence: "Lively communal spaces." },
      ],
    };
    setOpenAIClient(makeOpenAIFake(modelEnvelope([withPrice])));
    const results = await generateExplanations([makeCard(1, 1)], [makeDebug(1)], USER_VECTOR);
    expect(results[0].explanationSource).toBe("fallback");
  });

  it("falls back when the model invents a chip label that was not in targetReasons", async () => {
    const invented = {
      id: 1,
      cardSummary: "A scenic stay.",
      reasons: [
        { label: "Scenic", sentence: "Scenic mountain setting." },
        { label: "InventedLabel", sentence: "Something the model made up." },
      ],
    };
    setOpenAIClient(makeOpenAIFake(modelEnvelope([invented])));
    const results = await generateExplanations([makeCard(1, 1)], [makeDebug(1)], USER_VECTOR);
    expect(results[0].explanationSource).toBe("fallback");
  });

  it("falls back when model output is missing one of the required chip labels", async () => {
    const partial = {
      id: 1,
      cardSummary: "A scenic stay.",
      reasons: [
        { label: "Scenic", sentence: "Scenic mountain setting." },
        // "Social vibe" is missing
      ],
    };
    setOpenAIClient(makeOpenAIFake(modelEnvelope([partial])));
    const results = await generateExplanations([makeCard(1, 1)], [makeDebug(1)], USER_VECTOR);
    expect(results[0].explanationSource).toBe("fallback");
  });

  it("falls back for a card missing from the model response entirely", async () => {
    // Model returns card 2, not card 1
    setOpenAIClient(makeOpenAIFake(modelEnvelope([validCard(2)])));
    const results = await generateExplanations([makeCard(1, 1)], [makeDebug(1)], USER_VECTOR);
    expect(results[0].explanationSource).toBe("fallback");
  });

  it("falls back individual cards independently — sibling card with valid output uses model source", async () => {
    const tooLong = { ...validCard(1), cardSummary: "A".repeat(201) };
    setOpenAIClient(makeOpenAIFake(modelEnvelope([tooLong, validCard(2)])));
    const results = await generateExplanations(
      [makeCard(1, 1), makeCard(2, 2)],
      [makeDebug(1), makeDebug(2)],
      USER_VECTOR
    );
    expect(results[0].explanationSource).toBe("fallback");
    expect(results[1].explanationSource).toBe("model");
  });
});

// ─── Overconfidence gate (lowConfidence cards) ────────────────────────────────

describe("generateExplanations — lowConfidence overconfidence rejection", () => {
  it("rejects 'perfect' in cardSummary when card is lowConfidence", async () => {
    const overconfident = {
      ...validCard(1),
      cardSummary: "The perfect stay for your trip.",
    };
    setOpenAIClient(makeOpenAIFake(modelEnvelope([overconfident])));
    const results = await generateExplanations(
      [makeCard(1, 1, { lowConfidence: true })],
      [makeDebug(1)],
      USER_VECTOR
    );
    expect(results[0].explanationSource).toBe("fallback");
  });

  // 'perfect' is now blocked on all cards (always-overconfident); use neutral text
  it("accepts hedged text when lowConfidence is false", async () => {
    const confident = {
      ...validCard(1),
      cardSummary: "A scenic stay that suits what you described.",
    };
    setOpenAIClient(makeOpenAIFake(modelEnvelope([confident])));
    const results = await generateExplanations(
      [makeCard(1, 1, { lowConfidence: false })],
      [makeDebug(1)],
      USER_VECTOR
    );
    expect(results[0].explanationSource).toBe("model");
  });
});

// ─── Ranking order preservation ───────────────────────────────────────────────

describe("generateExplanations — ranking order preservation", () => {
  it("returns cards in the same order as the input regardless of model output order", async () => {
    // Model returns card 3 first, then 1, then 2 — should not reorder results
    setOpenAIClient(makeOpenAIFake(modelEnvelope([validCard(3), validCard(1), validCard(2)])));
    const results = await generateExplanations(
      [makeCard(1, 1), makeCard(2, 2), makeCard(3, 3)],
      [makeDebug(1), makeDebug(2), makeDebug(3)],
      USER_VECTOR
    );
    expect(results.map((r) => r.id)).toEqual([1, 2, 3]);
  });

  it("result ids match input card ids exactly", async () => {
    setOpenAIClient(makeOpenAIFake(modelEnvelope([validCard(10), validCard(20)])));
    const results = await generateExplanations(
      [makeCard(10, 1), makeCard(20, 2)],
      [makeDebug(10), makeDebug(20)],
      USER_VECTOR
    );
    expect(results[0].id).toBe(10);
    expect(results[1].id).toBe(20);
  });

  it("explanation source never leaks ranking fields (no direction or strength on ExplainedCard)", async () => {
    setOpenAIClient(makeOpenAIFake(modelEnvelope([validCard(1)])));
    const results = await generateExplanations([makeCard(1, 1)], [makeDebug(1)], USER_VECTOR);
    const card = results[0];
    expect(card).not.toHaveProperty("rank");
    expect(card).not.toHaveProperty("reasons");
    expect(card).not.toHaveProperty("score");
  });
});

// ─── Missing optional fields on input ─────────────────────────────────────────

describe("generateExplanations — sparse or edge-case inputs", () => {
  it("handles a card with no targetReasons (empty reasons array)", async () => {
    const noReasons = makeCard(1, 1, { reasons: [] });
    const emptyCard = { id: 1, cardSummary: "A quiet stay.", reasons: [] };
    setOpenAIClient(makeOpenAIFake(modelEnvelope([emptyCard])));
    const results = await generateExplanations([noReasons], [makeDebug(1)], USER_VECTOR);
    // 0 chip labels required — model output is valid, should use model source
    expect(results[0].explanationSource).toBe("model");
    expect(results[0].sentences).toEqual({});
  });

  it("handles a card where topMisses is empty", async () => {
    const debugNoMisses = makeDebug(1, {
      explanation: { ...makeDebug(1).explanation, topMisses: [] },
    });
    setOpenAIClient(makeOpenAIFake(modelEnvelope([validCard(1)])));
    const results = await generateExplanations([makeCard(1, 1)], [debugNoMisses], USER_VECTOR);
    expect(results[0].explanationSource).toBe("model");
  });

  it("handles a card where topMatches is empty — falls back to gap threshold for direction", async () => {
    const debugNoMatches = makeDebug(1, {
      explanation: { ...makeDebug(1).explanation, topMatches: [] },
    });
    setOpenAIClient(makeOpenAIFake(modelEnvelope([validCard(1)])));
    // Should not throw — gap threshold fallback kicks in
    await expect(
      generateExplanations([makeCard(1, 1)], [debugNoMatches], USER_VECTOR)
    ).resolves.toHaveLength(1);
  });

  it("falls back gracefully (no throw) when debug data is missing for a card", async () => {
    setOpenAIClient(makeOpenAIFake(modelEnvelope([])));
    const results = await generateExplanations([makeCard(1, 1)], [], USER_VECTOR);
    expect(results).toHaveLength(1);
    expect(results[0].explanationSource).toBe("fallback");
    expect(results[0].id).toBe(1);
  });
});
