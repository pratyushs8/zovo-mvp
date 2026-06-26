/**
 * @jest-environment node
 */
// Tests for POST /api/track/booking-handoff-clicked.
//
// Verifies that the route:
//   - accepts valid payloads and delegates to trackEvent
//   - rejects malformed payloads with 400 before touching the DB
//   - returns { ok: true } on success
//   - never throws — bad JSON is handled safely

jest.mock("@/services/analytics", () => ({
  trackEvent: jest.fn().mockResolvedValue(undefined),
}));

import { POST } from "@/app/api/track/booking-handoff-clicked/route";
import { trackEvent } from "@/services/analytics";
import { NextRequest } from "next/server";

const mockTrackEvent = trackEvent as jest.Mock;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/track/booking-handoff-clicked", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const VALID_PAYLOAD = {
  properties: {
    propertyId: 1,
    bookingUrl: "https://www.zostel.com/destination/manali",
    rank: 1,
    destinationSlug: "manali",
    requestId: 42,
  },
  sessionId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
};

beforeEach(() => mockTrackEvent.mockClear());

// ─── Happy path ───────────────────────────────────────────────────────────────

describe("POST /api/track/booking-handoff-clicked — success", () => {
  test("returns 200 with { ok: true } for a valid payload", async () => {
    const res = await POST(makeRequest(VALID_PAYLOAD));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
  });

  test("calls trackEvent with correct event name", async () => {
    await POST(makeRequest(VALID_PAYLOAD));
    expect(mockTrackEvent).toHaveBeenCalledWith(
      "booking_handoff_clicked",
      expect.any(Object),
      expect.any(String)
    );
  });

  test("passes all attribution fields to trackEvent", async () => {
    await POST(makeRequest(VALID_PAYLOAD));
    const [, properties] = mockTrackEvent.mock.calls[0] as [string, Record<string, unknown>];
    expect(properties.propertyId).toBe(1);
    expect(properties.rank).toBe(1);
    expect(properties.destinationSlug).toBe("manali");
    expect(properties.requestId).toBe(42);
    expect(properties.bookingUrl).toBe("https://www.zostel.com/destination/manali");
  });

  test("passes sessionId to trackEvent", async () => {
    await POST(makeRequest(VALID_PAYLOAD));
    const [, , sessionId] = mockTrackEvent.mock.calls[0] as [string, unknown, string];
    expect(sessionId).toBe("a1b2c3d4-e5f6-7890-abcd-ef1234567890");
  });

  test("accepts optional explanationSource: model", async () => {
    const payload = {
      ...VALID_PAYLOAD,
      properties: { ...VALID_PAYLOAD.properties, explanationSource: "model" },
    };
    const res = await POST(makeRequest(payload));
    expect(res.status).toBe(200);
    const [, properties] = mockTrackEvent.mock.calls[0] as [string, Record<string, unknown>];
    expect(properties.explanationSource).toBe("model");
  });

  test("accepts optional explanationSource: fallback", async () => {
    const payload = {
      ...VALID_PAYLOAD,
      properties: { ...VALID_PAYLOAD.properties, explanationSource: "fallback" },
    };
    const res = await POST(makeRequest(payload));
    expect(res.status).toBe(200);
  });

  test("works without sessionId", async () => {
    const { sessionId: _, ...noSession } = VALID_PAYLOAD;
    const res = await POST(makeRequest(noSession));
    expect(res.status).toBe(200);
  });

  test("trackEvent is awaited — persistence happens before response", async () => {
    let resolved = false;
    mockTrackEvent.mockImplementationOnce(
      () =>
        new Promise<void>((r) =>
          setTimeout(() => {
            resolved = true;
            r();
          }, 0)
        )
    );
    const res = await POST(makeRequest(VALID_PAYLOAD));
    // If trackEvent is awaited, resolved must be true by the time we get a response
    expect(resolved).toBe(true);
    expect(res.status).toBe(200);
  });
});

// ─── Validation failures ──────────────────────────────────────────────────────

describe("POST /api/track/booking-handoff-clicked — validation", () => {
  test("returns 400 for missing properties", async () => {
    const res = await POST(makeRequest({ sessionId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890" }));
    expect(res.status).toBe(400);
    expect(mockTrackEvent).not.toHaveBeenCalled();
  });

  test("returns 400 for non-positive propertyId", async () => {
    const payload = {
      ...VALID_PAYLOAD,
      properties: { ...VALID_PAYLOAD.properties, propertyId: 0 },
    };
    const res = await POST(makeRequest(payload));
    expect(res.status).toBe(400);
    expect(mockTrackEvent).not.toHaveBeenCalled();
  });

  test("returns 400 for non-positive rank", async () => {
    const payload = { ...VALID_PAYLOAD, properties: { ...VALID_PAYLOAD.properties, rank: 0 } };
    const res = await POST(makeRequest(payload));
    expect(res.status).toBe(400);
  });

  test("returns 400 for invalid bookingUrl (not a URL)", async () => {
    const payload = {
      ...VALID_PAYLOAD,
      properties: { ...VALID_PAYLOAD.properties, bookingUrl: "not-a-url" },
    };
    const res = await POST(makeRequest(payload));
    expect(res.status).toBe(400);
  });

  test("returns 400 for invalid explanationSource value", async () => {
    const payload = {
      ...VALID_PAYLOAD,
      properties: { ...VALID_PAYLOAD.properties, explanationSource: "unknown" },
    };
    const res = await POST(makeRequest(payload));
    expect(res.status).toBe(400);
  });

  test("returns 400 for malformed sessionId (not UUID)", async () => {
    const res = await POST(makeRequest({ ...VALID_PAYLOAD, sessionId: "not-a-uuid" }));
    expect(res.status).toBe(400);
  });

  test("returns 400 for completely empty body", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  test("handles non-JSON body without throwing", async () => {
    const req = new NextRequest("http://localhost/api/track/booking-handoff-clicked", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "not json at all",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(mockTrackEvent).not.toHaveBeenCalled();
  });
});
