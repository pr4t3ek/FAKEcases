/**
 * The contract a domain fills in to get a simulator.
 *
 * Everything a simulator knows about its world is here; everything about *how a
 * simulator runs* is in `lib/sim/engine`. The test of that split is
 * `./marketing.ts`: if a second domain cannot be expressed without editing an
 * engine, the split failed and the stub is where it shows.
 *
 * The one judgement call worth stating. Mechanisms are declared as DATA rather
 * than supplied as functions, which makes this a very small wiring language.
 * The alternative — a `step()` callback per config — would be shorter to write
 * and would put domain code back inside the loop the engines own, where the
 * next domain would quietly grow its own physics. Data means the couplings are
 * inspectable, testable and shared: an elasticity is an elasticity whether it
 * governs a price or an advertising budget.
 */

import type { SimFormatRubricDim } from "@/lib/sim/formats/types";

// ─── Hidden world ──────────────────────────────────────────────────────────

/**
 * One hidden regime. The student never sees which is active — only the signals
 * it produces — which is what makes reading the market a skill rather than a
 * lookup.
 */
export interface RegimeConfig {
  id: string;
  label: string;
  /** Scales the mechanism that names this regime as its multiplier source. */
  demandMultiplier: number;
  /** Price sensitivity while this regime holds. */
  elasticity: number;
  /** Noise on the same, as a fraction. */
  noiseSigma: number;
}

// ─── Mechanisms: the non-linear couplings ──────────────────────────────────

/**
 * A coupling the transition engine can evaluate.
 *
 * `reads` and `writes` are state keys, so the same mechanism serves any domain
 * that has the shape. Every number is here rather than in the engine.
 */
export type MechanismSpec =
  /**
   * Constant-elasticity response with a regime multiplier and lognormal noise.
   * Demand against price; equally, awareness against advertising spend.
   */
  | {
      kind: "elasticity";
      writes: string;
      /** The lever. */
      reads: string;
      /** Quantity at `referenceLevel` under a neutral regime. */
      base: number;
      referenceLevel: number;
      /** Sign convention: positive means raising the lever lowers the output. */
      exponentSign: 1 | -1;
      /** Names the draw whose percentile the scenario library can trigger on. */
      shockName: string;
    }
  /**
   * M/G/1 waiting time: `ρ / (1 − ρ)`, blowing up as utilisation approaches 1.
   * The point is that the last 10% of capacity costs far more than the first.
   */
  | {
      kind: "queue";
      writes: string;
      /** Utilisation in [0,1). */
      reads: string;
      /** Wait at zero utilisation. */
      baseTime: number;
      /** Ceiling, because a real queue is abandoned rather than infinite. */
      maxTime: number;
      /**
       * How hard the shock hits, as a fraction. Without it the raw normal
       * multiplies the wait directly, so a 2.5-sigma month triples the lead
       * time and nothing arrives — which the first smoke run did.
       */
      shockScale: number;
      shockName: string;
    }
  /** A proportion in (0,1) — a yield, a conversion, a response rate. */
  | {
      kind: "betaYield";
      writes: string;
      alpha: number;
      beta: number;
      shockName: string;
    }
  /**
   * Bayesian belief update on a Beta posterior: an observed success rate moves
   * a counterparty's belief, weighted by how much evidence it already has.
   */
  | {
      kind: "bayesBelief";
      writes: string;
      /** Observed performance in [0,1] — kept, honoured, delivered. */
      reads: string;
      priorStrength: number;
      /** How fast old evidence is forgotten, in [0,1]. */
      decay: number;
    };


// ─── Derivations: arithmetic on top of the mechanisms ──────────────────────

/**
 * Plain arithmetic over state keys, run after the mechanisms and before money.
 *
 * This is where "you can only sell what you have" and "what is left is unsold"
 * are said — and they are said as `min` and `difference`, not as a fulfilment
 * rule, because a marketing simulator needs exactly the same two operations for
 * "you can only convert the traffic you bought". The vocabulary is deliberately
 * the same as the driver graph in `lib/sim/types.ts`, which has been carrying
 * twelve scenarios on these five shapes.
 */
