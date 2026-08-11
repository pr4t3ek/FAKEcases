/**
 * Finding the best play, when money is continuous.
 *
 * `checkBalance`'s sweep enumerates every subset of interventions taken at
 * **exactly its asking price**, which was the whole search space while effects
 * were linear in money: with a linear response there is never a reason to
 * part-fund anything, so the optimum is always a corner and corners are
 * countable.
 *
 * A saturating response moves the optimum off the corners. The best play under
 * v2 is routinely "fund this one to about two-thirds of its ask, that one to a
 * third, and leave the rest in the bank" — an interior point the old sweep
 * cannot see and would therefore certify a ceiling below.
 *
 * So this searches the space the student actually plays in:
 *
 *   1. **Capacity is a gate, and gates are discrete.** An intervention takes
 *      either nothing or exactly what it needs to ship (`minSprints`, or its
 *      full cost when it names no minimum) — capacity past that buys nothing
 *      under v2, so no optimum ever holds it. That makes stage one the same
 *      cheap subset walk as before, pruned on the capacity budget.
 *   2. **Money is continuous, so it gets a grid.** For each surviving subset,
 *      every lattice point of the money simplex at a coarse resolution, then
 *      coordinate ascent at a fine one from the best few. The grid is what makes
 *      this honest about shape: nothing here assumes the north star is concave
 *      in the money vector, and it is not — the driver graph multiplies,
 *      divides and takes minima. Concavity of each *response* is why the
 *      refinement converges quickly, not why the answer is right.
 *
 * **This is a search, not a proof**, and the distinction is worth keeping
 * visible: the old sweep was exhaustive over a small space, this one is
 * thorough over a very large one. What it buys is that the space it searches is
 * the space a candidate can actually reach, which the old one was not.
 *
 * The unspent bucket is deliberate. Leaving money in the bank is a legal play
 * under v2 and frequently the correct one, so the enumeration allocates *at
 * most* the budget rather than exactly it.
 */

import { simConfig } from "@/lib/config/simulation";
import { finalValue, pathsForFunding, fundingFor } from "./outcome";
import type { InterventionId, SimAllocationLine, SimScenario } from "./types";

export interface OptimiseOptions {
  /**
   * `fast` is for the admin save path, where an author is waiting; `strict` is
   * for the test suite, where being sure matters more than a second.
   */
  mode?: "fast" | "strict";
  /** Money lattice steps for the exhaustive pass. */
  gridCoarse?: number;
  /** Money lattice steps for the refinement pass. */
  gridFine?: number;
  /** How many coarse winners to refine. */
  keep?: number;
  /** Hard stop, so a pathological scenario reports rather than hangs. */
  maxEvaluations?: number;
}

export interface AllocationCandidate {
  allocation: SimAllocationLine[];
  /** The north star at the end of the horizon. */
  northStar: number;
  spare: { sprints: number; rupees: number };
}

export interface OptimiseResult {
  best: AllocationCandidate;
  /** Distinct runners-up, best first, for an author deciding what to adopt. */
  runnersUp: AllocationCandidate[];
  evaluations: number;
  /** True when `maxEvaluations` stopped the search. It proves nothing. */
  truncated: boolean;
  grid: { coarse: number; fine: number };
}

const DEFAULTS = {
  fast: { gridCoarse: 8, gridFine: 48, keep: 6, maxEvaluations: 400_000 },
  strict: { gridCoarse: 12, gridFine: 96, keep: 10, maxEvaluations: 2_000_000 },
} as const;

/**
 * The capacity that makes an intervention ship.
 *
 * Under v2 anything above this is wasted — capacity does not enter a response
 * curve — so the search never considers it, and an author who wants capacity to
 * matter beyond the gate should price it into `minSprints`.
 */
export function requiredSprints(scenario: SimScenario, id: InterventionId): number {
  const iv = scenario.interventions.find((i) => i.id === id);
  if (!iv) return 0;
  return iv.minSprints ?? iv.cost.sprints;
}

/** Is `a` better than `b` on the north star, given which way is good? */
export function betterOnNorthStar(scenario: SimScenario, a: number, b: number): boolean {
  const driver = scenario.drivers.find((d) => d.id === scenario.northStar);
  return driver?.goodDirection === "down" ? a < b : a > b;
}

