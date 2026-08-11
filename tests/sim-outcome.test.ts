import { describe, expect, it } from "vitest";
import {
  allocationFits,
  bestScheduleFor,
  finalValue,
  fundingFor,
  pathsForFunding,
  pathsForSchedule,
  runOutcome,
  runSchedule,
  totalChange,
  totalsByIntervention,
} from "@/lib/sim/outcome";
import type { SimAllocationLine } from "@/lib/sim/types";
import { BEST_ALLOCATION, fixtureScenario } from "./sim-fixture";

describe("totalsByIntervention", () => {
  it("sums duplicate lines for the same intervention", () => {
    const totals = totalsByIntervention([
      { interventionId: "iv-payout", sprints: 1, rupees: 100 },
      { interventionId: "iv-payout", sprints: 1, rupees: 300 },
    ]);
    expect(totals.get("iv-payout")).toEqual({ sprints: 2, rupees: 400 });
  });
});

describe("fundingFor", () => {
  it("fully funds an intervention that got everything it asked for", () => {
    const { ratios, funding, stalled } = fundingFor(fixtureScenario(), BEST_ALLOCATION);
    expect(ratios["iv-payout"]).toBe(1);
    expect(funding["iv-payout"].shipped).toBe(true);
    expect(stalled).toEqual([]);
  });

  it("takes the weakest cost dimension, not the average", () => {
    // All the sprints, a quarter of the money: a quarter of the work gets done.
    const { ratios } = fundingFor(fixtureScenario(), [
      { interventionId: "iv-payout", sprints: 2, rupees: 100 },
    ]);
    expect(ratios["iv-payout"]).toBeCloseTo(0.25);
  });

  it("stalls an intervention funded below its minimum, and still spends the money", () => {
    const { ratios, funding, stalled } = fundingFor(fixtureScenario(), [
      { interventionId: "iv-rebuild", sprints: 2, rupees: 200 },
    ]);
    expect(ratios["iv-rebuild"]).toBe(0);
    expect(stalled).toEqual(["iv-rebuild"]);
    // The money is gone even though nothing shipped, and the record says so
    // rather than leaving the debrief to infer it from a zero.
    expect(funding["iv-rebuild"]).toMatchObject({ shipped: false, rupees: 200 });
  });

  it("leaves an unfunded intervention out entirely", () => {
    const { ratios, funding } = fundingFor(fixtureScenario(), BEST_ALLOCATION);
    expect(ratios["iv-discount"]).toBeUndefined();
    expect(funding["iv-discount"]).toBeUndefined();
  });

  it("never funds above 1, however much is thrown at it", () => {
    const { ratios } = fundingFor(fixtureScenario(), [
      { interventionId: "iv-payout", sprints: 3, rupees: 700 },
    ]);
    expect(ratios["iv-payout"]).toBe(1);
  });

  it("records how far past the ask the money went, uncapped", () => {
    // The ratio saturates at 1 and forgets. `askMultiple` is what the v2 curve
    // reads and what tells a debrief the second ₹350 bought nothing.
    const { ratios, funding } = fundingFor(fixtureScenario(), [
      { interventionId: "iv-payout", sprints: 2, rupees: 700 },
    ]);
    expect(ratios["iv-payout"]).toBe(1);
    expect(funding["iv-payout"].askMultiple).toBeCloseTo(1.75);
  });
});

