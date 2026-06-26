import { render, screen, fireEvent } from "@testing-library/react";
import { RecommendationCard } from "@/components/results/RecommendationCard";
import type { StayCard } from "@/types/api";

const SESSION = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const REQUEST_ID = 42;

// Mock trackHandoffClick so tests don't make real fetch calls
jest.mock("@/lib/api", () => ({
  ...jest.requireActual("@/lib/api"),
  trackHandoffClick: jest.fn(),
}));
import { trackHandoffClick } from "@/lib/api";
const mockTrack = trackHandoffClick as jest.Mock;

const base: StayCard = {
  id: 1,
  rank: 1,
  title: "Zostel Manali",
  destinationSlug: "manali",
  location: "Old Manali, Manali",
  summary: "A lively social hub in the mountains.",
  priceInr: 650,
  reasons: [
    { label: "Social vibe", strength: "strong", direction: "up" },
    { label: "Workation", strength: "weak", direction: "down" },
  ],
  lowConfidence: false,
  bookingUrl: "https://www.zostel.com/destination/manali",
};

beforeEach(() => mockTrack.mockClear());

// ─── Core rendering ───────────────────────────────────────────────────────────

describe("RecommendationCard", () => {
  test("renders rank, title, and location", () => {
    render(<RecommendationCard card={base} requestId={REQUEST_ID} />);
    expect(screen.getByText(/#1/)).toBeInTheDocument();
    expect(screen.getByText("Zostel Manali")).toBeInTheDocument();
    expect(screen.getByText("Old Manali, Manali")).toBeInTheDocument();
  });

  test("renders property summary", () => {
    render(<RecommendationCard card={base} requestId={REQUEST_ID} />);
    expect(screen.getByText("A lively social hub in the mountains.")).toBeInTheDocument();
  });

  test("renders up reason with ↑ arrow", () => {
    render(<RecommendationCard card={base} requestId={REQUEST_ID} />);
    expect(screen.getByText(/↑\s*Social vibe/)).toBeInTheDocument();
  });

  test("renders down reason with ↓ arrow", () => {
    render(<RecommendationCard card={base} requestId={REQUEST_ID} />);
    expect(screen.getByText(/↓\s*Workation/)).toBeInTheDocument();
  });

  test("renders with no reasons without crashing", () => {
    render(<RecommendationCard card={{ ...base, reasons: [] }} requestId={REQUEST_ID} />);
    expect(screen.getByText("Zostel Manali")).toBeInTheDocument();
    expect(screen.queryByText(/↑/)).not.toBeInTheDocument();
  });
});

// ─── CTA — URL generation ─────────────────────────────────────────────────────

describe("RecommendationCard — CTA URL", () => {
  test("booking link includes UTM source and medium", () => {
    render(<RecommendationCard card={base} requestId={REQUEST_ID} />);
    const link = screen.getByRole("link", { name: /View Stay/i });
    const url = new URL(link.getAttribute("href") ?? "");
    expect(url.searchParams.get("utm_source")).toBe("zoco");
    expect(url.searchParams.get("utm_medium")).toBe("recommendation");
  });

  test("booking link includes utm_content with rank", () => {
    render(<RecommendationCard card={{ ...base, rank: 2 }} requestId={REQUEST_ID} />);
    const link = screen.getByRole("link", { name: /View Stay/i });
    expect(new URL(link.getAttribute("href") ?? "").searchParams.get("utm_content")).toBe("rank_2");
  });

  test("booking link includes utm_campaign when sessionId is provided", () => {
    render(<RecommendationCard card={base} requestId={REQUEST_ID} sessionId={SESSION} />);
    const link = screen.getByRole("link", { name: /View Stay/i });
    expect(new URL(link.getAttribute("href") ?? "").searchParams.get("utm_campaign")).toBe(SESSION);
  });

  test("booking link omits utm_campaign when sessionId is absent", () => {
    render(<RecommendationCard card={base} requestId={REQUEST_ID} />);
    const link = screen.getByRole("link", { name: /View Stay/i });
    expect(new URL(link.getAttribute("href") ?? "").searchParams.has("utm_campaign")).toBe(false);
  });

  test("booking link base path is preserved", () => {
    render(<RecommendationCard card={base} requestId={REQUEST_ID} sessionId={SESSION} />);
    const link = screen.getByRole("link", { name: /View Stay/i });
    expect(link.getAttribute("href")!.startsWith("https://www.zostel.com/destination/manali")).toBe(
      true
    );
  });

  test("booking link opens in new tab with noopener", () => {
    render(<RecommendationCard card={base} requestId={REQUEST_ID} />);
    const link = screen.getByRole("link", { name: /View Stay/i });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  test("deep-link URL is preserved with UTM params appended correctly", () => {
    const deepLink = {
      ...base,
      bookingUrl: "https://www.zostel.com/destination/mcleodganj/stay/zostel-mcleodganj-mclh045",
    };
    render(<RecommendationCard card={deepLink} requestId={REQUEST_ID} sessionId={SESSION} />);
    const link = screen.getByRole("link", { name: /View Stay/i });
    const href = link.getAttribute("href") ?? "";
    expect(href.startsWith("https://www.zostel.com/destination/mcleodganj/stay/")).toBe(true);
    expect(new URL(href).searchParams.get("utm_source")).toBe("zoco");
  });

  test("CTA is hidden when bookingUrl is empty", () => {
    render(<RecommendationCard card={{ ...base, bookingUrl: "" }} requestId={REQUEST_ID} />);
    expect(screen.queryByRole("link", { name: /View Stay/i })).not.toBeInTheDocument();
  });

  test("CTA is hidden when bookingUrl is not a zostel.com URL", () => {
    render(
      <RecommendationCard
        card={{ ...base, bookingUrl: "https://evil.com/kasol" }}
        requestId={REQUEST_ID}
      />
    );
    expect(screen.queryByRole("link", { name: /View Stay/i })).not.toBeInTheDocument();
  });

  test("card still renders title and summary when CTA is hidden", () => {
    render(<RecommendationCard card={{ ...base, bookingUrl: "" }} requestId={REQUEST_ID} />);
    expect(screen.getByText("Zostel Manali")).toBeInTheDocument();
    expect(screen.getByText("A lively social hub in the mountains.")).toBeInTheDocument();
  });
});

// ─── CTA — click tracking ─────────────────────────────────────────────────────

describe("RecommendationCard — CTA click tracking", () => {
  test("calls trackHandoffClick on CTA click", () => {
    render(<RecommendationCard card={base} requestId={REQUEST_ID} sessionId={SESSION} />);
    fireEvent.click(screen.getByRole("link", { name: /View Stay/i }));
    expect(mockTrack).toHaveBeenCalledTimes(1);
  });

  test("passes propertyId, rank, destinationSlug, requestId, and bookingUrl", () => {
    render(<RecommendationCard card={base} requestId={REQUEST_ID} sessionId={SESSION} />);
    fireEvent.click(screen.getByRole("link", { name: /View Stay/i }));
    const [properties, sid] = mockTrack.mock.calls[0] as [Record<string, unknown>, string];
    expect(properties.propertyId).toBe(1);
    expect(properties.rank).toBe(1);
    expect(properties.destinationSlug).toBe("manali");
    expect(properties.requestId).toBe(REQUEST_ID);
    expect(properties.bookingUrl).toBe("https://www.zostel.com/destination/manali");
    expect(sid).toBe(SESSION);
  });

  test("passes explanationSource when provided", () => {
    render(
      <RecommendationCard
        card={base}
        requestId={REQUEST_ID}
        sessionId={SESSION}
        explanationSource="model"
      />
    );
    fireEvent.click(screen.getByRole("link", { name: /View Stay/i }));
    const [properties] = mockTrack.mock.calls[0] as [Record<string, unknown>];
    expect(properties.explanationSource).toBe("model");
  });

  test("omits explanationSource when not provided", () => {
    render(<RecommendationCard card={base} requestId={REQUEST_ID} sessionId={SESSION} />);
    fireEvent.click(screen.getByRole("link", { name: /View Stay/i }));
    const [properties] = mockTrack.mock.calls[0] as [Record<string, unknown>];
    expect(properties).not.toHaveProperty("explanationSource");
  });

  test("passes sessionId to trackHandoffClick", () => {
    render(<RecommendationCard card={base} requestId={REQUEST_ID} sessionId={SESSION} />);
    fireEvent.click(screen.getByRole("link", { name: /View Stay/i }));
    const [, sid] = mockTrack.mock.calls[0] as [unknown, string];
    expect(sid).toBe(SESSION);
  });

  test("does not fire tracking when CTA is not rendered", () => {
    render(<RecommendationCard card={{ ...base, bookingUrl: "" }} requestId={REQUEST_ID} />);
    expect(screen.queryByRole("link", { name: /View Stay/i })).not.toBeInTheDocument();
    expect(mockTrack).not.toHaveBeenCalled();
  });
});

// ─── Day 9 explanation copy ───────────────────────────────────────────────────

describe("RecommendationCard — Day 9 explanation copy", () => {
  test("renders explanation summary when summary field is replaced", () => {
    const explained = {
      ...base,
      summary: "A scenic and peaceful stay in Manali that matches what you described.",
    };
    render(<RecommendationCard card={explained} requestId={REQUEST_ID} />);
    expect(
      screen.getByText("A scenic and peaceful stay in Manali that matches what you described.")
    ).toBeInTheDocument();
  });

  test("chip sentence is rendered as visible text when present", () => {
    const withSentence = {
      ...base,
      reasons: [
        {
          label: "Social vibe",
          strength: "strong" as const,
          direction: "up" as const,
          sentence: "Lively communal vibe — great for meeting fellow travelers.",
        },
      ],
    };
    render(<RecommendationCard card={withSentence} requestId={REQUEST_ID} />);
    expect(
      screen.getByText("Lively communal vibe — great for meeting fellow travelers.")
    ).toBeInTheDocument();
  });

  test("chip renders no sentence element when sentence is absent", () => {
    render(<RecommendationCard card={base} requestId={REQUEST_ID} />);
    expect(document.querySelector("[title]")).toBeNull();
  });

  test("shows lowConfidence badge when lowConfidence is true", () => {
    render(<RecommendationCard card={{ ...base, lowConfidence: true }} requestId={REQUEST_ID} />);
    expect(screen.getByText(/limited info/i)).toBeInTheDocument();
  });

  test("does not show lowConfidence badge when lowConfidence is false", () => {
    render(<RecommendationCard card={base} requestId={REQUEST_ID} />);
    expect(screen.queryByText(/limited info/i)).not.toBeInTheDocument();
  });

  test("lowConfidence card has a lighter border class", () => {
    const { container } = render(
      <RecommendationCard card={{ ...base, lowConfidence: true }} requestId={REQUEST_ID} />
    );
    expect(container.querySelector("article")?.className).toContain("border-zinc-700");
  });

  test("normal confidence card has standard border class", () => {
    const { container } = render(<RecommendationCard card={base} requestId={REQUEST_ID} />);
    expect(container.querySelector("article")?.className).toContain("border-zinc-800");
  });
});
