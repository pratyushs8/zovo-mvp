// Deterministic explanation copy built entirely from structured ranking facts.
// No model call — pure function, no I/O, no side effects.
//
// Quality bar: good enough to ship standalone. Copy must read like a helpful
// travel recommendation, not a scoring diagnostic.

import type { PromptCard, PromptDimensionFact } from "@/types/explain";
import type { ExplainedCard } from "@/types/explain";
import type { DimensionKey } from "@/config/scoring";
import type { MatchStrength } from "@/types/ranking";

// ─── Reason sentence templates ────────────────────────────────────────────────
//
// One sentence per (dimension, direction, strength) tuple.
// All sentences must be ≤100 characters.
// None may mention price, availability, ratings, reviews, or popularity.

type DirectionTemplates = {
  up: Record<MatchStrength, string>;
  down: string; // direction=down always implies a gap; strength is used for hedging
};

const DIM_SENTENCES: Record<DimensionKey, DirectionTemplates> = {
  scenic: {
    up: {
      strong: "The setting matches the kind of scenic backdrop you said you're looking for.",
      moderate: "Good scenery here — fits well with what you described.",
      weak: "Some scenic value, though not as dramatic as your ideal.",
    },
    down: "Less scenic than you'd prefer — worth knowing before you book.",
  },
  calm: {
    up: {
      strong: "Calm and low-key — a good match for the quieter trip you want.",
      moderate: "Reasonably quiet atmosphere that aligns with your preference for calm.",
      weak: "Quieter than average, though not fully peaceful.",
    },
    down: "More lively and social than you tend to prefer.",
  },
  social: {
    up: {
      strong: "Lively communal vibe — well-suited to meeting fellow travelers.",
      moderate: "Decent social scene for mixing with other guests.",
      weak: "Some social atmosphere, though less active than the liveliest hostels.",
    },
    down: "Less social than you're looking for.",
  },
  workation: {
    up: {
      strong: "Reliable wifi and a solid workspace — built for remote work.",
      moderate: "Workable setup for remote days — connectivity is generally dependable.",
      weak: "Basic connectivity available, though not optimised for long work sessions.",
    },
    down: "Work setup is more limited than you need for a workation stay.",
  },
  adventure: {
    up: {
      strong: "Plenty of adventure options nearby — great base for an active trip.",
      moderate: "Good access to outdoor activities that match your energy level.",
      weak: "Some outdoor options nearby, though not the most adventure-packed base.",
    },
    down: "Fewer adventure options than you're looking for.",
  },
  budget_fit: {
    up: {
      strong: "Fits comfortably within the budget you described.",
      moderate: "Priced in line with what you've said works for you.",
      weak: "On the higher end of your usual range, but not significantly so.",
    },
    down: "Costs more than your usual range — worth factoring in.",
  },
  room_type_fit: {
    up: {
      strong: "Room setup matches exactly what you asked for.",
      moderate: "Accommodation type aligns well with your preference.",
      weak: "Room type is close to what you prefer, though options may be limited.",
    },
    down: "Room setup differs from what you typically prefer.",
  },
};

// ─── Sentence builder ─────────────────────────────────────────────────────────

function reasonSentence(fact: PromptDimensionFact, lowConfidence: boolean): string {
  const templates = DIM_SENTENCES[fact.dim];
  if (!templates) return "";

  if (fact.direction === "down") {
    // Hedge down-direction sentences when confidence is low or gap is borderline
    if (lowConfidence || fact.strength === "weak") {
      return `May not fully match your ${fact.label.toLowerCase()} preference, but worth exploring.`;
    }
    return templates.down;
  }

  // direction === "up"
  if (lowConfidence) {
    // Modest language throughout when the card has limited data
    return `This property may suit your ${fact.label.toLowerCase()} preference — limited data available.`;
  }
  return templates.up[fact.strength];
}

// ─── Summary builder ──────────────────────────────────────────────────────────
//
// Produces a single sentence ≤120 characters grounded in the top match(es).
// Never mentions price, availability, or ratings.
// Uses modest language when lowConfidence=true or all signals are weak.

// Short adjective/noun phrases for leading summary construction.
// Excluded: budget_fit (would imply price claim) and room_type_fit (too clinical).
const SUMMARY_FRAGMENTS: Partial<Record<DimensionKey, string>> = {
  scenic: "scenic",
  calm: "peaceful",
  social: "sociable",
  workation: "remote-work-friendly",
  adventure: "adventure-ready",
};

function cityFromLocation(location: string): string {
  // "Old Manali, Manali" → "Manali"  |  "Bir, Himachal Pradesh" → "Bir"
  // Take the last comma-separated segment if it's a known destination-level name,
  // otherwise take the first segment (the neighbourhood).
  const parts = location.split(",").map((p) => p.trim());
  // If the last segment is a state name (long, contains "Pradesh" / "Uttarakhand" etc.)
  // use the first segment instead.
  const last = parts[parts.length - 1];
  const isStateName = /Pradesh|Uttarakhand|Rajasthan|Karnataka|Kerala|Goa/i.test(last);
  return isStateName ? parts[0] : last;
}

function buildCardSummary(card: PromptCard): string {
  const city = cityFromLocation(card.location);

  // Collect up-direction facts that have a summary fragment, sorted by strength then gap
  const strengthOrder: Record<MatchStrength, number> = { strong: 0, moderate: 1, weak: 2 };
  const upFacts = card.facts
    .filter((f) => f.direction === "up" && SUMMARY_FRAGMENTS[f.dim])
    .sort((a, b) => strengthOrder[a.strength] - strengthOrder[b.strength]);

  // No usable up signals → modest location-only summary
  if (upFacts.length === 0) {
    if (card.lowConfidence) {
      return `A possible match in ${city} — limited data, so worth checking directly.`;
    }
    return `A Zostel stay in ${city}.`;
  }

  const [first, second] = upFacts;
  const allWeak = upFacts.every((f) => f.strength === "weak");

  if (card.lowConfidence || allWeak) {
    const fragment = SUMMARY_FRAGMENTS[first.dim]!;
    return `A possibly ${fragment} option in ${city} — less data on this one.`;
  }

  // Two strong/moderate dimensions → combine them
  if (second && second.strength !== "weak") {
    const f1 = SUMMARY_FRAGMENTS[first.dim]!;
    const f2 = SUMMARY_FRAGMENTS[second.dim]!;
    const combined = `${f1} and ${f2}`;
    const candidate = `A ${combined} stay in ${city} that matches what you described.`;
    if (candidate.length <= 120) return candidate;
  }

  // Single dimension lead
  const fragment = SUMMARY_FRAGMENTS[first.dim]!;
  return `A ${fragment} stay in ${city} that matches what you described.`;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function buildFallbackCard(card: PromptCard): ExplainedCard {
  const sentences: Record<string, string> = {};

  for (const target of card.targetReasons) {
    const fact = card.facts.find((f) => f.label === target.label);
    const syntheticFact: PromptDimensionFact = fact ?? {
      dim: target.label.toLowerCase().replace(/\s+/g, "_") as DimensionKey,
      label: target.label,
      userValue: 0,
      propertyValue: 0,
      gap: 0.5,
      strength: "weak",
      direction: target.direction,
    };
    // Use target.direction — the chip is the source of truth. The sentence
    // template must agree with what the ranking layer decided to show.
    sentences[target.label] = reasonSentence(
      { ...syntheticFact, direction: target.direction },
      card.lowConfidence
    );
  }

  return {
    id: card.propertyId,
    cardSummary: buildCardSummary(card),
    sentences,
    explanationSource: "fallback",
  };
}
