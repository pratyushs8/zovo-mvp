/**
 * Property metadata decision log — Day 6 and beyond.
 *
 * PURPOSE
 * -------
 * This file is a human-readable audit trail for every deliberate scoring
 * or tagging change made to src/data/properties.json. It does NOT execute
 * changes — properties.json is always the source of truth, and git history
 * shows exactly what changed byte-by-byte. This file answers WHY.
 *
 * HOW TO USE
 * ----------
 * 1. Identify an issue via `npm run audit:properties` or a scenario diagnostic.
 * 2. Edit src/data/properties.json directly.
 * 3. Add an entry below with the old and new values + reason.
 * 4. Run `npm run patch:check` — confirms every entry references a real property
 *    and has a non-empty reason. It does NOT verify values match the JSON
 *    (values may have been updated again since the original patch).
 * 5. Commit properties.json + property-patches.ts together so the diff
 *    and the rationale land in the same commit.
 *
 * ENTRY FORMAT
 * ------------
 * See PropertyPatch below. The `from` / `to` fields are informational —
 * they reflect the values at the time of the edit, not the current state.
 * Add a new entry rather than updating an old one when making a second pass.
 */

import type { DimensionKey } from "@/config/scoring";
import type { Archetype } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────

export type PatchField = DimensionKey | "archetype" | "tags" | "summary" | "priceInr";

export type AuditSource =
  | "audit_placeholder_values"
  | "audit_low_differentiation"
  | "audit_archetype_mismatch"
  | "audit_tag_score_gap"
  | "audit_workation_limbo"
  | "audit_price_tag_mismatch"
  | "scenario_diagnostic"   // a PM review finding from validate-scenarios
  | "manual_review"         // direct inspection / user research
  | "user_feedback";        // report from a real user

export interface PropertyPatch {
  /** Exact property name as it appears in properties.json. */
  property:    string;
  /** Which field was changed. Use a DimensionKey for scoring changes. */
  field:       PatchField;
  /** Value before this patch was applied (informational). */
  from:        number | string | string[];
  /** Value after this patch was applied (informational). */
  to:          number | string | string[];
  /** Why this change was made. Required — leave it blank and patch:check fails. */
  reason:      string;
  /** Which check or process surfaced the issue. */
  source:      AuditSource;
  /** ISO date the patch was applied (YYYY-MM-DD). */
  appliedDate: string;
}

// ─── Patches ─────────────────────────────────────────────────────────────────
// Entries are ordered by appliedDate ascending. Add new entries at the bottom.

export const PATCHES: PropertyPatch[] = [

  // ── 2026-06-24: Day 6 metadata corrections ────────────────────────────────
  // Confirmed by Zostel product team: Goa (Morjim) and Kasol both offer
  // private rooms at 2× the dorm starting price. room_type_fit now represents
  // experience character (hostel-vibe vs private-vibe), not room availability.

  {
    property:    "Zostel Goa (Morjim)",
    field:       "room_type_fit",
    from:        0.1,
    to:          0.4,
    reason:      "Property has private rooms. Score updated from near-zero to 0.4 to reflect " +
                 "mixed hostel/private character. Remains below 0.5 because the dominant atmosphere " +
                 "is still social dorm culture.",
    source:      "scenario_diagnostic",
    appliedDate: "2026-06-24",
  },

  {
    property:    "Zostel Kasol",
    field:       "room_type_fit",
    from:        0.2,
    to:          0.4,
    reason:      "Property has private rooms. Same rationale as Goa — updated from dorm-only " +
                 "tagging to mixed, retaining hostel-culture character below 0.5.",
    source:      "scenario_diagnostic",
    appliedDate: "2026-06-24",
  },

  {
    property:    "Zostel Munnar",
    field:       "workation",
    from:        0.4,
    to:          0.6,
    reason:      "Confirmed reliable wifi and dedicated workspace by Zostel team. Previous 0.4 " +
                 "underrepresented actual work infrastructure. Stays below 0.7 because it's " +
                 "primarily a nature retreat, not a purpose-built work hub.",
    source:      "scenario_diagnostic",
    appliedDate: "2026-06-24",
  },

  {
    property:    "Zostel Kodaikanal",
    field:       "workation",
    from:        0.4,
    to:          0.6,
    reason:      "Same confirmation as Munnar — reliable wifi + workspace available. " +
                 "Moderately improved to reflect actual infrastructure without overstating it.",
    source:      "scenario_diagnostic",
    appliedDate: "2026-06-24",
  },

  {
    property:    "Zostel Kodaikanal (Vilpatti)",
    field:       "workation",
    from:        0.3,
    to:          0.55,
    reason:      "Confirmed wifi availability. Slightly lower than main Kodaikanal property " +
                 "because Vilpatti is more remote and connectivity may be less consistent.",
    source:      "scenario_diagnostic",
    appliedDate: "2026-06-24",
  },

];
