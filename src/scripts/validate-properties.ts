import { PROPERTIES } from "@/config/properties";
import { DIMENSION_KEYS } from "@/config/scoring";

const VALID_ARCHETYPES = new Set([
  "mountain_adventure_hub",
  "remote_mountain_quiet",
  "cultural_hill_town",
  "beach_social",
  "heritage_cultural_city",
  "urban_metro",
  "nature_retreat",
]);

// Tags allowed in property metadata.
const VALID_TAGS = new Set([
  "mountains", "riverside", "lake", "beach", "backwaters", "forest", "hills",
  "desert", "island", "cliffside", "rocky", "camping", "scenic", "city", "village",
  "social", "quiet", "party", "spiritual", "cultural", "heritage", "romantic",
  "workation", "cafe",
  "backpacker", "budget", "international",
  "trekking", "rafting", "adventure", "paragliding", "diving", "cycling",
  "dorm", "private",
  "tech",
]);

// Callable by the seed script. Throws on any violation so the seed exits early.
export function validate(): void {
  const errors: string[] = [];

  const fail = (msg: string) => errors.push(msg);

  // 1. Unique booking URLs
  const urls = PROPERTIES.map((p) => p.bookingUrl);
  const urlSet = new Set(urls);
  if (urlSet.size !== urls.length) {
    const dupes = urls.filter((u, i) => urls.indexOf(u) !== i);
    fail(`Duplicate bookingUrl(s): ${dupes.join(", ")}`);
  }

  // 2. Per-property checks
  for (const p of PROPERTIES) {
    const prefix = `[${p.name}]`;

    if (!VALID_ARCHETYPES.has(p.archetype)) {
      fail(`${prefix} unknown archetype "${p.archetype}"`);
    }

    if (p.priceInr <= 0 || !Number.isInteger(p.priceInr)) {
      fail(`${prefix} priceInr must be a positive integer, got ${p.priceInr}`);
    }

    for (const dim of DIMENSION_KEYS) {
      const val = p.scoring[dim];
      if (val === undefined || val === null) {
        fail(`${prefix} scoring.${dim} is missing`);
      } else if (val < 0 || val > 1) {
        fail(`${prefix} scoring.${dim} = ${val} is outside [0, 1]`);
      }
    }

    for (const tag of p.tags) {
      if (!VALID_TAGS.has(tag)) {
        fail(`${prefix} unknown tag "${tag}"`);
      }
    }

    if (!p.name.trim()) fail(`${prefix} name is empty`);
    if (!p.destinationSlug.trim()) fail(`${prefix} destinationSlug is empty`);
    if (!p.location.trim()) fail(`${prefix} location is empty`);
    if (!p.bookingUrl.startsWith("https://")) fail(`${prefix} bookingUrl must start with https://`);
    if (!p.summary?.trim()) fail(`${prefix} summary is empty`);
  }

  if (errors.length > 0) {
    for (const e of errors) console.error(`  ✗ ${e}`);
    throw new Error(`Property validation failed with ${errors.length} error(s). Fix before seeding.`);
  }
}

// Standalone script entry point: npm run validate:properties
if (process.argv[1].endsWith("validate-properties.ts") || process.argv[1].endsWith("validate-properties.js")) {
  console.log(`Validating ${PROPERTIES.length} properties…\n`);
  try {
    validate();
    console.log(`${PROPERTIES.length} properties checked.`);
    console.log("✅ All properties valid.\n");
  } catch (err) {
    console.error(`\n❌ ${(err as Error).message}\n`);
    process.exit(1);
  }
}
