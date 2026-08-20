/**
 * The clock, and the order things happen in.
 *
 * Five phases per tick, always in this order:
 *
 *   reveal   — the world moves, the counterparty quotes. Nothing the student
 *              did this period has landed yet.
 *   decide   — the student commits, against what reveal showed them.
 *   realize  — mechanisms fire, then plain arithmetic settles quantities.
 *   settle   — the period is posted to all three statements at once.
 *   update   — beliefs and regime move, state and journal are committed.
 *
 * The order is the substance. `reveal` before `decide` is what makes the quote
 * information the student acts on rather than a consequence of what they chose;
 * `update` last is what makes a belief shift arrive as *next* period's problem,
 * which is the whole mechanism behind trust having teeth.
 *
 * Domain-free: everything specific arrives in `SimulatorConfig`.
 */

import { clamp } from "@/lib/utils";
import { quoteAll, type AgentQuotes } from "./agent";
import { openLedger, postPeriod, type Ledger, type PostedPeriod } from "./financials";
import { appendEntry, type JournalDraw, type JournalEntry, type RunJournal } from "./journal";
import { commitTick, openState, type SimState } from "./state";
import { correlatedShocks, createRng, hmmStep, type Rng } from "./stochastic";
import { applyMechanism } from "./transition";
import type { DerivationSpec, SimulatorConfig } from "@/lib/sim/configs/types";

export const TICK_PHASES = ["reveal", "decide", "realize", "settle", "update"] as const;
export type TickPhase = (typeof TICK_PHASES)[number];

/** Everything carried between ticks. */
export interface RunContext {
  config: SimulatorConfig;
  state: SimState;
  ledger: Ledger;
  rng: Rng;
  journal: RunJournal;
  /** Index into `config.regimes`. Hidden from the student. */
  regime: number;
  /** Live matrix — a branch choice replaces it mid-run. */
  transitionMatrix: number[][];
  /** Net cash per tick so far, for the rolling valuation. */
  cashFlows: number[];
}

export function openRun(config: SimulatorConfig, seed: string, journal: RunJournal): RunContext {
  return {
    config,
    state: openState(config.initialState),
    ledger: openLedger(),
    rng: createRng(seed),
    journal,
    regime: 0,
    transitionMatrix: config.transitionMatrix,
    cashFlows: [],
  };
}

/** What `reveal` produces — the only thing shown before a decision. */
export interface Reveal {
  /** Every counterparty's quote, and their offers merged. */
  quotes: AgentQuotes;
  /** Public state, hidden keys stripped. */
  signals: Record<string, number>;
  branch: SimulatorConfig["branchPoints"][number] | null;
}

/**
 * Phase 1. Note it takes its own generator: the quote must not consume draws
 * from the run's stream, or merely looking at the board would change the run.
 */
export function reveal(ctx: RunContext, quoteRng: Rng): Reveal {
  const hidden = new Set(ctx.config.hiddenKeys);
  const signals: Record<string, number> = {};
  for (const [key, value] of Object.entries(ctx.state.current)) {
    if (!hidden.has(key)) signals[key] = value;
  }

  return {
    quotes: quoteAll({ agents: ctx.config.agents, state: ctx.state.current, rng: quoteRng }),
    signals,
    branch: ctx.config.branchPoints.find((b) => b.atTick === ctx.state.tick) ?? null,
  };
}

/** Evaluate one derivation. Missing keys read as zero rather than throwing. */
function derive(spec: DerivationSpec, state: Record<string, number>, prior: number): number {
  const v = (k: string) => state[k] ?? 0;
  switch (spec.kind) {
    case "min":
      return Math.min(...spec.of.map(v));
    case "sum":
      return spec.of.reduce((s, k) => s + v(k), 0);
    case "product":
      return spec.of.reduce((s, k) => s * v(k), 1);
    case "difference": {
      const value = v(spec.minuend) - v(spec.subtrahend);
      return spec.floor === undefined ? value : Math.max(spec.floor, value);
    }
    case "ratio": {
      const d = v(spec.denominator);
      return d === 0 ? 0 : v(spec.numerator) / d;
    }
    case "accumulate": {
      const value = prior + v(spec.inflow) - v(spec.outflow);
      return spec.floor === undefined ? value : Math.max(spec.floor, value);
    }
  }
}

export interface TickResult {
  ctx: RunContext;
  posted: PostedPeriod;
  entry: JournalEntry;
  firedScenarios: string[];
}

/**
 * Phases 3–5. `decide` is the caller supplying `decision`, because the student
 * is outside this module.
 */
