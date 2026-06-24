/**
 * Day 6 property metadata quality audit.
 *
 * Identifies scoring and tagging issues that reduce ranking effectiveness:
 * placeholder values, archetype mismatches, tag/score gaps, and more.
 * Run this before a metadata-editing session to know where to focus.
 *
 * Usage:
 *   npm run audit:properties
 *   npm run audit:properties -- --property "Zostel Pondicherry (Auroville Road)"
 *   npm run audit:properties -- --flag placeholder_values
 *   npm run audit:properties -- --severity high
 *   npm run audit:properties -- --json
 *
 * Flags:
 *   --property <name>    audit a single property by exact name
 *   --flag <type>        filter to one flag type
 *   --severity <level>   filter to high | medium | low
 *   --json               output JSON instead of terminal text
 */

import * as path from "path";
import * as fs   from "fs";
import { PROPERTIES } from "@/config/properties";
import { DIMENSION_KEYS } from "@/config/scoring";
import type { DimensionKey } from "@/config/scoring";
import type { PropertySeed, Archetype } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AuditFlag =
  | "placeholder_values"
  | "low_differentiation"
  | "archetype_mismatch"
  | "tag_score_gap"
  | "workation_limbo"
  | "price_tag_mismatch";

export type Severity = "high" | "medium" | "low";

export interface AuditIssue {
  flag:       AuditFlag;
  severity:   Severity;
  message:    string;
  suggestion: string;
}

export interface AuditResult {
  property: string;
  archetype: string;
  issues: AuditIssue[];
}

// ─── Archetype expected score ranges ─────────────────────────────────────────
// Each entry lists the dimensions where the archetype makes a strong prediction.
// Violations are flagged as archetype_mismatch.

interface ArchetypeRule {
  dim: DimensionKey;
  min?: number;
  max?: number;
  severity: Severity;
  rationale: string;
}

const ARCHETYPE_RULES: Record<Archetype, ArchetypeRule[]> = {
  beach_social: [
    { dim: "social",    min: 0.6, severity: "high",   rationale: "beach hostels derive their value from social atmosphere" },
    { dim: "adventure", min: 0.5, severity: "medium", rationale: "water sports, beach activities" },
  ],
  mountain_adventure_hub: [
    { dim: "adventure", min: 0.6, severity: "high",   rationale: "the archetype's primary value proposition" },
    { dim: "scenic",    min: 0.7, severity: "medium", rationale: "mountain views expected" },
  ],
  remote_mountain_quiet: [
    { dim: "calm",      min: 0.7, severity: "high",   rationale: "remoteness and quiet are the defining traits" },
    { dim: "scenic",    min: 0.7, severity: "medium", rationale: "remote mountain locations are scenic by nature" },
    { dim: "social",    max: 0.5, severity: "medium", rationale: "remote quiet properties shouldn't feel social" },
  ],
  cultural_hill_town: [
    { dim: "scenic",    min: 0.6, severity: "medium", rationale: "hill towns are generally scenic" },
    { dim: "calm",      min: 0.5, severity: "low",    rationale: "cultural towns are calmer than beach/city" },
  ],
  heritage_cultural_city: [
    { dim: "budget_fit", min: 0.4, severity: "low",   rationale: "heritage cities typically offer budget-friendly options" },
  ],
  urban_metro: [
    { dim: "workation", min: 0.5, severity: "high",   rationale: "urban metros should have reliable work infrastructure" },
    { dim: "scenic",    max: 0.5, severity: "medium", rationale: "metro properties are not primarily scenic" },
  ],
  nature_retreat: [
    { dim: "scenic",    min: 0.7, severity: "high",   rationale: "nature settings define the archetype" },
    { dim: "calm",      min: 0.6, severity: "medium", rationale: "retreats should feel peaceful" },
  ],
};

// ─── Tag → scoring implications ───────────────────────────────────────────────
// A tag implies that a certain dimension should be above a floor value.
// Used to catch "has the tag, missing the score" and vice versa.

interface TagImplication {
  dim:       DimensionKey;
  minScore?: number;
  maxScore?: number;
  severity:  Severity;
}

