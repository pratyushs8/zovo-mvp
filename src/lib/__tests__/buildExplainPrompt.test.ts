import { buildExplainUserMessage, EXPLAIN_SYSTEM_PROMPT } from "@/lib/buildExplainPrompt";
import type { PromptCard } from "@/types/explain";

function makeCard(overrides: Partial<PromptCard> = {}): PromptCard {
  return {
    propertyId: 1,
    title: "Zostel Manali",
    location: "Old Manali, Manali",
    score: 0.82,
    lowConfidence: false,
    targetReasons: [
      { label: "Scenic", direction: "up" },
      { label: "Calm", direction: "up" },
    ],
    facts: [
      {
        dim: "scenic",
        label: "Scenic",
        userValue: 0.9,
        propertyValue: 0.85,
        gap: 0.05,
        strength: "strong",
        direction: "up",
      },
      {
        dim: "calm",
        label: "Calm",
        userValue: 0.7,
        propertyValue: 0.6,
        gap: 0.1,
        strength: "strong",
        direction: "up",
      },
    ],
    ...overrides,
  };
}

describe("EXPLAIN_SYSTEM_PROMPT", () => {
  it("contains hallucination guardrails", () => {
    expect(EXPLAIN_SYSTEM_PROMPT).toMatch(/price/i);
    expect(EXPLAIN_SYSTEM_PROMPT).toMatch(/availability/i);
    expect(EXPLAIN_SYSTEM_PROMPT).toMatch(/ratings/i);
  });

  it("instructs model to return valid JSON only", () => {
    expect(EXPLAIN_SYSTEM_PROMPT).toMatch(/valid JSON/i);
  });
});

describe("buildExplainUserMessage", () => {
  it("includes property title and location", () => {
    const msg = buildExplainUserMessage([makeCard()]);
    expect(msg).toContain("Zostel Manali");
    expect(msg).toContain("Old Manali, Manali");
  });

  it("lists all targetReason labels", () => {
    const msg = buildExplainUserMessage([makeCard()]);
    expect(msg).toContain('"Scenic"');
    expect(msg).toContain('"Calm"');
  });

  it("includes dimension gap values", () => {
    const msg = buildExplainUserMessage([makeCard()]);
    expect(msg).toContain("gap=0.05");
  });

  it("adds lowConfidence warning when true", () => {
    const msg = buildExplainUserMessage([makeCard({ lowConfidence: true })]);
    expect(msg).toContain("lowConfidence=true");
  });

  it("does not add lowConfidence warning when false", () => {
    const msg = buildExplainUserMessage([makeCard({ lowConfidence: false })]);
    expect(msg).not.toContain("lowConfidence=true");
  });

  it("handles multiple cards", () => {
    const msg = buildExplainUserMessage([makeCard({ propertyId: 1 }), makeCard({ propertyId: 2, title: "Zostel Kasol" })]);
    expect(msg).toContain("id=1");
    expect(msg).toContain("id=2");
    expect(msg).toContain("Zostel Kasol");
  });
});
