/**
 * "The costing sheet says the biggest product loses money."
 *
 * The finance track's entry point, and the one that has to come before the P&L
 * scenario rather than after it: a student who cannot separate a cost that
 * changes with volume from a cost that does not will read every statement above
 * as a list of numbers rather than as an argument.
 *
 * ── The truth, for whoever maintains this ─────────────────────────────────
 *
 * Nothing is losing money. The plant charges its ₹23.4 crore of fixed cost out
 * to the three products on **share of revenue**, so the cheap, high-volume
 * glucose biscuit — 51% of sales — absorbs ₹11.92 crore of a factory it does
 * not control and comes back at minus ₹1.48 crore. It contributes ₹10.44 crore
 * a year, and only ₹1.9 crore of what is charged to it would die with it.
 *
 * Drop it, as the board wants to, and ₹10.44 crore of contribution leaves while
 * ₹10 crore of the cost charged to it stays and is re-absorbed by the two
 * survivors — which then look loss-making in their turn. That is the absorption death spiral, and
 * it is the single most expensive mistake in management accounting.
 *
 * What is genuinely wrong is one level down. The line is capacity-constrained,
 * and the same sheet is used to plan it: hours go to whatever looks profitable
 * per rupee of sales rather than to whatever earns most per hour. Ranked
 * properly, the premium cookie earns ₹60,600 of contribution per running hour
 * against glucose's ₹33,800 — and there is an unserved order book for it.
 *
 * The lesson, in one line: **an allocated cost is not an avoidable cost, and
 * when capacity binds the ranking that matters is contribution per unit of the
 * constraint.**
 *
 * ── Balance notes ─────────────────────────────────────────────────────────
 *
 * `iv-drop-glucose` is the trap and it must stay catastrophic: it strips 92% of
 * the glucose volume and returns only ₹2.0 crore of fixed cost, which is the
 * arithmetic the board has not done. Raise the overhead it saves much past
 * `factoryOverhead −0.10` and the trap starts to look defensible, which would
 * teach exactly the wrong reflex.
 *
 * `iv-overhead-cut` is deliberately left *slightly* positive (about ₹0.26 crore
 * net). Good housekeeping usually is. It has to be real and far too small,
 * rather than wrong — a decoy that is simply a mistake teaches nothing about
 * judgement.
 *
 * The two correct levers compose additively because they move different things:
 * `iv-plan-on-contribution` moves the mix between SKUs, `iv-changeover` moves
 * the hours available to all three. `tests/sim-scenario.test.ts` pins the
 * absorption arithmetic and the drop-the-SKU trap; `checkBalance` is what will
 * tell you if a retune lets a decoy win.
 */

import type { SimScenario } from "../types";

const CRORE = 10_000_000;