const TAG_IMPLICATIONS: Record<string, TagImplication[]> = {
  trekking:     [{ dim: "adventure", minScore: 0.5, severity: "medium" }],
  rafting:      [{ dim: "adventure", minScore: 0.6, severity: "medium" }],
  adventure:    [{ dim: "adventure", minScore: 0.5, severity: "medium" }],
  paragliding:  [{ dim: "adventure", minScore: 0.6, severity: "medium" }],
  diving:       [{ dim: "adventure", minScore: 0.6, severity: "medium" }],
  cycling:      [{ dim: "adventure", minScore: 0.4, severity: "low"    }],
  social:       [{ dim: "social",    minScore: 0.5, severity: "medium" }],
  party:        [{ dim: "social",    minScore: 0.7, severity: "high"   }],
  quiet:        [{ dim: "calm",      minScore: 0.6, severity: "medium" }],
  workation:    [{ dim: "workation", minScore: 0.5, severity: "high"   }],
  // room_type_fit thresholds are wide: all properties carry both room types,
  // so the dimension measures atmosphere character, not room availability.
  // Only flag egregious mismatches (>0.7 for a dorm-tagged property, <0.3 for private).
  private:      [{ dim: "room_type_fit", minScore: 0.3, severity: "low"    }],
  dorm:         [{ dim: "room_type_fit", maxScore: 0.7, severity: "medium" }],
  budget:       [{ dim: "budget_fit",    minScore: 0.5, severity: "medium" }],
};

// ─── Audit logic ──────────────────────────────────────────────────────────────

function auditProperty(p: PropertySeed): AuditIssue[] {
  const issues: AuditIssue[] = [];
  const s = p.scoring;

  // 1. Placeholder values — 3+ dimensions at exactly 0.5
  const halfDims = DIMENSION_KEYS.filter((d) => s[d] === 0.5);
  if (halfDims.length >= 3) {
    issues.push({
      flag:       "placeholder_values",
      severity:   halfDims.length >= 4 ? "high" : "medium",
      message:    `${halfDims.length} dimensions set to exactly 0.5: ${halfDims.join(", ")}`,
      suggestion: `Research actual property conditions and replace 0.5 placeholders with real values. ` +
                  `Use 0.3/0.7 for moderate low/high rather than 0.5.`,
    });
  }

  // 2. Low differentiation — all dimension values within a narrow band
  const vals = DIMENSION_KEYS.map((d) => s[d]);
  const spread = Math.max(...vals) - Math.min(...vals);
  if (spread < 0.4) {
    issues.push({
      flag:       "low_differentiation",
      severity:   "medium",
      message:    `Dimension spread of ${spread.toFixed(2)} — all scores between ${Math.min(...vals)} and ${Math.max(...vals)}.`,
      suggestion: `A well-tagged property should have at least one dimension ≥ 0.7 and at least one ≤ 0.3. ` +
                  `Identify what this property does NOT offer and lower those scores.`,
    });
  }

  // 3. Archetype-score consistency
  const rules = ARCHETYPE_RULES[p.archetype] ?? [];
  for (const rule of rules) {
    const val = s[rule.dim];
    if (rule.min !== undefined && val < rule.min) {
      issues.push({
        flag:       "archetype_mismatch",
        severity:   rule.severity,
        message:    `Archetype "${p.archetype}" expects ${rule.dim} ≥ ${rule.min}, got ${val}. Reason: ${rule.rationale}.`,
        suggestion: `Either raise ${rule.dim} to ≥ ${rule.min}, or reconsider the archetype assignment.`,
      });
    }
    if (rule.max !== undefined && val > rule.max) {
      issues.push({
        flag:       "archetype_mismatch",
        severity:   rule.severity,
        message:    `Archetype "${p.archetype}" expects ${rule.dim} ≤ ${rule.max}, got ${val}. Reason: ${rule.rationale}.`,
        suggestion: `Either lower ${rule.dim} to ≤ ${rule.max}, or reconsider the archetype assignment.`,
      });
    }
  }

  // 4. Tag ↔ score gaps
  for (const tag of p.tags) {
    const implications = TAG_IMPLICATIONS[tag];
    if (!implications) continue;
    for (const impl of implications) {
      const val = s[impl.dim];
      if (impl.minScore !== undefined && val < impl.minScore) {
        issues.push({
          flag:       "tag_score_gap",
          severity:   impl.severity,
          message:    `Tag "${tag}" implies ${impl.dim} ≥ ${impl.minScore}, but scored ${val}.`,
          suggestion: `Either raise ${impl.dim} to ≥ ${impl.minScore} if the tag is accurate, or remove the "${tag}" tag.`,
        });
      }
      if (impl.maxScore !== undefined && val > impl.maxScore) {
        issues.push({
          flag:       "tag_score_gap",
          severity:   impl.severity,
          message:    `Tag "${tag}" implies ${impl.dim} ≤ ${impl.maxScore}, but scored ${val}.`,
          suggestion: `Either lower ${impl.dim} to ≤ ${impl.maxScore} if the tag is accurate, or remove the "${tag}" tag.`,
        });
      }
    }
  }

  // 5. Workation limbo — above 0 but fails even the relaxed filter (≤ 0.1)
  // These properties have a nominal workation score but are invisible to workation users.
  if (s.workation > 0.0 && s.workation <= 0.1) {
    issues.push({
      flag:       "workation_limbo",
      severity:   "low",
      message:    `workation = ${s.workation}: above 0 but excluded by both strict (>0.2) and relaxed (>0.1) filters.`,
      suggestion: `Set to 0.0 if no work infrastructure exists, or raise to ≥ 0.2 if basic wifi is available.`,
    });
  }

  // 6. Price ↔ budget_fit mismatch
  // Expensive properties (priceInr > 1500/night) tagged as budget-friendly are misleading.
  if (p.priceInr > 1500 && s.budget_fit >= 0.7) {
    issues.push({
      flag:       "price_tag_mismatch",
      severity:   "medium",
      message:    `priceInr = ₹${p.priceInr} but budget_fit = ${s.budget_fit}. High price contradicts budget-friendly tag.`,
      suggestion: `Lower budget_fit to ≤ 0.4 for properties priced above ₹1500/night.`,
    });
  }
  // Cheap properties (priceInr < 500) with low budget_fit are also suspicious.
  if (p.priceInr < 500 && s.budget_fit < 0.4) {
    issues.push({
      flag:       "price_tag_mismatch",
      severity:   "low",
      message:    `priceInr = ₹${p.priceInr} but budget_fit = ${s.budget_fit}. Cheap property not rewarded with budget_fit score.`,
      suggestion: `Raise budget_fit to ≥ 0.6 for properties priced below ₹500/night.`,
    });
  }

  return issues;
}

