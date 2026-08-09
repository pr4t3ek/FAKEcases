/**
 * State, journal, agent, transition and financials.
 *
 * These pin the mechanics; `buyback-behaviours.test.ts` pins what the mechanics
 * are supposed to produce when a domain is plugged into them.
 */

import { describe, expect, it } from "vitest";
import { changeSinceStart, commitTick, openState, toChartRows, valueAt } from "@/lib/sim/engine/state";
import {
  appendEntry,
  decisionsOf,
  hiddenPathOf,
  openJournal,
  parseJournal,
  pathOf,
  serialiseJournal,
  type JournalEntry,
} from "@/lib/sim/engine/journal";
import { expectedOffer, expectedUtility, quote, softmax } from "@/lib/sim/engine/agent";
import {
  bayesBeliefUpdate,
  elasticityResponse,
  queueDelay,
} from "@/lib/sim/engine/transition";
import {
  cashConversionCycle,
  lagInTicks,
  openLedger,
  periodDiscountRate,
  postPeriod,
  rollingNpv,
} from "@/lib/sim/engine/financials";
import { createRng } from "@/lib/sim/engine/stochastic";
import type { AgentConfig, FinancialsConfig } from "@/lib/sim/configs/types";

// ─── State ─────────────────────────────────────────────────────────────────

describe("state", () => {
  const opening = { cash: 100, units: 5 };

  it("records the opening position at index 0", () => {
    const s = openState(opening);
    expect(s.history.cash).toEqual([100]);
    expect(s.tick).toBe(0);
  });

  it("appends EVERY key on a tick, including ones that did not move", () => {
    // A sparse history would make a flat line indistinguishable from a gap.
    const s = commitTick(openState(opening), { cash: 90 });
    expect(s.history.cash).toEqual([100, 90]);
    expect(s.history.units).toEqual([5, 5]);
  });

  it("does not mutate the state it was given", () => {
    const first = openState(opening);
    commitTick(first, { cash: 0 });
    expect(first.current.cash).toBe(100);
    expect(first.history.cash).toEqual([100]);
  });

  it("reads a value back through time, clamping at the opening", () => {
    let s = openState(opening);
    s = commitTick(s, { cash: 90 });
    s = commitTick(s, { cash: 80 });
    expect(valueAt(s, "cash", 0)).toBe(80);
    expect(valueAt(s, "cash", 1)).toBe(90);
    expect(valueAt(s, "cash", 99)).toBe(100);
  });

  it("reports change since the start, and zero when it started at zero", () => {
    let s = openState({ cash: 100, zero: 0 });
    s = commitTick(s, { cash: 150, zero: 9 });
    expect(changeSinceStart(s, "cash")).toBeCloseTo(0.5, 6);
    expect(changeSinceStart(s, "zero")).toBe(0);
  });

  it("transposes history into chart rows", () => {
    let s = openState(opening);
    s = commitTick(s, { cash: 90 });
    const rows = toChartRows(s, ["cash"], (t) => `M${t}`);
    expect(rows).toEqual([
      { period: "M0", cash: 100 },
      { period: "M1", cash: 90 },
    ]);
  });
});

// ─── Journal ───────────────────────────────────────────────────────────────

describe("journal", () => {
  const entry = (tick: number): JournalEntry => ({
    tick,
    decision: { orderQuantity: 100 + tick },
    draws: [{ name: "demandShock", value: 0.2, percentile: 0.6 }],
    state: { cash: 500 - tick },
    scenarios: tick === 1 ? ["port-strike"] : [],
    hidden: { regime: tick % 2 },
    financial: { netProfit: 10 },
  });

  it("survives a serialise/parse round trip", () => {
    let j = openJournal("s", "buyback-contract");
    j = appendEntry(j, entry(0));
    j = appendEntry(j, entry(1));
    expect(parseJournal(serialiseJournal(j))).toEqual(j);
  });

  it("returns null for junk rather than throwing", () => {
    expect(parseJournal("not json")).toBeNull();
    expect(parseJournal(null)).toBeNull();
    expect(parseJournal("{}")).toBeNull();
  });

  it("extracts the decisions needed to replay a counterfactual", () => {
    let j = openJournal("s", "x");
    j = appendEntry(j, entry(0));
    j = appendEntry(j, entry(1));
    expect(decisionsOf(j)).toEqual([{ orderQuantity: 100 }, { orderQuantity: 101 }]);
    expect(pathOf(j, "cash")).toEqual([500, 499]);
    expect(hiddenPathOf(j, "regime")).toEqual([0, 1]);
  });
});

// ─── Agent ─────────────────────────────────────────────────────────────────

