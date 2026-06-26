import type { StayCard, CardReason } from "@/types/api";
import { buildViewStayUrl } from "@/lib/buildViewStayUrl";

// ─── Reason chip ──────────────────────────────────────────────────────────────

function ReasonChip({ reason }: { reason: CardReason }) {
  const isUp = reason.direction === "up";
  const color = isUp
    ? reason.strength === "strong"
      ? "text-[#E84B2B]"
      : "text-zinc-400"
    : "text-zinc-600";

  return (
    <span className="flex flex-col gap-0.5">
      <span className={`text-[11px] font-medium ${color}`}>
        {isUp ? "↑" : "↓"} {reason.label}
      </span>
      {reason.sentence && (
        <span className="text-[10px] leading-snug text-zinc-500">{reason.sentence}</span>
      )}
    </span>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

interface Props {
  card: StayCard;
  sessionId?: string | null;
}

export function RecommendationCard({ card, sessionId }: Props) {
  const ctaResult = buildViewStayUrl({
    bookingUrl: card.bookingUrl,
    rank: card.rank,
    sessionId,
  });

  return (
    <article
      className={`rounded-xl border bg-zinc-900 px-5 py-4 ${
        card.lowConfidence ? "border-zinc-700" : "border-zinc-800"
      }`}
    >
      {/* Header — rank + title + location */}
      <header className="mb-3">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-xs text-zinc-600">#{card.rank}</span>
          {card.lowConfidence && (
            <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-500">
              limited info
            </span>
          )}
        </div>
        <p className="text-sm font-semibold text-zinc-100">{card.title}</p>
        <p className="text-xs text-zinc-500">{card.location}</p>
      </header>

      {/* Summary — replaced by AI-generated explanation when available */}
      <p className="mb-3 text-xs leading-relaxed text-zinc-400">{card.summary}</p>

      {/* Reason chips */}
      {card.reasons.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-x-3 gap-y-1">
          {card.reasons.map((r, i) => (
            <ReasonChip key={i} reason={r} />
          ))}
        </div>
      )}

      {/* Primary CTA — hidden if URL validation fails */}
      {ctaResult.ok ? (
        <a
          href={ctaResult.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full rounded-lg bg-[#E84B2B] px-4 py-2.5 text-center text-xs font-medium text-white transition-colors hover:bg-[#c73b1f] focus-visible:ring-2 focus-visible:ring-[#E84B2B] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f0f0f] focus-visible:outline-none"
        >
          View on Zostel →
        </a>
      ) : null}
    </article>
  );
}
