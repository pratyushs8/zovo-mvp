import { sanitize, validateText, sanitizeAndValidate } from "@/lib/validateExplanationText";

const OK_OPTS = { maxLength: 200, lowConfidence: false };
const LOW_OPTS = { maxLength: 200, lowConfidence: true };

// ─── sanitize ─────────────────────────────────────────────────────────────────

describe("sanitize", () => {
  it("strips markdown bold", () => {
    expect(sanitize("A **great** stay.")).toBe("A great stay.");
  });

  it("strips markdown italic", () => {
    expect(sanitize("A *scenic* location.")).toBe("A scenic location.");
  });

  it("strips inline code", () => {
    expect(sanitize("Has `reliable` wifi.")).toBe("Has reliable wifi.");
  });

  it("strips fenced code blocks", () => {
    expect(sanitize("```json\n{}\n```")).toBe("{}");
  });

  it("strips markdown links", () => {
    expect(sanitize("See [Zostel](https://zostel.com) for details.")).toBe(
      "See Zostel for details."
    );
  });

  it("strips heading markers", () => {
    expect(sanitize("## Summary\nGreat stay.")).toBe("Summary Great stay.");
  });

  it("strips blockquote markers", () => {
    expect(sanitize("> A calm property.")).toBe("A calm property.");
  });

  it("strips horizontal rules", () => {
    expect(sanitize("Before\n---\nAfter")).toBe("Before After");
  });

  it("strips HTML tags", () => {
    expect(sanitize("A <strong>scenic</strong> stay.")).toBe("A scenic stay.");
  });

  it("decodes common HTML entities", () => {
    expect(sanitize("Good &amp; calm.")).toBe("Good & calm.");
    expect(sanitize("Score &gt; 0.8.")).toBe("Score > 0.8.");
  });

  it("normalises curly quotes to straight", () => {
    expect(sanitize("“Great” choice.")).toBe('"Great" choice.');
    expect(sanitize("It’s calm.")).toBe("It's calm.");
  });

  it("collapses internal whitespace", () => {
    expect(sanitize("A   very    scenic\n\nplace.")).toBe("A very scenic place.");
  });

  it("trims leading and trailing whitespace", () => {
    expect(sanitize("  Hello world.  ")).toBe("Hello world.");
  });

  it("leaves plain text untouched", () => {
    const plain = "Good scenery for the trip you described.";
    expect(sanitize(plain)).toBe(plain);
  });
});

// ─── validateText — length ────────────────────────────────────────────────────

describe("validateText — length", () => {
  it("accepts text within the limit", () => {
    const result = validateText("Short sentence.", { maxLength: 200, lowConfidence: false });
    expect(result.ok).toBe(true);
  });

  it("rejects text that exceeds maxLength", () => {
    const long = "A".repeat(201);
    const result = validateText(long, { maxLength: 200, lowConfidence: false });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/too long/);
  });

  it("accepts text exactly at the limit", () => {
    const exact = "A".repeat(200);
    expect(validateText(exact, OK_OPTS).ok).toBe(true);
  });

  it("rejects empty string", () => {
    const result = validateText("", OK_OPTS);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/empty/);
  });

  it("rejects whitespace-only string", () => {
    const result = validateText("   ", OK_OPTS);
    expect(result.ok).toBe(false);
  });
});

// ─── validateText — unsupported facts ────────────────────────────────────────

