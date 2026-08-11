/**
 * The response curves, and the two properties the rest of the v2 engine is
 * built on top of.
 *
 * The first is **reduction**: a `linear` curve must be the v1 expression to the
 * last bit, because that is what lets a scenario be converted one at a time
 * without every other scenario becoming a re-tuning job.
 *
 * The second is **concavity**: past its start every curve's slope must fall.
 * That is what makes "how much should I spend?" a question with an answer
 * strictly inside the budget, rather than the constant "all of it" the linear
 * model always gave.
 */

import { describe, expect, it } from "vitest";
import {
  evalResponse,
  marginalResponse,
  responseFor,
  satiationMultiple,
} from "@/lib/sim/response";
import { simConfig } from "@/lib/config/simulation";
import { finalValue, runOutcome } from "@/lib/sim/outcome";
import type { SimEffect, SimIntervention, SimResponse } from "@/lib/sim/types";
import { clamp } from "@/lib/utils";
import {
  BEST_ALLOCATION,
  fixtureScenario,
  v2FixtureScenario,
  v2LinearFixtureScenario,
} from "./sim-fixture";

const HILL: SimResponse = { kind: "hill", ceiling: 1.3, halfAt: 0.45 };
const EXPO: SimResponse = { kind: "exponential", ceiling: 0.35, halfAt: 0.2 };

function intervention(over: Partial<SimIntervention> = {}): SimIntervention {
  return {
    id: "iv-x",
    label: "x",
    pitch: "x",
    addresses: "c-x",
    cost: { sprints: 1, rupees: 100 },
    effects: { whenRootCause: [], otherwise: [] },
    debrief: "x",
    ...over,
  };
}

const effect = (over: Partial<SimEffect> = {}): SimEffect => ({
  driver: "d",
  deltaPct: 0.1,
  ...over,
});

describe("evalResponse", () => {
  it("reproduces the v1 clamp exactly on a linear curve", () => {
    // Not `toBeCloseTo`. The whole backwards-compatibility story rests on this
    // being the same arithmetic rather than arithmetic that agrees to six
    // places, so it is asserted as identity.
    for (const u of [0, 0.1, 0.25, 1 / 3, 0.5, 0.75, 0.999, 1, 1.5, 4]) {
      expect(evalResponse({ kind: "linear" }, u)).toBe(clamp(u, 0, 1));
    }
  });

  it("starts at zero for every shape", () => {
    for (const curve of [HILL, EXPO, { kind: "linear" } as const, { kind: "proportional" } as const]) {
      expect(evalResponse(curve, 0)).toBe(0);
    }
  });

  it("puts half the ceiling at halfAt, which is what makes it the knob", () => {
    expect(evalResponse(HILL, HILL.halfAt)).toBeCloseTo(HILL.ceiling / 2, 10);
    expect(evalResponse(EXPO, EXPO.halfAt)).toBeCloseTo(EXPO.ceiling / 2, 10);
  });

  it("approaches the ceiling and never passes it", () => {
    for (const curve of [HILL, EXPO]) {
      expect(evalResponse(curve, 1e6)).toBeLessThanOrEqual(curve.ceiling);
      expect(evalResponse(curve, 1e6)).toBeCloseTo(curve.ceiling, 3);
    }
  });

  it("gets there at completely different speeds, which is the point", () => {
    // The exponential is finished: at four times its ask it is within a
    // thousandth of everything it will ever do. The hill still has 30% of its
    // ceiling left at the same multiple — there is always a little more,
    // which is what a lever that is genuinely working feels like.
    expect(evalResponse(EXPO, 4) / EXPO.ceiling).toBeGreaterThan(0.999);
    expect(evalResponse(HILL, 4) / HILL.ceiling).toBeLessThan(0.92);
  });

  it("keeps rising forever on a proportional curve", () => {
    // The cost side of a lever. This is the arm that stops "spend more" from
    // being free once the benefit arm has flattened.
    expect(evalResponse({ kind: "proportional" }, 3)).toBe(3);
    expect(evalResponse({ kind: "proportional", slope: 0.5 }, 3)).toBe(1.5);
  });

  it("treats negative funding as none rather than as a refund", () => {
    expect(evalResponse(HILL, -2)).toBe(0);
  });
});

