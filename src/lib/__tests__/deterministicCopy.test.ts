import { buildFallbackCard } from "@/lib/deterministicCopy";
import type { PromptCard, PromptDimensionFact } from "@/types/explain";

function makeCard(overrides: Partial<PromptCard> = {}): PromptCard {
  return {
    propertyId: 42,
    title: "Zostel Bir",
    location: "Bir, Himachal Pradesh",
    score: 0.65,
    lowConfidence: false,
    targetReasons: [
      { label: "Scenic", direction: "up" },
      { label: "Budget fit", direction: "down" },
    ],
    facts: [
      {
        dim: "scenic",
        label: "Scenic",
        userValue: 0.9,
        propertyValue: 0.8,
        gap: 0.1,
        strength: "strong",
        direction: "up",
      },
      {
        dim: "budget_fit",
        label: "Budget fit",
        userValue: 0.8,
        propertyValue: 0.4,
        gap: 0.4,
        strength: "moderate",
        direction: "down",
      },
    ],
    ...overrides,
  };
}

function makeFact(
  dim: PromptDimensionFact["dim"],
  overrides: Partial<PromptDimensionFact> = {}
): PromptDimensionFact {
  return {
    dim,
    label: dim.charAt(0).toUpperCase() + dim.slice(1).replace("_", " "),
    userValue: 0.8,
    propertyValue: 0.7,
    gap: 0.1,
    strength: "strong",
    direction: "up",
    ...overrides,
  };
}

// ─── Structure ────────────────────────────────────────────────────────────────

describe("buildFallbackCard — structure", () => {
  it("sets explanationSource to fallback", () => {
    expect(buildFallbackCard(makeCard()).explanationSource).toBe("fallback");
  });

  it("sets id from propertyId", () => {
    expect(buildFallbackCard(makeCard()).id).toBe(42);
  });

  it("returns a sentence for every targetReason label", () => {
    const card = buildFallbackCard(makeCard());
    expect(Object.keys(card.sentences)).toContain("Scenic");
    expect(Object.keys(card.sentences)).toContain("Budget fit");
    expect(Object.keys(card.sentences)).toHaveLength(2);
  });

  it("does not carry chip metadata — no direction or strength fields", () => {
    const card = buildFallbackCard(makeCard());
    // ExplainedCard must not have ranking-layer fields
    expect(card).not.toHaveProperty("reasons");
    for (const sentence of Object.values(card.sentences)) {
      expect(typeof sentence).toBe("string");
    }
  });
});

// ─── Sentence length constraints ──────────────────────────────────────────────

describe("buildFallbackCard — length constraints", () => {
  it("cardSummary is ≤120 characters", () => {
    expect(buildFallbackCard(makeCard()).cardSummary.length).toBeLessThanOrEqual(120);
  });

  it("every sentence is ≤120 characters", () => {
    const card = buildFallbackCard(makeCard());
    for (const sentence of Object.values(card.sentences)) {
      expect(sentence.length).toBeLessThanOrEqual(120);
    }
  });

  it("cardSummary length holds across all seven dimensions", () => {
    const dims: PromptDimensionFact["dim"][] = [
      "scenic",
      "calm",
      "social",
      "workation",
      "adventure",
      "budget_fit",
      "room_type_fit",
    ];
    for (const dim of dims) {
      const card = makeCard({
        targetReasons: [{ label: dim, direction: "up" }],
        facts: [makeFact(dim)],
      });
      const result = buildFallbackCard(card);
      expect(result.cardSummary.length).toBeLessThanOrEqual(120);
    }
  });
});

// ─── cardSummary content ──────────────────────────────────────────────────────

