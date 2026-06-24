import { rankProperties, applyHardFilter, scoreProperty } from "@/lib/rankProperties";
import { classifyStrength, explainProperty, explainRanking } from "@/lib/generateExplanation";
import {
  WORKATION_USER_THRESHOLD,
  WORKATION_PROP_STRICT,
  WORKATION_PROP_RELAXED,
  HIGH_CONFIDENCE_THRESHOLD,
  LOW_CONFIDENCE_THRESHOLD,
} from "@/config/ranking";
import { WEIGHTS } from "@/config/weights";
import type { CandidateProperty, RankingInput } from "@/types/ranking";
import type { ScoringVector, Archetype } from "@/types";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

let _nextId = 1;

function makeProperty(
  scoring: Partial<ScoringVector>,
  overrides: Partial<Omit<CandidateProperty, "scoring">> = {}
): CandidateProperty {
  const id = overrides.id ?? _nextId++;
  return {
    id,
    name: overrides.name ?? `Property ${id}`,
    destinationSlug: overrides.destinationSlug ?? "anywhere",
    destinationName: overrides.destinationName ?? "Anywhere",
    location: overrides.location ?? "Test Location",
    priceInr: overrides.priceInr ?? 500,
    archetype: (overrides.archetype ?? "mountain_adventure_hub") as Archetype,
    tags: overrides.tags ?? [],
    summary: overrides.summary ?? "",
    bookingUrl: overrides.bookingUrl ?? `https://zostel.com/test/${id}`,
    scoring: {
      social: 0.5,
      calm: 0.5,
      scenic: 0.5,
      workation: 0.5,
      adventure: 0.5,
      budget_fit: 0.5,
      room_type_fit: 0.5,
      ...scoring,
    },
  };
}

// A user vector builder — defaults to a neutral mid-range vector.
function userVector(overrides: Partial<ScoringVector> = {}): ScoringVector {
  return {
    social: 0.5,
    calm: 0.5,
    scenic: 0.5,
    workation: 0.5,
    adventure: 0.5,
    budget_fit: 0.5,
    room_type_fit: 0.5,
    ...overrides,
  };
}

function input(user: ScoringVector, destinationSlug?: string): RankingInput {
  return { userVector: user, destinationSlug };
}

// Reset auto-increment id before each test so fixture ids are predictable.
beforeEach(() => {
  _nextId = 1;
});

// ─── scoreProperty ────────────────────────────────────────────────────────────

describe("scoreProperty", () => {
  test("perfect match on all dimensions scores 1.0", () => {
    const u = userVector({ social: 0.8, calm: 0.2 });
    const p = makeProperty({ social: 0.8, calm: 0.2 });
    const { score } = scoreProperty(u, p);
    expect(score).toBe(1.0);
  });

  test("complete mismatch on one dimension reduces score by its weight", () => {
    // Only social mismatches (gap = 1.0). All others match.
    const u = userVector({ social: 1.0 });
    const p = makeProperty({ social: 0.0 });
    const { score } = scoreProperty(u, p);
    // Expected: 1.0 - WEIGHTS.social * 1.0
    expect(score).toBeCloseTo(1.0 - WEIGHTS.social, 5);
  });

  test("breakdown.contribution sums to score", () => {
    const u = userVector();
    const p = makeProperty({});
    const { score, breakdown } = scoreProperty(u, p);
    const sumOfContributions = Object.values(breakdown).reduce((s, d) => s + d.contribution, 0);
    expect(sumOfContributions).toBeCloseTo(score, 10);
  });

  test("each dimension's gap and contribution are computed correctly", () => {
    const u = userVector({ social: 0.9 });
    const p = makeProperty({ social: 0.4 });
    const { breakdown } = scoreProperty(u, p);
    expect(breakdown.social.userValue).toBe(0.9);
    expect(breakdown.social.propertyValue).toBe(0.4);
    expect(breakdown.social.gap).toBeCloseTo(0.5, 10);
    expect(breakdown.social.contribution).toBeCloseTo(WEIGHTS.social * 0.5, 10);
  });
});