export const productCostAbsorption: SimScenario = {
  slug: "product-cost-absorption",
  title: "Mithila Foods: the costing sheet says kill the biscuit that pays the rent",
  company: "Mithila Foods",
  premise:
    "A biscuit maker's costing sheet says its biggest product loses ₹1.48 crore a year. The board wants it discontinued. Work out what that sheet is actually measuring.",
  situation:
    "You are the management accountant at Mithila Foods, a single-plant biscuit manufacturer in Indore selling three products through general trade and modern trade. FY26 revenue was ₹113.9 crore and net profit ₹1.33 crore, against a board target of ₹6 crore. " +
    "The costing sheet circulated before the board meeting shows the glucose biscuit — half the company's sales — losing ₹1.48 crore, while the premium cookie earns ₹4.06 crore. " +
    "The sales director wants glucose discontinued by September. The plant head says the factory is already running flat out and cannot make more of anything. The chairman wants the overhead budget cut instead. " +
    "You have 6 analyst-days to work out which of them is reading the numbers correctly, then 4 people-weeks and ₹6 crore to act on it.",
  difficulty: "Easy",

  mentor: {
    persona: "a CFO debriefing a junior financial analyst",
    audience: "analyst",
  },

  teaching: {
    showMetricMap: true,
    primer: {
      intro:
        "Every cost in a factory is one of two things: it changes when you make one more case, or it does not. Almost every argument about which product to keep is really an argument about which of the two a particular cost is — and a costing sheet that spreads the second kind across products as though it were the first will tell you to close the thing paying for the factory.",
      terms: [
        {
          term: "Variable cost",
          plain: "What one more case of biscuits costs you to make — flour, sugar, palm oil, packaging, the power the oven draws while it is baking it.",
          formula: "cost per tonne × tonnes made",
          matters:
            "It is the only cost that disappears when the product does. Everything you can genuinely save by not making something is in here.",
          driver: "glucoseVariableCost",
        },
        {
          term: "Fixed cost",
          plain: "What the factory costs whether it makes one tonne or ten thousand — rent, the maintenance contract, the plant manager, the finance team.",
          formula: "factory overhead + selling and administration",
          matters:
            "It does not know which product it is working for, which is exactly why splitting it between products is a convention rather than a measurement.",
          driver: "fixedCost",
        },
        {
          term: "Contribution",
          plain: "What a product leaves behind after its own variable costs — the money it contributes towards the fixed costs and, after those are covered, to profit.",
          formula: "revenue − variable cost",
          matters:
            "The number that decides whether making something is worth doing at all. Any product with a positive contribution is helping to pay for the factory, however the sheet dresses it up.",
          driver: "contribution",
        },
        {
          term: "Contribution margin",
          plain: "Contribution as a share of the price — how many paise in each rupee of sales survive the cost of making the thing.",
          formula: "contribution ÷ revenue",
          matters:
            "A percentage, so it compares products of different sizes fairly. It is also the number people confuse with profitability when capacity is scarce, which is the trap in this scenario.",
          driver: "contributionRate",
        },
        {
          term: "Absorption costing",
          full: "Full costing",
          plain: "Charging every product a share of the factory's fixed costs so that each one shows a 'full cost' and a profit of its own.",
          formula: "product profit = contribution − allocated fixed cost",
          matters:
            "Required for valuing stock in the published accounts, and dangerous for deciding anything. The share is chosen by a rule — here, share of revenue — and the rule, not the product, decides who looks profitable.",
        },
        {
          term: "Allocated overhead",
          plain: "The slice of fixed cost a costing sheet has charged to a particular product.",
          formula: "fixed cost × that product's share of revenue",
          matters:
            "It moves when the allocation rule moves and when other products' sales move, so a product's 'profit' can fall in a year when nothing about it changed at all.",
          driver: "factoryOverhead",
        },
        {
          term: "Avoidable cost",
          plain: "What would genuinely stop being spent if you stopped doing something.",
          matters:
            "The only cost that belongs in a decision to drop a product. Ask it as a question about the bank account — which payments stop? — and most allocated overhead answers 'none of them'.",
        },
        {
          term: "Contribution per machine-hour",
          plain: "Contribution divided by the time on the constrained machine that earning it takes.",
          formula: "contribution ÷ running hours used",
          matters:
            "When the plant is full, an hour is the scarce thing rather than a rupee of sales. Ranking products by margin percentage when hours are the constraint is how a full factory ends up making the wrong things well.",
        },
        {
          term: "Breakeven",
          plain: "The sales level at which contribution exactly covers the fixed costs and profit is zero.",
          formula: "fixed cost ÷ contribution margin",
          matters:
            "It puts both kinds of cost in one sentence, and it shows immediately why removing a contributing product raises the bar for everything left.",
        },
      ],
      worked: [
        "Glucose: 8,788 tonnes at ₹66,000 a tonne is ₹58.0 crore of sales, at a variable cost of ₹54,120 a tonne.",
        "So it contributes ₹11,880 a tonne — ₹10.44 crore a year, an 18% contribution margin.",
        "The costing sheet then charges it 50.9% of ₹23.4 crore of fixed cost, because that is its share of revenue: ₹11.92 crore.",
        "₹10.44 crore less ₹11.92 crore is the ₹1.48 crore 'loss' on the sheet the board has in front of it.",
        "Now ask the only question that matters: if the line stops tomorrow, which of that ₹11.92 crore stops with it?",
      ],
    },
  },

  northStar: "netProfit",
  reported: [
    "revenue",
    "contribution",
    "contributionRate",
    "glucoseContribution",
    "premiumContribution",
    "ebitda",
    "netProfit",
  ],

  drivers: [
    // ── Glucose: half the revenue, and the product on trial. ───────────────
    { id: "glucoseVolume", kind: "input", label: "Glucose — tonnes sold", unit: "count", goodDirection: "up", baseline: 8_788 },
    { id: "glucosePrice", kind: "input", label: "Glucose — realisation per tonne", unit: "inr", goodDirection: "up", baseline: 66_000 },
    { id: "glucoseVariableCost", kind: "input", label: "Glucose — variable cost per tonne", unit: "inr", goodDirection: "down", baseline: 54_120 },
    { id: "glucoseRevenue", kind: "product", label: "Glucose — revenue", unit: "inr", goodDirection: "up", of: ["glucoseVolume", "glucosePrice"] },
    { id: "glucoseVariableTotal", kind: "product", label: "Glucose — variable cost", unit: "inr", goodDirection: "down", of: ["glucoseVolume", "glucoseVariableCost"] },
    { id: "glucoseContribution", kind: "difference", label: "Glucose — contribution", unit: "inr", goodDirection: "up", minuend: "glucoseRevenue", subtrahend: "glucoseVariableTotal" },

    // ── Cream: the middle of the range, and nobody's argument. ─────────────
    { id: "creamVolume", kind: "input", label: "Cream — tonnes sold", unit: "count", goodDirection: "up", baseline: 2_712 },
    { id: "creamPrice", kind: "input", label: "Cream — realisation per tonne", unit: "inr", goodDirection: "up", baseline: 125_000 },
    { id: "creamVariableCost", kind: "input", label: "Cream — variable cost per tonne", unit: "inr", goodDirection: "down", baseline: 91_250 },
    { id: "creamRevenue", kind: "product", label: "Cream — revenue", unit: "inr", goodDirection: "up", of: ["creamVolume", "creamPrice"] },
    { id: "creamVariableTotal", kind: "product", label: "Cream — variable cost", unit: "inr", goodDirection: "down", of: ["creamVolume", "creamVariableCost"] },
    { id: "creamContribution", kind: "difference", label: "Cream — contribution", unit: "inr", goodDirection: "up", minuend: "creamRevenue", subtrahend: "creamVariableTotal" },

    // ── Premium: a fifth of sales, the best use of an hour, and short of
    //    stock every month for the last two years. ─────────────────────────
    { id: "premiumVolume", kind: "input", label: "Premium cookies — tonnes sold", unit: "count", goodDirection: "up", baseline: 880 },
    { id: "premiumPrice", kind: "input", label: "Premium cookies — realisation per tonne", unit: "inr", goodDirection: "up", baseline: 250_000 },
    { id: "premiumVariableCost", kind: "input", label: "Premium cookies — variable cost per tonne", unit: "inr", goodDirection: "down", baseline: 152_500 },
    { id: "premiumRevenue", kind: "product", label: "Premium cookies — revenue", unit: "inr", goodDirection: "up", of: ["premiumVolume", "premiumPrice"] },
    { id: "premiumVariableTotal", kind: "product", label: "Premium cookies — variable cost", unit: "inr", goodDirection: "down", of: ["premiumVolume", "premiumVariableCost"] },
    { id: "premiumContribution", kind: "difference", label: "Premium cookies — contribution", unit: "inr", goodDirection: "up", minuend: "premiumRevenue", subtrahend: "premiumVariableTotal" },

    { id: "revenue", kind: "sum", label: "Revenue", unit: "inr", goodDirection: "up", of: ["glucoseRevenue", "creamRevenue", "premiumRevenue"] },
    /**
     * The number the costing sheet never prints, and the whole exercise. Derived
     * from the three products so it can never drift out of step with them.
     */
    { id: "contribution", kind: "sum", label: "Contribution", unit: "inr", goodDirection: "up", of: ["glucoseContribution", "creamContribution", "premiumContribution"] },
    { id: "contributionRate", kind: "quotient", label: "Contribution margin", unit: "ratio", goodDirection: "up", numerator: "contribution", denominator: "revenue" },

    { id: "factoryOverhead", kind: "input", label: "Factory overhead", unit: "inr", goodDirection: "down", baseline: 16 * CRORE },
    { id: "sga", kind: "input", label: "Selling and administration", unit: "inr", goodDirection: "down", baseline: 7.4 * CRORE },
    { id: "fixedCost", kind: "sum", label: "Fixed cost", unit: "inr", goodDirection: "down", of: ["factoryOverhead", "sga"] },
    { id: "ebitda", kind: "difference", label: "EBITDA", unit: "inr", goodDirection: "up", minuend: "contribution", subtrahend: "fixedCost" },

    { id: "depreciation", kind: "input", label: "Depreciation", unit: "inr", goodDirection: "down", baseline: 2.1 * CRORE },
    { id: "ebit", kind: "difference", label: "Operating profit (EBIT)", unit: "inr", goodDirection: "up", minuend: "ebitda", subtrahend: "depreciation" },
    { id: "interest", kind: "input", label: "Interest", unit: "inr", goodDirection: "down", baseline: 0.9 * CRORE },
    { id: "pbt", kind: "difference", label: "Profit before tax", unit: "inr", goodDirection: "up", minuend: "ebit", subtrahend: "interest" },
    // Nobody in this room sets the corporate tax rate, which is what `constant`
    // is for: the validator refuses an intervention aimed at it.
    { id: "taxRate", kind: "constant", label: "Tax rate", unit: "ratio", goodDirection: "down", value: 0.25 },
    { id: "tax", kind: "product", label: "Tax", unit: "inr", goodDirection: "down", of: ["pbt", "taxRate"] },
    { id: "netProfit", kind: "difference", label: "Net profit", unit: "inr", goodDirection: "up", minuend: "pbt", subtrahend: "tax" },
  ],

  dashboard: [
    {
      id: "p-abs-sku-sheet",
      kind: "segments",
      title: "Product profitability, as the board pack reports it",
      caption: "₹ crore. Fixed costs charged to each product on its share of revenue.",
      dimension: "Product",
      rows: [
        { label: "Glucose", value: -1.48, unit: "inr_crore", deltaPct: -1.94 },
        { label: "Cream", value: 2.19, unit: "inr_crore", deltaPct: -0.12 },
        { label: "Premium cookies", value: 4.06, unit: "inr_crore", deltaPct: 0.09 },
      ],
    },
    {
      id: "p-abs-pnl",
      kind: "statement",
      statement: "pnl",
      title: "Mithila Foods — statement of profit and loss",
      caption: "₹ crore. The company as filed, before anything is charged to a product.",
      unit: "inr",
      periods: ["FY26", "FY25"],
      sections: [
        {
          lines: [
            { label: "Revenue", value: 113.9 * CRORE, priorValue: 108.4 * CRORE, goodDirection: "up" },
            { label: "Materials, packaging and process energy", value: -85.73 * CRORE, priorValue: -80.86 * CRORE, indent: true, note: "Everything that moves with a tonne made." },
            {
              label: "Contribution",
              value: 28.17 * CRORE,
              priorValue: 27.54 * CRORE,
              emphasis: true,
              goodDirection: "up",
              note: "A contribution margin of 24.7%, against 25.4% last year.",
            },
          ],
        },
        {
          title: "Fixed cost",
          lines: [
            { label: "Factory overhead", value: -16.0 * CRORE, priorValue: -15.1 * CRORE, indent: true },
            { label: "Selling and administration", value: -7.4 * CRORE, priorValue: -6.8 * CRORE, indent: true },
            { label: "Total fixed cost", value: -23.4 * CRORE, priorValue: -21.9 * CRORE, emphasis: true, goodDirection: "down" },
            { label: "EBITDA", value: 4.77 * CRORE, priorValue: 5.64 * CRORE, emphasis: true, goodDirection: "up" },
          ],
        },
        {
          lines: [
            { label: "Depreciation", value: -2.1 * CRORE, priorValue: -2.0 * CRORE, indent: true },
            { label: "Interest", value: -0.9 * CRORE, priorValue: -0.85 * CRORE, indent: true },
            { label: "Profit before tax", value: 1.77 * CRORE, priorValue: 2.79 * CRORE, emphasis: true, goodDirection: "up" },
            { label: "Tax", value: -0.44 * CRORE, priorValue: -0.7 * CRORE, indent: true },
            { label: "Net profit", value: 1.33 * CRORE, priorValue: 2.09 * CRORE, emphasis: true, goodDirection: "up" },
          ],
        },
      ],
    },
    {
      id: "p-abs-headline",
      kind: "stat",
      title: "What the board will open with",
      tiles: [
        { label: "Revenue", value: 113.9 * CRORE, unit: "inr", deltaPct: 0.051, goodDirection: "up" },
        { label: "Net profit", value: 1.33 * CRORE, unit: "inr", deltaPct: -0.364, goodDirection: "up" },
        { label: "Contribution margin", value: 0.247, unit: "ratio", deltaPct: -0.028, goodDirection: "up" },
        { label: "Board profit target", value: 6 * CRORE, unit: "inr", goodDirection: "up" },
        { label: "Hours the line spends making product", value: 0.88, unit: "ratio", goodDirection: "up" },
        { label: "Products in the range", value: 3, unit: "count", goodDirection: "up" },
      ],
    },
    {
      id: "p-abs-mix",
      kind: "segments",
      title: "Revenue by product",
      caption: "₹ crore, FY26, against last year.",
      dimension: "Product",
      rows: [
        { label: "Glucose", value: 58.0, unit: "inr_crore", deltaPct: 0.043 },
        { label: "Cream", value: 33.9, unit: "inr_crore", deltaPct: 0.062 },
        { label: "Premium cookies", value: 22.0, unit: "inr_crore", deltaPct: 0.058 },
      ],
    },
    // ── Decoys ──────────────────────────────────────────────────────────
    //
    // Both true, both correctly measured, and neither able to explain a rupee
    // of the problem. Wheat and palm oil are what everybody in an Indian food
    // factory blames first, and the plant scorecard is the number the plant
    // head is proud of.
    {
      id: "p-abs-plant",
      kind: "stat",
      title: "Plant scorecard",
      caption: "The single Indore line, FY26 average.",
      tiles: [
        { label: "Overall equipment effectiveness", value: 0.78, unit: "ratio", goodDirection: "up" },
        { label: "Dough and bake wastage", value: 0.019, unit: "ratio", goodDirection: "down" },
        { label: "Wheat, ₹ per quintal", value: 2680, unit: "inr", deltaPct: 0.081, goodDirection: "down" },
        { label: "Process energy, ₹ per tonne", value: 4150, unit: "inr", deltaPct: 0.046, goodDirection: "down" },
      ],
    },
    {
      id: "p-abs-channel",
      kind: "segments",
      title: "Revenue by channel",
      caption: "₹ crore. Where the ₹113.9 crore was sold.",
      dimension: "Channel",
      rows: [
        { label: "General trade", value: 74.1, unit: "inr_crore", deltaPct: 0.032 },
        { label: "Modern trade", value: 27.6, unit: "inr_crore", deltaPct: 0.094 },
        { label: "E-commerce and quick commerce", value: 12.2, unit: "inr_crore", deltaPct: 0.121 },
      ],
    },
    {
      id: "p-abs-room",
      kind: "note",
      title: "What the room is saying",
      body:
        "Sales director: glucose loses ₹1.48 crore a year on the company's own costing sheet. Stop making it in September and we are ₹1.48 crore better off before we have done anything else.\n" +
        "Plant head: the line spent 88% of its available hours actually making product last year. I cannot make more of anything without stopping something, and every changeover costs me seven hours.\n" +
        "Chairman: ₹16 crore of factory overhead on ₹114 crore of sales is too much. Take 8% out of it and the profit target looks after itself.\n" +
        "Nobody in the meeting has asked which of the ₹11.92 crore charged to glucose would stop being paid if glucose stopped being made.",
    },
  ],

  budget: { analystDays: 6, sprints: 4, rupees: 6 * CRORE },

  drilldowns: [
    {
      id: "dd-contribution-sheet",
      label: "Rebuild the product sheet without the allocation",
      question: "What does each product earn before any fixed cost is charged to it?",
      cost: 2,
      evidenceFor: ["costing.absorption", "portfolio.glucose"],
      readsAs:
        "Every product contributes: ₹10.44 crore from glucose, ₹9.15 crore from cream, ₹8.58 crore from premium. The ₹1.48 crore 'loss' is entirely the ₹11.92 crore of fixed cost the sheet charged to glucose because it sells the most.",
      reveals: [
        {
          id: "p-abs-contribution",
          kind: "statement",
          statement: "pnl",
          title: "The same year, before and after the allocation",
          caption: "₹ crore. Left column: contribution. Right column: what the costing sheet charged and reported.",
          unit: "inr",
          periods: ["Contribution", "As charged"],
          sections: [
            {
              title: "Glucose",
              lines: [
                { label: "Glucose — revenue", value: 58.0 * CRORE, priorValue: 58.0 * CRORE },
                { label: "Glucose — variable cost", value: -47.56 * CRORE, priorValue: -47.56 * CRORE, indent: true },
                { label: "Glucose — allocated fixed cost", value: 0, priorValue: -11.92 * CRORE, indent: true, note: "50.9% of ₹23.4 crore, because glucose is 50.9% of revenue." },
                { label: "Glucose — result", value: 10.44 * CRORE, priorValue: -1.48 * CRORE, emphasis: true },
              ],
            },
            {
              title: "Cream",
              lines: [
                { label: "Cream — revenue", value: 33.9 * CRORE, priorValue: 33.9 * CRORE },
                { label: "Cream — variable cost", value: -24.75 * CRORE, priorValue: -24.75 * CRORE, indent: true },
                { label: "Cream — allocated fixed cost", value: 0, priorValue: -6.96 * CRORE, indent: true },
                { label: "Cream — result", value: 9.15 * CRORE, priorValue: 2.19 * CRORE, emphasis: true },
              ],
            },
            {
              title: "Premium cookies",
              lines: [
                { label: "Premium — revenue", value: 22.0 * CRORE, priorValue: 22.0 * CRORE },
                { label: "Premium — variable cost", value: -13.42 * CRORE, priorValue: -13.42 * CRORE, indent: true },
                { label: "Premium — allocated fixed cost", value: 0, priorValue: -4.52 * CRORE, indent: true },
                { label: "Premium — result", value: 8.58 * CRORE, priorValue: 4.06 * CRORE, emphasis: true },
              ],
            },
          ],
        },
        {
          id: "p-abs-contribution-note",
          kind: "note",
          title: "What the allocation rule is doing",
          body:
            "The rule is one line in the costing model: fixed cost is charged to a product in proportion to its share of revenue.\n\n" +
            "Glucose sells 51% of the rupees, so it carries 51% of the factory — ₹11.92 crore. It contributes ₹10.44 crore. The difference is the ₹1.48 crore 'loss'.\n\n" +
            "Change the rule to tonnes made and glucose carries 71% of the factory and looks far worse. Change it to running hours used and it carries 46% — ₹10.76 crore — and the ₹1.48 crore loss becomes a ₹0.32 crore one. Nothing about the product changes in any of those three sheets.",
        },
      ],
    },
    {
      id: "dd-avoidable",
      label: "What would actually stop being paid",
      question: "If the glucose line stopped in September, which costs stop with it?",
      cost: 2,
      evidenceFor: ["costing.absorption", "portfolio.glucose"],
      readsAs:
        "₹1.9 crore of the ₹11.92 crore charged to glucose is avoidable — two packing shifts and some warehousing. The other ₹10.0 crore is rent, depreciation, the maintenance contract, the plant manager and head office, and every rupee of it is still payable in October.",
      reveals: [
        {
          id: "p-abs-avoidable",
          kind: "segments",
          title: "The ₹11.92 crore charged to glucose",
          caption: "₹ crore, split by what happens to it if the product is discontinued.",
          dimension: "Cost",
          rows: [
            { label: "Packing labour on the glucose shifts — stops", value: 1.24, unit: "inr_crore" },
            { label: "Third-party warehousing — stops", value: 0.66, unit: "inr_crore" },
            { label: "Factory rent and depreciation — continues", value: 4.31, unit: "inr_crore" },
            { label: "Maintenance contract and utilities standing charge — continues", value: 2.18, unit: "inr_crore" },
            { label: "Plant management, quality and head office — continues", value: 3.53, unit: "inr_crore" },
          ],
        },
        {
          id: "p-abs-avoidable-note",
          kind: "note",
          title: "The year after, if glucose is discontinued",
          body:
            "Contribution falls ₹10.44 crore. Fixed cost falls ₹1.90 crore. EBITDA goes from ₹4.77 crore to minus ₹3.77 crore, and the company is loss-making at the net line for the first time in nine years.\n\n" +
            "The costing sheet is then re-run on the two remaining products, which now carry ₹21.5 crore of fixed cost between them instead of ₹11.48 crore. Cream is 60.6% of what is left of the revenue, so it is charged ₹13.04 crore against ₹9.15 crore of contribution, comes back at minus ₹3.89 crore, and the same meeting is held about cream.",
        },
      ],
    },
    {
      id: "dd-line-hours",
      label: "Where the line's 7,600 hours went",
      question: "The plant is full — so what is it full of, and what does an hour earn?",
      cost: 2,
      evidenceFor: ["costing.absorption"],
      readsAs:
        "Glucose takes 46% of the running hours to earn ₹33,800 an hour; premium takes 21% to earn ₹60,600. And 826 hours — one available hour in nine — are changeovers, scheduled by the same sheet that ranks products by revenue.",
      reveals: [
        {
          id: "p-abs-hours",
          kind: "segments",
          title: "Line hours and what each one earned",
          caption: "Contribution per running hour, FY26. The line spent 6,720 of its 7,600 available hours making product.",
          dimension: "Product",
          rows: [
            { label: "Glucose — 3,090 hours", value: 33_786, unit: "inr" },
            { label: "Cream — 2,215 hours", value: 41_323, unit: "inr" },
            { label: "Premium cookies — 1,415 hours", value: 60_636, unit: "inr" },
          ],
        },
        {
          id: "p-abs-changeover",
          kind: "note",
          title: "The 826 hours nobody is paid for",
          body:
            "The line changes format 118 times a year and each changeover takes about seven hours end to end — bake profile, cream deposit, wrapper reel, and the quality hold on the first pallets.\n\n" +
            "The schedule is built from the costing sheet's product ranking, which is why the two premium runs a month are short and frequent rather than campaigned. A quick-changeover programme at a comparable plant in Ahmedabad took the same job from seven hours to three.",
        },
      ],
    },
    {
      id: "dd-premium-demand",
      label: "The premium order book",
      question: "If we could make more premium cookies, could we sell them?",
      cost: 2,
      evidenceFor: ["costing.absorption"],
      readsAs:
        "Fill rate on premium has been 71% for two years and two modern-trade listings were declined for want of supply. About 360 tonnes a year of ordered volume goes unshipped, and another 250 tonnes was turned away before it was ever ordered — together two thirds again of what the plant currently makes.",
      reveals: [
        {
          id: "p-abs-fill",
          kind: "timeseries",
          title: "Premium cookies: ordered against dispatched",
          caption: "Tonnes per quarter, FY26. 880 tonnes dispatched against 1,240 ordered.",
          series: [
            {
              label: "Ordered",
              unit: "count",
              points: [
                { period: "Q1", value: 300 },
                { period: "Q2", value: 310 },
                { period: "Q3", value: 325 },
                { period: "Q4", value: 305 },
              ],
            },
            {
              label: "Dispatched",
              unit: "count",
              points: [
                { period: "Q1", value: 220 },
                { period: "Q2", value: 224 },
                { period: "Q3", value: 230 },
                { period: "Q4", value: 206 },
              ],
            },
          ],
        },
        {
          id: "p-abs-listings",
          kind: "note",
          title: "What sales turned down",
          body:
            "Two modern-trade chains asked for premium listings in FY26 — one national, one south-west regional — and both were declined by the plant on capacity. Between them they were worth about 250 tonnes a year at full price.\n\n" +
            "Glucose is the opposite case: the depots carry 26 days of cover against a 14-day target, and the last two price increases were absorbed by the trade without a volume response worth measuring.",
        },
      ],
    },
    {
      id: "dd-price-test",
      label: "The four-depot glucose price test",
      question: "Could we simply charge more for glucose?",
      cost: 2,
      evidenceFor: ["portfolio.price"],
      readsAs:
        "Four depots took 8% on the glucose list price for a quarter. Volume fell 30% against matched controls — this is a ₹5 and ₹10 pack in a market with three other ₹5 packs. Contribution moved by about 1%.",
      reveals: [
        {
          id: "p-abs-price-test",
          kind: "segments",
          title: "Four-depot price test, Q3 FY26",
          caption: "Test depots against matched controls, indexed to the controls.",
          dimension: "Effect of an 8% list price rise",
          rows: [
            { label: "Realisation per tonne", value: 1.08, unit: "multiple", deltaPct: 0.08 },
            { label: "Tonnes sold", value: 0.7, unit: "multiple", deltaPct: -0.3 },
            { label: "Revenue", value: 0.756, unit: "multiple", deltaPct: -0.244 },
            { label: "Contribution", value: 1.011, unit: "multiple", deltaPct: 0.011 },
          ],
        },
      ],
    },
    {
      id: "dd-overhead-lines",
      label: "Factory overhead line by line",
      question: "Is the ₹16 crore of factory overhead actually bloated?",
      cost: 2,
      evidenceFor: ["costs.overhead", "costs.input"],
      readsAs:
        "₹11.6 crore of the ₹16 crore is rent, depreciation and the maintenance contract — committed for the next four years. The discretionary part is ₹4.4 crore, and ₹1.3 crore of that is the maintenance and quality cover that keeps a single-line plant running.",
      reveals: [
        {
          id: "p-abs-overhead",
          kind: "statement",
          statement: "pnl",
          title: "Factory overhead, FY26 against FY25",
          caption: "₹ crore.",
          unit: "inr",
          periods: ["FY26", "FY25"],
          sections: [
            {
              title: "Committed",
              lines: [
                { label: "Factory rent and lease charges", value: 4.9 * CRORE, priorValue: 4.7 * CRORE, goodDirection: "down" },
                { label: "Plant depreciation and insurance", value: 3.2 * CRORE, priorValue: 3.1 * CRORE, goodDirection: "down" },
                { label: "Annual maintenance contract", value: 3.5 * CRORE, priorValue: 3.3 * CRORE, goodDirection: "down" },
                { label: "Total committed", value: 11.6 * CRORE, priorValue: 11.1 * CRORE, emphasis: true, goodDirection: "down", note: "Contracted to FY30. None of it moves with what the line makes." },
              ],
            },
            {
              title: "Discretionary",
              lines: [
                { label: "Maintenance crew and quality cover", value: 1.9 * CRORE, priorValue: 1.8 * CRORE, goodDirection: "down" },
                { label: "Plant management and administration", value: 1.6 * CRORE, priorValue: 1.5 * CRORE, goodDirection: "down" },
                { label: "Consumables, training and sundries", value: 0.9 * CRORE, priorValue: 0.7 * CRORE, goodDirection: "down" },
                { label: "Total discretionary", value: 4.4 * CRORE, priorValue: 4.0 * CRORE, emphasis: true, goodDirection: "down" },
              ],
            },
          ],
        },
      ],
    },
  ],

  causes: [
    { id: "costing", parentId: null, label: "How we decide what a product costs", verdict: "The right place to look, and the one branch nobody in the room opened." },
    {
      id: "costing.absorption",
      parentId: "costing",
      label: "Fixed cost is charged on share of revenue, so the biggest seller looks loss-making and the line is planned from that sheet",
      verdict:
        "This was it, and it is two mistakes wearing one coat. First, the ₹11.92 crore charged to glucose is 84% unavoidable, so the 'loss' is an accounting convention rather than a payment anybody could stop making. Second, the same ranking is used to schedule a plant with no idle time left to give — hours go to the product that looks profitable per rupee of sales rather than the one that earns most per hour, which is why premium runs at a 71% fill rate while glucose sits on 26 days of depot cover.",
    },
    { id: "portfolio", parentId: null, label: "The product range itself", verdict: "Three products, all of them contributing. There is no product here worth removing." },
    {
      id: "portfolio.glucose",
      parentId: "portfolio",
      label: "The glucose biscuit genuinely loses money and should be discontinued",
      verdict:
        "No — and it is the most expensive answer on the board. Glucose contributes ₹10.44 crore a year against ₹1.90 crore of cost that would actually stop. Discontinuing it takes EBITDA from ₹4.77 crore to minus ₹3.77 crore, and hands the two survivors an extra ₹10 crore of fixed cost to absorb, at which point cream shows a ₹3.89 crore loss and the same meeting happens again.",
    },
    {
      id: "portfolio.price",
      parentId: "portfolio",
      label: "Glucose is underpriced against wheat and palm oil",
      verdict:
        "Barely. The four-depot test took 8% on list and lost 30% of volume, which moved contribution about 1%. This is a ₹5 pack competing against three other ₹5 packs; the price is set by the shelf, not by the cost sheet.",
    },
    { id: "costs", parentId: null, label: "The cost base", verdict: "Higher than the chairman would like and almost entirely committed." },
    {
      id: "costs.overhead",
      parentId: "costs",
      label: "Factory overhead is bloated and can be cut",
      verdict:
        "₹11.6 crore of the ₹16 crore is rent, depreciation and a maintenance contract running to FY30. The discretionary ₹4.4 crore includes the maintenance and quality cover for a single-line plant — taking 8% out is worth ₹1.28 crore and costs about ₹1.02 crore of lost output through breakdowns. A net ₹0.26 crore, on a ₹4.67 crore gap to target.",
    },
    {
      id: "costs.input",
      parentId: "costs",
      label: "Wheat and palm oil ran away from us",
      verdict:
        "Real and priced in. Input costs took 0.7 points off the contribution margin this year, about ₹0.8 crore. It explains part of why profit fell and none of why the board is discussing closing a product that earns ₹10.44 crore.",
    },
    { id: "market", parentId: null, label: "The market we sell into", verdict: "Growing slowly and behaving exactly as it did last year." },
    {
      id: "market.competition",
      parentId: "market",
      label: "A regional rival's ₹5 pack is taking our glucose share",
      verdict:
        "No. Glucose volume grew 2.4% and value share was flat at 11.8% through the year. The rival gained in two districts of Vidarbha and lost in four others. Nothing here is moving fast enough to explain a ₹1 crore fall in profit.",
    },
  ],
  trueCauseIds: ["costing.absorption"],

  interventions: [
    {
      id: "iv-plan-on-contribution",
      label: "Re-plan the line on contribution per hour",
      pitch:
        "Rank the schedule by what an hour of the constrained line earns rather than by the costing sheet's product profit: campaign the premium runs, take the glucose depot cover from 26 days to 16, and sell the hours that frees to the order book that is already waiting.",
      addresses: "costing.absorption",
      cost: { sprints: 2, rupees: 3.2 * CRORE },
      minSprints: 2,
      effects: {
        // Glucose gives up 16% of its volume — the depot over-cover, not its
        // customers — and the hours go where an hour earns 80% more.
        whenRootCause: [
          { driver: "glucoseVolume", deltaPct: -0.16, rampQuarters: 2 },
          { driver: "creamVolume", deltaPct: 0.06, rampQuarters: 2 },
          { driver: "premiumVolume", deltaPct: 0.28, rampQuarters: 3 },
        ],
        // Moving a full line without the order book to receive it: the glucose
        // volume goes and only part of the premium arrives.
        otherwise: [
          { driver: "glucoseVolume", deltaPct: -0.16, rampQuarters: 2 },
          { driver: "premiumVolume", deltaPct: 0.12, rampQuarters: 3 },
        ],
      },
      debrief:
        "The mix half of the answer, and the one the costing sheet was actively preventing. It changes nothing about what anything costs — it changes which hours the plant spends, on the only ranking that is valid when capacity binds.",
    },
    {
      id: "iv-changeover",
      label: "Take the changeovers off the line",
      pitch:
        "A quick-changeover programme on the format change — pre-staged wrapper reels, a standard bake-profile ramp, and the quality hold moved off the line. Seven hours becomes three, and one available hour in nine comes back as time spent making biscuits.",
      addresses: "costing.absorption",
      cost: { sprints: 2, rupees: 2.6 * CRORE },
      minSprints: 2,
      effects: {
        whenRootCause: [
          { driver: "glucoseVolume", deltaPct: 0.04, rampQuarters: 2 },
          { driver: "creamVolume", deltaPct: 0.07, rampQuarters: 2 },
          { driver: "premiumVolume", deltaPct: 0.12, rampQuarters: 2 },
        ],
        otherwise: [
          { driver: "glucoseVolume", deltaPct: 0.02, rampQuarters: 2 },
          { driver: "creamVolume", deltaPct: 0.02, rampQuarters: 2 },
          { driver: "premiumVolume", deltaPct: 0.03, rampQuarters: 2 },
        ],
      },
      debrief:
        "The capacity half. 826 hours of changeover on a line with nothing else left to give is the cheapest tonnage in the company — nobody has to be persuaded to buy it and no capital has to be sanctioned to make it.",
    },
    {
      id: "iv-drop-glucose",
      label: "Discontinue the glucose biscuit",
      pitch:
        "The sales director's proposal. The sheet says it loses ₹1.48 crore a year; stop making it in September and take the loss out of the P&L.",
      addresses: "portfolio.glucose",
      cost: { sprints: 1, rupees: 0.6 * CRORE },
      effects: {
        whenRootCause: [
          { driver: "glucoseVolume", deltaPct: -0.92 },
          { driver: "factoryOverhead", deltaPct: -0.12 },
          { driver: "sga", deltaPct: -0.09 },
        ],
        otherwise: [
          { driver: "glucoseVolume", deltaPct: -0.92 },
          // ₹1.60 crore and ₹0.30 crore: the two packing shifts and the
          // third-party warehousing, which is the whole of what stops.
          { driver: "factoryOverhead", deltaPct: -0.1 },
          { driver: "sga", deltaPct: -0.04 },
          // The hours do come back, and they are worth having. They are worth
          // nothing like ₹10.44 crore.
          { driver: "premiumVolume", deltaPct: 0.06, rampQuarters: 2 },
        ],
      },
      debrief:
        "The most expensive button on the board. ₹10.44 crore of contribution leaves, ₹1.90 crore of cost follows it, and ₹10 crore of factory has to be absorbed by two products instead of three — which is how a company talks itself out of a second product a year later. If you funded this, read the avoidable-cost pull again: the question is never what a sheet charges to a product, it is which payments stop.",
    },
    {
      id: "iv-price-up",
      label: "Take 8% on the glucose list price",
      pitch:
        "Wheat is up 8% and glucose has not been repriced in two years. Put the list price up and let the contribution margin recover.",
      addresses: "portfolio.price",
      cost: { sprints: 1, rupees: 0.5 * CRORE },
      effects: {
        whenRootCause: [
          { driver: "glucosePrice", deltaPct: 0.08 },
          { driver: "glucoseVolume", deltaPct: -0.12 },
        ],
        otherwise: [
          { driver: "glucosePrice", deltaPct: 0.08 },
          { driver: "glucoseVolume", deltaPct: -0.3 },
        ],
      },
      debrief:
        "The four-depot test had already answered this and the room read it as a margin result. 8% on the list against 30% of the volume is about 1% of contribution — and it hands share to three competitors sitting at the same price point on the same shelf.",
    },
    {
      id: "iv-overhead-cut",
      label: "Take 8% out of factory overhead",
      pitch:
        "The chairman's proposal. ₹16 crore of overhead on ₹114 crore of sales is a point and a half more than the sector; cut ₹1.28 crore of it and most of the gap to target closes.",
      addresses: "costs.overhead",
      cost: { sprints: 1, rupees: 0.9 * CRORE },
      effects: {
        whenRootCause: [{ driver: "factoryOverhead", deltaPct: -0.08 }],
        otherwise: [
          { driver: "factoryOverhead", deltaPct: -0.08 },
          // Where 8% of a single-line plant's overhead actually comes from.
          { driver: "glucoseVolume", deltaPct: -0.03, rampQuarters: 2 },
          { driver: "creamVolume", deltaPct: -0.03, rampQuarters: 2 },
          { driver: "premiumVolume", deltaPct: -0.05, rampQuarters: 2 },
        ],
      },
      debrief:
        "Genuinely worth about ₹0.26 crore net, which is both real and a tenth of what the two capacity levers were worth. On a single-line plant the discretionary overhead is mostly the maintenance and quality cover that keeps the line running, so 8% of it comes back as breakdown hours on the constraint.",
    },
  ],

  /**
   * Standing still is not free: wheat and palm oil keep moving, and the premium
   * order book does not wait for a plant that cannot fill it.
   */
  drift: [
    { driver: "glucoseVariableCost", deltaPct: 0.005 },
    { driver: "creamVariableCost", deltaPct: 0.004 },
    { driver: "premiumVariableCost", deltaPct: 0.004 },
    { driver: "premiumVolume", deltaPct: -0.015 },
  ],
  horizonQuarters: 4,
  periodNoun: "quarter",

  parInvestigation: ["dd-contribution-sheet", "dd-avoidable"],
  bestAllocation: [
    { interventionId: "iv-plan-on-contribution", sprints: 2, rupees: 3.2 * CRORE },
    { interventionId: "iv-changeover", sprints: 2, rupees: 2.6 * CRORE },
  ],

  debrief: {
    causalChain: [
      "The costing model charges the factory's ₹23.4 crore of fixed cost to products in proportion to their share of revenue.",
      "Glucose is 50.9% of revenue, so it is charged ₹11.92 crore against a contribution of ₹10.44 crore, and prints a ₹1.48 crore loss.",
      "Of that ₹11.92 crore, ₹1.90 crore would actually stop being paid if the product stopped — the rest is rent, depreciation, a maintenance contract and head office.",
      "So the 'loss-making' product is paying for ₹10 crore of factory that would otherwise have nobody to pay for it.",
      "The same ranking is used to schedule a line with no spare time, so scarce hours go to the product that looks best per rupee of sales.",
      "Ranked by what an hour earns, that ordering is upside down: ₹33,786 an hour from glucose against ₹60,636 from premium — which has been at a 71% fill rate for two years.",
      "And 826 hours a year, one available hour in nine, are spent changing over between the short runs the same sheet asked for.",
    ],
    whereTheLeverageWas:
      "Not in the range and not in the overhead — in the hours. Re-planning the schedule on contribution per running hour and more than halving the changeover time moves about ₹3.6 crore of contribution without discontinuing anything, sanctioning any capital, or asking a single customer to pay more. The button the room wanted to press would have cost ₹8.5 crore of EBITDA.",
    strongAnswer: [
      "Before I decide anything about a product, I need to know which of its costs are its own.",
      "Glucose sells ₹58 crore and its materials, packaging and process energy cost ₹47.6 crore, so it contributes ₹10.44 crore.",
      "The ₹1.48 crore loss on the sheet appears only after ₹11.92 crore of factory cost is charged to it — on share of revenue, which is a rule somebody chose.",
      "The test for a decision is not what is charged, it is what stops. Here that is ₹1.9 crore: two packing shifts and some warehousing.",
      "So discontinuing glucose loses ₹10.44 crore of contribution and saves ₹1.9 crore. EBITDA goes from ₹4.77 crore to minus ₹3.77 crore.",
      "It also re-charges ₹10 crore of factory to the two products left, which puts cream at minus ₹3.89 crore on the same sheet — the death spiral this method is famous for.",
      "The real problem is one level down, and it is a capacity problem. The line spends 88% of its available hours making product, so hours are the scarce resource, not rupees of sales.",
      "Ranked by contribution per running hour, premium earns ₹60,600 and glucose ₹33,800 — and premium has been short of stock for two years while glucose sits on 26 days of depot cover.",
      "So I would keep all three products and change what the line spends its time on: campaign the premium runs, take glucose cover down to 16 days.",
      "And I would attack the 826 hours of changeover, which is a ninth of the plant that nobody is paid for.",
      "Together that is about ₹3.6 crore of contribution, against a ₹4.67 crore gap to the board's target — without dropping a product or raising a price.",
      "The overhead cut is worth doing later and is worth ₹0.26 crore net, because most of that ₹16 crore is contracted to FY30.",
    ],
  },

  coachFallback: [
    {
      topic: ["contribution", "variable cost", "fixed cost", "marginal", "cost behaviour"],
      answer: [
        "Contribution is revenue less the costs that move with volume — here materials, packaging and process energy.",
        "Glucose contributes ₹10.44 crore, cream ₹9.15 crore, premium ₹8.58 crore: ₹28.17 crore against ₹23.4 crore of fixed cost.",
        "Every one of the three is paying towards the factory. None of them can be 'loss-making' in any sense that survives a bank statement.",
      ],
    },
    {
      topic: ["absorption", "allocation", "allocated", "overhead charge", "full cost", "costing sheet"],
      answer: [
        "The sheet charges fixed cost to products on share of revenue — glucose is 50.9% of sales, so it carries 50.9% of the factory.",
        "That is ₹11.92 crore against ₹10.44 crore of contribution, which is the ₹1.48 crore 'loss'.",
        "Charge the same factory on running hours used instead and glucose carries 46% of it — the ₹1.48 crore loss becomes ₹0.32 crore. Nothing about the biscuit changed.",
      ],
    },
    {
      topic: ["drop", "discontinue", "kill", "delist", "close the line", "avoidable"],
      answer: [
        "Ask which payments stop. Of the ₹11.92 crore charged to glucose, ₹1.90 crore stops — two packing shifts and third-party warehousing.",
        "The other ₹10 crore is rent, depreciation, the maintenance contract and head office, all still payable in October.",
        "So dropping it costs ₹10.44 crore of contribution to save ₹1.90 crore, and takes EBITDA to minus ₹3.77 crore.",
      ],
    },
    {
      topic: ["death spiral", "reallocate", "cream", "next product", "spiral"],
      answer: [
        "Once glucose goes, the ₹21.5 crore of fixed cost left has two products to sit on instead of three.",
        "Cream then carries ₹13.04 crore of it against ₹9.15 crore of contribution and shows a ₹3.89 crore loss on exactly the same sheet.",
        "That is the absorption death spiral: the method keeps producing loss-makers until there is nothing left to allocate to.",
      ],
    },
    {
      topic: ["capacity", "line hours", "constraint", "bottleneck", "per hour", "utilisation"],
      answer: [
        "The line spends 88% of its available hours making product, so an hour is the scarce resource — not a rupee of sales.",
        "Contribution per running hour: glucose ₹33,786, cream ₹41,323, premium ₹60,636.",
        "When capacity binds, that is the only ranking that decides anything, and the plan was built on the opposite one.",
      ],
    },
    {
      topic: ["changeover", "smed", "setup", "batch", "campaign", "826"],
      answer: [
        "118 format changes a year at about seven hours each is 826 hours — one available hour in nine.",
        "The schedule is short and frequent because it follows the costing sheet's ranking rather than the order book.",
        "Quick changeover took the same job to three hours at a comparable plant, which is capacity nobody has to buy.",
      ],
    },
    {
      topic: ["price", "price rise", "8%", "wheat", "palm oil", "input cost"],
      answer: [
        "The four-depot test already ran this: 8% on the list price lost 30% of the volume and moved contribution about 1%.",
        "Glucose is a ₹5 pack against three other ₹5 packs — the shelf sets the price.",
        "Input inflation is real and took about 0.7 points off the margin, which is ₹0.8 crore of a ₹4.67 crore gap.",
      ],
    },
    {
      topic: ["overhead cut", "chairman", "cut costs", "8% overhead", "discretionary"],
      answer: [
        "₹11.6 crore of the ₹16 crore is rent, depreciation and a maintenance contract running to FY30.",
        "The discretionary ₹4.4 crore is mostly the maintenance and quality cover a single-line plant needs.",
        "Cutting 8% saves ₹1.28 crore and costs about ₹1.02 crore of output through breakdowns — worth ₹0.26 crore net.",
      ],
    },
    {
      topic: ["premium", "fill rate", "order book", "listings", "unserved demand"],
      answer: [
        "Premium has run at a 71% fill rate for two years, and two modern-trade listings worth about 250 tonnes were declined on capacity.",
        "So the hours released by re-planning and by faster changeovers have somewhere to go on day one.",
        "That is what makes the mix decision worth ₹3.6 crore rather than a paper exercise.",
      ],
    },
  ],
};
