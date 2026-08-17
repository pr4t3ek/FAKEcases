/**
 * KPIs, and the distribution a run should be read against.
 *
 * One number is not a result. A student who clears a good NPV on a lucky draw
 * and one who clears the same NPV against the odds have not done the same
 * thing, and the only way to tell them apart is to know what the other paths
 * looked like — so the Monte Carlo is part of scoring rather than a decoration
 * on the debrief.
 *
 * Reuses `weightedOverallFor` and the rubric shape from `lib/sim/formats/types`,
 * so a config-driven simulator is graded through the same machinery as the
 * thirteen scenario-driven ones.
 */

import { clamp } from "@/lib/utils";
import { weightedOverallFor, type SimFormat } from "@/lib/sim/formats/types";
import { bandForSimScore } from "@/lib/config/simulation";
import { cashConversionCycle, rollingNpv } from "./financials";
import { openRun, runTick, type RunContext } from "./time";
import { expectedOffer, quote } from "./agent";
import { createRng } from "./stochastic";
import { openJournal } from "./journal";
import type { SimulatorConfig } from "@/lib/sim/configs/types";
import type { SimState } from "./state";

export interface KpiValue {
  key: string;
  label: string;
  value: number;
  unit: string;
  goodDirection: "up" | "down";
}

/**
 * The KPIs a config declares.
 *
 * Every state key here comes from the config. An earlier version read
 * `state.history.inventory`, `state.history.unitsSold` and four more names
 * directly, which put this domain's vocabulary inside a shared engine — caught
 * by the prohibition test rather than by review, which is the argument for
 * having written it.
 */
export function computeKpis(args: {
  config: SimulatorConfig;
  state: SimState;
  cashFlows: number[];
  receivables: number;
  payables: number;
}): KpiValue[] {
  const { config, state, cashFlows } = args;

  const sumOf = (key: string) => (state.history[key] ?? []).reduce((a, b) => a + b, 0);
  const meanOf = (key: string) => {
    const series = state.history[key] ?? [];
    return series.length ? sumOf(key) / series.length : 0;
  };
  const ticks = Math.max(1, state.tick);

  const evaluate = (formula: SimulatorConfig["kpis"][number]["formula"]): number => {
    switch (formula.kind) {
      case "npv":
        return rollingNpv({
          realisedCashFlows: cashFlows,
          forwardEstimate: 0,
          periodsRemaining: 0,
          config: config.financials,
        });
      case "ratioOfSums": {
        const den = sumOf(formula.denominatorKey);
        return den > 0 ? clamp(sumOf(formula.numeratorKey) / den, 0, 1) : 1;
      }
      case "marginOfSums": {
        const total = sumOf(formula.totalKey);
        return total > 0 ? (total - sumOf(formula.costKey)) / total : 0;
      }
      case "turnover": {
        const stock = meanOf(formula.stockKey);
        return stock > 0 ? sumOf(formula.flowKey) / stock : 0;
      }
      case "cashCycle":
        return cashConversionCycle({
          heldAssetValue: state.current[formula.stockValueKey] ?? 0,
          receivables: args.receivables,
          payables: args.payables,
          costOfGoodsSold: sumOf(formula.periodCostKey) / ticks,
          revenue: sumOf(formula.periodRevenueKey) / ticks,
          daysPerPeriod: config.financials.daysPerPeriod,
        });
    }
  };

  return config.kpis.map((k) => ({
    key: k.key,
    label: k.label,
    value: evaluate(k.formula),
    unit: k.unit,
    goodDirection: k.goodDirection,
  }));
}

/**
 * Rolling NPV mid-run.
 *
 * The forward estimate uses the counterparty's EXPECTED offer rather than a
 * sampled one — see `expectedOffer` — so valuing a run cannot change it. This
 * is also why a belief that has fallen shows up in the valuation immediately
 * even when the month just posted was fine: the expectation of every remaining
 * month moved, and that is what NPV is for.
 */
