import { buildViewStayUrl } from "@/lib/buildViewStayUrl";

const BASE = "https://www.zostel.com/destination/kasol";
const DEEP = "https://www.zostel.com/destination/mcleodganj/stay/zostel-mcleodganj-mclh045";
const SESSION = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

// ─── Happy path ───────────────────────────────────────────────────────────────

describe("buildViewStayUrl — happy path", () => {
  it("returns ok:true for a valid destination-page URL", () => {
    const result = buildViewStayUrl({ bookingUrl: BASE, rank: 1 });
    expect(result.ok).toBe(true);
  });

  it("returns ok:true for a deep-link /stay/ URL", () => {
    const result = buildViewStayUrl({ bookingUrl: DEEP, rank: 2 });
    expect(result.ok).toBe(true);
  });

  it("appends all four UTM params when sessionId is present", () => {
    const result = buildViewStayUrl({ bookingUrl: BASE, rank: 1, sessionId: SESSION });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const url = new URL(result.url);
    expect(url.searchParams.get("utm_source")).toBe("zoco");
    expect(url.searchParams.get("utm_medium")).toBe("recommendation");
    expect(url.searchParams.get("utm_content")).toBe("rank_1");
    expect(url.searchParams.get("utm_campaign")).toBe(SESSION);
  });

  it("omits utm_campaign when sessionId is absent", () => {
    const result = buildViewStayUrl({ bookingUrl: BASE, rank: 1 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const url = new URL(result.url);
    expect(url.searchParams.has("utm_campaign")).toBe(false);
    expect(url.searchParams.get("utm_source")).toBe("zoco");
  });

  it("omits utm_campaign when sessionId is null", () => {
    const result = buildViewStayUrl({ bookingUrl: BASE, rank: 1, sessionId: null });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const url = new URL(result.url);
    expect(url.searchParams.has("utm_campaign")).toBe(false);
  });

  it("encodes utm_content with correct rank", () => {
    const result = buildViewStayUrl({ bookingUrl: BASE, rank: 3, sessionId: SESSION });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(new URL(result.url).searchParams.get("utm_content")).toBe("rank_3");
  });

  it("uses ? separator when baseUrl has no existing query string", () => {
    const result = buildViewStayUrl({ bookingUrl: BASE, rank: 1 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.url).toMatch(/^https:\/\/www\.zostel\.com\/destination\/kasol\?/);
  });

  it("uses & separator when baseUrl already contains a query string", () => {
    const withQuery = `${BASE}?foo=bar`;
    const result = buildViewStayUrl({ bookingUrl: withQuery, rank: 1 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.url).toMatch(/foo=bar&/);
    expect(result.url).not.toMatch(/foo=bar\?/);
  });

  it("preserves the full base path of a deep-link URL", () => {
    const result = buildViewStayUrl({ bookingUrl: DEEP, rank: 1 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.url.startsWith(DEEP)).toBe(true);
  });

  it("does not include propertyId, requestId, or score in the URL", () => {
    const result = buildViewStayUrl({ bookingUrl: BASE, rank: 1, sessionId: SESSION });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.url).not.toMatch(/propertyId|requestId|score/);
  });
});

// ─── Validation failures ──────────────────────────────────────────────────────

describe("buildViewStayUrl — validation failures", () => {
  it("returns ok:false for an empty bookingUrl", () => {
    const result = buildViewStayUrl({ bookingUrl: "", rank: 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/missing/);
  });

  it("returns ok:false for a non-zostel.com URL", () => {
    const result = buildViewStayUrl({
      bookingUrl: "https://evil.com/destination/kasol",
      rank: 1,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/zostel\.com/);
  });

  it("returns ok:false for a zostel.com URL missing the trailing path slash", () => {
    const result = buildViewStayUrl({
      bookingUrl: "https://www.zostel.com",
      rank: 1,
    });
    expect(result.ok).toBe(false);
  });

  it("returns ok:false for rank 0", () => {
    const result = buildViewStayUrl({ bookingUrl: BASE, rank: 0 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/rank/);
  });

  it("returns ok:false for a negative rank", () => {
    const result = buildViewStayUrl({ bookingUrl: BASE, rank: -1 });
    expect(result.ok).toBe(false);
  });

  it("returns ok:false for a fractional rank", () => {
    const result = buildViewStayUrl({ bookingUrl: BASE, rank: 1.5 });
    expect(result.ok).toBe(false);
  });

  it("returns ok:false for an http (non-https) URL", () => {
    const result = buildViewStayUrl({
      bookingUrl: "http://www.zostel.com/destination/kasol",
      rank: 1,
    });
    expect(result.ok).toBe(false);
  });
});
