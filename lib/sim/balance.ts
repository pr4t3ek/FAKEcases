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

import { simConfig } from "@/lib/config/simulation";
import { allocationFits, finalValue, runOutcome } from "./outcome";
import {
  betterOnNorthStar,
  formatAllocation,
  optimiseAllocation,
  type OptimiseOptions,
} from "./optimise";
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
export function checkBalance(
  scenario: SimScenario,
  opts: OptimiseOptions = {},
): string[] {
  const errors: string[] = [];

  if (!allocationFits(scenario, scenario.bestAllocation)) {
    errors.push("bestAllocation does not fit inside the budget");
    // Every check below compares against it, so there is nothing further to say.
    return errors;
  }

  if (scenario.engine === "v2") return checkBalanceV2(scenario, opts);

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

/**
 * The v2 balance check.
 *
 * Three of its five assertions have no v1 counterpart, and each exists because
 * the v2 model made a new kind of authoring mistake possible.
 *
 * **Interiority** is the one this whole engine change was for. If funding every
 * on-target lever to its cap is still the best play, the scenario has response
 * curves and no decision — the student is back to "spend everything", and the
 * saturation is decoration. Refusing to certify such a scenario is what stops
 * that from being authored by accident.
 *
 * **Binding money** replaces the v1 spare-capacity rule for the money budget.
 * Under a linear model, unspent rupees were always a mistake; under saturation
 * they are frequently correct, so the rule inverts: the money budget must
 * either be spent or be demonstrably past the point of doing anything.
 */
function checkBalanceV2(scenario: SimScenario, opts: OptimiseOptions): string[] {
  const errors: string[] = [];

  const bestOutcome = runOutcome(scenario, scenario.bestAllocation);
  const declared = finalValue(bestOutcome.paths, scenario.northStar);
  const nothing = finalValue(bestOutcome.doNothing, scenario.northStar);

  if (!betterOnNorthStar(scenario, declared, nothing)) {
    errors.push(
      `Doing nothing (${nothing}) is no worse than the best allocation (${declared}) on "${scenario.northStar}", so the outcome score has no gradient`,
    );
  }

  const search = optimiseAllocation(scenario, opts);
  if (search.truncated) {
    return [
      `The allocation search hit its evaluation cap before it finished, so the ceiling is unproven; reduce the interventions or tighten the capacity budget`,
    ];
  }

  // Relative rather than absolute: a north star measured in crore and one
  // measured in minutes cannot share a fixed tolerance, and an absolute 1e-6
  // on a value of 24,00,000 is a comparison of rounding noise.
  const slack = 1e-6 * Math.max(1, Math.abs(declared));
  if (betterOnNorthStar(scenario, search.best.northStar, declared + slack)) {
    const gap = Math.abs((search.best.northStar - declared) / declared) * 100;
    errors.push(
      `A better allocation exists: ${describe(search.best.allocation)} reaches ${search.best.northStar} on "${scenario.northStar}" against the declared ${declared} (${gap.toFixed(1)}% better). Adopt it:\n  ${formatAllocation(search.best)}`,
    );
  }

  /**
   * Interiority — the assertion this whole engine change exists to make
   * possible.
   *
   * Take the plays the declared best already backs, and pour every rupee the
   * budget allows into them, capped only by what each will absorb. If that is
   * as good, the scenario still rewards emptying the wallet and the response
   * curves are decoration: a student who understands nothing but "spend it all"
   * lands on the ceiling, which is the exact habit the format was rebuilt to
   * stop rewarding.
   *
   * Framed against the declared subset rather than against every lever at its
   * cap, because the latter is usually not a play at all — two levers at three
   * times their ask fit inside no budget, so comparing with it would fail every
   * scenario for a reason that has nothing to do with saturation.
   */
  let remaining = scenario.budget.rupees;
  const maxedOut = scenario.bestAllocation.map((line) => {
    const iv = scenario.interventions.find((i) => i.id === line.interventionId);
    const cap = (iv?.cost.rupees ?? 0) * (iv?.maxAskMultiple ?? simConfig.maxAskMultiple);
    const give = Math.min(cap, remaining);
    remaining -= give;
    return { ...line, rupees: give };
  });
  if (maxedOut.length) {
    const value = finalValue(runOutcome(scenario, maxedOut).paths, scenario.northStar);
    // A share of what was winnable, not of the metric's absolute level — see
    // `interiorityMargin`. The gradient is also exactly what `scoreOutcome`
    // normalises against, so this asks the question in the units the student's
    // score is denominated in.
    const margin = Math.abs(declared - nothing) * simConfig.interiorityMargin;
    if (!betterOnNorthStar(scenario, declared, value + margin)) {
      errors.push(
        `Pouring the whole budget into the same levers reaches ${value} against the declared best of ${declared}, costing under ${(simConfig.interiorityMargin * 100).toFixed(0)}% of the ${Math.abs(declared - nothing).toFixed(0)} that was winnable — so "spend everything" is still the play and the response curves are not doing any work`,
      );
    }
  }

  // Money must be binding, or provably past the point of mattering.
  const spentMoney = scenario.bestAllocation.reduce((s, l) => s + l.rupees, 0);
  if (spentMoney < scenario.budget.rupees) {
    const spare = scenario.budget.rupees - spentMoney;
    const spendItAnyway = scenario.bestAllocation.map((line, i) => ({
      ...line,
      rupees: i === 0 ? line.rupees + spare : line.rupees,
    }));
    const value = finalValue(runOutcome(scenario, spendItAnyway).paths, scenario.northStar);
    const material = Math.abs(declared) * simConfig.spareMoneyTolerance;
    if (betterOnNorthStar(scenario, value, declared + material)) {
      errors.push(
        `The best allocation leaves ${Math.round(spare)} rupees unspent, and spending them on "${scenario.bestAllocation[0]?.interventionId}" reaches ${value} against ${declared} — more than ${(simConfig.spareMoneyTolerance * 100).toFixed(1)}% better, so the remainder is not a decision, it is an oversight`,
      );
    }
  }

  return errors;
}

function describe(allocation: SimAllocationLine[]): string {
  if (!allocation.length) return "(nothing)";
  return allocation
    .map((l) => `${l.interventionId} ₹${Math.round(l.rupees)}`)
    .join(" + ");
}
