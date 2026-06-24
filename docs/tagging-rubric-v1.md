# Property Tagging Rubric v1

Internal reference for scoring Zostel properties across the 7 ZoCo dimensions.
Use this before assigning any numeric score to a property.

**Scale:** every dimension is a float from 0.0 to 1.0.
**Rule:** score what the property _is_, not what a traveler _wants_. The recommendation engine handles the matching.

---

## How to use this rubric

1. Read the dimension definition.
2. Read the three anchor descriptions (low / mid / high).
3. Pick the anchor that best fits the property, then nudge ±0.1–0.2 if it sits between anchors.
4. A score of exactly 0.5 means genuinely ambiguous — not "I'm not sure". If you're not sure, re-read the anchors.

Allowed values: any increment of 0.1 (0.0, 0.1, 0.2 … 1.0). Finer precision is false accuracy.

---

## Dimensions

---

### `social`

**What it measures:** How much the property's physical setup and culture encourage strangers to meet and spend time together.

Score the _infrastructure and vibe_, not the destination. A property in a party city with private-only rooms and no common area scores low. A property in a remote village with a shared kitchen and nightly bonfires scores high.

| Score       | Description                                                                                                                                    | Example                                                            |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| **0.1–0.2** | Mostly private or transient. No meaningful common space. Guests come and go without interacting.                                               | A budget guesthouse with only private rooms and a small reception. |
| **0.4–0.6** | Some shared infrastructure — a common room or shared kitchen — but social interaction depends on who's staying. Some weeks lively, some quiet. | A mid-size hostel with a cafe area but no organised activities.    |
| **0.8–1.0** | Strong social pull by design. Large common areas, shared meals, organised activities, bonfires, group trips. Guests reliably meet people.      | Zostel Old Manali, Zostel Goa Morjim.                              |

**Common mistakes:** Don't score based on the destination's nightlife. Score the property. Zostel Rishikesh Tapovan is in a lively city but scores 0.6 because it's uphill from the main scene — quieter crowd, more intentional socialising.

---

### `calm`

**What it measures:** How quiet and low-stimulation the immediate environment around the property is. Noise, foot traffic, road density, and pace of the surrounding area.

`calm` and `social` are not inverses. A property can have a social common room and still be in a calm location (e.g. a hostel in a quiet forest village with nightly group dinners).

| Score       | Description                                                                                                                            | Example                                                                                 |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| **0.1–0.2** | Urban or high-footfall setting. Constant background noise — traffic, market, music. Hard to find silence.                              | Zostel Delhi, Zostel Mumbai.                                                            |
| **0.4–0.6** | Semi-quiet. Noise is present but not constant. Some outdoor space that offers relief.                                                  | A hill station property on a busy tourist road — quiet at night, active during the day. |
| **0.8–1.0** | Genuinely quiet. The surrounding area has low traffic, low noise, and natural sound dominates. Guests report it as restful by default. | Zostel Chitkul, Zostel Shangarh, Zostel Pulga.                                          |

**Common mistakes:** Don't conflate "remote" with "calm". Leh is remote but has significant vehicle traffic on its main roads. Score based on what the guest will actually hear and feel.

---

### `scenic`

**What it measures:** The visual and natural quality of the property's immediate setting — what the guest sees from the window, the roof, or within a 10-minute walk.

Score the _setting_, not the destination's famous attractions. A property near Hampi's ruins but in a plain concrete building scores lower than one with a boulder-framed courtyard and sunrise view.

| Score       | Description                                                                                                                                   | Example                                                                                |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| **0.1–0.2** | Urban or featureless setting. No natural view. The surroundings are functional, not memorable.                                                | Zostel Bangalore (Koramangala), Zostel Delhi.                                          |
| **0.4–0.6** | Some natural setting — a garden, a partial hill view, a river nearby — but not the defining feature of the stay.                              | A hill station property with partial valley view but obstructed by buildings.          |
| **0.8–1.0** | The landscape is the experience. Dramatic mountains, coastline, backwaters, or forest visible from the property itself. Guests photograph it. | Zostel Chitkul (1.0), Zostel Kalpa (1.0), Zostel Pahalgam (1.0), Zostel Varkala (0.9). |

**Common mistakes:** Don't score the postcard view 20 km away. If you have to drive to see it, it doesn't count. Score what the guest sees from the property.

---

### `workation`

**What it measures:** How well-equipped the property is for someone working remotely full-time for 1–4 weeks. Reliable wifi, a usable desk or table, stable power, and enough quiet during working hours.

