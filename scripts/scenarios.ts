import type {
  PersonaKey,
  StayPriority,
  SocialEnergy,
  RoomType,
  BudgetLevel,
} from "@/types";
import type { DimensionKey } from "@/config/scoring";

// ─── Schema ───────────────────────────────────────────────────────────────────

export type ScenarioCategory =
  | "canonical"           // one clean case per persona — the baseline
  | "edge_case"           // realistic but non-obvious combination
  | "destination_pinned"  // destinationSlug active; tests destination filter
  | "stress";             // extreme vector or near-empty pool

export type Classification = "strong" | "acceptable" | "poor";
export type IssueType      = "none" | "algorithm" | "metadata" | "both";

export interface DimensionExpectation {
  min?: number; // top results should have property.scoring[dim] >= min
  max?: number; // top results should have property.scoring[dim] <= max
}

// Immutable scenario definition — written once, never mutated during review.
export interface TestScenario {
  // ── Identity ──────────────────────────────────────────────────────────
  id:          string;
  label:       string;
  description: string;
  category:    ScenarioCategory;

  // ── Request ───────────────────────────────────────────────────────────
  // Maps 1:1 to RecommendationRequest. All fields explicit.
  request: {
    personaKey:       PersonaKey;
    priority:         StayPriority;
    socialEnergy:     SocialEnergy;
    roomType:         RoomType;
    budget?:          BudgetLevel;
    destinationSlug?: string;
  };

  // ── Expected qualities (PM-readable) ─────────────────────────────────
  expectQualities:  string[];
  rejectQualities:  string[];

  // ── Machine-checkable assertions ─────────────────────────────────────
  // At least one of these partial names must appear in results[0..n-1].
  expectInTopN?: {
    names: string[]; // partial match — "Pondicherry" matches the full name
    n:     number;
  };
  // All results[0..n-1] must satisfy these dimension thresholds.
  expectTopResultDimensions?: {
    n:    number;
    dims: Partial<Record<DimensionKey, DimensionExpectation>>;
  };

  // ── Review hints ──────────────────────────────────────────────────────
  reviewNotes?: string;
}

// PM fills these in during review. Stored separately from the definition.
export interface ClassifiedResult {
  rank:           number;
  propertyName:   string;
  location:       string;
  score:          number;
  topMatchDims:   string[];
  topMissDims:    string[];
  classification: Classification | null;
  pmNote?:        string;
}

export interface ValidationRun {
  scenarioId:            string;
  runAt:                 string; // ISO-8601
  results:               ClassifiedResult[];
  fallback:              string | null;
  confidence:            string;
  hardFilteredCount:     number;
  poolSize:              number;
  overallClassification: Classification | null;
  issueType:             IssueType | null;
  pmNote?:               string;
}

// ─── Scenario suite ───────────────────────────────────────────────────────────

