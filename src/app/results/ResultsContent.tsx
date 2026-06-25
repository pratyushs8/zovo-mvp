"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { RecommendationResponse, StayCard } from "@/types/api";

// ─── Sub-components ───────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-4">
      <div className="mb-3 h-3 w-8 rounded bg-zinc-800" />
      <div className="mb-2 h-4 w-40 rounded bg-zinc-800" />
      <div className="mb-3 h-3 w-28 rounded bg-zinc-800" />
      <div className="mb-1 h-3 w-full rounded bg-zinc-800" />
      <div className="h-3 w-3/4 rounded bg-zinc-800" />
    </div>
  );
}

function ShortlistCard({ card }: { card: StayCard }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-4">
      <div className="mb-1">
        <span className="text-xs text-zinc-600">#{card.rank}</span>
      </div>

      <p className="mb-0.5 text-sm font-semibold text-zinc-100">{card.title}</p>
      <p className="mb-3 text-xs text-zinc-500">{card.location}</p>

      <p className="mb-3 text-xs leading-relaxed text-zinc-400">{card.summary}</p>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {card.reasons.map((r, i) => (
          <span
            key={i}
            className={`text-[11px] font-medium ${
              r.direction === "up"
                ? r.strength === "strong"
                  ? "text-[#E84B2B]"
                  : "text-zinc-400"
                : "text-zinc-600"
            }`}
          >
            {r.direction === "up" ? "↑" : "↓"} {r.label}
          </span>
        ))}
      </div>

      <a
        href={card.bookingUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full rounded-lg bg-[#E84B2B] px-4 py-2.5 text-center text-xs font-medium text-white transition-colors hover:bg-[#c73b1f]"
      >
        View on Zostel →
      </a>
    </div>
  );
}

function FallbackBanner({ message }: { message: string }) {
  return (
    <div className="mb-4 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3">
      <p className="text-xs text-zinc-400">{message}</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-8 text-center">
      <p className="mb-6 text-xs text-zinc-500">
        Try adjusting your travel style — for example, choosing a different room type or budget.
      </p>
      <Link href="/intake" className="text-sm text-[#E84B2B] underline underline-offset-2">
        Start a new search
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

  // Not yet hydrated — show card skeletons to avoid layout shift
  if (!ready) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <p className="mb-2 text-xs text-zinc-600">Your matches</p>
          <h1 className="mb-6 text-2xl font-semibold text-white">Finding your stays…</h1>
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((n) => (
              <CardSkeleton key={n} />
            ))}
          </div>
        </div>
      </main>
    );
  }

  // sessionId present but no sessionStorage — tab refreshed or link shared
  if (!response) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <p className="mb-4 text-sm text-zinc-400">Results are no longer available in this tab.</p>
          <Link href="/intake" className="text-sm text-[#E84B2B] underline underline-offset-2">
            Start a new search
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <p className="mb-2 text-xs text-zinc-600">Your matches</p>
        <h1 className="mb-6 text-2xl font-semibold text-white">
          {response.cards.length === 0 ? "No matches found." : "Here are your Zostel stays."}
        </h1>

        {response.meta.bannerMessage && <FallbackBanner message={response.meta.bannerMessage} />}

        {response.cards.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="flex flex-col gap-3">
            {response.cards.map((card) => (
              <ShortlistCard key={card.id} card={card} />
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
    </main>
  );
}
