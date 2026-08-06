/**
 * The balance invariants — the checks that make a scenario *fair* rather than
 * merely well-formed.
 *
 * `validateScenario` answers "do the cross-references resolve?". These answer
 * "is the authored best allocation actually the best one?", which nothing can
 * settle by inspection: it is a property of the driver graph, the intervention
 * effects and the budget interacting, and a single retuned baseline can flip it.
 *
 * That matters because `bestAllocation` is the ceiling the outcome score
 * normalises against (see `score.ts`). An authored "best" that isn't best makes
 * the score uninterpretable — a candidate can beat the ceiling — and quietly
 * teaches the wrong lesson, which is worse than teaching nothing.
 *
 * This lived inside `tests/sim-scenario.test.ts` while scenarios were only ever
 * authored in code and checked once in CI. Admin-editable drivers move that
 * moment to runtime, so the invariant has to be callable from the save path.
 * One implementation, two callers — the test suite and `saveScenarioDrivers`.
 *
 * Pure and DB-free, like the rest of `lib/sim`.
 */

import { allocationFits, finalValue, runOutcome } from "./outcome";
import type { SimAllocationLine, SimScenario } from "./types";

/**
 * Brute-forcing is 2^n. Twelve interventions is 4,096 projections — fine for a
 * save or a test run, and far above what any authored scenario uses. Past that
 * we report rather than hang.
 */
export const MAX_BRUTE_FORCE_INTERVENTIONS = 12;

/** Floating-point slack, so an allocation cannot "beat" best by a rounding bit. */
const EPSILON = 1e-6;

/** Every subset of interventions that the budget can fund in full. */
export function fullyFundableCombos(scenario: SimScenario): SimAllocationLine[][] {
  const items = scenario.interventions;
  const combos: SimAllocationLine[][] = [];

  for (let mask = 0; mask < 1 << items.length; mask++) {
    const lines: SimAllocationLine[] = [];
    for (let i = 0; i < items.length; i++) {
      if (mask & (1 << i)) {
        lines.push({
          interventionId: items[i].id,
          sprints: items[i].cost.sprints,
          rupees: items[i].cost.rupees,
        });
      }
    }
    if (allocationFits(scenario, lines)) combos.push(lines);
  }

  return combos;
}

/**
 * Everything that would make the scorer lie, in the author's words.
 *
 * Returns an empty array for a balanced scenario, matching `validateScenario`
 * so the two compose into one error list.
 *
 * Assumes the scenario already passes `validateScenario` — it reads
 * `bestAllocation` and the intervention list as given, and a dangling reference
 * there is that function's job to report, not this one's.
 */
export function checkBalance(scenario: SimScenario): string[] {
  const errors: string[] = [];

  if (scenario.interventions.length > MAX_BRUTE_FORCE_INTERVENTIONS) {
    return [
      `Too many interventions (${scenario.interventions.length}) to prove the best allocation by brute force; the ceiling is ${MAX_BRUTE_FORCE_INTERVENTIONS}`,
    ];
  }

  if (!allocationFits(scenario, scenario.bestAllocation)) {
    errors.push("bestAllocation does not fit inside the budget");
    // Every check below compares against it, so there is nothing further to say.
    return errors;
  }

  const bestOutcome = runOutcome(scenario, scenario.bestAllocation);
  const best = finalValue(bestOutcome.paths, scenario.northStar);

  // Doing nothing must be visibly worse than acting, or the run has no gradient
  // to grade and every allocation scores the same.
  const nothing = finalValue(bestOutcome.doNothing, scenario.northStar);
  if (!(best > nothing)) {
    errors.push(
      `Doing nothing (${nothing}) is no worse than the best allocation (${best}) on "${scenario.northStar}", so the outcome score has no gradient`,
    );
  }

  for (const combo of fullyFundableCombos(scenario)) {
    const value = finalValue(runOutcome(scenario, combo).paths, scenario.northStar);
    if (value > best + EPSILON) {
      const names = combo.map((l) => l.interventionId).join(" + ") || "(nothing)";
      errors.push(
        `"${names}" beats the declared best allocation on "${scenario.northStar}" (${value} vs ${best})`,
      );
    }
  }

  /**
   * Spare capacity is what lets a candidate bolt a margin-destroying extra onto
   * the correct answer and still land above the ceiling.
   */
  const used = scenario.bestAllocation.reduce(
    (acc, l) => ({ sprints: acc.sprints + l.sprints, rupees: acc.rupees + l.rupees }),
    { sprints: 0, rupees: 0 },
  );
  const cheapest = Math.min(...scenario.interventions.map((i) => i.cost.sprints));
  const spare = scenario.budget.sprints - used.sprints;
  if (spare >= cheapest) {
    errors.push(
      `The best allocation leaves ${spare} sprints spare, enough to fund another intervention (cheapest costs ${cheapest})`,
    );
  }

  return errors;
}
