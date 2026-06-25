import { friendlyError } from "@/lib/friendlyError";

describe("friendlyError", () => {
  test("internal_error → server copy", () => {
    expect(friendlyError("internal_error")).toMatch(/backpack/i);
  });

  test("validation_failed → answers copy", () => {
    expect(friendlyError("validation_failed")).toMatch(/yak/i);
  });

  test("HTTP 5xx → server hiccup copy", () => {
    expect(friendlyError("HTTP 500")).toMatch(/mountains will wait/i);
    expect(friendlyError("HTTP 503")).toMatch(/mountains will wait/i);
  });

  test("HTTP 4xx → session lost copy", () => {
    expect(friendlyError("HTTP 401")).toMatch(/trail/i);
    expect(friendlyError("HTTP 404")).toMatch(/trail/i);
  });

  test("Failed to fetch → off-grid copy", () => {
    expect(friendlyError("Failed to fetch")).toMatch(/off-grid/i);
  });

  test("NetworkError → off-grid copy", () => {
    expect(friendlyError("NetworkError: connection refused")).toMatch(/off-grid/i);
  });

  test("unknown error → catch-all copy, no raw string exposed", () => {
    const raw = "some_internal_token_xyz";
    const result = friendlyError(raw);
    expect(result).not.toContain(raw);
    expect(result).toMatch(/hostel gods/i);
  });
});