export function runTick(
  ctx: RunContext,
  decision: Record<string, number>,
  quoteOffers: Record<string, number>,
): TickResult {
  const { config } = ctx;

  // ── realize ─────────────────────────────────────────────────────────────
  // One correlated vector per tick, consumed positionally by the mechanisms —
  // which is what makes a bad demand month and a bad supply month arrive
  // together rather than by coincidence.
  const shocks = correlatedShocks(ctx.rng, config.shockCovariance);
  const regime = config.regimes[ctx.regime] ?? config.regimes[0];

  const working: Record<string, number> = {
    ...ctx.state.current,
    ...decision,
    ...quoteOffers,
  };

  const draws: JournalDraw[] = [];
  config.mechanisms.forEach((spec, i) => {
    const sd = Math.sqrt(config.shockCovariance[i]?.[i] ?? 1);
    const result = applyMechanism({
      spec,
      state: working,
      regime,
      shock: shocks[i] ?? 0,
      shockSd: sd,
      rng: ctx.rng,
    });
    working[result.writes] = result.value;
    if (result.draw) {
      draws.push({
        name: result.draw.name,
        value: result.draw.value,
        percentile: result.draw.percentile,
      });
    }
  });

  for (const spec of config.derivations) {
    working[spec.writes] = derive(spec, working, ctx.state.current[spec.writes] ?? 0);
  }

  // ── settle ──────────────────────────────────────────────────────────────
  const line = (l?: { quantityKey: string; priceKey: string }) =>
    l ? (working[l.quantityKey] ?? 0) * (working[l.priceKey] ?? 0) : 0;

  const { posted, ledger } = postPeriod({
    tick: ctx.state.tick,
    config: config.financials,
    ledger: ctx.ledger,
    openingCash: ctx.state.current.cash ?? 0,
    revenue: line(config.settlement.revenue),
    costOfGoodsSold: line(config.settlement.costOfGoods),
    contractSettlement: line(config.settlement.contract),
    operatingCost: working[config.settlement.operatingCostKey] ?? 0,
    // Which key holds value that has not become cash is the domain's to name.
    // Reading one by name here was the last piece of supply chain left in the
    // loop; a domain that holds nothing between periods omits the key entirely.
    heldAssetValue: config.settlement.heldAssetKey
      ? (working[config.settlement.heldAssetKey] ?? 0)
      : 0,
  });
  working.cash = posted.balance.cash;

  // ── update ──────────────────────────────────────────────────────────────
  const nextRegime = hmmStep(ctx.rng, ctx.regime, ctx.transitionMatrix);

  const firedScenarios = config.scenarios
    .filter((s) => {
      const draw = draws.find((d) => d.name === s.trigger.drawName);
      if (!draw || draw.percentile === undefined) return false;
      const above = s.trigger.atOrAbove !== undefined && draw.percentile >= s.trigger.atOrAbove;
      const below = s.trigger.atOrBelow !== undefined && draw.percentile <= s.trigger.atOrBelow;
      return above || below;
    })
    .map((s) => s.id);

  const state = commitTick(ctx.state, working);
  const cashFlows = [...ctx.cashFlows, posted.cashFlow.net];

  const hiddenKeys = new Set(config.hiddenKeys);
  const entry: JournalEntry = {
    tick: ctx.state.tick,
    decision,
    draws,
    state: Object.fromEntries(
      Object.entries(state.current).filter(([k]) => !hiddenKeys.has(k)),
    ),
    scenarios: firedScenarios,
    hidden: {
      regime: ctx.regime,
      ...Object.fromEntries(config.hiddenKeys.map((k) => [k, state.current[k] ?? 0])),
    },
    financial: {
      revenue: posted.pnl.revenue,
      netProfit: posted.pnl.netProfit,
      netCash: posted.cashFlow.net,
      receivables: posted.balance.receivables,
      payables: posted.balance.payables,
    },
  };

  return {
    ctx: {
      ...ctx,
      state,
      ledger,
      regime: nextRegime,
      cashFlows,
      journal: appendEntry(ctx.journal, entry),
    },
    posted,
    entry,
    firedScenarios,
  };
}

/** Swap the transition matrix from this tick on. */
export function applyBranch(ctx: RunContext, matrix: number[][]): RunContext {
  return { ...ctx, transitionMatrix: matrix };
}

export function isFinished(ctx: RunContext): boolean {
  return ctx.state.tick >= ctx.config.horizon;
}

/** How far through, in [0,1] — for a progress meter. */
export function progress(ctx: RunContext): number {
  return clamp(ctx.state.tick / Math.max(1, ctx.config.horizon), 0, 1);
}
