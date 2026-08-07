import { describe, expect, it } from "vitest";
import {
  MAX_BALANCE_COMBOS,
  checkBalance,
  fullyFundableCombos,
  sweepFundableCombos,
} from "@/lib/sim/balance";
import { allocationFits } from "@/lib/sim/outcome";
import type { SimAllocationLine, SimIntervention, SimScenario } from "@/lib/sim/types";
import { CAUSE_TRUE, fixtureScenario } from "./sim-fixture";

/**
 * The combination sweep behind `checkBalance`.
 *
 * The sweep used to enumerate all 2^n subsets and filter afterwards, which put a
 * hard ceiling on how many interventions a scenario could carry. It now prunes
 * on cost during the walk. The test that matters is the equivalence one: pruning
 * is only safe because every cost is non-negative, and if that ever stops being
 * true the pruned set will quietly diverge from the honest one.
 */

/** The old implementation, kept here as the thing the fast one must agree with. */
function naiveCombos(scenario: SimScenario): SimAllocationLine[][] {
  const items = scenario.interventions;
  const combos: SimAllocationLine[][] = [];
  for (let mask = 0; mask < 1 << items.length; mask++) {
    const lines: SimAllocationLine[] = [];
    for (let i = 0; i < items.length; i++) {
      if (mask & (1 << i)) {
        lines.push({
          interventionId: items[i].id,
          sprints: items[i].cost.sprints,
          rupees: items[i].cost.rupees,
        });
      }
    }
    if (allocationFits(scenario, lines)) combos.push(lines);
  }
  return combos;
}

/** Order-independent identity for a set of combinations. */
const canonical = (combos: SimAllocationLine[][]) =>
  combos
    .map((c) =>
      c
        .map((l) => `${l.interventionId}:${l.sprints}:${l.rupees}`)
        .sort()
        .join("|"),
    )
    .sort();

function filler(id: string, sprints: number, rupees: number): SimIntervention {
  return {
    id,
    label: id,
    pitch: "Filler.",
    addresses: CAUSE_TRUE,
    cost: { sprints, rupees },
    effects: {
      whenRootCause: [{ driver: "orders", deltaPct: 0.01 }],
      otherwise: [{ driver: "orders", deltaPct: 0.001 }],
    },
    debrief: "Filler.",
  };
}

describe("sweepFundableCombos", () => {
  it("finds exactly what the exhaustive enumeration found", () => {
    const scenario = fixtureScenario();
    expect(canonical(fullyFundableCombos(scenario))).toEqual(canonical(naiveCombos(scenario)));
  });

  it("still agrees once there are far more interventions than the old ceiling", () => {
    // Sixteen interventions is 65,536 masks the old sweep would have walked, and
    // above the twelve it refused outright. The pruned walk has to reach the
    // same answer.
    const scenario = fixtureScenario({
      interventions: [
        ...fixtureScenario().interventions,
        ...Array.from({ length: 13 }, (_, i) => filler(`iv-filler-${i}`, 1, 100)),
      ],
    });
    expect(scenario.interventions.length).toBe(16);
    expect(canonical(fullyFundableCombos(scenario))).toEqual(canonical(naiveCombos(scenario)));
  });

  it("always includes doing nothing", () => {
    // The empty allocation is the do-nothing counterfactual, and dropping it
    // would remove the one combination the gradient check depends on.
    expect(fullyFundableCombos(fixtureScenario()).some((c) => c.length === 0)).toBe(true);
  });

  it("never returns a combination the budget cannot pay for", () => {
    const scenario = fixtureScenario();
    for (const combo of fullyFundableCombos(scenario)) {
      expect(allocationFits(scenario, combo)).toBe(true);
    }
  });

  it("prunes rather than enumerating: a tight budget visits a fraction of 2^n", () => {
    // The point of the rewrite. With a 3-sprint budget and 16 one-sprint
    // options, no affordable subset exceeds three items, so the sweep is
    // thousands rather than 65,536.
    const scenario = fixtureScenario({
      interventions: Array.from({ length: 16 }, (_, i) => filler(`iv-${i}`, 1, 10)),
    });
    const combos = fullyFundableCombos(scenario);
    expect(combos.length).toBeLessThan(2 ** 16 / 10);
    expect(combos.every((c) => c.length <= scenario.budget.sprints)).toBe(true);
  });

  it("reports truncation instead of running forever", () => {
    const scenario = fixtureScenario({
      interventions: Array.from({ length: 16 }, (_, i) => filler(`iv-${i}`, 0, 1)),
      budget: { analystDays: 5, sprints: 3, rupees: 700 },
    });
    const sweep = sweepFundableCombos(scenario, 50);
    expect(sweep.truncated).toBe(true);
    expect(sweep.combos.length).toBeLessThanOrEqual(50);
  });

  it("does not truncate a scenario that ships", () => {
    const sweep = sweepFundableCombos(fixtureScenario());
    expect(sweep.truncated).toBe(false);
    expect(sweep.combos.length).toBeLessThan(MAX_BALANCE_COMBOS);
  });
});

describe("checkBalance still holds its guarantees", () => {
  it("still names the faults in an unbalanced scenario", () => {
    // The shared fixture is a toy for the scorer rather than a shippable
    // scenario: it leaves a spare sprint and has combinations that beat its
    // declared best. Those are precisely the faults this exists to catch, so
    // it doubles as proof the pruned sweep did not stop finding them.
    // (Every real scenario is asserted clean in tests/sim-scenario.test.ts.)
    const errors = checkBalance(fixtureScenario());
    expect(errors.some((e) => /beats the declared best allocation/.test(e))).toBe(true);
    expect(errors.some((e) => /sprints spare/.test(e))).toBe(true);
  });

  it("refuses to certify a scenario whose sweep it could not finish", () => {
    // A sweep that stopped early proves nothing about the ceiling, so it must
    // report rather than pass quietly — the failure mode this guard exists for.
    const scenario = fixtureScenario({
      // Free in sprints, trivial in rupees: nothing prunes, so everything is
      // affordable and the sweep explodes.
      interventions: Array.from({ length: 20 }, (_, i) => filler(`iv-${i}`, 0, 1)),
    });
    const errors = checkBalance(scenario);
    expect(errors.length).toBe(1);
    expect(errors[0]).toMatch(/too many affordable combinations/i);
  });
});
