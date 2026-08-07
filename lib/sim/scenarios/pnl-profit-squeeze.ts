/**
 * "Revenue is up 22% and profit is down 62%."
 *
 * The first of the three finance scenarios, and the one that teaches a student
 * to read a profit and loss statement at all: revenue, cost of goods, gross
 * profit, operating expenses, EBITDA, and the three lines below it that turn an
 * operating result into a number the owners keep.
 *
 * ── The truth, for whoever maintains this ─────────────────────────────────
 *
 * Nobody's margin collapsed. The company opened 14 stores at the start of the
 * year, and a new apparel store takes two to three years to mature: these are
 * trading at ₹0.54 crore against ₹1.42 crore for an established one, while
 * carrying a full year of rent, staff and fit-out depreciation.
 *
 * Read consolidated, that is a company falling apart. Read like-for-like, the
 * 46 mature stores contributed ₹15.64 crore against ₹14.48 crore last year —
 * they had a *better* year — and the entire fall is the cost of the fourteen.
 *
 * That is the lesson: **a consolidated P&L is an average, and an average of two
 * different businesses describes neither.** Before diagnosing a margin, split
 * the statement into the parts that are comparable.
 *
 * ── Balance notes ─────────────────────────────────────────────────────────
 *
 * The advertising cut is the trap that took the most tuning. It has to be
 * genuinely tempting — ₹1.70 crore of spend that appeared this year and can be
 * removed with one sprint and almost no money — and it has to lose. It is
 * authored to give back very slightly more gross profit than it saves
 * (`matureRevenuePerStore` −4.5%, `newRevenuePerStore` −14%), so a student who
 * takes it watches the gross margin percentage improve while the profit does
 * not. Weaken those two numbers and cutting advertising becomes correct, which
 * would teach precisely the wrong reflex.
 *
 * The lease renegotiation and the ramp compose additively because they move
 * different drivers (`newCostPerStore` and `newRevenuePerStore`). An earlier
 * draft had the second lever *close* four new stores instead, which broke:
 * once the ramp lands, a new store contributes positively and closing four of
 * them destroys value, so the two correct answers fought each other.
 *
 * `tests/sim-scenario.test.ts` pins the like-for-like arithmetic and the
 * advertising trap. `checkBalance` is what will tell you if a retune lets a
 * decoy win.
 */

import type { SimScenario } from "../types";

const CRORE = 10_000_000;

