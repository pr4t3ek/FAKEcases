/**
 * The weather, and the two properties that let it exist at all.
 *
 * A war room is a deterministic causal model, and both of the things that makes
 * it good — the debrief can say precisely why the number moved, and two
 * candidates can be compared — are worth more than realism. Noise is only
 * defensible because neither is given up:
 *
 *   1. The shocks are drawn from the seed alone, so the same table hits the
 *      run, its counterfactual and its ceiling. Luck cannot be gamed by
 *      choosing differently.
 *   2. Scoring reads the noise-free projection, so playing identically scores
 *      identically however the quarters landed.
 *
 * The tests below are those two sentences, made falsifiable.
 */

import { describe, expect, it } from "vitest";
import { drawShocks, NO_SHOCKS } from "@/lib/sim/noise";
import { finalValue, runOutcome } from "@/lib/sim/outcome";
import { scoreOutcome } from "@/lib/sim/score";
import { validateScenario } from "@/lib/sim/validate";
import type { SimScenario } from "@/lib/sim/types";
import { BEST_ALLOCATION, fixtureScenario, v2FixtureScenario } from "./sim-fixture";

const noisy = (over: Partial<SimScenario> = {}): SimScenario =>
  v2FixtureScenario({
    noise: { drivers: [{ driver: "orders", sigma: 0.05 }], driftSigma: 0.25 },
    ...over,
  });

const HALF = [{ interventionId: "iv-payout", sprints: 2, rupees: 200 }];

describe("drawShocks", () => {
  it("draws nothing without a seed, or without authored noise", () => {
    expect(drawShocks(noisy(), null)).toBe(NO_SHOCKS);
    expect(drawShocks(v2FixtureScenario(), "seed-a")).toBe(NO_SHOCKS);
  });

  it("gives the same table for the same seed", () => {
    expect(drawShocks(noisy(), "seed-a")).toEqual(drawShocks(noisy(), "seed-a"));
  });

  it("gives a different table for a different seed", () => {
    expect(drawShocks(noisy(), "seed-a")).not.toEqual(drawShocks(noisy(), "seed-b"));
  });

  it("never moves the baseline quarter", () => {
    // Quarter 0 is today, and today already happened.
    const shocks = drawShocks(noisy(), "seed-a");
    expect(shocks.drivers.orders[0]).toBe(1);
    expect(shocks.drift[0]).toBe(1);
  });

  it("does not depend on the order the author listed the drivers in", () => {
    const a = noisy({
      noise: {
        drivers: [
          { driver: "orders", sigma: 0.05 },
          { driver: "aov", sigma: 0.03 },
        ],
      },
    });
    const b = noisy({
      noise: {
        drivers: [
          { driver: "aov", sigma: 0.03 },
          { driver: "orders", sigma: 0.05 },
        ],
      },
    });
    expect(drawShocks(a, "seed-a")).toEqual(drawShocks(b, "seed-a"));
  });

  it("takes no allocation, which is what makes it a property of the run", () => {
    // Asserted on the signature, because this is the design constraint the
    // whole approach rests on: if the weather could depend on the decision, it
    // could not be applied to the counterfactual and the ceiling too, and luck
    // would become something to optimise against rather than live with.
    expect(drawShocks.length).toBe(2);
  });
});

