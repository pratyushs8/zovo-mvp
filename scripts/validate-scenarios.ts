/**
 * Day 6 scenario validation runner.
 *
 * Executes all test scenarios from scripts/scenarios.ts against the live
 * ranking engine and prints ranked results, score breakdowns, filter state,
 * and assertion pass/fail for each scenario.
 *
 * Usage:
 *   npm run validate:scenarios
 *   npm run validate:scenarios -- --scenario workation-canonical
 *   npm run validate:scenarios -- --category edge_case
 *   npm run validate:scenarios -- --breakdown
 *   npm run validate:scenarios -- --json
 *   npm run validate:scenarios -- --save
 *   npm run validate:scenarios -- --summary-only
 *
 * Flags:
 *   --scenario <id>        run a single scenario by id
 *   --category <cat>       run all scenarios in a category
 *                          (canonical | edge_case | destination_pinned | stress)
 *   --breakdown            show per-dimension score table for each result
 *   --top <n>              show top-N results per scenario  (default: 5)
 *   --json                 write JSON output to stdout instead of terminal text
 *   --save                 write JSON records to validation-runs/<id>-<ts>.json
 *   --summary-only         print only the summary table, skip per-scenario output
 */

import * as fs   from "fs";
import * as path from "path";

import { PROPERTIES }      from "@/config/properties";
import { WEIGHTS }         from "@/config/weights";
import { buildUserVector } from "@/lib/buildUserVector";
import { rankProperties }  from "@/lib/rankProperties";
import {
  WORKATION_USER_THRESHOLD,
  WORKATION_PROP_STRICT,
  WORKATION_PROP_RELAXED,
  HIGH_CONFIDENCE_THRESHOLD,
  LOW_CONFIDENCE_THRESHOLD,
  MAX_RESULTS,
} from "@/config/ranking";

import type { CandidateProperty, RankingPayload, RankedProperty } from "@/types/ranking";
import type { ScoringVector }                                      from "@/types";
import { SCENARIOS, type TestScenario, type ValidationRun, type ClassifiedResult } from "./scenarios";

// ─── ANSI helpers ─────────────────────────────────────────────────────────────

const R    = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM  = "\x1b[2m";
const CYN  = "\x1b[36m";
const YLW  = "\x1b[33m";
const GRN  = "\x1b[32m";
const RED  = "\x1b[31m";
const MGT  = "\x1b[35m";
const BLU  = "\x1b[34m";

function bar(value: number, width: number, filled = "█", empty = "░"): string {
  const n = Math.round(Math.max(0, Math.min(1, value)) * width);
  return filled.repeat(n).padEnd(width, empty);
}

// ─── Argument parsing ─────────────────────────────────────────────────────────

const args = process.argv.slice(2);

function flag(name: string): string | undefined {
  const i = args.indexOf(`--${name}`);
  return i !== -1 ? args[i + 1] : undefined;
}

function boolFlag(name: string): boolean {
  return args.includes(`--${name}`);
}

const filterScenario  = flag("scenario");
const filterCategory  = flag("category");
const showBreakdown   = boolFlag("breakdown");
const jsonMode        = boolFlag("json");
const saveMode        = boolFlag("save");
const summaryOnly     = boolFlag("summary-only");
const topN            = parseInt(flag("top") ?? String(MAX_RESULTS), 10);

// ─── Candidates (shared across all scenarios) ─────────────────────────────────

const CANDIDATES: CandidateProperty[] = PROPERTIES.map((p, i) => ({ ...p, id: i + 1 }));
const DIMS = ["social","calm","scenic","workation","adventure","budget_fit","room_type_fit"] as const;

// ─── Assertion checking ───────────────────────────────────────────────────────

interface AssertionResult {
  name:    string;
  pass:    boolean;
  detail:  string;
}

