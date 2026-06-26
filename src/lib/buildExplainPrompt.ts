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
- cardSummary must be one to two sentences, 200–300 characters, grounded in the strongest matching dimension.
- Each cardSummary must feel like it was written by a different writer — vary the angle, rhythm, and structure dramatically across cards. Some cards should open with location/setting, some with the type of traveler it suits, some with a specific detail or contrast, some with a punchy single observation. Never start two cards the same way. Never use: "matches what you described", "based on your preferences", "a great fit for you", "tailored to your needs", "a sociable and peaceful", "a peaceful and remote-work-friendly", or any phrase that follows the pattern "[adjective] and [adjective] stay in [city]". Lead with what makes the property itself vivid and specific.
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
          cardSummary: "<one to two sentences, 200–300 chars, grounded in top match dimension>",
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