export type DerivationSpec =
  | { kind: "min"; writes: string; of: string[] }
  | { kind: "sum"; writes: string; of: string[] }
  | { kind: "product"; writes: string; of: string[] }
  | { kind: "difference"; writes: string; minuend: string; subtrahend: string; floor?: number }
  | { kind: "ratio"; writes: string; numerator: string; denominator: string }
  /** Carries a value across ticks: `prior + inflow − outflow`, floored. */
  | { kind: "accumulate"; writes: string; inflow: string; outflow: string; floor?: number };

// ─── Settlement: how a period turns into money ─────────────────────────────

/** One money line, as quantity × price over named state keys. */
export interface SettlementLine {
  quantityKey: string;
  priceKey: string;
}

/**
 * The contract.
 *
 * For a buyback this reads `revenue − COGS + buybackPrice × unsoldUnits`; the
 * third line is what makes it a buyback rather than a plain purchase order.
 * A domain with no such clause simply omits `contract`.
 */
export interface SettlementConfig {
  revenue: SettlementLine;
  costOfGoods: SettlementLine;
  contract?: SettlementLine;
  /** Fixed cost per period, as a state key so a mechanism can move it. */
  operatingCostKey: string;
  /**
   * The state key holding value that has not yet become cash — stock for a
   * distributor, finished-but-unreleased work for a software team.
   *
   * Named by the domain rather than assumed by the engine. `time.ts` read
   * `working.inventoryValue` by name until a second domain arrived, which is one
   * word of supply chain inside a shared loop. Optional: a domain that holds
   * nothing between periods omits it and the balance sheet carries zero.
   */
  heldAssetKey?: string;
}

// ─── The counterparty ──────────────────────────────────────────────────────

/** One quote the agent can offer. Terms are scored by the utility weights. */
export interface AgentActionConfig {
  id: string;
  label: string;
  /**
   * The action's effect on each state key the agent controls, as a multiplier
   * on its own reference level.
   */
  offers: Record<string, number>;
  /**
   * Named quantities the utility function scores — margin, risk, volume. The
   * engine multiplies these by the weights below and never inspects the names.
   */
  terms: Record<string, number>;
}

export interface AgentConfig {
  id: string;
  label: string;
  actions: AgentActionConfig[];
  /** Weight per term name. Unmatched terms score zero. */
  utilityWeights: Record<string, number>;
  /**
   * Softmax temperature. Low is near-deterministic; high is close to random.
   * A real counterparty is neither, which is why this is a dial and not a
   * `Math.max`.
   */
  temperature: number;
  /**
   * How strongly the agent's belief scales the terms it cares about. Named
   * here so the link between belief and quote is a config number rather than a
   * rule inside the engine.
   */
  beliefKey: string;
  beliefWeight: number;
  /**
   * Which term the belief scales as a penalty.
   *
   * Named here rather than assumed, because it is the term that carries the
   * agent's exposure to the buyer behaving badly — a generous buyback for a
   * supplier, a co-op marketing commitment for a channel partner. See
   * `expectedUtility` for why it attaches to one term instead of the whole
   * score.
   */
  exposureTerm: string;
}

// ─── Narrative ─────────────────────────────────────────────────────────────

/**
 * A scenario fires from a TAIL DRAW, never from a month.
 *
 * `atOrAbove`/`atOrBelow` are percentiles of the named draw's own distribution,
 * so the same config produces a port strike in month 3 of one run and month 9
 * of another — and sometimes not at all. That is the difference between a
 * simulation and a script.
 */
export interface ScenarioTrigger {
  drawName: string;
  atOrAbove?: number;
  atOrBelow?: number;
}

export interface ScenarioConfig {
  id: string;
  headline: string;
  body: string;
  trigger: ScenarioTrigger;
}

