/**
 * "Consumers bought the same juice every week. The plant's schedule moved 38%."
 *
 * The supply-chain war room, and the one distribution case every operations
 * curriculum owns: the bullwhip effect. A small wobble in consumer offtake
 * arrives at the factory as a huge one, and every cost in the chain —
 * overtime, idle time, expedited freight, working capital, near-expiry stock,
 * and the stockouts that sit alongside all that inventory — is a consequence of
 * the amplification rather than of the demand.
 *
 * The lesson: **a supply chain is a signal-processing system, and most of the
 * variability in it was manufactured by the people reacting to it.**
 *
 * ── The truth, for whoever maintains this ─────────────────────────────────
 *
 * Consumer offtake moves ±6% month to month. The plant's schedule moves ±38%:
 * an amplification of 6.3×. Three things make it, and all three are the
 * company's own doing.
 *
 *   1. Month-end targets. 61% of primary sales land in the last six days,
 *      because that is when the sales team is measured.
 *   2. Quarterly loading schemes. A trade discount every quarter makes a
 *      distributor buy six weeks of stock in one week, and then buy nothing.
 *   3. Planning from primary sales. The plant forecasts from its own dispatches
 *      rather than from distributor secondary sales, so it plans against the
 *      signal it just distorted — and adds a safety margin on top of it.
 *
 * The room reads all of this as volatile demand and wants more warehouse space
 * and more safety stock, which is the classic response: buffer the amplitude
 * rather than stop making it.
 *
 * ── Balance notes ─────────────────────────────────────────────────────────
 *
 * `iv-safety-stock` is the honest trap and lands almost exactly at a wash —
 * about ₹1.7 crore of recovered sales against ₹1.6 crore of carrying cost and
 * near-expiry stock. It has to stay roughly neutral: a decoy that plainly loses
 * teaches nothing, and one that wins teaches "hold more stock", which is the
 * reflex this scenario exists to break.
 *
 * `iv-forecast-engine` is the other good-looking loser: a better model fitted to
 * primary sales is a better model of the company's own targets. It moves the
 * swing 6% and costs its licence.
 *
 * `retailSwing` is a `constant` on purpose. Consumer variability is the one
 * number in this model nobody in the room can move, and the validator will
 * reject an intervention aimed at it. `amplificationRatio` is derived from it,
 * so the headline "6.3×" can never drift away from the two swings it compares.
 *
 * `tests/sim-scenario.test.ts` pins the amplification arithmetic and the
 * safety-stock trap; `checkBalance` is what will tell you if a retune lets a
 * decoy win.
 */

import type { SimScenario } from "../types";

const CRORE = 10_000_000;

