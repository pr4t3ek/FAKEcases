/**
 * Checks on the *authored content*, as distinct from the engine.
 *
 * A scenario is a hand-written object of several hundred lines whose
 * cross-references TypeScript cannot check and whose balance nothing can check
 * by inspection. These tests are what make retuning an effect safe: if a tweak
 * makes a decoy better than the real answer, this is what says so.
 */

import { describe, expect, it } from "vitest";
import { getScenario, listScenarios, scenarioSlugs } from "@/lib/sim/registry";
import { validateScenario } from "@/lib/sim/validate";
import { drilldownById, parCost } from "@/lib/sim/investigate";
import { allocationFits, finalValue, runOutcome } from "@/lib/sim/outcome";
import { scoreSimulation } from "@/lib/sim/score";
import type { SimAllocationLine, SimScenario } from "@/lib/sim/types";

const scenarios = listScenarios();

describe("the scenario registry", () => {
  it("has at least one scenario", () => {
    expect(scenarios.length).toBeGreaterThan(0);
  });

  it("resolves every slug it advertises", () => {
    for (const slug of scenarioSlugs()) {
      expect(getScenario(slug)?.slug).toBe(slug);
    }
  });

  it("returns undefined for an unknown slug rather than throwing", () => {
    expect(getScenario("no-such-scenario")).toBeUndefined();
  });
});

describe.each(scenarios.map((s) => [s.slug, s] as const))("scenario: %s", (_slug, scenario) => {
  it("passes every authoring invariant", () => {
    expect(validateScenario(scenario)).toEqual([]);
  });

  it("prices the investigation so the budget cannot buy everything", () => {
    const total = scenario.drilldowns.reduce((s, d) => s + d.cost, 0);
    // Scarce enough that choosing bites — but an Easy scenario deliberately
    // hands over about half the board rather than a third, so the bar moves
    // with the difficulty instead of punishing the beginner track.
    const factor = scenario.difficulty === "Easy" ? 1.5 : 2;
    expect(total).toBeGreaterThan(scenario.budget.analystDays * factor);
  });

  it("has a par investigation that is affordable and actually sufficient", () => {
    expect(parCost(scenario)).toBeLessThanOrEqual(scenario.budget.analystDays);

    const reaches = scenario.parInvestigation.some((id) =>
      drilldownById(scenario, id)?.evidenceFor.some((c) => scenario.trueCauseIds.includes(c)),
    );
    expect(reaches).toBe(true);
  });

  it("has a par investigation whose dependencies are satisfiable in order", () => {
    const owned: string[] = [];
    for (const id of scenario.parInvestigation) {
      const d = drilldownById(scenario, id);
      expect(d, `par names unknown drilldown ${id}`).toBeDefined();
      for (const dep of d?.dependsOn ?? []) {
        expect(owned, `${id} depends on ${dep}, which par buys later or not at all`).toContain(dep);
      }
      owned.push(id);
    }
  });

  it("keeps its best allocation inside the budget", () => {
    expect(allocationFits(scenario, scenario.bestAllocation)).toBe(true);
  });

  it("scores a perfect run at the top", () => {
    const outcome = runOutcome(scenario, scenario.bestAllocation);
    const result = scoreSimulation({
      scenario,
      hypothesis: [scenario.trueCauseIds[0]],
      purchases: scenario.parInvestigation.map((id, i) => ({
        drilldownId: id,
        cost: drilldownById(scenario, id)?.cost ?? 0,
        seq: i + 1,
      })),
      diagnosis: scenario.trueCauseIds,
      allocation: scenario.bestAllocation,
      outcome,
    });
    expect(result.overall).toBeGreaterThanOrEqual(95);
    expect(result.causeFound).toBe(true);
  });

  it("makes doing nothing visibly worse than acting", () => {
    const outcome = runOutcome(scenario, scenario.bestAllocation);
    expect(finalValue(outcome.paths, scenario.northStar)).toBeGreaterThan(
      finalValue(outcome.doNothing, scenario.northStar),
    );
  });

  /**
   * The balance test.
   *
   * Brute-forces every combination of interventions the budget can fully fund
   * and checks that none beats the authored `bestAllocation` on the north star.
   * An authored "best" that isn't best would make the outcome score
   * uninterpretable — a candidate could beat the ceiling — and, worse, would
   * mean the scenario quietly rewards the wrong lesson.
   */
  it("declares a best allocation that nothing affordable beats", () => {
    const best = finalValue(
      runOutcome(scenario, scenario.bestAllocation).paths,
      scenario.northStar,
    );

    for (const combo of fullyFundableCombos(scenario)) {
      const value = finalValue(runOutcome(scenario, combo).paths, scenario.northStar);
      const names = combo.map((l) => l.interventionId).join(" + ") || "(nothing)";
      expect(value, `"${names}" beats the declared best allocation`).toBeLessThanOrEqual(
        best + 1e-6,
      );
    }
  });

  it("leaves no spare capacity after the best allocation", () => {
    // Spare capacity is what lets a candidate bolt a margin-destroying extra
    // onto the correct answer and score above the ceiling.
    const used = scenario.bestAllocation.reduce(
      (acc, l) => ({ sprints: acc.sprints + l.sprints, rupees: acc.rupees + l.rupees }),
      { sprints: 0, rupees: 0 },
    );
    const cheapest = Math.min(...scenario.interventions.map((i) => i.cost.sprints));
    expect(scenario.budget.sprints - used.sprints).toBeLessThan(cheapest);
  });
});

