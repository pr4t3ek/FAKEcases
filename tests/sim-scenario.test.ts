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
import { resolveDrivers } from "@/lib/sim/drivers";
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

/**
 * The primer quotes concrete numbers at the student. If a retune moves the
 * model without moving the prose, the app starts teaching arithmetic that is
 * quietly wrong — which is worse than teaching nothing. These pin the figures
 * the worked example actually claims.
 */
describe("ad-funnel-roas: the numbers the primer promises", () => {
  const scenario = getScenario("ad-funnel-roas");
  if (!scenario) throw new Error("scenario missing");
  const v = resolveDrivers(scenario.drivers);

  it("buys 55.6 lakh impressions with ₹10 lakh at a ₹180 CPM", () => {
    expect(v.costPerImpression).toBeCloseTo(0.18, 4);
    expect(v.impressions).toBeCloseTo(5_555_556, -1);
  });

  it("turns those into 61,111 clicks and 2,750 orders", () => {
    expect(v.clicks).toBeCloseTo(61_111, -1);
    expect(v.orders).toBeCloseTo(2_750, 0);
  });

  it("reports a ROAS of 4.0 on ₹39.9 lakh of sales", () => {
    expect(v.adRevenue).toBeCloseTo(39.875 * 100_000, -2);
    expect(v.roas).toBeCloseTo(3.99, 2);
  });

  it("still loses ₹1.2 lakh a month", () => {
    expect(v.grossProfit).toBeCloseTo(8.7725 * 100_000, -2);
    expect(v.netAdProfit).toBeLessThan(0);
    expect(v.netAdProfit).toBeCloseTo(-1.2275 * 100_000, -2);
    expect(v.roi).toBeLessThan(0);
  });

  it("pays ₹364 for an order that contributes ₹319", () => {
    expect(v.cac).toBeCloseTo(363.6, 0);
    expect(v.marginPerOrder).toBeCloseTo(319, 0);
    expect(v.cac).toBeGreaterThan(v.marginPerOrder);
  });

  /** The one sentence the whole scenario exists to land. */
  it("sits below the break-even ROAS of 1 ÷ gross margin", () => {
    const breakEven = 1 / v.grossMarginRate;
    expect(breakEven).toBeCloseTo(4.55, 2);
    expect(v.roas).toBeLessThan(breakEven);
  });

  it("turns a profit once the ads point at the bundle", () => {
    const outcome = runOutcome(scenario, scenario.bestAllocation);
    expect(finalValue(outcome.paths, "netAdProfit")).toBeGreaterThan(0);
    // And the loss deepens if you do nothing, because CPMs keep drifting up.
    expect(finalValue(outcome.doNothing, "netAdProfit")).toBeLessThan(v.netAdProfit);
  });

  /**
   * The most expensive mistake in the scenario, and the one with a chart behind
   * it. Scaling spend at a CAC above contribution multiplies the loss.
   */
  it("makes the loss bigger when you scale the budget", () => {
    const outcome = runOutcome(scenario, [
      { interventionId: "iv-spend-more", sprints: 1, rupees: 5 * 100_000 },
    ]);
    expect(finalValue(outcome.paths, "orders")).toBeGreaterThan(
      finalValue(outcome.doNothing, "orders"),
    );
    expect(finalValue(outcome.paths, "netAdProfit")).toBeLessThan(
      finalValue(outcome.doNothing, "netAdProfit"),
    );
  });

  /** Efficiency narrows the loss and never closes it — the second lesson. */
  it("lets efficiency work narrow the loss without closing it", () => {
    const outcome = runOutcome(scenario, [
      { interventionId: "iv-creative", sprints: 1, rupees: 1.5 * 100_000 },
    ]);
    const withCreative = finalValue(outcome.paths, "netAdProfit");
    expect(withCreative).toBeGreaterThan(finalValue(outcome.doNothing, "netAdProfit"));
    expect(withCreative).toBeLessThan(0);
  });

  it("defines every term it uses, and links most of them to the map", () => {
    const primer = scenario.teaching?.primer;
    expect(primer).toBeDefined();
    const terms = primer!.terms.map((t) => t.term);
    for (const expected of ["CPM", "CTR", "AOV", "CAC", "ROAS", "ROI", "Conversion rate"]) {
      expect(terms).toContain(expected);
    }
    // A definition nobody can act on is trivia, so every term says why it matters.
    for (const t of primer!.terms) expect(t.matters.length).toBeGreaterThan(20);

    const driverIds = new Set(scenario.drivers.map((d) => d.id));
    for (const t of primer!.terms) {
      if (t.driver) expect(driverIds).toContain(t.driver);
    }
  });
});

