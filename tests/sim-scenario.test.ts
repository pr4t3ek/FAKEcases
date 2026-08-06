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
import {
  MAX_BRUTE_FORCE_INTERVENTIONS,
  checkBalance,
  fullyFundableCombos,
} from "@/lib/sim/balance";
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

  it("stays inside the brute-forcing ceiling", () => {
    expect(scenario.interventions.length).toBeLessThanOrEqual(MAX_BRUTE_FORCE_INTERVENTIONS);
  });

  /**
   * The same three invariants as the tests above, through the shared entry point
   * the admin save path calls.
   *
   * Deliberately a duplicate: the individual tests name which invariant broke,
   * and this one proves `checkBalance` — the thing standing between an admin's
   * driver edit and a scorer that lies — agrees with them.
   */
  it("reports no balance errors through checkBalance", () => {
    expect(checkBalance(scenario)).toEqual([]);
  });
});

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

describe("ab-test-readout: the numbers the primer promises", () => {
  const scenario = getScenario("ab-test-readout");
  if (!scenario) throw new Error("scenario missing");
  const v = resolveDrivers(scenario.drivers);

  it("turns 18.5 lakh users into 76,220 orders and ₹4.88 crore of bookings", () => {
    expect(v.orders).toBeCloseTo(76_220, 0);
    expect(v.revenue).toBeCloseTo(4.87808 * 10_000_000, -2);
  });

  /**
   * The link the whole scenario turns on: a returned order loses its margin as
   * well as costing money to handle. Drop `keepRate` and returns become a small
   * handling fee, and shipping the variant becomes correct.
   */
  it("books margin only on the orders customers kept", () => {
    expect(v.keepRate).toBeCloseTo(0.939, 4);
    expect(v.netRevenue).toBeCloseTo(4.58052 * 10_000_000, -2);
    expect(v.grossProfit).toBeCloseTo(87.03 * 100_000, -3);
  });

  it("charges ₹9.8 lakh to handle 4,649 returns", () => {
    expect(v.returnedOrders).toBeCloseTo(4_649, 0);
    expect(v.returnCost).toBeCloseTo(9.764 * 100_000, -2);
  });

  it("leaves ₹77.3 lakh of net contribution", () => {
    expect(v.netContribution).toBeCloseTo(77.266 * 100_000, -2);
  });

  /**
   * The one sentence the scenario exists to land: everything the test measured
   * goes up 6%, and the number the business runs on goes down.
   */
  it("delivers the +6% and loses 6.7% of contribution", () => {
    const shipped = resolveDrivers(scenario.drivers, {
      conversionRate: 1.06,
      returnRate: 1.6,
    });
    expect(shipped.conversionRate / v.conversionRate).toBeCloseTo(1.06, 4);
    expect(shipped.orders / v.orders).toBeCloseTo(1.06, 4);
    expect(shipped.revenue / v.revenue).toBeCloseTo(1.06, 4);
    expect(shipped.returnRate).toBeCloseTo(0.0976, 4);

    const change = (shipped.netContribution - v.netContribution) / v.netContribution;
    expect(change).toBeCloseTo(-0.067, 3);
  });

  /** The debrief's arithmetic: the returns cost about twice the added margin. */
  it("costs about twice in returns what the extra orders earn in margin", () => {
    const moreOrders = resolveDrivers(scenario.drivers, { conversionRate: 1.06 });
    const earned = moreOrders.netContribution - v.netContribution;
    const shipped = resolveDrivers(scenario.drivers, {
      conversionRate: 1.06,
      returnRate: 1.6,
    });
    const lost = moreOrders.netContribution - shipped.netContribution;

    expect(earned).toBeGreaterThan(0);
    expect(lost / earned).toBeGreaterThan(1.8);
    expect(lost / earned).toBeLessThan(2.5);
  });

  /** Shipping it is the only option in the set that beats doing nothing downward. */
  it("makes shipping the variant worse than shipping nothing", () => {
    const outcome = runOutcome(scenario, [
      { interventionId: "iv-ship-all", sprints: 1, rupees: 5 * 100_000 },
    ]);
    expect(finalValue(outcome.paths, "orders")).toBeGreaterThan(
      finalValue(outcome.doNothing, "orders"),
    );
    expect(finalValue(outcome.paths, "revenue")).toBeGreaterThan(
      finalValue(outcome.doNothing, "revenue"),
    );
    expect(finalValue(outcome.paths, "netContribution")).toBeLessThan(
      finalValue(outcome.doNothing, "netContribution"),
    );
  });

  /**
   * A decoy that loses money teaches nothing — the student just avoids it. The
   * festive push has to genuinely work and still be the wrong call.
   */
  it("lets the festive push genuinely help, and lose anyway", () => {
    const festive = runOutcome(scenario, [
      { interventionId: "iv-festive", sprints: 1, rupees: 14 * 100_000 },
    ]);
    const ns = "netContribution";
    expect(finalValue(festive.paths, ns)).toBeGreaterThan(finalValue(festive.doNothing, ns));
    expect(finalValue(festive.paths, ns)).toBeLessThan(finalValue(festive.best, ns));
  });

  it("defines the test vocabulary and the money vocabulary before using either", () => {
    const primer = scenario.teaching?.primer;
    expect(primer).toBeDefined();
    const terms = primer!.terms.map((t) => t.term);
    for (const expected of [
      "A/B test",
      "Control and variant",
      "Lift",
      "Sample size",
      "Statistical significance",
      "Novelty effect",
      "Return rate",
      "Net contribution",
    ]) {
      expect(terms).toContain(expected);
    }
    for (const t of primer!.terms) expect(t.matters.length).toBeGreaterThan(20);

    const driverIds = new Set(scenario.drivers.map((d) => d.id));
    for (const t of primer!.terms) {
      if (t.driver) expect(driverIds).toContain(t.driver);
    }
  });
});