describe("agent", () => {
  const config: AgentConfig = {
    id: "supplier",
    label: "Supplier",
    actions: [
      // A generous stance trades margin for volume and carries the exposure;
      // a tight one keeps margin and carries none. Without the volume term
      // there is no tension and the tight action wins at every belief, which is
      // a fixture that cannot test what this file is here to test.
      { id: "generous", label: "Wide", offers: { price: 400 }, terms: { margin: 0.5, volume: 1.4, exposure: 1.0 } },
      { id: "tight", label: "Tight", offers: { price: 200 }, terms: { margin: 1.3, volume: 0.35, exposure: 0.1 } },
    ],
    utilityWeights: { margin: 1.0, volume: 1.5, exposure: 2.0 },
    temperature: 0.2,
    beliefKey: "trust",
    beliefWeight: 2.0,
    exposureTerm: "exposure",
  };

  it("softmax sums to one and prefers the higher utility", () => {
    const p = softmax([2, 1], 0.5);
    expect(p[0] + p[1]).toBeCloseTo(1, 10);
    expect(p[0]).toBeGreaterThan(p[1]);
  });

  it("softmax survives utilities large enough to overflow exp()", () => {
    const p = softmax([1e6, 1e6 - 1], 0.5);
    expect(p.every(Number.isFinite)).toBe(true);
    expect(p[0] + p[1]).toBeCloseTo(1, 10);
  });

  it("a high temperature flattens the distribution, a low one sharpens it", () => {
    const hot = softmax([2, 1], 50);
    const cold = softmax([2, 1], 0.05);
    expect(Math.abs(hot[0] - hot[1])).toBeLessThan(Math.abs(cold[0] - cold[1]));
  });

  /**
   * The belief must REORDER the actions, not merely rescale them. Scaling every
   * utility by a trust factor leaves the ranking identical at every belief —
   * which was the first implementation, and it made a distrustful supplier
   * random rather than careful.
   */
  it("belief changes which action is preferred, not just how sharply", () => {
    const at = (trust: number) =>
      config.actions.map((a) =>
        expectedUtility(a, config.utilityWeights, trust, config.beliefWeight, config.exposureTerm),
      );

    const trusting = at(0.95);
    const wary = at(0.05);
    expect(trusting[0]).toBeGreaterThan(trusting[1]); // generous wins on trust
    expect(wary[0]).toBeLessThan(wary[1]); // tight wins without it
  });

  it("moves the expected offer monotonically with belief", () => {
    const low = expectedOffer(config, { trust: 0.1 }, "price");
    const mid = expectedOffer(config, { trust: 0.5 }, "price");
    const high = expectedOffer(config, { trust: 0.95 }, "price");
    expect(low).toBeLessThan(mid);
    expect(mid).toBeLessThan(high);
  });

  it("quotes reproducibly from the same generator", () => {
    const a = quote({ config, state: { trust: 0.6 }, rng: createRng("q") });
    const b = quote({ config, state: { trust: 0.6 }, rng: createRng("q") });
    expect(a.actionId).toBe(b.actionId);
    expect(a.probabilities).toEqual(b.probabilities);
  });

  it("contains no threshold: the offer curve has no flat step", () => {
    // A rule like `if (trust < 0.5)` would show up as two plateaus. A softmax
    // over a continuous utility cannot produce one.
    const points = Array.from({ length: 40 }, (_, i) =>
      expectedOffer(config, { trust: i / 39 }, "price"),
    );
    const deltas = points.slice(1).map((p, i) => p - points[i]);
    expect(deltas.every((d) => d > 0)).toBe(true);
  });
});

// ─── Transition ────────────────────────────────────────────────────────────

describe("transition mechanisms", () => {
  it("elasticity: raising the lever lowers the response", () => {
    const at = (level: number) =>
      elasticityResponse({
        level,
        referenceLevel: 1200,
        base: 800,
        elasticity: 1.3,
        multiplier: 1,
        exponentSign: -1,
        shock: 0,
      });
    expect(at(1200)).toBeCloseTo(800, 6);
    expect(at(1400)).toBeLessThan(at(1200));
    expect(at(1000)).toBeGreaterThan(at(1200));
  });

  it("elasticity: a higher elasticity means a bigger response to the same move", () => {
    const move = (e: number) =>
      elasticityResponse({
        level: 1320,
        referenceLevel: 1200,
        base: 800,
        elasticity: e,
        multiplier: 1,
        exponentSign: -1,
        shock: 0,
      });
    expect(move(1.8)).toBeLessThan(move(0.95));
  });

  it("queue: waiting time is convex in utilisation", () => {
    const w = (rho: number) => queueDelay({ utilisation: rho, baseTime: 4.7, maxTime: 1e9, shock: 0 });
    const stepLow = w(0.6) - w(0.5);
    const stepMid = w(0.8) - w(0.7);
    const stepHigh = w(0.95) - w(0.85);
    expect(stepMid).toBeGreaterThan(stepLow);
    expect(stepHigh).toBeGreaterThan(stepMid);
  });

  it("queue: never divides by zero at full utilisation, and respects its cap", () => {
    const w = queueDelay({ utilisation: 1, baseTime: 5, maxTime: 75, shock: 0 });
    expect(Number.isFinite(w)).toBe(true);
    expect(w).toBe(75);
  });

  it("bayes: evidence moves the posterior toward itself, and stays in (0,1)", () => {
    const down = bayesBeliefUpdate({ prior: 0.8, observed: 0.1, priorStrength: 6, decay: 0.08 });
    const up = bayesBeliefUpdate({ prior: 0.8, observed: 1.0, priorStrength: 6, decay: 0.08 });
    expect(down).toBeLessThan(0.8);
    expect(up).toBeGreaterThan(0.8);
    expect(down).toBeGreaterThan(0);
    expect(up).toBeLessThan(1);
  });

  it("bayes: a stronger prior moves less on the same evidence", () => {
    const weak = bayesBeliefUpdate({ prior: 0.8, observed: 0.1, priorStrength: 2, decay: 0 });
    const strong = bayesBeliefUpdate({ prior: 0.8, observed: 0.1, priorStrength: 40, decay: 0 });
    expect(0.8 - weak).toBeGreaterThan(0.8 - strong);
  });

  it("bayes: repeated bad evidence compounds", () => {
    let b = 0.8;
    for (let i = 0; i < 6; i++) {
      b = bayesBeliefUpdate({ prior: b, observed: 0.2, priorStrength: 6, decay: 0.08 });
    }
    expect(b).toBeLessThan(0.45);
  });
});

