import { render, screen } from "@testing-library/react";
import { RecommendationCard } from "@/components/results/RecommendationCard";
import type { StayCard } from "@/types/api";

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
  bookingUrl: "https://zostel.com/zostel/manali",
};

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

  test("booking link points to bookingUrl", () => {
    render(<RecommendationCard card={base} />);
    const link = screen.getByRole("link", { name: /View on Zostel/i });
    expect(link).toHaveAttribute("href", base.bookingUrl);
  });

  test("booking link opens in new tab", () => {
    render(<RecommendationCard card={base} />);
    const link = screen.getByRole("link", { name: /View on Zostel/i });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  test("renders with no reasons without crashing", () => {
    render(<RecommendationCard card={{ ...base, reasons: [] }} />);
    expect(screen.getByText("Zostel Manali")).toBeInTheDocument();
    // reason row should not be present
    expect(screen.queryByText(/↑/)).not.toBeInTheDocument();
  });
});

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

  test("chip shows title tooltip when sentence is present", () => {
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
    // Sentence is now rendered as visible text, not a tooltip
    expect(
      screen.getByText("Lively communal vibe — great for meeting fellow travelers.")
    ).toBeInTheDocument();
  });

  test("sentence text is visually present beneath the chip label", () => {
    const withSentence = {
      ...base,
      reasons: [
        {
          label: "Social vibe",
          strength: "strong" as const,
          direction: "up" as const,
          sentence: "Lively vibe.",
        },
      ],
    };
    render(<RecommendationCard card={withSentence} />);
    expect(screen.getByText("Lively vibe.")).toBeInTheDocument();
  });

  test("chip renders no sentence element when sentence is absent", () => {
    render(<RecommendationCard card={base} />);
    // No title attribute and no hidden sentence spans
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
