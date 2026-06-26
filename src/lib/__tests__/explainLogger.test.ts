import type { ExplainFailure, ExplainBatchSummary } from "@/lib/explainLogger";

// ─── env mock ─────────────────────────────────────────────────────────────────
// Each describe block sets the environment it wants to exercise.

const envState = { isLocal: true, isStaging: false, isProduction: false };

jest.mock("@/lib/env", () => ({
  get isLocal() { return envState.isLocal; },
  get isStaging() { return envState.isStaging; },
  get isProduction() { return envState.isProduction; },
}));

// Import after mock so module picks up the mocked env
import { logExplainFailure, logExplainBatch } from "@/lib/explainLogger";

function cleanEnv() {
  envState.isLocal = false;
  envState.isStaging = false;
  envState.isProduction = false;
}

const noFailures: ExplainBatchSummary = {
  total: 3, model: 3, fallback: 0, durationMs: 420, failures: [],
};

const withFailures: ExplainBatchSummary = {
  total: 3,
  model: 1,
  fallback: 2,
  durationMs: 520,
  failures: [
    { category: "validation", cardId: 7, detail: "too long" },
    { category: "missing_card", cardId: 8 },
  ],
};

// ─── logExplainFailure ────────────────────────────────────────────────────────

describe("logExplainFailure — local env", () => {
  beforeEach(() => { cleanEnv(); envState.isLocal = true; jest.clearAllMocks(); });

  it("emits a console.warn", () => {
    const spy = jest.spyOn(console, "warn").mockImplementation(() => {});
    logExplainFailure({ category: "api_error", detail: "503" });
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it("includes the failure category in the message", () => {
    const spy = jest.spyOn(console, "warn").mockImplementation(() => {});
    logExplainFailure({ category: "api_timeout" });
    expect(spy.mock.calls[0][0]).toMatch(/api_timeout/);
    spy.mockRestore();
  });

  it("includes the cardId when present", () => {
    const spy = jest.spyOn(console, "warn").mockImplementation(() => {});
    logExplainFailure({ category: "missing_card", cardId: 42 });
    expect(spy.mock.calls[0][0]).toMatch(/42/);
    spy.mockRestore();
  });

  it("says 'batch' when cardId is absent", () => {
    const spy = jest.spyOn(console, "warn").mockImplementation(() => {});
    logExplainFailure({ category: "json_parse" });
    expect(spy.mock.calls[0][0]).toMatch(/batch/);
    spy.mockRestore();
  });

  it("includes the detail string when present", () => {
    const spy = jest.spyOn(console, "warn").mockImplementation(() => {});
    logExplainFailure({ category: "validation", cardId: 5, detail: "too long (220 > 200)" });
    expect(spy.mock.calls[0][0]).toMatch(/too long/);
    spy.mockRestore();
  });
});

describe("logExplainFailure — production env", () => {
  beforeEach(() => { cleanEnv(); envState.isProduction = true; jest.clearAllMocks(); });

  it("does not emit in production", () => {
    const spy = jest.spyOn(console, "warn").mockImplementation(() => {});
    logExplainFailure({ category: "api_error", detail: "network" });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe("logExplainFailure — staging env", () => {
  beforeEach(() => { cleanEnv(); envState.isStaging = true; jest.clearAllMocks(); });

  it("emits in staging", () => {
    const spy = jest.spyOn(console, "warn").mockImplementation(() => {});
    logExplainFailure({ category: "validation", cardId: 3 });
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});

// ─── logExplainBatch ──────────────────────────────────────────────────────────

describe("logExplainBatch — local env", () => {
  beforeEach(() => { cleanEnv(); envState.isLocal = true; jest.clearAllMocks(); });

  it("emits a console.info on a clean run", () => {
    const spy = jest.spyOn(console, "info").mockImplementation(() => {});
    logExplainBatch(noFailures);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("includes model/fallback counts", () => {
    const spy = jest.spyOn(console, "info").mockImplementation(() => {});
    logExplainBatch({ ...noFailures, model: 2, fallback: 1 });
    const firstCall = spy.mock.calls[0][0] as string;
    expect(firstCall).toMatch(/2\/3/);
    expect(firstCall).toMatch(/1 fallback/);
    spy.mockRestore();
  });

  it("includes duration", () => {
    const spy = jest.spyOn(console, "info").mockImplementation(() => {});
    logExplainBatch({ ...noFailures, durationMs: 888 });
    expect(spy.mock.calls[0][0]).toMatch(/888ms/);
    spy.mockRestore();
  });

  it("logs failure breakdown when failures are present", () => {
    const spy = jest.spyOn(console, "info").mockImplementation(() => {});
    logExplainBatch(withFailures);
    // Second console.info call should be the breakdown object
    expect(spy).toHaveBeenCalledTimes(2);
    spy.mockRestore();
  });

  it("does not log a second breakdown call when there are no failures", () => {
    const spy = jest.spyOn(console, "info").mockImplementation(() => {});
    logExplainBatch(noFailures);
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});

describe("logExplainBatch — production env, clean run", () => {
  beforeEach(() => { cleanEnv(); envState.isProduction = true; jest.clearAllMocks(); });

  it("does not emit when all cards served by model", () => {
    const spy = jest.spyOn(console, "info").mockImplementation(() => {});
    logExplainBatch(noFailures);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("emits when there are fallbacks in production", () => {
    const spy = jest.spyOn(console, "info").mockImplementation(() => {});
    logExplainBatch(withFailures);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe("logExplainBatch — staging env", () => {
  beforeEach(() => { cleanEnv(); envState.isStaging = true; jest.clearAllMocks(); });

  it("emits even on a clean run in staging", () => {
    const spy = jest.spyOn(console, "info").mockImplementation(() => {});
    logExplainBatch(noFailures);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
