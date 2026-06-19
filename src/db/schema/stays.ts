import { pgTable, serial, text, jsonb, timestamp } from "drizzle-orm/pg-core";

// Represents a Zostel property surfaced to users.
// Extend columns as the recommendation logic is built out.
export const stays = pgTable("stays", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  location: text("location").notNull(),
  // Stored as JSONB so we can query by persona/vibe tags without schema churn
  tags: jsonb("tags").$type<string[]>().default([]),
  bookingUrl: text("booking_url").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