describe("buildFallbackCard — cardSummary", () => {
  it("grounds summary in top up-direction dimension", () => {
    const card = buildFallbackCard(makeCard());
    expect(card.cardSummary.toLowerCase()).toContain("scenic");
  });

  it("extracts city from state-level location", () => {
    // "Bir, Himachal Pradesh" → city is "Bir" (state excluded)
    const card = buildFallbackCard(makeCard());
    expect(card.cardSummary).toContain("Bir");
    expect(card.cardSummary).not.toContain("Himachal Pradesh");
  });

  it("extracts destination from neighbourhood-level location", () => {
    // "Old Manali, Manali" → city is "Manali"
    const card = buildFallbackCard(makeCard({ location: "Old Manali, Manali" }));
    expect(card.cardSummary).toContain("Manali");
  });

  it("falls back to location city when no usable up fact exists", () => {
    const card = buildFallbackCard(
      makeCard({
        targetReasons: [{ label: "Calm", direction: "down" }],
        facts: [makeFact("calm", { direction: "down", strength: "weak", gap: 0.6 })],
      })
    );
    expect(card.cardSummary).toContain("Bir");
  });

  it("uses modest language when lowConfidence is true", () => {
    const card = buildFallbackCard(makeCard({ lowConfidence: true }));
    expect(card.cardSummary).toMatch(/possibl|may|limited/i);
  });

  it("combines two strong dimensions when both available", () => {
    const card = buildFallbackCard(
      makeCard({
        targetReasons: [
          { label: "Scenic", direction: "up" },
          { label: "Calm", direction: "up" },
        ],
        facts: [makeFact("scenic", { label: "Scenic" }), makeFact("calm", { label: "Calm" })],
      })
    );
    expect(card.cardSummary.toLowerCase()).toMatch(/scenic/);
    expect(card.cardSummary.toLowerCase()).toMatch(/peaceful/);
  });

  it("uses modest language when all up facts are weak", () => {
    const card = buildFallbackCard(
      makeCard({
        facts: [
          makeFact("scenic", { label: "Scenic", strength: "weak", gap: 0.45 }),
          makeFact("budget_fit", {
            label: "Budget fit",
            strength: "weak",
            gap: 0.45,
            direction: "down",
          }),
        ],
      })
    );
    expect(card.cardSummary).toMatch(/possibl|may|less data/i);
  });
});

// ─── Sentence quality ─────────────────────────────────────────────────────────

describe("buildFallbackCard — sentences", () => {
  it("strong up scenic sentence reads naturally", () => {
    const sentence = buildFallbackCard(makeCard()).sentences["Scenic"];
    // Should not start with "This property" (robotic) and should mention scenery
    expect(sentence).not.toMatch(/^This property/);
    expect(sentence).toMatch(/scenic|setting|backdrop/i);
  });

  it("down budget_fit sentence acknowledges the gap without mentioning price numbers", () => {
    const sentence = buildFallbackCard(makeCard()).sentences["Budget fit"];
    expect(sentence).toMatch(/cost|range|budget/i);
    expect(sentence).not.toMatch(/₹|\d{3,}/);
  });

  it("weak strength produces hedged sentence", () => {
    const card = makeCard({
      targetReasons: [{ label: "Workation", direction: "up" }],
      facts: [makeFact("workation", { label: "Workation", strength: "weak", gap: 0.45 })],
    });
    expect(buildFallbackCard(card).sentences["Workation"]).toMatch(/basic|though not|may/i);
  });

  it("lowConfidence produces hedged sentence for up direction", () => {
    const sentence = buildFallbackCard(makeCard({ lowConfidence: true })).sentences["Scenic"];
    expect(sentence).toMatch(/may|limited/i);
  });

  it("down direction with lowConfidence hedges further", () => {
    const sentence = buildFallbackCard(makeCard({ lowConfidence: true })).sentences["Budget fit"];
    expect(sentence).toMatch(/may not|worth exploring/i);
  });

  it("produces distinct sentences for different dimensions", () => {
    const dims: Array<{ dim: PromptDimensionFact["dim"]; label: string }> = [
      { dim: "scenic", label: "Scenic" },
      { dim: "calm", label: "Calm" },
      { dim: "social", label: "Social" },
      { dim: "workation", label: "Workation" },
      { dim: "adventure", label: "Adventure" },
    ];
    const sentences = dims.map(({ dim, label }) => {
      const card = makeCard({
        targetReasons: [{ label, direction: "up" }],
        facts: [makeFact(dim, { label, strength: "strong" })],
      });
      return buildFallbackCard(card).sentences[label] ?? "";
    });
    const unique = new Set(sentences);
    expect(unique.size).toBe(sentences.length);
  });
});
