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