// ─── applyHardFilter ──────────────────────────────────────────────────────────

describe("applyHardFilter", () => {
  test("does not trigger when user workation is below the threshold", () => {
    const u = userVector({ workation: WORKATION_USER_THRESHOLD - 0.1 });
    const pool = [
      makeProperty({ workation: 0.0 }),
      makeProperty({ workation: 0.1 }),
      makeProperty({ workation: 0.2 }),
    ];
    const result = applyHardFilter(pool, u);
    expect(result.survivors).toHaveLength(3);
    expect(result.hardFilteredCount).toBe(0);
    expect(result.relaxedModeActivated).toBe(false);
  });

  test("strict mode: removes properties at or below WORKATION_PROP_STRICT", () => {
    const u = userVector({ workation: WORKATION_USER_THRESHOLD });
    const excluded = makeProperty({ workation: WORKATION_PROP_STRICT }); // <= strict → out
    const admitted = makeProperty({ workation: WORKATION_PROP_STRICT + 0.1 }); // > strict → in
    const result = applyHardFilter([excluded, admitted], u);
    expect(result.survivors).toEqual([admitted]);
    expect(result.hardFilteredCount).toBe(1);
    expect(result.relaxedModeActivated).toBe(false);
  });

  test("relaxed mode activates when strict produces 0 survivors", () => {
    const u = userVector({ workation: 1.0 });
    // All properties at or below the strict threshold.
    const zero = makeProperty({ workation: 0.0 }); // excluded by both
    const border = makeProperty({ workation: WORKATION_PROP_RELAXED }); // excluded (= relaxed threshold)
    const relaxed = makeProperty({ workation: WORKATION_PROP_STRICT }); // admitted under relaxed only

    const result = applyHardFilter([zero, border, relaxed], u);
    expect(result.relaxedModeActivated).toBe(true);
    expect(result.survivors).toEqual([relaxed]);
    expect(result.exemptedBookingUrls).toContain(relaxed.bookingUrl);
  });

  test("relaxed mode: properties admitted under relaxed rules appear in exemptedBookingUrls", () => {
    const u = userVector({ workation: 1.0 });
    const onlyRelaxed = makeProperty({ workation: WORKATION_PROP_STRICT }); // > relaxed, <= strict
    const result = applyHardFilter([onlyRelaxed], u);
    expect(result.exemptedBookingUrls).toContain(onlyRelaxed.bookingUrl);
  });

  test("returns empty survivors if all properties fail even the relaxed threshold", () => {
    const u = userVector({ workation: 1.0 });
    const dead = makeProperty({ workation: WORKATION_PROP_RELAXED }); // <= relaxed → excluded
    const result = applyHardFilter([dead], u);
    expect(result.survivors).toHaveLength(0);
  });
});

// ─── rankProperties — social traveler ────────────────────────────────────────

describe("rankProperties — solo social traveler", () => {
  test("socially strong properties rank in the top 3", () => {
    const u = userVector({
      social: 1.0,
      calm: 0.0,
      adventure: 0.6,
      budget_fit: 0.7,
      room_type_fit: 0.0,
    });
    const highSocial = [
      makeProperty({ social: 0.9, calm: 0.1 }, { name: "Party Beach" }),
      makeProperty({ social: 0.8, calm: 0.1 }, { name: "Social Hub" }),
    ];
    const lowSocial = [
      makeProperty({ social: 0.1, calm: 0.9 }, { name: "Quiet Retreat" }),
      makeProperty({ social: 0.2, calm: 0.8 }, { name: "Solo Hermit" }),
    ];
    const candidates = [...highSocial, ...lowSocial];

    const { results } = rankProperties(input(u), candidates);
    const topNames = results.slice(0, 2).map((r) => r.property.name);
    expect(topNames).toContain("Party Beach");
    expect(topNames).toContain("Social Hub");
  });

  test("low-social properties do not appear in top 3 when strong alternatives exist", () => {
    const u = userVector({ social: 1.0, calm: 0.0 });
    const candidates = [
      makeProperty({ social: 0.9, calm: 0.1 }, { name: "A" }),
      makeProperty({ social: 0.9, calm: 0.1 }, { name: "B" }),
      makeProperty({ social: 0.8, calm: 0.1 }, { name: "C" }),
      makeProperty({ social: 0.1, calm: 0.9 }, { name: "Quiet — should not appear in top 3" }),
      makeProperty({ social: 0.2, calm: 0.8 }, { name: "Calm — should not appear in top 3" }),
    ];
    const { results } = rankProperties(input(u), candidates);
    const top3Names = results.slice(0, 3).map((r) => r.property.name);
    expect(top3Names).not.toContain("Quiet — should not appear in top 3");
    expect(top3Names).not.toContain("Calm — should not appear in top 3");
  });
});