describe("a noisy run", () => {
  it("is reproducible: the same seed replays exactly", () => {
    const scenario = noisy();
    expect(runOutcome(scenario, BEST_ALLOCATION, { seed: "run-1" })).toEqual(
      runOutcome(scenario, BEST_ALLOCATION, { seed: "run-1" }),
    );
  });

  it("lands differently under a different seed", () => {
    const scenario = noisy();
    const a = runOutcome(scenario, BEST_ALLOCATION, { seed: "run-1" });
    const b = runOutcome(scenario, BEST_ALLOCATION, { seed: "run-2" });
    expect(a.paths).not.toEqual(b.paths);
  });

  it("expects the same thing whatever the seed", () => {
    const scenario = noisy();
    const a = runOutcome(scenario, BEST_ALLOCATION, { seed: "run-1" });
    const b = runOutcome(scenario, BEST_ALLOCATION, { seed: "run-2" });
    expect(a.expected).toEqual(b.expected);
  });

  it("scores the same whatever the seed — the property a leaderboard needs", () => {
    const scenario = noisy();
    const seeds = ["run-1", "run-2", "run-3", "run-4", "run-5"];
    const scores = seeds.map((seed) =>
      scoreOutcome(scenario, runOutcome(scenario, HALF, { seed })),
    );
    expect(new Set(scores).size).toBe(1);
  });

  it("moves the run, its counterfactual and its ceiling together", () => {
    // One table, three projections. If the weather hit only the student's path
    // the score would be luck wearing a rubric, and if it hit only theirs and
    // the ceiling the do-nothing floor would drift away underneath both.
    const scenario = noisy();
    const a = runOutcome(scenario, HALF, { seed: "run-1" });
    const b = runOutcome(scenario, HALF, { seed: "run-2" });
    expect(a.doNothing).not.toEqual(b.doNothing);
    expect(a.best).not.toEqual(b.best);
  });

  it("still ranks a better decision above a worse one", () => {
    // Over many seeds, not one: the point of noise is that a single quarter can
    // mislead, and the point of the design is that the grade does not.
    const scenario = noisy();
    for (const seed of ["s1", "s2", "s3", "s4", "s5", "s6"]) {
      const good = scoreOutcome(scenario, runOutcome(scenario, BEST_ALLOCATION, { seed }));
      const poor = scoreOutcome(
        scenario,
        runOutcome(scenario, [{ interventionId: "iv-discount", sprints: 1, rupees: 300 }], {
          seed,
        }),
      );
      expect(good).toBeGreaterThan(poor);
    }
  });

  it("keeps the realised quarters within sight of the expectation", () => {
    // Weather, not a different scenario. A student has to be able to read their
    // own decision out of the result, which stops being true once the noise
    // dominates the effect.
    const scenario = noisy();
    for (const seed of ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8"]) {
      const run = runOutcome(scenario, BEST_ALLOCATION, { seed });
      const realised = finalValue(run.paths, "orders");
      const expected = finalValue(run.expected!.paths, "orders");
      expect(Math.abs(realised - expected) / expected).toBeLessThan(0.25);
    }
  });

  it("carries the seed so a stored report can be explained later", () => {
    expect(runOutcome(noisy(), BEST_ALLOCATION, { seed: "run-1" }).seed).toBe("run-1");
  });
});

describe("a scenario that authored no noise", () => {
  it("projects exactly as it did before noise existed", () => {
    const scenario = v2FixtureScenario();
    expect(runOutcome(scenario, BEST_ALLOCATION, { seed: "run-1" })).toEqual(
      runOutcome(scenario, BEST_ALLOCATION),
    );
  });

  it("has no expectation to separate, and scores off the realised path", () => {
    const run = runOutcome(fixtureScenario(), BEST_ALLOCATION, { seed: "run-1" });
    expect(run.expected).toBeUndefined();
    expect(scoreOutcome(fixtureScenario(), run)).toBe(
      scoreOutcome(fixtureScenario(), runOutcome(fixtureScenario(), BEST_ALLOCATION)),
    );
  });
});

describe("validateScenario on noise", () => {
  it("passes a well-formed declaration", () => {
    expect(validateScenario(noisy())).toEqual([]);
  });

  it("refuses noise on a v1 scenario, where nothing would draw it", () => {
    expect(
      validateScenario(
        fixtureScenario({ noise: { drivers: [{ driver: "orders", sigma: 0.05 }] } }),
      ).join(" | "),
    ).toMatch(/needs engine: "v2"/);
  });

  it("refuses noise on a derived driver, which would be overwritten", () => {
    expect(
      validateScenario(noisy({ noise: { drivers: [{ driver: "revenue", sigma: 0.05 }] } })).join(
        " | ",
      ),
    ).toMatch(/derived driver "revenue"/);
  });

  it("refuses a sigma large enough to drown the decision", () => {
    expect(
      validateScenario(noisy({ noise: { drivers: [{ driver: "orders", sigma: 0.5 }] } })).join(
        " | ",
      ),
    ).toMatch(/at most 0.1/);
  });
});