describe("validateText — unsupported facts", () => {
  // Price
  it("rejects rupee symbol with digits", () => {
    expect(validateText("Costs ₹1500 per night.", OK_OPTS).ok).toBe(false);
  });

  it("rejects INR price figure", () => {
    expect(validateText("Priced at 2000 INR.", OK_OPTS).ok).toBe(false);
  });

  it("rejects 'priced at'", () => {
    expect(validateText("The hostel is priced at a good rate.", OK_OPTS).ok).toBe(false);
  });

  it("rejects per-night price", () => {
    expect(validateText("From 800 per night.", OK_OPTS).ok).toBe(false);
  });

  // Availability
  it("rejects 'sold out'", () => {
    expect(validateText("Often sold out during peak season.", OK_OPTS).ok).toBe(false);
  });

  it("rejects 'fully booked'", () => {
    expect(validateText("Gets fully booked on weekends.", OK_OPTS).ok).toBe(false);
  });

  it("rejects booking urgency", () => {
    expect(validateText("Book now to secure your spot.", OK_OPTS).ok).toBe(false);
  });

  it("rejects 'fills up fast'", () => {
    expect(validateText("Fills up fast in season.", OK_OPTS).ok).toBe(false);
  });

  // Ratings
  it("rejects numeric rating", () => {
    expect(validateText("Rated 4.5 out of 5.", OK_OPTS).ok).toBe(false);
  });

  it("rejects star rating", () => {
    expect(validateText("Scores 4.5/5 from guests.", OK_OPTS).ok).toBe(false);
  });

  it("rejects review count", () => {
    expect(validateText("Over 300 reviews on the platform.", OK_OPTS).ok).toBe(false);
  });

  it("rejects 'highly rated'", () => {
    expect(validateText("A highly rated property.", OK_OPTS).ok).toBe(false);
  });

  it("rejects 'great reviews'", () => {
    expect(validateText("Has great reviews from solo travelers.", OK_OPTS).ok).toBe(false);
  });

  // Popularity
  it("rejects 'popular'", () => {
    expect(validateText("A popular hostel on the circuit.", OK_OPTS).ok).toBe(false);
  });

  it("rejects 'well-known'", () => {
    expect(validateText("A well-known name among backpackers.", OK_OPTS).ok).toBe(false);
  });

  it("rejects 'trending'", () => {
    expect(validateText("Trending destination for solo travel.", OK_OPTS).ok).toBe(false);
  });

  // Should PASS — budget language without price specifics
  it("allows general budget-fit language", () => {
    expect(validateText("Fits comfortably within the budget you described.", OK_OPTS).ok).toBe(
      true
    );
  });

  it("allows 'priced' without 'at'", () => {
    expect(validateText("Priced in line with what you described.", OK_OPTS).ok).toBe(true);
  });
});

// ─── validateText — overconfidence (lowConfidence gate) ──────────────────────

describe("validateText — overconfidence", () => {
  it("rejects 'perfect' when lowConfidence", () => {
    expect(validateText("The perfect stay for your trip.", LOW_OPTS).ok).toBe(false);
  });

  it("rejects 'ideal' when lowConfidence", () => {
    expect(validateText("An ideal base for exploring.", LOW_OPTS).ok).toBe(false);
  });

  it("rejects certainty adverbs when lowConfidence", () => {
    expect(validateText("Definitely suits your preference.", LOW_OPTS).ok).toBe(false);
    expect(validateText("Certainly a good fit.", LOW_OPTS).ok).toBe(false);
    expect(validateText("Absolutely the right pick.", LOW_OPTS).ok).toBe(false);
  });

  it("rejects future-tense certainty when lowConfidence", () => {
    expect(validateText("Will suit your calm preference.", LOW_OPTS).ok).toBe(false);
    expect(validateText("Will match what you described.", LOW_OPTS).ok).toBe(false);
  });

  it("rejects exact-match claims when lowConfidence", () => {
    expect(validateText("Exactly what you're looking for.", LOW_OPTS).ok).toBe(false);
    expect(validateText("Exactly matches your preference.", LOW_OPTS).ok).toBe(false);
  });

  // 'perfect' and 'guaranteed' are blocked on ALL cards now (always-overconfident)
  it("rejects 'perfect' even when lowConfidence is false", () => {
    expect(validateText("The perfect stay for your trip.", OK_OPTS).ok).toBe(false);
  });

  it("rejects 'guaranteed' even when lowConfidence is false", () => {
    expect(validateText("Guaranteed to suit your preference.", OK_OPTS).ok).toBe(false);
  });

  // Phrases gated on lowConfidence still pass on confident cards
  it("allows 'will suit' when lowConfidence is false", () => {
    expect(validateText("Will suit your calm preference.", OK_OPTS).ok).toBe(true);
  });

  it("allows 'definitely' when lowConfidence is false", () => {
    expect(validateText("Definitely suits your preference.", OK_OPTS).ok).toBe(true);
  });

  // Hedged language must always pass
  it("accepts 'may suit' when lowConfidence", () => {
    expect(validateText("May suit your scenic preference.", LOW_OPTS).ok).toBe(true);
  });

  it("accepts 'could work' when lowConfidence", () => {
    expect(validateText("Could work well for your trip.", LOW_OPTS).ok).toBe(true);
  });

  it("accepts 'tends toward' when lowConfidence", () => {
    expect(validateText("Tends toward the quieter end.", LOW_OPTS).ok).toBe(true);
  });

  it("accepts 'possibly' when lowConfidence", () => {
    expect(validateText("A possibly scenic option in Bir.", LOW_OPTS).ok).toBe(true);
  });
});