// ─── rankProperties — quiet traveler ─────────────────────────────────────────

describe("rankProperties — quiet solo traveler", () => {
  test("high-calm properties rank above high-social properties", () => {
    const u = userVector({ social: 0.1, calm: 0.9, room_type_fit: 1.0 });
    const quietProp = makeProperty({ social: 0.1, calm: 0.9 }, { name: "Quiet Retreat" });
    const socialProp = makeProperty({ social: 0.9, calm: 0.1 }, { name: "Party Beach" });
    const { results } = rankProperties(input(u), [quietProp, socialProp]);
    expect(results[0].property.name).toBe("Quiet Retreat");
  });

  test("a highly social property does not appear in top 3 when calmer alternatives exist", () => {
    const u = userVector({ social: 0.1, calm: 0.9 });
    const candidates = [
      makeProperty({ social: 0.1, calm: 0.9 }, { name: "Forest Lodge" }),
      makeProperty({ social: 0.2, calm: 0.8 }, { name: "Hill Cabin" }),
      makeProperty({ social: 0.1, calm: 0.9 }, { name: "Lakeside Hut" }),
      makeProperty({ social: 0.8, calm: 0.1 }, { name: "Party Hostel — should not rank top 3" }),
    ];
    const { results } = rankProperties(input(u), candidates);
    const top3 = results.slice(0, 3).map((r) => r.property.name);
    expect(top3).not.toContain("Party Hostel — should not rank top 3");
  });
});

// ─── rankProperties — room type soft preference ───────────────────────────────

describe("rankProperties — room type is a soft preference, not a hard filter", () => {
  test("dorm user: dorm-heavy property outscores private-heavy when all else equal", () => {
    const u = userVector({ room_type_fit: 0.0 });
    const dormProp = makeProperty({ room_type_fit: 0.0 }, { name: "Dorm House" });
    const privateProp = makeProperty({ room_type_fit: 1.0 }, { name: "Private Villa" });
    const { results } = rankProperties(input(u), [dormProp, privateProp]);
    expect(results[0].property.name).toBe("Dorm House");
  });

  test("private user: private-heavy property outscores dorm-heavy when all else equal", () => {
    const u = userVector({ room_type_fit: 1.0 });
    const dormProp = makeProperty({ room_type_fit: 0.0 }, { name: "Dorm House" });
    const privateProp = makeProperty({ room_type_fit: 1.0 }, { name: "Private Villa" });
    const { results } = rankProperties(input(u), [dormProp, privateProp]);
    expect(results[0].property.name).toBe("Private Villa");
  });

  test("private-heavy properties are NOT excluded — they still appear in results", () => {
    // Room type is soft: a private user with no private-only options should still get results.
    const u = userVector({ room_type_fit: 1.0 });
    const dormOnly = [makeProperty({ room_type_fit: 0.0 }), makeProperty({ room_type_fit: 0.1 })];
    const { results } = rankProperties(input(u), dormOnly);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].hardFilterExempted).toBe(false); // room type never hard-filters
  });
});

// ─── rankProperties — destination pre-filter ─────────────────────────────────

