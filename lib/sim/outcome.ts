/**
 * Projecting the next quarters from a committed allocation.
 *
 * This is the model that turns "I spent two sprints and ₹4 crore on rider
 * payouts" into moved metrics, and it is the reason a simulation reports a
 * consequence rather than a mark.
 *
 * Three properties are load-bearing:
 *
 *   - **Deterministic.** No randomness and no clock. A report pinned to a run
 *     must still read the same next month.
 *   - **Order-independent.** Effects compose multiplicatively, so funding A then
 *     B is identical to funding B then A. Allocation is a set of decisions, not
 *     a sequence, and the model should not pretend otherwise.
 *   - **Doing nothing is not free.** Untreated drift compounds each quarter, so
 *     the counterfactual a run is measured against gets worse on its own.
 */

import { clamp } from "@/lib/utils";
import { resolveDrivers } from "./drivers";
import type {
  DriverId,
  InterventionId,
  SimAllocationLine,
  SimEffect,
  SimOutcomeResult,
  SimPaths,
  SimScenario,
} from "./types";

/** Capacity committed per intervention, with duplicate lines summed. */
export function totalsByIntervention(
  allocation: SimAllocationLine[],
): Map<InterventionId, { sprints: number; rupees: number }> {
  const totals = new Map<InterventionId, { sprints: number; rupees: number }>();
  for (const line of allocation) {
    const prev = totals.get(line.interventionId) ?? { sprints: 0, rupees: 0 };
    totals.set(line.interventionId, {
      sprints: prev.sprints + line.sprints,
      rupees: prev.rupees + line.rupees,
    });
  }
  return totals;
}

export interface FundingResult {
  /** Ratio in [0,1] per intervention. Absent means unfunded. */
  funding: Record<InterventionId, number>;
  /** Funded but below `minSprints`: money spent, nothing shipped. */
  stalled: InterventionId[];
}

/**
 * How much of each intervention actually got done.
 *
 * The ratio is the *weakest* of its cost dimensions — two sprints with no budget
 * ships as little as budget with no engineers. A dimension the intervention
 * doesn't need (cost 0) counts as satisfied rather than dividing by zero.
 *
 * `minSprints` is the sharp edge and it is deliberate: below it the ratio is 0
 * and the intervention is recorded as stalled. The rupees are still spent and
 * the capacity is still gone. Spreading capital across every option until none
 * of it clears its bar is the single most common failure this format is built
 * to teach, so it has to cost something real.
 */
export function fundingFor(
  scenario: SimScenario,
  allocation: SimAllocationLine[],
): FundingResult {
  const totals = totalsByIntervention(allocation);
  const funding: Record<InterventionId, number> = {};
  const stalled: InterventionId[] = [];

  for (const iv of scenario.interventions) {
    const got = totals.get(iv.id);
    if (!got || (got.sprints <= 0 && got.rupees <= 0)) continue;

    if (iv.minSprints !== undefined && got.sprints < iv.minSprints) {
      funding[iv.id] = 0;
      stalled.push(iv.id);
      continue;
    }

    const ratios: number[] = [];
    if (iv.cost.sprints > 0) ratios.push(got.sprints / iv.cost.sprints);
    if (iv.cost.rupees > 0) ratios.push(got.rupees / iv.cost.rupees);
    const ratio = ratios.length ? Math.min(...ratios) : 1;

    funding[iv.id] = clamp(ratio, 0, 1);
  }

  return { funding, stalled };
}

/** How much of an effect has landed by quarter `q`. Zero at the baseline. */
function rampFraction(effect: SimEffect, q: number): number {
  if (q <= 0) return 0;
  return Math.min(1, q / Math.max(1, effect.rampQuarters ?? 1));
}

/**
 * Quarterly values for every driver, index 0 being today.
 *
 * Drift compounds — `(1 + d)^q` — because an untreated problem keeps
 * compounding. Intervention effects do not: they are a level change that ramps
 * in, so a fix that recovers 8% recovers 8%, not 8% every quarter forever.
 */
export function pathsForFunding(
  scenario: SimScenario,
  funding: Record<InterventionId, number>,
): SimPaths {
  const paths: SimPaths = {};

  for (let q = 0; q <= scenario.horizonQuarters; q++) {
    const multipliers: Record<DriverId, number> = {};
    const scale = (driver: DriverId, factor: number) => {
      multipliers[driver] = (multipliers[driver] ?? 1) * factor;
    };

    for (const effect of scenario.drift) {
      scale(effect.driver, Math.pow(1 + effect.deltaPct, q));
    }

    for (const iv of scenario.interventions) {
      const ratio = funding[iv.id] ?? 0;
      if (ratio <= 0) continue;

      const onTarget = scenario.trueCauseIds.includes(iv.addresses);
      const effects = onTarget ? iv.effects.whenRootCause : iv.effects.otherwise;
      for (const effect of effects) {
        scale(effect.driver, 1 + effect.deltaPct * ratio * rampFraction(effect, q));
      }
    }

    // `paths` holds periods 0 … q-1 by now, which is exactly the history a
    // `stock` or a `lagged` driver reads. Building it forward in place is what
    // keeps this a single pass rather than a fixed-point iteration.
    const values = resolveDrivers(scenario.drivers, multipliers, { paths, period: q });
    for (const [id, value] of Object.entries(values)) {
      const path = (paths[id] ??= []);
      path[q] = value;
    }
  }

  return paths;
}

/** Project a run, its do-nothing counterfactual, and the achievable ceiling. */
export function runOutcome(
  scenario: SimScenario,
  allocation: SimAllocationLine[],
): SimOutcomeResult {
  const mine = fundingFor(scenario, allocation);
  const best = fundingFor(scenario, scenario.bestAllocation);

  return {
    paths: pathsForFunding(scenario, mine.funding),
    doNothing: pathsForFunding(scenario, {}),
    best: pathsForFunding(scenario, best.funding),
    funding: mine.funding,
    stalled: mine.stalled,
  };
}

/** The last projected value of a driver — what the outcome report leads with. */
export function finalValue(paths: SimPaths, driver: DriverId): number {
  const path = paths[driver];
  if (!path?.length) throw new Error(`No projected path for driver "${driver}"`);
  return path[path.length - 1];
}

/** Fractional change from baseline to the end of the horizon. */
export function totalChange(paths: SimPaths, driver: DriverId): number {
  const path = paths[driver];
  if (!path?.length) throw new Error(`No projected path for driver "${driver}"`);
  const start = path[0];
  if (start === 0) return 0;
  return (path[path.length - 1] - start) / Math.abs(start);
}

/** Whether the allocation fits the scenario's capacity. */
export function allocationFits(
  scenario: SimScenario,
  allocation: SimAllocationLine[],
): boolean {
  let sprints = 0;
  let rupees = 0;
  for (const line of allocation) {
    sprints += line.sprints;
    rupees += line.rupees;
  }
  return sprints <= scenario.budget.sprints && rupees <= scenario.budget.rupees;
}
