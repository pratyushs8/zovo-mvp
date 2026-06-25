# Day 8 Integration — Intake to Shortlist

End-to-end integration connecting the intake form to the recommendation engine and the shortlist results page.
Covers the data flow, API contract, card data model, fallback logic, error handling, and what is deferred to Day 9 and Day 10.

---

## Contents

1. [End-to-end flow](#1-end-to-end-flow)
2. [Request contract](#2-request-contract)
3. [Response contract](#3-response-contract)
4. [Recommendation card data model](#4-recommendation-card-data-model)
5. [Fallback state logic](#5-fallback-state-logic)
6. [Loading, retry, and error handling](#6-loading-retry-and-error-handling)
7. [Diagnostic tooling](#7-diagnostic-tooling)
8. [Assumptions](#8-assumptions)
9. [Deferred to Day 9 and Day 10](#9-deferred-to-day-9-and-day-10)

---

## 1. End-to-end flow

```
/intake (step 5, last question answered)
    │
    │  user taps "Find my stay →"
    ▼
IntakePage.submit()
    │  buildRequest(session) → RecommendationRequest
    │  POST /api/recommend
    ▼
/api/recommend (route handler)
    │  validateRequest()
    │  recommendStays(req)
    │     ├── buildUserVector(req)        → ScoringVector
    │     ├── DB: select property IDs
    │     ├── rankProperties(userVector, candidates)
    │     │     ├── applyHardFilter()
    │     │     ├── scoreProperty() × N
    │     │     ├── generateExplanation() × N
    │     │     └── classifyConfidence()
    │     ├── DB: insert recommendation_requests + recommendation_results
    │     └── buildResponse() → RecommendationResponse
    ▼
IntakePage (receives response)
    │  clearSession()
    │  sessionStorage.setItem("zoco_results", JSON.stringify(response))
    │  router.push(`/results?s=${sessionId}`)
    ▼
/results?s=<uuid>
    ResultsContent (client component)
        │  reads "zoco_results" from sessionStorage
        └── renders: FallbackBanner? + cards[] or EmptyState
```

### Key files

| Concern | File |
|---|---|
| Submit orchestration | `src/app/intake/page.tsx` |
| Request builder | `src/hooks/useIntakeSession.ts` — `buildRequest()` |
| API transport | `src/lib/api.ts` — `submitRecommendation()` |
| Route handler | `src/app/api/recommend/route.ts` |
| Recommendation service | `src/services/recommendation.ts` — `recommendStays()` |
| Ranking engine | `src/lib/rankProperties.ts` |
| User vector builder | `src/lib/buildUserVector.ts` |
| Banner copy | `src/lib/buildBannerMessage.ts` |
| Error copy | `src/lib/friendlyError.ts` |
| Results page (server) | `src/app/results/page.tsx` |
| Results page (client) | `src/app/results/ResultsContent.tsx` |
| Card component | `src/components/results/RecommendationCard.tsx` |

### Session handoff

Results are passed from the API call to the results page via `sessionStorage` rather than a URL parameter or server-side state. This avoids URL length limits and keeps the response opaque to the browser history.

- Key: `"zoco_results"`
- Written by: `IntakePage.submit()` immediately after a successful API call
- Read by: `ResultsContent` on mount via a `useEffect` + `startTransition` pair
- Cleared by: `clearSession()` (clears localStorage intake state); `sessionStorage` is tab-scoped and expires on close

The `?s=<uuid>` URL parameter carries the `sessionId`. It is appended after `clearSession()` to preserve the session ID for the results page without re-reading stale localStorage. If `sessionStorage` is missing (tab refresh or link sharing), the results page detects this via `?s=` presence and shows an "expired" state rather than silently redirecting away.

---

## 2. Request contract

Defined in `src/types/api.ts`.

```ts
interface RecommendationRequest {
  sessionId: string;       // UUID, from useIntakeSession
  personaKey: PersonaKey;  // "solo_social" | "couple_retreat" | ...
  priority: StayPriority;  // "social_vibe" | "work_setup" | ...
  socialEnergy: SocialEnergy; // "very_social" | "balanced" | "mostly_private"
  roomType: RoomType;      // "dorm" | "private" | "flexible"
  budget?: BudgetLevel;    // "lowest" | "moderate" | "flexible" — optional
}
```

`buildRequest()` in `useIntakeSession.ts` assembles this from `session.answers`. It returns `null` if any required field is absent — the submit button is disabled in this state, so a null request reaching `submit()` is treated as a defensive guard.

The `sessionId` is a UUID generated once per intake session and stored in `localStorage`. It links the request to the `sessions` DB row created by `POST /api/session` on intake load.

---

## 3. Response contract

Defined in `src/types/api.ts`. The response has three top-level sections:

```ts
interface RecommendationResponse {
  cards: StayCard[];    // 0–5 UI-facing cards, ranked best-first
  meta: ShortlistMeta; // confidence, fallback mode, banner copy
  _debug: {
    userVector: ScoringVector;          // computed float vector for the user's answers
    rankingExplanation: RankingExplanation; // pool size, filter trace, confidence reason
    cards: StayDebug[];                 // per-card scores and full explanation breakdown
  };
}
```

### `ShortlistMeta`

```ts
interface ShortlistMeta {
  confidence: "high" | "moderate" | "low";
  fallback: "thin_pool" | "weak_match" | "hard_filter_relaxed" | "empty" | null;
  bannerMessage: string | null; // pre-rendered copy, null when no banner needed
  totalFiltered: number;        // properties removed by hard filter
  poolSize: number;             // properties surviving filter, before scoring
}
```

`bannerMessage` is computed server-side by `buildBannerMessage()` (`src/lib/buildBannerMessage.ts`) so the client never branches on `confidence` or `fallback` directly — it just renders the string if non-null.

### `_debug` block

The `_debug` block is part of the API response and is stored in `sessionStorage` alongside the cards. It is **never rendered in the user-facing UI**. Its purpose is:

- **Day 8**: surfaced in the `ResultsDebugPanel` dev tool (development mode only)
- **Day 9**: `_debug.userVector` and `_debug.cards[].explanation` provide the inputs for AI-generated explanation copy without requiring a DB round-trip to re-derive the user vector
- **Day 10**: already forward-compatible (no changes expected)

---

## 4. Recommendation card data model

```ts
interface StayCard {
  id: number;              // DB property ID
  rank: number;            // 1-based position in the shortlist
  title: string;           // property display name, e.g. "Zostel Manali"
  destinationSlug: string; // canonical slug, e.g. "manali" — Day 10 routing
  location: string;        // area within destination, e.g. "Old Manali, Manali"
  summary: string;         // 1–2 sentence property blurb from properties config
  priceInr: number;        // nightly price in INR — Day 10 card display
  reasons: CardReason[];   // match/miss chips, max 2 up + 2 down
  lowConfidence: boolean;  // true when this card's individual score is low
  bookingUrl: string;      // direct link to Zostel property page
}

interface CardReason {
  label: string;                    // human label, e.g. "Social vibe", "Workation"
  strength: "strong" | "moderate" | "weak";
  direction: "up" | "down";        // up = match, down = miss
}
```

### How reasons are computed

Computed server-side in `recommendStays()` from `RankedProperty.explanation`:

```
upReasons   = topMatches where strength !== "weak", up to 2
              → fallback: topMatches[0] even if weak (ensures ≥1 up reason)
downReasons = topMisses, up to 2
```

`topMatches` is sorted by `matchScore = W[d] × U[d] × (1 − gap)`. This weights dimensions the user **actually cares about** — a strong match on a low-priority dimension does not surface as a reason chip.

Dimension keys (e.g. `"social"`, `"workation"`) are translated to human labels via `DIMENSIONS[dim].label` from `src/config/scoring.ts` before the response is built, so the client never imports scoring config.

### Rendering

`RecommendationCard` (`src/components/results/RecommendationCard.tsx`):

- Up reasons (`direction: "up"`) render with `↑` in brand red (`#E84B2B`) for `strong`, zinc-400 for `moderate`
- Down reasons (`direction: "down"`) render with `↓` in zinc-600
- `summary` is the raw property blurb from config — Day 9 will replace or augment this with AI-generated explanation copy
- `bookingUrl` opens in a new tab with `rel="noopener noreferrer"` — Day 10 wraps this in a click-tracking layer

---

## 5. Fallback state logic

### Confidence and fallback mode

The ranking engine classifies each result set with a `ConfidenceLevel` and a `FallbackMode`. These are independent:

| `fallback` | Cause | Cards returned |
|---|---|---|
| `null` | Normal result | Up to 5 |
| `"thin_pool"` | Hard filter left fewer than 3 survivors | 1–2 |
| `"weak_match"` | Top score below low-confidence threshold | Up to 5, but all weak |
| `"hard_filter_relaxed"` | Strict workation filter left 0 survivors; relaxed threshold used | Up to 5 |
| `"empty"` | 0 survivors even after relaxed filter | 0 |

`confidence` (`"high" | "moderate" | "low"`) applies when `fallback` is `null`:
- `"high"` → no banner
- `"moderate"` → subtle banner: "Good matches found — some properties are a closer fit than others."
- `"low"` → banner: "These are the closest options we found. They may not be a perfect fit."

When a `fallback` mode is active, it takes precedence and overrides confidence copy.

### UI state mapping

`ResultsContent.tsx` maps the response to one of five visual states:

| Condition | Heading | Body |
|---|---|---|
| `!ready` (hydrating) | — | Logo spinner |
| `!response && sessionId` | — | "Results have expired." + Start new search |
| `!response && !sessionId` | — | Redirect to `/` |
| `cards.length === 0` | "No matches found." | `EmptyState` (context-aware copy) |
| `cards.length > 0` | Adaptive (see below) | Card list + optional `FallbackBanner` |

**Adaptive heading:**

```ts
function resultHeading(meta: ShortlistMeta, cardCount: number): string {
  if (cardCount === 0) return "No matches found.";
  if (meta.fallback === "thin_pool" && cardCount <= 2) return "A few options for your trip.";
  return "Here are your Zostel stays.";
}
```

**Empty state copy** is context-aware via `meta.totalFiltered`:

- `totalFiltered > 0` → "Your work-setup filter was too strict." with count and suggestion to relax the workation preference
- `totalFiltered === 0` → generic "No properties matched your answers." with suggestion to loosen room type or budget

Both empty state variants include a "Try a different search" link back to `/intake`.

---

## 6. Loading, retry, and error handling

### Loading

After the last intake question is submitted, `IntakePage` sets `isLoading = true` and renders `LoadingScreen` — a full-page logo spinner with cycling witty copy (8 lines, 2.2 s interval). The intake question UI is replaced entirely; there is no spinner-inside-button pattern.

### Retry

On API failure, `IntakePage` sets `isLoading = false` and renders the error inline above the CTA. The intake answers remain in `localStorage` (untouched — `clearSession()` only runs on success). The user can re-tap "Find my stay →" to retry with the same answers.

Session creation is also retried at submit time if the background `POST /api/session` call from intake load had failed (`sessionSynced !== true`).

### Error messages

All user-visible error copy lives in `src/lib/friendlyError.ts`. Raw error strings never reach the UI.

| Input | User-facing copy |
|---|---|
| `"internal_error"` | "Our server tripped over its own backpack. Give it another shot." |
| `"validation_failed"` | "Something looks off with your answers — even the yak raised an eyebrow. Try going back." |
| `"HTTP 5xx"` | "Our server is having a moment. The mountains will wait — try again shortly." |
| `"HTTP 4xx"` | "Your session got lost somewhere on the trail. Try refreshing the page." |
| `"Failed to fetch"` / `"NetworkError"` | "Looks like you've gone off-grid. Check your connection and try again." |
| anything else | "Something went sideways. The hostel gods are frowning — try again." |

`console.error` is called server-side on `validation_failed` with the full field error detail for developer visibility.

### Session sync failure

If `POST /api/session` fails on intake load (network error, cold start), a dismissible amber banner is shown: "Your answers are saved locally. We'll sync them when you submit." The session creation is retried at submit time before the recommendation call. If the retry also fails, the user sees a network error and the submit is blocked cleanly.

---

## 7. Diagnostic tooling

Both tools are development-only (`process.env.NODE_ENV === "development"`).

### IntakeDebugPanel (`src/components/dev/IntakeDebugPanel.tsx`)

Fixed bottom overlay on `/intake`. Shows:
- Session ID and DB sync status
- Current step with jump-to-step buttons
- Current answers (parsed and raw `localStorage`)
- Full `buildRequest()` JSON payload (inspectable before submit)
- Preset fixtures for all 6 personas

### ResultsDebugPanel (`src/components/dev/ResultsDebugPanel.tsx`)

Fixed bottom overlay on `/results`. Three tabs:

| Tab | Content |
|---|---|
| **meta** | `ShortlistMeta` JSON — confidence, fallback, poolSize, totalFiltered, bannerMessage |
| **cards** | Per-card: score from `_debug`, destinationSlug, priceInr, reason chips with strength, per-dimension contribution |
| **debug** | `_debug.userVector` + `_debug.rankingExplanation` raw JSON |

The DEV button turns red with `⚠` if a contract check fires. The check validates all top-level keys (`cards`, `meta`, `_debug`) and required `StayCard` fields on render.

---

## 8. Assumptions

- **Single destination scope**: Day 8 does not filter by destination. All Zostel properties are ranked globally. Destination filtering is available in the ranking engine (`destinationSlug` param) but not exposed in the intake form.
- **Session ID uniqueness**: UUID v4 collisions are treated as negligible. No deduplication is performed server-side.
- **`sessionStorage` lifetime**: Results survive tab navigation but not tab close or page refresh. This is intentional for MVP — Day 9 will add server-side result persistence keyed by `sessionId`.
- **No authentication**: All requests are anonymous. The `sessionId` is the only identity token.
- **Properties are static**: The `PROPERTIES` array in `src/config/properties.ts` is the source of truth. DB rows are seeded from it. Live property updates are out of scope.
- **No pagination**: The shortlist is at most 5 cards. Pagination is not implemented.
- **`summary` field**: Property summaries come from `properties.ts` config, not AI-generated. They are plain descriptive blurbs. Day 9 will replace or augment them with explanation copy generated from the user's specific answers.

---

## 9. Deferred to Day 9 and Day 10

### Day 9 — AI explanation layer

The data contract is already forward-compatible:

- `_debug.userVector` (the user's computed float vector) is stored in `sessionStorage` alongside the cards so the Day 9 explanation API can build a Claude prompt without a DB round-trip to re-derive it from intake answers.
- `_debug.cards[].explanation` contains `PropertyExplanation` — all 7 `DimensionMatch` entries (dim key, gap, strength, contribution, matchScore), `topMatches`, `topMisses`, and `filterTrace`. This is the primary input for the Claude prompt.
- `CardReason` has a documented `sentence` field placeholder: Day 9 adds a per-reason sentence for the full explanation layer.
- `StayCard.summary` is the placeholder the AI copy will replace or supplement.

### Day 10 — Booking handoff and click tracking

The data contract is already forward-compatible:

- `StayCard.destinationSlug` is present for destination-level routing and analytics grouping.
- `StayCard.priceInr` is present for card-level price display.
- `StayCard.bookingUrl` opens in a new tab. The `<a>` tag in `RecommendationCard` has a comment marking where the Day 10 click-tracking wrapper goes.
- No contract changes are anticipated for Day 10.