describe("concavity", () => {
  const sample = (curve: SimResponse) =>
    Array.from({ length: 200 }, (_, i) => evalResponse(curve, (i * 4) / 200));

  it("has a strictly falling slope on both saturating shapes", () => {
    for (const curve of [HILL, EXPO]) {
      const values = sample(curve);
      for (let i = 2; i < values.length; i++) {
        const secondDifference = values[i] - 2 * values[i - 1] + values[i - 2];
        expect(secondDifference).toBeLessThan(0);
      }
    }
  });

  it("is monotone — more money is never worse", () => {
    for (const curve of [HILL, EXPO, { kind: "linear" } as const]) {
      const values = sample(curve);
      for (let i = 1; i < values.length; i++) {
        expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]);
      }
    }
  });

  it("saturates the off-target arm far earlier than the on-target one", () => {
    // The lesson the format is being rebuilt for: doubling the money on a lever
    // aimed at the wrong cause buys almost nothing, while the right one keeps
    // paying.
    const offGain = evalResponse(EXPO, 2) - evalResponse(EXPO, 1);
    const onGain = evalResponse(HILL, 2) - evalResponse(HILL, 1);
    expect(offGain / evalResponse(EXPO, 1)).toBeLessThan(0.05);
    expect(onGain / evalResponse(HILL, 1)).toBeGreaterThan(0.15);
  });
});

describe("marginalResponse", () => {
  it("agrees with the curve's own slope", () => {
    const h = 1e-6;
    for (const curve of [HILL, EXPO, { kind: "proportional", slope: 2 } as const]) {
      for (const u of [0.1, 0.5, 1, 2]) {
        const numeric = (evalResponse(curve, u + h) - evalResponse(curve, u - h)) / (2 * h);
        expect(marginalResponse(curve, u)).toBeCloseTo(numeric, 5);
      }
    }
  });

  it("is a ratio the browser may see: it does not depend on the effect's size", () => {
    // The commit panel tells a student "the next ₹50 L buys about a tenth as
    // much as the first". That is `r'(u)/r'(0)`, and this is the assertion that
    // says shipping it leaks nothing about how big the effect actually is —
    // `deltaPct` never enters the calculation.
    const ratioAt = (curve: SimResponse, u: number) =>
      marginalResponse(curve, u) / marginalResponse(curve, 0);
    expect(ratioAt(EXPO, 1)).toBeCloseTo(Math.pow(2, -5), 10);
    expect(ratioAt(HILL, 1)).toBeCloseTo(Math.pow(0.45 / 1.45, 2), 10);
  });

  it("stops paying entirely past the ask on a linear curve", () => {
    expect(marginalResponse({ kind: "linear" }, 0.5)).toBe(1);
    expect(marginalResponse({ kind: "linear" }, 1.5)).toBe(0);
  });
});

describe("satiationMultiple", () => {
  it("finds where the curve has effectively stopped", () => {
    for (const curve of [HILL, EXPO]) {
      const u = satiationMultiple(curve, 0.95);
      expect(u).not.toBeNull();
      expect(evalResponse(curve, u!)).toBeCloseTo(0.95 * curve.ceiling, 10);
    }
  });

  it("puts the off-target lever's satiation below its own asking price", () => {
    // ₹1 of every ₹8 asked for buys half of what a wrong-cause lever can ever
    // do, and it is finished before it has been fully funded.
    expect(satiationMultiple(EXPO, 0.95)!).toBeLessThan(1);
  });

  it("returns null where there is nothing to satiate", () => {
    // A curve with no ceiling has no waste point, and the waste term charges
    // nothing rather than guessing one — we charge for waste we can prove.
    expect(satiationMultiple({ kind: "proportional" })).toBeNull();
    expect(satiationMultiple({ kind: "linear" })).toBeNull();
  });
});

