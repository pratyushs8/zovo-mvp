import { render, screen, act } from "@testing-library/react";
import type { RecommendationResponse } from "@/types/api";
import type { ExplainResponse } from "@/types/explain";

// ─── api mock — prevents real network calls from tests ───────────────────────

import type { ExplainRequest } from "@/types/explain";

const mockFetchExplanations = jest.fn<Promise<ExplainResponse>, [ExplainRequest]>();

jest.mock("@/lib/api", () => ({
  fetchExplanations: (req: ExplainRequest) => mockFetchExplanations(req),
  trackRecommendationsShown: jest.fn(),
}));

jest.mock("@/hooks/useAnalytics", () => ({
  useAnalytics: () => ({ trackRecommendationClicked: jest.fn() }),
}));

// ─── Next.js navigation mocks ─────────────────────────────────────────────────

const mockReplace = jest.fn();
const mockGet = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => ({ get: mockGet }),
}));

// ─── Component (imported after mocks) ────────────────────────────────────────

import ResultsContent from "@/app/results/ResultsContent";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const card = (overrides = {}) => ({
  id: 1,
  rank: 1,
  title: "Zostel Manali",
  destinationSlug: "manali",
  location: "Old Manali, Manali",
  summary: "A lively mountain stay.",
  priceInr: 650,
  reasons: [{ label: "Social vibe", strength: "strong" as const, direction: "up" as const }],
  lowConfidence: false,
  bookingUrl: "https://zostel.com/zostel/manali",
  ...overrides,
});

const meta = (overrides = {}) => ({
  confidence: "high" as const,
  fallback: null as null,
  bannerMessage: null,
  totalFiltered: 0,
  poolSize: 20,
  ...overrides,
});

const debugBlock = {
  userVector: {
    social: 0.9,
    calm: 0.1,
    scenic: 0.5,
    workation: 0.2,
    adventure: 0.6,
    budget_fit: 0.4,
    room_type_fit: 0.0,
  },
  rankingExplanation: {
    hardFilterTriggered: false,
    hardFilteredCount: 0,
    relaxedModeUsed: false,
    poolSize: 20,
    fallback: null,
    confidence: "high" as const,
    confidenceReason: "top_score_high" as const,
  },
  requestId: 1,
  cards: [],
};