describe("runOutcome", () => {
  it("starts every path at today's baseline", () => {
    const outcome = runOutcome(fixtureScenario(), BEST_ALLOCATION);
    expect(outcome.paths.orders[0]).toBe(1000);
    expect(outcome.doNothing.orders[0]).toBe(1000);
    expect(outcome.best.orders[0]).toBe(1000);
  });

  it("projects one value per quarter plus the baseline", () => {
    const scenario = fixtureScenario();
    const outcome = runOutcome(scenario, BEST_ALLOCATION);
    expect(outcome.paths.orders).toHaveLength(scenario.horizonQuarters + 1);
  });

  it("lets an untreated problem compound, so doing nothing is not free", () => {
    const outcome = runOutcome(fixtureScenario(), []);
    // -5% compounding over two quarters.
    expect(outcome.doNothing.orders[1]).toBeCloseTo(950);
    expect(outcome.doNothing.orders[2]).toBeCloseTo(902.5);
  });

  it("beats do-nothing when the funded bet addresses the real cause", () => {
    const outcome = runOutcome(fixtureScenario(), BEST_ALLOCATION);
    expect(finalValue(outcome.paths, "orders")).toBeGreaterThan(
      finalValue(outcome.doNothing, "orders"),
    );
  });

  it("gives an off-target bet its weaker effects", () => {
    const scenario = fixtureScenario();
    const onTarget = runOutcome(scenario, [
      { interventionId: "iv-payout", sprints: 2, rupees: 400 },
    ]);
    const offTarget = runOutcome(scenario, [
      { interventionId: "iv-discount", sprints: 1, rupees: 300 },
    ]);
    expect(finalValue(onTarget.paths, "orders")).toBeGreaterThan(
      finalValue(offTarget.paths, "orders"),
    );
  });

  it("charges the off-target bet in margin while it buys orders", () => {
    const scenario = fixtureScenario();
    const discounting = runOutcome(scenario, [
      { interventionId: "iv-discount", sprints: 1, rupees: 300 },
    ]);
    // Orders up against doing nothing...
    expect(finalValue(discounting.paths, "orders")).toBeGreaterThan(
      finalValue(discounting.doNothing, "orders"),
    );
    // ...and cost per order up too, which is the lesson.
    expect(finalValue(discounting.paths, "cpo")).toBeGreaterThan(
      finalValue(discounting.doNothing, "cpo"),
    );
  });

  // The property that makes an allocation a set of decisions rather than a
  // sequence of them.
  it("does not depend on the order of the allocation lines", () => {
    const scenario = fixtureScenario();
    const forwards = runOutcome(scenario, [
      { interventionId: "iv-payout", sprints: 2, rupees: 400 },
      { interventionId: "iv-discount", sprints: 1, rupees: 300 },
    ]);
    const backwards = runOutcome(scenario, [
      { interventionId: "iv-discount", sprints: 1, rupees: 300 },
      { interventionId: "iv-payout", sprints: 2, rupees: 400 },
    ]);
    expect(forwards.paths).toEqual(backwards.paths);
  });

  it("ramps a slow effect in over its stated quarters", () => {
    const scenario = fixtureScenario();
    const outcome = runOutcome(scenario, [
      { interventionId: "iv-rebuild", sprints: 3, rupees: 200 },
    ]);
    const q1 = outcome.paths.orders[1];
    const q2 = outcome.paths.orders[2];
    // Half the effect by Q1, all of it by Q2 — so the gain grows even as drift
    // keeps pulling down.
    expect(q2 / q1).toBeGreaterThan(0.95);
    expect(q1).toBeGreaterThan(outcome.doNothing.orders[1]);
  });

  it("gives a stalled intervention no effect at all", () => {
    const scenario = fixtureScenario();
    const stalledRun = runOutcome(scenario, [
      { interventionId: "iv-rebuild", sprints: 2, rupees: 200 },
    ]);
    expect(stalledRun.stalled).toEqual(["iv-rebuild"]);
    expect(stalledRun.paths.orders).toEqual(stalledRun.doNothing.orders);
  });

  it("cannot be beaten by the run it is the ceiling for", () => {
    const scenario = fixtureScenario();
    const outcome = runOutcome(scenario, [
      { interventionId: "iv-discount", sprints: 1, rupees: 300 },
    ]);
    expect(finalValue(outcome.best, "orders")).toBeGreaterThan(
      finalValue(outcome.paths, "orders"),
    );
  });

  it("is deterministic across repeated runs", () => {
    const scenario = fixtureScenario();
    expect(runOutcome(scenario, BEST_ALLOCATION)).toEqual(runOutcome(scenario, BEST_ALLOCATION));
  });
});

describe("totalChange", () => {
  it("reports the fractional move from baseline to the horizon", () => {
    const outcome = runOutcome(fixtureScenario(), []);
    expect(totalChange(outcome.doNothing, "orders")).toBeCloseTo(-0.0975);
  });
});

describe("allocationFits", () => {
  it("accepts an allocation inside the budget", () => {
    expect(allocationFits(fixtureScenario(), BEST_ALLOCATION)).toBe(true);
  });

  it("rejects one that overspends either currency", () => {
    const scenario = fixtureScenario();
    expect(
      allocationFits(scenario, [{ interventionId: "iv-payout", sprints: 9, rupees: 400 }]),
    ).toBe(false);
    expect(
      allocationFits(scenario, [{ interventionId: "iv-payout", sprints: 2, rupees: 9000 }]),
    ).toBe(false);
  });
});

// ─── Multi-period: the turnaround format ───────────────────────────────────

/**
 * `runSchedule` is what makes a format that allocates more than once possible.
 * These pin the three rules that separate it from four independent guesses, plus
 * the invariants it inherits and must not lose.
 */
