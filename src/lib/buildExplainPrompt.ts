// Builds the system + user message pair sent to the model for one batch of cards.
// Pure function — no I/O, no side effects. Testable in isolation.

import type { PromptCard } from "@/types/explain";

// ─── System prompt ────────────────────────────────────────────────────────────

export const EXPLAIN_SYSTEM_PROMPT = `You write short, grounded explanation copy for a travel recommendation app.

Rules you must follow without exception:
- Write only from the supplied dimension facts. Do not use any knowledge you have about specific hostels, properties, or destinations from your training data — if you recognise a property name or location, disregard that knowledge entirely.
- Do not invent or imply availability, price, ratings, reviews, popularity, or booking status.
- Do not use phrases like "highly rated", "popular", "great reviews", "always booked", "reasonably priced", "better than most", "stands out", or any comparative or evaluative claim not derivable from the supplied facts.
- If a dimension fact has strength "weak" (gap > 0.4), do not assert the property has that quality — only say it may or could. Do not infer from a weak signal.
- If the facts are weak (gap > 0.4, strength "weak", or lowConfidence true), keep language modest: "may suit", "could work for", "tends toward". Do not project certainty.
- cardSummary must be one sentence, max 120 characters, grounded in the strongest matching dimension.
- Each cardSummary must have a distinct tone and structure — vary sentence openings, rhythm, and angle across cards. Never repeat the same sentence pattern. Do not use filler phrases like "matches what you described", "based on your preferences", "a great fit for you", or "tailored to your needs". Lead with what makes the property itself interesting, not with how it relates to the user.
- Each reason sentence must be one plain-English sentence, max 100 characters. Write only for the labels listed in targetReasons.
- Return valid JSON. No markdown fences, no prose outside the JSON object.`;

// ─── User message builder ─────────────────────────────────────────────────────

export function buildExplainUserMessage(cards: PromptCard[]): string {
  const cardBlocks = cards
    .map((c) => {
      const facts = c.facts
        .map(
          (f) =>
            `  - ${f.label}: user=${f.userValue.toFixed(2)} property=${f.propertyValue.toFixed(2)} gap=${f.gap.toFixed(2)} strength=${f.strength} direction=${f.direction}`
        )
        .join("\n");

      const targets = c.targetReasons.map((r) => `  - "${r.label}" (${r.direction})`).join("\n");

      const confidenceNote = c.lowConfidence
        ? "  ⚠ lowConfidence=true — use modest language (may suit / could work for)"
        : "";

      return [
        `### Card id=${c.propertyId} — ${c.title} (${c.location})`,
        `Score: ${c.score.toFixed(3)}${confidenceNote ? "\n" + confidenceNote : ""}`,
        `Dimension facts:\n${facts}`,
        `Write sentences only for these reason chips:\n${targets}`,
      ].join("\n");
    })
    .join("\n\n");

  const schema = JSON.stringify(
    {
      cards: [
        {
          id: "<number — matches input Card id>",
          cardSummary: "<one sentence, max 120 chars, grounded in top match dimension>",
          reasons: [
            {
              label: "<exact label from targetReasons>",
              sentence: "<one sentence, max 100 chars>",
            },
          ],
        },
      ],
    },
    null,
    2
  );

  return `${cardBlocks}

---
Return a JSON object matching this schema exactly:
${schema}`;
}
