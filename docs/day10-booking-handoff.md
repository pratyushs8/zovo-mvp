# Day 10 — Booking Handoff and Attribution

Routes recommendation clicks to Zostel property pages. Appends UTM attribution to every outbound URL and persists a click event before the browser navigates.

---

## Contents

1. [CTA behavior decision](#1-cta-behavior-decision)
2. [View Stay URL contract](#2-view-stay-url-contract)
3. [Attribution context model](#3-attribution-context-model)
4. [Click tracking behavior](#4-click-tracking-behavior)
5. [Persistence before redirect](#5-persistence-before-redirect)
6. [Failure handling](#6-failure-handling)
7. [Known MVP limitations](#7-known-mvp-limitations)
8. [What Day 11 builds on top of this](#8-what-day-11-builds-on-top-of-this)

---

## 1. CTA behavior decision

Every recommendation card has a single primary CTA: **View Stay →**

Clicking opens the Zostel property page in a new tab (`target="_blank"`). The current ZoCo tab stays alive, which means:

- The analytics fetch completes normally — no `beforeunload` race
- The user can return to their ZoCo results without re-running the recommendation
- ZoCo never handles payment or availability — it hands off to Zostel and stops

**Why a new tab?** Direct booking integration (deep API, availability checks, Zostel auth) is deferred post-MVP. The handoff is a one-way link to the Zostel property page. Opening in a new tab makes the boundary explicit to the user and avoids a hard back-navigation problem.

**CTA label:** "View Stay →" rather than "Book" or "Book on Zostel" because ZoCo cannot guarantee availability. "View Stay" describes what actually happens without implying a booking will complete.

---

## 2. View Stay URL contract

### Structure

```
{bookingUrl}?utm_source=zoco&utm_medium=recommendation&utm_content=rank_{N}&utm_campaign={sessionId}
```

Two bookingUrl forms are valid:

| Form                          | Example                                                                        |
| ----------------------------- | ------------------------------------------------------------------------------ |
| Destination page              | `https://www.zostel.com/destination/manali`                                    |
| Deep-link (property-specific) | `https://www.zostel.com/destination/mcleodganj/stay/zostel-mcleodganj-mclh045` |

Seven properties use the deep-link form (PM-provided). All 43 remaining use the destination-page form.

### UTM parameter meanings

| Parameter      | Value                | Purpose                                                                         |
| -------------- | -------------------- | ------------------------------------------------------------------------------- |
| `utm_source`   | `zoco`               | Identifies ZoCo as the traffic source                                           |
| `utm_medium`   | `recommendation`     | Distinguishes AI-recommended traffic from other ZoCo entry points               |
| `utm_content`  | `rank_1` … `rank_5`  | Encodes rank position — allows Zostel to measure rank bias in converted traffic |
| `utm_campaign` | `{sessionId}` (UUID) | Links a Zostel conversion back to a ZoCo session for cross-system attribution   |

`utm_campaign` is omitted when no `sessionId` is present in the URL (rare: refreshed tab, shared link).

### Validation rules (enforced by `buildViewStayUrl`)

| Rule                                                                | Reason                                                                  |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `bookingUrl` must start with `https://www.zostel.com/`              | Prevents accidental handoffs to wrong domains                           |
| `bookingUrl` must not be just the origin (`https://www.zostel.com`) | A bare origin is not a valid property page                              |
| Protocol must be HTTPS                                              | No HTTP — Zostel redirects anyway, but we don't generate insecure links |
| `rank` must be a positive integer                                   | Fractional or zero rank would produce malformed `utm_content`           |

### What is excluded from the URL

| Field                         | Why excluded                                                          |
| ----------------------------- | --------------------------------------------------------------------- |
| `requestId`                   | Internal ZoCo DB row — no value to Zostel, leaks internal IDs         |
| `propertyId`                  | ZoCo-internal — Zostel uses its own property identifier system        |
| `score` / scoring breakdown   | Raw model output — not actionable by Zostel and potentially confusing |
| `sessionId` in path or header | Only travels as `utm_campaign`; not placed elsewhere in the URL       |

### Key file

`src/lib/buildViewStayUrl.ts` — pure function, fully tested. Returns `{ ok: true, url }` or `{ ok: false, reason }`. The card hides the CTA when `ok` is false.

---

## 3. Attribution context model

Two separate channels carry attribution data. They share one field: `sessionId`.

### Channel 1 — outbound URL (goes to Zostel)

```
utm_source=zoco
utm_medium=recommendation
utm_content=rank_N
utm_campaign={sessionId}
```

Zostel can read these in their analytics platform. `utm_campaign` is the only shared key that connects a Zostel-side conversion back to a ZoCo recommendation session.

### Channel 2 — internal event (stays in ZoCo)

```typescript
{
  name: "booking_handoff_clicked",
  properties: {
    propertyId: number,
    bookingUrl: string,      // raw base URL before UTM append
    rank: number,
    destinationSlug: string,
    requestId: number,       // links to recommendation_requests row
    explanationSource?: "model" | "fallback"  // present only after Day 9 layer loads
  },
  sessionId: string          // UUID, links to session
}
```

`requestId` is internal to ZoCo only — it links the click event directly to the `recommendation_requests` and `recommendation_results` DB rows, making per-session analysis possible without a separate lookup.

`explanationSource` is optional because the Day 9 explanation layer loads asynchronously after the cards render. A click before the explanations arrive will not have this field. A click after they arrive will include `"model"` or `"fallback"`.

### Why these two channels diverge

| Consideration        | URL params                         | Internal event                          |
| -------------------- | ---------------------------------- | --------------------------------------- |
| Audience             | Zostel's analytics                 | ZoCo's DB                               |
| What it proves       | A user arrived at Zostel from ZoCo | A user clicked a CTA in ZoCo            |
| Cross-system join    | `utm_campaign` = `sessionId`       | `requestId` links to recommendation row |
| Internal IDs leaked? | No                                 | Yes (appropriate — internal system)     |

---

## 4. Click tracking behavior

### Flow

```
User clicks "View Stay →"
    │
    ├──► Browser opens Zostel URL in new tab (not blocked by tracking)
    │
    └──► trackHandoffClick() fires (fire-and-forget, never awaited by caller)
              │
              └──► POST /api/track/booking-handoff-clicked
                        │  Zod validation
                        │  trackEvent("booking_handoff_clicked", properties, sessionId)
                        └──► INSERT INTO events
```

Navigation and tracking happen concurrently. The new tab opens immediately — the tracking call does not gate it.

### `trackHandoffClick` properties

The client helper in `src/lib/api.ts`:

```typescript
trackHandoffClick(properties, sessionId);
```

- `fetch` with `keepalive: true` — request survives if the user closes the ZoCo tab immediately after clicking (common on mobile when the new tab takes focus)
- Errors are swallowed with `.catch(() => undefined)` — a tracking failure never surfaces to the user
- Returns `void` — callers cannot await it (by design)

### `explanationSource` conditional inclusion

```typescript
...(explanationSource ? { explanationSource } : {})
```

The field is spread only when truthy. This means the event schema is consistent: `explanationSource` is never `undefined` in the DB — it is either `"model"`, `"fallback"`, or absent entirely.

---

## 5. Persistence before redirect

The route handler `POST /api/track/booking-handoff-clicked` **awaits** `trackEvent`:

```typescript
await trackEvent("booking_handoff_clicked", parsed.data.properties, parsed.data.sessionId);
return NextResponse.json({ ok: true });
```

This means the DB write completes before the server responds. The client does not await the fetch (fire-and-forget), but the server guarantees ordering: if the HTTP request lands, the event is persisted.

The failure path: `trackEvent` internally wraps the DB insert in `try/catch` and logs on failure without re-throwing. This means a DB error will not cause the route to return 500 — the client gets `{ ok: true }` even if the insert failed. This is an intentional tradeoff documented under limitations.

### Why `keepalive: true` matters

Without `keepalive`, a fetch initiated by an `onClick` handler is cancelled by some browsers when the tab loses focus (new tab opened) or when the page enters a hidden/unloaded state. `keepalive: true` moves the request into the browser's keepalive request queue, which is drained independently of page lifecycle. The payload is well under the 64KB browser limit for keepalive requests.

---

## 6. Failure handling

### Missing or invalid bookingUrl

`buildViewStayUrl` returns `{ ok: false, reason }` for any of these conditions:

- Empty string
- Not a `https://www.zostel.com/` URL
- Bare origin without a path
- HTTP instead of HTTPS
- Rank is 0, negative, or fractional

When `ok` is false, the card renders a **disabled fallback** instead of the CTA:

```
[ Not available right now ]
```

The card is still fully rendered (title, location, summary, reason chips). Only the action is unavailable. `aria-disabled="true"` is set. Tracking is not fired for cards in this state.

### Attribution failure

If `POST /api/track/booking-handoff-clicked` fails (network timeout, server error, DB error), the failure is silent. The user's navigation to Zostel is never blocked. The outbound URL still carries UTM params even if the internal event is lost — Zostel-side attribution is preserved.

### Dev-mode visibility

The `ResultsDebugPanel` handoff tab flags:

- Cards with invalid bookingUrls (red border, failure reason shown)
- Missing or absent `sessionId` (with a note that `utm_campaign` will be omitted)
- Full decoded UTM params per card
- Full attribution event payload per card

The DEV button turns red when any handoff URL is invalid.

---

## 7. Known MVP limitations

**No Zostel-side conversion confirmation.**
ZoCo knows a user clicked through to Zostel. It does not know whether a booking was completed. The `utm_campaign` / `sessionId` link makes this possible in future (Zostel shares conversion data), but it is not wired up at MVP.

**`trackEvent` failure is silent.**
If the DB insert in `trackEvent` fails, the route still returns `{ ok: true }`. There is no retry, no dead-letter queue, and no alert. Lost events are undetectable without a separate count reconciliation. Acceptable at MVP volume; needs a fix before production scale.

**No deduplication.**
If the user clicks "View Stay →" multiple times in the same session (e.g. double-click, or going back and clicking again), multiple `booking_handoff_clicked` events are inserted. There is no idempotency key. At MVP this is tolerable; a `UNIQUE` constraint on `(requestId, propertyId)` or client-side lock would fix it.

**Attribution window is the browser tab lifetime.**
`utm_campaign` is a sessionId from the URL query string. If the user refreshes the `/results` page, the session data is lost from `sessionStorage` and the page redirects to `/`. If the user re-enters via a shared link, a new session UUID would be in the URL. Cross-session attribution is not supported.

**`explanationSource` is not always present.**
The Day 9 explanation layer loads asynchronously. A fast click (before explanations return) produces an event without `explanationSource`. Downstream queries must account for the field being absent.

**Deep-link URL form may not support all UTM params.**
Seven properties use `/destination/<slug>/stay/<property-id>` URLs. Zostel's routing for the `/stay/` path may not read UTM params the same way the destination page does. Verified that the URL is structurally valid; Zostel-side confirmation is pending.

---

## 8. What Day 11 builds on top of this

Day 11 wires the `events` table to PostHog. The Day 10 schema is designed so this swap requires no call-site changes — only the body of `trackEvent` in `src/services/analytics.ts` changes.

### What Day 11 needs from Day 10

| Day 10 artifact                        | Day 11 use                                                                                                                            |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `booking_handoff_clicked` event schema | Maps directly to a PostHog event; all fields become PostHog properties                                                                |
| `requestId` in the event               | Used to join PostHog events with the ZoCo DB for per-session funnel analysis                                                          |
| `sessionId` as `utm_campaign`          | Allows PostHog to stitch ZoCo sessions to Zostel-side GA4 / PostHog conversion events (when Zostel shares data)                       |
| `explanationSource` field              | Day 11 can segment `booking_handoff_clicked` by whether the LLM explanation was shown — testing whether explanations drive conversion |
| `rank` in the event                    | Rank-conversion analysis: do rank-1 properties convert at a higher rate than rank-2?                                                  |

### Funnel the Day 10 events complete

```
session_started
  └── question_answered (persona)
        └── question_answered (vibe)
              └── recommendations_shown          ← requestId available here
                    └── recommendation_clicked   ← engagement signal
                          └── booking_handoff_clicked  ← Day 10 ✓
```

With `booking_handoff_clicked` implemented, PostHog can compute the full funnel on Day 11: arrival → engagement → handoff conversion rate, segmented by persona, vibe, destination, rank, and explanation presence.

### Schema stability guarantee

The `booking_handoff_clicked` event schema is intentionally stable. Day 11 should not need to change it. If new fields are added (e.g. `priceInr`, `lowConfidence`), they should be added as optional properties so old events remain valid.
