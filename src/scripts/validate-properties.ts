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

let errors = 0;

function fail(msg: string) {
  console.error(`  ✗ ${msg}`);
  errors++;
}

console.log(`Validating ${PROPERTIES.length} properties…\n`);

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

  // Archetype
  if (!VALID_ARCHETYPES.has(p.archetype)) {
    fail(`${prefix} unknown archetype "${p.archetype}"`);
  }

  // Price
  if (p.priceInr <= 0 || !Number.isInteger(p.priceInr)) {
    fail(`${prefix} priceInr must be a positive integer, got ${p.priceInr}`);
  }

  // Scoring vector — all 7 dimensions present and in [0, 1]
  for (const dim of DIMENSION_KEYS) {
    const val = p.scoring[dim];
    if (val === undefined || val === null) {
      fail(`${prefix} scoring.${dim} is missing`);
    } else if (val < 0 || val > 1) {
      fail(`${prefix} scoring.${dim} = ${val} is outside [0, 1]`);
    }
  }

  // Tags — all from controlled vocabulary
  for (const tag of p.tags) {
    if (!VALID_TAGS.has(tag)) {
      fail(`${prefix} unknown tag "${tag}"`);
    }
  }

  // Required strings
  if (!p.name.trim()) fail(`${prefix} name is empty`);
  if (!p.destinationSlug.trim()) fail(`${prefix} destinationSlug is empty`);
  if (!p.location.trim()) fail(`${prefix} location is empty`);
  if (!p.bookingUrl.startsWith("https://")) fail(`${prefix} bookingUrl must start with https://`);
  if (!p.summary?.trim()) fail(`${prefix} summary is empty`);
}

console.log(`\n${PROPERTIES.length} properties checked.`);

if (errors > 0) {
  console.error(`\n❌ ${errors} error(s) found. Fix before seeding.\n`);
  process.exit(1);
} else {
  console.log("✅ All properties valid.\n");
}
