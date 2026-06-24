# Day 6 Validation Guide

Internal reference for running the ZoCo ranking validation suite, reading results, classifying outcomes, and making safe scoring adjustments.

---

## Contents

1. [How the ranking engine works](#1-how-the-ranking-engine-works)
2. [Scenario format](#2-scenario-format)
3. [Running the suite](#3-running-the-suite)
4. [Reading debug output](#4-reading-debug-output)
5. [Classifying results](#5-classifying-results)
6. [Adjusting weights safely](#6-adjusting-weights-safely)
7. [Adjusting property metadata safely](#7-adjusting-property-metadata-safely)
8. [Rerunning after changes](#8-rerunning-after-changes)
9. [When something breaks](#9-when-something-breaks)

---

## 1. How the ranking engine works

Every recommendation request goes through four stages:

```
Request
  └─ buildUserVector()        ← combines persona baseline + question overrides
       └─ applyHardFilter()   ← removes workation mismatches before scoring
            └─ scoreProperty() ← dot-product across 7 dimensions
                 └─ sort + explain
```

### The scoring formula

```
score = Σ  W[d] × (1 − |U[d] − P[d]|)
         d
```

- `U[d]` — user value on dimension `d` (0–1, built from persona + questions)
- `P[d]` — property value on dimension `d` (0–1, from `properties.json`)
- `W[d]` — dimension weight (from `src/config/weights.ts`, must sum to 1.0)
- Gap `|U[d] − P[d]|` = 0 is a perfect match; gap = 1 contributes nothing
- Score range: 0.0–1.0; in practice 0.6–0.9 for well-matched pairs

### Current weights

| Dimension       | Weight | Notes                                                                 |
| --------------- | ------ | --------------------------------------------------------------------- |
| `adventure`     | 0.20   | Strongest discriminator — activity-seeking users                      |
| `social`        | 0.15   | Social-beach pull balanced against other dims                         |
| `calm`          | 0.15   | Quiet-environment signal; anti-correlated with social                 |
| `workation`     | 0.15   | Soft gradient above the hard filter floor (>0.2)                      |
| `room_type_fit` | 0.15   | Hostel-vibe vs private-vibe character; NOT availability               |
| `scenic`        | 0.10   | High concentration (72% of properties ≥ 0.8) — limited discrimination |
| `budget_fit`    | 0.10   | Absolute price ranking within the pool                                |

### The hard filter

Users with `workation ≥ 0.8` (the workation persona or `workation` priority) trigger the hard filter:

- **Strict mode**: only properties with `workation > 0.2` survive
- **Relaxed fallback**: if zero strict survivors, drops to `workation > 0.1`; activates `hard_filter_relaxed` in output
- **Effect**: can remove 70–90% of the pool for a workation user

All thresholds live in `src/config/ranking.ts`.

### User vector construction

1. Start with the persona baseline (e.g., `solo_social` sets social=0.8, calm=0.1)
2. Apply `priority` overrides (e.g., `scenic_views` sets scenic=0.9, adventure=0.7)
3. Apply `socialEnergy` overrides (e.g., `very_social` sets social=1.0, calm=0.0; `mostly_private` sets social=0.1)
4. Apply `roomType` overrides (e.g., `private` sets room_type_fit=0.9; `dorm` sets room_type_fit=0.0)
5. Apply `budget` overrides (e.g., `budget_first` sets budget_fit=1.0)
6. Clamp all values to [0, 1]

Overrides are last-write-wins — a later question can overwrite an earlier one on the same dimension. The `Vector` line in debug output shows the final merged result.

---

## 2. Scenario format

Scenarios live in `scripts/scenarios.ts`. Each scenario is a `TestScenario` object:

```typescript
{
  id:          "solo-social-canonical",      // kebab-case, unique
  label:       "Solo social explorer",       // short human label
  description: "...",                        // 1–2 sentences
  category:    "canonical",                  // see categories below

  request: {
    personaKey:   "solo_social",             // persona baseline
    priority:     "social_vibe",             // environment priority
    socialEnergy: "very_social",             // social energy level
    roomType:     "dorm",                    // room preference
    budget?:      "budget_first",            // optional budget level
    destinationSlug?: "manali",              // optional destination pin
  },

  expectQualities:  ["..."],   // plain-English PM expectations
  rejectQualities:  ["..."],   // properties / patterns that should NOT appear

  // Machine-checked assertions:
  expectInTopN?: {
    names: ["Goa", "Phuket"],  // partial match against property name
    n: 2,                      // at least one name must appear in top-N
  },
  expectTopResultDimensions?: {
    n:    3,
    dims: { social: { min: 0.7 } },  // top-3 results must have social ≥ 0.7
  },

  reviewNotes?: "...",  // reasoning, known edge cases, expected vector
}
```

### Categories

| Category             | Purpose                                            | Count |
| -------------------- | -------------------------------------------------- | ----- |
| `canonical`          | One clean case per persona — baseline reference    | 6     |
| `edge_case`          | Realistic but non-obvious combinations             | 7     |
| `destination_pinned` | `destinationSlug` active; tests destination filter | 4     |
| `stress`             | Extreme vector or near-empty pool                  | 2     |

### Valid persona keys

`solo_social` · `couple_retreat` · `friends_getaway` · `budget_backpacker` · `workcation_nomad`

### Valid priorities

`social_vibe` · `scenic_views` · `calm_quiet` · `adventure_access` · `workation_setup` · `budget_first`

### Valid social energies

`very_social` · `mixed` · `mostly_private`

### Valid room types

`dorm` · `private` · `flexible`

---

## 3. Running the suite

### Basic commands

```bash
# Full suite — all 19 scenarios
npm run validate:scenarios

# Summary table only (fastest scan)
npm run validate:scenarios -- --summary-only

# Single scenario
npm run validate:scenarios -- --scenario workation-canonical

# All scenarios in a category
npm run validate:scenarios -- --category edge_case

# With per-dimension score table (most detailed)
npm run validate:scenarios -- --scenario solo-social-canonical --breakdown

# Top-10 instead of default top-5
npm run validate:scenarios -- --top 10

# Save output to validation-runs/ directory
npm run validate:scenarios -- --save

# Machine-readable JSON
npm run validate:scenarios -- --json
```

### Combined workflows

```bash
# Full metadata + scoring review pipeline
npm run review:metadata
# runs: audit:properties → validate:properties → patch:check → validate:scenarios --summary-only

# Property quality audit
npm run audit:properties

# Audit a single property
npm run audit:properties -- --property "Zostel Pondicherry (Auroville Road)"

# Audit by flag type
npm run audit:properties -- --flag placeholder_values

# Validate properties.json structure
npm run validate:properties

# Check metadata edit log is consistent
npm run patch:check
```

---

## 4. Reading debug output

### Per-scenario header

```
══════════════════════════════════════════
  Scenario 3/19  canonical
  friends-adventure-canonical
  Friends adventure trip — clean case
══════════════════════════════════════════

  Request  persona=friends_getaway  priority=adventure_access  energy=mixed  room=flexible
  Vector   social=0.4  calm=0.1  scenic=0.7  workation=0.0  adventure=0.9  bdg=0.3  room=0.5

  Pipeline  pool=50  topScore=0.795  confidence=high
```

**Request line** — the raw inputs fed to the engine.

**Vector line** — the merged user vector after persona + question overrides. This is what actually drives scoring. Bright-white values are high (≥ 0.8), dim values are low (≤ 0.2). If a result feels wrong, start here.

**Pipeline line** — `pool` is properties after destination filter (50 if no destination pin). `topScore` is the #1 result's score. `confidence` is `high` (≥ 0.70) / `moderate` / `low`.

### Per-result block

```
#1  Zostel Old Manali  Old Manali
    score   ██████████████████████████░░░░░░  0.795
    matches social+0.06  adventure+0.18  budget_fit+0.03
    misses  scenic▲0.50  calm▲0.50
```

**Score bar** — filled proportion is score / 1.0. Two results at 0.795 and 0.790 will look nearly identical on the bar; look at the number.

**matches** — the top-N dimensions where the property scored positively, weighted. Format: `dim+contribution`. The + value is `W[d] × (1 − gap)` — what this dimension added to the total score.

**misses** — dimensions with gap > 0.2. Format: `dimΔgap`. A miss does not mean a bad result; it means the user and property differ on this dimension. A calm user seeing `social▲0.50` miss on a social property is expected.

### Breakdown table (--breakdown flag)

```
social        █████████░  contrib=0.135  u=1.00  p=0.90  gap=0.10
calm          █████████░  contrib=0.135  u=0.00  p=0.10  gap=0.10
scenic        █████░░░░░  contrib=0.050  u=0.40  p=0.90  gap=0.50
workation     ████████░░  contrib=0.120  u=0.00  p=0.20  gap=0.20
adventure     █████████░  contrib=0.180  u=0.60  p=0.70  gap=0.10
budget_fit    ███████░░░  contrib=0.070  u=0.70  p=1.00  gap=0.30
room_type_fit █████████░  contrib=0.135  u=0.00  p=0.10  gap=0.10
```

Each row: `dim  bar  contribution  u=user_value  p=property_value  gap`

The `contrib` column is what this dimension contributed to the total score. Sum all `contrib` values and you get the total score. The bar fills 10 segments proportional to `contrib / W[d]` — a full bar (10 segments) means a perfect match on that dimension.

**Red gap** — gap ≥ 0.3, a significant mismatch.

**Diagnostic reading example:** if `scenic` shows `contrib=0.050  u=0.40  p=0.90  gap=0.50` this means: user values scenic at 0.40, property is very scenic (0.90), but since scenic weight is only 0.10 the mismatch costs just 0.05 total. Scenic homogeneity (72% of properties have scenic ≥ 0.8) means this pattern is nearly universal and rarely differentiates results.

### Fallback and filter lines

```
  ⚠  hard_filter_relaxed — strict workation filter found 0 matches; pool expanded to workation > 0.1
```

| Fallback label        | Meaning                                                             |
| --------------------- | ------------------------------------------------------------------- |
| `none`                | Normal result, no fallback                                          |
| `hard_filter_relaxed` | Workation strict filter found 0 results; relaxed to > 0.1           |
| `thin_pool`           | Pool < 5 results (typically destination-pinned with few properties) |
| `weak_match`          | Top score < 0.55 — no strong match found                            |
| `empty`               | Zero results after filtering                                        |

### Assertion results

```
  ✓ expectInTopN  "Old Manali" found at rank 1  (required in top 2)
  ✓ expectTopResultDimensions  top-3 results: adventure ≥ 0.8  (required ≥ 0.8)
  ✗ expectInTopN  none of ["Goa", "Phuket"] in top 2 — got ["Old Manali", "Kasol"]
```

A failing assertion (`✗`) is a **ranking regression** that needs investigation. Pass (`✓`) means the assertion condition was met.

### Diagnostics (PM review flags)

```
  ⚡  weight_logic  top scores span only 0.02 — ranking is fragile; small metadata edits could reorder results
  ⚡  metadata      workation gap=0.42 for user workation=0.80 — Pondicherry might need a higher workation score
  ⚡  coverage      hard filter removed 78% of pool — verify workation property count is adequate
```

| Diagnostic             | Meaning                                                                             | Action                                                              |
| ---------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `weight_logic`         | Top-N scores span < 0.04 — fragile ordering                                         | Check if a minor metadata change could improve discrimination       |
| `metadata`             | A dimension the user cares about (≥ 0.60) shows a large gap (≥ 0.40) on top results | Audit the property's score for that dimension                       |
| `coverage:thin_pool`   | Pool < 10 properties reached scoring                                                | May need more properties in the destination/category                |
| `coverage:low_ceiling` | Top score < 0.65 with a full pool                                                   | No strong match; consider whether scenarios need different personas |
| `hard_filter`          | Filter removed ≥ 40% of pool                                                        | Common for workation users; verify the relaxed path works           |

---

## 5. Classifying results

After running a scenario, classify each result and the overall scenario using the criteria below.

### Result-level classifications

| Label        | Criteria                                                                                                                                   |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `strong`     | Property clearly fits the user's stated intent; top-match dimensions align with what the user asked for; PM would confidently recommend it |
| `acceptable` | Property is a defensible recommendation; minor gaps but no disqualifying mismatch; a user would not feel misled                            |
| `poor`       | Property is a meaningful mismatch; a real user would feel the recommendation missed their intent; or a clearly better option was displaced |

### Scenario-level classifications

| Label        | Criteria                                                                     |
| ------------ | ---------------------------------------------------------------------------- |
| `strong`     | #1 result is strong; #2–3 are acceptable or strong; no poor results in top-3 |
| `acceptable` | #1 is acceptable; mix in top-3; a reasonable user experience                 |
| `poor`       | #1 is poor; or two+ poor results in top-3; or assertions failing             |

### Issue type (for poor/acceptable scenarios)

| Label       | Meaning                                                                 | Fix                                                                                        |
| ----------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `algorithm` | Scoring formula or weights are producing an unintuitive ordering        | Adjust weights in `src/config/weights.ts` or ranking thresholds in `src/config/ranking.ts` |
| `metadata`  | A property has an incorrect score or tag that is distorting the ranking | Audit with `npm run audit:properties`; fix in `properties.json`                            |
| `both`      | Both the scoring logic and property data contribute to the problem      | Fix metadata first (cheaper), then re-evaluate whether algorithm changes are still needed  |

### When a result looks wrong — diagnostic checklist

1. **Check the Vector line.** Does it reflect what you intended? A question override may have written an unexpected value.
2. **Look at the breakdown.** Which dimension is pulling this property up — or suppressing a better one?
3. **Compare top-2 breakdowns.** Is the #1 property winning because of a dimension the user didn't ask about?
4. **Run `audit:properties` on the property.** Does it have a flag that explains the mismatch?
5. **Check if it's a metadata issue.** If the property score on the key dimension looks wrong (e.g., a beach property with calm=0.8), that is a metadata bug, not a weight bug.
6. **Check if it's a weight issue.** If the property scores look correct but the ordering still feels wrong, the weights may be over-rewarding a dimension the user doesn't care about.

---

## 6. Adjusting weights safely

### File to edit

`src/config/weights.ts`

### Rules

1. **Weights must sum to 1.0.** A compile-time assertion fires if they don't — `WEIGHTS must sum to 1.0 — got X.XXXX`. Fix the sum before proceeding.
2. **Change one weight at a time.** Changing two weights simultaneously makes it impossible to attribute the effect.
3. **Offset the change.** Every increase must be offset by a decrease on another dimension. Use `scenic` and `budget_fit` as the preferred absorption targets (lowest discrimination value currently).
4. **Before changing**, note which scenarios the dimension affects. Use `--breakdown` on those scenarios first so you have a before-comparison.
5. **Re-run the full suite** after every weight change. A weight that fixes one scenario frequently breaks two others.

### Weight impact table

Use this to predict what a weight change will do before making it:

| If you raise weight for... | Effect                                                                                                                                                                                               |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `adventure`                | Adventure destinations (Manali, Kasol, Pokhara) beat social-beach destinations (Goa, Phuket) more often                                                                                              |
| `social`                   | Social beach destinations surface more often; quiet/scenic properties pushed down                                                                                                                    |
| `calm`                     | Remote mountain properties dominate; social beaches lose rank                                                                                                                                        |
| `workation`                | Workation destinations increasingly outrank equivalent scenic retreats when user has any workation signal                                                                                            |
| `room_type_fit`            | Private-room users see more hotel-adjacent properties; dorm users penalised by mixed-character properties                                                                                            |
| `scenic`                   | Limited effect — 72% of properties are at scenic ≥ 0.8, so most properties gain equally. Raising scenic weight mainly widens the gap when comparing urban (scenic 0.1–0.3) vs. mountain destinations |
| `budget_fit`               | Budget properties gain; expensive boutique properties drop more in ranks for non-budget users                                                                                                        |

### Safe tuning increment

Move weights in steps of 0.05 maximum. A 0.05 shift on a 50-property pool with similar top scores typically changes ranks by 1–2 positions. A 0.10 shift can change the #1 result.

### Current baseline (Day 6)

```typescript
adventure: 0.2; // highest — activity-seeking users need clear signal
social: 0.15; // reduced from 0.20; was over-pulling Goa
calm: 0.15;
workation: 0.15;
room_type_fit: 0.15; // raised from 0.10; all properties have private rooms now
scenic: 0.1; // reduced from 0.15; high concentration limits discrimination
budget_fit: 0.1;
```

---

## 7. Adjusting property metadata safely

### Files to edit

- `src/data/properties.json` — the live scoring data
- `scripts/property-patches.ts` — the human-readable edit log (add an entry for every change)

### Audit first

Before editing any property:

```bash
npm run audit:properties -- --property "Zostel Pondicherry (Auroville Road)"
```

This shows all quality flags for that property. Address the flagged dimensions systematically rather than tweaking one value in isolation.

### Scoring rules

- Allowed values: any increment of 0.1 (0.0, 0.1 … 1.0). Finer values are false precision.
- Score what the property **is**, not what the traveler wants. The engine handles matching.
- 0.5 means genuinely ambiguous — not "I'm not sure." If you're not sure, read the tagging rubric (`docs/tagging-rubric-v1.md`) and pick a side.
- A well-differentiated property should have at least one dimension ≥ 0.7 and at least one ≤ 0.3.

### When to raise a score

Raise a dimension score when: user research, Zostel team confirmation, or on-ground evidence shows the property performs above its current label.

**Example:** `workation: 0.4 → 0.6` after confirming reliable wifi + desk workspace exists. Stay below 0.7 unless it has a purpose-built coworking setup.

### When to lower a score

Lower when: the property is being recommended in the wrong scenarios due to an inflated score; the current score was set to 0.5 as a placeholder and real research places it lower; or the `audit:properties` output flags an archetype/score inconsistency.

### Tags

Tags affect the audit (`audit:properties` checks tag-score consistency) but do NOT directly affect the ranking score. They are used for display and future features.

Do not add a tag you cannot verify. Remove a tag if the corresponding score is below the expectation (e.g., remove `"workation"` if `workation < 0.4`).

### Logging the change

After every edit to `properties.json`, add an entry to `scripts/property-patches.ts`:

```typescript
{
  property:    "Zostel Pondicherry (Auroville Road)",
  field:       "scenic",
  from:        0.5,
  to:          0.8,
  reason:      "Auroville Road property sits in a tree-lined area — Zostel team confirmed strong garden views. Previous 0.5 was a placeholder.",
  source:      "manual_review",
  appliedDate: "2026-06-25",
},
```

Then run `npm run patch:check` to confirm the entry is valid.

### Commit discipline

Always commit `properties.json` and `property-patches.ts` together so the before/after values and the reasoning land in the same commit message.

---

## 8. Rerunning after changes

### After a weight change

```bash
# Quick check — did the change break anything?
npm run validate:scenarios -- --summary-only

# Full detail on affected scenarios
npm run validate:scenarios -- --category canonical --breakdown

# Confirm the specific scenario you were targeting
npm run validate:scenarios -- --scenario <scenario-id> --breakdown
```

### After a metadata edit

```bash
# Full pipeline: audit + property schema check + patch log + scenarios
npm run review:metadata

# Or step by step:
npm run audit:properties -- --property "Zostel X"   # did the flags change?
npm run validate:properties                          # schema still valid?
npm run patch:check                                  # log entry added?
npm run validate:scenarios -- --summary-only         # no regressions?
```

### After adding a new scenario

```bash
# Validate the new scenario compiles and runs
npm run validate:scenarios -- --scenario <new-id>

# Check assertions pass
npm run validate:scenarios -- --summary-only
```

### After adding a new property

```bash
npm run validate:properties   # validates schema, unique URLs, valid tags, dim ranges
npm run audit:properties      # quality check the new entry
npm run validate:scenarios -- --summary-only  # confirm no regressions
```

### Interpreting a regression

A regression = an assertion that was passing now fails.

**Before reverting**, check:

1. Is the assertion wrong, or is the ranking wrong? Sometimes a scenario's expectation was calibrated to a known-imperfect result.
2. Run `--breakdown` on the failing scenario. Which dimension caused the rank change?
3. If a metadata change caused it: the new property data may be more correct; consider updating the assertion rather than reverting the data.
4. If a weight change caused it: re-examine the weight tradeoff. One scenario improving while another regresses usually means the weight was addressing a metadata problem, not a weight problem.

---

## 9. When something breaks

### Scenario assertions failing

```bash
npm run validate:scenarios -- --scenario <id> --breakdown
```

Read the assertion failure message. It says what was expected and what was found. Then:

- If the ranking is wrong → use the breakdown to identify the cause (weight or metadata)
- If the assertion is outdated → update the expectation in `scripts/scenarios.ts` and document why in `reviewNotes`

### `WEIGHTS must sum to 1.0` error

Edit `src/config/weights.ts`. The current sum must equal exactly 1.0. Add or subtract 0.05 from one dimension to correct.

### `validate:properties` fails

The schema validator (`src/scripts/validate-properties.ts`) checks: unique booking URLs, valid archetypes, dimension ranges [0,1], valid tags, non-empty required fields. Read the error message — it includes the property name and the violated rule.

### `audit:properties` exits 1

This means at least one `high`-severity issue was found. High-severity issues are: 4+ placeholder dimensions, or a hard archetype mismatch. The exit code is 1 so it can block CI if wired up; in interactive use, read the output and decide whether to fix before proceeding.

### Unexpected #1 result

1. Run the scenario with `--breakdown`.
2. Look at the Vector line. Verify it matches your intention.
3. Look at the #1 result's breakdown. Which dimension is winning?
4. Compare with the expected #1's breakdown. Why is the expected property scoring lower on that dimension?
5. Decide: is the winning property actually correct (update the expectation), or is something wrong (fix weights/metadata)?

---

_Last updated: 2026-06-24 — Day 6 validation baseline established. 19 scenarios, 19 passing. Weight tuning v2 (adventure=0.20, room_type_fit=0.15) in effect._
