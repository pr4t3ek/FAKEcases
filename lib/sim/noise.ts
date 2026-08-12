/**
 * The quarter not going exactly to plan.
 *
 * A war room is a deterministic causal model, which is most of why it teaches:
 * the debrief can say precisely why the number moved, and two candidates who
 * played the same way can be compared. Both properties are worth more than
 * realism, and neither is given up here.
 *
 * What noise adds is the thing determinism costs you — that a scenario played
 * twice is the same puzzle twice, so the second run is recall rather than
 * judgement, and a student learns that a good decision *always* produces its
 * projected number. That is the one lesson a business simulation should never
 * teach.
 *
 * Two rules keep the rest intact:
 *
 *   1. **One shock table per run, drawn before anything is allocated.** The
 *      draws depend on the seed and the scenario, never on what was funded. The
 *      same table hits the run, the do-nothing counterfactual and the authored
 *      ceiling, so luck moves all three together and cannot be gamed by
 *      choosing differently.
 *   2. **Scoring reads the noise-free projection.** `runOutcome` computes both;
 *      the report shows what happened and the scorer grades what was decided.
 *      Two candidates who play identically therefore score identically no
 *      matter how their luck ran, which is what keeps a leaderboard meaningful.
 *
 * What is deliberately NOT noised: intervention effects. A fix that works
 * should not randomly fail, or the causal lesson stops being learnable and the
 * debrief's "this is why it moved" becomes a lie. Only the weather is random —
 * the drift a scenario is already bleeding, and whichever inputs the author
 * names as genuinely uncertain.
 */

import { createRng, standardNormal } from "./engine/stochastic";
import type { DriverId, SimScenario } from "./types";

/** driverId → a multiplier per quarter. Index 0 is the baseline and is never moved. */
export type ShockTable = Record<DriverId, number[]>;

export interface RunShocks {
  /** Multiplicative shocks on authored `noise.drivers`. */
  drivers: ShockTable;
  /** Per-quarter multipliers on the drift rate itself. */
  drift: number[];
}

export const NO_SHOCKS: RunShocks = { drivers: {}, drift: [] };

/**
 * Draw a run's weather.
 *
 * Takes no allocation, and that absence is load-bearing rather than incidental:
 * it is what makes the shocks a property of the run instead of of the decision,
 * and therefore what lets the same table be applied to all three projections.
 *
 * Draws in a fixed canonical order — drivers sorted by id, then quarters
 * ascending — so the table cannot depend on the order an author happened to
 * list `noise.drivers` in.
 */
export function drawShocks(scenario: SimScenario, seed: string | null): RunShocks {
  if (!seed || !scenario.noise) return NO_SHOCKS;

  // Namespaced so a second stochastic consumer added later cannot shift these
  // draws and silently rewrite what every stored report meant.
  const rng = createRng(`${seed}:${scenario.slug}:outcome`);
  const quarters = scenario.horizonQuarters;

  const drivers: ShockTable = {};
  for (const { driver, sigma } of [...scenario.noise.drivers].sort((a, b) =>
    a.driver.localeCompare(b.driver),
  )) {
    const path: number[] = [1];
    for (let q = 1; q <= quarters; q++) {
      // Lognormal: a multiplicative shock cannot take a driver negative, and a
      // clipped normal would pile probability mass on the clip.
      path[q] = Math.exp(sigma * standardNormal(rng));
    }
    drivers[driver] = path;
  }

  const driftSigma = scenario.noise.driftSigma ?? 0;
  const drift: number[] = [1];
  for (let q = 1; q <= quarters; q++) {
    drift[q] = driftSigma > 0 ? 1 + driftSigma * standardNormal(rng) : 1;
  }

  return { drivers, drift };
}

/** The multiplier for a driver in a given quarter, or 1 when it is not noised. */
export function shockFor(shocks: RunShocks, driver: DriverId, quarter: number): number {
  return shocks.drivers[driver]?.[quarter] ?? 1;
}

/** How much of the authored drift actually arrived in a given quarter. */
export function driftShockFor(shocks: RunShocks, quarter: number): number {
  return shocks.drift[quarter] ?? 1;
}
