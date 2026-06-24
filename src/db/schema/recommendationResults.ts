import { pgTable, serial, integer, smallint, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import type { ScoringVector } from "@/types";
import { recommendationRequests } from "./recommendationRequests";
import { properties } from "./properties";

export const recommendationResults = pgTable(
  "recommendation_results",
  {
    id: serial("id").primaryKey(),
    requestId: integer("request_id")
      .notNull()
      .references(() => recommendationRequests.id),
    propertyId: integer("property_id")
      .notNull()
      .references(() => properties.id),
    rank: smallint("rank").notNull(),
    // Snapshot of the property's ScoringVector at ranking time.
    // The property's scoring column is mutable (reseeds overwrite it);
    // this preserves the exact vector that produced the rank for post-hoc analysis.
    scoreSnapshot: jsonb("score_snapshot").$type<ScoringVector>().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("rec_results_request_id_idx").on(t.requestId),
    index("rec_results_property_id_idx").on(t.propertyId),
  ]
);