// ─── Terminal output ──────────────────────────────────────────────────────────

const R    = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM  = "\x1b[2m";
const RED  = "\x1b[31m";
const YLW  = "\x1b[33m";
const GRN  = "\x1b[32m";
const CYN  = "\x1b[36m";

const SEV_COLOR: Record<Severity, string> = {
  high:   RED,
  medium: YLW,
  low:    DIM,
};

const SEV_ICON: Record<Severity, string> = {
  high:   "●",
  medium: "◉",
  low:    "○",
};

function printResult(r: AuditResult, showBreakdown: boolean): void {
  if (r.issues.length === 0) {
    if (showBreakdown) {
      console.log(`${GRN}✓${R}  ${r.property}`);
    }
    return;
  }

  const highCount   = r.issues.filter((i) => i.severity === "high").length;
  const mediumCount = r.issues.filter((i) => i.severity === "medium").length;
  const lowCount    = r.issues.filter((i) => i.severity === "low").length;
  const sevSummary  = [
    highCount   ? `${RED}${highCount} high${R}`     : "",
    mediumCount ? `${YLW}${mediumCount} medium${R}` : "",
    lowCount    ? `${DIM}${lowCount} low${R}`        : "",
  ].filter(Boolean).join("  ");

  console.log(`${BOLD}${r.property}${R}  ${DIM}${r.archetype}${R}`);
  console.log(`  ${sevSummary}`);

  for (const issue of r.issues) {
    const color = SEV_COLOR[issue.severity];
    const icon  = SEV_ICON[issue.severity];
    console.log(`  ${color}${icon}${R}  ${DIM}${issue.flag}${R}  ${issue.message}`);
    console.log(`     ${DIM}→ ${issue.suggestion}${R}`);
  }
  console.log();
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main(): void {
  const args = process.argv.slice(2);

  const propertyFilter = args.includes("--property")
    ? args[args.indexOf("--property") + 1]
    : null;
  const flagFilter = args.includes("--flag")
    ? (args[args.indexOf("--flag") + 1] as AuditFlag)
    : null;
  const severityFilter = args.includes("--severity")
    ? (args[args.indexOf("--severity") + 1] as Severity)
    : null;
  const jsonMode   = args.includes("--json");
  const quietMode  = args.includes("--quiet");

  let properties = PROPERTIES as PropertySeed[];
  if (propertyFilter) {
    properties = properties.filter((p) =>
      p.name.toLowerCase().includes(propertyFilter.toLowerCase()),
    );
    if (properties.length === 0) {
      console.error(`No property matching "${propertyFilter}"`);
      process.exit(1);
    }
  }

  let results: AuditResult[] = properties.map((p) => ({
    property: p.name,
    archetype: p.archetype,
    issues:   auditProperty(p),
  }));

  if (flagFilter) {
    results = results.map((r) => ({
      ...r,
      issues: r.issues.filter((i) => i.flag === flagFilter),
    }));
  }
  if (severityFilter) {
    results = results.map((r) => ({
      ...r,
      issues: r.issues.filter((i) => i.severity === severityFilter),
    }));
  }

  // JSON output
  if (jsonMode) {
    const filtered = results.filter((r) => r.issues.length > 0);
    process.stdout.write(JSON.stringify(filtered, null, 2) + "\n");
    return;
  }

  // ── Terminal output ──────────────────────────────────────────────────────
  const flagged  = results.filter((r) => r.issues.length > 0);
  const clean    = results.filter((r) => r.issues.length === 0);
  const highCount   = flagged.flatMap((r) => r.issues).filter((i) => i.severity === "high").length;
  const mediumCount = flagged.flatMap((r) => r.issues).filter((i) => i.severity === "medium").length;
  const lowCount    = flagged.flatMap((r) => r.issues).filter((i) => i.severity === "low").length;

  console.log();
  console.log(`${BOLD}${CYN}${"═".repeat(72)}${R}`);
  console.log(`${BOLD}  Property Metadata Audit  (${properties.length} properties)${R}`);
  console.log(`${BOLD}${CYN}${"═".repeat(72)}${R}`);
  console.log();

  // Sort: high severity first, then medium, then low
  const sorted = [...flagged].sort((a, b) => {
    const sevScore = (r: AuditResult) =>
      r.issues.filter((i) => i.severity === "high").length * 100 +
      r.issues.filter((i) => i.severity === "medium").length * 10 +
      r.issues.filter((i) => i.severity === "low").length;
    return sevScore(b) - sevScore(a);
  });

  for (const r of sorted) {
    printResult(r, false);
  }

  if (clean.length > 0 && !quietMode) {
    console.log(`${GRN}✓  ${clean.length} propert${clean.length === 1 ? "y" : "ies"} with no issues${R}`);
    console.log();
  }

  // Summary table
  console.log(`${BOLD}${CYN}${"─".repeat(72)}${R}`);
  console.log(`${BOLD}  Summary${R}`);
  console.log(`${BOLD}${CYN}${"─".repeat(72)}${R}`);
  console.log();
  console.log(`  ${DIM}Properties audited  ${R}  ${properties.length}`);
  console.log(`  ${DIM}Properties flagged  ${R}  ${flagged.length}`);
  console.log(`  ${DIM}Properties clean    ${R}  ${clean.length}`);
  console.log();

  if (highCount + mediumCount + lowCount > 0) {
    console.log(`  Issues by severity:`);
    if (highCount)   console.log(`    ${RED}●  high   ${R}  ${highCount}`);
    if (mediumCount) console.log(`    ${YLW}◉  medium ${R}  ${mediumCount}`);
    if (lowCount)    console.log(`    ${DIM}○  low    ${R}  ${lowCount}`);
    console.log();
  }

  // Flag distribution
  const flagCounts: Partial<Record<AuditFlag, number>> = {};
  for (const r of flagged) {
    for (const i of r.issues) {
      flagCounts[i.flag] = (flagCounts[i.flag] ?? 0) + 1;
    }
  }
  if (Object.keys(flagCounts).length > 0) {
    console.log(`  Issues by flag type:`);
    for (const [flag, count] of Object.entries(flagCounts).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))) {
      console.log(`    ${DIM}${flag.padEnd(24)}${R}  ${count}`);
    }
    console.log();
  }

  const exitCode = highCount > 0 ? 1 : 0;
  if (exitCode === 0 && highCount + mediumCount === 0) {
    console.log(`${GRN}  No issues requiring attention.${R}`);
    console.log();
  } else if (exitCode === 1) {
    console.log(`${RED}  ${highCount} high-severity issue${highCount !== 1 ? "s" : ""} require attention before the next ranking run.${R}`);
    console.log();
  }

  process.exit(exitCode);
}

main();
