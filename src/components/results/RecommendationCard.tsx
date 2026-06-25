import type { StayCard, CardReason } from "@/types/api";

// ─── Reason chip ──────────────────────────────────────────────────────────────

function ReasonChip({ reason }: { reason: CardReason }) {
  const isUp = reason.direction === "up";
  const color = isUp
    ? reason.strength === "strong"
      ? "text-[#E84B2B]"
      : "text-zinc-400"
    : "text-zinc-600";

  return (
    // Day 9: wrap this in a <details> or tooltip using reason.sentence when available
    <span className={`text-[11px] font-medium ${color}`}>
      {isUp ? "↑" : "↓"} {reason.label}
    </span>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

interface Props {
  card: StayCard;
}

export function RecommendationCard({ card }: Props) {
  return (
    <article className="rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-4">
      {/* Header — rank + title + location */}
      <header className="mb-3">
        <span className="mb-1 block text-xs text-zinc-600">#{card.rank}</span>
        <p className="text-sm font-semibold text-zinc-100">{card.title}</p>
        <p className="text-xs text-zinc-500">{card.location}</p>
      </header>

      {/* Summary — property blurb */}
      {/* Day 9: replace or augment with AI-generated explanation copy */}
      <p className="mb-3 text-xs leading-relaxed text-zinc-400">{card.summary}</p>

      {/* Reason chips — up signals then down signals */}
      {card.reasons.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-x-3 gap-y-1">
          {card.reasons.map((r, i) => (
            <ReasonChip key={i} reason={r} />
          ))}
        </div>
      )}

      {/* Primary CTA */}
      {/* Day 10: add click tracking wrapper around this anchor */}
      <a
        href={card.bookingUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full rounded-lg bg-[#E84B2B] px-4 py-2.5 text-center text-xs font-medium text-white transition-colors hover:bg-[#c73b1f] focus-visible:ring-2 focus-visible:ring-[#E84B2B] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f0f0f] focus-visible:outline-none"
      >
        View on Zostel →
      </a>
    </article>
  );
}
