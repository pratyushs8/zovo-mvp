import { render, screen } from "@testing-library/react";
import { RecommendationCard } from "@/components/results/RecommendationCard";
import type { StayCard } from "@/types/api";

const SESSION = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

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

// ─── Core rendering ───────────────────────────────────────────────────────────

describe("RecommendationCard", () => {
  test("renders rank, title, and location", () => {
    render(<RecommendationCard card={base} />);
    expect(screen.getByText(/#1/)).toBeInTheDocument();
    expect(screen.getByText("Zostel Manali")).toBeInTheDocument();
    expect(screen.getByText("Old Manali, Manali")).toBeInTheDocument();
  });

  test("renders property summary", () => {
    render(<RecommendationCard card={base} />);
    expect(screen.getByText("A lively social hub in the mountains.")).toBeInTheDocument();
  });

  test("renders up reason with ↑ arrow", () => {
    render(<RecommendationCard card={base} />);
    expect(screen.getByText(/↑\s*Social vibe/)).toBeInTheDocument();
  });

  test("renders down reason with ↓ arrow", () => {
    render(<RecommendationCard card={base} />);
    expect(screen.getByText(/↓\s*Workation/)).toBeInTheDocument();
  });

  test("renders with no reasons without crashing", () => {
    render(<RecommendationCard card={{ ...base, reasons: [] }} />);
    expect(screen.getByText("Zostel Manali")).toBeInTheDocument();
    expect(screen.queryByText(/↑/)).not.toBeInTheDocument();
  });
});

// ─── CTA — URL generation ─────────────────────────────────────────────────────

describe("RecommendationCard — CTA URL", () => {
  test("booking link includes UTM source and medium", () => {
    render(<RecommendationCard card={base} />);
    const link = screen.getByRole("link", { name: /View Stay/i });
    const href = link.getAttribute("href") ?? "";
    const url = new URL(href);
    expect(url.searchParams.get("utm_source")).toBe("zoco");
    expect(url.searchParams.get("utm_medium")).toBe("recommendation");
  });

  test("booking link includes utm_content with rank", () => {
    render(<RecommendationCard card={{ ...base, rank: 2 }} />);
    const link = screen.getByRole("link", { name: /View Stay/i });
    const href = link.getAttribute("href") ?? "";
    expect(new URL(href).searchParams.get("utm_content")).toBe("rank_2");
  });

  test("booking link includes utm_campaign when sessionId is provided", () => {
    render(<RecommendationCard card={base} sessionId={SESSION} />);
    const link = screen.getByRole("link", { name: /View Stay/i });
    const href = link.getAttribute("href") ?? "";
    expect(new URL(href).searchParams.get("utm_campaign")).toBe(SESSION);
  });

  test("booking link omits utm_campaign when sessionId is absent", () => {
    render(<RecommendationCard card={base} />);
    const link = screen.getByRole("link", { name: /View Stay/i });
    const href = link.getAttribute("href") ?? "";
    expect(new URL(href).searchParams.has("utm_campaign")).toBe(false);
  });

  test("booking link base path is preserved", () => {
    render(<RecommendationCard card={base} sessionId={SESSION} />);
    const link = screen.getByRole("link", { name: /View Stay/i });
    const href = link.getAttribute("href") ?? "";
    expect(href.startsWith("https://www.zostel.com/destination/manali")).toBe(true);
  });

  test("booking link opens in new tab with noopener", () => {
    render(<RecommendationCard card={base} />);
    const link = screen.getByRole("link", { name: /View Stay/i });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  test("deep-link URL is preserved with UTM params appended correctly", () => {
    const deepLink = {
      ...base,
      bookingUrl: "https://www.zostel.com/destination/mcleodganj/stay/zostel-mcleodganj-mclh045",
    };
    render(<RecommendationCard card={deepLink} sessionId={SESSION} />);
    const link = screen.getByRole("link", { name: /View Stay/i });
    const href = link.getAttribute("href") ?? "";
    expect(href.startsWith("https://www.zostel.com/destination/mcleodganj/stay/")).toBe(true);
    expect(new URL(href).searchParams.get("utm_source")).toBe("zoco");
  });

  test("CTA is hidden when bookingUrl is empty", () => {
    render(<RecommendationCard card={{ ...base, bookingUrl: "" }} />);
    expect(screen.queryByRole("link", { name: /View Stay/i })).not.toBeInTheDocument();
  });

  test("CTA is hidden when bookingUrl is not a zostel.com URL", () => {
    render(<RecommendationCard card={{ ...base, bookingUrl: "https://evil.com/kasol" }} />);
    expect(screen.queryByRole("link", { name: /View Stay/i })).not.toBeInTheDocument();
  });

  test("card still renders title and summary when CTA is hidden", () => {
    render(<RecommendationCard card={{ ...base, bookingUrl: "" }} />);
    expect(screen.getByText("Zostel Manali")).toBeInTheDocument();
    expect(screen.getByText("A lively social hub in the mountains.")).toBeInTheDocument();
  });
});

// ─── Day 9 explanation copy ───────────────────────────────────────────────────

describe("RecommendationCard — Day 9 explanation copy", () => {
  test("renders explanation summary when summary field is replaced", () => {
    const explained = {
      ...base,
      summary: "A scenic and peaceful stay in Manali that matches what you described.",
    };
    render(<RecommendationCard card={explained} />);
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
    render(<RecommendationCard card={withSentence} />);
    expect(
      screen.getByText("Lively communal vibe — great for meeting fellow travelers.")
    ).toBeInTheDocument();
  });

  test("chip renders no sentence element when sentence is absent", () => {
    render(<RecommendationCard card={base} />);
    expect(document.querySelector("[title]")).toBeNull();
  });

  test("shows lowConfidence badge when lowConfidence is true", () => {
    render(<RecommendationCard card={{ ...base, lowConfidence: true }} />);
    expect(screen.getByText(/limited info/i)).toBeInTheDocument();
  });

  test("does not show lowConfidence badge when lowConfidence is false", () => {
    render(<RecommendationCard card={base} />);
    expect(screen.queryByText(/limited info/i)).not.toBeInTheDocument();
  });

  test("lowConfidence card has a lighter border class", () => {
    const { container } = render(<RecommendationCard card={{ ...base, lowConfidence: true }} />);
    const article = container.querySelector("article");
    expect(article?.className).toContain("border-zinc-700");
  });

  test("normal confidence card has standard border class", () => {
    const { container } = render(<RecommendationCard card={base} />);
    const article = container.querySelector("article");
    expect(article?.className).toContain("border-zinc-800");
  });
});