describe("rankProperties — destination pre-filter", () => {
  test("when destinationSlug is set, only in-destination properties appear in results", () => {
    const u = userVector();
    const manali1 = makeProperty({}, { destinationSlug: "manali", name: "Manali A" });
    const manali2 = makeProperty({}, { destinationSlug: "manali", name: "Manali B" });
    const goa = makeProperty({}, { destinationSlug: "goa", name: "Goa A" });
    const { results } = rankProperties(input(u, "manali"), [manali1, manali2, goa]);
    const names = results.map((r) => r.property.name);
    expect(names).toContain("Manali A");
    expect(names).toContain("Manali B");
    expect(names).not.toContain("Goa A");
  });

  test("without destinationSlug, all properties are candidates", () => {
    const u = userVector();
    const manali = makeProperty({}, { destinationSlug: "manali" });
    const goa = makeProperty({}, { destinationSlug: "goa" });
    const { results } = rankProperties(input(u), [manali, goa]);
    expect(results).toHaveLength(2);
  });

  test("destination filter with 0 matching properties returns empty + fallback:empty", () => {
    const u = userVector();
    const goa = makeProperty({}, { destinationSlug: "goa" });
    const { results, fallback } = rankProperties(input(u, "manali"), [goa]);
    expect(results).toHaveLength(0);
    expect(fallback).toBe("empty");
  });
});

// ─── rankProperties — group vs solo edge case ─────────────────────────────────

describe("rankProperties — group vs solo", () => {
  test("friends_getaway vector scores an adventure+social property higher than solo_quiet vector", () => {
    const groupUser = userVector({ social: 0.8, adventure: 0.8, calm: 0.1 });
    const soloUser = userVector({ social: 0.1, adventure: 0.3, calm: 0.9 });
    const adventureProp = makeProperty({ social: 0.8, adventure: 0.9, calm: 0.1 });

    const { score: groupScore } = scoreProperty(groupUser, adventureProp);
    const { score: soloScore } = scoreProperty(soloUser, adventureProp);
    expect(groupScore).toBeGreaterThan(soloScore);
  });

  test("top 3 results differ meaningfully between group and solo personas", () => {
    const groupUser = userVector({ social: 0.8, adventure: 0.8, calm: 0.1 });
    const soloUser = userVector({ social: 0.1, adventure: 0.3, calm: 0.9 });
    const candidates = [
      makeProperty({ social: 0.9, adventure: 0.9, calm: 0.1 }, { name: "Group Party Hub" }),
      makeProperty({ social: 0.1, adventure: 0.2, calm: 0.9 }, { name: "Quiet Retreat" }),
      makeProperty({ social: 0.8, adventure: 0.7, calm: 0.2 }, { name: "Lively Hostel" }),
      makeProperty({ social: 0.2, adventure: 0.3, calm: 0.8 }, { name: "Forest Cabin" }),
    ];
    const groupTop = rankProperties(input(groupUser), candidates).results[0].property.name;
    const soloTop = rankProperties(input(soloUser), candidates).results[0].property.name;
    expect(groupTop).not.toBe(soloTop);
  });
});

// ─── rankProperties — fallback behavior ──────────────────────────────────────

describe("rankProperties — fallback behavior", () => {
  test("hard filter relaxed fallback activates when strict filter wipes pool", () => {
    const u = userVector({ workation: 1.0 });
    // All candidates at or below the strict threshold — strict gives 0 survivors.
    const relaxedOnly = makeProperty({ workation: WORKATION_PROP_STRICT }); // > relaxed, <= strict
    const { fallback, results } = rankProperties(input(u), [relaxedOnly]);
    expect(fallback).toBe("hard_filter_relaxed");
    expect(results[0].hardFilterExempted).toBe(true);
  });

  test("thin_pool fallback when fewer than 5 properties survive", () => {
    const u = userVector();
    const candidates = [makeProperty({}), makeProperty({}), makeProperty({})];
    const { fallback, results } = rankProperties(input(u), candidates);
    expect(fallback).toBe("thin_pool");
    expect(results).toHaveLength(3);
  });

  test("empty fallback when 0 survivors remain after all filters", () => {
    const u = userVector({ workation: 1.0 });
    // workation = 0.0 is excluded by both strict and relaxed.
    const dead = makeProperty({ workation: 0.0 });
    const { fallback, results } = rankProperties(input(u), [dead]);
    expect(fallback).toBe("empty");
    expect(results).toHaveLength(0);
  });

  test("fallback:null on the nominal path (≥5 survivors, decent top score)", () => {
    const u = userVector({ social: 0.9 });
    // Six strong-match candidates → full pool, high score, no fallback.
    const candidates = Array.from({ length: 6 }, (_, i) =>
      makeProperty({ social: 0.9 }, { name: `Prop ${i}` })
    );
    const { fallback } = rankProperties(input(u), candidates);
    expect(fallback).toBeNull();
  });

  test("quiet user receives a fallback result if the only candidates are social", () => {
    // Room type is soft so a quiet user with only social candidates still gets results.
    const u = userVector({ social: 0.1, calm: 0.9 });
    const allSocial = Array.from({ length: 3 }, (_, i) =>
      makeProperty({ social: 0.9, calm: 0.1 }, { name: `Social ${i}` })
    );
    const { results, fallback } = rankProperties(input(u), allSocial);
    // No hard filter triggered → results are returned, just poorly matched.
    expect(results.length).toBeGreaterThan(0);
    expect(fallback).toBe("thin_pool");
  });
});

