import { pgTable, serial, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import type { PersonaKey, StayPriority, SocialEnergy, RoomType, BudgetLevel } from "@/types";
import { sessions } from "./sessions";

export const recommendationRequests = pgTable(
  "recommendation_requests",
  {
    id: serial("id").primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id),
    personaKey: text("persona_key").$type<PersonaKey>().notNull(),
    priority: text("priority").$type<StayPriority>().notNull(),
    socialEnergy: text("social_energy").$type<SocialEnergy>().notNull(),
    roomType: text("room_type").$type<RoomType>().notNull(),
    budget: text("budget").$type<BudgetLevel>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("rec_requests_session_id_idx").on(t.sessionId)]
);