This is the **only hard-filterable dimension**. A user with `workation ≥ 0.8` matched to a property with `workation ≤ 0.2` should be excluded from results entirely — not just ranked lower.

| Score       | Description                                                                                                                                     | Example                                                                                           |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| **0.0–0.2** | No dedicated workspace. Wifi is incidental or unreliable. Not suitable for full-time remote work.                                               | Most remote mountain properties (Pulga, Chitkul) — connectivity is the attraction, not a feature. |
| **0.4–0.6** | Wifi present and usually adequate. No dedicated desk space but the cafe or dining table works. Suitable for light working days or short stints. | Many cultural hill towns — Mussoorie, Gangtok. Good enough for a few calls per day.               |
| **0.8–1.0** | Reliable broadband explicitly noted or consistently reviewed. Dedicated desk or co-working setup. Property attracts and retains remote workers. | Zostel Mcleodganj (0.7), Zostel Bangalore Koramangala (0.9), Zostel Pondicherry (0.8).            |

**Common mistakes:** Don't score based on destination connectivity. Score the property's actual setup. Mcleodganj scores 0.7 (not 1.0) because the wifi is reliable but there's no dedicated desk — guests work from cafe tables.

---

### `adventure`

**What it measures:** Proximity and access to physically active, outdoor pursuits — trekking, rafting, climbing, paragliding, diving, cycling routes — _from the property itself_. Not the destination's general reputation.

| Score       | Description                                                                                                                                          | Example                                                                      |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **0.0–0.2** | No meaningful outdoor activity access nearby. Urban or culturally focused.                                                                           | Zostel Varanasi, Zostel Kolkata — the draw is cultural, not physical.        |
| **0.4–0.6** | Some outdoor options within reach but not the primary draw. A walk, a bike ride, a day trip to an activity.                                          | Zostel Mussoorie — a ridge walk exists but it's not a trekking base.         |
| **0.8–1.0** | Trailhead or activity operator at the doorstep. Guests routinely base multi-day outdoor trips from here. Property organises or facilitates bookings. | Zostel Rishikesh Laxman Jhula (0.9), Zostel Pokhara (0.9), Zostel Leh (0.8). |

**Common mistakes:** Don't score potential. Score what's actually accessible on foot or a short auto ride from the property. Hampi has stunning boulder landscapes but scores 0.4 on adventure — it's more exploration than physical sport.

---

### `budget_fit`

**What it measures:** How affordable the property is relative to the full Zostel network. This scores the _property's price point_, not the destination's cost of living.

Use the current network price range as the scale: ₹279 (Bundi) to ₹1,099 (Mumbai).

| Score       | Price range | Description                                                                                                    |
| ----------- | ----------- | -------------------------------------------------------------------------------------------------------------- |
| **0.9–1.0** | ≤ ₹399      | Cheapest tier in the network. Bundi (₹279), Jodhpur Clock Tower (₹319), Jaipur MI Road (₹359), Pokhara (₹449). |
| **0.7–0.8** | ₹400–₹599   | Budget-friendly. Good value for the location.                                                                  |
| **0.4–0.6** | ₹600–₹799   | Mid-range. Typical Zostel price point.                                                                         |
| **0.2–0.3** | ₹800–₹999   | Higher end of the network. Premium location or room type commands it.                                          |
| **0.0–0.1** | ≥ ₹1,000    | Top of network. Mumbai (₹1,099) and Port Blair (₹999).                                                         |

**Note:** `budget_fit` scores the dorm price, not private room price. If a property has dorms from ₹699 and privates from ₹1,800, score 0.5 (the dorm).

---

### `room_type_fit`

**What it measures:** The balance of room types available at the property. This is a property characteristic, not a user preference.

**0 = dorm-dominant. 1 = private-dominant.**

| Score       | Description                                                                                                                                    | Example                                                                |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| **0.0–0.2** | Almost all dorm beds. Private rooms rare or unavailable. Property is built for the backpacker/dorm market.                                     | Zostel Goa Morjim, Zostel Kasol — dorm is the product.                 |
| **0.4–0.6** | Mixed inventory. Roughly equal dorm and private availability. Both experiences are viable.                                                     | Most mid-size Zostels — a couple of dorm rooms plus 2–3 private rooms. |
| **0.8–1.0** | Primarily private rooms. Dorms may exist but privates are the main offering. Property suits couples or solo travelers wanting their own space. | Zostel Kalpa (0.7), Zostel Munnar (0.7), Zostel Chitkul (0.6).         |

