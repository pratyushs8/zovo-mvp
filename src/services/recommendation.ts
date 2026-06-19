import type { TravelerPersona, TripVibe } from "@/types";

export interface RecommendationRequest {
  persona: TravelerPersona;
  vibe: TripVibe;
}

export interface StayResult {
  id: number;
  name: string;
  location: string;
  bookingUrl: string;
}

// Day 2+: implement ranking logic here using OpenAI + db query.
// Keeping this as a plain async function so it's easy to call from the API
// route and straightforward to unit-test.
export async function recommendStays(_req: RecommendationRequest): Promise<StayResult[]> {
  throw new Error("recommendStays: not yet implemented");
}
