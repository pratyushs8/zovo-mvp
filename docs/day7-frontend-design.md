# Day 7 Frontend Design — Intake Flow

Implementation notes for the ZoCo intake UI.
Covers the landing page, the 5-step intake flow, session persistence, the answer→request mapping, and what is deferred to Day 8.
Implemented in `src/app/`, `src/components/intake/`, `src/hooks/`, `src/lib/`, and `src/components/dev/`.

---

## Contents

1. [Flow structure](#1-flow-structure)
2. [Component structure](#2-component-structure)
3. [Session persistence design](#3-session-persistence-design)
4. [Answer → request schema mapping](#4-answer--request-schema-mapping)
5. [Validation and safeguards](#5-validation-and-safeguards)
6. [Developer test harness](#6-developer-test-harness)
7. [Assumptions](#7-assumptions)
8. [Deferred to Day 8](#8-deferred-to-day-8)

---

## 1. Flow structure

### Pages

| Route      | File                      | Purpose                                           |
| ---------- | ------------------------- | ------------------------------------------------- |
| `/`        | `src/app/page.tsx`        | Landing — Zostel mark, headline, CTA to `/intake` |
| `/intake`  | `src/app/intake/page.tsx` | 5-step intake orchestrator                        |
| `/results` | _(Day 8)_                 | Ranked recommendation list                        |

### Intake sequence

```
/             → user clicks "Find my stay →"
/intake       → Q1 persona  (required)
              → Q2 priority (required)
              → Q3 social energy (required)
              → Q4 room type (required)
              → Q5 budget   (optional — skippable)
              → POST /api/recommend
/results      → ranked list (Day 8)
```

Each step renders one question from `QUESTIONS` in `src/config/questions.ts`. The step index is stored in session state and persisted to localStorage. Navigating back never loses answers — prior selections are restored from the same session object.

### Question configuration

Questions are driven by the `QUESTIONS` array. Each entry declares:

| Field          | Type                               | Purpose                                            |
| -------------- | ---------------------------------- | -------------------------------------------------- |
| `id`           | `string`                           | Stable identifier                                  |
| `requestField` | `keyof IntakeAnswers`              | Maps directly to the `RecommendationRequest` field |
| `label`        | `string`                           | Heading shown to the user                          |
| `required`     | `boolean`                          | Whether skipping is allowed                        |
| `options`      | `QuestionOption[]`                 | Selectable answers with `value` and `label`        |
| `resolveVia`   | `"persona_lookup" \| "direct_map"` | How the engine uses the answer (not UI-relevant)   |

The UI never has its own answer shape — it writes directly into `IntakeAnswers`, which is `Partial<Omit<RecommendationRequest, "sessionId">>`.

---

## 2. Component structure

### Component tree

```
IntakePage  (src/app/intake/page.tsx)
├── ProgressIndicator        — header bar + back button
├── [persistence warning]    — amber banner when DB sync fails
├── QuestionRenderer         — question heading + option group
│   └── OptionGroup          — accessible radio group
├── [submit error]           — red inline error text
├── NavControls              — primary CTA + optional skip
└── IntakeDebugPanel         — dev-only, tree-shaken in production
```

### Component responsibilities

**`ProgressIndicator`** (`src/components/intake/ProgressIndicator.tsx`)

Renders a full-width progress bar and the step counter. Owns the Back button — it is placed in the header rather than the CTA area so forward/back have distinct visual zones. Props: `current`, `total`, `onBack` (undefined on step 1), `isLoading`.

The fill bar uses `transition-[width] duration-300 ease-out` on a `style={{ width: \`${pct}%\` }}`inline style. The`role="progressbar"`attribute carries`aria-valuenow`, `aria-valuemin`, and `aria-valuemax` for screen readers.

**`QuestionRenderer`** (`src/components/intake/QuestionRenderer.tsx`)

Renders the "OPTIONAL" badge (when `!question.required`), the question heading, and the `OptionGroup`. The heading receives a forwarded `ref` so `IntakePage` can call `.focus()` on each step transition — this is the primary focus-management mechanism for keyboard and assistive-technology users.

**`OptionGroup`** (`src/components/intake/OptionGroup.tsx`)

Implements the ARIA radio group pattern: `role="radiogroup"` on the container, `role="radio"` + `aria-checked` on each button. Roving tabindex: only the selected option (or the first option when nothing is selected) is in the tab order; arrow keys move focus within the group without requiring Tab.

Layout is determined by option count: ≥ 4 options → 2-column grid; < 4 → single-column stack.

**`NavControls`** (`src/components/intake/NavControls.tsx`)

The primary CTA and optional skip button. CTA label adapts: "Continue →" on steps 1–4, "Find my stay →" on step 5, "Finding stays…" while loading. The CTA is `disabled` when no answer is selected; a hint text ("Pick one of the options above to continue") appears below it when the question is required and unanswered. The skip button only renders for optional questions.

---

## 3. Session persistence design

### Two-layer persistence

| Layer                     | What it stores                                    | When it's written                          | When it's read                                              |
| ------------------------- | ------------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------- |
| localStorage              | Full `IntakeSession` (answers + step + sessionId) | On every answer or step change             | On page load (once, via `useEffect`)                        |
| Postgres `sessions` table | `intake_step`, `intake_answers`                   | Non-blocking PATCH after each step advance | Not read client-side; available for Day 8 server-side logic |

localStorage is the source of truth for the active flow. The DB copy is best-effort — if it fails, the user continues uninterrupted. If the DB write fails at session creation, the page shows an amber non-blocking warning and retries once at submit time.

### `IntakeSession` schema

```ts
interface IntakeSession {
  version: number; // schema version — bump to discard stale localStorage
  sessionId: string; // UUID, generated once on first visit
  answers: IntakeAnswers;
  currentStep: number; // 0-indexed
}
```

`SCHEMA_VERSION = 1`. `isValidSession()` guards the load path — any entry with a different version is discarded and a fresh session is created. This prevents silent bugs when the answer shape changes between deploys.

### `useIntakeSession` hook

Lives in `src/hooks/useIntakeSession.ts`. Provides:

| Export                       | Purpose                                                                                                      |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `session`                    | Current `IntakeSession`                                                                                      |
| `isLoaded`                   | `false` until localStorage has been read; page renders `null` until true                                     |
| `setAnswer(field, value)`    | Generic setter — type `K extends keyof IntakeAnswers` ensures each field only accepts its correct union type |
| `goToStep(step)`             | Advances or retreats; writes localStorage                                                                    |
| `clearSession()`             | Removes localStorage entry, creates a fresh session in state                                                 |
| `fillAnswers(answers, step)` | Dev-only batch setter used by `IntakeDebugPanel`                                                             |

All state mutations use functional `setSession(prev => ...)` updates to avoid stale-closure bugs in the concurrent async paths (DB sync + submit running together).

### Session row lifecycle

```
Page loads
  → useEffect fires after isLoaded
  → POST /api/session (upsert by sessionId — idempotent)
  → setSessionSynced(true | false)

Each step advance
  → PATCH /api/session { sessionId, step, answers }  — fire-and-forget

Submit
  → if sessionSynced === false: retry POST /api/session
  → if retry fails: surface error, abort submit
  → POST /api/recommend (FK requires session row to exist)
```

The FK constraint on `recommendation_requests.session_id → sessions.id` is why `createSession` must succeed before `submitRecommendation`. Retrying at submit time rather than blocking the intake flow keeps the UX smooth for the common case (transient connectivity issue early, resolved by the time the user finishes).

---

## 4. Answer → request schema mapping

### Type chain

```
string (button click)
  → setAnswer<K>(field, value as Required<IntakeAnswers>[K])   ← one cast in intake/page.tsx
  → IntakeAnswers (partial, accumulated across steps)
  → buildRequest(session) → RecommendationRequest | null       ← Zod validates
  → POST /api/recommend
```

### `IntakeAnswers`

```ts
type IntakeAnswers = Partial<Omit<RecommendationRequest, "sessionId">>;
```

There is no separate UI-only shape. Answers accumulate directly into the fields the API expects. `sessionId` is the only field not answered by the user — it comes from the session object.

### `buildRequest()`

Lives in `src/lib/buildRequest.ts`. Merges `sessionId` with `session.answers` and runs `recommendationRequestSchema.safeParse`. Returns the typed `RecommendationRequest` on success, `null` on any validation failure. Using the same Zod schema as the API boundary means client-side and server-side validation can never diverge.

```ts
export function buildRequest(session: IntakeSession): RecommendationRequest | null {
  const result = recommendationRequestSchema.safeParse({
    sessionId: session.sessionId,
    ...session.answers,
  });
  return result.success ? result.data : null;
}
```

### Question-to-field mapping

| Step | Question                           | `requestField` | Required |
| ---- | ---------------------------------- | -------------- | -------- |
| 1    | What kind of trip is this?         | `personaKey`   | ✓        |
| 2    | What matters most about your stay? | `priority`     | ✓        |
| 3    | How social do you want to be?      | `socialEnergy` | ✓        |
| 4    | Which room type do you prefer?     | `roomType`     | ✓        |
| 5    | What's your budget comfort level?  | `budget`       | —        |

`budget` is optional on both the UI (`question.required = false`, skip button shown) and the schema (`budget` is `z.optional()` in `recommendationRequestSchema`). The engine applies a default budget weight when the field is absent.

---

## 5. Validation and safeguards

### Required question enforcement

The CTA is `disabled` when `!hasSelection`. A hint — "Pick one of the options above to continue" — renders below the disabled button when `isRequired` is true, giving users a clear signal rather than a grey button with no explanation. The hint disappears the moment an option is selected.

### Session sync failure handling

`createSession` throws on non-2xx. The page tracks `sessionSynced: boolean | null`:

- `null` — pending (no flash shown to user)
- `true` — synced; no UI change
- `false` — failed; amber `role="status"` banner: _"Your answers are saved locally. We'll sync them when you submit."_

At submit time, if `sessionSynced === false`, one retry is attempted before calling `/api/recommend`. If the retry also fails, the submit is aborted with: _"We couldn't reach the server. Check your connection and try again."_

### Submit error messaging

Raw API error codes are mapped to human-readable strings in `friendlyError()`:

| Raw error           | Displayed message                                           |
| ------------------- | ----------------------------------------------------------- |
| `internal_error`    | "Something went wrong on our end. Please try again."        |
| `validation_failed` | "Some answers look invalid. Please go back and check them." |
| `HTTP 5xx`          | "Our server had a hiccup. Please try again in a moment."    |
| `HTTP 4xx`          | "Your session may have expired. Try refreshing the page."   |

---

## 6. Developer test harness

`IntakeDebugPanel` (`src/components/dev/IntakeDebugPanel.tsx`) is a collapsible fixed-bottom overlay rendered only when `process.env.NODE_ENV === "development"`. Next.js replaces this constant at build time, so the component and its imports are fully tree-shaken from production bundles.

### Panel features

- **Session info** — full `sessionId`, sync status with colour coding (green/red/yellow), current step and field name
- **Step jump** — numbered buttons 1–5 to teleport without clicking through
- **Live answer viewer** — formatted JSON of `session.answers` with a toggle to show the raw localStorage string
- **`buildRequest()` status** — shows ✓ valid or ✗ null (with reason) in real time as answers accumulate
- **Presets** — four named fixtures covering distinct personas and completion states:

| Preset                        | Covers                                     |
| ----------------------------- | ------------------------------------------ |
| Solo social (full)            | All 5 fields answered, lands on Q5         |
| Couple retreat                | Private room, scenic priority, with budget |
| Budget backpacker (no budget) | Required fields only, no budget answer     |
| Workation (required only)     | `work_setup` priority, private room        |

- **Clear session + reload** — removes localStorage and reloads; useful for testing the initial session creation path and the schema-version discard guard

---

## 7. Assumptions

**LocalStorage is available.** The hook has a try/catch around every localStorage access and falls back to in-memory state silently. SSR is handled by the `isLoaded` guard — the page renders `null` until the client has read storage. This is correct for a `"use client"` page but means the intake route is not statically renderable.

**UUIDs are v4.** `crypto.randomUUID()` in modern browsers always produces v4 UUIDs. The Zod schema validates the version nibble (`[1-8]`) and variant nibble (`[89ab]`). If an older browser generates a non-conforming UUID, `buildRequest()` will return `null` and the user will see a validation error — this is a known edge case acceptable for MVP.

**Session is single-device, single-tab.** There is no conflict resolution for the same session being open in two tabs. The last write wins in localStorage; the DB is not used to reconcile. Acceptable for the intake use case.

**One active session per browser.** `STORAGE_KEY = "zoco_intake_session"` is a single slot. Starting a new flow overwrites the previous session. The old `sessionId` remains in Postgres but is orphaned. This is intentional — there is no "resume" flow at MVP.

---

## 8. Deferred to Day 8

### Results page (`/results`)

`submit()` in `intake/page.tsx` does:

```ts
sessionStorage.setItem("zoco_results", JSON.stringify(response));
router.push("/results");
```

The results page must read `sessionStorage.getItem("zoco_results")` on load and render the `RecommendationResponse`. If this key is absent (e.g. direct navigation), the page should redirect to `/` or `/intake`.

### `RecommendationResponse` rendering

The API returns a ranked list of properties with match scores and explanations. Day 8 must decide:

- how many results to show (API returns up to 5)
- what to show per card (name, location, score, explanation excerpt, booking link)
- how to handle an empty result set (all properties filtered out)

### Retry UX on submit failure

Currently, a submit error shows an inline message. Day 8 may want to add a retry button rather than requiring the user to click "Find my stay →" again after dismissing the error.

### Session expiry

There is no TTL on the localStorage session or the Postgres row. Day 8 or later should define when a session is considered stale on the server side (e.g. 24 hours) so `recommendation_requests` rows can be associated with a valid session even after a long pause.

### `updateSessionProgress` error surfacing

PATCH calls to `/api/session` swallow errors silently. For MVP this is fine, but if Day 8 adds a "resume from where you left off" feature, these errors become relevant and should be tracked.
