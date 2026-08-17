/**
 * The behaviours the buyback simulator was commissioned to produce, and the
 * four things it was commissioned NOT to do.
 *
 * Everything here runs the real engines against the real config. None of it
 * reaches inside a module to check an implementation — each test states an
 * outcome a student would notice and asserts the system produces it, which is
 * the only kind of check that survives a refactor.
 */

import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { buybackConfig } from "@/lib/sim/configs/buyback";
import { getSimulatorConfig, listSimulators } from "@/lib/sim/configs/registry";
import { quote, expectedOffer } from "@/lib/sim/engine/agent";
import { createRng, correlatedShocks } from "@/lib/sim/engine/stochastic";
import { openJournal, serialiseJournal } from "@/lib/sim/engine/journal";
import { openRun, runTick, type RunContext } from "@/lib/sim/engine/time";
import { rollingValuation } from "@/lib/sim/engine/scoring";
import type { SimulatorConfig } from "@/lib/sim/configs/types";

/** Play a whole run under a fixed order policy. */
function play(args: {
  config?: SimulatorConfig;
  seed: string;
  order: (tick: number) => number;
  price?: number;
  ticks?: number;
}) {
  const config = args.config ?? buybackConfig;
  const seed = args.seed;
  let ctx: RunContext = openRun(config, seed, openJournal(seed, config.slug));
  const quoteRng = createRng(`${seed}:quote`);
  const quotes: { buybackPrice: number; buybackShare: number }[] = [];

  const ticks = args.ticks ?? config.horizon;
  for (let t = 0; t < ticks; t++) {
    const offered = quote({ config: config.agent, state: ctx.state.current, rng: quoteRng });
    quotes.push({
      buybackPrice: offered.offers.buybackPrice,
      buybackShare: offered.offers.buybackShare,
    });
    ctx = runTick(
      ctx,
      { orderQuantity: args.order(t), retailPrice: args.price ?? 1_200 },
      offered.offers,
    ).ctx;
  }
  return { ctx, quotes };
}

// ─── 1. Over-ordering costs you the relationship ──────────────────────────

describe("repeated over-ordering worsens the supplier's terms", () => {
  const disciplined = play({ seed: "trust", order: () => 800 });
  const overOrdering = play({ seed: "trust", order: () => 1_050 });

  it("drops the supplier's trust", () => {
    const start = buybackConfig.initialState.supplierTrust;
    expect(overOrdering.ctx.state.current.supplierTrust).toBeLessThan(start);
    expect(disciplined.ctx.state.current.supplierTrust).toBeGreaterThan(start);
  });

  it("AND worsens what the supplier will quote next month", () => {
    const priceAfter = (r: typeof disciplined) =>
      expectedOffer(buybackConfig.agent, r.ctx.state.current, "buybackPrice");
    const shareAfter = (r: typeof disciplined) =>
      expectedOffer(buybackConfig.agent, r.ctx.state.current, "buybackShare");

    expect(priceAfter(overOrdering)).toBeLessThan(priceAfter(disciplined));
    expect(shareAfter(overOrdering)).toBeLessThan(shareAfter(disciplined));
  });

  it("degrades monotonically with how much you over-order", () => {
    // Not a threshold being crossed — a curve. A hardcoded rule would show up
    // here as two flat regions.
    const trustFor = (q: number) => play({ seed: "mono", order: () => q }).ctx.state.current.supplierTrust;
    const curve = [700, 800, 900, 1_000, 1_100].map(trustFor);
    for (let i = 1; i < curve.length; i++) {
      expect(curve[i]).toBeLessThan(curve[i - 1]);
    }
  });

  it("gets there through the belief, not through the order quantity", () => {
    // The quote is a function of state, and the ONLY state the agent reads is
    // its belief. Same belief, same expected offer, regardless of history.
    const a = expectedOffer(buybackConfig.agent, { supplierTrust: 0.4 }, "buybackPrice");
    const b = expectedOffer(
      buybackConfig.agent,
      { supplierTrust: 0.4, orderQuantity: 99_999 },
      "buybackPrice",
    );
    expect(a).toBe(b);
  });
});

// ─── 2. The queue blows up non-linearly ───────────────────────────────────

describe("high utilisation blows lead time up non-linearly", () => {
  it("costs far more at the top of the range than at the bottom", () => {
    const leadAt = (q: number) => play({ seed: "queue", order: () => q, ticks: 3 }).ctx.state.current.leadTime;
    const low = leadAt(600);
    const mid = leadAt(840);
    const high = leadAt(1_080);

    expect(mid).toBeGreaterThan(low);
    expect(high).toBeGreaterThan(mid);
    // Convexity: the same 240-unit step costs more the second time.
    expect(high - mid).toBeGreaterThan(mid - low);
  });

  it("never returns a non-finite wait, even at or beyond full capacity", () => {
    for (const q of [1_200, 1_500, 2_000]) {
      const lead = play({ seed: "cap", order: () => q, ticks: 2 }).ctx.state.current.leadTime;
      expect(Number.isFinite(lead)).toBe(true);
      expect(lead).toBeLessThanOrEqual(75);
    }
  });
});

