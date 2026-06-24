# Day 4 Design Notes — Property Metadata Model, Import Format, and Seeding

Decisions made during Day 4 of the ZoCo MVP build.
Implemented in `src/data/`, `src/config/`, `src/db/`, `src/scripts/`, and `drizzle/`.

---

## Property Metadata Model v1

Each property in the ZoCo dataset carries seven categories of information.

### Required fields

| Field | Type | Notes |
|---|---|---|
| `name` | `text NOT NULL` | Display name as shown on Zostel's site |
| `destinationId` | `integer NOT NULL → destinations.id` | FK to normalised destinations table |
| `location` | `text NOT NULL` | Human-readable area, e.g. "Old Manali" or "Koramangala, Bangalore" |
| `priceInr` | `integer NOT NULL` | Lowest dorm price in INR at time of curation |
| `archetype` | `text NOT NULL` | One of 7 values — see Archetype Taxonomy below |
| `bookingUrl` | `text NOT NULL UNIQUE` | Canonical Zostel URL; also the upsert key |
| `summary` | `text` | 1–2 sentence editorial description; see `docs/summary-rules-v1.md` |

### Scoring vector

Stored as a single `scoring jsonb NOT NULL` column. Shape is `ScoringVector` from `src/types/index.ts`:

```ts
{
  social:        number  // 0.0–1.0 — communal interaction level
  calm:          number  // 0.0–1.0 — quiet, low-stimulation environment
  scenic:        number  // 0.0–1.0 — natural landscape quality
  workation:     number  // 0.0–1.0 — wifi + workspace reliability (hard-filterable)
  adventure:     number  // 0.0–1.0 — proximity to outdoor activity
  budget_fit:    number  // 0.0–1.0 — price relative to network (1 = cheapest)
  room_type_fit: number  // 0.0–1.0 — 0 = dorm-dominant, 1 = private-dominant
}
```

Scores are authored by hand using the calibration rubric in `docs/tagging-rubric-v1.md`. They are not derived from tags at query time.

`workation` is the only hard-filterable dimension: a user with `workation ≥ 0.8` matched to a property with `workation ≤ 0.2` is excluded from results entirely, not just ranked lower.

### Tags

Stored as `tags jsonb NOT NULL DEFAULT '[]'` — a `string[]` of controlled-vocabulary keywords.

Tags serve display and consistency purposes; they do not participate in the Day 5 dot-product ranking. The full vocabulary of 36 allowed tags is enforced by `src/scripts/validate-properties.ts`.

**Why jsonb and not a join table:** Tags are used for display on result cards and as a human-readable sanity check against scoring vectors. They are not aggregated, filtered in SQL, or indexed. A join table adds join complexity for no query benefit at this scale.

**Tags do not affect ranking.** The Day 5 dot-product runs entirely against `scoring`. Tags are a secondary layer for display and curation consistency only.

**Tags serve two roles — do not confuse them:**

| Role | Examples | Affects ranking? |
|---|---|---|
| Dimension proxies — readable shorthand for a scoring signal | `social`, `quiet`, `workation`, `adventure`, `budget`, `dorm`, `private` | No — the score is the signal, not the tag |
| Display / context labels — terrain, activity type, traveler character | `mountains`, `beach`, `trekking`, `cultural`, `romantic`, `backpacker` | No |

**Vocabulary note:** the tag `quiet` maps to the `calm` scoring dimension. They refer to the same property characteristic. `quiet` was chosen as the tag because it reads naturally on a result card; `calm` is the internal dimension key used in scoring and the rubric. Treat them as synonyms.

### Archetype Taxonomy

Seven archetypes group properties by dominant character. Used for editorial organisation and future UI filtering.

| Key | Description |
|---|---|
| `mountain_adventure_hub` | High-social, trail-access Himalayan bases |
| `remote_mountain_quiet` | Off-grid, low-footfall mountain stays |
| `cultural_hill_town` | Hill stations with cultural or workation character |
| `beach_social` | Coastal properties with social infrastructure |
| `heritage_cultural_city` | Rajasthan, heritage towns, pilgrimage cities |
| `urban_metro` | Metro city bases — Delhi, Mumbai, Bangalore, etc. |
| `nature_retreat` | Forest, backwater, and plantation retreats |

---

## Property Tagging Rubric v1

Full calibration guide in `docs/tagging-rubric-v1.md`. Key principles:

- Score the **property**, not the destination. A property in a party city with no common area scores low on `social`.
- `social` and `calm` are not inverses — a forest hostel with nightly group dinners can score high on both.
- `workation` is scored on actual wifi and workspace evidence, not destination connectivity.
- `budget_fit` scores the dorm price against the current network range (₹279–₹1,099).
- Allowed score values: 0.0, 0.1, 0.2 … 1.0. Finer precision is false accuracy.

Cross-dimension consistency rules (full list in the rubric):
- `social ≥ 0.8` → `calm` should be ≤ 0.4
- `workation ≥ 0.8` → `calm` should be ≥ 0.6
- `budget_fit ≥ 0.9` → `price_inr` should be ≤ ₹399

---

## Import Format

**Chosen format: JSON** (`src/data/properties.json`)

Each entry follows the `PropertySeed` interface from `src/types/index.ts`:

