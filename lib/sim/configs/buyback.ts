/**
 * "Order too much and the supplier stops carrying your risk."
 *
 * A 12-month buyback contract. Each month you order from a supplier who quotes
 * a wholesale price, a buyback price and the share of unsold stock they will
 * take back; you set a retail price; demand arrives against a hidden market
 * regime; whatever does not sell is partly bought back and partly your problem.
 *
 * **Every buyback number and every buyback word in the codebase is in this
 * file.** The engines under `lib/sim/engine` contain no constant, no threshold
 * and no vocabulary from this domain — `./marketing.ts` is the proof.
 *
 * ── The truth, for whoever maintains this ─────────────────────────────────
 *
 * The lesson is that a buyback clause is a RELATIONSHIP, not a term sheet. The
 * fast way to a good month is to over-order: the buyback covers your mistake, so
 * a big order captures every unit of upside demand at somebody else's risk. Do
 * it twice and sell-through falls, the supplier's posterior about you falls with
 * it, and the exposure penalty in its utility makes the generous action stop
 * winning the softmax. The buyback price and the covered share both fall, and
 * they fall for the rest of the run.
 *
 * Nothing in the engines encodes that. It is `bayesBeliefUpdate` feeding
 * `expectedUtility`'s exposure term, and it would happen the same way if the
 * counterparty were a distributor or an ad network.
 *
 * ── Why the numbers are where they are ────────────────────────────────────
 *
 * Base demand is 800 units at a ₹1,200 reference price against 1,200 units of
 * supplier capacity, so ordering to cover the upside pushes utilisation past
 * 0.8 and the M/G/1 term starts biting — the lead time that follows costs
 * on-time delivery, which costs sell-through, which costs trust. The three
 * penalties are the same decision seen at three horizons.
 *
 * Opening cash of ₹5 lakh against a first month that collects nothing (30-day
 * receivables, 45-day payables) is deliberately tight: month one is where a
 * student discovers that a profitable order can still be unaffordable.
 */

import type { SimulatorConfig } from "./types";

const REFERENCE_PRICE = 1_200;
const WHOLESALE_BASE = 700;
const BUYBACK_BASE = 360;