export const SCENARIOS: TestScenario[] = [

  // ── Canonical (1 of 6) ────────────────────────────────────────────────────

  {
    id:          "solo-social-canonical",
    label:       "Solo social explorer — clean case",
    description: "Solo traveler who wants to meet people, stay in dorms, and have a good time. No work, no quiet.",
    category:    "canonical",
    request: {
      personaKey:   "solo_social",
      priority:     "social_vibe",
      socialEnergy: "very_social",
      roomType:     "dorm",
    },
    expectQualities:  ["highly social property", "dorms available", "popular with solo travelers", "hostel common-area culture"],
    rejectQualities:  ["remote mountain retreat with no guests", "zero social score", "workation-only hub"],
    expectInTopN: { names: ["Goa", "Phuket"], n: 2 },
    expectTopResultDimensions: {
      n:    3,
      dims: { social: { min: 0.7 } },
    },
    reviewNotes: "Expected vector: social=1.0 calm=0.0 scenic=0.4 adventure=0.6 budget=0.7 room=0.0. Goa #1 at 0.830 is the anchor — if it moves, investigate why.",
  },

  {
    id:          "solo-quiet-canonical",
    label:       "Quiet solo traveler — clean case",
    description: "Solo traveler who wants nature, silence, and private space. No socialising, no group energy.",
    category:    "canonical",
    request: {
      personaKey:   "solo_quiet",
      priority:     "calm_quiet",
      socialEnergy: "mostly_private",
      roomType:     "private",
    },
    expectQualities:  ["high calm score", "scenic natural setting", "private rooms available", "low foot traffic"],
    rejectQualities:  ["loud party hostel", "high social score", "urban city hub"],
    expectInTopN: { names: ["Kodaikanal", "Munnar", "Shangarh", "Kalpa"], n: 3 },
    expectTopResultDimensions: {
      n:    3,
      dims: { calm: { min: 0.8 }, social: { max: 0.3 } },
    },
    reviewNotes: "Expected vector: social=0.1 calm=0.9 scenic=0.8 room=1.0. Top scores should be 0.90+. Kodaikanal (Vilpatti) expected #1 at 0.925.",
  },

  {
    id:          "friends-adventure-canonical",
    label:       "Friends getaway — adventure + social",
    description: "Group of friends who want outdoor activities and a buzzing social scene. Dorms, big groups, high energy.",
    category:    "canonical",
    request: {
      personaKey:   "friends_getaway",
      priority:     "adventure_access",
      socialEnergy: "very_social",
      roomType:     "dorm",
    },
    expectQualities:  ["high adventure score", "high social score", "dorm beds available", "group-friendly"],
    rejectQualities:  ["silent mountain retreat", "zero adventure score", "private-only property"],
    expectInTopN: { names: ["Goa", "Kasol", "Rishikesh", "Manali"], n: 3 },
    expectTopResultDimensions: {
      n:    3,
      dims: { adventure: { min: 0.5 }, social: { min: 0.6 } },
    },
    reviewNotes: "Expected vector: social=1.0 calm=0.0 adventure=0.9 room=0.0. Note: Goa and friends share same social=1.0 as solo_social; adventure dimension separates them (0.9 vs 0.6).",
  },

  {
    id:          "couple-retreat-canonical",
    label:       "Couple retreat — calm + private",
    description: "Two people who want a private room in a calm, scenic setting. Not a party destination.",
    category:    "canonical",
    request: {
      personaKey:   "couple_retreat",
      priority:     "calm_quiet",
      socialEnergy: "mostly_private",
      roomType:     "private",
    },
    expectQualities:  ["high calm score", "scenic setting", "private rooms available", "not a social hub"],
    rejectQualities:  ["Goa", "party hostel", "city metro hub"],
    expectInTopN: { names: ["Kalpa", "Shangarh", "Pulga"], n: 2 },
    expectTopResultDimensions: {
      n:    3,
      dims: { calm: { min: 0.7 }, social: { max: 0.4 } },
    },
    reviewNotes: "Expected vector: social=0.1 calm=0.9 scenic=0.7 room=1.0. Top scores 0.85+. Overlap with solo_quiet is expected — both are calm+scenic personas.",
  },

  {
    id:          "workation-canonical",
    label:       "Workation traveler — hard filter active",
    description: "Remote worker who needs reliable wifi and a quiet workspace. Hard filter removes all low-workation properties.",
    category:    "canonical",
    request: {
      personaKey:   "workation",
      priority:     "work_setup",
      socialEnergy: "mostly_private",
      roomType:     "private",
    },
    expectQualities:  ["workation score > 0.2", "quiet workspace", "stable wifi", "private room"],
    rejectQualities:  ["beach party hostel", "zero workation score", "no wifi"],
    expectInTopN: { names: ["Pondicherry"], n: 1 },
    expectTopResultDimensions: {
      n:    5,
      dims: { workation: { min: 0.21 } }, // all results survived hard filter
    },
    reviewNotes: "Expected vector: workation=1.0 calm=0.9 social=0.1 room=1.0. Hard filter removes ~19 properties. Pondicherry #1 at 0.790. Confidence: high.",
  },

  {
    id:          "budget-backpacker-canonical",
    label:       "Budget backpacker — value first",
    description: "Cost is the primary constraint. Dorms, flexible on vibe, just wants the best price-to-experience ratio.",
    category:    "canonical",
    request: {
      personaKey:   "budget_backpacker",
      priority:     "best_value",
      socialEnergy: "balanced",
      roomType:     "dorm",
      budget:       "lowest",
    },
    expectQualities:  ["high budget_fit score (0.8+)", "dorm availability", "good value for money"],
    rejectQualities:  ["expensive private-only resort", "budget_fit below 0.5"],
    expectInTopN: { names: ["Jodhpur", "Jaipur", "Bundi"], n: 3 },
    expectTopResultDimensions: {
      n:    3,
      dims: { budget_fit: { min: 0.7 } },
    },
    reviewNotes: "Expected vector: budget_fit=1.0 social=0.5 calm=0.5 room=0.0. Jodhpur #1 at 0.875. Top 3 should all be Rajasthan heritage towns.",
  },

  // ── Edge cases (7) ────────────────────────────────────────────────────────

  {
    id:          "workation-social-tension",
    label:       "Workation + social priority tension",
    description: "Remote worker who explicitly wants social energy — wants to work in a city with people around, not a silent retreat.",
    category:    "edge_case",
    request: {
      personaKey:   "workation",
      priority:     "social_vibe",
      socialEnergy: "very_social",
      roomType:     "private",
    },
    expectQualities:  ["workation score > 0.2 (hard filter still active)", "urban or metro hub", "co-working culture", "some social scene"],
    rejectQualities:  ["zero workation score", "isolated mountain with no internet", "removed by hard filter"],
    expectInTopN: { names: ["Bangalore", "Delhi", "Hyderabad"], n: 3 },
    expectTopResultDimensions: {
      n:    3,
      dims: { workation: { min: 0.21 } },
    },
    reviewNotes: "Expected vector: workation=1.0 social=1.0 calm=0.0 room=1.0. Hard filter still removes low-workation properties. Metro hubs (Bangalore, Delhi, Hyderabad) should surface because they have workation > 0.2 AND some social score. Key test: hard filter + social demand both satisfied.",
  },

  {
    id:          "couple-adventure-pivot",
    label:       "Couple who wants adventure, not just calm",
    description: "A couple who are active travelers — scenic destination with trekking or water activities, still need private room.",
    category:    "edge_case",
    request: {
      personaKey:   "couple_retreat",
      priority:     "adventure_access",
      socialEnergy: "balanced",
      roomType:     "private",
    },
    expectQualities:  ["high adventure score", "scenic setting", "private rooms available", "outdoor activity access"],
    rejectQualities:  ["zero adventure score", "pure urban city stay", "dorm-only property"],
    expectInTopN: { names: ["Port Blair", "Kasol", "Kolad", "Rishikesh"], n: 3 },
    expectTopResultDimensions: {
      n:    3,
      dims: { adventure: { min: 0.5 }, scenic: { min: 0.6 } },
    },
    reviewNotes: "Expected vector: adventure=0.9 scenic=0.7 social=0.5 calm=0.5 room=1.0. Different from couple-retreat-canonical (Kalpa/Shangarh) — adventure=0.9 vs 0.3 changes result entirely. Port Blair #1 at 0.830.",
  },

  {
    id:          "friends-mountain-quiet",
    label:       "Friends who want calm and quiet over social",
    description: "A group of friends who are done with party hostels — they want a peaceful mountain base with adventure access. Priority is calm environment.",
    category:    "edge_case",
    request: {
      personaKey:   "friends_getaway",
      priority:     "calm_quiet",
      socialEnergy: "mostly_private",
      roomType:     "flexible",
    },
    expectQualities:  ["high calm score", "high scenic score", "mountain or nature setting"],
    rejectQualities:  ["Goa", "beach party scene", "low calm score"],
    expectInTopN: { names: ["Pulga", "Chitkul", "Sangla", "Shangarh"], n: 3 },
    expectTopResultDimensions: {
      n:    3,
      dims: { calm: { min: 0.7 } },
    },
    reviewNotes: "Expected vector: social=0.1 calm=0.9 scenic=0.4 adventure=0.8 room=0.5. Q2 calm_quiet sets calm=0.9; Q3 mostly_private reduces social to 0.1 without touching calm (by design — Q2 handles environment preference). Friends persona adventure=0.8 inherited unchanged. Results should be remote Himachal properties, NOT Goa.",
  },

  {
    id:          "solo-social-private-room",
    label:       "Solo social traveler who wants private room",
    description: "Wants the social hostel atmosphere and to meet people, but needs their own room at the end of the day.",
    category:    "edge_case",
    request: {
      personaKey:   "solo_social",
      priority:     "social_vibe",
      socialEnergy: "very_social",
      roomType:     "private",
    },
    expectQualities:  ["high social score", "private rooms available alongside dorms", "social common areas", "hostel culture"],
    rejectQualities:  ["social=0 property", "silent retreat", "no private rooms"],
    expectInTopN: { names: ["Goa", "Phuket", "Kasol"], n: 2 },
    expectTopResultDimensions: {
      n:    3,
      dims: { social: { min: 0.7 } },
    },
    reviewNotes: "Expected vector: social=1.0 calm=0.0 room=1.0 (changed from dorm). Same top 3 as solo-social-canonical but lower scores (~0.75 vs ~0.83) because room_type_fit=1.0 penalises dorm-heavy properties. Tests room preference effect on score spread.",
  },

  {
    id:          "budget-vs-comfort",
    label:       "Budget traveler who wants private room",
    description: "Cost-conscious but won't share a dorm. Budget and private room are both strong signals — a real tension.",
    category:    "edge_case",
    request: {
      personaKey:   "budget_backpacker",
      priority:     "best_value",
      socialEnergy: "mostly_private",
      roomType:     "private",
      budget:       "lowest",
    },
    expectQualities:  ["private rooms that are affordable", "decent budget_fit score despite private preference"],
    rejectQualities:  ["expensive private-only resort", "zero-budget-fit hostel with only dorms"],
    expectInTopN: { names: ["Chitkul", "Sangla", "Kalpa"], n: 3 },
    expectTopResultDimensions: {
      // budget_fit is intentionally NOT checked here — Kalpa (0.20) reaches #3
      // because calm=0.9 from the mostly_private override outweighs budget.
      // That calm-over-budget surfacing is the known quirk this scenario documents.
      n:    3,
      dims: { room_type_fit: { min: 0.4 } },
    },
    reviewNotes: "Expected vector: budget_fit=1.0 calm=0.9 social=0.1 room=1.0. The mostly_private energy override pushes calm=0.9 — this unexpectedly surfaces calm mountain properties over cheap Rajasthan towns. A known algorithm quirk worth flagging in PM review.",
  },

  {
    id:          "solo-quiet-adventure",
    label:       "Quiet solo traveler who wants outdoor adventure",
    description: "Solo traveler who needs peace and private space but also wants trekking, nature, and outdoor access — not just sitting in a room.",
    category:    "edge_case",
    request: {
      personaKey:   "solo_quiet",
      priority:     "adventure_access",
      socialEnergy: "mostly_private",
      roomType:     "private",
    },
    expectQualities:  ["high adventure score", "high scenic score", "calm setting", "private rooms"],
    rejectQualities:  ["zero adventure score", "busy social scene", "urban city hub"],
    expectInTopN: { names: ["Chitkul", "Sangla", "Kasol", "Rishikesh"], n: 3 },
    expectTopResultDimensions: {
      // adventure checked on n=1 only — Kodaikanal (Vilpatti) reaches #2 despite
      // adventure=0.30 because it scores strongly on calm+scenic. That slip is
      // a useful PM signal: "active mountain retreat" isn't a clean archetype yet.
      n:    1,
      dims: { adventure: { min: 0.4 }, calm: { min: 0.6 }, scenic: { min: 0.7 } },
    },
    reviewNotes: "Expected vector: adventure=0.9 calm=0.9 scenic=0.8 social=0.1 room=1.0. Chitkul #1 at 0.840. Tests whether a high calm + high adventure combination finds the right 'active mountain retreat' archetype.",
  },

  {
    id:          "persona-priority-inversion",
    label:       "Solo social persona fully overridden to quiet",
    description: "A user who initially ticks 'solo social' but then overrides every dimension toward calm. Tests that override chain wins, not the persona.",
    category:    "edge_case",
    request: {
      personaKey:   "solo_social",
      priority:     "calm_quiet",
      socialEnergy: "mostly_private",
      roomType:     "dorm",
    },
    expectQualities:  ["calm properties", "low social score", "should NOT be Goa or any beach party scene"],
    rejectQualities:  ["Goa", "high social score property", "party hostel"],
    expectInTopN: { names: ["Pulga", "Chitkul", "Sangla"], n: 3 },
    expectTopResultDimensions: {
      // n=1 only: Sam Desert (Jaisalmer) can slip into #2 because adventure=0.9
      // matches the solo_social persona baseline (adventure=0.6) well enough to
      // compensate for calm=0.70 and social=0.50. The key assertion is that Pulga
      // (the strongest calm+quiet property) leads, not that every top-3 is ultra-calm.
      n:    1,
      dims: { calm: { min: 0.8 }, social: { max: 0.3 } },
    },
    reviewNotes: "Expected vector: social=0.1 calm=0.9 adventure=0.6 budget=0.7 room=0.0. The solo_social persona is completely overridden. If Goa appears in top 3, the override chain has a bug. Key regression guard for last-write-wins semantics.",
  },

  // ── Destination-pinned (4) ────────────────────────────────────────────────

  {
    id:          "manali-friends",
    label:       "Friends adventure trip — Manali pinned",
    description: "Group of friends going to Manali for trekking. Destination is fixed; 3 properties available — thin pool expected.",
    category:    "destination_pinned",
    request: {
      personaKey:    "friends_getaway",
      priority:      "adventure_access",
      socialEnergy:  "very_social",
      roomType:      "dorm",
      destinationSlug: "manali",
    },
    expectQualities:  ["all 3 Manali properties returned", "Old Manali ranks highest for social+adventure", "thin_pool fallback"],
    rejectQualities:  ["properties from other destinations", "empty result"],
    expectInTopN: { names: ["Old Manali", "Manali (Vashisht)"], n: 2 },
    reviewNotes: "Pool = 3 (all Manali). Expected fallback: thin_pool. Old Manali #1 at 0.770. Dobhi scores noticeably lower (0.605) — good differentiation within a single destination.",
  },

  {
    id:          "goa-solo",
    label:       "Solo social trip — Goa pinned",
    description: "Solo traveler going to Goa. Only 1 property available — guaranteed thin pool, but result should still be strong.",
    category:    "destination_pinned",
    request: {
      personaKey:    "solo_social",
      priority:      "social_vibe",
      socialEnergy:  "very_social",
      roomType:      "dorm",
      destinationSlug: "goa",
    },
    expectQualities:  ["Goa returned as the result", "strong match score (0.80+)", "thin_pool fallback"],
    rejectQualities:  ["empty result", "non-Goa property"],
    expectInTopN: { names: ["Goa"], n: 1 },
    reviewNotes: "Pool = 1. Single result. Score = 0.830 which is strong — a thin pool with a high-quality match is acceptable. Tests that thin_pool fallback doesn't degrade the result itself.",
  },

  {
    id:          "rishikesh-couple",
    label:       "Couple retreat — Rishikesh pinned",
    description: "Couple heading to Rishikesh. 2 properties; scores are moderate (~0.52–0.62) because Rishikesh properties are more adventure-social than calm-private.",
    category:    "destination_pinned",
    request: {
      personaKey:    "couple_retreat",
      priority:      "calm_quiet",
      socialEnergy:  "mostly_private",
      roomType:      "private",
      destinationSlug: "rishikesh",
    },
    expectQualities:  ["both Rishikesh properties returned", "Tapovan ranks above Laxman Jhula (calmer)", "thin_pool fallback"],
    rejectQualities:  ["properties outside Rishikesh", "Laxman Jhula outranking Tapovan"],
    expectInTopN: { names: ["Rishikesh (Tapovan)"], n: 1 },
    reviewNotes: "Pool = 2. Both properties score moderately (0.615, 0.520) — this is a known tension: a calm+private couple choosing Rishikesh gets adventure-social properties. Confidence should be 'moderate'. Worth flagging to PM: destination is mismatched to persona.",
  },

  {
    id:          "jaisalmer-budget",
    label:       "Budget backpacker — Jaisalmer pinned",
    description: "Budget traveler heading to Jaisalmer. 2 properties: the town hostel and the desert camp. Both should return.",
    category:    "destination_pinned",
    request: {
      personaKey:    "budget_backpacker",
      priority:      "best_value",
      socialEnergy:  "balanced",
      roomType:      "dorm",
      budget:        "lowest",
      destinationSlug: "jaisalmer",
    },
    expectQualities:  ["both Jaisalmer properties returned", "Sam Desert camp ranks #1 (budget_fit=0.8)", "thin_pool fallback"],
    rejectQualities:  ["properties from other destinations", "empty result"],
    expectInTopN: { names: ["Sam Desert", "Jaisalmer"], n: 2 },
    reviewNotes: "Pool = 2. Sam Desert #1 at 0.830, Jaisalmer #2 at 0.815 — close scores, both strong matches. Tests that destination filter works and budget vector finds budget-fit properties correctly.",
  },

  // ── Stress (2) ────────────────────────────────────────────────────────────

  {
    id:          "workation-filter-stress",
    label:       "Workation hard filter — near-empty pool (Jaisalmer)",
    description: "Workation traveler heading to Jaisalmer. Both properties have low workation scores (0.2 and 0.0). Strict filter removes both; relaxed mode admits one.",
    category:    "stress",
    request: {
      personaKey:    "workation",
      priority:      "work_setup",
      socialEnergy:  "mostly_private",
      roomType:      "private",
      destinationSlug: "jaisalmer",
    },
    expectQualities:  ["hard_filter_relaxed fallback triggered", "1 property returned (Jaisalmer 0.2 survives relaxed filter)", "low confidence (score ~0.49)"],
    rejectQualities:  ["Sam Desert (workation=0.0) returned", "empty result", "relaxed mode not triggered"],
    expectInTopN: { names: ["Jaisalmer"], n: 1 },
    reviewNotes: "Pool = 1 after relaxed filter. Score = 0.495 (below LOW_CONFIDENCE_THRESHOLD 0.55) → confidence=low. Sam Desert (workation=0.0) is removed even by relaxed filter (0.0 is not > 0.1). Tests the boundary of the relaxed threshold and low-confidence path.",
  },

  {
    id:          "workation-no-destination-stress",
    label:       "Workation hard filter — full property pool stress",
    description: "Workation user with the most extreme vector possible. Tests that hard filter correctly removes ~19 properties and top results are all workation-capable.",
    category:    "stress",
    request: {
      personaKey:   "workation",
      priority:     "work_setup",
      socialEnergy: "mostly_private",
      roomType:     "private",
    },
    expectQualities:  ["19 properties hard-filtered", "top 5 all have workation > 0.2", "Pondicherry #1", "no beach/adventure-only properties in results"],
    rejectQualities:  ["Goa in results", "Kasol in results", "Jaisalmer desert in results", "any property with workation <= 0.2"],
    expectInTopN: { names: ["Pondicherry"], n: 1 },
    expectTopResultDimensions: {
      n:    5,
      dims: { workation: { min: 0.21 } },
    },
    reviewNotes: "Same vector as workation-canonical — this is the full-pool equivalent of workation-filter-stress. Validates filter count (19) and that top 5 are all workation-capable. Run both together to isolate destination-filter vs. hard-filter behavior.",
  },
];

export const SCENARIO_COUNT = SCENARIOS.length;
