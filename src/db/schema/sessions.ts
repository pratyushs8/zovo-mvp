import { pgTable, uuid, text, timestamp, smallint, jsonb } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type { IntakeAnswers } from "@/hooks/useIntakeSession";

export const sessions = pgTable("sessions", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  referrer: text("referrer"),
  userAgent: text("user_agent"),
  intakeStep: smallint("intake_step").default(0).notNull(),
  intakeAnswers: jsonb("intake_answers").$type<IntakeAnswers>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
});
