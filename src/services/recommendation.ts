import type { CandidateProperty } from "@/types/ranking";
import type { RecommendationRequest, RecommendationResponse } from "@/types/api";
import { db } from "@/db/client";
import {
  properties as propertiesTable,
  recommendationRequests as requestsTable,
  recommendationResults as resultsTable,
} from "@/db/schema";
import { PROPERTIES } from "@/config/properties";
import { buildUserVector } from "@/lib/buildUserVector";
import { rankProperties } from "@/lib/rankProperties";

// Re-export so server code that imports from this module still gets the types.
export type { RecommendationRequest, StayResult, RecommendationResponse } from "@/types/api";

export async function recommendStays(
  req: RecommendationRequest,
): Promise<RecommendationResponse> {
  // Stage 1: resolve user vector from persona baseline + Q2–Q5 overrides.
  const userVector = buildUserVector(req);

  // Stage 2: load candidates — fetch DB ids then join with in-memory PROPERTIES.
  // PROPERTIES is the seeded source of truth; the DB only adds the row id.
  const dbRows = await db
    .select({ id: propertiesTable.id, bookingUrl: propertiesTable.bookingUrl })
    .from(propertiesTable);

  const idByUrl = new Map(dbRows.map((r) => [r.bookingUrl, r.id]));

  const candidates: CandidateProperty[] = PROPERTIES.flatMap((p) => {
    const id = idByUrl.get(p.bookingUrl);
    return id !== undefined ? [{ ...p, id }] : [];
  });

  // Stages 3–6: hard filter → score → sort → slice → explain (pure, sync).
  const payload = rankProperties({ userVector }, candidates);

  // Stage 7: persist request + results in a single transaction.
  await db.transaction(async (tx) => {
    const [reqRow] = await tx
      .insert(requestsTable)
      .values({
        sessionId:   req.sessionId,
        personaKey:  req.personaKey,
        priority:    req.priority,
        socialEnergy: req.socialEnergy,
        roomType:    req.roomType,
        budget:      req.budget ?? null,
      })
      .returning({ id: requestsTable.id });

    if (payload.results.length > 0) {
      await tx.insert(resultsTable).values(
        payload.results.map((r) => ({
          requestId:     reqRow.id,
          propertyId:    r.property.id,
          rank:          r.rank,
          scoreSnapshot: r.property.scoring,
        })),
      );
    }
  });

  return {
    results: payload.results.map((r) => ({
      id:                 r.property.id,
      name:               r.property.name,
      location:           r.property.location,
      bookingUrl:         r.property.bookingUrl,
      rank:               r.rank,
      score:              r.score,
      breakdown:          r.breakdown,
      hardFilterExempted: r.hardFilterExempted,
      lowConfidence:      r.lowConfidence,
      explanation:        r.explanation,
    })),
    confidence:         payload.confidence,
    fallback:           payload.fallback,
    hardFilteredCount:  payload.hardFilteredCount,
    poolSize:           payload.poolSize,
    rankingExplanation: payload.rankingExplanation,
  };
}
