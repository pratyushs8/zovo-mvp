# Event Taxonomy v1

Events that ZoCo tracks to understand the recommendation funnel.
Implemented in `src/lib/analytics.ts`. Stored in the `events` table.

---

## session_started

**Trigger:** User lands on the ZoCo page for the first time in a session.

| Field       | Required | Type   | Notes                             |
| ----------- | -------- | ------ | --------------------------------- |
| `referrer`  | no       | string | URL of the referring page, if any |
| `userAgent` | no       | string | Raw user-agent string             |

**Why it matters:** Top-of-funnel volume. Measures how many people arrive vs. how many complete a recommendation request. A large drop here vs. `recommendations_shown` signals a friction problem in the question flow.

---

## question_answered

**Trigger:** User selects an answer to either the persona question or the vibe question.

| Field      | Required | Type                  | Notes                                             |
| ---------- | -------- | --------------------- | ------------------------------------------------- |
| `question` | yes      | `"persona" \| "vibe"` | Which question was answered                       |
| `answer`   | yes      | string                | The selected value (e.g. `"solo"`, `"adventure"`) |

**Why it matters:** Fires once per question. Two events per completed flow. Lets us see answer distribution (which personas and vibes are most common) and detect drop-off between question 1 and question 2.

---

## recommendations_shown

**Trigger:** The recommendation results are rendered on screen after the AI returns a response.

| Field         | Required | Type     | Notes                                               |
| ------------- | -------- | -------- | --------------------------------------------------- |
| `requestId`   | yes      | number   | ID of the `recommendation_requests` row             |
| `propertyIds` | yes      | number[] | Ordered list of property IDs shown, position = rank |
| `count`       | yes      | number   | Number of results shown (typically 1–5)             |

**Why it matters:** Confirms the recommendation engine ran successfully. Pairs with `recommendation_clicked` to compute click-through rate per result. Also the denominator for conversion to booking handoff.

---

## recommendation_clicked

**Trigger:** User clicks on a property card in the results list.

| Field        | Required | Type   | Notes                                         |
| ------------ | -------- | ------ | --------------------------------------------- |
| `requestId`  | yes      | number | ID of the originating recommendation request  |
| `propertyId` | yes      | number | ID of the property that was clicked           |
| `rank`       | yes      | number | 1-based position of the card that was clicked |

**Why it matters:** Primary engagement signal. Measures which properties earn attention and whether rank matters (rank 1 bias). A session with `recommendations_shown` but no `recommendation_clicked` is a failed recommendation.

---

## booking_handoff_clicked

**Trigger:** User clicks the "Book on Zostel" CTA that opens the Zostel booking page in a new tab.

| Field        | Required | Type   | Notes                               |
| ------------ | -------- | ------ | ----------------------------------- |
| `propertyId` | yes      | number | ID of the property being booked     |
| `bookingUrl` | yes      | string | The Zostel URL the user was sent to |

**Why it matters:** Bottom-of-funnel conversion. This is the primary success metric for ZoCo — a user reaching Zostel's booking flow with intent. The ratio of `booking_handoff_clicked` to `recommendations_shown` is the headline conversion rate.

---

## Funnel summary

```
session_started
  └── question_answered (persona)
        └── question_answered (vibe)
              └── recommendations_shown
                    └── recommendation_clicked
                          └── booking_handoff_clicked  ← success
```

Each arrow is a potential drop-off point. The events above give us a measured rate at every step.
