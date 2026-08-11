/**
 * The search that replaced the sweep, and the property that justifies the swap.
 *
 * The cross-check is the important test here: on a scenario whose curves are
 * all linear, the optimum is provably at a corner, and the corners are exactly
 * what `sweepFundableCombos` enumerates. So the new search must find what the
 * old exhaustive one found. If it does not, the search is broken, and no
 * amount of it agreeing with itself would tell us.
 */

import { describe, expect, it } from "vitest";
import { optimiseAllocation, requiredSprints, betterOnNorthStar } from "@/lib/sim/optimise";
import { checkBalance, fullyFundableCombos } from "@/lib/sim/balance";
import { finalValue, runOutcome } from "@/lib/sim/outcome";
import { simConfig } from "@/lib/config/simulation";
import type { SimScenario } from "@/lib/sim/types";
import {
  fixtureScenario,
  v2CostedFixtureScenario,
  v2FixtureScenario,
  v2LinearFixtureScenario,
} from "./sim-fixture";

const northStarOf = (scenario: SimScenario, allocation: Parameters<typeof runOutcome>[1]) =>
  finalValue(runOutcome(scenario, allocation).paths, scenario.northStar);

describe("optimiseAllocation", () => {
  it("matches the exhaustive sweep when the model is linear", () => {
    const scenario = v2LinearFixtureScenario();
    const sweepBest = Math.max(
      ...fullyFundableCombos(fixtureScenario()).map((combo) => northStarOf(scenario, combo)),
    );
    const found = optimiseAllocation(scenario, { mode: "strict" });

    // At least as good — the search may find a part-funded point the sweep
    // cannot express, but it must never find less than the sweep's maximum.
    expect(found.best.northStar).toBeGreaterThanOrEqual(sweepBest - 1e-9);
    expect(found.truncated).toBe(false);
  });

  it("finds an interior optimum once the money is paid for", () => {
    const scenario = v2CostedFixtureScenario();
    const found = optimiseAllocation(scenario, { mode: "strict" });

    // The whole point of the engine change: the best play is no longer to
    // empty the budget. Something is funded, and something is left over.
    expect(found.best.allocation.length).toBeGreaterThan(0);
    expect(found.best.spare.rupees).toBeGreaterThan(0);
  });

  it("makes over-spending pointless on its own, and harmful only once it is paid for", () => {
    // The distinction a pilot scenario has to get right. A flattening benefit
    // means extra money buys almost nothing — but "almost nothing" is still
    // not negative, so on one lever with no cost side, emptying the budget
    // remains weakly optimal. Route the spend into the P&L and the same
    // comparison reverses. That reversal is the decision.
    const on = (scenario: SimScenario, rupees: number) =>
      northStarOf(scenario, [{ interventionId: "iv-payout", sprints: 2, rupees }]);

    const uncosted = v2FixtureScenario();
    expect(on(uncosted, 700)).toBeGreaterThanOrEqual(on(uncosted, 400));

    const costed = v2CostedFixtureScenario();
    expect(on(costed, 700)).toBeLessThan(on(costed, 400));
  });

  it("beats emptying the budget into the on-target lever", () => {
    const scenario = v2CostedFixtureScenario();
    const found = optimiseAllocation(scenario, { mode: "strict" });
    const everything = northStarOf(scenario, [
      { interventionId: "iv-payout", sprints: 2, rupees: scenario.budget.rupees },
    ]);
    expect(found.best.northStar).toBeGreaterThan(everything);
  });

  it("never proposes capacity beyond what makes a thing ship", () => {
    // Capacity does not enter a response curve under v2, so holding more of it
    // than the gate needs is strictly wasteful and no optimum should hold it.
    const scenario = v2FixtureScenario();
    for (const line of optimiseAllocation(scenario, { mode: "strict" }).best.allocation) {
      expect(line.sprints).toBe(requiredSprints(scenario, line.interventionId));
    }
  });

  it("stays inside both budgets", () => {
    const scenario = v2FixtureScenario();
    const { best } = optimiseAllocation(scenario, { mode: "strict" });
    const sprints = best.allocation.reduce((s, l) => s + l.sprints, 0);
    const rupees = best.allocation.reduce((s, l) => s + l.rupees, 0);
    expect(sprints).toBeLessThanOrEqual(scenario.budget.sprints);
    expect(rupees).toBeLessThanOrEqual(scenario.budget.rupees + 1e-9);
  });

  it("respects an intervention's own money cap", () => {
    const base = v2FixtureScenario();
    const scenario = v2FixtureScenario({
      interventions: base.interventions.map((iv) => ({ ...iv, maxAskMultiple: 1 })),
    });
    for (const line of optimiseAllocation(scenario, { mode: "strict" }).best.allocation) {
      const iv = scenario.interventions.find((i) => i.id === line.interventionId)!;
      expect(line.rupees).toBeLessThanOrEqual(iv.cost.rupees + 1e-9);
    }
  });

  it("reports rather than hangs when the search is too big to finish", () => {
    const found = optimiseAllocation(v2FixtureScenario(), { maxEvaluations: 5 });
    expect(found.truncated).toBe(true);
  });

  it("reads the north star in the direction that is good", () => {
    // A scenario whose north star should fall — the search must minimise it,
    // and a comparator that assumed "up" would confidently return the worst
    // play available.
    expect(betterOnNorthStar(v2FixtureScenario(), 10, 5)).toBe(true);
    const downwards = v2FixtureScenario({
      northStar: "cpo",
      drivers: v2FixtureScenario().drivers,
    });
    expect(betterOnNorthStar(downwards, 10, 5)).toBe(false);
  });

  it("finishes a realistic search quickly enough to run on every save", () => {
    const started = Date.now();
    optimiseAllocation(v2FixtureScenario(), { mode: "fast" });
    expect(Date.now() - started).toBeLessThan(400);
  });
});

