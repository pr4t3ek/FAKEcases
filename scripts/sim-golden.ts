/**
 * Regenerate the golden projection fixture.
 *
 *     pnpm tsx scripts/sim-golden.ts
 *
 * Run this **only** when a scenario's numbers are deliberately changed — a new
 * intervention, a retuned effect, a scenario converted to the v2 engine. The
 * whole value of the fixture is that it is not regenerated to make a failing
 * test pass; a diff in a scenario nobody meant to touch is the bug it exists to
 * catch.
 *
 * The command prints which slugs moved, so a regeneration can be checked
 * against what the author believed they were changing.
 */

import { writeFileSync, readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { listScenarios } from "../lib/sim/registry";
import { buildGolden, type GoldenFixture } from "../tests/sim-golden-cases";

const FIXTURE = resolve(__dirname, "../tests/fixtures/sim-golden.json");

function changedSlugs(before: GoldenFixture, after: GoldenFixture): string[] {
  const slugs = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...slugs]
    .filter((slug) => JSON.stringify(before[slug]) !== JSON.stringify(after[slug]))
    .sort();
}

const next = buildGolden(listScenarios());
const prev: GoldenFixture = existsSync(FIXTURE)
  ? JSON.parse(readFileSync(FIXTURE, "utf8"))
  : {};

const moved = changedSlugs(prev, next);

writeFileSync(FIXTURE, `${JSON.stringify(next, null, 2)}\n`);

if (!Object.keys(prev).length) {
  console.log(`Wrote ${Object.keys(next).length} scenarios to tests/fixtures/sim-golden.json`);
} else if (moved.length) {
  console.log(`Projections changed for ${moved.length} scenario(s):`);
  for (const slug of moved) console.log(`  - ${slug}`);
  console.log("\nIf you did not mean to change all of these, revert and look again.");
} else {
  console.log("No projections changed.");
}
