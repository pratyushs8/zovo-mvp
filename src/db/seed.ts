import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { destinations, properties } from "./schema";
import { env } from "@/lib/env";

const pool = new Pool({ connectionString: env.DATABASE_URL });
const db = drizzle(pool);

const DESTINATIONS = [
  { name: "Manali", slug: "manali" },
  { name: "Jaipur", slug: "jaipur" },
  { name: "Rishikesh", slug: "rishikesh" },
  { name: "Goa", slug: "goa" },
  { name: "Mcleodganj", slug: "mcleodganj" },
];

// tags drive recommendation matching — persona and vibe keywords go here
const PROPERTIES = [
  {
    destinationSlug: "manali",
    name: "Zostel Manali",
    description: "A riverside hostel at the foot of the Himalayas.",
    tags: ["adventure", "group", "solo", "mountains", "trekking"],
    bookingUrl: "https://www.zostel.com/zostel/manali/",
  },
  {
    destinationSlug: "jaipur",
    name: "Zostel Jaipur",
    description: "Heritage haveli in the Pink City, steps from Hawa Mahal.",
    tags: ["cultural", "couple", "solo", "heritage", "city"],
    bookingUrl: "https://www.zostel.com/zostel/jaipur/",
  },
  {
    destinationSlug: "rishikesh",
    name: "Zostel Rishikesh",
    description: "Yoga, rafting, and campfire vibes on the Ganges.",
    tags: ["adventure", "chill", "solo", "spiritual", "rafting"],
    bookingUrl: "https://www.zostel.com/zostel/rishikesh/",
  },
  {
    destinationSlug: "goa",
    name: "Zostel Goa (Palolem)",
    description: "Beachside hang with hammocks and nightly bonfires.",
    tags: ["party", "chill", "group", "solo", "beach"],
    bookingUrl: "https://www.zostel.com/zostel/goa/",
  },
  {
    destinationSlug: "mcleodganj",
    name: "Zostel Mcleodganj",
    description: "Quiet mountain town, Tibetan culture, good coffee.",
    tags: ["chill", "workation", "solo", "mountains", "cultural"],
    bookingUrl: "https://www.zostel.com/zostel/mcleodganj/",
  },
];

async function seed() {
  console.log("🌱 Seeding destinations…");

  // Upsert destinations so the seed is safe to rerun
  const insertedDestinations = await db
    .insert(destinations)
    .values(DESTINATIONS)
    .onConflictDoNothing({ target: destinations.slug })
    .returning({ id: destinations.id, slug: destinations.slug });

  // Build a slug → id map, including rows that already existed
  const existingDestinations = await db
    .select({ id: destinations.id, slug: destinations.slug })
    .from(destinations);
  const slugToId = Object.fromEntries(existingDestinations.map((d) => [d.slug, d.id]));

  console.log(`✓ ${insertedDestinations.length} destinations inserted (skipped existing)`);

  console.log("🌱 Seeding properties…");

  const propertyRows = PROPERTIES.map(({ destinationSlug, ...rest }) => ({
    ...rest,
    destinationId: slugToId[destinationSlug],
  }));

  // Upsert on name — safe to rerun, won't duplicate
  const insertedProperties = await db
    .insert(properties)
    .values(propertyRows)
    .onConflictDoNothing()
    .returning({ id: properties.id, name: properties.name });

  console.log(`✓ ${insertedProperties.length} properties inserted (skipped existing)`);
  console.log("✅ Seed complete.");
}

seed()
  .catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  })
  .finally(() => pool.end());
