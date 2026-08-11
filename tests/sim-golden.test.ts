/**
 * The net under the engine rewrite.
 *
 * Every authored scenario is projected under four fixed allocations and
 * compared, number for number, against a committed fixture. It asserts nothing
 * about whether the numbers are *good* — `tests/sim-scenario.test.ts` does that.
 * It asserts only that they have not **moved**.
 *
 * That is the property the v2 engine work needs and cannot get any other way.
 * Saturating response curves, a spend driver and seeded variance all change how
 * an allocation becomes moved metrics; the scenarios that did not opt in must
 * come out bit-identical, and "we read the diff carefully" is not a proof of
 * that across thirteen files and four hundred numbers each.
 *
 * When a scenario is deliberately retuned, regenerate with
 * `pnpm tsx scripts/sim-golden.ts` — which prints the slugs that moved, so the
 * regeneration itself is reviewable.
 */

import { describe, it, expect } from "vitest";
import { listScenarios } from "@/lib/sim/registry";
import { goldenCases, projectGolden, type GoldenFixture } from "./sim-golden-cases";
import fixture from "./fixtures/sim-golden.json";

const golden = fixture as GoldenFixture;
const scenarios = listScenarios();

describe("golden projections", () => {
  it("covers every scenario in the registry", () => {
    // A scenario added without a fixture entry would otherwise be silently
    // unprotected — the loop below only iterates what the registry holds, so
    // the count is what catches an addition.
    expect(Object.keys(golden).sort()).toEqual(scenarios.map((s) => s.slug).sort());
  });

  for (const scenario of scenarios) {
    describe(scenario.slug, () => {
      for (const { name, allocation } of goldenCases(scenario)) {
        it(`projects "${name}" exactly as recorded`, () => {
          const recorded = golden[scenario.slug]?.[name];
          expect(recorded, `no fixture entry for ${scenario.slug}/${name}`).toBeDefined();
          expect(projectGolden(scenario, allocation)).toEqual(recorded);
        });
      }
    });
  }
});