// ─── rankProperties — determinism ────────────────────────────────────────────

describe("rankProperties — determinism", () => {
  test("identical inputs always produce identical ranked order", () => {
    const u = userVector({ social: 0.8, calm: 0.2, adventure: 0.6 });
    const candidates = Array.from({ length: 8 }, (_, i) =>
      makeProperty(
        { social: 0.5 + i * 0.04, calm: 0.5 - i * 0.04 },
        { id: i + 1, name: `Prop ${i}` }
      )
    );

    const run1 = rankProperties(input(u), candidates).results.map((r) => r.property.id);
    const run2 = rankProperties(input(u), candidates).results.map((r) => r.property.id);
    const run3 = rankProperties(input(u), candidates).results.map((r) => r.property.id);

    expect(run1).toEqual(run2);
    expect(run2).toEqual(run3);
  });

  test("ties in score are broken by ascending property id", () => {
    const u = userVector();
    // Both properties have identical scoring vectors → identical scores.
    const first = makeProperty({}, { id: 1 });
    const second = makeProperty({}, { id: 2 });
    const { results } = rankProperties(input(u), [second, first]); // pass in reverse id order
    expect(results[0].property.id).toBe(1); // lower id wins the tie
    expect(results[1].property.id).toBe(2);
  });

  test("scores are stable across runs (no floating-point drift)", () => {
    const u = userVector({ social: 0.73, workation: 0.41 });
    const p = makeProperty({ social: 0.61, workation: 0.85 });
    const score1 = scoreProperty(u, p).score;
    const score2 = scoreProperty(u, p).score;
    expect(score1).toBe(score2);
  });
});

// ─── classifyStrength ─────────────────────────────────────────────────────────

describe("classifyStrength", () => {
  test.each([
    [0.0, "strong"],
    [0.2, "strong"],
    [0.21, "moderate"],
    [0.4, "moderate"],
    [0.41, "weak"],
    [1.0, "weak"],
  ])("gap %s → %s", (gap, expected) => {
    expect(classifyStrength(gap)).toBe(expected);
  });
});

// ─── explainProperty ─────────────────────────────────────────────────────────