describe("channel-trade-spend: the numbers the primer promises", () => {
  const scenario = getScenario("channel-trade-spend");
  if (!scenario) throw new Error("scenario missing");
  const v = resolveDrivers(scenario.drivers);

  it("realises ₹47.40 of a ₹60 pack in general trade and ₹34.80 on quick commerce", () => {
    expect(v.gtRealisedPrice).toBeCloseTo(47.4, 2);
    expect(v.qcRealisedPrice).toBeCloseTo(34.8, 2);
    expect(v.qcDeductionRate).toBeCloseTo(0.42, 4);
    expect(v.gtDeductionRate).toBeCloseTo(0.21, 4);
  });

  /** The sentence the whole scenario is built to make undeniable. */
  it("earns ₹21.40 a pack in one channel and ₹8.80 in the other", () => {
    expect(v.gtContributionPerPack).toBeCloseTo(21.4, 2);
    expect(v.qcContributionPerPack).toBeCloseTo(8.8, 2);
    expect(v.gtContributionPerPack / v.qcContributionPerPack).toBeCloseTo(2.43, 2);
  });

  it("gives quick commerce 27% of the volume and 13% of the contribution", () => {
    expect(v.qcPacks / (v.qcPacks + v.gtPacks)).toBeCloseTo(0.271, 3);
    expect(v.qcContribution / v.totalContribution).toBeCloseTo(0.132, 3);
  });

  it("nets ₹70.8 lakh against ₹2.35 crore of fixed costs, at 11.5% share", () => {
    expect(v.totalContribution).toBeCloseTo(3.0584 * 10_000_000, -2);
    expect(v.netContribution).toBeCloseTo(70.84 * 100_000, -2);
    expect(v.qcMarketShare).toBeCloseTo(0.115, 4);
  });

  /**
   * The uncomfortable result: the right answer costs you the number the room is
   * proud of. If a retune ever makes the answer share-accretive, the scenario
   * stops teaching what it exists to teach.
   */
  it("makes the correct move lose market share and gain money", () => {
    const fixed = resolveDrivers(scenario.drivers, {
      qcTradeSpendRate: 0.45,
      qcPacks: 0.75,
      gtPacks: 1.08,
    });
    expect(fixed.qcMarketShare).toBeLessThan(v.qcMarketShare);
    expect(fixed.qcMarketShare).toBeCloseTo(0.086, 3);
    expect(fixed.qcContributionPerPack).toBeCloseTo(14.08, 2);
    expect(fixed.netContribution).toBeGreaterThan(v.netContribution * 1.35);
  });

  /** And the trap does the reverse — bought share, at a price on the P&L. */
  it("makes doubling down buy share and lose the business", () => {
    const bought = resolveDrivers(scenario.drivers, {
      qcPacks: 1.35,
      qcTradeSpendRate: 1.4,
      gtPacks: 0.88,
    });
    expect(bought.qcMarketShare).toBeCloseTo(0.155, 3);
    expect(bought.qcDeductionRate).toBeCloseTo(0.484, 3);
    expect(bought.qcContributionPerPack).toBeCloseTo(4.96, 2);
    expect(bought.netContribution).toBeLessThan(v.netContribution * 0.5);

    // Followed to the horizon, with platform rates drifting, it goes negative.
    const outcome = runOutcome(scenario, [
      { interventionId: "iv-double-down", sprints: 1, rupees: 18 * 100_000 },
    ]);
    expect(finalValue(outcome.paths, "qcMarketShare")).toBeGreaterThan(
      finalValue(outcome.doNothing, "qcMarketShare"),
    );
    expect(finalValue(outcome.paths, "netContribution")).toBeLessThan(0);
  });

  /** Both value-branch decoys have to pay, or nobody is tempted by them. */
  it("makes the price rise and the cost saving genuinely profitable and small", () => {
    const raise = resolveDrivers(scenario.drivers, {
      mrp: 1.0833,
      qcPacks: 0.85,
      gtPacks: 0.84,
    });
    const save = resolveDrivers(scenario.drivers, {
      cogsPerPack: 0.97,
      qcPacks: 0.98,
      gtPacks: 0.98,
    });
    for (const alt of [raise, save]) {
      expect(alt.netContribution).toBeGreaterThan(v.netContribution);
      expect(alt.netContribution).toBeLessThan(v.netContribution * 1.15);
    }
    expect(raise.netContribution - v.netContribution).toBeCloseTo(3.9 * 100_000, -4);
    expect(save.netContribution - v.netContribution).toBeCloseTo(6.9 * 100_000, -4);
  });

  it("defines the channel vocabulary before charging for it", () => {
    const primer = scenario.teaching?.primer;
    expect(primer).toBeDefined();
    const terms = primer!.terms.map((t) => t.term);
    for (const expected of [
      "Channel",
      "MRP",
      "Trade promotion",
      "Net realisation",
      "Contribution per pack",
      "Incrementality",
      "Cannibalisation",
      "Market share",
    ]) {
      expect(terms).toContain(expected);
    }
    for (const t of primer!.terms) expect(t.matters.length).toBeGreaterThan(20);

    const driverIds = new Set(scenario.drivers.map((d) => d.id));
    for (const t of primer!.terms) {
      if (t.driver) expect(driverIds).toContain(t.driver);
    }
  });
});