function response(overrides: Partial<RecommendationResponse> = {}): RecommendationResponse {
  return {
    cards: [card()],
    meta: meta(),
    _debug: debugBlock,
    ...overrides,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function setSession(data: RecommendationResponse | null) {
  if (data) {
    sessionStorage.setItem("zoco_results", JSON.stringify(data));
  } else {
    sessionStorage.removeItem("zoco_results");
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  sessionStorage.clear();
  // Default: explanation fetch silently fails so existing tests are unaffected
  mockFetchExplanations.mockRejectedValue(new Error("not mocked"));
});

describe("ResultsContent — navigation guard", () => {
  test("redirects to / when no session data and no sessionId param", async () => {
    mockGet.mockReturnValue(null); // no ?s= param
    setSession(null);
    await act(async () => {
      render(<ResultsContent />);
    });
    expect(mockReplace).toHaveBeenCalledWith("/");
  });

  test("shows expired state when no session data but sessionId param present", async () => {
    mockGet.mockReturnValue("abc-123"); // ?s=abc-123
    setSession(null);
    await act(async () => {
      render(<ResultsContent />);
    });
    expect(screen.getByText(/results have expired/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /start a new search/i })).toBeInTheDocument();
  });
});

describe("ResultsContent — empty pool", () => {
  test("shows 'No matches found.' heading for empty card list", async () => {
    mockGet.mockReturnValue("abc");
    setSession(response({ cards: [], meta: meta({ fallback: "empty", totalFiltered: 0 }) }));
    await act(async () => {
      render(<ResultsContent />);
    });
    expect(screen.getByRole("heading", { name: /no matches found/i })).toBeInTheDocument();
  });

  test("empty state with filtered count explains workation filter", async () => {
    mockGet.mockReturnValue("abc");
    setSession(
      response({
        cards: [],
        meta: meta({ fallback: "empty", totalFiltered: 12, poolSize: 0 }),
      })
    );
    await act(async () => {
      render(<ResultsContent />);
    });
    expect(screen.getByText(/work-setup filter/i)).toBeInTheDocument();
    expect(screen.getByText(/12/)).toBeInTheDocument();
  });

  test("empty state without filtered count shows generic copy", async () => {
    mockGet.mockReturnValue("abc");
    setSession(
      response({ cards: [], meta: meta({ fallback: "empty", totalFiltered: 0, poolSize: 0 }) })
    );
    await act(async () => {
      render(<ResultsContent />);
    });
    expect(screen.getByText(/no properties matched/i)).toBeInTheDocument();
  });
});

describe("ResultsContent — fallback states", () => {
  test("thin_pool with 1 card shows 'A few options' heading", async () => {
    mockGet.mockReturnValue("abc");
    setSession(response({ cards: [card()], meta: meta({ fallback: "thin_pool" }) }));
    await act(async () => {
      render(<ResultsContent />);
    });
    expect(screen.getByRole("heading", { name: /a few options/i })).toBeInTheDocument();
  });

  test("weak_match banner message is shown above cards", async () => {
    mockGet.mockReturnValue("abc");
    setSession(
      response({
        cards: [card()],
        meta: meta({
          fallback: "weak_match",
          bannerMessage: "These are the closest matches we found — not a perfect fit.",
        }),
      })
    );
    await act(async () => {
      render(<ResultsContent />);
    });
    expect(screen.getByText(/closest matches we found/i)).toBeInTheDocument();
  });

  test("no banner when bannerMessage is null", async () => {
    mockGet.mockReturnValue("abc");
    setSession(response({ cards: [card()], meta: meta({ bannerMessage: null }) }));
    await act(async () => {
      render(<ResultsContent />);
    });
    // Banner text should not appear
    expect(screen.queryByText(/closest matches/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/fewer properties/i)).not.toBeInTheDocument();
  });
});

describe("ResultsContent — results render", () => {
  test("renders card title from session data", async () => {
    mockGet.mockReturnValue("abc");
    setSession(response());
    await act(async () => {
      render(<ResultsContent />);
    });
    expect(screen.getByText("Zostel Manali")).toBeInTheDocument();
  });

  test("renders 'Here are your Zostel stays.' heading for normal results", async () => {
    mockGet.mockReturnValue("abc");
    setSession(
      response({
        cards: [card(), card({ id: 2, rank: 2, title: "Zostel Kasol" })],
        meta: meta(),
      })
    );
    await act(async () => {
      render(<ResultsContent />);
    });
    expect(
      screen.getByRole("heading", { name: /here are your zostel stays/i })
    ).toBeInTheDocument();
  });

  test("Start over link is present", async () => {
    mockGet.mockReturnValue("abc");
    setSession(response());
    await act(async () => {
      render(<ResultsContent />);
    });
    expect(screen.getByRole("link", { name: /start over/i })).toBeInTheDocument();
  });
});

describe("ResultsContent — Day 9 explanation merge", () => {
  const explainResponse = (overrides: Partial<ExplainResponse> = {}): ExplainResponse => ({
    cards: [
      {
        id: 1,
        cardSummary: "A scenic and social stay that fits what you described.",
        sentences: {
          "Social vibe": "Lively communal vibe — well-suited to meeting fellow travelers.",
        },
        explanationSource: "model",
      },
    ],
    ...overrides,
  });

  test("replaces card summary with explanation cardSummary when fetch succeeds", async () => {
    mockFetchExplanations.mockResolvedValueOnce(explainResponse());
    mockGet.mockReturnValue("abc");
    setSession(response());
    await act(async () => {
      render(<ResultsContent />);
    });
    expect(
      screen.getByText("A scenic and social stay that fits what you described.")
    ).toBeInTheDocument();
    expect(screen.queryByText("A lively mountain stay.")).not.toBeInTheDocument();
  });

  test("chip sentence is not rendered (removed for MVP)", async () => {
    mockFetchExplanations.mockResolvedValueOnce(explainResponse());
    mockGet.mockReturnValue("abc");
    setSession(response());
    await act(async () => {
      render(<ResultsContent />);
    });
    expect(
      screen.queryByText("Lively communal vibe — well-suited to meeting fellow travelers.")
    ).not.toBeInTheDocument();
  });

  test("falls back to original summary when fetch rejects", async () => {
    mockFetchExplanations.mockRejectedValueOnce(new Error("timeout"));
    mockGet.mockReturnValue("abc");
    setSession(response());
    await act(async () => {
      render(<ResultsContent />);
    });
    // Original DB summary stays visible
    expect(screen.getByText("A lively mountain stay.")).toBeInTheDocument();
  });

  test("preserves original summary when explanation has no matching card id", async () => {
    mockFetchExplanations.mockResolvedValueOnce({
      cards: [
        {
          id: 999, // wrong id
          cardSummary: "Should not appear.",
          sentences: {},
          explanationSource: "fallback",
        },
      ],
    });
    mockGet.mockReturnValue("abc");
    setSession(response());
    await act(async () => {
      render(<ResultsContent />);
    });
    expect(screen.getByText("A lively mountain stay.")).toBeInTheDocument();
    expect(screen.queryByText("Should not appear.")).not.toBeInTheDocument();
  });

  test("chip metadata (label, arrow) is preserved after explanation merge", async () => {
    mockFetchExplanations.mockResolvedValueOnce(explainResponse());
    mockGet.mockReturnValue("abc");
    setSession(response());
    await act(async () => {
      render(<ResultsContent />);
    });
    // Chip direction/label from Day 8 must not be overwritten
    expect(screen.getByText(/↑\s*Social vibe/)).toBeInTheDocument();
  });

  test("does not call fetchExplanations when card list is empty", async () => {
    mockGet.mockReturnValue("abc");
    setSession(response({ cards: [], meta: meta({ fallback: "empty" }) }));
    await act(async () => {
      render(<ResultsContent />);
    });
    expect(mockFetchExplanations).not.toHaveBeenCalled();
  });
});
