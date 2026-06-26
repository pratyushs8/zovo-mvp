# Day 9 — LLM Explanation Layer

Generates short, grounded explanation copy for recommendation cards. The explanation layer runs as a second, non-blocking request after the Day 8 shortlist is already rendered. It never delays or modifies the ranking result.

---

## Contents

1. [System overview](#1-system-overview)
2. [Input/output contract](#2-inputoutput-contract)
3. [Prompt strategy and guardrails](#3-prompt-strategy-and-guardrails)
4. [Responses API integration flow](#4-responses-api-integration-flow)
5. [Validation and sanitization rules](#5-validation-and-sanitization-rules)
6. [Deterministic fallback behavior](#6-deterministic-fallback-behavior)
7. [Observability](#7-observability)
8. [Ranking/explanation separation](#8-rankingexplanation-separation)
9. [Deferred to later days](#9-deferred-to-later-days)

---

## 1. System overview

```
/results page renders (Day 8 shortlist visible)
    │
    │  useEffect fires after response is set
    ▼
fetchExplanations({ cards, debug })    POST /api/explain
    │
    ▼
/api/explain (route handler)
    │  validateBody()
    │  generateExplanations(cards, debugCards, userVector)
    │     ├── buildPromptCard() × N    ← assembles grounded facts from Day 8 data
    │     ├── callResponsesAPI()       ← one call covers all cards
    │     │     └── on failure → buildFallbackCard() × N
    │     ├── JSON.parse(output_text)
    │     │     └── on failure → buildFallbackCard() × N
    │     └── per card:
    │           ├── validateModelCard()  → sanitize + validate each text field
    │           │     └── on failure → buildFallbackCard()
    │           └── promoteToExplained()
    ▼
ExplainResponse { cards: ExplainedCard[] }
    │
    ▼
ResultsContent.mergeExplanation()
    │  card.summary    ← ex.cardSummary
    │  reason.sentence ← ex.sentences[reason.label]
    └── ranking chip metadata (label, strength, direction) preserved unchanged
```

### Key files

| Concern                     | File                                            |
| --------------------------- | ----------------------------------------------- |
| Main service                | `src/services/explanation.ts`                   |
| Route handler               | `src/app/api/explain/route.ts`                  |
| Prompt builder              | `src/lib/buildExplainPrompt.ts`                 |
| Deterministic fallback      | `src/lib/deterministicCopy.ts`                  |
| Validation and sanitization | `src/lib/validateExplanationText.ts`            |
| OpenAI client singleton     | `src/lib/openaiClient.ts`                       |
| Observability               | `src/lib/explainLogger.ts`                      |
| Types                       | `src/types/explain.ts`                          |
| Client-side fetch + merge   | `src/app/results/ResultsContent.tsx`            |
| Card rendering              | `src/components/results/RecommendationCard.tsx` |

---

## 2. Input/output contract

### Request — `POST /api/explain`

Defined in `src/types/explain.ts` as `ExplainRequest`.

```typescript
interface ExplainRequest {
  cards: StayCard[]; // Day 8 shortlist, order preserved
  debug: {
    userVector: ScoringVector;
    cards: StayDebug[]; // one entry per card, carries breakdown and explanation
  };
}
```

`StayDebug` carries two fields the prompt builder reads:

- `breakdown: ScoringBreakdown` — per-dimension `{ propertyValue, gap }` values
- `explanation: PropertyExplanation` — pre-classified `dimensions`, `topMatches`, `topMisses` from Day 8

### Response — `ExplainResponse`

```typescript
interface ExplainResponse {
  cards: ExplainedCard[];
}

interface ExplainedCard {
  id: number;
  cardSummary: string; // one sentence ≤120 chars after sanitization
  sentences: Record<string, string>; // chip label → one sentence ≤100 chars
  explanationSource: "model" | "fallback";
}
```

`explanationSource` is always set. The UI does not render it, but it is available to `ResultsDebugPanel` and the observability layer.

### `PromptCard` (server-only intermediate type)

`buildPromptCard()` assembles a `PromptCard` from `StayCard` + `StayDebug` + `ScoringVector`. This type is never sent to the client — it exists only to carry grounded facts into the prompt and into `buildFallbackCard()`.

```typescript
interface PromptCard {
  propertyId: number;
  title: string;
  location: string;
  score: number;
  lowConfidence: boolean;
  targetReasons: Array<{ label: string; direction: "up" | "down" }>;
  facts: PromptDimensionFact[]; // one entry per dimension (all 7)
}

interface PromptDimensionFact {
  dim: DimensionKey;
  label: string;
  userValue: number;
  propertyValue: number;
  gap: number;
  strength: "strong" | "moderate" | "weak";
  direction: "up" | "down";
}
```

### Direction resolution

Direction for each fact is resolved in priority order inside `buildPromptCard()`:

1. **Chip direction from `card.reasons`** — the source of truth. Day 8 already determined which way to present each chip.
2. **`debug.explanation.topMatches` / `topMisses`** — if the dimension was classified by the ranking pipeline.
3. **Gap threshold fallback** — `gap ≤ 0.3 → "up"`, otherwise `"down"`. Only reached for dimensions that appear in neither chips nor the Day 8 classification.

Strength is always taken from `debug.explanation.dimensions` (pre-classified by `classifyStrength()` using the same thresholds as the ranking engine). It is never recomputed locally from the gap.

---

## 3. Prompt strategy and guardrails

### System prompt

```
You write short, grounded explanation copy for a travel recommendation app.

Rules you must follow without exception:
- Write only from the supplied facts. Do not invent or imply availability, price,
  ratings, reviews, popularity, or booking status.
- Do not use phrases like "highly rated", "popular", "great reviews",
  "always booked", "reasonably priced", or any claim not derivable from
  the supplied dimension facts.
- If the facts are weak (gap > 0.4, strength "weak", or lowConfidence true),
  keep language modest: "may suit", "could work for", "tends toward".
  Do not project certainty.
- cardSummary must be one sentence, max 120 characters, grounded in the
  strongest matching dimension.
- Each reason sentence must be one plain-English sentence, max 100 characters.
  Write only for the labels listed in targetReasons.
- Return valid JSON. No markdown fences, no prose outside the JSON object.
```

### User message structure

One user message covers all cards in a batch. Each card block contains:

- Card id, title, and location (for grounding — not for tone or framing)
- Overall score (numeric — model uses this to calibrate language weight)
- A `⚠ lowConfidence=true` warning when applicable
- All 7 dimension facts formatted as: `label: user=N property=N gap=N strength=S direction=D`
- The `targetReasons` list: the exact chip labels and directions the model must cover

The message ends with the required output schema repeated verbatim so the model can match it structurally.

### Why this design

**Grounded only on structured facts.** The model receives numeric scores and pre-classified labels — not open-ended property descriptions. This makes hallucination harder: the model cannot invent claims that would require knowledge it was not given.

**One call per batch.** All cards are sent in a single Responses API call rather than one call per card. This cuts latency and cost, and keeps the batch pattern simple to reason about.

**Structural output, not instructed JSON.** The prompt uses `text: { format: { type: "json_object" } }` to constrain the model output format at the API level, not just by instruction. The returned `output_text` is still validated per-card on the server — format constraint reduces the parse failure rate but does not replace validation.

---

## 4. Responses API integration flow

### Client singleton

`getOpenAIClient()` in `src/lib/openaiClient.ts` returns a lazy singleton. The client is constructed with `OPENAI_API_KEY` from the validated env schema (`src/lib/env.ts`). Tests inject a fake via `setOpenAIClient(mock)` and reset with `setOpenAIClient(null)`.

```typescript
export const EXPLAIN_MODEL = "gpt-4o-mini";
export const EXPLAIN_TIMEOUT_MS = 15_000;
```

### Call shape

```typescript
client.responses.create(
  {
    model: EXPLAIN_MODEL,
    instructions: EXPLAIN_SYSTEM_PROMPT,
    input: buildExplainUserMessage(promptCards),
    text: { format: { type: "json_object" } },
    max_output_tokens: 1024,
  },
  { timeout: EXPLAIN_TIMEOUT_MS }
);
```

`max_output_tokens: 1024` is sufficient for a batch of five cards at the stated per-field character limits.

### Failure classification

`callResponsesAPI()` returns a typed result rather than throwing:

| Result shape                              | Meaning                         |
| ----------------------------------------- | ------------------------------- | ------------ |
| `{ text: string; durationMs: number }`    | Success — proceed to JSON parse |
| `{ text: null; category: "api_timeout" }` | Error message matched `/timeout | ETIMEDOUT/i` |
| `{ text: null; category: "api_error" }`   | Any other thrown error          |

Both `null` results trigger a full-batch fallback. `durationMs` is included in both branches so the batch summary always has timing regardless of outcome.

### Non-blocking client-side pattern

`ResultsContent` fires the explain request in a second `useEffect` that runs after `response` is set. The `.catch(() => {})` handler silently keeps the Day 8 cards unchanged — no loading spinner, no error state. The explanation upgrade is a progressive enhancement, not a prerequisite.

---

## 5. Validation and sanitization rules

Every text field in the model response passes through `sanitizeAndValidate()` in `src/lib/validateExplanationText.ts` before the card is accepted. A single field failure rejects the entire card and triggers fallback for that card only.

### Step 1 — sanitize

Strips formatting artifacts the model may emit despite instructions:

| Pattern                   | Action                       |
| ------------------------- | ---------------------------- |
| `**bold**`                | Strip markers, keep text     |
| `*italic*`                | Strip markers, keep text     |
| `` `inline code` ``       | Strip markers, keep text     |
| ` ```lang\ncontent\n``` ` | Strip fence, keep content    |
| `[text](url)`             | Strip link, keep label text  |
| `## Heading`              | Strip `#` markers            |
| `> blockquote`            | Strip `>` marker             |
| `---` (HR)                | Remove                       |
| `<strong>...</strong>`    | Strip HTML tags              |
| `&amp;` `&lt;` etc.       | Decode HTML entities         |
| `"` `"` `'` `'`           | Normalise to straight quotes |
| Multiple whitespace       | Collapse to single space     |

Sanitization is length-neutral — it never truncates. Validation runs on the clean string.

### Step 2 — validate

**Length check.** `cardSummary` and `sentences` each use `maxLength: 200` at the API layer (the prompt instructs shorter limits — 120 and 100 — but the validator enforces a generous hard cutoff to catch egregious overruns). Text exceeding `maxLength` is rejected, not truncated.

**Empty check.** Empty or whitespace-only text is rejected.

**Unsupported fact patterns.** Rejected regardless of confidence level:

| Category        | Example patterns rejected                               |
| --------------- | ------------------------------------------------------- |
| Specific prices | `₹1500`, `2000 INR`, `800 per night`, `priced at`       |
| Availability    | `sold out`, `fully booked`, `fills up fast`, `book now` |
| Ratings         | `4.5/5`, `300 reviews`, `highly rated`, `great reviews` |
| Popularity      | `popular`, `well-known`, `trending`, `famous`           |

**Overconfidence patterns** (only when `lowConfidence: true`):

| Pattern                 | Example rejected text               |
| ----------------------- | ----------------------------------- |
| `perfect` / `perfectly` | "The perfect stay for your trip."   |
| `ideal` / `ideally`     | "An ideal base for exploring."      |
| Certainty adverbs       | "Definitely suits your preference." |
| Future-tense certainty  | "Will suit your calm preference."   |
| Exact-match claims      | "Exactly what you're looking for."  |

Hedged phrases (`may suit`, `could work`, `tends toward`, `possibly`) always pass.

### Structural checks

`validateModelCard()` runs structural checks before text checks:

- `cardSummary` must be a `string`
- `reasons` must be an array
- Each reason must have `label: string` and `sentence: string`
- No label may be one the model invented — only labels from `targetReasons` are permitted
- Every label in `targetReasons` must have a corresponding sentence (partial coverage rejects the card)

---

## 6. Deterministic fallback behavior

`buildFallbackCard()` in `src/lib/deterministicCopy.ts` is the fallback for every failure mode. It produces an `ExplainedCard` with `explanationSource: "fallback"` from structured data alone — no model call, no I/O.

**Quality bar:** the copy reads like a helpful travel recommendation, not a scoring diagnostic. It is designed to be shippable standalone.

### Sentence templates

Per-dimension sentence templates cover every `(direction, strength)` combination:

```
dimension × direction × strength
  → 7 dims × (up: strong | moderate | weak + down) = 28 template slots
```

Example for `scenic`:

| Direction | Strength | Sentence                                                                       |
| --------- | -------- | ------------------------------------------------------------------------------ |
| up        | strong   | "The setting matches the kind of scenic backdrop you said you're looking for." |
| up        | moderate | "Good scenery here — fits well with what you described."                       |
| up        | weak     | "Some scenic value, though not as dramatic as your ideal."                     |
| down      | —        | "Less scenic than you'd prefer — worth knowing before you book."               |

`down` sentences are always hedged further when `lowConfidence: true` or `strength: "weak"`:

> "May not fully match your [label] preference, but worth exploring."

`up` sentences when `lowConfidence: true`:

> "This property may suit your [label] preference — limited data available."

### Card summary

`buildCardSummary()` constructs a single sentence from the top one or two up-direction facts using short adjective fragments (`scenic`, `peaceful`, `sociable`, `remote-work-friendly`, `adventure-ready`). `budget_fit` and `room_type_fit` are excluded from summaries — `budget_fit` would imply a price claim and `room_type_fit` reads too clinical in a summary sentence.

**Location extraction.** `cityFromLocation()` strips state names from the location string:

- `"Old Manali, Manali"` → `"Manali"` (last segment is destination-level)
- `"Bir, Himachal Pradesh"` → `"Bir"` (last segment is a state name → use first)

**Fallback paths within the summary:**

| Condition                                          | Output                                                                     |
| -------------------------------------------------- | -------------------------------------------------------------------------- |
| No usable up facts                                 | `"A Zostel stay in {city}."`                                               |
| No usable up facts + lowConfidence                 | `"A possible match in {city} — limited data, so worth checking directly."` |
| All up facts are weak OR lowConfidence             | `"A possibly {fragment} option in {city} — less data on this one."`        |
| Two strong/moderate up facts (combined ≤120 chars) | `"A {f1} and {f2} stay in {city} that matches what you described."`        |
| Single strong/moderate up fact                     | `"A {fragment} stay in {city} that matches what you described."`           |

---

## 7. Observability

`src/lib/explainLogger.ts` provides two functions with typed failure categories.

### Failure categories

```typescript
type ExplainFailureCategory =
  | "api_error" // network error, auth failure, rate limit, server 5xx
  | "api_timeout" // request exceeded EXPLAIN_TIMEOUT_MS
  | "json_parse" // model returned non-JSON or structurally invalid envelope
  | "validation" // per-card text failed sanitize/validate checks
  | "missing_card"; // model returned fewer cards than were requested
```

### Emission rules

| Environment | Per-card failures | Batch summary                           |
| ----------- | ----------------- | --------------------------------------- |
| Local       | `console.warn`    | `console.info` + failure breakdown      |
| Staging     | `console.warn`    | `console.info` + failure breakdown      |
| Production  | silent            | `console.info` only when `fallback > 0` |

Production is quiet on a clean run. The batch summary fires in production whenever any card fell back, which covers the cases worth investigating.

### Batch summary fields

```typescript
interface ExplainBatchSummary {
  total: number;
  model: number;
  fallback: number;
  durationMs: number; // wall-clock time from buildPromptCard to final results
  failures: ExplainFailure[];
}
```

`durationMs` covers the full `generateExplanations()` call including prompt assembly, API round-trip, and per-card validation. It is available even when the API call fails (recorded per `callResponsesAPI()`).

---

## 8. Ranking/explanation separation

The explanation layer is structurally prevented from corrupting the ranking result.

**`ExplainedCard` carries no ranking fields.** The type is:

```typescript
interface ExplainedCard {
  id: number;
  cardSummary: string;
  sentences: Record<string, string>;
  explanationSource: "model" | "fallback";
}
```

There is no `reasons: CardReason[]` on `ExplainedCard` — physically impossible to overwrite `direction` or `strength` through this type.

**`mergeExplanation()` is additive only.** The client-side merge in `ResultsContent` applies explanation copy without touching chip metadata:

```typescript
return {
  ...card,
  summary: ex.cardSummary,
  reasons: card.reasons.map((r) => ({ ...r, sentence: ex.sentences[r.label] })),
};
```

`card.reasons[i].direction`, `.strength`, and `.label` are never replaced. Only `.sentence` is added.

**Failure never blocks the shortlist.** The explain request is fire-and-forget from the client. If it fails (network, timeout, API error, or validation), the Day 8 cards remain visible with their original `summary` text. No error state is shown.

**Order is always the input order.** `generateExplanations()` iterates `cards.map((card, i) => ...)` and aligns `promptCards[i]` by construction. Model output order is irrelevant — the result array always matches the input.

---

## 9. Deferred to later days

| Item                             | Reason deferred                                                                                                                                                                                                 |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Streaming explanation updates    | Adds client complexity; progressive enhancement is already smooth with the second-`useEffect` pattern                                                                                                           |
| Prompt caching                   | All batches differ (different user vectors, different cards) — cache hit rate would be negligible until traffic volume justifies measurement                                                                    |
| Explanation quality A/B testing  | Requires an analytics event (`explanation_shown`, `explanation_source`) and a variant flag — Day 12 QA will identify whether the model copy is good enough before wiring this                                   |
| Per-sentence confidence display  | UI design not finalised — tooltip is a placeholder; richer treatment (e.g. fade-in, source badge) belongs in a UI polish pass                                                                                   |
| Model output caching by property | Explanation depends on `userVector` — two users looking at the same property get different sentences. Caching would require a key that includes user preferences, which has privacy implications not yet scoped |
| Retry on validation failure      | Current design falls back immediately on any per-card failure. A re-prompt with the rejection reason could recover some of these — deferred until Day 12 QA data shows whether the failure rate justifies it    |
| Non-English output               | System prompt is English-only; locale handling is a Day 13+ concern                                                                                                                                             |
