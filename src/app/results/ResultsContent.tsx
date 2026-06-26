"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { RecommendationResponse, ShortlistMeta, StayCard } from "@/types/api";
import type { ExplainedCard } from "@/types/explain";
import { RecommendationCard } from "@/components/results/RecommendationCard";
import { LogoSpinner } from "@/components/ui/LogoSpinner";
import { ResultsDebugPanel } from "@/components/dev/ResultsDebugPanel";
import { fetchExplanations } from "@/lib/api";

// ─── Heading copy ─────────────────────────────────────────────────────────────

function resultHeading(meta: ShortlistMeta, cardCount: number): string {
  if (cardCount === 0) return "No matches found.";
  if (meta.fallback === "thin_pool" && cardCount <= 2) return "A few options for your trip.";
  return "Here are your Zostel stays.";
}

// ─── Fallback banner ──────────────────────────────────────────────────────────
// Shown when confidence is not high or a fallback mode is active.
// Left border distinguishes it visually from property cards.

function FallbackBanner({ message }: { message: string }) {
  return (
    <div className="mb-5 border-l-2 border-zinc-600 pl-3">
      <p className="text-xs leading-relaxed text-zinc-400">{message}</p>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────
// Context-aware: explains why nothing came back and gives a specific next step.

function EmptyState({ meta }: { meta: ShortlistMeta }) {
  const wasFiltered = meta.totalFiltered > 0;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-8">
      <p className="mb-2 text-sm font-medium text-zinc-300">
        {wasFiltered
          ? "Your work-setup filter was too strict."
          : "No properties matched your answers."}
      </p>
      <p className="mb-6 text-xs leading-relaxed text-zinc-500">
        {wasFiltered
          ? `All ${meta.totalFiltered} properties we checked were removed by the workation filter. Try choosing a different priority or selecting "Either is fine" for room type.`
          : "Try loosening your preferences — for example, choosing a different room type or skipping the budget question."}
      </p>
      <Link
        href="/intake"
        className="block w-full rounded-lg border border-zinc-700 px-4 py-2.5 text-center text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white"
      >
        Try a different search
      </Link>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ResultsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("s");

  const [response, setResponse] = useState<RecommendationResponse | null>(null);
  const [explanations, setExplanations] = useState<Map<number, ExplainedCard>>(new Map());
  const [ready, setReady] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    startTransition(() => {
      try {
        const raw = sessionStorage.getItem("zoco_results");
        if (raw) setResponse(JSON.parse(raw) as RecommendationResponse);
      } catch {
        // malformed JSON — treat as absent
      }
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (ready && !response && !sessionId) {
      router.replace("/");
    }
  }, [ready, response, sessionId, router]);

  // Fire explanation request after Day 8 cards are ready — non-blocking
  useEffect(() => {
    if (!response || response.cards.length === 0) return;
    fetchExplanations({ cards: response.cards, debug: response._debug })
      .then((res) => {
        const map = new Map<number, ExplainedCard>(res.cards.map((c) => [c.id, c]));
        setExplanations(map);
      })
      .catch(() => {
        // Silent: Day 8 cards remain visible unchanged
      });
  }, [response]);

  // Logo spinner while sessionStorage hydrates
  if (!ready) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-6">
        <LogoSpinner size={48} />
      </main>
    );
  }

  // sessionStorage absent — tab was refreshed or link shared before Day 9 re-fetch
  if (!response) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <p className="mb-2 text-sm font-medium text-zinc-300">Results have expired.</p>
          <p className="mb-6 text-xs leading-relaxed text-zinc-500">
            Results are stored in the current tab only. Close and reopen the link, or start a fresh
            search.
          </p>
          <Link href="/intake" className="text-sm text-[#E84B2B] underline underline-offset-2">
            Start a new search
          </Link>
        </div>
      </main>
    );
  }

  const { cards, meta } = response;

  function mergeExplanation(card: StayCard): StayCard {
    const ex = explanations.get(card.id);
    if (!ex) return card;
    // Ranking owns chip metadata (label, strength, direction) — explanation
    // only contributes copy text. Never replace card.reasons wholesale.
    return {
      ...card,
      summary: ex.cardSummary,
      reasons: card.reasons.map((r) => ({ ...r, sentence: ex.sentences[r.label] })),
    };
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <p className="mb-2 text-xs text-zinc-600">Your matches</p>
        <h1 className="mb-6 text-2xl font-semibold text-white">
          {resultHeading(meta, cards.length)}
        </h1>

        {meta.bannerMessage && <FallbackBanner message={meta.bannerMessage} />}

        {cards.length === 0 ? (
          <EmptyState meta={meta} />
        ) : (
          <div className="flex flex-col gap-3">
            {cards.map((card) => (
              <RecommendationCard
                key={card.id}
                card={mergeExplanation(card)}
                requestId={response._debug.requestId}
                sessionId={sessionId}
                explanationSource={explanations.get(card.id)?.explanationSource}
              />
            ))}
          </div>
        )}

        <Link
          href="/"
          className="mt-8 block text-center text-sm text-zinc-600 transition-colors hover:text-zinc-400"
        >
          ← Start over
        </Link>
      </div>

      {process.env.NODE_ENV === "development" && <ResultsDebugPanel response={response} />}
    </main>
  );
}