function checkAssertions(s: TestScenario, payload: RankingPayload): AssertionResult[] {
  const results: AssertionResult[] = [];

  if (s.expectInTopN) {
    const { names, n } = s.expectInTopN;
    const topSlice = payload.results.slice(0, n);
    const hit = topSlice.find((r) =>
      names.some((partial) => r.property.name.toLowerCase().includes(partial.toLowerCase()))
    );
    if (hit) {
      results.push({
        name:   "expectInTopN",
        pass:   true,
        detail: `"${hit.property.name}" matched at rank #${hit.rank} (top ${n})`,
      });
    } else {
      const actual = topSlice.map((r) => r.property.name.replace("Zostel ", "")).join(", ");
      results.push({
        name:   "expectInTopN",
        pass:   false,
        detail: `none of [${names.join(", ")}] in top ${n}. Got: ${actual}`,
      });
    }
  }

  if (s.expectTopResultDimensions) {
    const { n, dims } = s.expectTopResultDimensions;
    const topSlice = payload.results.slice(0, n);
    const failures: string[] = [];

    for (const r of topSlice) {
      for (const [dim, exp] of Object.entries(dims)) {
        const val = r.property.scoring[dim as keyof typeof r.property.scoring];
        if (exp.min !== undefined && val < exp.min) {
          failures.push(`#${r.rank} ${r.property.name.replace("Zostel ","")} ${dim}=${val.toFixed(2)} < min ${exp.min}`);
        }
        if (exp.max !== undefined && val > exp.max) {
          failures.push(`#${r.rank} ${r.property.name.replace("Zostel ","")} ${dim}=${val.toFixed(2)} > max ${exp.max}`);
        }
      }
    }

    if (failures.length === 0) {
      const dimStr = Object.entries(dims)
        .map(([d, e]) => `${d}${e.min !== undefined ? `≥${e.min}` : ""}${e.max !== undefined ? `≤${e.max}` : ""}`)
        .join(", ");
      results.push({ name: "topResultDims", pass: true, detail: `n=${n} [${dimStr}] all pass` });
    } else {
      results.push({
        name:   "topResultDims",
        pass:   false,
        detail: failures.join(" | "),
      });
    }
  }

  return results;
}

// ─── Build ValidationRun record ───────────────────────────────────────────────

function buildRun(s: TestScenario, payload: RankingPayload, assertions: AssertionResult[]): ValidationRun {
  const results: ClassifiedResult[] = payload.results.map((r) => ({
    rank:           r.rank,
    propertyName:   r.property.name,
    location:       r.property.location,
    score:          r.score,
    topMatchDims:   r.explanation.topMatches.map((m) => m.dim),
    topMissDims:    r.explanation.topMisses.map((m) => m.dim),
    classification: null,
    pmNote:         undefined,
  }));

  return {
    scenarioId:            s.id,
    runAt:                 new Date().toISOString(),
    results,
    fallback:              payload.fallback,
    confidence:            payload.confidence,
    hardFilteredCount:     payload.hardFilteredCount,
    poolSize:              payload.poolSize,
    overallClassification: null,
    issueType:             null,
  };
}

// ─── Terminal printer ─────────────────────────────────────────────────────────