export const bullwhipDemandSignal: SimScenario = {
  slug: "bullwhip-demand-signal",
  title: "Zaika Beverages: shoppers bought the same juice all year and the plant did not",
  company: "Zaika Beverages",
  premise:
    "Consumer offtake moves 6% a month and the factory schedule moves 38%. Work out who is making the other 32 points before you buy a warehouse to store them in.",
  situation:
    "You are the supply-chain lead at Zaika Beverages, a Kanpur juice and soft-drink maker selling 98 lakh cases a year through 220 distributors across five states. " +
    "Production swings 38% month to month. Last year that cost ₹6.08 crore of overtime and idle time, ₹1.90 crore of expedited freight, ₹5.17 crore of working capital on 47 days of stock, and ₹2.34 crore of near-expiry returns — while 8.4% of demand still went unserved at the shelf. " +
    "The national sales head says demand is simply volatile. The supply-chain director wants three more depots. The commercial head wants safety stock raised across the network. " +
    "You have 6 analyst-days to work out where the swing is made, then 4 people-weeks and ₹4.5 crore to act on it.",
  difficulty: "Medium",

  mentor: {
    persona: "a supply-chain director debriefing a graduate planner",
    audience: "planner",
  },

  teaching: {
    /**
     * Shown. The model's shape is the *cost* of amplification — swing turns
     * into overtime, freight, working capital and waste — which is the teaching.
     * Where the amplification comes from is not in the graph, and that is the
     * part the candidate has to go and find.
     */
    showMetricMap: true,
    primer: {
      intro:
        "A supply chain carries two things: product one way, and information the other. Almost every expensive problem in distribution is a problem with the second one — and the distortion is usually put there by the company's own targets, schemes and planning rules rather than by anything a shopper did.",
      terms: [
        {
          term: "The bullwhip effect",
          full: "Demand amplification",
          plain: "The further you stand from the shopper, the wilder the demand looks. A small wobble at the shelf becomes a big one at the distributor and a huge one at the factory.",
          formula: "amplification = variability at the plant ÷ variability at the shelf",
          matters:
            "It means the volatility a factory plans against is mostly manufactured, not observed. Every rupee of buffering spent on it is spent on a problem somebody upstream created.",
          driver: "amplificationRatio",
        },
        {
          term: "Primary sales",
          plain: "What the company dispatches to its distributors — the number the sales team is measured on.",
          matters:
            "It is a measure of ordering behaviour, not of consumption. Planning from it is planning against your own incentive scheme.",
        },
        {
          term: "Secondary sales",
          plain: "What the distributor sells on to retailers — one step closer to a person actually drinking something.",
          matters:
            "It is far smoother than primary, and most companies have it sitting unused in their distributor management system. Using it is the single cheapest thing a chain can do.",
        },
        {
          term: "Order batching",
          plain: "Ordering in big lumps rather than little and often — because a full truck is cheaper, or because the system only runs a replenishment once a month.",
          matters:
            "It converts a steady trickle of demand into a spiky order pattern before the signal has even left the distributor's office.",
        },
        {
          term: "Forward buying",
          full: "Trade loading",
          plain: "Buying six weeks of stock during a discount week because it is cheaper, then buying nothing for six weeks.",
          matters:
            "A promotion that shifts *when* the trade buys without changing what anybody drinks moves volume between months and pays for the privilege.",
        },
        {
          term: "Days of inventory",
          plain: "How many days of sales the stock in the chain would cover — here, across the factory, the depots and the distributors.",
          formula: "stock ÷ average daily sales",
          matters:
            "It is the money the chain is holding still. At ₹11 lakh a day of cover, taking 20 days out of this chain is ₹2.2 crore a year that stops being tied up.",
          driver: "inventoryDays",
        },
        {
          term: "Obsolescence",
          plain: "Stock that goes near-expiry or gets damaged before anybody drinks it, and comes back as a credit note.",
          matters:
            "It is what a loading scheme actually buys: stock pushed into the trade in one week and ageing in a distributor's godown for the next six.",
          driver: "obsolescenceCost",
        },
        {
          term: "Stockout",
          plain: "Demand at the shelf that could not be served because the stock was somewhere else.",
          formula: "lost cases ÷ cases demanded",
          matters:
            "The reason this is not simply a cost problem. A chain that swings holds too much and too little at the same time — 47 days of stock and 8.4% of demand unserved is exactly what amplification looks like from the shop floor.",
          driver: "stockoutRate",
        },
        {
          term: "Level scheduling",
          plain: "Running the plant to a smoothed plan and replenishing what was actually sold, instead of chasing the order book.",
          matters:
            "It is the operational form of the answer. The costs of swing — overtime, idle time, changeovers, expedited freight — are paid per point of swing, so removing points of swing is what pays.",
          driver: "plantSwing",
        },
      ],
      worked: [
        "Consumer offtake moves ±6% month to month. The plant's schedule moves ±38%. That is an amplification of 6.3×.",
        "Each point of that swing costs about ₹16 lakh of overtime, idle time and unplanned changeovers, and about ₹5 lakh of expedited freight.",
        "So the swing alone is ₹7.98 crore a year, against a net contribution of ₹9.41 crore.",
        "And it does not buy availability: 8.4% of demand still went unserved while the chain held 47 days of stock.",
        "The question is which of those 38 points a shopper is responsible for.",
      ],
    },
  },

  northStar: "netContribution",
  reported: [
    "casesSold",
    "stockoutRate",
    "plantSwing",
    "amplificationRatio",
    "inventoryDays",
    "netContribution",
  ],

  drivers: [
    // ── Demand, and the share of it the chain fails to serve. ──────────────
    { id: "annualDemand", kind: "input", label: "Consumer demand, cases a year", unit: "count", goodDirection: "up", baseline: 9_840_000 },
    { id: "stockoutRate", kind: "input", label: "Demand unserved at the shelf", unit: "ratio", goodDirection: "down", baseline: 0.084 },
    { id: "lostCases", kind: "product", label: "Cases lost to stockouts", unit: "count", goodDirection: "down", of: ["annualDemand", "stockoutRate"] },
    { id: "casesSold", kind: "difference", label: "Cases sold", unit: "count", goodDirection: "up", minuend: "annualDemand", subtrahend: "lostCases" },
    { id: "contributionPerCase", kind: "input", label: "Contribution per case", unit: "inr", goodDirection: "up", baseline: 72 },
    { id: "grossContribution", kind: "product", label: "Contribution earned", unit: "inr", goodDirection: "up", of: ["casesSold", "contributionPerCase"] },

    // ── The swing, and what a point of it costs. ───────────────────────────
    { id: "plantSwing", kind: "input", label: "Month-to-month swing in the plant's schedule", unit: "ratio", goodDirection: "down", baseline: 0.38 },
    /**
     * The one number in this scenario nobody in the room can move, which is
     * exactly what `constant` is for: `validateScenario` refuses an intervention
     * aimed at it, so "reduce consumer variability by 15%" can never be
     * authored by accident.
     */
    { id: "retailSwing", kind: "constant", label: "Month-to-month swing in consumer offtake", unit: "ratio", goodDirection: "down", value: 0.06 },
    { id: "amplificationRatio", kind: "quotient", label: "Demand amplification", unit: "multiple", goodDirection: "down", numerator: "plantSwing", denominator: "retailSwing" },

    { id: "swingCostRate", kind: "input", label: "Overtime, idle time and changeovers per unit of swing", unit: "inr", goodDirection: "down", baseline: 16 * CRORE },
    { id: "overtimeIdleCost", kind: "product", label: "Overtime and idle time", unit: "inr", goodDirection: "down", of: ["plantSwing", "swingCostRate"] },
    { id: "expediteRate", kind: "input", label: "Expedited freight per unit of swing", unit: "inr", goodDirection: "down", baseline: 5 * CRORE },
    { id: "expediteFreightCost", kind: "product", label: "Expedited freight", unit: "inr", goodDirection: "down", of: ["plantSwing", "expediteRate"] },

    // ── The stock the swing forces the chain to carry. ─────────────────────
    { id: "inventoryDays", kind: "input", label: "Days of stock in the chain", unit: "days", goodDirection: "down", baseline: 47 },
    { id: "carryCostPerDay", kind: "input", label: "Cost of carrying one day of cover", unit: "inr", goodDirection: "down", baseline: 0.11 * CRORE },
    { id: "workingCapitalCost", kind: "product", label: "Working capital carried", unit: "inr", goodDirection: "down", of: ["inventoryDays", "carryCostPerDay"] },
    { id: "obsolescenceCostPerCase", kind: "input", label: "Near-expiry returns and damages per case sold", unit: "inr", goodDirection: "down", baseline: 2.6 },
    { id: "obsolescenceCost", kind: "product", label: "Near-expiry returns and damages", unit: "inr", goodDirection: "down", of: ["casesSold", "obsolescenceCostPerCase"] },

    { id: "fixedCost", kind: "input", label: "Plant and network fixed cost", unit: "inr", goodDirection: "down", baseline: 40 * CRORE },
    { id: "totalCost", kind: "sum", label: "Cost of running the chain", unit: "inr", goodDirection: "down", of: ["overtimeIdleCost", "expediteFreightCost", "workingCapitalCost", "obsolescenceCost", "fixedCost"] },
    { id: "netContribution", kind: "difference", label: "Net contribution", unit: "inr", goodDirection: "up", minuend: "grossContribution", subtrahend: "totalCost" },
  ],

  dashboard: [
    {
      id: "p-bw-scorecard",
      kind: "stat",
      title: "The supply-chain review",
      caption: "FY26, across the plant, six depots and 220 distributors.",
      tiles: [
        { label: "Month-to-month swing in production", value: 0.38, unit: "ratio", deltaPct: 0.12, goodDirection: "down" },
        { label: "Demand unserved at the shelf", value: 0.084, unit: "ratio", deltaPct: 0.09, goodDirection: "down" },
        { label: "Days of stock in the chain", value: 47, unit: "days", deltaPct: 0.15, goodDirection: "down" },
        { label: "Cases sold", value: 9_013_440, unit: "count", deltaPct: 0.021, goodDirection: "up" },
        { label: "Forecast error, month ahead", value: 0.31, unit: "ratio", goodDirection: "down" },
        { label: "Distributors", value: 220, unit: "count", goodDirection: "up" },
      ],
    },
    {
      /**
       * Two of the three signals, and deliberately not the third. Production
       * and dispatch both swing, which is exactly what the room reads as
       * volatile demand — the consumer line that would settle the argument is
       * what `dd-three-signals` sells them.
       */
      id: "p-bw-swing",
      kind: "timeseries",
      title: "Production and dispatches, by month",
      caption: "Indexed to the monthly average. Both move together; nobody has asked what the shopper did.",
      series: [
        {
          label: "Cases produced",
          unit: "multiple",
          points: [
            { period: "Apr", value: 0.74 },
            { period: "May", value: 1.31 },
            { period: "Jun", value: 1.38 },
            { period: "Jul", value: 0.69 },
            { period: "Aug", value: 0.81 },
            { period: "Sep", value: 1.34 },
            { period: "Oct", value: 1.22 },
            { period: "Nov", value: 0.66 },
          ],
        },
        {
          label: "Cases dispatched to distributors",
          unit: "multiple",
          points: [
            { period: "Apr", value: 0.79 },
            { period: "May", value: 1.24 },
            { period: "Jun", value: 1.41 },
            { period: "Jul", value: 0.72 },
            { period: "Aug", value: 0.86 },
            { period: "Sep", value: 1.29 },
            { period: "Oct", value: 1.18 },
            { period: "Nov", value: 0.71 },
          ],
        },
      ],
    },
    {
      id: "p-bw-costs",
      kind: "stat",
      title: "What last year cost",
      caption: "The four lines the swing pays for.",
      tiles: [
        { label: "Overtime and idle time", value: 6.08 * CRORE, unit: "inr", deltaPct: 0.19, goodDirection: "down" },
        { label: "Working capital carried", value: 5.17 * CRORE, unit: "inr", deltaPct: 0.16, goodDirection: "down" },
        { label: "Near-expiry returns and damages", value: 2.34 * CRORE, unit: "inr", deltaPct: 0.28, goodDirection: "down" },
        { label: "Expedited freight", value: 1.9 * CRORE, unit: "inr", deltaPct: 0.24, goodDirection: "down" },
      ],
    },
    {
      id: "p-bw-inventory",
      kind: "segments",
      title: "Where the 47 days sit",
      caption: "Days of cover, by point in the chain.",
      dimension: "Held at",
      rows: [
        { label: "Plant finished goods", value: 9, unit: "days" },
        { label: "Company depots", value: 13, unit: "days" },
        { label: "Distributor godowns", value: 25, unit: "days" },
      ],
    },
    {
      id: "p-bw-service",
      kind: "timeseries",
      title: "Stockouts and returns",
      caption: "By quarter. The chain manages to be short and long at the same time.",
      series: [
        {
          label: "Demand unserved at the shelf",
          unit: "ratio",
          points: [
            { period: "Q1", value: 0.071 },
            { period: "Q2", value: 0.089 },
            { period: "Q3", value: 0.082 },
            { period: "Q4", value: 0.094 },
          ],
        },
        {
          label: "Near-expiry returns, share of dispatch",
          unit: "ratio",
          points: [
            { period: "Q1", value: 0.019 },
            { period: "Q2", value: 0.024 },
            { period: "Q3", value: 0.021 },
            { period: "Q4", value: 0.029 },
          ],
        },
      ],
    },
    {
      id: "p-bw-regions",
      kind: "segments",
      title: "Service level by state",
      caption: "Share of orders served in full, FY26.",
      dimension: "State",
      rows: [
        { label: "Uttar Pradesh — 41% of volume", value: 0.918, unit: "ratio", deltaPct: -0.02 },
        { label: "Bihar — 19%", value: 0.902, unit: "ratio", deltaPct: -0.03 },
        { label: "Madhya Pradesh — 17%", value: 0.925, unit: "ratio", deltaPct: -0.01 },
        { label: "Rajasthan — 13%", value: 0.911, unit: "ratio", deltaPct: -0.03 },
        { label: "Uttarakhand — 10%", value: 0.929, unit: "ratio", deltaPct: 0.0 },
      ],
    },
    {
      id: "p-bw-room",
      kind: "note",
      title: "What the room is saying",
      body:
        "National sales head: this is a seasonal business in a country with a monsoon. Demand is volatile, we chase it, and that is the job.\n" +
        "Supply-chain director: we are out of space. Three more depots at ₹2.6 crore a year and we can hold the peak stock closer to the market.\n" +
        "Commercial head: 8.4% of demand unserved with 47 days of stock means the stock is in the wrong places. Raise safety stock across the network until the service level moves.\n" +
        "Nobody has put the plant's schedule, the dispatches and the shopper's offtake on the same chart.",
    },
  ],

  budget: { analystDays: 6, sprints: 4, rupees: 4.5 * CRORE },

  drilldowns: [
    {
      id: "dd-three-signals",
      label: "Put offtake, dispatches and production on one chart",
      question: "How much of the plant's swing is actually the shopper's?",
      cost: 2,
      evidenceFor: ["signal.primary", "market.volatility"],
      readsAs:
        "Consumer offtake moves ±6% a month. Distributor orders move ±22%. The plant's schedule moves ±38%. The signal is amplified 6.3× on its way up a chain three steps long, and the shopper is responsible for six points of thirty-eight.",
      reveals: [
        {
          id: "p-bw-three-signals",
          kind: "timeseries",
          title: "The same eight months, at three points in the chain",
          caption: "Indexed to each series' own average, so only the shape is being compared.",
          series: [
            {
              label: "Consumer offtake at the shelf",
              unit: "multiple",
              points: [
                { period: "Apr", value: 0.95 },
                { period: "May", value: 1.04 },
                { period: "Jun", value: 1.06 },
                { period: "Jul", value: 0.97 },
                { period: "Aug", value: 0.96 },
                { period: "Sep", value: 1.03 },
                { period: "Oct", value: 1.05 },
                { period: "Nov", value: 0.94 },
              ],
            },
            {
              label: "Distributor orders",
              unit: "multiple",
              points: [
                { period: "Apr", value: 0.84 },
                { period: "May", value: 1.18 },
                { period: "Jun", value: 1.22 },
                { period: "Jul", value: 0.81 },
                { period: "Aug", value: 0.88 },
                { period: "Sep", value: 1.19 },
                { period: "Oct", value: 1.14 },
                { period: "Nov", value: 0.79 },
              ],
            },
            {
              label: "Plant schedule",
              unit: "multiple",
              points: [
                { period: "Apr", value: 0.74 },
                { period: "May", value: 1.31 },
                { period: "Jun", value: 1.38 },
                { period: "Jul", value: 0.69 },
                { period: "Aug", value: 0.81 },
                { period: "Sep", value: 1.34 },
                { period: "Oct", value: 1.22 },
                { period: "Nov", value: 0.66 },
              ],
            },
          ],
        },
        {
          id: "p-bw-signals-note",
          kind: "note",
          title: "What the three lines are measuring",
          body:
            "Offtake is what shoppers bought, read from 3,400 retailer scans and the distributor management system's secondary sales. Its month-to-month variation is 6%, and the seasonal shape — a summer peak and a Diwali one — is smooth and entirely predictable.\n\n" +
            "Distributor orders are the same demand after the trade has decided when to buy it: 22%.\n\n" +
            "The plant schedule is that order pattern after planning has added its own margin for the month-end rush: 38%. Each step adds distortion, and every step is inside this company.",
        },
      ],
    },
    {
      id: "dd-order-timing",
      label: "When in the month the orders arrive",
      question: "Is the ordering pattern about demand at all?",
      cost: 2,
      evidenceFor: ["signal.primary"],
      readsAs:
        "61% of the month's primary sales land in the last six days, and 3% in the first week. Shelf offtake is flat across the month. The spike is the sales incentive, and the plant plans against it as though it were demand.",
      reveals: [
        {
          id: "p-bw-order-timing",
          kind: "segments",
          title: "Where the month's volume lands",
          caption: "Share of primary sales, against share of consumer offtake, averaged over 12 months.",
          dimension: "Week of the month",
          rows: [
            { label: "Week 1 — primary sales", value: 0.03, unit: "ratio" },
            { label: "Week 2 — primary sales", value: 0.12, unit: "ratio" },
            { label: "Week 3 — primary sales", value: 0.24, unit: "ratio" },
            { label: "Week 4 and month-end — primary sales", value: 0.61, unit: "ratio" },
            { label: "Every week — consumer offtake", value: 0.25, unit: "ratio" },
          ],
        },
        {
          id: "p-bw-timing-note",
          kind: "note",
          title: "What the last six days cost",
          body:
            "The sales organisation is measured on primary sales in a calendar month, and 84% of the incentive pays out at a monthly target. So the last week of every month is a scramble: extra shifts at the plant, 71% of the year's expedited freight, and a distributor who takes stock in the last week because he is asked to rather than because he needs it.\n\n" +
            "The first week of the following month is then dead — the plant runs at 61% of its average — and the same overtime is being paid within three weeks. Both halves are charged to the swing.",
        },
      ],
    },
    {
      id: "dd-scheme-calendar",
      label: "What the quarterly schemes do to orders",
      question: "Are the trade schemes buying volume, or moving it?",
      cost: 2,
      evidenceFor: ["signal.primary"],
      readsAs:
        "A scheme week lifts primary sales 3.1× and the next six weeks run 42% below normal, while consumer offtake does not move at all. It is buying the same volume earlier, at a discount, and ageing it in the trade — which is where two thirds of the near-expiry returns come from.",
      reveals: [
        {
          id: "p-bw-scheme",
          kind: "segments",
          title: "Around the four scheme weeks of FY26",
          caption: "Indexed to a normal week.",
          dimension: "Week relative to the scheme",
          rows: [
            { label: "Two weeks before", value: 0.82, unit: "multiple" },
            { label: "Scheme week — primary sales", value: 3.11, unit: "multiple" },
            { label: "Scheme week — consumer offtake", value: 1.04, unit: "multiple" },
            { label: "Six weeks after — primary sales", value: 0.58, unit: "multiple" },
            { label: "Six weeks after — consumer offtake", value: 1.01, unit: "multiple" },
          ],
        },
        {
          id: "p-bw-scheme-note",
          kind: "note",
          title: "What the trade does with the stock",
          body:
            "Average age of stock in a distributor godown is 11 days in a normal month and 34 days in the six weeks after a scheme. 68% of last year's ₹2.34 crore of near-expiry returns came from stock bought in a scheme week.\n\n" +
            "The schemes cost 4.5 points of margin on 31% of the year's volume, and the offtake data says they did not sell one extra case to anybody who drinks juice.",
        },
      ],
    },
    {
      id: "dd-forecast-accuracy",
      label: "How the monthly plan is made",
      question: "Would a better forecasting method fix this?",
      cost: 2,
      evidenceFor: ["signal.forecast"],
      readsAs:
        "The plan is last year's primary sales for the month, plus the sales team's target, plus a planner's margin for the month-end rush. Error is 31%. Fitted to secondary sales instead, the same crude method would have come in at 9% — the method is not what is broken.",
      reveals: [
        {
          id: "p-bw-forecast",
          kind: "segments",
          title: "Forecast error, month ahead",
          caption: "Mean absolute percentage error, FY26, by what the model was fitted to.",
          dimension: "Method",
          rows: [
            { label: "Today's plan — primary sales plus target plus margin", value: 0.31, unit: "ratio" },
            { label: "Statistical model fitted to primary sales", value: 0.26, unit: "ratio" },
            { label: "Same crude method fitted to secondary sales", value: 0.09, unit: "ratio" },
            { label: "Statistical model fitted to secondary sales", value: 0.07, unit: "ratio" },
          ],
        },
      ],
    },
    {
      id: "dd-inventory-map",
      label: "Where the 47 days sit, and how old they are",
      question: "Is the stock in the wrong place, or is there simply too much of it?",
      cost: 2,
      evidenceFor: ["inventory.buffer", "inventory.placement"],
      readsAs:
        "25 of the 47 days are in distributor godowns, and 34 days of that stock is post-scheme stock nobody ordered for a customer. Depot cover is 13 days against a 9-day norm — the placement is untidy and the volume is the problem.",
      reveals: [
        {
          id: "p-bw-stock-age",
          kind: "segments",
          title: "Stock by age, across the chain",
          caption: "Share of cases held, FY26 average.",
          dimension: "Age",
          rows: [
            { label: "Under 15 days", value: 0.38, unit: "ratio" },
            { label: "15 to 45 days", value: 0.41, unit: "ratio" },
            { label: "45 to 90 days", value: 0.16, unit: "ratio" },
            { label: "Over 90 days — at risk", value: 0.05, unit: "ratio" },
          ],
        },
        {
          id: "p-bw-stock-note",
          kind: "note",
          title: "Short and long at the same time",
          body:
            "In the four weeks after a scheme the chain holds 61 days of cover and still runs 7.9% unserved, because the stock is the wrong SKUs in the wrong godowns — it is what the trade was persuaded to buy, not what the shelf is selling.\n\n" +
            "Raising safety stock everywhere would cost about ₹1.14 crore of carrying and ₹0.42 crore of extra near-expiry to recover roughly ₹1.67 crore of lost sales. Close to a wash, and it leaves the swing exactly where it is.",
        },
      ],
    },
    {
      id: "dd-depot-space",
      label: "Depot space and truck utilisation",
      question: "Are we actually out of warehouse space?",
      cost: 2,
      evidenceFor: ["capacity.storage"],
      readsAs:
        "The six depots run at 63% of pallet capacity on an average day and 104% in the four days after a scheme. It is not a space shortage; it is the same peak arriving in the same week every quarter.",
      reveals: [
        {
          id: "p-bw-depot",
          kind: "stat",
          title: "The six depots",
          tiles: [
            { label: "Average pallet utilisation", value: 0.63, unit: "ratio", goodDirection: "up" },
            { label: "Peak utilisation, post-scheme week", value: 1.04, unit: "ratio", goodDirection: "down" },
            { label: "Days above 90% utilisation", value: 26, unit: "days", goodDirection: "down" },
            { label: "Truck fill on despatch", value: 0.71, unit: "ratio", goodDirection: "up" },
          ],
        },
      ],
    },
    {
      id: "dd-plant-schedule",
      label: "The plant's month, hour by hour",
      question: "What does a swinging schedule actually cost to run?",
      cost: 2,
      evidenceFor: ["signal.primary"],
      readsAs:
        "The lines run 2.1 shifts in the last week of a month and 1.1 in the first, with 38% more changeovers than a level plan needs. Overtime, idle time and changeover losses come to ₹16 lakh for every point of swing — the plant can flex, and flexing is what costs the money.",
      reveals: [
        {
          id: "p-bw-plant",
          kind: "segments",
          title: "What a point of schedule swing costs",
          caption: "₹ lakh a year per point, from three years of plant cost data.",
          dimension: "Cost",
          rows: [
            { label: "Overtime and contract shifts", value: 7.4, unit: "inr" },
            { label: "Idle time and stand-down", value: 4.9, unit: "inr" },
            { label: "Unplanned changeovers and line cleaning", value: 3.7, unit: "inr" },
            { label: "Expedited freight", value: 5.0, unit: "inr" },
          ],
        },
        {
          id: "p-bw-plant-note",
          kind: "note",
          title: "The plant is not the constraint",
          body:
            "Annual capacity is 1.24 crore cases against 98.4 lakh of demand, and the lines change over in 40 minutes. There is no month in which the plant could not have made what was needed — there are months in which it had to make half of it in six days.\n\n" +
            "A level plan at the same annual volume would need 2.6% more finished-goods cover at the plant and would remove the overtime, the stand-downs and most of the expedited freight.",
        },
      ],
    },
  ],

  causes: [
    { id: "signal", parentId: null, label: "The demand signal we plan from", verdict: "The branch nobody looked at, because everyone assumed the signal was demand." },
    {
      id: "signal.primary",
      parentId: "signal",
      label: "We plan from our own dispatches, and our own targets and schemes decide what those look like",
      verdict:
        "This was it, in three parts, all of them ours. 61% of primary sales land in the last six days of the month because that is when the sales team is measured. A quarterly scheme lifts a week 3.11× and leaves the following six weeks 42% down, while consumer offtake does not move. And the plan is built from those dispatches plus a planner's margin for the rush — so the company forecasts the distortion it just created, and then adds to it. Offtake moves 6%; the schedule moves 38%.",
    },
    {
      id: "signal.forecast",
      parentId: "signal",
      label: "Our forecasting method is too crude",
      verdict:
        "The method is crude and it is not what is broken. The same crude method fitted to secondary sales comes in at 9% error against today's 31%; a statistical model fitted to primary sales only reaches 26%. A better model of a distorted signal is a better model of our own incentive scheme.",
    },
    { id: "inventory", parentId: null, label: "How much stock we hold, and where", verdict: "A consequence being managed as a cause." },
    {
      id: "inventory.buffer",
      parentId: "inventory",
      label: "We do not hold enough safety stock to cover the swings",
      verdict:
        "The most reasonable wrong answer on the board, and almost exactly a wash: about ₹1.67 crore of recovered sales against ₹1.14 crore of carrying cost and ₹0.42 crore of extra near-expiry. It buffers the amplitude and leaves the thing making the amplitude completely untouched, which is why the chain already holds 47 days and still misses 8.4% of demand.",
    },
    {
      id: "inventory.placement",
      parentId: "inventory",
      label: "The stock is in the wrong places",
      verdict:
        "True, and it is a symptom. In the four weeks after a scheme the chain holds 61 days of cover and still runs 7.9% unserved, because what is in the godowns is what the trade was persuaded to buy rather than what the shelf is selling. Rebalancing it every month is a job created by the schemes.",
    },
    { id: "capacity", parentId: null, label: "The plant and the network", verdict: "Sized for the demand, and being asked to absorb the swing." },
    {
      id: "capacity.storage",
      parentId: "capacity",
      label: "We are out of warehouse space",
      verdict:
        "Nor is the plant short of anything: 40-minute changeovers and 1.24 crore cases of capacity against 98.4 lakh of demand mean there is no month it could not have made what was needed — only months it had to make half of in six days. The depots run at 63% of pallet capacity on an average day and 104% for four days after a scheme. Three more depots at ₹2.6 crore a year would buy space that is empty eleven months of the year, to hold a peak the company creates on a published calendar.",
    },
    { id: "market", parentId: null, label: "The demand itself", verdict: "Smooth, seasonal and entirely predictable — which is the finding that closes the case." },
    {
      id: "market.volatility",
      parentId: "market",
      label: "Consumer demand is genuinely volatile — summer, festivals, weather",
      verdict:
        "The sales head's theory, and the offtake data ends it. Shelf offtake moves ±6% month to month with a smooth summer peak and a Diwali one, both of which are on a calendar. Six points of the thirty-eight belong to shoppers. Nor is it a competitor: share moved 0.4 points across the year, and the rivals' scheme weeks do not line up with our order spikes. Ours line up with our own month-ends.",
    },
  ],
  trueCauseIds: ["signal.primary"],

  interventions: [
    {
      id: "iv-secondary-signal",
      label: "Plan and replenish from secondary sales",
      pitch:
        "Take the plan off primary dispatches and put it on distributor secondary sales, which the DMS already collects. Replenish each distributor weekly to what he actually sold, rather than shipping what he was persuaded to order.",
      addresses: "signal.primary",
      cost: { sprints: 2, rupees: 2.4 * CRORE },
      minSprints: 2,
      effects: {
        whenRootCause: [
          { driver: "plantSwing", deltaPct: -0.45, rampQuarters: 2 },
          { driver: "inventoryDays", deltaPct: -0.28, rampQuarters: 3 },
          // Weekly replenishment against real offtake is what puts the right
          // SKU in the right godown, which is where the stockouts were.
          { driver: "stockoutRate", deltaPct: -0.45, rampQuarters: 3 },
        ],
        otherwise: [
          { driver: "plantSwing", deltaPct: -0.12, rampQuarters: 2 },
          { driver: "inventoryDays", deltaPct: -0.08, rampQuarters: 3 },
        ],
      },
      debrief:
        "The information half of the answer, and the cheapest thing in the chain: the data already exists, it is already collected daily, and nobody was planning with it. It cuts the swing, the stock and the stockouts at once because all three were consequences of planning against the wrong series.",
    },
    {
      id: "iv-smooth-trade",
      label: "Take the spikes out of the trade calendar",
      pitch:
        "Weekly linear targets instead of a monthly one, incentives paid on secondary sales, and the four quarterly loading schemes replaced with an everyday trade term worth the same margin.",
      addresses: "signal.primary",
      cost: { sprints: 2, rupees: 1.8 * CRORE },
      minSprints: 2,
      effects: {
        whenRootCause: [
          { driver: "plantSwing", deltaPct: -0.28, rampQuarters: 2 },
          { driver: "inventoryDays", deltaPct: -0.22, rampQuarters: 3 },
          // Two thirds of the near-expiry stock was bought in a scheme week.
          { driver: "obsolescenceCostPerCase", deltaPct: -0.35, rampQuarters: 3 },
        ],
        otherwise: [
          { driver: "plantSwing", deltaPct: -0.08, rampQuarters: 2 },
          // Distributors who lose a discount week and get nothing in return.
          { driver: "contributionPerCase", deltaPct: -0.02 },
        ],
      },
      debrief:
        "The incentive half. The month-end scramble and the loading schemes are 32 of the 38 points of swing, and both are policies rather than facts — the company can stop making them on the first of any month. It is also the only lever that touches the near-expiry stock, because that stock is what a loading scheme leaves behind.",
    },
    {
      id: "iv-more-depots",
      label: "Lease three more depots",
      pitch:
        "The supply-chain director's proposal. Space is tight in peak weeks and the stock is too far from the market; three more depots at ₹2.6 crore a year puts cover closer to the distributor.",
      addresses: "capacity.storage",
      cost: { sprints: 2, rupees: 2.6 * CRORE },
      effects: {
        whenRootCause: [
          { driver: "stockoutRate", deltaPct: -0.25, rampQuarters: 2 },
          { driver: "fixedCost", deltaPct: 0.06 },
        ],
        otherwise: [
          { driver: "fixedCost", deltaPct: 0.07 },
          { driver: "stockoutRate", deltaPct: -0.1, rampQuarters: 2 },
          { driver: "inventoryDays", deltaPct: 0.06, rampQuarters: 2 },
        ],
      },
      debrief:
        "Permanent cost bought to hold a temporary peak that the company puts in its own calendar four times a year. The depots run at 63% on an average day; the four days they overflow are the four days after a scheme. Space is the last thing this chain is short of.",
    },
    {
      id: "iv-safety-stock",
      label: "Raise safety stock across the network",
      pitch:
        "The commercial head's proposal. 8.4% of demand is going unserved; put more cover behind every SKU at every point until the service level moves.",
      addresses: "inventory.buffer",
      cost: { sprints: 1, rupees: 1.6 * CRORE },
      effects: {
        whenRootCause: [
          { driver: "stockoutRate", deltaPct: -0.4, rampQuarters: 2 },
          { driver: "inventoryDays", deltaPct: 0.15, rampQuarters: 2 },
        ],
        otherwise: [
          { driver: "stockoutRate", deltaPct: -0.28, rampQuarters: 2 },
          { driver: "inventoryDays", deltaPct: 0.22, rampQuarters: 2 },
          { driver: "obsolescenceCostPerCase", deltaPct: 0.18, rampQuarters: 2 },
        ],
      },
      debrief:
        "Almost exactly a wash — about ₹1.67 crore of recovered sales against ₹1.14 crore of carrying and ₹0.42 crore of extra near-expiry — and that is the interesting part. Buffering an amplified signal works, in the sense that it costs about what it earns; it just leaves the amplification in place for ever, and the amplification is what everything else on this dashboard is paying for.",
    },
    {
      id: "iv-forecast-engine",
      label: "Buy a statistical forecasting engine",
      pitch:
        "Forecast error is 31% and the plan is made in a spreadsheet. A proper demand-planning engine on three years of history would cut it.",
      addresses: "signal.forecast",
      cost: { sprints: 1, rupees: 1.2 * CRORE },
      effects: {
        whenRootCause: [{ driver: "plantSwing", deltaPct: -0.22, rampQuarters: 2 }],
        otherwise: [
          { driver: "plantSwing", deltaPct: -0.06, rampQuarters: 2 },
          { driver: "fixedCost", deltaPct: 0.012 },
        ],
      },
      debrief:
        "A better model of the wrong series. Fitted to primary sales it reaches 26% error against today's 31%, because most of what it is being asked to predict is the company's own month-end scramble. The same crude spreadsheet fitted to secondary sales reaches 9% — the input was the problem, not the mathematics.",
    },
  ],

  /**
   * Standing still gets worse: targets get more aggressive as the year slips,
   * the trade holds more scheme stock, and the buyers keep asking for their
   * annual price reduction.
   */
  drift: [
    { driver: "plantSwing", deltaPct: 0.02 },
    { driver: "stockoutRate", deltaPct: 0.015 },
    { driver: "obsolescenceCostPerCase", deltaPct: 0.012 },
    { driver: "contributionPerCase", deltaPct: -0.005 },
  ],
  horizonQuarters: 4,
  periodNoun: "quarter",

  parInvestigation: ["dd-three-signals", "dd-order-timing"],
  bestAllocation: [
    { interventionId: "iv-secondary-signal", sprints: 2, rupees: 2.4 * CRORE },
    { interventionId: "iv-smooth-trade", sprints: 2, rupees: 1.8 * CRORE },
  ],

  debrief: {
    causalChain: [
      "Consumer offtake moves ±6% month to month, with a summer peak and a Diwali peak that are both on a calendar.",
      "Distributor orders move ±22%, because the trade decides when to buy rather than when anybody drinks.",
      "The plant's schedule moves ±38%, because planning adds a margin for the month-end rush on top of that.",
      "So the signal is amplified 6.3× inside a chain three steps long, and every step of the amplification is this company's own doing.",
      "61% of primary sales land in the last six days of the month, because 84% of the sales incentive pays at a monthly target.",
      "A quarterly loading scheme lifts a week 3.11× and leaves the next six weeks 42% below normal, while offtake does not move at all — and 68% of the near-expiry returns come from that stock.",
      "The plan is then built from those dispatches, so the company forecasts its own distortion and adds a margin to it.",
      "Each point of swing costs about ₹16 lakh of overtime, idle time and changeovers plus ₹5 lakh of expedited freight — ₹7.98 crore a year against a net contribution of ₹9.41 crore.",
      "And it buys nothing: the chain holds 47 days of stock and still misses 8.4% of demand, because the stock is what the trade was loaded with rather than what the shelf sells.",
    ],
    whereTheLeverageWas:
      "Upstream of the physical chain entirely, in two policies and one data feed. Planning and replenishing from secondary sales — data the DMS already collects — and taking the spikes out of the trade calendar remove most of the amplification, and with it the overtime, the freight, the excess days and the near-expiry stock, while the stockouts fall because the right SKU finally reaches the right godown. The two proposals in the room, more depots and more safety stock, both buy capacity to absorb a swing the company creates on a published calendar.",
    strongAnswer: [
      "Before I look at stock or space, I want to know how much of this variability is real.",
      "So: offtake at the shelf, orders from distributors, and the plant's schedule, on one chart, indexed to their own averages.",
      "Offtake moves 6%. Distributor orders move 22%. The plant moves 38%. That is 6.3× amplification in three steps.",
      "Which means shoppers are responsible for six of the thirty-eight points, and we are responsible for the other thirty-two.",
      "The first source is the month-end: 61% of primary sales in the last six days, because that is when the sales team is measured. Offtake is flat across the month.",
      "The second is the loading schemes: a scheme week is 3.11× normal and the six weeks after are 42% down, with no movement at the shelf at all.",
      "The third is that we plan from primary sales, so we forecast our own scramble and add a margin for it. The same crude method on secondary sales would be 9% error instead of 31%.",
      "Each point of swing costs about ₹21 lakh once overtime, idle time, changeovers and expedited freight are added up — call it ₹8 crore a year on a ₹9.4 crore net contribution.",
      "So I would spend the budget on the signal, not on the chain. Plan and replenish weekly from secondary sales, which we already collect.",
      "And change the trade calendar: weekly linear targets, incentives on secondary sales, and the four schemes replaced by an everyday term worth the same margin.",
      "I would not buy the depots — they run at 63% on an average day and overflow for four days a quarter, and we choose those four days.",
      "And I would not raise safety stock. It is roughly a wash on the money, and it commits us to buffering an amplification we could simply stop creating.",
    ],
  },

  coachFallback: [
    {
      topic: ["bullwhip", "amplification", "6.3", "swing", "variability", "three signals"],
      answer: [
        "Offtake at the shelf moves ±6% a month, distributor orders ±22%, the plant's schedule ±38%.",
        "That is 6.3× amplification across three steps, and each step of it is inside this company.",
        "Six of the thirty-eight points belong to shoppers. The rest are policies.",
      ],
    },
    {
      topic: ["primary", "secondary", "dms", "offtake", "signal", "data"],
      answer: [
        "Primary sales are what we dispatch — a measure of ordering behaviour, shaped by our own targets.",
        "Secondary sales are what the distributor sells on, and the DMS already collects them daily.",
        "The same crude planning method fitted to secondary comes in at 9% error against today's 31%.",
      ],
    },
    {
      topic: ["month end", "target", "incentive", "last week", "61%", "hockey stick"],
      answer: [
        "61% of primary sales land in the last six days of the month; consumer offtake is flat across it.",
        "84% of the sales incentive pays out against a monthly target, so the scramble is bought and paid for.",
        "The first week of the next month then runs at 61% of average, and both halves are charged to the swing.",
      ],
    },
    {
      topic: ["scheme", "loading", "forward buy", "discount", "promotion", "trade"],
      answer: [
        "A scheme week runs 3.11× a normal week and the following six weeks run 42% below, with no movement at the shelf.",
        "Stock in a distributor godown averages 11 days normally and 34 days after a scheme.",
        "68% of the ₹2.34 crore of near-expiry returns came from stock bought in a scheme week, and the schemes cost 4.5 margin points on 31% of volume.",
      ],
    },
    {
      topic: ["safety stock", "buffer", "service level", "stockout", "commercial head"],
      answer: [
        "Raising safety stock recovers about ₹1.67 crore of lost sales and costs about ₹1.14 crore of carrying plus ₹0.42 crore of near-expiry.",
        "So it roughly pays for itself — and leaves the amplification exactly where it is, for ever.",
        "The chain already holds 47 days and misses 8.4% of demand, which is what buffering an amplified signal looks like.",
      ],
    },
    {
      topic: ["depot", "warehouse", "space", "capacity", "storage"],
      answer: [
        "The six depots run at 63% of pallet capacity on an average day.",
        "They exceed 90% on 26 days a year, and those days are the four after each scheme week.",
        "Three more depots is permanent cost bought for a peak we put in our own calendar.",
      ],
    },
    {
      topic: ["forecast", "forecasting", "error", "model", "engine", "planning tool"],
      answer: [
        "A statistical engine fitted to primary sales gets error from 31% to 26%.",
        "The same crude spreadsheet fitted to secondary sales gets it to 9%.",
        "A better model of a distorted signal is a better model of our own incentive scheme.",
      ],
    },
    {
      topic: ["cost of swing", "overtime", "idle", "expedite", "freight", "16 lakh"],
      answer: [
        "Every point of schedule swing costs about ₹16 lakh of overtime, idle time and unplanned changeovers, plus ₹5 lakh of expedited freight.",
        "At 38 points that is ₹7.98 crore a year, against a net contribution of ₹9.41 crore.",
        "The plant is not the constraint — capacity is 1.24 crore cases against 98.4 lakh of demand. It is being asked to make half a month in six days.",
      ],
    },
    {
      topic: ["seasonality", "volatile", "monsoon", "festival", "demand is volatile", "competition"],
      answer: [
        "Offtake moves ±6% month to month with a smooth summer peak and a Diwali peak, both on a calendar.",
        "Market share moved 0.4 points across the year, and the rivals' scheme weeks do not line up with our order spikes.",
        "Our spikes line up with our own month-ends.",
      ],
    },
  ],
};
