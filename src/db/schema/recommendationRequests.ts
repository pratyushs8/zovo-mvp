import { pgTable, serial, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { sessions } from "./sessions";

export const recommendationRequests = pgTable(
  "recommendation_requests",
  {
    id: serial("id").primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id),
    persona: text("persona").notNull(),
    vibe: text("vibe").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("rec_requests_session_id_idx").on(t.sessionId)]
);
