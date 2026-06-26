// Tests for the trackHandoffClick helper in api.ts.
//
// Verifies payload shape, keepalive flag, and fire-and-forget safety.
// Uses a fetch mock so no real network calls are made.

import { trackHandoffClick } from "@/lib/api";

const SESSION = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

const BASE_PROPERTIES = {
  propertyId: 1,
  bookingUrl: "https://www.zostel.com/destination/manali",
  rank: 1,
  destinationSlug: "manali",
  requestId: 42,
} as const;

// ─── fetch mock ───────────────────────────────────────────────────────────────

let fetchMock: jest.Mock;

beforeEach(() => {
  fetchMock = jest.fn().mockResolvedValue({ ok: true });
  global.fetch = fetchMock;
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ─── Payload shape ────────────────────────────────────────────────────────────

describe("trackHandoffClick — payload", () => {
  test("posts to the correct endpoint", async () => {
    trackHandoffClick(BASE_PROPERTIES, SESSION);
    await Promise.resolve(); // flush microtask
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/track/booking-handoff-clicked",
      expect.any(Object)
    );
  });

  test("uses POST method", async () => {
    trackHandoffClick(BASE_PROPERTIES, SESSION);
    await Promise.resolve();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("POST");
  });

  test("sends Content-Type: application/json", async () => {
    trackHandoffClick(BASE_PROPERTIES, SESSION);
    await Promise.resolve();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
  });

  test("serializes properties into the request body", async () => {
    trackHandoffClick(BASE_PROPERTIES, SESSION);
    await Promise.resolve();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.properties).toMatchObject(BASE_PROPERTIES);
  });

  test("includes sessionId in body when provided", async () => {
    trackHandoffClick(BASE_PROPERTIES, SESSION);
    await Promise.resolve();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.sessionId).toBe(SESSION);
  });

  test("omits sessionId from body when not provided", async () => {
    trackHandoffClick(BASE_PROPERTIES);
    await Promise.resolve();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body).not.toHaveProperty("sessionId");
  });

  test("omits sessionId from body when null", async () => {
    trackHandoffClick(BASE_PROPERTIES, null);
    await Promise.resolve();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body).not.toHaveProperty("sessionId");
  });

  test("includes explanationSource in properties when provided", async () => {
    trackHandoffClick({ ...BASE_PROPERTIES, explanationSource: "model" }, SESSION);
    await Promise.resolve();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.properties.explanationSource).toBe("model");
  });
});

// ─── Reliability flags ────────────────────────────────────────────────────────

describe("trackHandoffClick — reliability", () => {
  test("sets keepalive: true so the request survives tab close", async () => {
    trackHandoffClick(BASE_PROPERTIES, SESSION);
    await Promise.resolve();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.keepalive).toBe(true);
  });

  test("does not throw when fetch rejects", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network error"));
    expect(() => trackHandoffClick(BASE_PROPERTIES, SESSION)).not.toThrow();
  });

  test("does not return a promise — caller cannot await it", () => {
    const result = trackHandoffClick(BASE_PROPERTIES, SESSION);
    expect(result).toBeUndefined();
  });

  test("swallows fetch rejection silently — no unhandled rejection", async () => {
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    trackHandoffClick(BASE_PROPERTIES, SESSION);
    // Give the rejected promise a tick to settle — should not surface as unhandled
    await new Promise((r) => setTimeout(r, 0));
  });
});