export const pnlProfitSqueeze: SimScenario = {
  slug: "pnl-profit-squeeze",
  title: "Kirti Apparel: revenue is up 22% and profit is down 62%",
  company: "Kirti Apparel",
  premise:
    "A 60-store apparel chain grew revenue 22% and lost nearly two thirds of its profit. Read the P&L and work out which of those two numbers is lying.",
  situation:
    "You have joined Kirti Apparel as a financial analyst in the week the FY25 accounts closed. Revenue went from ₹59.7 crore to ₹72.9 crore. Net profit went from ₹4.67 crore to ₹1.77 crore. " +
    "The board meets in a fortnight and three explanations are already circulating: the merchandising head says discounting destroyed the margin, the CFO says overheads have run away, and the founder says the ₹4.6 crore advertising budget bought nothing. " +
    "You have 6 analyst-days to find out which of them is right, then 4 sprints and ₹6 crore to act on it.",
  difficulty: "Easy",

  mentor: {
    persona: "a CFO debriefing a junior financial analyst",
    audience: "analyst",
  },

  teaching: {
    showMetricMap: true,
    primer: {
      intro:
        "A profit and loss statement is one subtraction repeated down the page. Each line takes something away from the one above it, and each subtotal answers a different question about the business. Knowing which subtotal a problem lives above is most of diagnosing it.",
      terms: [
        {
          term: "Revenue",
          plain: "What customers paid you over the period, before anything is taken out.",
          formula: "stores × revenue per store",
          matters:
            "The top line only tells you how much you sold. On its own it says nothing about whether selling it was worth doing — which is exactly the confusion this company is in.",
          driver: "revenue",
        },
        {
          term: "COGS",
          full: "Cost of goods sold",
          plain: "What the things you sold cost you to buy or make — the fabric, the stitching, the freight into the store.",
          formula: "revenue − gross profit",
          matters:
            "It moves with sales. Sell twice as much and it roughly doubles, which is what makes it different from rent.",
        },
        {
          term: "Gross profit",
          plain: "What is left of revenue once you have paid for the goods themselves.",
          formula: "revenue − cost of goods sold",
          matters:
            "The money available to pay for everything else — stores, staff, advertising, head office. If this is not growing, nothing below it can.",
          driver: "grossProfit",
        },
        {
          term: "Gross margin",
          plain: "Gross profit as a share of revenue — how many paise of each rupee of sales survive the cost of the product.",
          formula: "gross profit ÷ revenue",
          matters:
            "A percentage, so it is unaffected by how much you sold. That makes it the right way to ask whether discounting or input costs hurt you — and the wrong way to ask whether the company made money.",
          driver: "grossMarginRate",
        },
        {
          term: "Operating expenses",
          full: "Opex",
          plain: "The cost of running the business rather than of the goods — rent, salaries, advertising, head office.",
          formula: "store costs + advertising + corporate overhead",
          matters:
            "Mostly fixed, which is the whole drama here. A store's rent does not care whether anyone walked in, so opening a store commits you to the cost long before it commits anyone to the revenue.",
          driver: "opex",
        },
        {
          term: "EBITDA",
          full: "Earnings before interest, tax, depreciation and amortisation",
          plain: "What the trading operation earned, before the cost of the money and the wear on the assets.",
          formula: "gross profit − operating expenses",
          matters:
            "The cleanest read on whether the business itself works, because it strips out how it was financed and how the fit-outs are being written down. It is not cash, and it is not profit.",
          driver: "ebitda",
        },
        {
          term: "Depreciation",
          plain: "This year's slice of something you already paid for — a shop fit-out spread across the years it will be used.",
          matters:
            "No money leaves the bank this year, but the profit is genuinely lower. Fourteen new fit-outs is why this line jumped 45%.",
          driver: "depreciation",
        },
        {
          term: "Net profit",
          plain: "What is left after the goods, the running costs, the wear on the assets, the interest and the tax.",
          formula: "EBITDA − depreciation − interest − tax",
          matters:
            "The number the owners keep, and the one on the front page of the board pack. It is five subtractions away from revenue, so 'revenue up, profit down' is a statement about the five, not about the sale.",
          driver: "netProfit",
        },
        {
          term: "Like-for-like",
          full: "LFL, or same-store sales",
          plain: "Comparing only the stores that were open in both years, so the comparison is between the same shops.",
          matters:
            "The single most useful cut in retail. Total revenue rises whenever you open a shop, which tells you nothing about whether the shops are getting better or worse. Every retailer reports this, and this company did not.",
          driver: "matureContribution",
        },
      ],
      worked: [
        "60 stores: 46 open more than a year, 14 opened in April.",
        "A mature store turns over ₹1.42 crore a year; a first-year store turns over ₹0.54 crore — 38% of it.",
        "46 × ₹1.42 cr = ₹65.32 cr, plus 14 × ₹0.54 cr = ₹7.56 cr, giving revenue of ₹72.88 cr.",
        "At a 41.2% gross margin that is ₹30.03 cr of gross profit, against ₹23.47 cr of operating expenses — ₹6.56 cr of EBITDA, and ₹1.77 cr of net profit after ₹2.9 cr of depreciation, ₹1.3 cr of interest and tax.",
        "The question the statement cannot answer on its own: which of those 60 stores earned the ₹6.56 crore, and which spent it?",
      ],
    },
  },

  northStar: "netProfit",
  reported: [
    "revenue",
    "grossMarginRate",
    "ebitda",
    "matureContribution",
    "newContribution",
    "netProfit",
  ],
  drivers: [
    // ── Revenue, split by store maturity. The split is the whole scenario. ──
    { id: "matureStores", kind: "input", label: "Stores open over a year", unit: "count", goodDirection: "up", baseline: 46 },
    { id: "matureRevenuePerStore", kind: "input", label: "Revenue per mature store", unit: "inr", goodDirection: "up", baseline: 1.42 * CRORE },
    { id: "matureRevenue", kind: "product", label: "Revenue — mature stores", unit: "inr", goodDirection: "up", of: ["matureStores", "matureRevenuePerStore"] },
    { id: "newStores", kind: "input", label: "Stores opened this year", unit: "count", goodDirection: "up", baseline: 14 },
    { id: "newRevenuePerStore", kind: "input", label: "Revenue per new store", unit: "inr", goodDirection: "up", baseline: 0.54 * CRORE },
    { id: "newRevenue", kind: "product", label: "Revenue — new stores", unit: "inr", goodDirection: "up", of: ["newStores", "newRevenuePerStore"] },
    { id: "revenue", kind: "sum", label: "Revenue", unit: "inr", goodDirection: "up", of: ["matureRevenue", "newRevenue"] },

    // ── Gross profit, carried through both halves so the like-for-like
    //    contribution lines below are derived rather than asserted. ──
    { id: "grossMarginRate", kind: "input", label: "Gross margin", unit: "ratio", goodDirection: "up", baseline: 0.412 },
    { id: "matureGrossProfit", kind: "product", label: "Gross profit — mature", unit: "inr", goodDirection: "up", of: ["matureRevenue", "grossMarginRate"] },
    { id: "newGrossProfit", kind: "product", label: "Gross profit — new", unit: "inr", goodDirection: "up", of: ["newRevenue", "grossMarginRate"] },
    { id: "grossProfit", kind: "sum", label: "Gross profit", unit: "inr", goodDirection: "up", of: ["matureGrossProfit", "newGrossProfit"] },

    // ── Store costs. Separate rates because the new leases are dearer: they
    //    were signed in today's market, in catchments the chain had to buy
    //    into. That gap is half the reason the fourteen lose money. ──
    { id: "matureCostPerStore", kind: "input", label: "Cost of running a mature store", unit: "inr", goodDirection: "down", baseline: 0.245 * CRORE },
    { id: "matureStoreCost", kind: "product", label: "Store costs — mature", unit: "inr", goodDirection: "down", of: ["matureStores", "matureCostPerStore"] },
    { id: "newCostPerStore", kind: "input", label: "Cost of running a new store", unit: "inr", goodDirection: "down", baseline: 0.3 * CRORE },
    { id: "newStoreCost", kind: "product", label: "Store costs — new", unit: "inr", goodDirection: "down", of: ["newStores", "newCostPerStore"] },
    { id: "storeFixedCost", kind: "sum", label: "Store costs", unit: "inr", goodDirection: "down", of: ["matureStoreCost", "newStoreCost"] },

    /**
     * The two numbers the whole exercise exists to put side by side. Derived,
     * so a retune of any input moves them and they cannot drift out of step
     * with the statement above.
     */
    { id: "matureContribution", kind: "difference", label: "Contribution — mature stores", unit: "inr", goodDirection: "up", minuend: "matureGrossProfit", subtrahend: "matureStoreCost" },
    { id: "newContribution", kind: "difference", label: "Contribution — new stores", unit: "inr", goodDirection: "up", minuend: "newGrossProfit", subtrahend: "newStoreCost" },

    { id: "adSpend", kind: "input", label: "Advertising", unit: "inr", goodDirection: "down", baseline: 4.6 * CRORE },
    { id: "corporateOverhead", kind: "input", label: "Corporate overhead", unit: "inr", goodDirection: "down", baseline: 3.4 * CRORE },
    { id: "opex", kind: "sum", label: "Operating expenses", unit: "inr", goodDirection: "down", of: ["storeFixedCost", "adSpend", "corporateOverhead"] },
    { id: "ebitda", kind: "difference", label: "EBITDA", unit: "inr", goodDirection: "up", minuend: "grossProfit", subtrahend: "opex" },

    { id: "depreciation", kind: "input", label: "Depreciation", unit: "inr", goodDirection: "down", baseline: 2.9 * CRORE },
    { id: "ebit", kind: "difference", label: "Operating profit (EBIT)", unit: "inr", goodDirection: "up", minuend: "ebitda", subtrahend: "depreciation" },
    { id: "interest", kind: "input", label: "Interest", unit: "inr", goodDirection: "down", baseline: 1.3 * CRORE },
    { id: "pbt", kind: "difference", label: "Profit before tax", unit: "inr", goodDirection: "up", minuend: "ebit", subtrahend: "interest" },
    // Nobody in this room can move the corporate tax rate, which is exactly
    // what `constant` is for — the validator will reject an intervention on it.
    { id: "taxRate", kind: "constant", label: "Tax rate", unit: "ratio", goodDirection: "down", value: 0.25 },
    { id: "tax", kind: "product", label: "Tax", unit: "inr", goodDirection: "down", of: ["pbt", "taxRate"] },
    { id: "netProfit", kind: "difference", label: "Net profit", unit: "inr", goodDirection: "up", minuend: "pbt", subtrahend: "tax" },
    { id: "netMargin", kind: "quotient", label: "Net margin", unit: "ratio", goodDirection: "up", numerator: "netProfit", denominator: "revenue" },
  ],

  dashboard: [
    {
      id: "p-pnl-statement",
      kind: "statement",
      statement: "pnl",
      title: "Kirti Apparel — statement of profit and loss",
      caption: "₹ crore. The whole company, as filed.",
      unit: "inr",
      periods: ["FY25", "FY24"],
      sections: [
        {
          lines: [
            { label: "Revenue", value: 72.88 * CRORE, priorValue: 59.7 * CRORE, goodDirection: "up" },
            { label: "Cost of goods sold", value: -42.85 * CRORE, priorValue: -34.27 * CRORE, indent: true },
            // The margin belongs in the note rather than as a line: a statement
            // panel carries one unit, and a percentage rendered in crore reads
            // as ₹41 lakh.
            {
              label: "Gross profit",
              value: 30.03 * CRORE,
              priorValue: 25.43 * CRORE,
              emphasis: true,
              goodDirection: "up",
              note: "A gross margin of 41.2%, against 42.6% last year — 1.4 points lower.",
            },
          ],
        },
        {
          title: "Operating expenses",
          lines: [
            { label: "Store rent, staff and utilities", value: -15.47 * CRORE, priorValue: -10.95 * CRORE, indent: true },
            { label: "Advertising", value: -4.6 * CRORE, priorValue: -2.9 * CRORE, indent: true, note: "Up ₹1.70 cr. The founder wants to know what it bought." },
            { label: "Corporate overhead", value: -3.4 * CRORE, priorValue: -2.6 * CRORE, indent: true },
            { label: "Total operating expenses", value: -23.47 * CRORE, priorValue: -16.45 * CRORE, emphasis: true, goodDirection: "down" },
            { label: "EBITDA", value: 6.56 * CRORE, priorValue: 8.98 * CRORE, emphasis: true, goodDirection: "up" },
          ],
        },
        {
          lines: [
            { label: "Depreciation", value: -2.9 * CRORE, priorValue: -2.0 * CRORE, indent: true, note: "Fourteen new fit-outs, written down over eight years." },
            { label: "Operating profit (EBIT)", value: 3.66 * CRORE, priorValue: 6.98 * CRORE, emphasis: true, goodDirection: "up" },
            { label: "Interest", value: -1.3 * CRORE, priorValue: -0.75 * CRORE, indent: true, note: "The expansion was part debt-funded." },
            { label: "Profit before tax", value: 2.36 * CRORE, priorValue: 6.23 * CRORE, emphasis: true, goodDirection: "up" },
            { label: "Tax", value: -0.59 * CRORE, priorValue: -1.56 * CRORE, indent: true },
            { label: "Net profit", value: 1.77 * CRORE, priorValue: 4.67 * CRORE, emphasis: true, goodDirection: "up" },
          ],
        },
      ],
    },
    {
      id: "p-pnl-headline",
      kind: "stat",
      title: "The two numbers the board will open with",
      tiles: [
        { label: "Revenue", value: 72.88 * CRORE, unit: "inr", deltaPct: 0.221, goodDirection: "up" },
        { label: "Net profit", value: 1.77 * CRORE, unit: "inr", deltaPct: -0.621, goodDirection: "up" },
        { label: "Gross margin", value: 0.412, unit: "ratio", deltaPct: -0.033, goodDirection: "up" },
        { label: "Net margin", value: 0.0243, unit: "ratio", deltaPct: -0.69, goodDirection: "up" },
        { label: "Stores trading", value: 60, unit: "count", deltaPct: 0.304, goodDirection: "up" },
        { label: "EBITDA", value: 6.56 * CRORE, unit: "inr", deltaPct: -0.27, goodDirection: "up" },
      ],
    },
    {
      id: "p-pnl-room",
      kind: "note",
      title: "What the room is saying",
      body:
        "Merchandising head: gross margin fell 1.4 points. We discounted too hard in the end-of-season sale and that is where the profit went.\n" +
        "CFO: overheads are up ₹7 crore on revenue up ₹13 crore. We cannot grow into a cost base that grows faster than we do.\n" +
        "Founder: we spent ₹4.6 crore on advertising, up from ₹2.9 crore, and the profit halved. Cut it back to last year and the problem solves itself.\n" +
        "Nobody in the meeting has separated the 46 stores that traded all of last year from the 14 that opened in April.",
    },
  ],

  budget: { analystDays: 6, sprints: 4, rupees: 6 * CRORE },

  drilldowns: [
    {
      id: "dd-like-for-like",
      label: "Split the P&L by store maturity",
      question: "What do the 46 old stores and the 14 new ones each look like on their own?",
      cost: 3,
      evidenceFor: ["growth.newstores"],
      readsAs:
        "The mature 46 contributed ₹15.64 crore against ₹14.48 crore last year — a better year, not a worse one. The 14 new stores contributed minus ₹1.09 crore. The consolidated statement averaged a healthy business with a loss-making one and reported neither.",
      reveals: [
        {
          id: "p-lfl-statement",
          kind: "statement",
          statement: "pnl",
          title: "The same year, split by when the store opened",
          caption: "₹ crore. Store contribution is gross profit less that store's own rent, staff and utilities.",
          unit: "inr",
          periods: ["46 mature", "14 new"],
          sections: [
            {
              lines: [
                { label: "Revenue", value: 65.32 * CRORE, priorValue: 7.56 * CRORE },
                { label: "Revenue per store", value: 1.42 * CRORE, priorValue: 0.54 * CRORE, indent: true, note: "A first-year store trades at 38% of a mature one." },
                { label: "Gross profit", value: 26.91 * CRORE, priorValue: 3.11 * CRORE, emphasis: true },
                { label: "Store rent, staff and utilities", value: -11.27 * CRORE, priorValue: -4.2 * CRORE, indent: true, note: "₹24.5 lakh per mature store; ₹30 lakh per new one — the new leases were signed in today's market." },
                { label: "Store contribution", value: 15.64 * CRORE, priorValue: -1.09 * CRORE, emphasis: true },
              ],
            },
          ],
        },
        {
          id: "p-lfl-note",
          kind: "note",
          title: "The same cut, against last year",
          body:
            "The 46 mature stores contributed ₹14.48 crore in FY24 and ₹15.64 crore in FY25 — up ₹1.16 crore on a like-for-like basis.\n\n" +
            "Profit before tax fell ₹3.87 crore. Of that: ₹1.09 crore is the new stores' trading loss, ₹0.90 crore is depreciation on their fit-outs, ₹0.55 crore is interest on the debt that funded them, and ₹1.20 crore of the advertising increase was the campaign that launched them. The mature estate offset ₹1.16 crore of it. Corporate overhead and the residual advertising account for the rest.",
        },
      ],
    },
    {
      id: "dd-store-ramp",
      label: "Revenue by months since opening",
      question: "Is a first-year store supposed to look like this?",
      cost: 2,
      evidenceFor: ["growth.newstores"],
      readsAs:
        "Every store the chain has ever opened follows the same curve — 36% of mature revenue in year one, 61% in year two, 89% in year three. The 14 are at 38%. They are not underperforming; they are new, and the plan treated them as though they would not be.",
      reveals: [
        {
          id: "p-store-ramp",
          kind: "timeseries",
          title: "Every store the chain has opened since FY18",
          caption: "Revenue as a share of a mature store, averaged across 31 openings.",
          series: [
            {
              label: "Share of mature-store revenue",
              unit: "ratio",
              points: [
                { period: "Mth 3", value: 0.24 },
                { period: "Mth 6", value: 0.31 },
                { period: "Mth 12", value: 0.36 },
                { period: "Mth 18", value: 0.49 },
                { period: "Mth 24", value: 0.61 },
                { period: "Mth 36", value: 0.89 },
                { period: "Mth 48", value: 1.0 },
              ],
            },
          ],
        },
      ],
    },
    {
      id: "dd-margin-bridge",
      label: "Where the 1.4 points of gross margin went",
      question: "Was the margin fall discounting, input costs, or something else?",
      cost: 2,
      evidenceFor: ["costs.cogs", "growth.mix"],
      readsAs:
        "Half a point of it is fabric, half a point is the end-of-season sale, and 0.4 points is simply that new stores sell a higher share of basics. Worth ₹1.02 crore in total, against a ₹2.90 crore fall in profit. Real, and not the story.",
      reveals: [
        {
          id: "p-margin-bridge",
          kind: "segments",
          title: "FY24 to FY25 gross margin bridge",
          dimension: "Driver",
          rows: [
            { label: "Fabric and trim cost", value: -0.005, unit: "ratio" },
            { label: "End-of-season discounting", value: -0.005, unit: "ratio" },
            { label: "Mix — new stores skew to basics", value: -0.004, unit: "ratio" },
            { label: "Freight and shrinkage", value: 0.0, unit: "ratio" },
          ],
        },
      ],
    },
    {
      id: "dd-opex-lines",
      label: "Overheads line by line",
      question: "Which overhead actually grew, and did it grow with the stores or beyond them?",
      cost: 2,
      evidenceFor: ["costs.opex"],
      readsAs:
        "Store costs grew 41% against a store count up 30% — the gap is the dearer new leases, not slack. Corporate overhead grew ₹0.80 crore, which is the only line growing genuinely faster than the business.",
      reveals: [
        {
          id: "p-opex-lines",
          kind: "statement",
          statement: "pnl",
          title: "Operating expenses, FY25 against FY24",
          caption: "₹ crore.",
          unit: "inr",
          periods: ["FY25", "FY24"],
          sections: [
            {
              title: "Store costs",
              lines: [
                { label: "Rent", value: 9.12 * CRORE, priorValue: 6.38 * CRORE, goodDirection: "down" },
                { label: "Store salaries", value: 4.86 * CRORE, priorValue: 3.51 * CRORE, goodDirection: "down" },
                { label: "Utilities and upkeep", value: 1.49 * CRORE, priorValue: 1.06 * CRORE, goodDirection: "down" },
                { label: "Total store costs", value: 15.47 * CRORE, priorValue: 10.95 * CRORE, emphasis: true, goodDirection: "down", note: "Up 41% on a store count up 30%." },
              ],
            },
            {
              title: "Above the store",
              lines: [
                { label: "Advertising", value: 4.6 * CRORE, priorValue: 2.9 * CRORE, goodDirection: "down" },
                { label: "Head office salaries", value: 2.11 * CRORE, priorValue: 1.66 * CRORE, goodDirection: "down" },
                { label: "Technology and professional fees", value: 1.29 * CRORE, priorValue: 0.94 * CRORE, goodDirection: "down" },
                { label: "Total above the store", value: 8.0 * CRORE, priorValue: 5.5 * CRORE, emphasis: true, goodDirection: "down" },
              ],
            },
          ],
        },
      ],
    },
    {
      id: "dd-ad-attribution",
      label: "What the advertising bought",
      question: "Is the ₹4.6 crore of advertising working?",
      cost: 2,
      evidenceFor: ["costs.opex"],
      readsAs:
        "₹1.20 crore of the increase was launch marketing in the 14 new catchments, where footfall runs 22% above the openings that got no campaign. Cutting the budget back to ₹2.9 crore cuts that first.",
      reveals: [
        {
          id: "p-ad-attribution",
          kind: "segments",
          title: "Advertising, ₹4.6 crore",
          dimension: "Where it went",
          rows: [
            { label: "New-catchment launch campaigns", value: 1.2 * CRORE, unit: "inr" },
            { label: "Always-on brand and performance", value: 2.9 * CRORE, unit: "inr" },
            { label: "End-of-season sale", value: 0.5 * CRORE, unit: "inr" },
          ],
        },
        {
          id: "p-ad-note",
          kind: "note",
          title: "The 2023 openings, which got no launch campaign",
          body:
            "Six stores opened in FY23 without a launch budget. Their first-year footfall ran 22% below the FY25 cohort's, and they took an extra seven months to reach the same share of mature revenue. The launch spend is buying the ramp, not the brand.",
        },
      ],
    },
    {
      id: "dd-price-test",
      label: "The nine stores that trialled a price rise",
      question: "Could we simply charge more?",
      cost: 2,
      evidenceFor: ["growth.mix"],
      readsAs:
        "Nine stores took 6% on ticket prices for a quarter. Gross margin rose 3.5 points and units fell 11% — gross profit moved less than 1%. There is very little here.",
      reveals: [
        {
          id: "p-price-test",
          kind: "segments",
          title: "Nine-store price trial, Q3 FY25",
          caption: "Trial stores against matched control stores. Levels indexed to the controls.",
          dimension: "Effect of a 6% price rise",
          rows: [
            { label: "Gross margin", value: 0.447, unit: "ratio", deltaPct: 0.085 },
            { label: "Units sold", value: 0.89, unit: "multiple", deltaPct: -0.11 },
            { label: "Revenue", value: 0.983, unit: "multiple", deltaPct: -0.017 },
            { label: "Gross profit", value: 1.009, unit: "multiple", deltaPct: 0.009 },
          ],
        },
      ],
    },
  ],

  causes: [
    { id: "growth", parentId: null, label: "The way we grew", verdict: "The right place to look." },
    {
      id: "growth.newstores",
      parentId: "growth",
      label: "The 14 new stores carry a full cost base and a third of the revenue",
      verdict:
        "This was it. Fourteen stores opened in April on dearer leases, trading at 38% of a mature store because that is what a first-year store does. Together they contributed minus ₹1.09 crore, plus ₹0.90 crore of fit-out depreciation and ₹0.55 crore of interest on the debt that paid for them. The 46 mature stores had a better year than last year.",
    },
    {
      id: "growth.mix",
      parentId: "growth",
      label: "We are selling a worse mix at worse prices",
      verdict:
        "Worth 0.9 points of the 1.4-point margin fall, or about ₹0.65 crore. Real, and a fifth of the problem. The nine-store price trial moved gross profit by less than 1%, so there is not much to recover here either.",
    },
    { id: "costs", parentId: null, label: "The cost base", verdict: "Grew about as fast as it was always going to." },
    {
      id: "costs.opex",
      parentId: "costs",
      label: "Overheads have run away from us",
      verdict:
        "Store costs grew 41% on a store count up 30% — the gap is dearer new leases, which is a fact about the expansion rather than about slack. Corporate overhead is the only line genuinely outgrowing the business, at ₹0.80 crore. The advertising increase was mostly the launch campaigns that are buying the ramp.",
    },
    {
      id: "costs.cogs",
      parentId: "costs",
      label: "Input costs ate the gross margin",
      verdict:
        "Half a point of the 1.4, or about ₹0.36 crore. A supplier renegotiation is worth having and would not have made this year's board pack read differently.",
    },
  ],
  trueCauseIds: ["growth.newstores"],

  interventions: [
    {
      id: "iv-ramp-new",
      label: "Put a ramp plan behind the 14 new stores",
      pitch:
        "Range the new catchments properly, staff them to the local footfall pattern, and run the local marketing the FY23 openings never got. Pull the second-year curve forward.",
      addresses: "growth.newstores",
      cost: { sprints: 2, rupees: 2.4 * CRORE },
      minSprints: 2,
      effects: {
        // 38% of a mature store's revenue to about 59% — the year-two point on
        // the ramp curve, reached a year early. Deliberately not year three:
        // this buys time, it does not make a new store mature.
        whenRootCause: [{ driver: "newRevenuePerStore", deltaPct: 0.55, rampQuarters: 3 }],
        otherwise: [{ driver: "newRevenuePerStore", deltaPct: 0.12, rampQuarters: 3 }],
      },
      debrief:
        "The growth half of the answer. It does not argue with the cost base — it accepts that a new store is a two-year investment and shortens the two years, which is the only lever that turns the fourteen from a drag into the thing that was bought.",
    },
    {
      id: "iv-renegotiate-leases",
      label: "Move the 14 new leases to revenue share",
      pitch:
        "Reopen the new leases and swap fixed rent for a percentage of turnover. Landlords in these catchments have empty units and will take the deal.",
      addresses: "growth.newstores",
      cost: { sprints: 2, rupees: 2.2 * CRORE },
      minSprints: 2,
      effects: {
        whenRootCause: [{ driver: "newCostPerStore", deltaPct: -0.35, rampQuarters: 2 }],
        otherwise: [{ driver: "newCostPerStore", deltaPct: -0.1, rampQuarters: 2 }],
      },
      debrief:
        "The cost half, and the more elegant of the two. A first-year store's problem is that its rent does not know it is a first-year store; a revenue-share lease makes the largest fixed cost behave like a variable one for exactly as long as the store needs it to.",
    },
    {
      id: "iv-cut-ads",
      label: "Cut advertising back to last year's ₹2.9 crore",
      pitch:
        "The founder's proposal. ₹1.70 crore of new spend appeared this year and the profit halved. Take it back out.",
      addresses: "costs.opex",
      cost: { sprints: 1, rupees: 0.4 * CRORE },
      effects: {
        whenRootCause: [{ driver: "adSpend", deltaPct: -0.37 }],
        otherwise: [
          { driver: "adSpend", deltaPct: -0.37 },
          // What the money was actually holding up. The new stores lose most,
          // because ₹1.2 cr of the cut is their launch campaign.
          { driver: "matureRevenuePerStore", deltaPct: -0.045 },
          { driver: "newRevenuePerStore", deltaPct: -0.14 },
        ],
      },
      debrief:
        "Cheap, fast, and almost exactly self-cancelling: ₹1.70 crore saved against ₹1.65 crore of gross profit given up. It also takes the launch campaigns away from the fourteen stores that need them most, so the gross margin percentage improves while the thing that was actually wrong gets worse.",
    },
    {
      id: "iv-price-up",
      label: "Take 6% on ticket prices across the range",
      pitch:
        "The trial in nine stores lifted gross margin 3.5 points. Roll it out and recover the margin the sale gave away.",
      addresses: "growth.mix",
      cost: { sprints: 1, rupees: 0.6 * CRORE },
      effects: {
        whenRootCause: [{ driver: "grossMarginRate", deltaPct: 0.085 }],
        otherwise: [
          { driver: "grossMarginRate", deltaPct: 0.085 },
          { driver: "matureRevenuePerStore", deltaPct: -0.07 },
          { driver: "newRevenuePerStore", deltaPct: -0.09 },
        ],
      },
      debrief:
        "The trial already told you the answer and the room read it as a margin result: 3.5 points of margin on 11% fewer units moved gross profit by 0.9%. It hurts the new stores most, which are the ones still buying their catchment.",
    },
    {
      id: "iv-supplier",
      label: "Renegotiate fabric and trim supply",
      pitch:
        "Consolidate to four mills on annual volumes and take half a point back on input cost.",
      addresses: "costs.cogs",
      cost: { sprints: 1, rupees: 0.8 * CRORE },
      effects: {
        whenRootCause: [{ driver: "grossMarginRate", deltaPct: 0.032 }],
        otherwise: [{ driver: "grossMarginRate", deltaPct: 0.032 }],
      },
      debrief:
        "Genuinely good housekeeping and genuinely too small: about ₹0.96 crore of gross profit against a ₹2.90 crore fall in net profit. Worth doing in a year when it is not the answer being presented to a board.",
    },
  ],

  // Rents escalate on schedule and a store left alone ramps slower than one
  // that is being worked on, so standing still costs money.
  drift: [
    { driver: "newRevenuePerStore", deltaPct: -0.02 },
    { driver: "matureCostPerStore", deltaPct: 0.015 },
    { driver: "newCostPerStore", deltaPct: 0.015 },
  ],
  horizonQuarters: 4,
  periodNoun: "quarter",

  parInvestigation: ["dd-like-for-like", "dd-store-ramp"],
  bestAllocation: [
    { interventionId: "iv-ramp-new", sprints: 2, rupees: 2.4 * CRORE },
    { interventionId: "iv-renegotiate-leases", sprints: 2, rupees: 2.2 * CRORE },
  ],

  debrief: {
    causalChain: [
      "The company opened 14 stores in April, taking the estate from 46 to 60.",
      "A first-year apparel store trades at about 36% of a mature one — every one of the 31 stores this chain has opened since FY18 followed that curve.",
      "The 14 turned over ₹0.54 crore each against ₹1.42 crore for a mature store, on leases costing ₹30 lakh a year against ₹24.5 lakh, because they were signed in today's market.",
      "Together they contributed minus ₹1.09 crore, and brought ₹0.90 crore of fit-out depreciation, ₹0.55 crore of interest and ₹1.20 crore of launch advertising with them.",
      "The 46 mature stores contributed ₹15.64 crore against ₹14.48 crore last year — on a like-for-like basis the business improved.",
      "Consolidated, those two facts average into 'revenue up 22%, profit down 62%', which describes neither of them.",
    ],
    whereTheLeverageWas:
      "The fourteen stores, on both sides of their own P&L: pull their revenue up the ramp curve faster, and stop their rent behaving like a mature store's while they are not one. Everything the room proposed was aimed at the 46 stores that were already having a good year — and the advertising cut would have taken the launch campaigns away from exactly the fourteen that needed them.",
    strongAnswer:
      "Do not diagnose a consolidated P&L. Revenue rose 22% because the store count rose 30%, so the first thing to establish is whether the shops got worse or whether there are simply more of them — which means splitting the statement into stores that traded in both years and stores that did not. Done that way, the 46 mature stores contributed ₹15.64 crore against ₹14.48 crore: a better year. The 14 new ones contributed minus ₹1.09 crore, and carried ₹0.90 crore of depreciation, ₹0.55 crore of interest and ₹1.20 crore of launch marketing besides. That is essentially the whole ₹2.90 crore fall in net profit. It is also not a problem in the sense the board means: every store this chain has opened reached 36% of mature revenue in year one and 61% in year two, so these are on curve, and the plan simply budgeted as though they would not be. So the answer is not to cut — it is to shorten the ramp and to stop paying mature rent on immature stores, which is what a revenue-share lease does. The margin story is real and small: 1.4 points, about ₹1 crore, and the price trial showed 3.5 points of margin on 11% fewer units is worth under 1% of gross profit. The advertising cut is the expensive one, because ₹1.20 crore of that budget is the only thing pulling the fourteen up the curve.",
  },

  coachFallback: [
    {
      topic: ["like for like", "like-for-like", "lfl", "same store", "mature", "split", "new stores"],
      answer:
        "Splitting the P&L was the whole exercise. The 46 mature stores contributed ₹15.64 crore against ₹14.48 crore last year — up ₹1.16 crore like-for-like. The 14 new stores contributed minus ₹1.09 crore. Consolidated, those average into a company that looks like it is falling apart.",
    },
    {
      topic: ["ramp", "curve", "first year", "immature", "38%", "new store revenue"],
      answer:
        "Every one of the 31 stores this chain has opened since FY18 reached about 36% of mature revenue in year one, 61% in year two and 89% in year three. The fourteen are at 38%. They are on curve — the plan was not.",
    },
    {
      topic: ["gross margin", "1.4 points", "discount", "discounting", "cogs", "fabric", "input cost"],
      answer:
        "Gross margin fell 1.4 points: half a point of fabric cost, half a point of end-of-season discounting and 0.4 points of mix as new stores sell more basics. That is about ₹1 crore against a ₹2.90 crore fall in net profit — real, and a third of the story at most.",
    },
    {
      topic: ["advertising", "ad spend", "4.6", "cut ads", "founder", "marketing"],
      answer:
        "Cutting advertising to ₹2.9 crore saves ₹1.70 crore and gives back about ₹1.65 crore of gross profit, so it is very nearly self-cancelling. Worse, ₹1.20 crore of that budget is launch marketing in the 14 new catchments — the FY23 openings that got no campaign ran 22% lower footfall and took seven extra months to ramp.",
    },
    {
      topic: ["overhead", "opex", "corporate", "cfo", "cost base", "rent"],
      answer:
        "Store costs grew 41% on a store count up 30%; the gap is that the new leases cost ₹30 lakh a year against ₹24.5 lakh for a mature one. Corporate overhead is the only line genuinely outgrowing the business, and it is ₹0.80 crore of a ₹2.90 crore problem.",
    },
    {
      topic: ["price", "price rise", "6%", "trial", "charge more"],
      answer:
        "The nine-store trial is the answer to that: 6% on tickets lifted gross margin 3.5 points and cost 11% of units, moving gross profit less than 1%. And it lands hardest on the new stores, which are still buying their catchment.",
    },
    {
      topic: ["lease", "revenue share", "renegotiate", "landlord"],
      answer:
        "The revenue-share lease is the cost half of the answer. A first-year store's problem is that its rent does not know it is a first-year store — moving to a percentage of turnover makes the biggest fixed cost variable for exactly as long as the store needs it to be.",
    },
    {
      topic: ["depreciation", "interest", "below the line", "ebitda"],
      answer:
        "Depreciation rose ₹0.90 crore and interest ₹0.55 crore, and both are the fourteen stores: their fit-outs are being written down over eight years and the debt that paid for them is being serviced. That is ₹1.45 crore of the ₹2.90 crore fall sitting below EBITDA, which is why EBITDA alone under-reports what the expansion cost.",
    },
  ],
};
