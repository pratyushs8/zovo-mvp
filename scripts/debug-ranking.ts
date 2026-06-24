/**
 * Local debug runner for Ranking Engine v1.
 *
 * Usage:
 *   npx tsx --tsconfig tsconfig.json scripts/debug-ranking.ts
 *   npx tsx --tsconfig tsconfig.json scripts/debug-ranking.ts --persona workation --priority work_setup
 *   npx tsx --tsconfig tsconfig.json scripts/debug-ranking.ts --destination goa
 *   npx tsx --tsconfig tsconfig.json scripts/debug-ranking.ts --list-personas
 *
 * Flags:
 *   --persona   <PersonaKey>      default: solo_social
 *   --priority  <StayPriority>    default: social_vibe
 *   --energy    <SocialEnergy>    default: balanced
 *   --room      <RoomType>        default: flexible
 *   --budget    <BudgetLevel>     (optional)
 *   --destination <slug>          restricts pool to one destination
 *   --top       <n>               print top-N results  (default: 5)
 *   --breakdown                   show per-dimension score breakdown
 *   --list-personas               list all valid persona keys and exit
 *   --list-destinations           list all destination slugs and exit
 */

import { PROPERTIES }    from "@/config/properties";
import { PERSONAS }      from "@/config/personas";
import { buildUserVector } from "@/lib/buildUserVector";
import { rankProperties }  from "@/lib/rankProperties";
import { WEIGHTS }         from "@/config/weights";
import {
  WORKATION_USER_THRESHOLD,
  WORKATION_PROP_STRICT,
  WORKATION_PROP_RELAXED,
  HIGH_CONFIDENCE_THRESHOLD,
  LOW_CONFIDENCE_THRESHOLD,
  MAX_RESULTS,
} from "@/config/ranking";
import type { PersonaKey, StayPriority, SocialEnergy, RoomType, BudgetLevel } from "@/types";
import type { CandidateProperty } from "@/types/ranking";

// ─── Argument parsing ─────────────────────────────────────────────────────────

const args = process.argv.slice(2);

function flag(name: string): string | undefined {
  const i = args.indexOf(`--${name}`);
  return i !== -1 ? args[i + 1] : undefined;
}

function boolFlag(name: string): boolean {
  return args.includes(`--${name}`);
}

// ─── --list-personas ──────────────────────────────────────────────────────────

if (boolFlag("list-personas")) {
  console.log("\nAvailable personas:\n");
  for (const [key, persona] of Object.entries(PERSONAS)) {
    const v = persona.scoring;
    console.log(`  ${key.padEnd(18)} social:${v.social} calm:${v.calm} workation:${v.workation} adventure:${v.adventure}`);
  }
  console.log();
  process.exit(0);
}

// ─── --list-destinations ──────────────────────────────────────────────────────

if (boolFlag("list-destinations")) {
  const slugs = [...new Set(PROPERTIES.map((p) => p.destinationSlug))].sort();
  console.log("\nAvailable destination slugs:\n");
  for (const slug of slugs) {
    const count = PROPERTIES.filter((p) => p.destinationSlug === slug).length;
    console.log(`  ${slug.padEnd(30)} (${count} propert${count === 1 ? "y" : "ies"})`);
  }
  console.log();
  process.exit(0);
}

// ─── Build request ────────────────────────────────────────────────────────────

const personaKey    = (flag("persona")     ?? "solo_social")  as PersonaKey;
const priority      = (flag("priority")    ?? "social_vibe")  as StayPriority;
const socialEnergy  = (flag("energy")      ?? "balanced")     as SocialEnergy;
const roomType      = (flag("room")        ?? "flexible")     as RoomType;
const budgetRaw     =  flag("budget");
const budget        = budgetRaw ? (budgetRaw as BudgetLevel) : undefined;
const destination   =  flag("destination");
const topN          = parseInt(flag("top") ?? String(MAX_RESULTS), 10);
const showBreakdown =  boolFlag("breakdown");

if (!(personaKey in PERSONAS)) {
  console.error(`\nUnknown persona "${personaKey}". Run with --list-personas to see valid keys.\n`);
  process.exit(1);
}

const req = { sessionId: "debug", personaKey, priority, socialEnergy, roomType, budget };

// ─── Run ranking ──────────────────────────────────────────────────────────────

const userVector = buildUserVector(req);

// Attach synthetic ids (1-based index) — the DB is not involved here.
const candidates: CandidateProperty[] = PROPERTIES.map((p, i) => ({ ...p, id: i + 1 }));

const payload = rankProperties({ userVector, destinationSlug: destination }, candidates);

// ─── Print config header ──────────────────────────────────────────────────────

const RESET  = "\x1b[0m";
const BOLD   = "\x1b[1m";
const DIM    = "\x1b[2m";
const CYAN   = "\x1b[36m";
const YELLOW = "\x1b[33m";
const GREEN  = "\x1b[32m";
const RED    = "\x1b[31m";
const BLUE   = "\x1b[34m";

console.log(`\n${BOLD}${CYAN}═══════════════════════════════════════════════════════${RESET}`);
console.log(`${BOLD}  ZoCo Ranking Engine v1 — Debug Run${RESET}`);
console.log(`${CYAN}═══════════════════════════════════════════════════════${RESET}\n`);

console.log(`${BOLD}Request${RESET}`);
console.log(`  persona:    ${YELLOW}${personaKey}${RESET}`);
console.log(`  priority:   ${priority}`);
console.log(`  energy:     ${socialEnergy}`);
console.log(`  room:       ${roomType}`);
if (budget)      console.log(`  budget:     ${budget}`);
if (destination) console.log(`  destination:${YELLOW} ${destination}${RESET}`);

