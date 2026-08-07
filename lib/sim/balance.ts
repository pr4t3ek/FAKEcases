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
 * The most affordable combinations this will project before giving up.
 *
 * A cap on *work actually done*, not on the number of interventions. The search
 * below abandons a branch as soon as it stops fitting the budget, so what
 * matters is how many subsets are affordable — and budgets here are tight by
 * construction (`checkBalance` refuses spare capacity below), which means a
 * scenario with sixteen interventions still sweeps a few thousand combinations
 * rather than 65,536.
 *
 * The old form of this was `MAX_BRUTE_FORCE_INTERVENTIONS = 12`, a cap on n,
 * which had to be conservative because the search was 2^n regardless of what the
 * budget could pay for. Pruning is what makes a wider board affordable to check.
 */
export const MAX_BALANCE_COMBOS = 200_000;

/**
 * Retained so a scenario cannot quietly grow an unreviewably long decision
 * screen. This is now an editorial limit — how many options a person can
 * reasonably weigh — rather than a computational one; `MAX_BALANCE_COMBOS` is
 * what protects the sweep.
 */
export const MAX_BRUTE_FORCE_INTERVENTIONS = 12;

/** Floating-point slack, so an allocation cannot "beat" best by a rounding bit. */
const EPSILON = 1e-6;

export interface ComboSweep {
  combos: SimAllocationLine[][];
  /** True when the sweep hit `MAX_BALANCE_COMBOS` and stopped early. */
  truncated: boolean;
}

/**
 * Every subset of interventions the budget can fund in full.
 *
 * A depth-first walk that prunes on cost rather than enumerating all 2^n masks
 * and filtering afterwards. Every cost is non-negative, so once a running total
 * has passed either budget dimension, *every* superset of that branch is
 * unaffordable too and none of it needs visiting. That is what turns a 4x4
 * scenario from 65,536 projections into a few thousand.
 *
 * The set returned is identical to the old enumeration; only the order differs,
 * and both callers treat it as a set — one takes a maximum, the other collects
 * errors that are empty for any scenario that ships.
 */
export function sweepFundableCombos(
  scenario: SimScenario,
  limit = MAX_BALANCE_COMBOS,
): ComboSweep {
  const items = scenario.interventions;
  const maxSprints = scenario.budget.sprints;
  const maxRupees = scenario.budget.rupees;

  const combos: SimAllocationLine[][] = [];
  const chosen: SimAllocationLine[] = [];
  let truncated = false;

  const walk = (index: number, sprints: number, rupees: number): void => {
    if (truncated) return;
    if (index === items.length) {
      if (combos.length >= limit) {
        truncated = true;
        return;
      }
      combos.push([...chosen]);
      return;
    }

    // Leave it out.
    walk(index + 1, sprints, rupees);

    // Take it — unless doing so breaks the budget, in which case this whole
    // branch is dead and pruning it is the entire optimisation.
    const item = items[index];
    const nextSprints = sprints + item.cost.sprints;
    const nextRupees = rupees + item.cost.rupees;
    if (nextSprints > maxSprints || nextRupees > maxRupees) return;

    chosen.push({
      interventionId: item.id,
      sprints: item.cost.sprints,
      rupees: item.cost.rupees,
    });
    walk(index + 1, nextSprints, nextRupees);
    chosen.pop();
  };

  walk(0, 0, 0);
  return { combos, truncated };
}

/** The affordable subsets, for callers that only want the list. */
export function fullyFundableCombos(scenario: SimScenario): SimAllocationLine[][] {
  return sweepFundableCombos(scenario).combos;
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

  const sweep = sweepFundableCombos(scenario);
  if (sweep.truncated) {
    // Reported rather than hung on, and reported rather than passed silently:
    // an unfinished sweep proves nothing about the ceiling.
    return [
      `Too many affordable combinations (over ${MAX_BALANCE_COMBOS}) to prove the best allocation; loosen nothing until the budget is tighter or there are fewer interventions`,
    ];
  }

  for (const combo of sweep.combos) {
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
