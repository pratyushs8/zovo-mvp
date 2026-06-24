import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { destinations, properties } from "./schema";
import { PROPERTIES, DESTINATIONS } from "@/config/properties";
import { env } from "@/lib/env";

const pool = new Pool({ connectionString: env.DATABASE_URL });
const db = drizzle(pool);

async function seed() {
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

  const inserted = await db
    .insert(properties)
    .values(propertyRows)
    .onConflictDoNothing({ target: properties.bookingUrl })
    .returning({ id: properties.id, name: properties.name });

  console.log(`✓ ${inserted.length} properties inserted (skipped existing)`);
  console.log("✅ Seed complete.");
}

seed()
  .catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  })
  .finally(() => pool.end());