console.log(`\n${BOLD}User vector${RESET} ${DIM}(post-override)${RESET}`);
const dims = ["social","calm","scenic","workation","adventure","budget_fit","room_type_fit"] as const;
for (const d of dims) {
  const v   = userVector[d];
  const bar = "█".repeat(Math.round(v * 20)).padEnd(20, "░");
  console.log(`  ${d.padEnd(14)} ${bar}  ${v.toFixed(2)}`);
}

console.log(`\n${BOLD}Active weights${RESET} ${DIM}(src/config/weights.ts)${RESET}`);
for (const d of dims) {
  console.log(`  ${d.padEnd(14)} ${WEIGHTS[d].toFixed(2)}`);
}

console.log(`\n${BOLD}Active thresholds${RESET} ${DIM}(src/config/ranking.ts)${RESET}`);
console.log(`  workation filter  user≥${WORKATION_USER_THRESHOLD} → prop≤${WORKATION_PROP_STRICT} excluded (relaxed:${WORKATION_PROP_RELAXED})`);
console.log(`  confidence        high≥${HIGH_CONFIDENCE_THRESHOLD}  moderate≥${LOW_CONFIDENCE_THRESHOLD}  low<${LOW_CONFIDENCE_THRESHOLD}`);
console.log(`  pool→results      all ${candidates.length} properties → top ${MAX_RESULTS} returned`);

// ─── Print pipeline summary ───────────────────────────────────────────────────

console.log(`\n${BOLD}Pipeline summary${RESET}`);
console.log(`  candidate pool  : ${candidates.length} properties`);
if (destination) {
  const inDest = candidates.filter((c) => c.destinationSlug === destination).length;
  console.log(`  destination filter: ${inDest} in "${destination}"`);
}
console.log(`  hard filter     : ${payload.hardFilteredCount} removed${payload.rankingExplanation.relaxedModeUsed ? `  ${YELLOW}(relaxed mode activated)${RESET}` : ""}`);
console.log(`  survivors       : ${payload.poolSize}`);
console.log(`  top score       : ${payload.topScore.toFixed(3)}`);

const confColor = payload.confidence === "high" ? GREEN : payload.confidence === "moderate" ? YELLOW : RED;
console.log(`  confidence      : ${confColor}${payload.confidence}${RESET}  ${DIM}(reason: ${payload.rankingExplanation.confidenceReason})${RESET}`);
if (payload.fallback) {
  console.log(`  fallback mode   : ${YELLOW}${payload.fallback}${RESET}`);
}

// ─── Print results ────────────────────────────────────────────────────────────

const displayResults = payload.results.slice(0, topN);

console.log(`\n${BOLD}${CYAN}Top ${displayResults.length} results${RESET}\n`);

for (const r of displayResults) {
  const p         = r.property;
  const rankLabel = `${BOLD}#${r.rank}${RESET}`;
  const scoreBar  = "█".repeat(Math.round(r.score * 40)).padEnd(40, "░");
  const flags     = [
    r.hardFilterExempted ? `${YELLOW}[relaxed-exempt]${RESET}` : "",
    r.lowConfidence      ? `${RED}[low-confidence]${RESET}`    : "",
  ].filter(Boolean).join(" ");

  console.log(`  ${rankLabel}  ${BOLD}${p.name}${RESET}  ${DIM}${p.location}${RESET}  ${flags}`);
  console.log(`      score  ${scoreBar}  ${GREEN}${r.score.toFixed(3)}${RESET}`);

  // Top 2 matches and top 2 misses inline.
  const topM = r.explanation.topMatches.slice(0, 2)
    .map((m) => `${m.dim}+${m.contribution.toFixed(2)}`).join("  ");
  const topX = r.explanation.topMisses.slice(0, 2)
    .map((m) => `${m.dim}Δ${m.gap.toFixed(2)}`).join("  ");
  if (topM) console.log(`      ${GREEN}matches${RESET}  ${topM}`);
  if (topX) console.log(`      ${RED}misses${RESET}   ${topX}`);

  if (showBreakdown) {
    console.log(`      ${DIM}── breakdown ──────────────────────────────────────────${RESET}`);
    for (const d of dims) {
      const bd   = r.breakdown[d];
      const bar  = "█".repeat(Math.round(bd.contribution / WEIGHTS[d] * 10)).padEnd(10, "░");
      const gapStr = bd.gap > 0.2 ? `${RED}gap:${bd.gap.toFixed(2)}${RESET}` : `gap:${bd.gap.toFixed(2)}`;
      console.log(`      ${DIM}${d.padEnd(14)}${RESET} ${bar}  contrib:${bd.contribution.toFixed(3)}  u:${bd.userValue.toFixed(2)}  p:${bd.propertyValue.toFixed(2)}  ${gapStr}`);
    }
  }

  console.log();
}

if (payload.results.length === 0) {
  console.log(`  ${RED}No results.${RESET} All properties were filtered out.\n`);
  if (payload.rankingExplanation.hardFilterTriggered) {
    console.log(`  ${YELLOW}Hard filter triggered${RESET} (user workation=${userVector.workation.toFixed(2)} ≥ ${WORKATION_USER_THRESHOLD}).`);
    console.log(`  All ${payload.hardFilteredCount} properties had workation ≤ ${WORKATION_PROP_RELAXED} (relaxed threshold).\n`);
  }
}

console.log(`${DIM}Run with --breakdown for per-dimension detail, --list-personas to browse personas.${RESET}\n`);