/** Every set of interventions the capacity budget can ship at once. */
function shippableSubsets(scenario: SimScenario): InterventionId[][] {
  const ids = scenario.interventions.map((i) => i.id);
  const out: InterventionId[][] = [];

  const walk = (index: number, sprintsLeft: number, taken: InterventionId[]) => {
    if (index === ids.length) {
      out.push([...taken]);
      return;
    }
    walk(index + 1, sprintsLeft, taken);

    const need = requiredSprints(scenario, ids[index]);
    if (need <= sprintsLeft) {
      taken.push(ids[index]);
      walk(index + 1, sprintsLeft - need, taken);
      taken.pop();
    }
  };

  walk(0, scenario.budget.sprints, []);
  return out;
}

/** Money cap for one intervention, in rupees. */
function moneyCap(scenario: SimScenario, id: InterventionId): number {
  const iv = scenario.interventions.find((i) => i.id === id)!;
  return iv.cost.rupees * (iv.maxAskMultiple ?? simConfig.maxAskMultiple);
}

function linesFor(
  scenario: SimScenario,
  subset: InterventionId[],
  money: number[],
): SimAllocationLine[] {
  const lines: SimAllocationLine[] = [];
  for (let i = 0; i < subset.length; i++) {
    const sprints = requiredSprints(scenario, subset[i]);
    if (sprints <= 0 && money[i] <= 0) continue;
    lines.push({ interventionId: subset[i], sprints, rupees: money[i] });
  }
  return lines;
}

function candidateFor(
  scenario: SimScenario,
  subset: InterventionId[],
  money: number[],
): AllocationCandidate {
  const allocation = linesFor(scenario, subset, money);
  const { funding } = fundingFor(scenario, allocation);
  const northStar = finalValue(pathsForFunding(scenario, funding), scenario.northStar);
  const spentSprints = allocation.reduce((s, l) => s + l.sprints, 0);
  const spentMoney = allocation.reduce((s, l) => s + l.rupees, 0);
  return {
    allocation,
    northStar,
    spare: {
      sprints: scenario.budget.sprints - spentSprints,
      rupees: scenario.budget.rupees - spentMoney,
    },
  };
}

/**
 * The best allocation this search can find.
 *
 * Two passes per subset: an exhaustive lattice walk, then coordinate ascent
 * from the strongest handful of lattice points found anywhere. The second pass
 * is what recovers the precision the first gives up, without paying for a fine
 * lattice across every subset.
 */
