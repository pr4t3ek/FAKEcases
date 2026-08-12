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
import { simConfig } from "@/lib/config/simulation";
import { resolveDrivers } from "./drivers";
import { evalResponse, responseFor } from "./response";
import { drawShocks, driftShockFor, shockFor, NO_SHOCKS, type RunShocks } from "./noise";
import type {
  DriverId,
  InterventionFunding,
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
  funding: Record<InterventionId, InterventionFunding>;
  /**
   * Ratio in [0,1] per intervention, for every caller that only ever wanted
   * that — `SimOutcomeResult.funding`, the report, and the stored `outcomeJson`
   * of every run already played.
   */
  ratios: Record<InterventionId, number>;
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
  const funding: Record<InterventionId, InterventionFunding> = {};
  const ratios: Record<InterventionId, number> = {};
  const stalled: InterventionId[] = [];

  for (const iv of scenario.interventions) {
    const got = totals.get(iv.id);
    if (!got || (got.sprints <= 0 && got.rupees <= 0)) continue;

    const askMultiple = iv.cost.rupees > 0 ? got.rupees / iv.cost.rupees : 1;

    if (iv.minSprints !== undefined && got.sprints < iv.minSprints) {
      funding[iv.id] = {
        shipped: false,
        sprints: got.sprints,
        rupees: got.rupees,
        askMultiple,
        ratio: 0,
      };
      ratios[iv.id] = 0;
      stalled.push(iv.id);
      continue;
    }

    const dims: number[] = [];
    if (iv.cost.sprints > 0) dims.push(got.sprints / iv.cost.sprints);
    if (iv.cost.rupees > 0) dims.push(got.rupees / iv.cost.rupees);
    const ratio = dims.length ? Math.min(...dims) : 1;

    const clamped = clamp(ratio, 0, 1);
    funding[iv.id] = {
      shipped: true,
      sprints: got.sprints,
      rupees: got.rupees,
      askMultiple,
      ratio: clamped,
    };
    ratios[iv.id] = clamped;
  }

  return { funding, ratios, stalled };
}

/**
 * What `pathsForFunding` accepts.
 *
 * The rich record is what `fundingFor` now returns; the bare ratio map is what
 * `{}` (the do-nothing counterfactual) and every stored `outcomeJson` look
 * like. Taking both means no caller had to change to gain the curve.
 */
export type FundingInput =
  | Record<InterventionId, InterventionFunding>
  | Record<InterventionId, number>;

