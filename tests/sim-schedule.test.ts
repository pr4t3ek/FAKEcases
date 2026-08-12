/**
 * Committing over several periods, and the asymmetry that makes it a decision.
 *
 * Money is a pool and capacity is a rate. If both pooled, the optimum would be
 * to wait and see everything; if both refreshed, every period would be
 * independent and there would be nothing to husband. The tests below are that
 * sentence, made falsifiable — plus the two properties a schedule inherits from
 * the one-shot engine and must not lose: a single-period schedule is exactly a
 * single commit, and committing early is worth something real.
 */

import { describe, expect, it } from "vitest";
import {
  capacityRemaining,
  decisionPeriodsIn,
  meanCommitPeriod,
  moneyRemaining,
  openPeriodIn,
  scheduleFits,
} from "@/lib/sim/schedule";
import { finalValue, runOutcome, runSchedule } from "@/lib/sim/outcome";
import { scoreAdaptation } from "@/lib/sim/score";
import { optimiseSchedule } from "@/lib/sim/optimise";
import { checkBalance } from "@/lib/sim/balance";
import type { SimAllocationLine, SimScenario } from "@/lib/sim/types";
import { BEST_ALLOCATION, v2CostedFixtureScenario, v2FixtureScenario } from "./sim-fixture";

const periodic = (over: Partial<SimScenario> = {}) =>
  v2FixtureScenario({ decisionPeriods: 3, horizonQuarters: 4, ...over });

const payout = (rupees: number, sprints = 2): SimAllocationLine => ({
  interventionId: "iv-payout",
  sprints,
  rupees,
});
const discount = (rupees: number): SimAllocationLine => ({
  interventionId: "iv-discount",
  sprints: 1,
  rupees,
});

describe("the period cursor", () => {
  it("treats an absent decisionPeriods as a single commit", () => {
    expect(decisionPeriodsIn(v2FixtureScenario())).toBe(1);
  });

  it("derives which period is open from what has been committed", () => {
    const scenario = periodic();
    expect(openPeriodIn(scenario, [])).toBe(0);
    expect(openPeriodIn(scenario, [[], []])).toBe(2);
    expect(openPeriodIn(scenario, [[], [], []])).toBeNull();
  });
});

describe("money is a pool", () => {
  it("draws down across every period rather than refreshing", () => {
    const scenario = periodic();
    expect(moneyRemaining(scenario, [[payout(200)], [payout(300)]])).toBe(
      scenario.budget.rupees - 500,
    );
  });

  it("refuses a schedule whose total outruns the budget, however it is split", () => {
    const scenario = periodic();
    // Each period is affordable on its own; together they are not, and a
    // per-period check could not see it.
    const fit = scheduleFits(scenario, [[payout(400)], [payout(400)]]);
    expect(fit.ok).toBe(false);
    expect(fit.error).toMatch(/one pool for the whole run/);
  });
});

describe("capacity is a rate", () => {
  it("refreshes every period, so the same team can work every quarter", () => {
    const scenario = periodic();
    // Three periods at the full capacity budget is fine; three periods at the
    // full *money* budget would not be.
    expect(scheduleFits(scenario, [[payout(100)], [payout(100)], [payout(100)]]).ok).toBe(true);
  });

  it("cannot be saved up and spent twice over in one period", () => {
    const scenario = periodic();
    const fit = scheduleFits(scenario, [[payout(100, 3), discount(50)]]);
    expect(fit.ok).toBe(false);
    expect(fit.error).toMatch(/cannot be saved up/);
  });

  it("reports what is left in the period being decided", () => {
    const scenario = periodic();
    expect(capacityRemaining(scenario, [payout(100)])).toBe(scenario.budget.sprints - 2);
  });
});

