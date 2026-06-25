import { buildBannerMessage } from "@/lib/buildBannerMessage";

describe("buildBannerMessage", () => {
  // Null cases — no banner rendered
  test("high confidence + no fallback → null", () => {
    expect(buildBannerMessage("high", null)).toBeNull();
  });

  test("fallback=empty → null (empty state handles it, not banner)", () => {
    expect(buildBannerMessage("low", "empty")).toBeNull();
  });

  // Fallback mode messages
  test("thin_pool → fewer properties copy", () => {
    expect(buildBannerMessage("high", "thin_pool")).toMatch(/fewer/i);
  });

  test("weak_match → closest matches copy", () => {
    expect(buildBannerMessage("high", "weak_match")).toMatch(/closest matches/i);
  });

  test("hard_filter_relaxed → relaxed filter copy", () => {
    expect(buildBannerMessage("high", "hard_filter_relaxed")).toMatch(/relaxed/i);
  });

  // Confidence-only messages (fallback=null)
  test("moderate confidence + no fallback → good matches copy", () => {
    expect(buildBannerMessage("moderate", null)).toMatch(/good matches/i);
  });

  test("low confidence + no fallback → closest options copy", () => {
    expect(buildBannerMessage("low", null)).toMatch(/closest options/i);
  });

  // Fallback mode takes precedence over confidence copy
  test("fallback mode takes precedence over confidence level", () => {
    const withFallback = buildBannerMessage("low", "thin_pool");
    const confidenceOnly = buildBannerMessage("low", null);
    expect(withFallback).toMatch(/fewer/i);
    expect(withFallback).not.toEqual(confidenceOnly);
  });
});