// ─── 3. Bad outcomes arrive together ──────────────────────────────────────

describe("bad joint outcomes cluster", () => {
  /**
   * The copula check. Correlated draws must put more mass in the joint tail
   * than independent draws with the same marginals — that is the difference
   * between three unrelated inconveniences and a bad month.
   */
  it("puts more mass in the joint lower tail than independence would", () => {
    const cov = buybackConfig.shockCovariance;
    const rng = createRng("copula");
    const independent = createRng("copula-ind");

    const N = 40_000;
    let jointBadCorrelated = 0;
    let jointBadIndependent = 0;

    const draws: number[][] = [];
    for (let i = 0; i < N; i++) draws.push(correlatedShocks(rng, cov));

    // Empirical marginal thresholds, so both counts use the SAME cut points and
    // the comparison is about dependence rather than about scale.
    const cut = (index: number) => {
      const col = draws.map((d) => d[index]).sort((a, b) => a - b);
      return col[Math.floor(0.25 * col.length)];
    };
    const c0 = cut(0);
    const c1 = cut(1);

    for (const d of draws) if (d[0] <= c0 && d[1] <= c1) jointBadCorrelated += 1;

    const ind0: number[] = [];
    const ind1: number[] = [];
    for (let i = 0; i < N; i++) {
      ind0.push(correlatedShocks(independent, [[1]])[0]);
      ind1.push(correlatedShocks(independent, [[1]])[0]);
    }
    const s0 = [...ind0].sort((a, b) => a - b)[Math.floor(0.25 * N)];
    const s1 = [...ind1].sort((a, b) => a - b)[Math.floor(0.25 * N)];
    for (let i = 0; i < N; i++) if (ind0[i] <= s0 && ind1[i] <= s1) jointBadIndependent += 1;

    // Independence gives 0.25² = 6.25%; a +0.5 correlation gives appreciably more.
    expect(jointBadCorrelated / N).toBeGreaterThan(jointBadIndependent / N * 1.4);
    expect(jointBadIndependent / N).toBeCloseTo(0.0625, 2);
  });

  it("wires demand and supply shocks together in the shipped config", () => {
    // Positive between demand and lead time: a busy market is a busy factory.
    expect(buybackConfig.shockCovariance[0][1]).toBeGreaterThan(0);
    // Negative between lead time and yield: a plant running hot makes mistakes.
    expect(buybackConfig.shockCovariance[1][2]).toBeLessThan(0);
  });
});

// ─── 4. The valuation is forward-looking ──────────────────────────────────

describe("rolling NPV falls when trust falls, even on a fine month", () => {
  it("prices the same realised cash lower when the relationship is worse", () => {
    const seed = "npv";
    const base = play({ seed, order: () => 800, ticks: 6 });

    // Same realised cash flows, same everything — only the belief differs.
    const trusted: RunContext = {
      ...base.ctx,
      state: {
        ...base.ctx.state,
        current: { ...base.ctx.state.current, supplierTrust: 0.95 },
      },
    };
    const distrusted: RunContext = {
      ...base.ctx,
      state: {
        ...base.ctx.state,
        current: { ...base.ctx.state.current, supplierTrust: 0.1 },
      },
    };

    expect(rollingValuation(distrusted)).toBeLessThan(rollingValuation(trusted));
  });

  it("shows the damage while this month's profit still looks fine", () => {
    // 900 units against ~800 of demand: a 12% overshoot. Chosen because the
    // month still posts a healthy profit — the first draft of this test used
    // 1,050, where profit is already negative and the assertion proved nothing.
    const heavy = play({ seed: "damage", order: () => 900, ticks: 5 });
    const steady = play({ seed: "damage", order: () => 800, ticks: 5 });

    const lastProfit = (r: typeof heavy) =>
      r.ctx.journal.entries[r.ctx.journal.entries.length - 1].financial.netProfit;

    // The over-ordering month posts a perfectly respectable profit…
    expect(lastProfit(heavy)).toBeGreaterThan(50_000);
    // …and is worth a great deal less, because every month after it is worse.
    expect(heavy.ctx.state.current.supplierTrust).toBeLessThan(
      steady.ctx.state.current.supplierTrust,
    );
    expect(rollingValuation(heavy.ctx)).toBeLessThan(rollingValuation(steady.ctx) * 0.9);
  });
});

// ─── 5. Reproducibility ───────────────────────────────────────────────────