function printScenario(
  s:          TestScenario,
  idx:        number,
  total:      number,
  payload:    RankingPayload,
  userVector: ScoringVector,
  assertions: AssertionResult[],
): void {
  const catColor: Record<string, string> = {
    canonical:          CYN,
    edge_case:          YLW,
    destination_pinned: MGT,
    stress:             RED,
  };
  const cc = catColor[s.category] ?? R;

  // ── Scenario header ──────────────────────────────────────────────────────
  console.log(`\n${BOLD}${CYN}${"═".repeat(60)}${R}`);
  console.log(`${BOLD}  Scenario ${idx}/${total}  ${cc}${s.category}${R}`);
  console.log(`${BOLD}  ${s.id}${R}`);
  console.log(`  ${DIM}${s.label}${R}`);
  console.log(`${BOLD}${CYN}${"═".repeat(60)}${R}`);

  // ── Request + user vector ────────────────────────────────────────────────
  const req = s.request;
  const destStr = req.destinationSlug ? `  dest=${YLW}${req.destinationSlug}${R}` : "";
  const budgetStr = req.budget ? `  budget=${req.budget}` : "";
  console.log(`\n  ${BOLD}Request${R}  persona=${YLW}${req.personaKey}${R}  priority=${req.priority}  energy=${req.socialEnergy}  room=${req.roomType}${budgetStr}${destStr}`);

  // Vector inline — key dimensions only to keep line width manageable
  const vParts = DIMS.map((d) => {
    const v = userVector[d];
    const hi = v >= 0.7;
    const lo = v <= 0.2;
    const col = hi ? BOLD : lo ? DIM : R;
    return `${DIM}${d.replace("_fit","").replace("room_type","room").replace("budget","bdg")}${R}=${col}${v.toFixed(1)}${R}`;
  });
  console.log(`  ${BOLD}Vector  ${R}${vParts.join("  ")}`);

  // ── Pipeline summary ─────────────────────────────────────────────────────
  const confColor = payload.confidence === "high" ? GRN : payload.confidence === "moderate" ? YLW : RED;
  const filterLine = payload.hardFilteredCount > 0
    ? `  ${RED}hardFiltered=${payload.hardFilteredCount}${R}${payload.rankingExplanation.relaxedModeUsed ? `  ${YLW}(relaxed)${R}` : ""}`
    : "";
  const fallbackLine = payload.fallback
    ? `  ${YLW}fallback=${payload.fallback}${R}`
    : "";
  console.log(`\n  ${BOLD}Pipeline${R}  pool=${payload.poolSize}${filterLine}  topScore=${GRN}${payload.topScore.toFixed(3)}${R}  confidence=${confColor}${payload.confidence}${R}${fallbackLine}`);

  // ── Results ──────────────────────────────────────────────────────────────
  const display = payload.results.slice(0, topN);

  if (display.length === 0) {
    console.log(`\n  ${RED}No results. All properties were filtered out.${R}`);
    if (payload.rankingExplanation.hardFilterTriggered) {
      console.log(`  ${YLW}Hard filter triggered${R}  workation threshold=${WORKATION_USER_THRESHOLD}  relaxed=${WORKATION_PROP_RELAXED}`);
    }
  } else {
    console.log();
    for (const r of display) {
      const p        = r.property;
      const flags    = [
        r.hardFilterExempted ? `${YLW}[relaxed-exempt]${R}` : "",
        r.lowConfidence      ? `${RED}[low-conf]${R}`        : "",
      ].filter(Boolean).join(" ");

      const scoreBar = bar(r.score, 32);
      console.log(`  ${BOLD}#${r.rank}${R}  ${BOLD}${p.name}${R}  ${DIM}${p.location}${R}  ${flags}`);
      console.log(`      score   ${GRN}${scoreBar}${R}  ${BOLD}${r.score.toFixed(3)}${R}`);

      const topM = r.explanation.topMatches.slice(0, 3)
        .map((m) => `${GRN}${m.dim}${R}+${m.contribution.toFixed(2)}`).join("  ");
      const topX = r.explanation.topMisses.slice(0, 2)
        .map((m) => `${RED}${m.dim}${R}Δ${m.gap.toFixed(2)}`).join("  ");
      const filter = r.explanation.filterTrace.hardFilterTriggered
        ? `  ${DIM}work=${r.explanation.filterTrace.workationScore.toFixed(2)} [${r.explanation.filterTrace.passMode}]${R}`
        : "";

      console.log(`      matches ${topM}${filter}`);
      if (topX) console.log(`      misses  ${topX}`);

      if (showBreakdown) {
        console.log(`      ${DIM}── breakdown ─────────────────────────────────────────────${R}`);
        for (const d of DIMS) {
          const bd       = r.breakdown[d];
          const dimBar   = bar(bd.contribution / WEIGHTS[d], 10);
          const gapCol   = bd.gap > 0.2 ? RED : DIM;
          const uCol     = bd.userValue >= 0.7 ? BOLD : bd.userValue <= 0.2 ? DIM : R;
          console.log(
            `      ${DIM}${d.padEnd(14)}${R} ${BLU}${dimBar}${R}  ` +
            `contrib=${bd.contribution.toFixed(3)}  ` +
            `u=${uCol}${bd.userValue.toFixed(2)}${R}  ` +
            `p=${bd.propertyValue.toFixed(2)}  ` +
            `${gapCol}gap=${bd.gap.toFixed(2)}${R}`,
          );
        }
      }

      console.log();
    }
  }

  // ── Assertions ───────────────────────────────────────────────────────────
  if (assertions.length > 0) {
    console.log(`  ${BOLD}Assertions${R}`);
    for (const a of assertions) {
      const icon = a.pass ? `${GRN}✓${R}` : `${RED}✗${R}`;
      console.log(`  ${icon}  ${a.name.padEnd(18)} ${a.pass ? DIM : RED}${a.detail}${R}`);
    }
  }

  // ── Review hints ─────────────────────────────────────────────────────────
  if (s.reviewNotes) {
    console.log(`\n  ${DIM}${BLU}note${R}  ${DIM}${s.reviewNotes}${R}`);
  }
}

// ─── Summary table ────────────────────────────────────────────────────────────

interface SummaryRow {
  id:         string;
  category:   string;
  topResult:  string;
  topScore:   number;
  fallback:   string | null;
  confidence: string;
  assertPass: boolean | null;
}