describe("a schedule projects like an allocation", () => {
  it("reproduces the single commit exactly when there is only one period", () => {
    // The degenerate case, and the proof that adding a scheduler did not
    // quietly change the model underneath it.
    const scenario = v2FixtureScenario({ horizonQuarters: 4 });
    expect(runSchedule(scenario, [BEST_ALLOCATION]).paths).toEqual(
      runOutcome(scenario, BEST_ALLOCATION).paths,
    );
  });

  it("makes committing late genuinely worse when the fix is slower than the tail", () => {
    // A fix that takes three quarters to arrive, on a horizon that leaves two
    // after the last decision. Committed in period 0 it lands in full;
    // committed in period 2 it is still arriving when the run ends.
    //
    // The comparison only bites when the ramp outruns the tail, which is why
    // it is spelled out here rather than assumed — see the test below.
    const base = periodic();
    const scenario = v2FixtureScenario({
      decisionPeriods: 3,
      horizonQuarters: 4,
      interventions: base.interventions.map((iv) =>
        iv.id === "iv-payout"
          ? {
              ...iv,
              effects: {
                ...iv.effects,
                whenRootCause: [{ driver: "orders", deltaPct: 0.2, rampQuarters: 3 }],
              },
            }
          : iv,
      ),
    });
    const early = finalValue(runSchedule(scenario, [[payout(400)], [], []]).paths, "orders");
    const late = finalValue(runSchedule(scenario, [[], [], [payout(400)]]).paths, "orders");
    expect(early).toBeGreaterThan(late);
  });

  it("is honest that an instant fix does not care when it was funded", () => {
    // Worth pinning rather than leaving to be discovered. An effect with no
    // ramp is fully arrived one quarter after it ships, and `scoreOutcome`
    // reads the final quarter — so on a scenario of instantaneous levers the
    // outcome is genuinely identical whenever you committed.
    //
    // That is not a bug to paper over in the projection; it is the reason
    // `scoreAdaptation` exists. Timing is priced where it is real — in the
    // rubric — rather than smuggled into a model that says otherwise. A
    // scenario that wants timing to move the *number* has to author a ramp or
    // a stock, which is a content decision and should look like one.
    const scenario = periodic();
    const early = finalValue(runSchedule(scenario, [[payout(400)], [], []]).paths, "orders");
    const late = finalValue(runSchedule(scenario, [[], [], [payout(400)]]).paths, "orders");
    expect(early).toBe(late);
    expect(scoreAdaptation(scenario, [[payout(400)], [], []])).toBeGreaterThan(
      scoreAdaptation(scenario, [[], [], [payout(400)]]),
    );
  });

  it("charges the P&L only for money already committed", () => {
    // Rupees still in the pool have not been spent, and a schedule that holds
    // them back must not be billed as though it had.
    const scenario = v2CostedFixtureScenario({ decisionPeriods: 3, horizonQuarters: 4 });
    const held = finalValue(runSchedule(scenario, [[payout(200)], [], []]).paths, "margin");
    const spent = finalValue(runSchedule(scenario, [[payout(200)], [payout(400)], []]).paths, "margin");
    expect(held).toBeGreaterThan(spent);
  });

  it("applies the response curve, not the linear ratio", () => {
    // Doubling the money behind a saturating lever must buy less than twice as
    // much, exactly as it does on the one-shot path.
    const scenario = periodic();
    const at = (rupees: number) =>
      finalValue(runSchedule(scenario, [[payout(rupees)], [], []]).paths, "orders");
    const first = at(200) - at(0);
    const second = at(400) - at(200);
    expect(second).toBeGreaterThan(0);
    expect(second).toBeLessThan(first);
  });

  it("draws one weather table for the whole schedule", () => {
    const scenario = periodic({
      noise: { drivers: [{ driver: "orders", sigma: 0.04 }], driftSigma: 0.2 },
    });
    const a = runSchedule(scenario, [[payout(400)], [], []], { seed: "s1" });
    const b = runSchedule(scenario, [[payout(400)], [], []], { seed: "s2" });
    expect(a.paths).not.toEqual(b.paths);
    expect(a.expected).toEqual(b.expected);
  });
});

describe("scoreAdaptation", () => {
  const scenario = periodic();

  it("stays neutral on a run with nothing to adapt", () => {
    expect(scoreAdaptation(scenario, [BEST_ALLOCATION])).toBe(50);
  });

  it("rewards backing the real cause early", () => {
    const early = scoreAdaptation(scenario, [[payout(400)], [], []]);
    const late = scoreAdaptation(scenario, [[], [], [payout(400)]]);
    expect(early).toBeGreaterThan(late);
  });

  it("never scores a late-but-correct read as a wrong one", () => {
    // Timeliness is a multiplier with a floor, not a subtraction. Arriving at
    // the right answer in the final period is late, not wrong.
    expect(scoreAdaptation(scenario, [[], [], [payout(400)]])).toBeGreaterThan(30);
  });

  it("punishes repeating a wrong bet with the evidence already on screen", () => {
    const once = scoreAdaptation(scenario, [[discount(200)], [payout(400)], []]);
    const twice = scoreAdaptation(scenario, [[discount(200)], [discount(200)], [payout(200)]]);
    expect(twice).toBeLessThan(once);
  });

  it("gives nothing to a schedule that committed nothing at all", () => {
    expect(scoreAdaptation(scenario, [[], [], []])).toBe(0);
  });
});

describe("certifying a multi-period scenario", () => {
  /** A periodic scenario whose ceiling is whatever the beam search finds. */
  function balanced(): SimScenario {
    const draft = v2CostedFixtureScenario({ decisionPeriods: 3, horizonQuarters: 4 });
    const found = optimiseSchedule(draft, { mode: "strict" });
    return { ...draft, bestSchedule: found.best.schedule };
  }

  it("accepts a schedule the search cannot beat", () => {
    expect(checkBalance(balanced(), { mode: "strict" })).toEqual([]);
  });

  it("names a better sequence when the declared one is beatable", () => {
    const scenario = v2CostedFixtureScenario({
      decisionPeriods: 3,
      horizonQuarters: 4,
      // Everything held until the last possible moment, on a fix that ramps.
      bestSchedule: [[], [], [payout(100)]],
    });
    const errors = checkBalance(scenario, { mode: "strict" }).join(" | ");
    expect(errors).toMatch(/A better schedule exists/);
    expect(errors).toMatch(/P0:/);
  });

  it("still refuses a scenario with no gradient to grade", () => {
    const base = v2CostedFixtureScenario({ decisionPeriods: 3, horizonQuarters: 4 });
    const flat = {
      ...base,
      interventions: base.interventions.map((iv) => ({
        ...iv,
        effects: { whenRootCause: [], otherwise: [] },
      })),
    };
    expect(checkBalance(flat, { mode: "strict" }).join(" | ")).toMatch(/no gradient/);
  });
});