export const buybackConfig: SimulatorConfig = {
  slug: "buyback-contract",
  domain: "supply-chain",
  label: "Buyback contract",
  premise:
    "Twelve months of ordering against a buyback clause, from a supplier who is watching how you use it.",
  situation:
    "You buy a seasonal consumer product from a single supplier and sell it through your own channel. The contract has a buyback clause: whatever you cannot sell, the supplier repurchases — but only up to a share of what you ordered, and only at the price they quote.\n\nEach month you choose how much to order and what to charge. Demand depends on your price and on a market you cannot see directly. You open with ₹5,00,000 in the bank, you collect from customers 30 days after the sale, and you pay the supplier 45 days after the order. Twelve months, and the supplier quotes again every one of them.",

  horizon: 12,

  initialState: {
    // ── The brief's opening position ────────────────────────────────────
    inventory: 0,
    cash: 500_000,
    backlog: 0,
    wholesalePrice: WHOLESALE_BASE,
    buybackPrice: BUYBACK_BASE,
    supplierTrust: 0.75,
    marketRegime: 0,
    factoryUtilization: 0,
    monthIndex: 0,

    // ── Decisions, carrying their defaults ──────────────────────────────
    orderQuantity: 800,
    retailPrice: REFERENCE_PRICE,

    // ── Working quantities, written each tick ───────────────────────────
    demand: 800,
    unitsReceived: 0,
    orderedYielded: 0,
    // Ordered, yielded, but still in transit at month end.
    pipeline: 0,
    totalDue: 0,
    available: 0,
    unitsSold: 0,
    unsoldUnits: 0,
    buybackShare: 0.6,
    buybackAllowance: 0,
    buybackUnits: 0,
    pipelineExposure: 0,
    supplierExposure: 0,
    buybackBurden: 0,
    burdenPenalty: 0,
    revenue: 0,
    costOfGoods: 0,
    inventoryValue: 0,
    leadTime: 14,
    onTimeFraction: 1,
    yieldRate: 0.96,
    // Last month's sell-through — what the supplier actually observes about
    // you. Opens optimistic, which is why trust has somewhere to fall.
    sellThrough: 0.95,

    // ── Constants the derivations need as state ─────────────────────────
    capacity: 1_200,
    standardLeadTime: 14,
    one: 1,
    /** How harshly returned stock reads as a signal. See the derivation. */
    burdenSensitivity: 1.8,
    /** A shipment in transit weighs less than stock sent back. */
    pipelineWeight: 0.35,
    operatingCost: 250_000,
  },

  /** Never shown while the run is live. Released by the debrief. */
  hiddenKeys: ["marketRegime", "supplierTrust"],

  regimes: [
    {
      id: "steady",
      label: "Steady",
      demandMultiplier: 1.0,
      elasticity: 1.3,
      noiseSigma: 0.12,
    },
    {
      id: "surge",
      label: "Surge",
      demandMultiplier: 1.35,
      // Buyers care less about price when everyone is buying.
      elasticity: 0.95,
      noiseSigma: 0.18,
    },
    {
      id: "slump",
      label: "Slump",
      demandMultiplier: 0.68,
      // …and a great deal more when they are not.
      elasticity: 1.85,
      noiseSigma: 0.24,
    },
  ],

  // Steady is sticky; surge and slump both decay back toward it. Nobody is told
  // which row they are on.
  transitionMatrix: [
    [0.72, 0.16, 0.12],
    [0.34, 0.56, 0.10],
    [0.30, 0.08, 0.62],
  ],

  /**
   * Correlation between the three shocks, in mechanism order: demand, lead
   * time, yield.
   *
   * Demand and lead time move together because a busy market is a busy factory;
   * yield moves against lead time because a plant running hot makes more
   * mistakes. This is what makes bad months arrive as bad months rather than as
   * three independent inconveniences — and it is the only reason the tail of the
   * NPV distribution is as fat as it is.
   */
  shockCovariance: [
    [1.0, 0.5, -0.3],
    [0.5, 1.0, -0.4],
    [-0.3, -0.4, 1.0],
  ],

  mechanisms: [
    {
      kind: "elasticity",
      writes: "demand",
      reads: "retailPrice",
      base: 800,
      referenceLevel: REFERENCE_PRICE,
      // Raising price lowers demand.
      exponentSign: -1,
      shockName: "demandShock",
    },
    {
      kind: "queue",
      writes: "leadTime",
      reads: "factoryUtilization",
      // Wait at zero load. Chosen so the PLANNED load (800 of 1,200 capacity,
      // ρ = 0.67) lands at the 14-day standard: 4.7 × (1 + 0.67/0.33) ≈ 14.
      // Setting this to 14 — the standard itself — tripled the planned wait and
      // meant only a third of every order arrived on time.
      baseTime: 4.7,
      maxTime: 75,
      shockScale: 0.12,
      shockName: "leadTimeShock",
    },
    {
      kind: "betaYield",
      writes: "yieldRate",
      alpha: 46,
      beta: 2,
      shockName: "yieldShock",
    },
    {
      // Reads LAST month's sell-through, because the supplier learns from a
      // finished month. That one-period lag is why over-ordering feels free at
      // the time and expensive afterwards.
      kind: "bayesBelief",
      writes: "supplierTrust",
      reads: "sellThrough",
      priorStrength: 6,
      decay: 0.08,
    },
  ],

  /**
   * Ordinary arithmetic, in order. Each line reads what the lines above it
   * wrote, so `available` sees last month's inventory and `inventory` is
   * overwritten only afterwards.
   */
  derivations: [
    { kind: "ratio", writes: "onTimeRaw", numerator: "standardLeadTime", denominator: "leadTime" },
    // A late shipment cannot be more than fully on time.
    { kind: "min", writes: "onTimeFraction", of: ["onTimeRaw", "one"] },
    // Units that pass QC, plus whatever a late shipment left in transit last
    // month. Late stock is DELAYED, not destroyed — the first smoke run simply
    // lost it, which made a long lead time far more punishing than it is.
    { kind: "product", writes: "orderedYielded", of: ["orderQuantity", "yieldRate"] },
    { kind: "sum", writes: "totalDue", of: ["orderedYielded", "pipeline"] },
    { kind: "product", writes: "unitsReceived", of: ["totalDue", "onTimeFraction"] },
    { kind: "difference", writes: "pipeline", minuend: "totalDue", subtrahend: "unitsReceived", floor: 0 },
    { kind: "sum", writes: "available", of: ["inventory", "unitsReceived"] },
    // You cannot sell what you do not have.
    { kind: "min", writes: "unitsSold", of: ["demand", "available"] },
    { kind: "difference", writes: "unsoldUnits", minuend: "available", subtrahend: "unitsSold", floor: 0 },
    { kind: "difference", writes: "backlog", minuend: "demand", subtrahend: "unitsSold", floor: 0 },
    // The clause covers a SHARE of what you ordered, not everything left over.
    { kind: "product", writes: "buybackAllowance", of: ["orderQuantity", "buybackShare"] },
    { kind: "min", writes: "buybackUnits", of: ["unsoldUnits", "buybackAllowance"] },
    // What the clause did not cover is yours to carry into next month.
    { kind: "difference", writes: "inventory", minuend: "unsoldUnits", subtrahend: "buybackUnits", floor: 0 },
    { kind: "product", writes: "inventoryValue", of: ["inventory", "wholesalePrice"] },
    { kind: "product", writes: "revenue", of: ["unitsSold", "retailPrice"] },
    { kind: "product", writes: "costOfGoods", of: ["orderQuantity", "wholesalePrice"] },
    { kind: "ratio", writes: "factoryUtilization", numerator: "orderQuantity", denominator: "capacity" },
    // The signal the supplier reads about you next month.
    //
    // NOT units sold ÷ units received: that reads 1.0 whenever supply was short,
    // so a buyer who ordered far too much and was rescued by a late shipment
    // scored as a model customer. What the supplier actually experiences is how
    // much of your order came back to them, so that is what it learns from.
    // Stock returned PLUS stock still stuck in transit. Both are the supplier's
    // exposure to your ordering, and counting only returns made the signal
    // non-monotonic: past about 93% of capacity the queue starves delivery so
    // hard that nothing arrives to be sent back, and trust recovered on the
    // most reckless order of all.
    // Weighted, not summed raw. Stock returned under the clause is a permanent
    // loss to the supplier; stock still in transit is a temporary annoyance, and
    // counting them equally made a 900-unit order — a 12% overshoot — collapse
    // trust to 0.18 inside a year.
    { kind: "product", writes: "pipelineExposure", of: ["pipeline", "pipelineWeight"] },
    { kind: "sum", writes: "supplierExposure", of: ["buybackUnits", "pipelineExposure"] },
    { kind: "ratio", writes: "buybackBurden", numerator: "supplierExposure", denominator: "orderQuantity" },
    // Scaled before it is subtracted, because the NEUTRAL point matters more
    // than the slope. Raw `1 − burden` scores a month with a little unsold
    // stock at 0.95 — better than the 0.75 the supplier already believes — so
    // trust drifted UP in every run, including one ordering 35% above demand.
    // At a sensitivity of 3, a disciplined month still scores above the prior
    // and a habitually over-ordered one scores well below it.
    { kind: "product", writes: "burdenPenalty", of: ["buybackBurden", "burdenSensitivity"] },
    { kind: "difference", writes: "sellThrough", minuend: "one", subtrahend: "burdenPenalty", floor: 0 },
  ],

  settlement: {
    revenue: { quantityKey: "unitsSold", priceKey: "retailPrice" },
    costOfGoods: { quantityKey: "orderQuantity", priceKey: "wholesalePrice" },
    // The clause: what makes this a buyback rather than a purchase order.
    contract: { quantityKey: "buybackUnits", priceKey: "buybackPrice" },
    operatingCostKey: "operatingCost",
  },

  /**
   * The supplier.
   *
   * Three stances, and no rule choosing between them. `exposure` is what the
   * action leaves the supplier carrying if you dump stock on them, so it is
   * cheap to offer when they trust you and dear when they do not — see
   * `expectedUtility`. At a trust of 0.9 the generous stance wins; around 0.75
   * the standard one does; below roughly 0.4 the defensive one does. Those
   * numbers are consequences of the weights below, not thresholds written
   * anywhere.
   */
  agent: {
    id: "supplier",
    label: "Your supplier",
    actions: [
      {
        id: "generous",
        label: "Wide cover",
        offers: {
          wholesalePrice: WHOLESALE_BASE * 0.96,
          buybackPrice: BUYBACK_BASE * 1.18,
          buybackShare: 0.8,
        },
        terms: { margin: 0.55, volume: 1.4, exposure: 1.0 },
      },
      {
        id: "standard",
        label: "Standard terms",
        offers: {
          wholesalePrice: WHOLESALE_BASE,
          buybackPrice: BUYBACK_BASE,
          buybackShare: 0.6,
        },
        terms: { margin: 1.0, volume: 0.9, exposure: 0.5 },
      },
      {
        id: "defensive",
        label: "Tightened terms",
        offers: {
          wholesalePrice: WHOLESALE_BASE * 1.12,
          buybackPrice: BUYBACK_BASE * 0.68,
          buybackShare: 0.35,
        },
        terms: { margin: 1.3, volume: 0.35, exposure: 0.15 },
      },
    ],
    utilityWeights: { margin: 1.0, volume: 1.5, exposure: 2.0 },
    temperature: 0.25,
    beliefKey: "supplierTrust",
    beliefWeight: 2.0,
    exposureTerm: "exposure",
  },

  decisions: [
    {
      key: "orderQuantity",
      label: "Order quantity",
      help: "Units to buy this month. Above about 960 you are past 80% of the supplier's capacity and the lead time starts to climb steeply.",
      kind: "integer",
      min: 0,
      max: 1_600,
      step: 20,
      default: 800,
    },
    {
      key: "retailPrice",
      label: "Retail price",
      help: "What you charge. Demand responds with an elasticity that depends on a market you cannot see.",
      kind: "currency",
      min: 800,
      max: 1_900,
      step: 25,
      default: REFERENCE_PRICE,
    },
  ],

  financials: {
    receivableDays: 30,
    payableDays: 45,
    wacc: 0.12,
    daysPerPeriod: 30,
  },

  /**
   * Six narrative wrappers, every one of them keyed to a TAIL DRAW.
   *
   * None mentions a month, and none can: the engine fires them by comparing a
   * draw's percentile against these thresholds, so a port strike happens
   * whenever the lead-time shock happens to land in its tail — in month two of
   * one run, month nine of another, and never in a third.
   */
  scenarios: [
    {
      id: "port-strike",
      headline: "Port strike",
      body: "Dock workers walked out on Tuesday. Containers are sitting offshore and your supplier cannot say when the next sailing clears.",
      trigger: { drawName: "leadTimeShock", atOrAbove: 0.95 },
    },
    {
      id: "line-runs-clean",
      headline: "The line ran clean",
      body: "A maintenance window landed at the right moment. Reject rates were the lowest in a year and the shipment arrived early.",
      trigger: { drawName: "leadTimeShock", atOrBelow: 0.05 },
    },
    {
      id: "viral-moment",
      headline: "A reviewer picked it up",
      body: "A video went around over the weekend and the category moved with it. Nobody planned for this and nobody can tell you how long it lasts.",
      trigger: { drawName: "demandShock", atOrAbove: 0.93 },
    },
    {
      id: "demand-vanishes",
      headline: "The month went quiet",
      body: "Footfall fell away without an obvious reason. The category is soft everywhere, not just for you.",
      trigger: { drawName: "demandShock", atOrBelow: 0.07 },
    },
    {
      id: "batch-failure",
      headline: "A batch failed QC",
      body: "Most of one production run failed inspection at the gate. What shipped is short of what you ordered, and you are paying for what you ordered.",
      trigger: { drawName: "yieldShock", atOrBelow: 0.04 },
    },
    {
      id: "clean-run",
      headline: "Near-perfect yield",
      body: "Almost every unit passed. You have slightly more sellable stock than the order should have produced.",
      trigger: { drawName: "yieldShock", atOrAbove: 0.96 },
    },
  ],

  /**
   * Two forks. Both change the world going FORWARD by replacing the regime
   * transition matrix — they do not fire an event, they change the weather.
   */
  branchPoints: [
    {
      atTick: 4,
      prompt: "Your supplier offers a second source in exchange for a volume commitment.",
      options: [
        {
          id: "single-source",
          label: "Stay single-source",
          detail: "Keep the flexibility. The market stays as unpredictable as it has been.",
          transitionMatrix: [
            [0.72, 0.16, 0.12],
            [0.34, 0.56, 0.1],
            [0.3, 0.08, 0.62],
          ],
        },
        {
          id: "dual-source",
          label: "Commit to dual sourcing",
          detail: "Steadier supply, and a market that spends longer in its calmer state — but you have promised volume you may not need.",
          transitionMatrix: [
            [0.84, 0.09, 0.07],
            [0.45, 0.48, 0.07],
            [0.42, 0.06, 0.52],
          ],
        },
      ],
    },
    {
      atTick: 8,
      prompt: "The category is consolidating. A discount chain will take volume at a fixed low price.",
      options: [
        {
          id: "hold-channel",
          label: "Hold your own channel",
          detail: "Keep the margin and the exposure to swings.",
          transitionMatrix: [
            [0.7, 0.18, 0.12],
            [0.32, 0.58, 0.1],
            [0.28, 0.08, 0.64],
          ],
        },
        {
          id: "take-volume",
          label: "Take the volume deal",
          detail: "Demand steadies and surges become rarer. You have traded the upside for the floor.",
          transitionMatrix: [
            [0.88, 0.04, 0.08],
            [0.5, 0.42, 0.08],
            [0.5, 0.04, 0.46],
          ],
        },
      ],
    },
  ],

  /**
   * NPV carries the weight because it is the only measure that prices a
   * decision's effect on the months after it. The rest are the diagnostics that
   * explain it.
   */
  rubric: [
    {
      key: "npv",
      label: "12-month NPV",
      hint: "Discounted cash across the year, against what the same policy usually produces.",
      weight: 2.0,
    },
    {
      key: "grossMargin",
      label: "Gross margin",
      hint: "What you kept of what you sold.",
      weight: 1.0,
    },
    {
      key: "serviceLevel",
      label: "Service level",
      hint: "The share of demand you could actually fill.",
      weight: 1.0,
    },
  ],

  /**
   * The KPI arithmetic is generic; only these key names are ours. The engine
   * used to hold them, which is the coupling `tests/buyback-behaviours.test.ts`
   * exists to refuse.
   */
  kpis: [
    { key: "npv", label: "Rolling NPV", unit: "inr", goodDirection: "up", formula: { kind: "npv" } },
    {
      key: "grossMargin",
      label: "Gross margin",
      unit: "ratio",
      goodDirection: "up",
      formula: { kind: "marginOfSums", totalKey: "revenue", costKey: "costOfGoods" },
    },
    {
      key: "cashConversionCycle",
      label: "Cash conversion cycle",
      unit: "days",
      goodDirection: "down",
      formula: {
        kind: "cashCycle",
        stockValueKey: "inventoryValue",
        periodCostKey: "costOfGoods",
        periodRevenueKey: "revenue",
      },
    },
    {
      key: "serviceLevel",
      label: "Service level",
      unit: "ratio",
      goodDirection: "up",
      formula: { kind: "ratioOfSums", numeratorKey: "unitsSold", denominatorKey: "demand" },
    },
    {
      key: "inventoryTurns",
      label: "Inventory turns",
      unit: "multiple",
      goodDirection: "up",
      formula: { kind: "turnover", flowKey: "costOfGoods", stockKey: "inventory" },
    },
  ],
  primaryKpi: "npv",
  monteCarloPaths: 500,
};
