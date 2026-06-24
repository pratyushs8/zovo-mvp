/**
 * Consistency checks for scripts/property-patches.ts.
 *
 * Verifies the decision log is internally coherent:
 *   1. Every patch references a property that exists in properties.json.
 *   2. Every patch has a non-empty reason.
 *   3. No exact duplicate (property × field × appliedDate) entries.
 *
 * Does NOT verify that `to` values match the current properties.json — the
 * JSON may have been updated in a subsequent pass. Use `git diff` to see
 * what actually changed in properties.json.
 *
 * Usage:
 *   npm run patch:check
 */

import { PROPERTIES } from "@/config/properties";
import { PATCHES } from "./property-patches";

const R = "\x1b[0m";
const BOLD = "\x1b[1m";
const RED = "\x1b[31m";
const GRN = "\x1b[32m";
const CYN = "\x1b[36m";
const DIM = "\x1b[2m";

function main(): void {
  const errors: string[] = [];
  const warnings: string[] = [];

  const propertyNames = new Set(PROPERTIES.map((p) => p.name));
  const seen = new Set<string>();

  for (let i = 0; i < PATCHES.length; i++) {
    const patch = PATCHES[i];
    const label = `PATCHES[${i}] (${patch.property} · ${patch.field})`;

    // 1. Property must exist
    if (!propertyNames.has(patch.property)) {
      errors.push(`${label}: property "${patch.property}" not found in properties.json`);
    }

    // 2. Reason must be non-empty
    if (!patch.reason?.trim()) {
      errors.push(`${label}: reason is empty — every patch must explain why the change was made`);
    }

    // 3. appliedDate must be a plausible ISO date
    if (!/^\d{4}-\d{2}-\d{2}$/.test(patch.appliedDate ?? "")) {
      warnings.push(`${label}: appliedDate "${patch.appliedDate}" is not in YYYY-MM-DD format`);
    }

    // 4. No exact duplicate entries
    const key = `${patch.property}::${patch.field}::${patch.appliedDate}`;
    if (seen.has(key)) {
      warnings.push(
        `${label}: duplicate entry for same property + field + date — consider consolidating`
      );
    }
    seen.add(key);
  }

  console.log();
  console.log(`${BOLD}${CYN}${"═".repeat(60)}${R}`);
  console.log(`${BOLD}  Patch log check  (${PATCHES.length} entries)${R}`);
  console.log(`${BOLD}${CYN}${"═".repeat(60)}${R}`);
  console.log();

  if (errors.length === 0 && warnings.length === 0) {
    console.log(`${GRN}  ✓  All ${PATCHES.length} patch entries are valid.${R}`);
    console.log();

    // Print a summary of patches by property
    const byProperty = new Map<string, number>();
    for (const p of PATCHES) {
      byProperty.set(p.property, (byProperty.get(p.property) ?? 0) + 1);
    }
    console.log(`  ${DIM}Properties with recorded patches:${R}`);
    for (const [name, count] of [...byProperty.entries()].sort()) {
      console.log(
        `    ${name.replace("Zostel ", "")}  ${DIM}(${count} change${count > 1 ? "s" : ""})${R}`
      );
    }
    console.log();
    process.exit(0);
  }

  if (errors.length > 0) {
    console.log(`${RED}  Errors:${R}`);
    for (const e of errors) console.log(`    ${RED}✗${R}  ${e}`);
    console.log();
  }

  if (warnings.length > 0) {
    console.log(`  Warnings:`);
    for (const w of warnings) console.log(`    ⚠  ${w}`);
    console.log();
  }

  process.exit(errors.length > 0 ? 1 : 0);
}

main();