export function rollingValuation(ctx: RunContext): number {
  const { config } = ctx;
  const periodsRemaining = Math.max(0, config.horizon - ctx.state.tick);

  const contractKey = config.settlement.contract?.priceKey;
  const expectedContractPrice = contractKey
    ? expectedOffer(config.agent, ctx.state.current, contractKey)
    : 0;

  // The forward month is the MEAN of what has been realised, not the last one.
  // Extrapolating a single month makes the valuation swing on ordinary noise —
  // and the first month, which collects nothing under 30-day terms, would price
  // the whole year as a disaster.
  const meanCash =
    ctx.cashFlows.length > 0
      ? ctx.cashFlows.reduce((a, b) => a + b, 0) / ctx.cashFlows.length
      : 0;

  // The terms adjustment is ADDITIVE, in rupees, not a multiplier on total cash
  // flow. As a multiplier it inverted whenever cash flow was negative — worse
  // terms scaled a negative number toward zero and the valuation went UP, so a
  // collapsing relationship read as good news. It is a price difference times a
  // quantity, so that is how it is priced.
  const quantityKey = config.settlement.contract?.quantityKey;
  const expectedUnits = quantityKey
    ? (ctx.state.history[quantityKey] ?? []).slice(-3).reduce((a, b, _, arr) => a + b / arr.length, 0)
    : 0;
  const priceNow = contractKey ? (ctx.state.current[contractKey] ?? 0) : 0;
  const termsDelta = (expectedContractPrice - priceNow) * expectedUnits;

  return rollingNpv({
    realisedCashFlows: ctx.cashFlows,
    forwardEstimate: meanCash + termsDelta,
    periodsRemaining,
    config: config.financials,
  });
}

export interface MonteCarloResult {
  /** Primary KPI per path, sorted ascending. */
  outcomes: number[];
  p10: number;
  median: number;
  p90: number;
  /** Where a run's own result sits in the distribution, [0,1]. */
  percentileOf: (value: number) => number;
}

/**
 * N paths under a policy, for the risk distribution.
 *
 * Each path gets its own seed derived from the run's, so the distribution is
 * reproducible from the same run — a debrief that showed a different histogram
 * on every visit would be worse than showing none.
 */
export function monteCarlo(args: {
  config: SimulatorConfig;
  seed: string;
  paths: number;
  policy: (tick: number, state: Record<string, number>) => Record<string, number>;
}): MonteCarloResult {
  const { config, seed, paths, policy } = args;
  const outcomes: number[] = [];

  for (let p = 0; p < paths; p++) {
    let ctx = openRun(config, `${seed}:mc:${p}`, openJournal(`${seed}:mc:${p}`, config.slug));
    const quoteRng = createRng(`${seed}:mc:${p}:quote`);

    for (let t = 0; t < config.horizon; t++) {
      const offered = quote({ config: config.agent, state: ctx.state.current, rng: quoteRng });
      const decision = policy(t, ctx.state.current);
      ctx = runTick(ctx, decision, offered.offers).ctx;
    }
    outcomes.push(
      rollingNpv({
        realisedCashFlows: ctx.cashFlows,
        forwardEstimate: 0,
        periodsRemaining: 0,
        config: config.financials,
      }),
    );
  }

  outcomes.sort((a, b) => a - b);
  const at = (q: number) => outcomes[clamp(Math.floor(q * outcomes.length), 0, outcomes.length - 1)];

  return {
    outcomes,
    p10: at(0.1),
    median: at(0.5),
    p90: at(0.9),
    percentileOf: (value: number) =>
      outcomes.filter((o) => o <= value).length / Math.max(1, outcomes.length),
  };
}

export interface RunScore {
  scores: Record<string, number>;
  overall: number;
  band: string;
  kpis: KpiValue[];
  npv: number;
  /** Where this run landed against the Monte Carlo, [0,1]. */
  riskPercentile: number;
}

/**
 * Grade a finished run against its own distribution.
 *
 * Normalising against the Monte Carlo rather than an absolute is the same
 * principle the war rooms use with `bestAllocation`: a score has to mean
 * something relative to what was achievable, or nobody can calibrate it.
 */
export function scoreRun(args: {
  config: SimulatorConfig;
  format: SimFormat;
  ctx: RunContext;
  distribution: MonteCarloResult;
  receivables: number;
  payables: number;
}): RunScore {
  const { config, format, ctx, distribution } = args;

  const kpis = computeKpis({
    config,
    state: ctx.state,
    cashFlows: ctx.cashFlows,
    receivables: args.receivables,
    payables: args.payables,
  });
  const npv = kpis.find((k) => k.key === config.primaryKpi)?.value ?? 0;
  const riskPercentile = distribution.percentileOf(npv);

  const byKey = Object.fromEntries(kpis.map((k) => [k.key, k.value]));
  const scores: Record<string, number> = {};
  for (const dim of format.rubric) {
    // Each rubric key names a KPI; the score is where that KPI landed, scaled
    // so a good direction is always "higher is better".
    const raw = byKey[dim.key] ?? 0;
    scores[dim.key] =
      dim.key === config.primaryKpi
        ? Math.round(riskPercentile * 100)
        : clamp(Math.round(raw * 100), 0, 100);
  }

  const overall = weightedOverallFor(format, scores);
  return { scores, overall, band: bandForSimScore(overall), kpis, npv, riskPercentile };
}
