-- Drop unique constraint on booking_url to allow multiple properties
-- in the same city to share a destination landing page URL.
ALTER TABLE "properties" DROP CONSTRAINT IF EXISTS "properties_booking_url_unique";