function normaliseFunding(input: FundingInput): Record<InterventionId, InterventionFunding> {
  const out: Record<InterventionId, InterventionFunding> = {};
  for (const [id, value] of Object.entries(input)) {
    out[id] =
      typeof value === "number"
        ? {
            shipped: value > 0,
            sprints: 0,
            rupees: 0,
            // A bare ratio carries no rupee figure to divide, so the ask
            // multiple is the ratio itself. Only a v2 projection reads this,
            // and a v2 projection is always fed the rich record.
            askMultiple: value,
            ratio: value,
          }
        : value;
  }
  return out;
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
  rawFunding: FundingInput,
  shocks: RunShocks = NO_SHOCKS,
): SimPaths {
  const funding = normaliseFunding(rawFunding);
  const v2 = scenario.engine === "v2";
  const paths: SimPaths = {};

  for (let q = 0; q <= scenario.horizonQuarters; q++) {
    const multipliers: Record<DriverId, number> = {};
    const scale = (driver: DriverId, factor: number) => {
      multipliers[driver] = (multipliers[driver] ?? 1) * factor;
    };

    for (const effect of scenario.drift) {
      // The bleed is the least reliable number in a scenario — it is an
      // extrapolation of a trend — so it is what the weather moves first.
      scale(effect.driver, Math.pow(1 + effect.deltaPct * driftShockFor(shocks, q), q));
    }

    for (const driver of Object.keys(shocks.drivers)) {
      scale(driver, shockFor(shocks, driver, q));
    }

    /**
     * The bill.
     *
     * Every rupee committed counts, including money behind an intervention
     * that stalled below its capacity gate — that money is gone in exactly the
     * way the stall already models, and letting it escape the P&L would make
     * the cheapest way to spend nothing be to spend it badly.
     */
    if (v2 && scenario.spend && q > 0) {
      const committed = Object.values(funding).reduce((sum, f) => sum + f.rupees, 0);
      const budget = scenario.budget.rupees;
      if (budget > 0 && committed > 0) {
        scale(scenario.spend.driver, 1 + scenario.spend.atFullBudget * (committed / budget));
      }
    }

    for (const iv of scenario.interventions) {
      const got = funding[iv.id];
      if (!got || !got.shipped) continue;
      // v1: a line with capacity but no money has ratio 0 and is skipped
      // outright. Kept as its own branch rather than folded into the v2 path,
      // because `evalResponse(curve, 0) === 0` reaches the same answer by a
      // different route and this file owes v1 an identical one.
      if (!v2 && got.ratio <= 0) continue;

      const onTarget = scenario.trueCauseIds.includes(iv.addresses);
      const effects = onTarget ? iv.effects.whenRootCause : iv.effects.otherwise;
      for (const effect of effects) {
        const response = v2
          ? evalResponse(
              responseFor(iv, effect, onTarget, simConfig.responseDefaults),
              Math.min(got.askMultiple, iv.maxAskMultiple ?? simConfig.maxAskMultiple),
            )
          : got.ratio;
        scale(effect.driver, 1 + effect.deltaPct * response * rampFraction(effect, q));
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

// ─── Multi-period: the turnaround format ───────────────────────────────────

/**
 * Capacity committed period by period. Index is the period it was decided in.
 *
 * The war room's `SimAllocationLine[]` is the degenerate case — one decision,
 * taken before anything is seen.
 */
export type SimSchedule = SimAllocationLine[][];

/** The first period an intervention received any capacity, or null. */
function firstFundedPeriod(schedule: SimSchedule, id: InterventionId): number | null {
  for (let p = 0; p < schedule.length; p++) {
    const got = (schedule[p] ?? []).filter((l) => l.interventionId === id);
    if (got.some((l) => l.sprints > 0 || l.rupees > 0)) return p;
  }
  return null;
}

/**
 * Quarterly values when capacity arrives over time rather than all at once.
 *
 * Three rules, each of which is the point of the format:
 *
 *   - **Only capacity committed in an EARLIER period counts.** Deciding in
 *     period 2 cannot move period 2's numbers; you see the quarter you already
 *     bought. This is what stops the format from being four independent guesses.
 *   - **Funding accumulates.** Two sprints now and two later fund the same
 *     intervention as four now — but they ramp from later, so the same capacity
 *     buys less. Committing early is worth something real.
 *   - **The ramp is measured from the first period the thing was funded**, not
 *     from the start of the run, so a fix begun in period 3 has not magically
 *     been ramping since period 0.
 *
 * Order-independence within a period and compounding drift both survive, which
 * is what keeps this comparable with `pathsForFunding`.
 */
export function pathsForSchedule(scenario: SimScenario, schedule: SimSchedule): SimPaths {
  const paths: SimPaths = {};

  for (let q = 0; q <= scenario.horizonQuarters; q++) {
    const multipliers: Record<DriverId, number> = {};
    const scale = (driver: DriverId, factor: number) => {
      multipliers[driver] = (multipliers[driver] ?? 1) * factor;
    };

    // No weather here: the turnaround format is v1 and draws no shocks. When a
    // v2 scenario needs periods, this loop grows the same two lines
    // `pathsForFunding` has.
    for (const effect of scenario.drift) {
      scale(effect.driver, Math.pow(1 + effect.deltaPct, q));
    }

    // Everything decided strictly before this period.
    const committed = schedule.slice(0, q).flat();
    const { funding } = fundingFor(scenario, committed);

    for (const iv of scenario.interventions) {
      // The turnaround format is v1 only, so the linear ratio is the whole
      // story here. When a v2 scenario needs periods, this loop grows the same
      // branch `pathsForFunding` has.
      const ratio = funding[iv.id]?.ratio ?? 0;
      if (ratio <= 0) continue;
      const started = firstFundedPeriod(schedule, iv.id);
      if (started === null) continue;

      const onTarget = scenario.trueCauseIds.includes(iv.addresses);
      const effects = onTarget ? iv.effects.whenRootCause : iv.effects.otherwise;
      for (const effect of effects) {
        scale(effect.driver, 1 + effect.deltaPct * ratio * rampFraction(effect, q - started));
      }
    }

    const values = resolveDrivers(scenario.drivers, multipliers, { paths, period: q });
    for (const [id, value] of Object.entries(values)) {
      const path = (paths[id] ??= []);
      path[q] = value;
    }
  }

  return paths;
}

/**
 * The authored best sequence, or the single best allocation taken in period 0.
 *
 * The fallback matters: it means a turnaround scenario that has not authored a
 * schedule still gets a coherent ceiling rather than an empty one, and the
 * ceiling is "you should have committed everything immediately" — which is a
 * defensible answer, just rarely the optimal one.
 */
export function bestScheduleFor(scenario: SimScenario): SimSchedule {
  if (scenario.bestSchedule?.length) return scenario.bestSchedule;
  return [scenario.bestAllocation];
}

/** `runOutcome`'s multi-period sibling. Same result shape, so the debrief is shared. */
export function runSchedule(
  scenario: SimScenario,
  schedule: SimSchedule,
): SimOutcomeResult {
  const flat = schedule.flat();
  const mine = fundingFor(scenario, flat);

  return {
    paths: pathsForSchedule(scenario, schedule),
    doNothing: pathsForSchedule(scenario, []),
    best: pathsForSchedule(scenario, bestScheduleFor(scenario)),
    funding: mine.ratios,
    fundingDetail: mine.funding,
    stalled: mine.stalled,
  };
}

/** Project a run, its do-nothing counterfactual, and the achievable ceiling. */
export function runOutcome(
  scenario: SimScenario,
  allocation: SimAllocationLine[],
  opts: { seed?: string | null } = {},
): SimOutcomeResult {
  const mine = fundingFor(scenario, allocation);
  const best = fundingFor(scenario, scenario.bestAllocation);

  // Drawn from the seed and the scenario alone — never from the allocation.
  // That is what lets one table hit all three projections, so luck moves the
  // run, its counterfactual and its ceiling together and cannot be gamed by
  // choosing differently. See `lib/sim/noise.ts`.
  const shocks = drawShocks(scenario, opts.seed ?? null);
  const noisy = shocks !== NO_SHOCKS;

  const project = (funding: FundingInput, weather: RunShocks) =>
    pathsForFunding(scenario, funding, weather);

  const result: SimOutcomeResult = {
    paths: project(mine.funding, shocks),
    doNothing: project({}, shocks),
    best: project(best.funding, shocks),
    funding: mine.ratios,
    fundingDetail: mine.funding,
    stalled: mine.stalled,
  };

  if (!noisy) return result;

  // The same run with the weather taken out. This is what `scoreOutcome`
  // grades, so two candidates who played identically score identically however
  // their luck ran; the realised paths above are what the report shows.
  result.expected = {
    paths: project(mine.funding, NO_SHOCKS),
    doNothing: project({}, NO_SHOCKS),
    best: project(best.funding, NO_SHOCKS),
  };
  if (opts.seed) result.seed = opts.seed;
  return result;
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
