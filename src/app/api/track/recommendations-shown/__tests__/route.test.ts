/**
 * @jest-environment node
 */
jest.mock("@/services/analytics", () => ({
  trackEvent: jest.fn().mockResolvedValue(undefined),
}));

import { POST } from "@/app/api/track/recommendations-shown/route";
import { trackEvent } from "@/services/analytics";
import { NextRequest } from "next/server";

const mockTrackEvent = trackEvent as jest.Mock;

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/track/recommendations-shown", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const VALID_PAYLOAD = {
  properties: { requestId: 42, propertyIds: [1, 2, 3], count: 3 },
  sessionId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
};

beforeEach(() => mockTrackEvent.mockClear());

describe("POST /api/track/recommendations-shown — success", () => {
  test("returns 200 with { ok: true }", async () => {
    const res = await POST(makeRequest(VALID_PAYLOAD));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  test("calls trackEvent with recommendations_shown", async () => {
    await POST(makeRequest(VALID_PAYLOAD));
    expect(mockTrackEvent).toHaveBeenCalledWith(
      "recommendations_shown",
      expect.objectContaining({ requestId: 42, count: 3 }),
      "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
    );
  });

  test("works without sessionId", async () => {
    const { sessionId: _, ...noSession } = VALID_PAYLOAD;
    const res = await POST(makeRequest(noSession));
    expect(res.status).toBe(200);
  });

  test("accepts count of 0 (empty results)", async () => {
    const payload = { properties: { requestId: 1, propertyIds: [], count: 0 } };
    const res = await POST(makeRequest(payload));
    expect(res.status).toBe(200);
  });

  test("trackEvent is awaited before responding", async () => {
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
    await POST(makeRequest(VALID_PAYLOAD));
    expect(resolved).toBe(true);
  });
});

describe("POST /api/track/recommendations-shown — validation", () => {
  test("returns 400 for missing properties", async () => {
    const res = await POST(makeRequest({ sessionId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890" }));
    expect(res.status).toBe(400);
    expect(mockTrackEvent).not.toHaveBeenCalled();
  });

  test("returns 400 for non-positive requestId", async () => {
    const res = await POST(
      makeRequest({ properties: { requestId: 0, propertyIds: [], count: 0 } })
    );
    expect(res.status).toBe(400);
  });

  test("returns 400 for malformed sessionId", async () => {
    const res = await POST(makeRequest({ ...VALID_PAYLOAD, sessionId: "not-a-uuid" }));
    expect(res.status).toBe(400);
  });

  test("handles non-JSON body without throwing", async () => {
    const req = new NextRequest("http://localhost/api/track/recommendations-shown", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "not json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(mockTrackEvent).not.toHaveBeenCalled();
  });
});