/** Every subset of interventions that the budget can fund in full. */
function fullyFundableCombos(scenario: SimScenario): SimAllocationLine[][] {
  const items = scenario.interventions;
  // 2^n over a handful of interventions; the validator keeps the list small.
  expect(items.length).toBeLessThanOrEqual(12);

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

describe("metric-drop-food-delivery specifics", () => {
  const scenario = getScenario("metric-drop-food-delivery");

  it("is registered", () => {
    expect(scenario).toBeDefined();
  });

  it("models orders as traffic times conversion, which is the lesson", () => {
    const orders = scenario?.drivers.find((d) => d.id === "orders");
    expect(orders?.kind).toBe("product");
    expect(orders?.kind === "product" && orders.of).toEqual(["sessions", "conversion"]);
  });

  /**
   * The trap has to genuinely work on the headline metric, or it teaches
   * nothing. A candidate should be able to hit their orders number and watch
   * the margin pay for it.
   */
  it("lets deeper discounting raise orders while destroying margin", () => {
    if (!scenario) throw new Error("scenario missing");
    const discounting = [{ interventionId: "iv-discount", sprints: 1, rupees: 5 * 10_000_000 }];
    const outcome = runOutcome(scenario, discounting);

    expect(finalValue(outcome.paths, "orders")).toBeGreaterThan(
      finalValue(outcome.doNothing, "orders"),
    );
    expect(finalValue(outcome.paths, "contributionMargin")).toBeLessThan(
      finalValue(outcome.doNothing, "contributionMargin"),
    );
  });

  it("lets a brand campaign lift traffic and barely move orders", () => {
    if (!scenario) throw new Error("scenario missing");
    const brand = [{ interventionId: "iv-brand", sprints: 1, rupees: 4.5 * 10_000_000 }];
    const outcome = runOutcome(scenario, brand);

    const sessionLift =
      finalValue(outcome.paths, "sessions") / finalValue(outcome.doNothing, "sessions");
    const orderLift = finalValue(outcome.paths, "orders") / finalValue(outcome.doNothing, "orders");

    expect(sessionLift).toBeGreaterThan(1.04);
    // Traffic up 5%, orders up barely 2% — because conversion is what broke.
    expect(orderLift).toBeLessThan(1.03);
  });

  it("makes the correct fix beat the discount trap on orders as well as margin", () => {
    if (!scenario) throw new Error("scenario missing");
    const right = runOutcome(scenario, scenario.bestAllocation);
    const trap = runOutcome(scenario, [
      { interventionId: "iv-discount", sprints: 1, rupees: 5 * 10_000_000 },
    ]);

    expect(finalValue(right.paths, "orders")).toBeGreaterThan(finalValue(trap.paths, "orders"));
    expect(finalValue(right.paths, "contributionMargin")).toBeGreaterThan(
      finalValue(trap.paths, "contributionMargin"),
    );
  });

  it("stalls the checkout rewrite if it is not given all three sprints", () => {
    if (!scenario) throw new Error("scenario missing");
    const outcome = runOutcome(scenario, [
      { interventionId: "iv-checkout-rewrite", sprints: 2, rupees: 2 * 10_000_000 },
    ]);
    expect(outcome.stalled).toContain("iv-checkout-rewrite");
  });

  it("has a coach answer for every major wrong theory in the room", () => {
    if (!scenario) throw new Error("scenario missing");
    const topics = scenario.coachFallback.flatMap((f) => f.topic);
    for (const expected of ["rider", "discount", "brand", "release", "competitor", "seasonality"]) {
      expect(topics).toContain(expected);
    }
  });
});
