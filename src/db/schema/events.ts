import { pgTable, serial, uuid, text, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { sessions } from "./sessions";

export const events = pgTable(
  "events",
  {
    id: serial("id").primaryKey(),
    sessionId: uuid("session_id").references(() => sessions.id),
    name: text("name").notNull(),
    properties: jsonb("properties").notNull().default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("events_session_id_idx").on(t.sessionId),
    index("events_name_created_at_idx").on(t.name, t.createdAt),
  ]
);
