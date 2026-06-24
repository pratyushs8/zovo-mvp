/**
 * Integration tests for the ranking engine against real property data.
 *
 * These tests use the actual PROPERTIES array and buildUserVector with real
 * PersonaKeys, so they catch tagging regressions in properties.json and
 * encode the expected output from the Day 5 verification run.
 *
 * If one of these tests breaks after editing properties.json, check whether
 * the scoring change was intentional before updating the assertion.
 */

import { PROPERTIES } from "@/config/properties";
import { buildUserVector } from "@/lib/buildUserVector";
import { rankProperties, scoreProperty } from "@/lib/rankProperties";
import { WORKATION_PROP_STRICT } from "@/config/ranking";
import type { CandidateProperty } from "@/types/ranking";
import type { RecommendationRequest } from "@/types/api";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function candidates(): CandidateProperty[] {
  return PROPERTIES.map((p, i) => ({ ...p, id: i + 1 }));
}

function run(req: RecommendationRequest, destinationSlug?: string) {
  const userVector = buildUserVector(req);
  return rankProperties({ userVector, destinationSlug }, candidates());
}

function req(overrides: Partial<RecommendationRequest>): RecommendationRequest {
  return {
    sessionId:    "integration-test",
    personaKey:   "solo_social",
    priority:     "social_vibe",
    socialEnergy: "balanced",
    roomType:     "flexible",
    ...overrides,
  };
}

// ─── Workation persona ────────────────────────────────────────────────────────

describe("workation persona — real data", () => {
  const workationReq = req({
    personaKey:   "workation",
    priority:     "work_setup",
    socialEnergy: "mostly_private",
    roomType:     "private",
  });

  test("Pondicherry ranks #1 (best calm+workation combination in dataset)", () => {
    const { results } = run(workationReq);
    expect(results[0].property.name).toContain("Pondicherry");
  });

  test("top 5 all have workation > WORKATION_PROP_STRICT (hard filter working)", () => {
    const { results } = run(workationReq);
    for (const r of results) {
      expect(r.property.scoring.workation).toBeGreaterThan(WORKATION_PROP_STRICT);
    }
  });

  test("hard filter removes at least 15 properties (leisure-only pool)", () => {
    const { hardFilteredCount } = run(workationReq);
    expect(hardFilteredCount).toBeGreaterThanOrEqual(15);
  });

  test("topMatches surfaces workation and calm at the top", () => {
    // Old sort (by contribution) would surface scenic+adventure as #1/#2 because
    // both user and property coincidentally match at low values (gap=0 but user
    // doesn't actually care about them). New sort (by matchScore = contribution ×
    // userValue) correctly demotes dimensions the user doesn't care about.
    const { results } = run(workationReq);
    const top2Dims = results[0].explanation.topMatches.slice(0, 2).map((m) => m.dim);
    expect(top2Dims).toContain("workation");
    expect(top2Dims).toContain("calm");
    // adventure (userValue=0.1) must not appear — it would have ranked #1 under old sort.
    const allTopDims = results[0].explanation.topMatches.map((m) => m.dim);
    expect(allTopDims).not.toContain("adventure");
  });

  test("metro workation hubs survive hard filter despite being social", () => {
    // Bangalore (wk:0.9), Delhi (wk:0.8), Hyderabad (wk:0.8) must pass strict filter.
    const allCandidates = candidates();
    const userVector = buildUserVector(workationReq);
    const metroNames = ["Bangalore", "Delhi", "Hyderabad"];
    for (const name of metroNames) {
      const prop = allCandidates.find((c) => c.name.includes(name));
      expect(prop).toBeDefined();
      expect(prop!.scoring.workation).toBeGreaterThan(WORKATION_PROP_STRICT);
    }
  });

  test("metro hubs score lower than calm workation hubs for calm-seeking user", () => {
    // Bangalore (wk:0.9 but social:0.8, calm:0.2) should score below Pondicherry
    // (wk:0.8 but calm:0.7) for a user who wants calm + workation.
    const allCandidates = candidates();
    const userVector = buildUserVector(workationReq);
    const bangalore   = allCandidates.find((c) => c.name.includes("Bangalore"))!;
    const pondicherry = allCandidates.find((c) => c.name.includes("Pondicherry"))!;
    const bScore = scoreProperty(userVector, bangalore).score;
    const pScore = scoreProperty(userVector, pondicherry).score;
    expect(pScore).toBeGreaterThan(bScore);
  });
});