describe("checkBalance on the v2 engine", () => {
  /**
   * A scenario tuned so the interior optimum genuinely is the authored one.
   * Built by asking the optimiser, which is exactly how a pilot scenario is
   * meant to be authored — the ceiling is derived, not guessed at.
   */
  function balanced(): SimScenario {
    const draft = v2CostedFixtureScenario();
    const found = optimiseAllocation(draft, { mode: "strict" });
    return v2CostedFixtureScenario({ bestAllocation: found.best.allocation });
  }

  it("passes a scenario whose declared ceiling is the one the search finds", () => {
    expect(checkBalance(balanced(), { mode: "strict" })).toEqual([]);
  });

  it("names the better allocation, and hands over a literal to paste", () => {
    const scenario = v2CostedFixtureScenario({
      bestAllocation: [{ interventionId: "iv-payout", sprints: 2, rupees: 40 }],
    });
    const errors = checkBalance(scenario, { mode: "strict" }).join(" | ");
    expect(errors).toMatch(/A better allocation exists/);
    expect(errors).toMatch(/bestAllocation: \[/);
  });

  it("refuses a scenario where spending everything is still the answer", () => {
    // Curves that never flatten: the lever keeps paying linearly right up to
    // its cap, so "max it out" wins and the scenario has no decision in it.
    // This is the check that stops the whole engine change from being
    // cosmetic.
    const base = v2FixtureScenario();
    const scenario = v2FixtureScenario({
      interventions: base.interventions.map((iv) => ({
        ...iv,
        saturation: {
          whenRootCause: { kind: "proportional", slope: 1 },
          otherwise: { kind: "proportional", slope: 1 },
        },
      })),
    });
    const errors = checkBalance(
      { ...scenario, bestAllocation: optimiseAllocation(scenario, { mode: "strict" }).best.allocation },
      { mode: "strict" },
    ).join(" | ");
    expect(errors).toMatch(/spend everything.*is still the play/);
  });

  it("still refuses a scenario with no gradient to grade", () => {
    const base = v2FixtureScenario();
    const scenario = v2FixtureScenario({
      interventions: base.interventions.map((iv) => ({
        ...iv,
        effects: { whenRootCause: [], otherwise: [] },
      })),
    });
    expect(checkBalance(scenario, { mode: "strict" }).join(" | ")).toMatch(/no gradient/);
  });

  it("leaves the v1 path alone", () => {
    // The ten scenarios that did not opt in are still certified by the
    // exhaustive sweep. The toy fixture is deliberately unbalanced, so what
    // this pins is that a v1 scenario still gets the sweep's own vocabulary —
    // whole-cost combinations and spare sprints — and never the search's.
    const errors = checkBalance(fixtureScenario()).join(" | ");
    expect(errors).toMatch(/beats the declared best allocation/);
    expect(errors).toMatch(/sprints spare/);
    expect(errors).not.toMatch(/A better allocation exists/);
  });
});