export function optimiseAllocation(
  scenario: SimScenario,
  opts: OptimiseOptions = {},
): OptimiseResult {
  const mode = opts.mode ?? "fast";
  const tuning = DEFAULTS[mode];
  const gridCoarse = opts.gridCoarse ?? tuning.gridCoarse;
  const gridFine = opts.gridFine ?? tuning.gridFine;
  const keep = opts.keep ?? tuning.keep;
  const maxEvaluations = opts.maxEvaluations ?? tuning.maxEvaluations;

  let evaluations = 0;
  let truncated = false;
  const scored: { subset: InterventionId[]; money: number[]; candidate: AllocationCandidate }[] = [];

  const evaluate = (subset: InterventionId[], money: number[]) => {
    evaluations++;
    return candidateFor(scenario, subset, money);
  };

  // ── Pass one: every lattice point of every shippable subset ──────────────
  const budget = scenario.budget.rupees;
  const unit = budget / gridCoarse;

  for (const subset of shippableSubsets(scenario)) {
    if (truncated) break;

    // Per-intervention cap in coarse units, rounded DOWN so a lattice point can
    // never sit above a cap the student's own slider would refuse.
    const caps = subset.map((id) => Math.floor(moneyCap(scenario, id) / unit + 1e-9));
    const money: number[] = new Array(subset.length).fill(0);

    const walk = (index: number, unitsLeft: number) => {
      if (truncated) return;
      if (index === subset.length) {
        if (evaluations >= maxEvaluations) {
          truncated = true;
          return;
        }
        scored.push({
          subset,
          money: [...money],
          candidate: evaluate(subset, money),
        });
        return;
      }
      const highest = Math.min(unitsLeft, caps[index]);
      for (let units = 0; units <= highest; units++) {
        money[index] = units * unit;
        walk(index + 1, unitsLeft - units);
        if (truncated) return;
      }
      money[index] = 0;
    };

    walk(0, gridCoarse);

    /**
     * The corner, evaluated exactly.
     *
     * A lattice at any resolution generally misses "every intervention at
     * precisely its asking price" — ₹400 and ₹300 out of a ₹700 budget are not
     * multiples of ₹700/12 — and that corner is the entire search space of the
     * sweep this replaces. Missing it would mean the new search could certify a
     * ceiling the old one had already disproved, which is the one regression
     * that would make the swap indefensible. So it is seeded rather than hoped
     * for, and `tests/sim-optimise.test.ts` cross-checks the two.
     */
    const atAsk = subset.map(
      (id) => scenario.interventions.find((i) => i.id === id)!.cost.rupees,
    );
    if (atAsk.reduce((s, m) => s + m, 0) <= budget && !truncated) {
      scored.push({ subset, money: atAsk, candidate: evaluate(subset, atAsk) });
    }
  }

  const byValue = (
    a: { candidate: AllocationCandidate },
    b: { candidate: AllocationCandidate },
  ) => (betterOnNorthStar(scenario, a.candidate.northStar, b.candidate.northStar) ? -1 : 1);

  scored.sort(byValue);

  // ── Pass two: coordinate ascent from the strongest lattice points ────────
  //
  // One fine step moved from one intervention to another, or added from the
  // unspent pool, or returned to it — that last direction matters, because
  // under saturation "spend less" is a real improvement and a search that can
  // only move money sideways would never find it.
  const fineStep = budget / gridFine;
  const refined: AllocationCandidate[] = [];

  for (const seed of scored.slice(0, keep)) {
    if (truncated) break;
    const { subset } = seed;
    let money = [...seed.money];
    let current = seed.candidate;

    let improved = true;
    while (improved && !truncated) {
      improved = false;
      for (let i = 0; i < subset.length; i++) {
        for (const delta of [fineStep, -fineStep]) {
          const next = [...money];
          next[i] = next[i] + delta;
          if (next[i] < 0) continue;
          if (next[i] > moneyCap(scenario, subset[i])) continue;
          if (next.reduce((s, m) => s + m, 0) > budget) continue;

          if (evaluations >= maxEvaluations) {
            truncated = true;
            break;
          }
          const candidate = evaluate(subset, next);
          if (betterOnNorthStar(scenario, candidate.northStar, current.northStar)) {
            money = next;
            current = candidate;
            improved = true;
          }
        }
        if (truncated) break;
      }
    }
    refined.push(current);
  }

  const all = [...refined, ...scored.map((s) => s.candidate)].sort((a, b) =>
    betterOnNorthStar(scenario, a.northStar, b.northStar) ? -1 : 1,
  );

  // Dedupe by which interventions were funded: an author choosing what to adopt
  // wants distinct plays, not twenty roundings of the same one.
  const seen = new Set<string>();
  const distinct: AllocationCandidate[] = [];
  for (const candidate of all) {
    const key = candidate.allocation
      .map((l) => l.interventionId)
      .sort()
      .join("+");
    if (seen.has(key)) continue;
    seen.add(key);
    distinct.push(candidate);
  }

  return {
    best: all[0],
    runnersUp: distinct.slice(1, 4),
    evaluations,
    truncated,
    grid: { coarse: gridCoarse, fine: gridFine },
  };
}

/**
 * A candidate as a paste-ready `bestAllocation` literal.
 *
 * The point of the search is that retuning is quick: when the optimiser beats
 * the authored ceiling, the fix should be a copy and a paste rather than a
 * morning spent bisecting effect sizes by hand.
 */
export function formatAllocation(candidate: AllocationCandidate): string {
  const lines = candidate.allocation
    .map(
      (l) =>
        `    { interventionId: "${l.interventionId}", sprints: ${l.sprints}, rupees: ${Math.round(l.rupees)} },`,
    )
    .join("\n");
  return `bestAllocation: [\n${lines}\n  ],`;
}