function printSummary(rows: SummaryRow[]): void {
  console.log(`\n${BOLD}${CYN}${"═".repeat(80)}${R}`);
  console.log(`${BOLD}  Summary  (${rows.length} scenarios)${R}`);
  console.log(`${CYN}${"═".repeat(80)}${R}\n`);

  const catPad  = 20;
  const idPad   = 36;
  const namePad = 32;

  console.log(
    `  ${DIM}${"CATEGORY".padEnd(catPad)}  ${"SCENARIO".padEnd(idPad)}  ${"TOP RESULT".padEnd(namePad)}  SCORE   CONF     STATUS${R}`
  );
  console.log(`  ${DIM}${"─".repeat(catPad)}  ${"─".repeat(idPad)}  ${"─".repeat(namePad)}  ──────  ───────  ──────${R}`);

  const catColor: Record<string, string> = {
    canonical:          CYN,
    edge_case:          YLW,
    destination_pinned: MGT,
    stress:             RED,
  };

  for (const row of rows) {
    const cc         = catColor[row.category] ?? R;
    const confColor  = row.confidence === "high" ? GRN : row.confidence === "moderate" ? YLW : RED;
    const statusIcon =
      row.assertPass === null ? `${DIM}—${R}` :
      row.assertPass          ? `${GRN}✓ pass${R}` :
                                `${RED}✗ FAIL${R}`;
    const fallbackStr = row.fallback ? `${YLW}${row.fallback}${R}` : `${DIM}none${R}`;

    console.log(
      `  ${cc}${row.category.padEnd(catPad)}${R}  ` +
      `${row.id.padEnd(idPad)}  ` +
      `${row.topResult.padEnd(namePad)}  ` +
      `${GRN}${row.topScore.toFixed(3)}${R}  ` +
      `${confColor}${row.confidence.padEnd(8)}${R}  ` +
      `${statusIcon}  ${fallbackStr}`,
    );
  }

  const passes  = rows.filter((r) => r.assertPass === true).length;
  const fails   = rows.filter((r) => r.assertPass === false).length;
  const noAssert = rows.filter((r) => r.assertPass === null).length;

  console.log(`\n  Assertions: ${GRN}${passes} pass${R}  ${fails > 0 ? RED : DIM}${fails} fail${R}  ${DIM}${noAssert} no assertions${R}`);
  console.log();
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const selected = SCENARIOS.filter((s) => {
  if (filterScenario)  return s.id === filterScenario;
  if (filterCategory)  return s.category === filterCategory;
  return true;
});

if (selected.length === 0) {
  const hint = filterScenario
    ? `No scenario with id "${filterScenario}". Available: ${SCENARIOS.map((s) => s.id).join(", ")}`
    : `No scenarios in category "${filterCategory}". Valid: canonical | edge_case | destination_pinned | stress`;
  console.error(`\n${RED}${hint}${R}\n`);
  process.exit(1);
}

interface RunRecord {
  scenario:   TestScenario;
  run:        ValidationRun;
  payload:    RankingPayload;
  userVector: ScoringVector;
  assertions: AssertionResult[];
}

const records:     RunRecord[]   = [];
const allRuns:     ValidationRun[] = [];
const summaryRows: SummaryRow[]   = [];

for (let i = 0; i < selected.length; i++) {
  const s   = selected[i];
  const req = {
    sessionId:    "validate",
    personaKey:   s.request.personaKey,
    priority:     s.request.priority,
    socialEnergy: s.request.socialEnergy,
    roomType:     s.request.roomType,
    budget:       s.request.budget,
  };

  const userVector = buildUserVector(req);
  const payload    = rankProperties(
    { userVector, destinationSlug: s.request.destinationSlug },
    CANDIDATES,
  );

  const assertions = checkAssertions(s, payload);
  const run        = buildRun(s, payload, assertions);
  records.push({ scenario: s, run, payload, userVector, assertions });
  allRuns.push(run);

  const topResult  = payload.results[0]?.property.name.replace("Zostel ", "") ?? "(none)";
  const assertPass = assertions.length === 0 ? null : assertions.every((a) => a.pass);

  summaryRows.push({
    id:         s.id,
    category:   s.category,
    topResult:  topResult.slice(0, 30),
    topScore:   payload.topScore,
    fallback:   payload.fallback,
    confidence: payload.confidence,
    assertPass,
  });

  if (!jsonMode && !summaryOnly) {
    printScenario(s, i + 1, selected.length, payload, userVector, assertions);
  }

  // Save individual JSON record if --save
  if (saveMode) {
    const dir = path.join(process.cwd(), "validation-runs");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const ts   = new Date().toISOString().replace(/[:.]/g, "-");
    const file = path.join(dir, `${s.id}-${ts}.json`);
    fs.writeFileSync(file, JSON.stringify({ scenario: s, run }, null, 2));
  }
}

// ── Summary ────────────────────────────────────────────────────────────────

if (jsonMode) {
  // Emit full JSON array — pipe to jq, save to file, or diff against a prior run.
  console.log(JSON.stringify(
    records.map(({ scenario, run, assertions }) => ({ scenario, run, assertions })),
    null, 2,
  ));
} else {
  printSummary(summaryRows);
}

if (saveMode) {
  const dir = path.join(process.cwd(), "validation-runs");
  const allFile = path.join(dir, `all-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(allFile, JSON.stringify({ runAt: new Date().toISOString(), scenarios: allRuns }, null, 2));
  console.log(`${DIM}JSON saved → ${allFile}${R}\n`);
}