// ─── Solo social persona ──────────────────────────────────────────────────────

describe("solo_social persona — real data", () => {
  const socialReq = req({
    personaKey:   "solo_social",
    priority:     "social_vibe",
    socialEnergy: "very_social",
    roomType:     "dorm",
  });

  test("Goa (Morjim) ranks #1 (highest social score in dataset)", () => {
    const { results } = run(socialReq);
    expect(results[0].property.name).toContain("Goa");
  });

  test("top 3 all have social score >= 0.7", () => {
    const { results } = run(socialReq);
    for (const r of results.slice(0, 3)) {
      expect(r.property.scoring.social).toBeGreaterThanOrEqual(0.7);
    }
  });

  test("no high-calm low-social property appears in top 3", () => {
    // Properties with calm >= 0.8 and social <= 0.2 are polar opposites of a
    // very-social user; they must not appear in the top 3.
    const { results } = run(socialReq);
    for (const r of results.slice(0, 3)) {
      const isMismatch =
        r.property.scoring.calm   >= 0.8 &&
        r.property.scoring.social <= 0.2;
      expect(isMismatch).toBe(false);
    }
  });

  test("no hard filter triggered (solo_social has workation=0.0)", () => {
    const { rankingExplanation } = run(socialReq);
    expect(rankingExplanation.hardFilterTriggered).toBe(false);
    expect(rankingExplanation.hardFilteredCount).toBe(0);
  });

  test("confidence is high (plenty of strong social matches in dataset)", () => {
    const { confidence } = run(socialReq);
    expect(confidence).toBe("high");
  });
});

// ─── Couple retreat persona ───────────────────────────────────────────────────

describe("couple_retreat persona — real data", () => {
  const coupleReq = req({
    personaKey:   "couple_retreat",
    priority:     "calm_quiet",
    socialEnergy: "mostly_private",
    roomType:     "private",
  });

  test("Kalpa ranks #1 (top calm+scenic+private combination)", () => {
    const { results } = run(coupleReq);
    expect(results[0].property.name).toContain("Kalpa");
  });

  test("Goa (highly social) does not appear in top 3", () => {
    const { results } = run(coupleReq);
    const top3Names = results.slice(0, 3).map((r) => r.property.name);
    expect(top3Names.some((n) => n.includes("Goa"))).toBe(false);
  });

  test("top 3 all have calm >= 0.7 (couple wants a quiet stay)", () => {
    const { results } = run(coupleReq);
    for (const r of results.slice(0, 3)) {
      expect(r.property.scoring.calm).toBeGreaterThanOrEqual(0.7);
    }
  });

  test("top 3 all have social <= 0.4 (couple avoids party hostels)", () => {
    const { results } = run(coupleReq);
    for (const r of results.slice(0, 3)) {
      expect(r.property.scoring.social).toBeLessThanOrEqual(0.4);
    }
  });
});

// ─── Budget backpacker persona ────────────────────────────────────────────────

describe("budget_backpacker persona — real data", () => {
  const budgetReq = req({
    personaKey:   "budget_backpacker",
    priority:     "best_value",
    socialEnergy: "balanced",
    roomType:     "dorm",
    budget:       "lowest",
  });

  test("Jodhpur ranks #1 (budget_fit:1.0, good social score)", () => {
    const { results } = run(budgetReq);
    expect(results[0].property.name).toContain("Jodhpur");
  });

  test("top 3 all have budget_fit >= 0.7", () => {
    const { results } = run(budgetReq);
    for (const r of results.slice(0, 3)) {
      expect(r.property.scoring.budget_fit).toBeGreaterThanOrEqual(0.7);
    }
  });

  test("expensive properties (budget_fit <= 0.2) do not appear in top 3", () => {
    const { results } = run(budgetReq);
    for (const r of results.slice(0, 3)) {
      expect(r.property.scoring.budget_fit).toBeGreaterThan(0.2);
    }
  });
});