**Common mistakes:** Don't score based on what _you'd_ book. Score what inventory exists. A property with 3 dorm rooms and 4 private rooms scores ~0.6 even if the dorms are always full.

---

## Cross-dimension consistency checks

Before finalising a property's scores, run these sanity checks:

| If…                   | Then check…                                                                                                            |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `social ≥ 0.8`        | `calm` should be ≤ 0.4. A very social property is rarely calm. If both are high, re-read both anchors.                 |
| `calm ≥ 0.9`          | `social` should be ≤ 0.4. Exceptions exist (a forest hostel with nightly group dinners) — document why in the summary. |
| `workation ≥ 0.8`     | `calm` should be ≥ 0.6. You can't work well in a loud environment.                                                     |
| `adventure ≥ 0.8`     | At least one adventure tag (`trekking`, `rafting`, `diving`, `paragliding`) should be present.                         |
| `budget_fit ≥ 0.9`    | `price_inr` should be ≤ ₹399. If not, recheck the price.                                                               |
| `room_type_fit ≥ 0.7` | At least one `private` tag should be present.                                                                          |

---

## Archetype exceptions

Some cross-dimension consistency rules do not apply uniformly across all archetypes. Known exceptions:

### `urban_metro` — workation and calm are decoupled

The rule `workation ≥ 0.8 → calm ≥ 0.6` assumes that working well requires a quiet environment. This holds for hill town and nature retreat properties. It does not hold for urban metros.

Delhi, Bangalore, Hyderabad, Mumbai, and Kolkata have strong workation infrastructure (reliable broadband, coworking spaces, stable power) but are genuinely noisy urban environments (`calm: 0.2–0.3`). A remote worker choosing a metro base has already accepted the noise tradeoff — they are there for connectivity and city access, not quiet.

**For `urban_metro` archetype properties only:** `workation` and `calm` may be independently high and low. Do not flag this as a consistency violation.

| Property                       | workation | calm | Why the gap is correct                                       |
| ------------------------------ | --------- | ---- | ------------------------------------------------------------ |
| Zostel Delhi                   | 0.8       | 0.2  | Metro connectivity; constant urban noise                     |
| Zostel Bangalore (Koramangala) | 0.9       | 0.2  | Best wifi in network; Koramangala is a busy commercial strip |
| Zostel Hyderabad               | 0.8       | 0.3  | HITEC City infrastructure; city ambient noise                |

All other archetypes: the rule stands. A hill town with `workation: 0.8` should have `calm ≥ 0.6`.

---

## Tag vocabulary vs. scoring dimensions

Tags and scoring dimensions are related but not the same thing. This table maps between them.

| Scoring dimension | Corresponding tag(s)                                                   | Note                                                                                                                 |
| ----------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `social`          | `social`, `party`                                                      | `party` implies social ≥ 0.8                                                                                         |
| `calm`            | `quiet`                                                                | **`calm` and `quiet` are the same concept.** `calm` is the internal dimension key; `quiet` is the tag used on cards. |
| `scenic`          | `scenic`                                                               | Same word                                                                                                            |
| `workation`       | `workation`, `cafe`                                                    | `cafe` implies workation-friendly but not necessarily ≥ 0.8                                                          |
| `adventure`       | `adventure`, `trekking`, `rafting`, `paragliding`, `diving`, `cycling` | Specific activity tags imply adventure ≥ 0.7                                                                         |
| `budget_fit`      | `budget`                                                               | `budget` tag implies budget_fit ≥ 0.7                                                                                |
| `room_type_fit`   | `dorm`, `private`                                                      | Binary tags; `dorm` → room_type_fit ≤ 0.3, `private` → ≥ 0.6                                                         |

Tags not listed above (`mountains`, `beach`, `cultural`, `heritage`, `romantic`, etc.) are **display-only context labels**. They describe terrain, activity type, or traveler character. They have no scoring counterpart and do not affect ranking.

---

## Quick reference — score bands

| Band    | Means                                                                 |
| ------- | --------------------------------------------------------------------- |
| 0.0     | Completely absent. The property has none of this quality.             |
| 0.1–0.3 | Low. Present as a minor feature or incidentally. Not a draw.          |
| 0.4–0.6 | Moderate. Real but not defining. Some guests will notice, some won't. |
| 0.7–0.8 | High. A clear feature of the property. Most guests experience it.     |
| 0.9–1.0 | Defining. This quality is what the property is known for.             |