// ─── Branching ─────────────────────────────────────────────────────────────

/** A fork that changes the world going forward, offered at a fixed tick. */
export interface BranchOptionConfig {
  id: string;
  label: string;
  detail: string;
  /** Replaces the regime transition matrix from this tick on. */
  transitionMatrix: number[][];
}

export interface BranchPointConfig {
  /** 0-based tick at which the choice is offered. */
  atTick: number;
  prompt: string;
  options: BranchOptionConfig[];
}

// ─── Decisions and money ───────────────────────────────────────────────────

export interface DecisionVariableConfig {
  key: string;
  label: string;
  help: string;
  kind: "integer" | "currency";
  min: number;
  max: number;
  step: number;
  default: number;
}

export interface FinancialsConfig {
  /** Days before a sale is collected. */
  receivableDays: number;
  /** Days before a purchase is paid. */
  payableDays: number;
  /** Annual discount rate for the rolling NPV. */
  wacc: number;
  /** Days in a tick, so the AR/AP lags convert to ticks. */
  daysPerPeriod: number;
}

/**
 * How a KPI is computed, in state keys the DOMAIN names.
 *
 * This exists because the first version of `computeKpis` read
 * `state.history.inventory`, `state.history.unitsSold` and four more
 * supply-chain keys directly — six pieces of this domain sitting inside a
 * shared engine, which the prohibition test in `tests/buyback-behaviours.test.ts`
 * caught. The arithmetic is generic; only the key names are not, so the key
 * names moved here.
 */
export type KpiFormula =
  /** Discounted realised cash flow. */
  | { kind: "npv" }
  /** Σnumerator ÷ Σdenominator across history — a service level, a hit rate. */
  | { kind: "ratioOfSums"; numeratorKey: string; denominatorKey: string }
  /** (Σtotal − Σcost) ÷ Σtotal — any margin. */
  | { kind: "marginOfSums"; totalKey: string; costKey: string }
  /** Σflow ÷ mean(stock) — a turnover, of stock or of anything else held. */
  | { kind: "turnover"; flowKey: string; stockKey: string }
  /** Days of working capital tied up. */
  | {
      kind: "cashCycle";
      stockValueKey: string;
      periodCostKey: string;
      periodRevenueKey: string;
    };

export interface KpiConfig {
  key: string;
  label: string;
  /** Formatted at the UI edge with `components/simulation/format.ts` units. */
  unit: "inr" | "count" | "ratio" | "percent" | "days" | "multiple";
  goodDirection: "up" | "down";
  formula: KpiFormula;
}

// ─── The whole thing ───────────────────────────────────────────────────────

export interface SimulatorConfig {
  slug: string;
  /** "supply-chain", "marketing" — grouping only. */
  domain: string;
  label: string;
  /** The briefing. */
  premise: string;
  situation: string;

  horizon: number;
  /** Opening values. Keys define the state vocabulary for the whole run. */
  initialState: Record<string, number>;
  /** State keys withheld from the student and revealed in the debrief. */
  hiddenKeys: string[];

  regimes: RegimeConfig[];
  /** Row i is P(next | current = i). Replaceable by a branch choice. */
  transitionMatrix: number[][];
  /** Covariance for the correlated shocks, in the order the mechanisms declare. */
  shockCovariance: number[][];

  mechanisms: MechanismSpec[];
  derivations: DerivationSpec[];
  settlement: SettlementConfig;
  agent: AgentConfig;

  decisions: DecisionVariableConfig[];
  financials: FinancialsConfig;

  scenarios: ScenarioConfig[];
  branchPoints: BranchPointConfig[];

  /** Scored dimensions, reusing the format rubric shape. */
  rubric: readonly SimFormatRubricDim[];
  kpis: KpiConfig[];
  /** The single number a run is judged on. */
  primaryKpi: string;
  /** Paths in the risk distribution the debrief plots. */
  monteCarloPaths: number;
}