// ─── Financials ────────────────────────────────────────────────────────────

describe("financials", () => {
  const config: FinancialsConfig = {
    receivableDays: 30,
    payableDays: 45,
    wacc: 0.12,
    daysPerPeriod: 30,
  };

  it("converts payment terms into ticks", () => {
    expect(lagInTicks(30, 30)).toBe(1);
    expect(lagInTicks(45, 30)).toBe(2);
    expect(lagInTicks(0, 30)).toBe(0);
  });

  it("recognises revenue now and collects it later", () => {
    const { posted } = postPeriod({
      tick: 0,
      config,
      ledger: openLedger(),
      openingCash: 500_000,
      revenue: 960_000,
      costOfGoodsSold: 560_000,
      contractSettlement: 0,
      operatingCost: 250_000,
      inventoryValue: 0,
    });
    // Profitable on the P&L…
    expect(posted.pnl.netProfit).toBe(150_000);
    // …and cash went DOWN, because nothing has been collected yet.
    expect(posted.cashFlow.collected).toBe(0);
    expect(posted.balance.cash).toBe(250_000);
    expect(posted.balance.receivables).toBe(960_000);
  });

  it("collects and pays on schedule as ticks advance", () => {
    let ledger = openLedger();
    let cash = 500_000;
    for (let tick = 0; tick < 3; tick++) {
      const r = postPeriod({
        tick,
        config,
        ledger,
        openingCash: cash,
        revenue: 960_000,
        costOfGoodsSold: 560_000,
        contractSettlement: 0,
        operatingCost: 250_000,
        inventoryValue: 0,
      });
      ledger = r.ledger;
      cash = r.posted.balance.cash;
      if (tick === 1) expect(r.posted.cashFlow.collected).toBe(960_000);
      // 45-day payables land two ticks out.
      if (tick === 2) expect(r.posted.cashFlow.paid).toBe(560_000);
    }
  });

  it("balances: net assets equal cash + receivables + stock − payables", () => {
    const { posted } = postPeriod({
      tick: 0,
      config,
      ledger: openLedger(),
      openingCash: 100_000,
      revenue: 50_000,
      costOfGoodsSold: 30_000,
      contractSettlement: 5_000,
      operatingCost: 10_000,
      inventoryValue: 7_000,
    });
    expect(posted.balance.netAssets).toBeCloseTo(
      posted.balance.cash + posted.balance.receivables + 7_000 - posted.balance.payables,
      6,
    );
  });

  it("discounts a period at the annualised rate", () => {
    const rate = periodDiscountRate(0.12, 30);
    expect(rate).toBeGreaterThan(0);
    expect(Math.pow(1 + rate, 365 / 30) - 1).toBeCloseTo(0.12, 6);
  });

  it("values a future flow below the same flow today", () => {
    const now = rollingNpv({ realisedCashFlows: [100], forwardEstimate: 0, periodsRemaining: 0, config });
    const later = rollingNpv({ realisedCashFlows: [0, 100], forwardEstimate: 0, periodsRemaining: 0, config });
    expect(later).toBeLessThan(now);
  });

  it("prices the remaining periods at the forward estimate", () => {
    const flat = rollingNpv({ realisedCashFlows: [100], forwardEstimate: 0, periodsRemaining: 6, config });
    const growing = rollingNpv({ realisedCashFlows: [100], forwardEstimate: 100, periodsRemaining: 6, config });
    expect(growing).toBeGreaterThan(flat);
  });

  it("computes a cash conversion cycle that lengthens with slower collection", () => {
    const base = {
      inventoryValue: 100_000,
      payables: 200_000,
      costOfGoodsSold: 560_000,
      revenue: 960_000,
      daysPerPeriod: 30,
    };
    expect(cashConversionCycle({ ...base, receivables: 1_920_000 })).toBeGreaterThan(
      cashConversionCycle({ ...base, receivables: 960_000 }),
    );
  });
});