```json
{
  "name": "Zostel Old Manali",
  "destinationSlug": "manali",
  "location": "Old Manali",
  "priceInr": 749,
  "archetype": "mountain_adventure_hub",
  "scoring": { "social": 0.8, "calm": 0.2, "scenic": 0.9, "workation": 0.3, "adventure": 0.9, "budget_fit": 0.4, "room_type_fit": 0.2 },
  "tags": ["mountains", "riverside", "social", "backpacker", "trekking", "dorm"],
  "summary": "The original Zostel on the backpacker trail — Beas riverside, trail access from the doorstep, and a common area that fills up every evening.",
  "bookingUrl": "https://www.zostel.com/zostel/manali/"
}
```

**Why JSON over CSV:** scoring vectors are nested objects; CSV would require flattening 7 score columns and re-nesting them in code. JSON is directly parseable and matches the TypeScript type shape.

**Why not TypeScript directly:** the data file should be editable by a PM or content curator without TypeScript knowledge. JSON opens in any text editor with no build step. `src/config/properties.ts` is a thin typed wrapper that imports the JSON and re-exports it as `PropertySeed[]`.

**Destinations are derived:** `DESTINATIONS` in `src/config/properties.ts` is computed from the property list's unique `destinationSlug` values. No separate destinations file to maintain.

**Dataset at Day 4:** 50 properties across 42 destinations and all 7 archetypes. Covers all 6 recommendation personas with 5+ strong-match properties each.

---

## Import and Seeding Workflow

### Files

| File | Role |
|---|---|
| `src/data/properties.json` | Source of truth — edit this to add or update properties |
| `src/config/properties.ts` | Typed wrapper; imports JSON, exports `PROPERTIES` and `DESTINATIONS` |
| `src/scripts/validate-properties.ts` | Pre-seed validation; also runnable standalone |
| `src/db/seed.ts` | Reads config, validates, upserts destinations then properties |

### Commands

```bash
# Validate only (no DB writes)
npm run validate:properties

# Validate + seed (runs validation first, exits on any violation)
npm run db:seed
```

### Upsert behaviour

Properties upsert on `booking_url` (unique). On conflict, all mutable fields are updated: `name`, `location`, `price_inr`, `archetype`, `scoring`, `tags`, `summary`. Destinations upsert on `slug` with `onConflictDoNothing` — destination identity is stable.

This means the seed is safe to rerun after any content correction. A changed score, summary, or tag will land in the DB on the next `db:seed` run.

### Validation checks

The validator runs before any DB write and throws on the first batch of violations:
- All 7 scoring dimensions present and in `[0.0, 1.0]`
- All tags from the 36-value controlled vocabulary
- `archetype` is one of 7 valid values
- `priceInr` is a positive integer
- `bookingUrl` starts with `https://` and is unique across all 50 entries
- `name`, `destinationSlug`, `location`, `summary` are non-empty strings

---

## Schema Changes (Migration 0001)

`drizzle/0001_property_metadata.sql` adds to the Day 3 baseline:

**`properties` table:**
- `location text NOT NULL`
- `price_inr integer NOT NULL`
- `archetype text NOT NULL`
- `scoring jsonb NOT NULL`
- `summary text`
- `UNIQUE(booking_url)` constraint

**`recommendation_requests` table** (aligned with Day 3 intake schema):
- `persona` renamed to `persona_key`
- `vibe` renamed to `priority`
- `social_energy text NOT NULL` added
- `room_type text NOT NULL` added
- `budget text` (nullable) added

**`recommendation_results` table:**
- `score_snapshot jsonb NOT NULL` added — preserves the property's `ScoringVector` at ranking time so post-hoc analysis remains possible after a reseed overwrites the property's current scores.

---

## Assumptions

- All 50 property scores are hand-curated by a single author using the tagging rubric. Inter-curator consistency has not been tested.
- `priceInr` reflects the lowest dorm bed price at curation time. Prices are not live and will drift.
- `bookingUrl` values follow the pattern `https://www.zostel.com/zostel/{slug}/` and have not been individually verified as live URLs.
- No geographic data (coordinates, region, country) is stored. Properties in Nepal and Thailand are included without special handling.
- `summary` is nullable in the schema. All 50 seeded properties have summaries. The validator enforces non-empty summaries at import time, but the DB does not enforce it.

---

## Intentionally Deferred

| Item | Reason |
|---|---|
| Property images / media | No image CDN wired; not needed for Day 5 ranking |
| Availability / inventory | Live availability requires Zostel API integration — out of scope for MVP |
| Price range (min / max) | Only the dorm floor price is stored; range deferred until inventory data is available |
| Amenity detail (wifi speed, desk type, A/C) | `workation` score is the proxy; granular amenity data adds curation burden without ranking benefit at this scale |
| Review scores / ratings | No reviews pipeline; not needed for deterministic ranking |
| Geo coordinates | No map UI planned for MVP; coordinates add no value to the recommendation engine |
| `summary NOT NULL` constraint | Technically should be NOT NULL; deferred to avoid a blocking migration on existing rows if the column is backfilled via a future import |
| Inter-curator scoring consistency test | Weights are set by a single author; data-driven calibration needs usage data first |
| Region / country grouping on properties | Only `destination_id` exists; no `region` column — fine for MVP, needed if geographic filtering is added in Day 6+ |
