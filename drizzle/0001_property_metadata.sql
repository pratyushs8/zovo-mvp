-- Migration: property_metadata
-- Adds scoring vector, archetype, price, and location to properties.
-- Aligns recommendation_requests with the Day 3 intake schema.

--> statement-breakpoint
ALTER TABLE "properties"
  ADD COLUMN "location" text NOT NULL DEFAULT '',
  ADD COLUMN "price_inr" integer NOT NULL DEFAULT 0,
  ADD COLUMN "archetype" text NOT NULL DEFAULT '',
  ADD COLUMN "scoring" jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN "summary" text,
  ADD CONSTRAINT "properties_booking_url_unique" UNIQUE("booking_url");

-- Remove defaults once columns are populated (they exist only to satisfy NOT NULL during migration)
ALTER TABLE "properties"
  ALTER COLUMN "location" DROP DEFAULT,
  ALTER COLUMN "price_inr" DROP DEFAULT,
  ALTER COLUMN "archetype" DROP DEFAULT,
  ALTER COLUMN "scoring" DROP DEFAULT;

--> statement-breakpoint
-- Align recommendation_requests with the Day 3 intake schema.
-- Rename persona → persona_key, vibe → priority, add new intake columns.
ALTER TABLE "recommendation_requests"
  RENAME COLUMN "persona" TO "persona_key";

ALTER TABLE "recommendation_requests"
  RENAME COLUMN "vibe" TO "priority";

ALTER TABLE "recommendation_requests"
  ADD COLUMN "social_energy" text NOT NULL DEFAULT 'balanced',
  ADD COLUMN "room_type" text NOT NULL DEFAULT 'flexible',
  ADD COLUMN "budget" text;

ALTER TABLE "recommendation_requests"
  ALTER COLUMN "social_energy" DROP DEFAULT,
  ALTER COLUMN "room_type" DROP DEFAULT;

--> statement-breakpoint
-- Nullable: Day 5 recommendStays() must populate this on every insert.
-- NOT NULL would block all recommendation writes until Day 5 is implemented.
ALTER TABLE "recommendation_results"
  ADD COLUMN "score_snapshot" jsonb;
