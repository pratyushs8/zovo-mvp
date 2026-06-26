import type { CandidateProperty } from "@/types/ranking";
import type { RecommendationRequest, RecommendationResponse, ShortlistMeta } from "@/types/api";
import { db } from "@/db/client";
import {
  properties as propertiesTable,
  recommendationRequests as requestsTable,
  recommendationResults as resultsTable,
} from "@/db/schema";
import { PROPERTIES } from "@/config/properties";
import { DIMENSIONS } from "@/config/scoring";
import { buildUserVector } from "@/lib/buildUserVector";
import { rankProperties } from "@/lib/rankProperties";
import { buildBannerMessage } from "@/lib/buildBannerMessage";

export type { RecommendationRequest, StayCard, RecommendationResponse } from "@/types/api";

// ─── Main service function ────────────────────────────────────────────────────

export async function recommendStays(req: RecommendationRequest): Promise<RecommendationResponse> {
  const userVector = buildUserVector(req);

  const dbRows = await db
    .select({ id: propertiesTable.id, bookingUrl: propertiesTable.bookingUrl })
    .from(propertiesTable);

  const idByUrl = new Map(dbRows.map((r) => [r.bookingUrl, r.id]));

  const candidates: CandidateProperty[] = PROPERTIES.flatMap((p) => {
    const id = idByUrl.get(p.bookingUrl);
    return id !== undefined ? [{ ...p, id }] : [];
  });

  const payload = rankProperties({ userVector }, candidates);

  let requestId = 0;

  await db.transaction(async (tx) => {
    const [reqRow] = await tx
      .insert(requestsTable)
      .values({
        sessionId: req.sessionId,
        personaKey: req.personaKey,
        priority: req.priority,
        socialEnergy: req.socialEnergy,
        roomType: req.roomType,
        budget: req.budget ?? null,
      })
      .returning({ id: requestsTable.id });

    requestId = reqRow.id;

    if (payload.results.length > 0) {
      await tx.insert(resultsTable).values(
        payload.results.map((r) => ({
          requestId: reqRow.id,
          propertyId: r.property.id,
          rank: r.rank,
          scoreSnapshot: r.property.scoring,
        }))
      );
    }
  });

  const meta: ShortlistMeta = {
    confidence: payload.confidence,
    fallback: payload.fallback,
    bannerMessage: buildBannerMessage(payload.confidence, payload.fallback),
    totalFiltered: payload.hardFilteredCount,
    poolSize: payload.poolSize,
  };

  return {
    cards: payload.results.map((r) => {
      const upReasons = r.explanation.topMatches
        .filter((m) => m.strength !== "weak")
        .slice(0, 2)
        .map((m) => ({
          label: DIMENSIONS[m.dim].label,
          strength: m.strength,
          direction: "up" as const,
        }));

      const downReasons = r.explanation.topMisses.slice(0, 2).map((m) => ({
        label: DIMENSIONS[m.dim].label,
        strength: m.strength,
        direction: "down" as const,
      }));

      // Always have at least one up reason — fall back to the top match even if weak.
      if (upReasons.length === 0 && r.explanation.topMatches[0]) {
        const m = r.explanation.topMatches[0];
        upReasons.push({ label: DIMENSIONS[m.dim].label, strength: m.strength, direction: "up" });
      }

      return {
        id: r.property.id,
        rank: r.rank,
        title: r.property.name,
        destinationSlug: r.property.destinationSlug,
        location: r.property.location,
        summary: r.property.summary,
        priceInr: r.property.priceInr,
        reasons: [...upReasons, ...downReasons],
        lowConfidence: r.lowConfidence,
        bookingUrl: r.property.bookingUrl,
      };
    }),
    meta,
    _debug: {
      userVector,
      rankingExplanation: payload.rankingExplanation,
      requestId,
      cards: payload.results.map((r) => ({
        id: r.property.id,
        score: r.score,
        breakdown: r.breakdown,
        hardFilterExempted: r.hardFilterExempted,
        explanation: r.explanation,
      })),
    },
  };
}