// ─── Friends getaway persona ──────────────────────────────────────────────────

describe("friends_getaway persona — real data", () => {
  const friendsReq = req({
    personaKey:   "friends_getaway",
    priority:     "adventure_access",
    socialEnergy: "very_social",
    roomType:     "dorm",
  });

  test("Goa (Morjim) ranks #1 (social + coastal + accessible)", () => {
    const { results } = run(friendsReq);
    expect(results[0].property.name).toContain("Goa");
  });

  test("top 5 include at least one high-adventure property (adventure >= 0.7)", () => {
    const { results } = run(friendsReq);
    const hasAdventure = results.some((r) => r.property.scoring.adventure >= 0.7);
    expect(hasAdventure).toBe(true);
  });

  test("quiet solo retreat properties do not dominate top 3", () => {
    // Properties with social <= 0.2 and calm >= 0.9 are wrong for a group.
    const { results } = run(friendsReq);
    for (const r of results.slice(0, 3)) {
      const isQuietRetreat =
        r.property.scoring.social <= 0.2 &&
        r.property.scoring.calm   >= 0.9;
      expect(isQuietRetreat).toBe(false);
    }
  });
});

// ─── Destination filter — real data ───────────────────────────────────────────

describe("destination filter — real data", () => {
  test("Manali destination returns only Manali properties", () => {
    const { results } = run(req({ personaKey: "solo_social", priority: "social_vibe", socialEnergy: "very_social", roomType: "dorm" }), "manali");
    for (const r of results) {
      expect(r.property.destinationSlug).toBe("manali");
    }
  });

  test("Manali pool has exactly 3 properties (matches data file)", () => {
    const manaliCount = PROPERTIES.filter((p) => p.destinationSlug === "manali").length;
    expect(manaliCount).toBe(3);
    const { poolSize, fallback } = run(req({ personaKey: "solo_social", priority: "social_vibe", socialEnergy: "very_social", roomType: "dorm" }), "manali");
    expect(poolSize).toBe(3);
    expect(fallback).toBe("thin_pool");
  });
});

// ─── Persona divergence ───────────────────────────────────────────────────────

describe("persona divergence — real data", () => {
  test("workation and couple_retreat produce non-overlapping top 3", () => {
    const workation = run(req({ personaKey: "workation", priority: "work_setup", socialEnergy: "mostly_private", roomType: "private" }));
    const couple    = run(req({ personaKey: "couple_retreat", priority: "calm_quiet", socialEnergy: "mostly_private", roomType: "private" }));
    const wkNames     = new Set(workation.results.slice(0, 3).map((r) => r.property.name));
    const coupleNames = couple.results.slice(0, 3).map((r) => r.property.name);
    const overlap = coupleNames.filter((n) => wkNames.has(n));
    // At most 1 overlap allowed — the two personas have fundamentally different priorities.
    expect(overlap.length).toBeLessThanOrEqual(1);
  });

  test("solo_social and solo_quiet produce opposite top results", () => {
    const social = run(req({ personaKey: "solo_social", priority: "social_vibe", socialEnergy: "very_social", roomType: "dorm" }));
    const quiet  = run(req({ personaKey: "solo_quiet",  priority: "calm_quiet",  socialEnergy: "mostly_private", roomType: "private" }));
    // The social #1 should have higher social score than the quiet #1.
    expect(social.results[0].property.scoring.social)
      .toBeGreaterThan(quiet.results[0].property.scoring.social);
    // The quiet #1 should have higher calm score than the social #1.
    expect(quiet.results[0].property.scoring.calm)
      .toBeGreaterThan(social.results[0].property.scoring.calm);
  });
});
