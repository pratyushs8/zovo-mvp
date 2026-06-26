// Integration tests for the Day 10 handoff pipeline against real property data.
//
// Uses the live PROPERTIES array from properties.json to verify that:
//   - every property produces a valid outbound URL
//   - UTM attribution fields are present and correctly formed
//   - rank and session context travel through the full buildViewStayUrl call
//   - no internal fields (requestId, score) appear in outbound URLs

import { PROPERTIES } from "@/config/properties";
import { buildViewStayUrl } from "@/lib/buildViewStayUrl";

const SESSION = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const ZOSTEL_ORIGIN = "https://www.zostel.com";

// ─── Real property coverage ───────────────────────────────────────────────────

describe("handoff URL — real property data", () => {
  test("every property in the DB has a non-empty bookingUrl", () => {
    const missing = PROPERTIES.filter((p) => !p.bookingUrl);
    expect(missing).toHaveLength(0);
  });

  test("every property bookingUrl starts with https://www.zostel.com/", () => {
    const invalid = PROPERTIES.filter((p) => !p.bookingUrl.startsWith(`${ZOSTEL_ORIGIN}/`));
    expect(invalid).toEqual([]);
  });

  test("buildViewStayUrl returns ok:true for every real property", () => {
    const failures = PROPERTIES.filter((p) => {
      const result = buildViewStayUrl({ bookingUrl: p.bookingUrl, rank: 1, sessionId: SESSION });
      return !result.ok;
    });
    expect(failures).toHaveLength(0);
  });

  test("all 50 properties generate valid outbound URLs", () => {
    expect(PROPERTIES).toHaveLength(50);
    const results = PROPERTIES.map((p) =>
      buildViewStayUrl({ bookingUrl: p.bookingUrl, rank: 1, sessionId: SESSION })
    );
    expect(results.every((r) => r.ok)).toBe(true);
  });
});

// ─── UTM attribution on real URLs ─────────────────────────────────────────────

describe("handoff URL — attribution params on real properties", () => {
  test("utm_source is 'zoco' for every property", () => {
    PROPERTIES.forEach((p) => {
      const result = buildViewStayUrl({ bookingUrl: p.bookingUrl, rank: 1, sessionId: SESSION });
      if (!result.ok) throw new Error(`URL failed for ${p.name}`);
      expect(new URL(result.url).searchParams.get("utm_source")).toBe("zoco");
    });
  });

  test("utm_medium is 'recommendation' for every property", () => {
    PROPERTIES.forEach((p) => {
      const result = buildViewStayUrl({ bookingUrl: p.bookingUrl, rank: 1, sessionId: SESSION });
      if (!result.ok) throw new Error(`URL failed for ${p.name}`);
      expect(new URL(result.url).searchParams.get("utm_medium")).toBe("recommendation");
    });
  });

  test("utm_content encodes rank correctly for ranks 1–5", () => {
    const property = PROPERTIES[0];
    [1, 2, 3, 4, 5].forEach((rank) => {
      const result = buildViewStayUrl({
        bookingUrl: property.bookingUrl,
        rank,
        sessionId: SESSION,
      });
      if (!result.ok) throw new Error("URL failed");
      expect(new URL(result.url).searchParams.get("utm_content")).toBe(`rank_${rank}`);
    });
  });

  test("utm_campaign matches the sessionId", () => {
    const property = PROPERTIES[0];
    const result = buildViewStayUrl({
      bookingUrl: property.bookingUrl,
      rank: 1,
      sessionId: SESSION,
    });
    if (!result.ok) throw new Error("URL failed");
    expect(new URL(result.url).searchParams.get("utm_campaign")).toBe(SESSION);
  });

  test("utm_campaign is absent when sessionId is not provided", () => {
    const property = PROPERTIES[0];
    const result = buildViewStayUrl({ bookingUrl: property.bookingUrl, rank: 1 });
    if (!result.ok) throw new Error("URL failed");
    expect(new URL(result.url).searchParams.has("utm_campaign")).toBe(false);
  });

  test("no internal fields appear in any outbound URL", () => {
    const internalFields = ["requestId", "propertyId", "score", "sessionId"];
    PROPERTIES.forEach((p) => {
      const result = buildViewStayUrl({ bookingUrl: p.bookingUrl, rank: 1, sessionId: SESSION });
      if (!result.ok) throw new Error(`URL failed for ${p.name}`);
      const params = new URL(result.url).searchParams;
      internalFields.forEach((field) => {
        expect(params.has(field)).toBe(false);
      });
    });
  });
});

// ─── Deep-link properties ─────────────────────────────────────────────────────

describe("handoff URL — deep-link properties", () => {
  const deepLinkProperties = PROPERTIES.filter((p) => p.bookingUrl.includes("/stay/"));

  test("deep-link properties exist in the DB", () => {
    expect(deepLinkProperties.length).toBeGreaterThan(0);
  });

  test("deep-link paths are preserved after UTM append", () => {
    deepLinkProperties.forEach((p) => {
      const result = buildViewStayUrl({ bookingUrl: p.bookingUrl, rank: 1, sessionId: SESSION });
      if (!result.ok) throw new Error(`URL failed for ${p.name}`);
      // The /stay/<id> segment must still be in the path, not mangled into params
      const url = new URL(result.url);
      expect(url.pathname).toContain("/stay/");
    });
  });

  test("deep-link URLs still carry UTM params", () => {
    deepLinkProperties.forEach((p) => {
      const result = buildViewStayUrl({ bookingUrl: p.bookingUrl, rank: 1, sessionId: SESSION });
      if (!result.ok) throw new Error(`URL failed for ${p.name}`);
      const params = new URL(result.url).searchParams;
      expect(params.get("utm_source")).toBe("zoco");
      expect(params.get("utm_medium")).toBe("recommendation");
    });
  });
});

// ─── Destination slug integrity ───────────────────────────────────────────────

describe("handoff URL — destination slug integrity", () => {
  test("every property has a non-empty destinationSlug", () => {
    const missing = PROPERTIES.filter((p) => !p.destinationSlug);
    expect(missing).toHaveLength(0);
  });

  test("bookingUrl path contains the destinationSlug for standard properties", () => {
    // Standard (non-deep-link) properties — the slug should appear in the URL path
    const standard = PROPERTIES.filter((p) => !p.bookingUrl.includes("/stay/"));
    standard.forEach((p) => {
      expect(p.bookingUrl).toContain(p.destinationSlug);
    });
  });
});
