import type { PersonaKey, StayPriority, SocialEnergy, RoomType, BudgetLevel } from "@/types";

export interface RecommendationRequest {
  sessionId: string;
  personaKey: PersonaKey;
  priority: StayPriority;
  socialEnergy: SocialEnergy;
  roomType: RoomType;
  budget?: BudgetLevel;
}

export interface StayResult {
  id: number;
  name: string;
  location: string;
  bookingUrl: string;
}

// Day 3+: implement scoring and ranking logic here.
export async function recommendStays(_req: RecommendationRequest): Promise<StayResult[]> {
  throw new Error("recommendStays: not yet implemented");
}
