# Day 3 Design Notes — Persona Model, Intake, and Scoring

Decisions made during Day 3 of the ZoCo MVP build.
Implemented in `src/config/`, `src/lib/schemas/`, and `src/types/`.

---

## Persona Model v1

Six starter personas. Each has a key, label, description, and a full `ScoringVector`
across 7 dimensions. Defined in `src/config/personas.ts`.

| Key | Label | Dominant signal |
|---|---|---|
| `solo_social` | Solo Social Explorer | `social=0.9`, dorm |
| `solo_quiet` | Quiet Solo Traveler | `calm=0.9`, `scenic=0.8` |
| `friends_getaway` | Friends Getaway | `adventure=0.8`, `social=0.8` |
| `couple_retreat` | Couple Retreat | `room_type_fit=1.0`, private |
| `workation` | Workation Traveler | `workation=1.0`, `calm=0.8` |
| `budget_backpacker` | Budget Backpacker | `budget_fit=1.0`, dorm |

No two personas share the same dominant dimension. `solo_social` and `budget_backpacker`
look similar but split sharply on `budget_fit`. `solo_quiet` and `workation` split on
`workation` and `room_type_fit`.

Personas are **static config, not DB rows**. They don't change per user — they're
a finite, curated set that the recommendation engine scores against.

---

## Intake Question Set

Five questions. Defined in `src/config/questions.ts`. Rendered in this order.

| # | Key | Label | Required |
|---|---|---|---|
| Q1 | `trip_type` | What kind of trip is this? | Yes |
| Q2 | `stay_priority` | What matters most for this stay? | Yes |
| Q3 | `social_energy` | How social do you want to be? | Yes |
| Q4 | `room_type` | Which room type do you prefer? | Yes |
| Q5 | `budget` | What's your budget comfort level? | No |

### Mandatory vs optional decisions

**All four mandatory questions are mandatory because:**
- Q1 sets the full 7-dimension baseline. Without it, nothing can be scored.
- Q2 overrides the dominant vibe dimension. A persona without a priority signal is ambiguous.
- Q3 is the only reliable differentiator between `solo_social` and `solo_quiet` — the two most common solo traveler profiles.
- Q4 directly overrides `room_type_fit` and the user's answer here should always win over the persona default.

**Q5 (budget) is optional because:**
- Most personas already encode a strong budget signal (`budget_backpacker=1.0`, `couple_retreat=0.2`).
- Forcing a budget question on a confirmed `budget_backpacker` is redundant.
- Skipping it defaults to the persona's `budget_fit` value, which is a reasonable fallback.

### How answers flow into scoring

Each answer option carries a `scoringOverride: Partial<ScoringVector>` — only the
dimensions that answer directly affects. Q1 is the exception: persona options have empty
overrides because the engine resolves the full vector via `PERSONAS[personaKey].scoring`.
Q2–Q5 overrides are merged on top of that baseline by the Day 4 scoring function.

---

## Scoring Dimensions v1

Seven dimensions, each a float 0.0–1.0. Defined in `src/config/scoring.ts`.
Both users and properties carry a `ScoringVector`. The engine compares them.

| Dimension | What it measures | Can hard-filter? |
|---|---|---|
| `social` | Preference for communal interaction | No |
| `calm` | Preference for quiet, low-stimulation environments | No |
| `scenic` | Preference for natural landscape over urban setting | No |
| `workation` | Need for wifi and quiet workspace | **Yes** |
| `adventure` | Appetite for physical activity and outdoor pursuits | No |
| `budget_fit` | Price sensitivity (1 = cost is primary constraint) | No |
| `room_type_fit` | 0 = dorm preferred, 1 = private room required | No |

`workation` is the only hard-filterable dimension. A user with `workation ≥ 0.8`
matched to a property with `workation ≤ 0.2` should be excluded from results,
not just ranked lower. All other mismatches are soft — they reduce score but don't
eliminate candidates.

`social` and `calm` are correlated but not inverses. A person can prefer a calm
environment and still be open to some social contact.

---

## Recommendation Request Schema v1

Defined in `src/lib/schemas/recommendationRequest.ts`. Validated with Zod at the
API boundary. Inferred type: `RecommendationRequestPayload`.

```ts
{
  sessionId:   string (uuid)     // required — ties request to sessions table
  personaKey:  PersonaKey        // required — Q1
  priority:    StayPriority      // required — Q2
  socialEnergy: SocialEnergy     // required — Q3
  roomType:    RoomType          // required — Q4
  budget?:     BudgetLevel       // optional — Q5
}
```

`sessionId` is required. A valid session must exist in the `sessions` table before
the recommendation request is submitted. The session creation flow is wired in Day 4.

The scoring vector is **never sent by the client**. It is derived server-side from
`personaKey` + answer overrides. The API contract only exposes human-readable choices.

---

## Assumptions

- All properties in the DB are candidates for every request. No geographic pre-filtering.
- Property scoring vectors are derived from tags at query time, not stored as a column.
- Persona weights are set by hand and treated as ground truth for the MVP.
- Session identity is anonymous. No login, no user profile, no cross-session memory.
- A maximum of 5 results are returned per request (set in `src/lib/config.ts`).

---

## Intentionally deferred

| Item | Reason |
|---|---|
| Destination filtering (Q6) | No geographic data in Schema v1; adds routing complexity for marginal signal |
| Property price data | No price column yet; `budget_fit` is tag-derived for now |
| `recommendation_results` write path | Table exists; deferring until ranking function is live in Day 4 |
| Persona tuning / weight adjustment | Weights are hand-set; data-driven tuning needs usage data first |
| Multi-language / locale | Single market for MVP |
| Session deduplication | No device fingerprinting; sessions are ephemeral per page load for now |
