import { z } from "zod";

export const personaKeySchema = z.enum([
  "solo_social",
  "solo_quiet",
  "friends_getaway",
  "couple_retreat",
  "workation",
  "budget_backpacker",
]);

export const stayPrioritySchema = z.enum([
  "social_vibe",
  "calm_quiet",
  "scenic_views",
  "adventure_access",
  "work_setup",
  "best_value",
]);

export const socialEnergySchema = z.enum(["very_social", "balanced", "mostly_private"]);

export const roomTypeSchema = z.enum(["dorm", "private", "flexible"]);

export const budgetLevelSchema = z.enum(["lowest", "moderate", "flexible"]);

export const recommendationRequestSchema = z.object({
  sessionId: z.string().uuid(),
  personaKey: personaKeySchema,
  priority: stayPrioritySchema,
  socialEnergy: socialEnergySchema,
  roomType: roomTypeSchema,
  budget: budgetLevelSchema.optional(),
});

export type RecommendationRequestPayload = z.infer<typeof recommendationRequestSchema>;
