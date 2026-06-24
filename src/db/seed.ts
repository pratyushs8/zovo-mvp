import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { destinations, properties } from "./schema";
import { PROPERTIES, DESTINATIONS } from "@/config/properties";
import { env } from "@/lib/env";
import { validate } from "@/scripts/validate-properties";

const pool = new Pool({ connectionString: env.DATABASE_URL });
const db = drizzle(pool);

async function seed() {
  // Validate before touching the DB — exit early on any violation.
  validate();

  console.log("🌱 Seeding destinations…");

  await db
    .insert(destinations)
    .values(DESTINATIONS)
    .onConflictDoNothing({ target: destinations.slug });

  const existingDestinations = await db
    .select({ id: destinations.id, slug: destinations.slug })
    .from(destinations);
  const slugToId = Object.fromEntries(existingDestinations.map((d) => [d.slug, d.id]));

  console.log(`✓ ${DESTINATIONS.length} destinations processed`);

  console.log("🌱 Seeding properties…");

  const propertyRows = PROPERTIES.map(({ destinationSlug, priceInr, ...rest }) => ({
    ...rest,
    priceInr,
    destinationId: slugToId[destinationSlug],
  }));

  const results = await db
    .insert(properties)
    .values(propertyRows)
    .onConflictDoUpdate({
      target: properties.bookingUrl,
      set: {
        name: sql`excluded.name`,
        location: sql`excluded.location`,
        priceInr: sql`excluded.price_inr`,
        archetype: sql`excluded.archetype`,
        scoring: sql`excluded.scoring`,
        tags: sql`excluded.tags`,
        summary: sql`excluded.summary`,
      },
    })
    .returning({ id: properties.id, name: properties.name });

  console.log(`✓ ${results.length} properties upserted`);
  console.log("✅ Seed complete.");
}

seed()
  .catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  })
  .finally(() => pool.end());