describe("marketplace-liquidity: the numbers the primer promises", () => {
  const scenario = getScenario("marketplace-liquidity");
  if (!scenario) throw new Error("scenario missing");
  const v = resolveDrivers(scenario.drivers);

  it("fills 4.9 lakh of 6.2 lakh bookings for ₹41.1 crore of GMV", () => {
    expect(v.jobs).toBeCloseTo(489_800, 0);
    expect(v.failedRequests).toBeCloseTo(130_200, 0);
    expect(v.gmv).toBeCloseTo(41.1432 * 10_000_000, -3);
    expect(v.netRevenue).toBeCloseTo(9.8744 * 10_000_000, -3);
  });

  it("runs professionals at 43.5% utilisation while failing one booking in five", () => {
    expect(v.utilisation).toBeCloseTo(0.435, 3);
    expect(v.failRate).toBeCloseTo(0.21, 4);
  });

  /**
   * The line that makes the scenario work. Without a cost on a failed booking,
   * pouring demand into a supply-constrained marketplace is profitable and the
   * trap teaches the opposite of the lesson.
   */
  it("charges ₹2.41 crore for the bookings it failed, and loses ₹33.6 lakh", () => {
    expect(v.failureCost).toBeCloseTo(2.4087 * 10_000_000, -3);
    expect(v.contribution).toBeCloseTo(-33.64 * 100_000, -3);
    // The same month is ₹2.07 crore in the black if the failures are removed.
    expect(v.contribution + v.failureCost).toBeCloseTo(2.072 * 10_000_000, -4);
  });

  it("makes the demand push raise GMV and roughly triple the loss", () => {
    const pushed = resolveDrivers(scenario.drivers, { requests: 1.2, matchRate: 0.93 });
    expect(pushed.gmv / v.gmv).toBeCloseTo(1.116, 3);
    expect(pushed.contribution).toBeLessThan(v.contribution);
    expect(pushed.contribution / v.contribution).toBeGreaterThan(2.5);
  });

  /** The three deficit zone-hours, and nothing else, get the platform back. */
  it("turns the loss into ₹2.16 crore by moving match rate alone", () => {
    const fixed = resolveDrivers(scenario.drivers, {
      matchRate: 1.12 * 1.03 * 1.05,
      proIncentives: 1.18,
      avgTicket: 0.98,
    });
    expect(fixed.matchRate).toBeLessThan(1);
    expect(fixed.matchRate).toBeCloseTo(0.957, 3);
    expect(fixed.contribution).toBeGreaterThan(2 * 10_000_000);
  });

  /**
   * `matchRate` is an input, so nothing stops an over-generous retune pushing it
   * past 1 and making `failRate` negative — which would silently pay the
   * platform for failures it did not have.
   */
  it("never projects a match rate above 100%, on any affordable allocation", () => {
    for (const iv of scenario.interventions) {
      const outcome = runOutcome(scenario, [
        { interventionId: iv.id, sprints: iv.cost.sprints, rupees: iv.cost.rupees },
      ]);
      for (const value of outcome.paths.matchRate) expect(value).toBeLessThan(1);
      for (const value of outcome.paths.failRate) expect(value).toBeGreaterThan(0);
    }
    const best = runOutcome(scenario, scenario.bestAllocation);
    for (const value of best.paths.matchRate) expect(value).toBeLessThan(1);
  });

  it("lets recruiting nationally help, and lose to recruiting locally", () => {
    const local = runOutcome(scenario, [
      { interventionId: "iv-zone-supply", sprints: 2, rupees: 5 * 10_000_000 },
    ]);
    const national = runOutcome(scenario, [
      { interventionId: "iv-recruit", sprints: 1, rupees: 3.5 * 10_000_000 },
    ]);
    const ns = "contribution";
    expect(finalValue(national.paths, ns)).toBeGreaterThan(finalValue(national.doNothing, ns));
    expect(finalValue(local.paths, ns)).toBeGreaterThan(finalValue(national.paths, ns));
  });

  it("defines match rate, liquidity, utilisation and take rate before using them", () => {
    const terms = scenario.teaching!.primer.terms.map((t) => t.term);
    for (const expected of ["Match rate", "Liquidity", "Utilisation", "GMV", "Take rate"]) {
      expect(terms).toContain(expected);
    }
  });
});

