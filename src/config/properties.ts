import type { PropertySeed } from "@/types";
import raw from "@/data/properties.json";

export const PROPERTIES: PropertySeed[] = raw as PropertySeed[];

// Destinations derived from the property list — no separate file to maintain.
export const DESTINATIONS = Array.from(
  new Map(
    PROPERTIES.map((p) => [p.destinationSlug, { slug: p.destinationSlug, name: p.location.split(",")[0].trim() }])
  ).values()
);
