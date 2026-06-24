import { pgTable, serial, text, integer, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import type { ScoringVector, Archetype } from "@/types";
import { destinations } from "./destinations";

export const properties = pgTable(
  "properties",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    destinationId: integer("destination_id")
      .notNull()
      .references(() => destinations.id),
    location: text("location").notNull(),
    priceInr: integer("price_inr").notNull(),
    archetype: text("archetype").$type<Archetype>().notNull(),
    scoring: jsonb("scoring").$type<ScoringVector>().notNull(),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    bookingUrl: text("booking_url").notNull().unique(),
    summary: text("summary"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("properties_destination_id_idx").on(t.destinationId)]
);