describe("b2b-deal-tco: the numbers the primer promises", () => {
  const scenario = getScenario("b2b-deal-tco");
  if (!scenario) throw new Error("scenario missing");
  const v = resolveDrivers(scenario.drivers);
  const LAKH = 100_000;

  it("bills ₹67.5 lakh a quarter across seats and document volume", () => {
    expect(v.seatRevenue).toBeCloseTo(65.25 * LAKH, -2);
    expect(v.usageRevenue).toBeCloseTo(2.255 * LAKH, -2);
    expect(v.revenue).toBeCloseTo(67.505 * LAKH, -2);
  });

  /** The gap the whole scenario exists inside: 78% reported, 19.5% real. */
  it("costs ₹54.3 lakh to serve, for a real margin of 19.5% rather than 78%", () => {
    expect(v.costToServe).toBeCloseTo(54.3075 * LAKH, -2);
    expect(v.grossProfit).toBeCloseTo(13.1975 * LAKH, -2);
    expect(v.grossMarginRate).toBeCloseTo(0.1955, 3);
    // What the deck reports: revenue minus hosting alone.
    expect((v.revenue - v.infraCost) / v.revenue).toBeCloseTo(0.897, 3);
    // And a third of the real cost is one customer-specific line.
    expect(v.connectorCost / v.costToServe).toBeGreaterThan(0.3);
  });

  it("leaves ₹72 lakh of contribution across twelve quarters", () => {
    expect(v.contractQuarters).toBe(12);
    expect(v.contractContribution).toBeCloseTo(72.37 * LAKH, -3);
  });

  /** The buyer's side, which is what makes the discount the wrong instrument. */
  it("costs the customer ₹1.15 crore a quarter, of which the licence is 59%", () => {
    expect(v.customerTco).toBeCloseTo(115.005 * LAKH, -3);
    expect(v.revenue / v.customerTco).toBeCloseTo(0.587, 3);

    // A pure 18% licence cut relieves 10.6% of their problem…
    const discountOnly = resolveDrivers(scenario.drivers, {
      pricePerSeat: 0.82,
      usageRatePerMnDocs: 0.82,
    });
    expect(1 - discountOnly.customerTco / v.customerTco).toBeCloseTo(0.106, 3);
    // …while retiring the connector relieves more than twice as much.
    const replatform = resolveDrivers(scenario.drivers, {
      connectorCost: 0.28,
      tickets: 0.55,
      customerInternalCost: 0.45,
    });
    expect(1 - replatform.customerTco / v.customerTco).toBeGreaterThan(0.22);
    expect(replatform.customerTco).toBeCloseTo(88.88 * LAKH, -4);
  });

  it("puts the discount under water and the re-platform far above it", () => {
    const discount = resolveDrivers(scenario.drivers, {
      pricePerSeat: 0.82,
      usageRatePerMnDocs: 0.82,
      seats: 1.08,
      documentsMn: 1.05,
      tickets: 1.05,
    });
    expect(discount.contractContribution).toBeLessThan(0);
    expect(discount.contractContribution).toBeCloseTo(-37.05 * LAKH, -4);

    const replatform = resolveDrivers(scenario.drivers, {
      connectorCost: 0.28,
      tickets: 0.55,
      customerInternalCost: 0.45,
    });
    expect(replatform.costToServe).toBeCloseTo(33.14 * LAKH, -4);
    expect(replatform.contractContribution).toBeGreaterThan(3 * v.contractContribution);
  });

  /**
   * The expansion trap. Revenue up 44%, net revenue retention 144%, contract
   * contribution down 83% — and if any of the costs a second division brings
   * with it are under-modelled, expanding quietly becomes the right answer.
   */
  it("makes expansion grow revenue 44% and cut contribution 83%", () => {
    const expanded = resolveDrivers(scenario.drivers, {
      seats: 1.44,
      documentsMn: 1.3,
      tickets: 1.55,
      csmCost: 1.45,
      connectorCost: 1.75,
      dealCost: 1.55,
    });
    expect(expanded.revenue / v.revenue).toBeCloseTo(1.44, 2);
    expect(1 - expanded.contractContribution / v.contractContribution).toBeCloseTo(0.83, 2);
  });

  it("withholds the metric map, and still defines the vocabulary", () => {
    expect(scenario.teaching?.showMetricMap).toBe(false);
    const terms = scenario.teaching!.primer.terms.map((t) => t.term);
    for (const expected of [
      "ARR",
      "Seats vs usage pricing",
      "Cost to serve",
      "TCO",
      "NRR",
      "Contract contribution",
    ]) {
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
