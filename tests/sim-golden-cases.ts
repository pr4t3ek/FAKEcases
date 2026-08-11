/**
 * The fixed allocations every scenario is projected under, and the digest of
 * what came back.
 *
 * Shared by `scripts/sim-golden.ts` (which writes the fixture) and
 * `tests/sim-golden.test.ts` (which asserts against it), so the two can never
 * disagree about what was recorded.
 *
 * The cases are **derived from the scenario**, never hand-authored per file.
 * Thirteen hand-written allocations would rot the first time a scenario gained
 * an intervention, and the point of this fixture is to be believed years from
 * now.
 */

import { runOutcome } from "@/lib/sim/outcome";
import type { SimAllocationLine, SimPaths, SimScenario } from "@/lib/sim/types";

export interface GoldenCase {
  name: string;
  allocation: SimAllocationLine[];
}

/**
 * Four probes, chosen to reach every branch of the projection:
 *
 *   - `do-nothing` — drift alone, the counterfactual every score is measured
 *     against.
 *   - `best` — the authored ceiling, and every `whenRootCause` effect arm.
 *   - `half-money` — a partial funding ratio, which is the number the response
 *     curve will eventually replace. If anything moves here, the curve leaked
 *     into v1.
 *   - `all-full` — every intervention at exactly its cost, which is the only
 *     probe that touches the `otherwise` arm of the levers a correct diagnosis
 *     can never fund. Deliberately ignores the budget: `runOutcome` does not
 *     enforce `allocationFits`, and an over-budget allocation is still a
 *     perfectly well-defined projection.
 */
export function goldenCases(scenario: SimScenario): GoldenCase[] {
  return [
    { name: "do-nothing", allocation: [] },
    { name: "best", allocation: scenario.bestAllocation },
    {
      name: "half-money",
      allocation: scenario.bestAllocation.map((line) => ({
        ...line,
        rupees: line.rupees / 2,
      })),
    },
    {
      name: "all-full",
      allocation: scenario.interventions.map((iv) => ({
        interventionId: iv.id,
        sprints: iv.cost.sprints,
        rupees: iv.cost.rupees,
      })),
    },
  ];
}

export interface GoldenProjection {
  /** Full quarterly path per driver, not just the final value. */
  paths: Record<string, number[]>;
  doNothing: Record<string, number[]>;
  best: Record<string, number[]>;
  funding: Record<string, number>;
  stalled: string[];
}

export type GoldenFixture = Record<string, Record<string, GoldenProjection>>;

/**
 * The drivers worth pinning: the north star plus everything the scenario
 * reports. Sorted, so a reordered `reported` array is not a diff.
 */
function trackedDrivers(scenario: SimScenario): string[] {
  return [...new Set([scenario.northStar, ...scenario.reported])].sort();
}

function pick(paths: SimPaths, drivers: string[]): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  for (const id of drivers) out[id] = [...(paths[id] ?? [])];
  return out;
}

export function projectGolden(
  scenario: SimScenario,
  allocation: SimAllocationLine[],
): GoldenProjection {
  const drivers = trackedDrivers(scenario);
  const outcome = runOutcome(scenario, allocation);

  return {
    paths: pick(outcome.paths, drivers),
    doNothing: pick(outcome.doNothing, drivers),
    best: pick(outcome.best, drivers),
    // Sorted for a stable diff — `Object.entries` order follows insertion,
    // which follows the intervention list, which an author may reorder.
    funding: Object.fromEntries(
      Object.entries(outcome.funding).sort(([a], [b]) => a.localeCompare(b)),
    ),
    stalled: [...outcome.stalled].sort(),
  };
}

export function buildGolden(scenarios: SimScenario[]): GoldenFixture {
  const fixture: GoldenFixture = {};
  for (const scenario of scenarios) {
    const cases: Record<string, GoldenProjection> = {};
    for (const { name, allocation } of goldenCases(scenario)) {
      cases[name] = projectGolden(scenario, allocation);
    }
    fixture[scenario.slug] = cases;
  }
  return fixture;
}
