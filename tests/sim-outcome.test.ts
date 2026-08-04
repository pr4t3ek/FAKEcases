import { describe, expect, it } from "vitest";
import {
  allocationFits,
  finalValue,
  fundingFor,
  runOutcome,
  totalChange,
  totalsByIntervention,
} from "@/lib/sim/outcome";
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
    const { funding, stalled } = fundingFor(fixtureScenario(), BEST_ALLOCATION);
    expect(funding["iv-payout"]).toBe(1);
    expect(stalled).toEqual([]);
  });

  it("takes the weakest cost dimension, not the average", () => {
    // All the sprints, a quarter of the money: a quarter of the work gets done.
    const { funding } = fundingFor(fixtureScenario(), [
      { interventionId: "iv-payout", sprints: 2, rupees: 100 },
    ]);
    expect(funding["iv-payout"]).toBeCloseTo(0.25);
  });

  it("stalls an intervention funded below its minimum, and still spends the money", () => {
    const { funding, stalled } = fundingFor(fixtureScenario(), [
      { interventionId: "iv-rebuild", sprints: 2, rupees: 200 },
    ]);
    expect(funding["iv-rebuild"]).toBe(0);
    expect(stalled).toEqual(["iv-rebuild"]);
  });

  it("leaves an unfunded intervention out entirely", () => {
    const { funding } = fundingFor(fixtureScenario(), BEST_ALLOCATION);
    expect(funding["iv-discount"]).toBeUndefined();
  });

  it("never funds above 1, however much is thrown at it", () => {
    const { funding } = fundingFor(fixtureScenario(), [
      { interventionId: "iv-payout", sprints: 3, rupees: 700 },
    ]);
    expect(funding["iv-payout"]).toBe(1);
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
