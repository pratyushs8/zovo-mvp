import type { CandidateProperty } from "@/types/ranking";
import type { ConfidenceLevel, FallbackMode } from "@/types/ranking";
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

export type { RecommendationRequest, StayCard, RecommendationResponse } from "@/types/api";

// ─── Banner copy ──────────────────────────────────────────────────────────────

function buildBannerMessage(confidence: ConfidenceLevel, fallback: FallbackMode): string | null {
  if (fallback === "empty") return null;
  if (fallback === "thin_pool")
    return "Fewer properties matched your filters — showing the closest options.";
  if (fallback === "weak_match")
    return "These are the closest matches we found — not a perfect fit for every preference.";
  if (fallback === "hard_filter_relaxed")
    return "We relaxed the work-setup filter to show more options.";
  if (confidence === "moderate")
    return "Good matches found — some properties are a closer fit than others.";
  if (confidence === "low")
    return "These are the closest options we found. They may not be a perfect fit.";
  return null;
}

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
      const topMatch = r.explanation.topMatches[0];
      return {
        id: r.property.id,
        rank: r.rank,
        title: r.property.name,
        location: r.property.location,
        summary: r.property.summary,
        reason: {
          label: topMatch ? DIMENSIONS[topMatch.dim].label : "Best match",
          strength: topMatch?.strength ?? "moderate",
        },
        lowConfidence: r.lowConfidence,
        bookingUrl: r.property.bookingUrl,
      };
    }),
    meta,
    _debug: {
      rankingExplanation: payload.rankingExplanation,
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