describe("the same seed produces the same run", () => {
  it("matches on the whole journal, byte for byte", () => {
    const a = play({ seed: "identical", order: (t) => 800 + t * 10 });
    const b = play({ seed: "identical", order: (t) => 800 + t * 10 });
    expect(serialiseJournal(a.ctx.journal)).toBe(serialiseJournal(b.ctx.journal));
  });

  it("differs on a different seed", () => {
    const a = play({ seed: "seed-a", order: () => 800 });
    const b = play({ seed: "seed-b", order: () => 800 });
    expect(serialiseJournal(a.ctx.journal)).not.toBe(serialiseJournal(b.ctx.journal));
  });

  it("replays a counterfactual against identical draws", () => {
    // Same seed, one decision changed: every random number lands the same, so
    // the difference is attributable to the decision alone. This is what makes
    // the debrief's alternate histories honest rather than illustrative.
    const actual = play({ seed: "cf", order: () => 800 });
    const counterfactual = play({ seed: "cf", order: (t) => (t === 3 ? 1_100 : 800) });

    const drawsOf = (r: typeof actual) =>
      r.ctx.journal.entries.slice(0, 3).map((e) => e.draws.map((d) => d.value));
    expect(drawsOf(counterfactual)).toEqual(drawsOf(actual));
    expect(counterfactual.ctx.state.current.cash).not.toBe(actual.ctx.state.current.cash);
  });
});

// ─── The four prohibitions ────────────────────────────────────────────────

const ENGINE_DIR = join(process.cwd(), "lib/sim/engine");
const engineFiles = readdirSync(ENGINE_DIR).filter((f) => f.endsWith(".ts"));
const engineSource = Object.fromEntries(
  engineFiles.map((f) => [f, readFileSync(join(ENGINE_DIR, f), "utf8")]),
);

describe("the engines stay generic", () => {
  it("has all seven engine modules", () => {
    expect(engineFiles.sort()).toEqual([
      "agent.ts",
      "financials.ts",
      "journal.ts",
      "scoring.ts",
      "state.ts",
      "stochastic.ts",
      "time.ts",
      "transition.ts",
    ]);
  });

  it("imports no React, no Next and no database", () => {
    for (const [file, src] of Object.entries(engineSource)) {
      const imports = [...src.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
      for (const spec of imports) {
        expect(spec, `${file} imports ${spec}`).not.toMatch(/^react|^next|lib\/db|@prisma/);
      }
    }
  });

  it("carries no supply-chain vocabulary", () => {
    // The words that would mean an engine had learned this domain. Comments are
    // stripped first: the modules explain themselves with examples, and a word
    // in prose is documentation, not coupling.
    //
    // No trailing \b, and that is the fix rather than an oversight. With one,
    // this test passed for months while `financials.ts` took an `inventoryValue`
    // argument and `time.ts` read `working.inventoryValue` by name — a whole
    // balance-sheet line of supply chain sitting in the shared loop, invisible
    // because the identifier was camelCase and the word boundary fell inside it.
    const forbidden = /\b(inventor|backlog|wholesale|buyback|supplier|factory|sku|warehouse|shipment)/i;
    for (const [file, src] of Object.entries(engineSource)) {
      const code = src
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "");
      const hit = code.match(forbidden);
      expect(hit?.[0], `${file} names "${hit?.[0]}" in code`).toBeUndefined();
    }
  });

  it("holds no domain constants: perturbing the config moves the output", () => {
    // An engine keeping its own number would not react to this.
    const softer: SimulatorConfig = {
      ...buybackConfig,
      mechanisms: buybackConfig.mechanisms.map((m) =>
        m.kind === "elasticity" ? { ...m, base: m.base * 2 } : m,
      ),
    };
    const normal = play({ seed: "cfg", order: () => 800, ticks: 4 });
    const doubled = play({ config: softer, seed: "cfg", order: () => 800, ticks: 4 });
    expect(doubled.ctx.state.current.demand).toBeGreaterThan(normal.ctx.state.current.demand * 1.8);
  });
});

