# Property Summary Rules v1

Rules for writing the `summary` field in `src/data/properties.json`.
Apply these when adding a new property, editing an existing summary, or prompting an LLM to generate or rewrite summaries.

---

## The job of a summary

A summary does two things:

1. Tells the traveler what makes this specific property worth considering — not the destination in general, but this property at this location.
2. Signals the property's strongest persona fit so the recommendation card reinforces why the engine surfaced it.

A summary is not a marketing tagline. It is not a destination guide excerpt. It is not a list of amenities.

---

## Format

- **Length:** 1–2 sentences. Hard limit: 35 words per sentence, 55 words total.
- **Structure:** Lead with the setting or defining feature. Follow with the fit signal or what the stay enables.
- A dash (—) between clauses is preferred over a full stop when the two clauses are tightly related.

---

## Rules

### 1. Score the property, not the destination

Write about what is _at_ or _immediately around_ the property. What the traveler sees, hears, and can do within walking distance. Not the city's reputation or the region's general appeal.

| ✗ Don't write                                         | ✓ Write instead                                                                                       |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| "Jaisalmer is a golden fort city in the Thar Desert." | "Golden Fort city with a Zostel that organises camel safaris and overnight desert camps."             |
| "Rishikesh is the adventure capital of India."        | "Ganges-side base for rafting, bungee, and cliff jumping — daily activity signups from the property." |

### 2. Name one concrete thing

Every summary must contain at least one specific, verifiable detail — a river name, a trek name, a distance, a price point, a physical feature. Vague impressions are not allowed.

| ✗ Don't write                                       | ✓ Write instead                                                                        |
| --------------------------------------------------- | -------------------------------------------------------------------------------------- |
| "Beautiful mountain views and a great social vibe." | "Apple orchards in the foreground, Kinner Kailash directly across."                    |
| "Perfect for those who want peace and quiet."       | "Zero phone signal and complete stillness — Pulga rewards the extra hour of trekking." |

### 3. Signal the strongest persona fit

Where the property has a clear dominant use case, name it implicitly. Don't use persona key names (`solo_social`, `workation`), but encode the signal in plain language.

| Persona             | How to signal it                                                                                               |
| ------------------- | -------------------------------------------------------------------------------------------------------------- |
| `solo_social`       | mention common areas, group activity, meeting people: "common room runs late", "fills up every evening"        |
| `solo_quiet`        | mention absence of crowds, silence, or solitude: "no crowds, no noise", "almost no other tourists"             |
| `workation`         | mention wifi reliability or working environment: "most consistently reviewed wifi", "good wifi, slow mornings" |
| `couple_retreat`    | mention private-room lean, scenery, or romantic setting: "most couple-friendly", "lake view"                   |
| `friends_getaway`   | mention group energy, activities, or shared experience: "daily activity signups", "lakeside social scene"      |
| `budget_backpacker` | state the price or relative value explicitly: "₹319", "undercuts most Indian hill stations"                    |

### 4. No hype words

These words are banned. They add no information and reduce trust:

> _stunning, breathtaking, amazing, incredible, perfect, magical, paradise, gem, hidden gem, must-visit, world-class, vibrant, lively, charming, picturesque, idyllic, serene_

If you reach for one of these, replace it with a specific physical detail.

### 5. No first-person or second-person address

Summaries appear on recommendation cards alongside other properties. Voice must be consistent and neutral.

| ✗                                                | ✓                                                    |
| ------------------------------------------------ | ---------------------------------------------------- |
| "You'll love the mountain views from your room." | "Mountain views from the rooms and rooftop."         |
| "We think this is the best base for Annapurna."  | "Natural base before or after an Annapurna circuit." |

### 6. Tense and voice

- Present tense throughout.
- Active constructions preferred: "trail access from the doorstep", not "where trail access can be found".
- Avoid progressive tense ("is offering", "is becoming").

### 7. No comparative superlatives unless verifiable within the dataset

"The cheapest sleep in the network" is allowed — it's true and checkable. "The best mountain views in India" is not.

Superlatives that reference the Zostel network are acceptable. Superlatives that reference India, Asia, or the world are not.

---

## LLM prompt addendum

When using an LLM to generate or rewrite summaries, append the following to your prompt:

> Write a 1–2 sentence property summary following these constraints: (1) describe the property's immediate setting, not the destination's general reputation; (2) include at least one specific named detail — a river, trek, price, or physical feature; (3) signal the property's strongest traveler fit in plain language without using marketing adjectives; (4) hard limit 55 words total; (5) present tense, no first or second person. Do not use: stunning, breathtaking, amazing, incredible, perfect, magical, paradise, gem, hidden gem, must-visit, world-class, vibrant, lively, charming, picturesque, idyllic, serene.

---

## Quick checklist before submitting a summary

- [ ] Under 55 words?
- [ ] Contains one specific named detail?
- [ ] No banned hype words?
- [ ] Scores the property, not the destination?
- [ ] Signals the strongest persona fit?
- [ ] Present tense, no first/second person?
