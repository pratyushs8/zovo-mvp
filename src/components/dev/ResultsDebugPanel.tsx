"use client";

import { useState } from "react";
import type { RecommendationResponse } from "@/types/api";
import { buildViewStayUrl } from "@/lib/buildViewStayUrl";

type Tab = "meta" | "cards" | "debug" | "handoff";

interface Props {
  response: RecommendationResponse;
  sessionId?: string | null;
}

export function ResultsDebugPanel({ response, sessionId }: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("meta");

  const { cards, meta, _debug } = response;

  // Lightweight contract check — flags missing top-level keys.
  const missingKeys = (["cards", "meta", "_debug"] as const).filter(
    (k) => response[k] === undefined
  );
  const cardsMissingFields = cards.flatMap((c, i) => {
    const required = [
      "id",
      "rank",
      "title",
      "destinationSlug",
      "location",
      "summary",
      "priceInr",
      "bookingUrl",
    ] as const;
    return required
      .filter((f) => (c as unknown as Record<string, unknown>)[f] === undefined)
      .map((f) => `card[${i}].${f}`);
  });

  // Handoff URL check — flags cards whose bookingUrl won't produce a valid CTA.
  const handoffResults = cards.map((card) => ({
    card,
    urlResult: buildViewStayUrl({ bookingUrl: card.bookingUrl, rank: card.rank, sessionId }),
    attribution: {
      propertyId: card.id,
      bookingUrl: card.bookingUrl,
      rank: card.rank,
      destinationSlug: card.destinationSlug,
      requestId: _debug.requestId,
    },
  }));
  const handoffFailCount = handoffResults.filter((r) => !r.urlResult.ok).length;

  const hasContractIssue =
    missingKeys.length > 0 || cardsMissingFields.length > 0 || handoffFailCount > 0;

  if (!open) {
    return (
      <div className="fixed right-0 bottom-0 left-0 z-50 flex justify-end px-3 py-2 font-mono text-xs">
        <button
          onClick={() => setOpen(true)}
          className={`rounded px-3 py-1 shadow-md ${
            hasContractIssue
              ? "bg-red-900 text-red-200 hover:bg-red-800"
              : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
          }`}
          aria-label="Open results debug panel"
        >
          {hasContractIssue ? "DEV ⚠" : "DEV"}
        </button>
      </div>
    );
  }

  return (
    <div
      className="fixed right-0 bottom-0 left-0 z-50 font-mono text-xs"
      aria-label="Developer results debug panel"
    >
      <div className="border-t border-zinc-700 bg-zinc-900 text-zinc-300 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-700 px-4 py-2">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-zinc-100">DEV — Results Debug</span>
            {hasContractIssue && (
              <span className="text-red-400">
                ⚠ contract issues: {[...missingKeys, ...cardsMissingFields].join(", ")}
                {handoffFailCount > 0 && ` · ${handoffFailCount} handoff URL(s) invalid`}
              </span>
            )}
            {!hasContractIssue && <span className="text-emerald-400">✓ contract ok</span>}
          </div>
          <button
            onClick={() => setOpen(false)}
            className="text-zinc-400 hover:text-zinc-100"
            aria-label="Collapse debug panel"
          >
            ▼ collapse
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-700">
          {(["meta", "cards", "debug", "handoff"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 ${
                tab === t
                  ? "border-b-2 border-zinc-100 text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-300"
              } ${t === "handoff" && handoffFailCount > 0 ? "text-red-400" : ""}`}
            >
              {t}
              {t === "handoff" && handoffFailCount > 0 && ` ⚠`}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="max-h-64 overflow-y-auto p-4">
          {tab === "meta" && <pre className="text-zinc-200">{JSON.stringify(meta, null, 2)}</pre>}

          {tab === "cards" && (
            <div className="space-y-3">
              {cards.length === 0 && <p className="text-zinc-500">No cards returned.</p>}
              {cards.map((card, i) => {
                const dbg = _debug.cards[i];
                return (
                  <div key={card.id} className="rounded border border-zinc-700 p-2">
                    <p className="mb-1 text-zinc-100">
                      #{card.rank} {card.title}
                      <span className="ml-2 text-zinc-500">
                        score: {dbg?.score.toFixed(3) ?? "–"}
                      </span>
                      {card.lowConfidence && (
                        <span className="ml-2 text-yellow-400">low-confidence</span>
                      )}
                    </p>
                    <p className="text-zinc-500">
                      {card.destinationSlug} · ₹{card.priceInr}/night
                    </p>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                      {card.reasons.map((r, ri) => (
                        <span
                          key={ri}
                          className={r.direction === "up" ? "text-emerald-400" : "text-zinc-600"}
                        >
                          {r.direction === "up" ? "↑" : "↓"} {r.label} ({r.strength})
                        </span>
                      ))}
                    </div>
                    {dbg && (
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-zinc-600">
                        {Object.entries(dbg.breakdown).map(([dim, b]) => (
                          <span key={dim}>
                            {dim}: {b.contribution.toFixed(2)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {tab === "debug" && (
            <div className="space-y-3">
              <div>
                <p className="mb-1 text-zinc-500">userVector</p>
                <pre className="text-zinc-200">{JSON.stringify(_debug.userVector, null, 2)}</pre>
              </div>
              <div>
                <p className="mb-1 text-zinc-500">rankingExplanation</p>
                <pre className="text-zinc-200">
                  {JSON.stringify(_debug.rankingExplanation, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {tab === "handoff" && (
            <div className="space-y-4">
              {/* Session + request context */}
              <div className="rounded border border-zinc-700 p-2">
                <p className="mb-1.5 text-zinc-500">attribution context</p>
                <div className="space-y-0.5">
                  <p>
                    <span className="text-zinc-500">requestId </span>
                    <span className="text-zinc-200">{_debug.requestId}</span>
                  </p>
                  <p>
                    <span className="text-zinc-500">sessionId </span>
                    {sessionId ? (
                      <span className="text-zinc-200">{sessionId}</span>
                    ) : (
                      <span className="text-zinc-600">absent — utm_campaign will be omitted</span>
                    )}
                  </p>
                </div>
              </div>

              {/* Per-card handoff inspection */}
              {handoffResults.map(({ card, urlResult, attribution }) => (
                <div
                  key={card.id}
                  className={`rounded border p-2 ${
                    urlResult.ok ? "border-zinc-700" : "border-red-800"
                  }`}
                >
                  <p className="mb-1.5 text-zinc-100">
                    #{card.rank} {card.title}
                    {urlResult.ok ? (
                      <span className="ml-2 text-emerald-400">✓ url ok</span>
                    ) : (
                      <span className="ml-2 text-red-400">✗ {urlResult.reason}</span>
                    )}
                  </p>

                  {urlResult.ok && (
                    <div className="mb-2">
                      <p className="mb-0.5 text-zinc-500">outbound url</p>
                      <p className="break-all text-zinc-300">{urlResult.url}</p>
                      {/* UTM params decoded for quick reading */}
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-zinc-600">
                        {Array.from(new URL(urlResult.url).searchParams.entries()).map(([k, v]) => (
                          <span key={k}>
                            {k}=<span className="text-zinc-400">{v}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <p className="mb-0.5 text-zinc-500">event payload</p>
                    <pre className="text-zinc-400">{JSON.stringify(attribution, null, 2)}</pre>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