describe("scenarios fire from tail draws, never from the calendar", () => {
  it("declares every trigger as a percentile of a named draw", () => {
    for (const s of buybackConfig.scenarios) {
      expect(s.trigger.drawName).toBeTruthy();
      expect(s.trigger.atOrAbove ?? s.trigger.atOrBelow).toBeTypeOf("number");
    }
  });

  it("fires the same scenario at different months under different seeds", () => {
    const monthsFor = (seed: string) => {
      const r = play({ seed, order: () => 800 });
      return r.ctx.journal.entries.flatMap((e) => e.scenarios.map((id) => `${id}@${e.tick}`));
    };
    const runs = ["a", "b", "c", "d", "e", "f"].map(monthsFor);
    const flat = runs.flat();
    expect(flat.length).toBeGreaterThan(0);

    // No scenario id is pinned to one month across seeds.
    const byId: Record<string, Set<number>> = {};
    for (const tag of flat) {
      const [id, tick] = tag.split("@");
      (byId[id] ??= new Set()).add(Number(tick));
    }
    const spread = Object.values(byId).some((ticks) => ticks.size > 1);
    expect(spread, "every scenario fired in exactly one month across six seeds").toBe(true);
  });

  it("fires roughly as often as its threshold implies", () => {
    // A 95th-percentile trigger should be rare, not routine.
    let fired = 0;
    let months = 0;
    for (let i = 0; i < 40; i++) {
      const r = play({ seed: `freq-${i}`, order: () => 800 });
      for (const e of r.ctx.journal.entries) {
        months += 1;
        if (e.scenarios.includes("port-strike")) fired += 1;
      }
    }
    const rate = fired / months;
    expect(rate).toBeGreaterThan(0.005);
    expect(rate).toBeLessThan(0.15);
  });
});

describe("the branch points change the world rather than firing an event", () => {
  it("offers two forks, each replacing the regime transition matrix", () => {
    expect(buybackConfig.branchPoints.map((b) => b.atTick)).toEqual([4, 8]);
    for (const b of buybackConfig.branchPoints) {
      expect(b.options.length).toBeGreaterThanOrEqual(2);
      for (const o of b.options) {
        expect(o.transitionMatrix.length).toBe(buybackConfig.regimes.length);
        for (const row of o.transitionMatrix) {
          expect(row.reduce((a, c) => a + c, 0)).toBeCloseTo(1, 2);
        }
      }
    }
  });
});

describe("the config is complete and self-consistent", () => {
  it("is registered under its slug", () => {
    expect(getSimulatorConfig("buyback-contract")?.slug).toBe("buyback-contract");
    expect(getSimulatorConfig("nope")).toBeUndefined();
    expect(listSimulators().length).toBeGreaterThan(0);
  });

  it("runs for the horizon the brief asked for", () => {
    expect(buybackConfig.horizon).toBe(12);
  });

  it("opens where the brief says: no stock, ₹5,00,000, trust 0.75", () => {
    expect(buybackConfig.initialState.inventory).toBe(0);
    expect(buybackConfig.initialState.cash).toBe(500_000);
    expect(buybackConfig.initialState.supplierTrust).toBe(0.75);
  });

  it("has three hidden regimes whose transition rows are distributions", () => {
    expect(buybackConfig.regimes.length).toBe(3);
    for (const row of buybackConfig.transitionMatrix) {
      expect(row.reduce((a, c) => a + c, 0)).toBeCloseTo(1, 6);
    }
  });

  it("keeps the market regime and the supplier's trust hidden during play", () => {
    expect(buybackConfig.hiddenKeys).toContain("marketRegime");
    expect(buybackConfig.hiddenKeys).toContain("supplierTrust");

    const r = play({ seed: "hidden", order: () => 800, ticks: 3 });
    for (const entry of r.ctx.journal.entries) {
      expect(entry.state.supplierTrust).toBeUndefined();
      // …but recorded, so the debrief can reveal it.
      expect(entry.hidden.supplierTrust).toBeTypeOf("number");
      expect(entry.hidden.regime).toBeTypeOf("number");
    }
  });

  it("gives the student exactly the two decisions the brief names", () => {
    expect(buybackConfig.decisions.map((d) => d.key).sort()).toEqual([
      "orderQuantity",
      "retailPrice",
    ]);
    expect(buybackConfig.decisions.find((d) => d.key === "orderQuantity")?.kind).toBe("integer");
    expect(buybackConfig.decisions.find((d) => d.key === "retailPrice")?.kind).toBe("currency");
  });

  it("settles as revenue − COGS + buyback price × units taken back", () => {
    expect(buybackConfig.settlement.contract).toEqual({
      quantityKey: "buybackUnits",
      priceKey: "buybackPrice",
    });
  });

  it("carries five or six narrative wrappers and 30/45-day terms", () => {
    expect(buybackConfig.scenarios.length).toBeGreaterThanOrEqual(5);
    expect(buybackConfig.financials.receivableDays).toBe(30);
    expect(buybackConfig.financials.payableDays).toBe(45);
    expect(buybackConfig.financials.wacc).toBe(0.12);
  });

  it("is playable: ordering to demand ends solvent and beats over-ordering", () => {
    const good = play({ seed: "playable", order: () => 800 });
    const bad = play({ seed: "playable", order: () => 1_100 });
    expect(good.ctx.state.current.cash).toBeGreaterThan(0);
    expect(rollingValuation(good.ctx)).toBeGreaterThan(rollingValuation(bad.ctx));
  });
});
