import { pgTable, serial, text, integer, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { destinations } from "./destinations";

export const properties = pgTable(
  "properties",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    destinationId: integer("destination_id")
      .notNull()
      .references(() => destinations.id),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    bookingUrl: text("booking_url").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("properties_destination_id_idx").on(t.destinationId)]
);