describe("responseFor", () => {
  const defaults = simConfig.responseDefaults;

  it("falls back to the arm default, which is where relevance is expressed", () => {
    const iv = intervention();
    expect(responseFor(iv, effect(), true, defaults)).toEqual(defaults.onTarget);
    expect(responseFor(iv, effect(), false, defaults)).toEqual(defaults.offTarget);
  });

  it("prefers the intervention's own arm over the default", () => {
    const iv = intervention({ saturation: { otherwise: EXPO } });
    expect(responseFor(iv, effect(), false, defaults)).toEqual(EXPO);
    // The arm it did not state still comes from the default.
    expect(responseFor(iv, effect(), true, defaults)).toEqual(defaults.onTarget);
  });

  it("prefers the effect's own curve over everything", () => {
    const iv = intervention({ saturation: { whenRootCause: HILL } });
    const own: SimResponse = { kind: "proportional", slope: 2 };
    expect(responseFor(iv, effect({ saturation: own }), true, defaults)).toEqual(own);
  });
});

describe("the v2 engine inside a projection", () => {
  it("projects a v2 scenario with linear curves exactly like its v1 twin", () => {
    // The reduction property, end to end rather than on the curve alone: if
    // this holds, converting a scenario is a decision about its content and
    // never an accident of the engine.
    const allocations = [
      [],
      BEST_ALLOCATION,
      [{ interventionId: "iv-payout", sprints: 2, rupees: 100 }],
      [
        { interventionId: "iv-payout", sprints: 2, rupees: 400 },
        { interventionId: "iv-discount", sprints: 1, rupees: 300 },
      ],
    ];
    for (const allocation of allocations) {
      expect(runOutcome(v2LinearFixtureScenario(), allocation).paths).toEqual(
        runOutcome(fixtureScenario(), allocation).paths,
      );
    }
  });

  it("stops paying for money poured at the wrong cause", () => {
    const scenario = v2FixtureScenario();
    const at = (rupees: number) =>
      finalValue(
        runOutcome(scenario, [{ interventionId: "iv-discount", sprints: 1, rupees }]).paths,
        "orders",
      );

    const asked = at(300);
    const triple = at(900);
    const doNothing = finalValue(runOutcome(scenario, []).doNothing, "orders");

    // Tripling the money on a lever aimed at a cause that isn't the problem
    // moves the north star by under a tenth of what the first ₹300 did. Under
    // v1 it moved it by exactly three times as much, capped only by the ask.
    expect(triple - asked).toBeLessThan(0.1 * (asked - doNothing));
  });

  it("keeps paying, at a falling rate, for money behind the real cause", () => {
    const scenario = v2FixtureScenario();
    const at = (rupees: number) =>
      finalValue(
        runOutcome(scenario, [{ interventionId: "iv-payout", sprints: 2, rupees }]).paths,
        "orders",
      );

    const first = at(400) - at(200);
    const second = at(600) - at(400);
    expect(second).toBeGreaterThan(0);
    expect(second).toBeLessThan(first);
  });

  it("still does not care what order the money was committed in", () => {
    const scenario = v2FixtureScenario();
    const lines = [
      { interventionId: "iv-payout", sprints: 2, rupees: 400 },
      { interventionId: "iv-discount", sprints: 1, rupees: 300 },
    ];
    expect(runOutcome(scenario, lines).paths).toEqual(
      runOutcome(scenario, [...lines].reverse()).paths,
    );
  });

  it("caps what one intervention can absorb", () => {
    const scenario = v2FixtureScenario({
      interventions: v2FixtureScenario().interventions.map((iv) =>
        iv.id === "iv-payout" ? { ...iv, maxAskMultiple: 1 } : iv,
      ),
    });
    const at = (rupees: number) =>
      finalValue(
        runOutcome(scenario, [{ interventionId: "iv-payout", sprints: 2, rupees }]).paths,
        "orders",
      );
    expect(at(1200)).toBe(at(400));
  });
});