describe("subscription-ltv-cac: the numbers the primer promises", () => {
  const scenario = getScenario("subscription-ltv-cac");
  if (!scenario) throw new Error("scenario missing");
  const v = resolveDrivers(scenario.drivers);

  /** The formula the whole scenario is built on. */
  it("settles the base at joiners ÷ churn", () => {
    expect(v.subscribers).toBeCloseTo(18_000 / 0.11, 0);
    expect(v.subscribers).toBeCloseTo(163_636, -1);
  });

  it("gives a subscriber a 9-month life and ₹1,607 of lifetime value", () => {
    expect(v.lifetimeMonths).toBeCloseTo(9.09, 2);
    expect(v.marginPerSub).toBeCloseTo(176.79, 1);
    expect(v.ltv).toBeCloseTo(1607, 0);
  });

  it("reports the flattering LTV:CAC of 4.6 and sub-two-month payback", () => {
    expect(v.cac).toBeCloseTo(350, 0);
    expect(v.ltvCacRatio).toBeCloseTo(4.59, 2);
    expect(v.paybackMonths).toBeLessThan(2);
  });

  // Healthy per subscriber, and burning as a company. That gap is the lesson.
  it("burns cash anyway", () => {
    expect(v.ltvCacRatio).toBeGreaterThan(3);
    expect(v.netCash).toBeLessThan(0);
    expect(v.netCash).toBeCloseTo(-0.337 * 10_000_000, -4);
  });

  it("grows the business by cutting the divisor, not raising the numerator", () => {
    const fixChurn = runOutcome(scenario, [
      { interventionId: "iv-onboarding", sprints: 2, rupees: 40 * 100_000 },
    ]);
    const buyGrowth = runOutcome(scenario, [
      { interventionId: "iv-more-ads", sprints: 1, rupees: 35 * 100_000 },
    ]);

    // Both genuinely help — the acquisition play is a good trap, not a wrong one.
    expect(finalValue(buyGrowth.paths, "netCash")).toBeGreaterThan(
      finalValue(buyGrowth.doNothing, "netCash"),
    );
    // And retention is worth substantially more.
    expect(finalValue(fixChurn.paths, "netCash")).toBeGreaterThan(
      finalValue(buyGrowth.paths, "netCash"),
    );
    expect(finalValue(fixChurn.paths, "subscribers")).toBeGreaterThan(
      finalValue(buyGrowth.paths, "subscribers"),
    );
  });

  it("makes the price rise cost more than it earns", () => {
    const priceUp = runOutcome(scenario, [
      { interventionId: "iv-price-up", sprints: 1, rupees: 8 * 100_000 },
    ]);
    expect(finalValue(priceUp.paths, "arpu")).toBeGreaterThan(
      finalValue(priceUp.doNothing, "arpu"),
    );
    expect(finalValue(priceUp.paths, "netCash")).toBeLessThan(
      finalValue(priceUp.doNothing, "netCash"),
    );
  });

  it("turns the burn into cash once churn is fixed", () => {
    const outcome = runOutcome(scenario, scenario.bestAllocation);
    expect(finalValue(outcome.paths, "netCash")).toBeGreaterThan(0);
    expect(finalValue(outcome.doNothing, "netCash")).toBeLessThan(v.netCash);
  });

  it("defines churn, LTV, CAC and payback before using them", () => {
    const terms = scenario.teaching!.primer.terms.map((t) => t.term);
    for (const expected of ["Churn rate", "LTV", "CAC", "Payback period", "ARPU"]) {
      expect(terms).toContain(expected);
    }
  });
});

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
