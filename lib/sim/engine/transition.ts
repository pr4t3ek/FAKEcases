/**
 * The non-linear couplings.
 *
 * Four mechanisms, each a piece of ordinary applied maths with every constant
 * arriving from a config. None of them knows what it is modelling: an
 * elasticity governs demand against price in one domain and awareness against
 * advertising spend in another, and the arithmetic is identical.
 *
 * Non-linearity is the whole point. A linear model teaches that twice the
 * utilisation costs twice the wait, which is false and is exactly the intuition
 * that puts a factory at 95% and a student in trouble.
 */

import { clamp } from "@/lib/utils";
import { betaDraw, normalPercentile, type Rng } from "./stochastic";
import type { MechanismSpec, RegimeConfig } from "@/lib/sim/configs/types";

/** One mechanism's result, plus the draw the scenario library reads. */
export interface MechanismResult {
  writes: string;
  value: number;
  draw: { name: string; value: number; percentile: number } | null;
}

/**
 * Constant elasticity with a regime multiplier: `base · mult · (x / ref)^(±e)`.
 *
 * Constant-elasticity rather than linear because the response to a price change
 * depends on where the price already is — the difference between a 10% cut from
 * cheap and a 10% cut from expensive — and a straight line cannot say that.
 */
export function elasticityResponse(args: {
  level: number;
  referenceLevel: number;
  base: number;
  elasticity: number;
  multiplier: number;
  exponentSign: 1 | -1;
  shock: number;
}): number {
  const { level, referenceLevel, base, elasticity, multiplier, exponentSign, shock } = args;
  if (referenceLevel <= 0 || level <= 0) return 0;
  const ratio = level / referenceLevel;
  return Math.max(0, base * multiplier * Math.pow(ratio, exponentSign * elasticity) * (1 + shock));
}

/**
 * M/G/1 waiting time, `base · (1 + ρ/(1−ρ))`.
 *
 * The term is convex and unbounded as utilisation approaches 1: going from 70%
 * to 80% adds about a third of the base wait, 80% to 90% adds a full one, and
 * 90% to 95% adds two more. That cliff is the lesson, so it is modelled rather
 * than asserted.
 *
 * Capped because a real queue is abandoned rather than infinite, and an
 * unbounded number here would poison the rest of the tick.
 */
export function queueDelay(args: {
  utilisation: number;
  baseTime: number;
  maxTime: number;
  shock: number;
}): number {
  const { baseTime, maxTime, shock } = args;
  // Just under 1: at exactly 1 the formula divides by zero, and the honest
  // reading of full utilisation is "as bad as this queue gets", not NaN.
  const rho = clamp(args.utilisation, 0, 0.999);
  const wait = baseTime * (1 + rho / (1 - rho));
  return clamp(wait * (1 + shock), 0, maxTime);
}

/** A proportion in (0,1) — yield, conversion, response rate. */
export function betaYield(rng: Rng, alpha: number, beta: number): number {
  return betaDraw(rng, alpha, beta);
}

/**
 * Bayesian update of a Beta belief.
 *
 * The counterparty holds a belief about how you behave, as a Beta posterior
 * whose strength is how much evidence it has. One good month after a bad year
 * barely moves it; a run of bad months moves it a long way. `decay` forgets old
 * evidence so a relationship can eventually recover, which is what stops the
 * first month from deciding the whole run.
 *
 * This is the ONLY place trust changes, and it contains no threshold — there is
 * deliberately no "if trust < x". The quote worsens because the posterior fell
 * and the utility that reads it fell with it.
 */
export function bayesBeliefUpdate(args: {
  prior: number;
  observed: number;
  priorStrength: number;
  decay: number;
}): number {
  const { observed, priorStrength, decay } = args;
  const prior = clamp(args.prior, 0.001, 0.999);
  const strength = Math.max(1, priorStrength) * (1 - clamp(decay, 0, 0.99));

  // Posterior mean of Beta(a + k, b + n − k) with one observation of weight 1.
  const alpha = prior * strength;
  const beta = (1 - prior) * strength;
  const evidence = clamp(observed, 0, 1);
  return clamp((alpha + evidence) / (alpha + beta + 1), 0.001, 0.999);
}

/**
 * Evaluate one mechanism against the current state.
 *
 * `shocks` are the correlated normals for this tick, consumed positionally in
 * the order the mechanisms are declared — which is what makes a bad demand
 * month and a bad supply month arrive together rather than by coincidence.
 */
export function applyMechanism(args: {
  spec: MechanismSpec;
  state: Record<string, number>;
  regime: RegimeConfig;
  shock: number;
  shockSd: number;
  rng: Rng;
}): MechanismResult {
  const { spec, state, regime, shock, shockSd, rng } = args;
  const percentileOf = (value: number) => normalPercentile(value, 0, Math.max(shockSd, 1e-9));

  switch (spec.kind) {
    case "elasticity": {
      const value = elasticityResponse({
        level: state[spec.reads] ?? 0,
        referenceLevel: spec.referenceLevel,
        base: spec.base,
        // A lever that states its own elasticity is not governed by the
        // regime's; see the field's note in `configs/types.ts`.
        elasticity: spec.elasticity ?? regime.elasticity,
        multiplier: regime.demandMultiplier,
        exponentSign: spec.exponentSign,
        shock: shock * regime.noiseSigma,
      });
      return {
        writes: spec.writes,
        value,
        draw: { name: spec.shockName, value: shock, percentile: percentileOf(shock) },
      };
    }
    case "queue": {
      const value = queueDelay({
        utilisation: state[spec.reads] ?? 0,
        baseTime: spec.baseTime,
        maxTime: spec.maxTime,
        shock: shock * spec.shockScale,
      });
      return {
        writes: spec.writes,
        value,
        draw: { name: spec.shockName, value: shock, percentile: percentileOf(shock) },
      };
    }
    case "betaYield": {
      const value = betaYield(rng, spec.alpha, spec.beta);
      // Percentile against its own Beta mean, so a bad yield is recognisable as
      // a tail event without the scenario library knowing the distribution.
      const mean = spec.alpha / (spec.alpha + spec.beta);
      const variance =
        (spec.alpha * spec.beta) /
        ((spec.alpha + spec.beta) ** 2 * (spec.alpha + spec.beta + 1));
      return {
        writes: spec.writes,
        value,
        draw: {
          name: spec.shockName,
          value,
          percentile: normalPercentile(value, mean, Math.sqrt(variance)),
        },
      };
    }
    case "bayesBelief": {
      const value = bayesBeliefUpdate({
        prior: state[spec.writes] ?? 0.5,
        observed: state[spec.reads] ?? 0.5,
        priorStrength: spec.priorStrength,
        decay: spec.decay,
      });
      return { writes: spec.writes, value, draw: null };
    }
  }
}
