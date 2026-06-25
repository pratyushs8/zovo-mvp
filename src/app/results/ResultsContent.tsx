"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { RecommendationResponse } from "@/types/api";

export default function ResultsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("s");

  const [results, setResults] = useState<RecommendationResponse | null>(null);
  const [ready, setReady] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    startTransition(() => {
      try {
        const raw = sessionStorage.getItem("zoco_results");
        if (raw) setResults(JSON.parse(raw) as RecommendationResponse);
      } catch {
        // malformed JSON — treat as absent
      }
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (ready && !results && !sessionId) {
      router.replace("/");
    }
  }, [ready, results, sessionId, router]);

  if (!ready) return null;

  if (!results) {
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
        <h1 className="mb-6 text-2xl font-semibold text-white">Here are your Zostel stays.</h1>

        <div className="flex flex-col gap-3">
          {results.results.slice(0, 5).map((stay) => (
            <div key={stay.id} className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3">
              <p className="text-sm font-medium text-zinc-100">{stay.name}</p>
              <p className="text-xs text-zinc-500">{stay.location}</p>
            </div>
          ))}
        </div>

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