describe("pathsForSchedule", () => {
  const scenario = fixtureScenario({ horizonQuarters: 4 });
  const payout: SimAllocationLine = { interventionId: "iv-payout", sprints: 2, rupees: 400 };

  it("ignores capacity committed in the current period — you see the quarter you already bought", () => {
    // Funded in period 0, so period 0 itself cannot have moved.
    const paths = pathsForSchedule(scenario, [[payout]]);
    expect(paths.orders[0]).toBe(1000);
    expect(paths.orders[1]).toBeGreaterThan(1000);
  });

  /**
   * A level-change effect on a FLOW converges: once both have fully ramped, an
   * early and a late commitment sit at the same number, and only the path
   * between them differs.
   *
   * This is worth pinning because it is a real constraint on the format rather
   * than a defect. It means a turnaround scored purely on the final value of a
   * flow would make sequencing worth nothing — the exact mistake this test
   * exists to stop someone making later. The scenario answers it by putting a
   * `stock` at the north star (see below); the scorer answers it by reading the
   * whole path.
   */
  it("moves the path, not the endpoint, when the north star is a flow", () => {
    const early = pathsForSchedule(scenario, [[payout], [], [], []]);
    const late = pathsForSchedule(scenario, [[], [], [payout], []]);

    expect(finalValue(early, "orders")).toBeCloseTo(finalValue(late, "orders"), 6);
    // The quarters in between are where the difference lives.
    expect(early.orders[2]).toBeGreaterThan(late.orders[2]);
  });

  /**
   * …and with a stock it DOES change the endpoint, because a stock integrates
   * its flows: every period spent un-fixed is permanently lost from the balance.
   * This is the property the cash-runway scenario is built on, and the reason
   * `stock` had to land before this format could.
   */
  it("changes the endpoint when the north star accumulates", () => {
    const banked = fixtureScenario({
      horizonQuarters: 4,
      drivers: [
        ...fixtureScenario().drivers,
        {
          id: "zero",
          kind: "constant",
          label: "Nothing out",
          unit: "count",
          goodDirection: "down",
          value: 0,
        },
        {
          id: "banked",
          kind: "stock",
          label: "Orders banked",
          unit: "count",
          goodDirection: "up",
          initial: 0,
          inflow: "orders",
          outflow: "zero",
        },
      ],
    });

    const early = pathsForSchedule(banked, [[payout], [], [], []]);
    const late = pathsForSchedule(banked, [[], [], [payout], []]);
    expect(finalValue(early, "banked")).toBeGreaterThan(finalValue(late, "banked"));
  });

  it("accumulates capacity across periods toward one intervention", () => {
    const half = { interventionId: "iv-payout", sprints: 1, rupees: 200 };
    // One sprint is below minSprints, so the first period buys nothing at all;
    // only once the second lands does the pair clear the bar and start working.
    const split = pathsForSchedule(scenario, [[half], [half], [], []]);
    const idle = pathsForSchedule(scenario, [[], [], [], []]);
    const whole = pathsForSchedule(scenario, [[payout], [], [], []]);

    expect(finalValue(split, "orders")).toBeGreaterThan(finalValue(idle, "orders"));
    expect(finalValue(whole, "orders")).toBeGreaterThanOrEqual(finalValue(split, "orders"));
  });

  it("is deterministic", () => {
    const a = pathsForSchedule(scenario, [[payout], [], [], []]);
    const b = pathsForSchedule(scenario, [[payout], [], [], []]);
    expect(a).toEqual(b);
  });

  it("is order-independent within a period", () => {
    const other: SimAllocationLine = { interventionId: "iv-discount", sprints: 1, rupees: 300 };
    const ab = pathsForSchedule(scenario, [[payout, other], [], [], []]);
    const ba = pathsForSchedule(scenario, [[other, payout], [], [], []]);
    expect(ab).toEqual(ba);
  });

  it("still makes doing nothing cost something", () => {
    const drifting = fixtureScenario({
      horizonQuarters: 4,
      drift: [{ driver: "orders", deltaPct: -0.1 }],
    });
    const idle = pathsForSchedule(drifting, [[], [], [], []]);
    expect(finalValue(idle, "orders")).toBeLessThan(idle.orders[0]);
  });

  it("matches the single-shot projection when everything is committed up front", () => {
    // The war room is the degenerate case of the same model, and that has to
    // remain literally true or the two formats are not comparable.
    const scheduled = pathsForSchedule(scenario, [[payout]]);
    const oneShot = pathsForFunding(scenario, fundingFor(scenario, [payout]).funding);
    expect(finalValue(scheduled, "orders")).toBeCloseTo(finalValue(oneShot, "orders"), 6);
  });
});

describe("runSchedule", () => {
  const scenario = fixtureScenario({ horizonQuarters: 4 });
  const payout: SimAllocationLine = { interventionId: "iv-payout", sprints: 2, rupees: 400 };

  it("reports the run, the do-nothing counterfactual and the ceiling", () => {
    const result = runSchedule(scenario, [[payout], [], [], []]);
    expect(finalValue(result.paths, "orders")).toBeGreaterThan(
      finalValue(result.doNothing, "orders"),
    );
    expect(result.best.orders.length).toBe(scenario.horizonQuarters + 1);
  });

  it("falls back to spending the best allocation in period zero", () => {
    expect(bestScheduleFor(scenario)).toEqual([scenario.bestAllocation]);
  });

  it("uses an authored best sequence when there is one", () => {
    const sequenced = fixtureScenario({
      horizonQuarters: 4,
      bestSchedule: [[payout], [], [], []],
    });
    expect(bestScheduleFor(sequenced)).toEqual([[payout], [], [], []]);
  });

  it("still records capacity that never cleared its minimum", () => {
    const stalled = runSchedule(scenario, [[{ interventionId: "iv-payout", sprints: 1, rupees: 400 }]]);
    expect(stalled.stalled).toContain("iv-payout");
  });
});