// ─── validateText — always-blocked overconfidence ────────────────────────────

describe("validateText — always-blocked overconfidence", () => {
  it("rejects 'perfect' regardless of lowConfidence", () => {
    expect(validateText("A perfect base for your trip.", OK_OPTS).ok).toBe(false);
    expect(validateText("A perfect base for your trip.", LOW_OPTS).ok).toBe(false);
  });

  it("rejects 'perfectly' regardless of lowConfidence", () => {
    expect(validateText("Perfectly suited to your needs.", OK_OPTS).ok).toBe(false);
  });

  it("rejects 'guaranteed' regardless of lowConfidence", () => {
    expect(validateText("Guaranteed to suit your trip.", OK_OPTS).ok).toBe(false);
  });

  it("rejects 'better than most' comparative claim", () => {
    expect(validateText("Better than most hostels on this route.", OK_OPTS).ok).toBe(false);
  });

  it("rejects 'stands out' comparative claim", () => {
    expect(validateText("Stands out for its scenic setting.", OK_OPTS).ok).toBe(false);
  });

  it("rejects 'your top match' claim", () => {
    expect(validateText("This is your top match for the trip.", OK_OPTS).ok).toBe(false);
  });

  it("rejects 'one of the quieter' comparative claim", () => {
    expect(validateText("One of the quieter options in the area.", OK_OPTS).ok).toBe(false);
  });

  it("allows plain positive language that isn't comparative or absolute", () => {
    expect(validateText("A good match for a quiet trip.", OK_OPTS).ok).toBe(true);
    expect(validateText("Suits the kind of trip you described.", OK_OPTS).ok).toBe(true);
  });
});

// ─── sanitizeAndValidate ──────────────────────────────────────────────────────

describe("sanitizeAndValidate", () => {
  it("returns sanitized text on success", () => {
    const result = sanitizeAndValidate("A **scenic** stay in Manali.", OK_OPTS);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.text).toBe("A scenic stay in Manali.");
  });

  it("strips markdown before checking length — stripped text may pass", () => {
    // plain = 200 chars; wrapping in ** adds 4, making raw = 204 > maxLength(200)
    const plain = "A ".repeat(99) + "B."; // exactly 200 chars
    const withMarkdown = `**${plain}**`; // 204 chars — exceeds maxLength raw
    expect(withMarkdown.length).toBeGreaterThan(200);
    const result = sanitizeAndValidate(withMarkdown, OK_OPTS);
    // After stripping ** the text is 200 chars — exactly at the limit, should pass
    expect(result.ok).toBe(true);
  });

  it("fails with reason when validation fails", () => {
    const result = sanitizeAndValidate("₹2000 per night.", OK_OPTS);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("price figure");
  });

  it("strips markdown then catches overconfidence in lowConfidence mode", () => {
    const result = sanitizeAndValidate("**Definitely** the right pick.", LOW_OPTS);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/overconfident/);
  });

  it("strips markdown then catches always-blocked overconfidence on any card", () => {
    const result = sanitizeAndValidate("**Guaranteed** to suit your preference.", OK_OPTS);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/overconfident/);
  });
});