describe("explainProperty", () => {
  test("topMatches contains the dimension with the highest contribution", () => {
    const u = userVector({ social: 1.0 }); // user wants maximum social
    const p = makeProperty({ social: 1.0, calm: 0.0 }, { id: 1 }); // property matches on social
    const { results } = rankProperties(input(u), [p]);
    const explanation = results[0].explanation;
    expect(explanation.topMatches[0].dim).toBe("social");
  });

  test("topMisses only contains dimensions with gap > MISS_GAP_THRESHOLD", () => {
    const u = userVector({ social: 1.0, calm: 0.0 });
    const p = makeProperty({ social: 0.0, calm: 1.0 }, { id: 1 }); // opposite on social/calm
    const { results } = rankProperties(input(u), [p]);
    const misses = results[0].explanation.topMisses;
    expect(misses.every((m) => m.gap > 0.2)).toBe(true);
    expect(misses.length).toBeGreaterThan(0);
  });

  test("filterTrace.passMode is not_applicable when workation filter is not triggered", () => {
    const u = userVector({ workation: 0.3 }); // below WORKATION_USER_THRESHOLD
    const p = makeProperty({ workation: 0.1 }, { id: 1 }); // would fail strict filter if triggered
    const { results } = rankProperties(input(u), [p]);
    expect(results[0].explanation.filterTrace.passMode).toBe("not_applicable");
    expect(results[0].explanation.filterTrace.hardFilterTriggered).toBe(false);
  });

  test("filterTrace.passMode is passed_relaxed for an exempted property", () => {
    const u = userVector({ workation: 1.0 });
    // workation: WORKATION_PROP_STRICT → excluded by strict, admitted by relaxed.
    const p = makeProperty({ workation: WORKATION_PROP_STRICT }, { id: 1 });
    const { results } = rankProperties(input(u), [p]);
    expect(results[0].explanation.filterTrace.passMode).toBe("passed_relaxed");
    expect(results[0].explanation.filterTrace.hardFilterTriggered).toBe(true);
  });

  test("filterTrace.passMode is passed_strict for a normally admitted workation property", () => {
    const u = userVector({ workation: 1.0 });
    const strict = makeProperty({ workation: WORKATION_PROP_STRICT + 0.1 }, { id: 1 }); // passes strict
    const exempt = makeProperty({ workation: WORKATION_PROP_STRICT }, { id: 2 }); // only relaxed
    const { results } = rankProperties(input(u), [strict, exempt]);
    const strictResult = results.find((r) => r.property.id === 1)!;
    expect(strictResult.explanation.filterTrace.passMode).toBe("passed_strict");
  });
});

// ─── explainRanking ───────────────────────────────────────────────────────────

describe("explainRanking", () => {
  test("confidenceReason is top_score_high when pool is full and top score >= 0.70", () => {
    const u = userVector({ social: 0.9 });
    const candidates = Array.from({ length: 6 }, (_, i) =>
      makeProperty({ social: 0.9 }, { name: `P${i}` })
    );
    const { rankingExplanation } = rankProperties(input(u), candidates);
    expect(rankingExplanation.confidenceReason).toBe("top_score_high");
    expect(rankingExplanation.confidence).toBe("high");
  });

  test("confidenceReason is thin_pool when fewer than 5 survivors", () => {
    const u = userVector({ social: 0.8 });
    const candidates = [makeProperty({ social: 0.8 }), makeProperty({ social: 0.8 })];
    const { rankingExplanation } = rankProperties(input(u), candidates);
    expect(rankingExplanation.confidenceReason).toBe("thin_pool");
  });

  test("confidenceReason is hard_filter_relaxed when relaxed mode was used", () => {
    const u = userVector({ workation: 1.0 });
    const relaxedOnly = makeProperty({ workation: WORKATION_PROP_STRICT });
    const { rankingExplanation } = rankProperties(input(u), [relaxedOnly]);
    expect(rankingExplanation.confidenceReason).toBe("hard_filter_relaxed");
    expect(rankingExplanation.relaxedModeUsed).toBe(true);
  });

  test("confidenceReason is empty_pool when no properties survived", () => {
    const u = userVector({ workation: 1.0 });
    const dead = makeProperty({ workation: 0.0 });
    const { rankingExplanation } = rankProperties(input(u), [dead]);
    expect(rankingExplanation.confidenceReason).toBe("empty_pool");
  });

  test("hardFilterTriggered reflects whether user workation met the threshold", () => {
    const triggered = userVector({ workation: WORKATION_USER_THRESHOLD });
    const notTriggered = userVector({ workation: WORKATION_USER_THRESHOLD - 0.1 });
    const p = makeProperty({ workation: 0.9 });

    expect(rankProperties(input(triggered), [p]).rankingExplanation.hardFilterTriggered).toBe(true);
    expect(rankProperties(input(notTriggered), [p]).rankingExplanation.hardFilterTriggered).toBe(
      false
    );
  });
});
