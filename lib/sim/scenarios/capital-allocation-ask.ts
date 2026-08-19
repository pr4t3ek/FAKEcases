/**
 * "Record EBITDA, and the CEO wants a hundred crore more."
 *
 * The fourth finance scenario, and the first whose question is about the
 * FUTURE. The three before it ask a student to read a statement that has
 * already been printed. This one hands them a decision that has not been taken
 * yet: the board is about to ask a bank to fund an acquisition, and the analyst
 * has one evening to work out whether it should.
 *
 * ── What separates this from balance-sheet-leverage ───────────────────────
 *
 * Deccan Ceramics asks "why is our record EBITDA a problem?" — a diagnosis of
 * capital already sunk, judged on the AVERAGE return. Here the capex is a
 * settled fact and explicitly not the question. The question is whether to do
 * it again, and the average return cannot answer it.
 *
 * The test is the INCREMENTAL one:
 *
 *     change in EBIT / change in capital employed
 *       = 5.0 cr / 300.0 cr = 1.7%, against debt costing 10.1%.
 *
 * The average ROCE of 8.9% is itself flattering, because the legacy business is
 * holding it up. The marginal return is what decides a marginal deployment, and
 * it is the one number the CEO's deck does not contain.
 *
 * **The lesson: an average return judges the past; an incremental return
 * decides the next rupee.**
 *
 * ── The truth, for whoever maintains this ─────────────────────────────────
 *
 * A 300 crore automated stamping line was commissioned in FY26 on a five-year
 * syndicated term loan. It runs at 38% against a plan of 75%, because the OEM
 * platform it was built for slipped a model year. Capital employed went from
 * 150.0 crore to 450.0 crore; operating profit went from 35.0 crore to 40.0
 * crore. So ROCE fell from 23.3% to 8.9%, and decomposed, the EBIT margin
 * barely moved — 10.9% to 10.0% — while capital turnover fell from 2.13 to
 * 0.89. As at Deccan, the problem is entirely in the denominator; unlike
 * Deccan, knowing that is only half the answer, because the decision on the
 * table is to enlarge the denominator again.
 *
 * The second gate is the covenant. Interest cover is 1.14x against a 2.00x
 * test. Even a target earning an honest 8% cannot be funded, because there is
 * no interest headroom to fund anything with.
 *
 * ── Balance notes ─────────────────────────────────────────────────────────
 *
 * Three interventions must never move the north star, and each is authored to
 * be a genuinely defensible idea:
 *
 *   - **The acquisition** is the trap, and it has to stay attractive. It is
 *     modelled on the CEO's own optimistic numbers — 100 crore buys 55 crore of
 *     revenue and 8.0 crore of EBIT, absorbed into existing overhead. That is
 *     an 8% return, which sounds respectable and is below the 10.1% it would be
 *     borrowed at. It must LOWER the spread. If a retune ever lets it raise the
 *     spread, the scenario has no point.
 *   - **The refinance** takes the five-year loan out to ten. It moves capital
 *     employed by exactly nothing, so the spread does not move at all, and the
 *     0.7 point of extra coupon makes interest cover slightly WORSE. The
 *     teaching point is that stretching a tenor buys debt-service headroom,
 *     which EBIT / interest cannot see — it fixes DSCR, not ICR.
 *   - **The rights issue** repays 80 crore of debt with 80 crore of equity.
 *     Debt to equity falls from 3.34x to 1.45x, interest cover nearly doubles,
 *     and capital employed is unchanged to the rupee, because capital employed
 *     is equity PLUS debt.
 *
 * The driver graph models the ratios rather than a fully articulated balance
 * sheet, exactly as its sibling does: an intervention that releases stock does
 * not automatically post the other side of the entry. The accounting identity
 * is asserted on the authored balance-sheet panel and pinned by
 * `tests/sim-scenario.test.ts`, and the asset-sale effects are sized so both
 * sides do match, because there it was free to do so.
 */

import type { SimScenario } from "../types";

const CRORE = 10_000_000;

export const capitalAllocationAsk: SimScenario = {
  slug: "capital-allocation-ask",
  title: "Pragati Precision: record EBITDA, and the CEO wants a hundred crore more",
  company: "Pragati Precision Engineering",
  premise:
    "An auto-components maker posted its best ever EBITDA and is about to ask a bank to fund an acquisition. Work out what the credit officer will see before the meeting does.",
  situation:
    "You are the lead FP&A analyst at Pragati Precision Engineering, a Pune auto-components maker that commissioned a fully automated stamping line in FY26 on a syndicated five-year term loan. FY26 EBITDA came in at Rs 67.5 crore, up 35% and the best in the company's history, on revenue that crossed Rs 400 crore. " +
    "The CEO has the pitch deck open. Tomorrow morning they walk into a tier-1 corporate bank to request a Rs 100 crore facility to buy a competitor. " +
    "The auditor has flagged a jump in current liabilities, the debt moratorium ended last month, and nobody in the room has divided the operating profit by the capital it took to earn. " +
    "You have 6 analyst-days before the meeting — three questions, out of eight worth asking — then 5 people-weeks and Rs 18 crore of your own budget to act on what you find.",
  difficulty: "Hard",

  mentor: {
    persona: "a CFO debriefing a junior FP&A analyst the night before a bank meeting",
    audience: "analyst",
  },

  teaching: {
    // Hidden deliberately. On the finance track's capstone, the shape of the
    // answer — that a return splits into a margin and a turnover, and that the
    // marginal one is a different number from the average — is the thing the
    // candidate is here to find. The primer still ships, so nobody is asked to
    // use a word they were never given.
    showMetricMap: false,
    primer: {
      intro:
        "EBITDA is what a year's trading produced before anyone paid for the machine that produced it. Depreciation is the machine wearing out and interest is the money that bought it, and EBITDA is defined as the number you get before subtracting either. That is not a flaw — it is a useful measure of trading. It becomes a lie the moment it is used to judge an expansion, because the entire cost of an expansion lives in the two lines it excludes.",
      terms: [
        {
          term: "Capital employed",
          plain: "All the money tied up in the business, from owners and lenders alike.",
          formula: "shareholders' equity + total debt",
          matters:
            "The denominator everybody forgets. Building capacity always raises it, and if profit does not rise with it, the business has got worse while looking bigger.",
          driver: "capitalEmployed",
        },
        {
          term: "ROCE",
          full: "Return on capital employed",
          plain: "The operating profit earned for each rupee of capital in the business.",
          formula: "EBIT / capital employed",
          matters:
            "The one number that judges an expansion. Below what the capital costs, the company is destroying value while growing.",
          driver: "roce",
        },
        {
          term: "Cost of capital",
          plain: "What the money in the business has to earn before anyone is better off for having lent or invested it.",
          matters:
            "A return is not good or bad on its own — it is good or bad against this. Pragati borrows at 10.1% and carries a blended cost of capital of about 11%.",
          driver: "costOfCapital",
        },
        {
          term: "The spread",
          full: "Economic spread",
          plain: "The return on capital minus the cost of that capital.",
          formula: "ROCE - cost of capital",
          matters:
            "Positive and the company creates value for its owners; negative and it destroys value however fast it grows. This is the number the run is judged on.",
          driver: "roceSpread",
        },
        {
          term: "Incremental return on capital",
          plain: "The return earned by the NEW money only, rather than by all the money.",
          formula: "change in EBIT / change in capital employed",
          matters:
            "The single most important idea here. An average return is a verdict on everything the company has ever built; an incremental return is a verdict on the last thing it built — and it is the honest forecast of what the next thing will earn. A company with a decent average and a terrible incremental return is about to become a company with a terrible average.",
        },
        {
          term: "Interest cover",
          full: "ICR, interest coverage ratio",
          plain: "How many times over the operating profit would pay the year's interest bill.",
          formula: "EBIT / interest",
          matters:
            "The covenant most loan agreements actually turn on, and the gate on any new borrowing. Below the agreed multiple a lender can call the loan, whatever the profit says.",
          driver: "interestCover",
        },
        {
          term: "Debt service cover",
          full: "DSCR",
          plain: "The same test, with the principal repayments added to the interest.",
          formula: "operating cash flow / (interest + principal due)",
          matters:
            "The distinction that makes refinancing look like a fix when it is not. Stretching a five-year loan to ten years cuts the principal falling due, so DSCR improves a lot — and interest cover, which never contained principal, does not improve at all.",
        },
        {
          term: "Capital turnover",
          plain: "How much revenue each rupee of capital employed generates in a year.",
          formula: "revenue / capital employed",
          matters:
            "The other half of a return. Two companies can earn the same margin and post completely different returns because one sweats its capital twice as hard.",
          driver: "capitalTurnover",
        },
        {
          term: "Margin x turnover",
          full: "The DuPont decomposition",
          plain: "Any return breaks into how much you make per rupee of sales, times how many rupees of sales each rupee of capital produces.",
          formula: "ROCE = (EBIT / revenue) x (revenue / capital employed)",
          matters:
            "It says which half of the problem you have. A margin problem and a turnover problem look identical in the ratio and have nothing in common as decisions.",
          driver: "ebitMargin",
        },
      ],
      worked: [
        "Capital employed: Rs 103.8 cr of equity plus Rs 346.2 cr of debt = Rs 450.0 cr, against Rs 150.0 cr a year ago.",
        "ROCE: Rs 40.0 cr of EBIT / Rs 450.0 cr = 8.9%, against 23.3% last year.",
        "Decomposed: an EBIT margin of 10.0% (Rs 40.0 cr / Rs 400 cr) x a capital turnover of 0.89 (Rs 400 cr / Rs 450.0 cr) = 8.9%. Last year that was 10.9% x 2.13 = 23.3%.",
        "The margin fell by nine-tenths of a point. The turnover fell by 58%.",
        "Now the incremental one. EBIT rose Rs 5.0 cr. Capital employed rose Rs 300.0 cr. Rs 5.0 / Rs 300.0 = 1.7%, against debt costing 10.1%.",
        "Interest cover: Rs 40.0 cr / Rs 35.0 cr = 1.14x, against 7.0x last year and a covenant set at 2.00x.",
      ],
    },
  },

  northStar: "roceSpread",
  reported: [
    "roce",
    "interestCover",
    "capitalTurnover",
    "ebitMargin",
    "ebit",
    "netProfit",
  ],

  drivers: [
    // -- Trading --
    { id: "revenue", kind: "input", label: "Revenue", unit: "inr", goodDirection: "up", baseline: 400 * CRORE },
    { id: "cogsRate", kind: "input", label: "Cost of goods, as a share of revenue", unit: "ratio", goodDirection: "down", baseline: 0.742 },
    { id: "cogs", kind: "product", label: "Cost of goods sold", unit: "inr", goodDirection: "down", of: ["revenue", "cogsRate"] },
    { id: "grossProfit", kind: "difference", label: "Gross profit", unit: "inr", goodDirection: "up", minuend: "revenue", subtrahend: "cogs" },
    { id: "opex", kind: "input", label: "Operating expenses", unit: "inr", goodDirection: "down", baseline: 35.7 * CRORE },
    { id: "ebitda", kind: "difference", label: "EBITDA", unit: "inr", goodDirection: "up", minuend: "grossProfit", subtrahend: "opex" },
    { id: "ebitdaMargin", kind: "quotient", label: "EBITDA margin", unit: "ratio", goodDirection: "up", numerator: "ebitda", denominator: "revenue" },
    { id: "depreciation", kind: "input", label: "Depreciation", unit: "inr", goodDirection: "down", baseline: 27.5 * CRORE },
    { id: "ebit", kind: "difference", label: "Operating profit (EBIT)", unit: "inr", goodDirection: "up", minuend: "ebitda", subtrahend: "depreciation" },

    // -- Working capital. Not in capital employed, which is the point of the
    //    smaller branch: releasing it only helps the return to the extent it
    //    repays the facility. --
    { id: "cash", kind: "input", label: "Cash", unit: "inr", goodDirection: "up", baseline: 6.0 * CRORE },
    { id: "receivables", kind: "input", label: "Receivables", unit: "inr", goodDirection: "down", baseline: 78.0 * CRORE },
    { id: "inventory", kind: "input", label: "Inventory", unit: "inr", goodDirection: "down", baseline: 64.0 * CRORE },
    { id: "otherCurrentAssets", kind: "input", label: "Other current assets", unit: "inr", goodDirection: "up", baseline: 8.0 * CRORE },
    { id: "currentAssets", kind: "sum", label: "Current assets", unit: "inr", goodDirection: "up", of: ["cash", "receivables", "inventory", "otherCurrentAssets"] },

    { id: "payables", kind: "input", label: "Payables", unit: "inr", goodDirection: "up", baseline: 46.0 * CRORE },
    { id: "shortTermDebt", kind: "input", label: "Working-capital facility", unit: "inr", goodDirection: "down", baseline: 44.2 * CRORE },
    { id: "currentPortionLtd", kind: "input", label: "Term loan due within a year", unit: "inr", goodDirection: "down", baseline: 72.0 * CRORE },
    { id: "otherCurrentLiabs", kind: "input", label: "Other current liabilities", unit: "inr", goodDirection: "down", baseline: 4.0 * CRORE },
    { id: "currentLiabilities", kind: "sum", label: "Current liabilities", unit: "inr", goodDirection: "down", of: ["payables", "shortTermDebt", "currentPortionLtd", "otherCurrentLiabs"] },
    { id: "currentRatio", kind: "quotient", label: "Current ratio", unit: "multiple", goodDirection: "up", numerator: "currentAssets", denominator: "currentLiabilities" },

    // -- The capital side --
    { id: "netFixedAssets", kind: "input", label: "Property, plant and equipment", unit: "inr", goodDirection: "up", baseline: 372 * CRORE },
    { id: "totalAssets", kind: "sum", label: "Total assets", unit: "inr", goodDirection: "up", of: ["currentAssets", "netFixedAssets"] },
    { id: "longTermDebt", kind: "input", label: "Term loan due after a year", unit: "inr", goodDirection: "down", baseline: 230 * CRORE },
    { id: "totalDebt", kind: "sum", label: "Total debt", unit: "inr", goodDirection: "down", of: ["longTermDebt", "shortTermDebt", "currentPortionLtd"] },
    { id: "equity", kind: "input", label: "Shareholders' equity", unit: "inr", goodDirection: "up", baseline: 103.8 * CRORE },
    { id: "debtToEquity", kind: "quotient", label: "Debt to equity", unit: "multiple", goodDirection: "down", numerator: "totalDebt", denominator: "equity" },
    { id: "capitalEmployed", kind: "sum", label: "Capital employed", unit: "inr", goodDirection: "down", of: ["equity", "totalDebt"] },

    // -- The return, and what it has to clear --
    { id: "roce", kind: "quotient", label: "Return on capital employed", unit: "ratio", goodDirection: "up", numerator: "ebit", denominator: "capitalEmployed" },
    { id: "ebitMargin", kind: "quotient", label: "EBIT margin", unit: "ratio", goodDirection: "up", numerator: "ebit", denominator: "revenue" },
    { id: "capitalTurnover", kind: "quotient", label: "Capital turnover", unit: "multiple", goodDirection: "up", numerator: "revenue", denominator: "capitalEmployed" },
    /**
     * A `constant`, not an `input`, and that distinction is doing real work:
     * `validateScenario` refuses an intervention aimed at a constant, so no
     * retune can ever let a student close the gap by improving their own cost
     * of capital rather than by earning a return.
     */
    { id: "costOfCapital", kind: "constant", label: "Cost of capital", unit: "ratio", goodDirection: "down", value: 0.11 },
    /**
     * The north star, and a `difference` rather than a second quotient.
     *
     * It moves exactly as `roce` does, so it scores identically — but the
     * outcome report then shows the number the scenario is actually about:
     * whether the return clears what the money costs. A bare 8.9% invites the
     * reading "single digits, could be better". Minus 2.1% does not.
     */
    { id: "roceSpread", kind: "difference", label: "Return less cost of capital", unit: "ratio", goodDirection: "up", minuend: "roce", subtrahend: "costOfCapital" },

    // -- The cost of the debt, and the covenant it is tested against --
    { id: "interestRate", kind: "input", label: "Average cost of debt", unit: "ratio", goodDirection: "down", baseline: 0.1011 },
    { id: "interest", kind: "product", label: "Interest", unit: "inr", goodDirection: "down", of: ["totalDebt", "interestRate"] },
    { id: "interestCover", kind: "quotient", label: "Interest cover", unit: "multiple", goodDirection: "up", numerator: "ebit", denominator: "interest" },

    { id: "pbt", kind: "difference", label: "Profit before tax", unit: "inr", goodDirection: "up", minuend: "ebit", subtrahend: "interest" },
    { id: "taxRate", kind: "constant", label: "Tax rate", unit: "ratio", goodDirection: "down", value: 0.25 },
    { id: "tax", kind: "product", label: "Tax", unit: "inr", goodDirection: "down", of: ["pbt", "taxRate"] },
    { id: "netProfit", kind: "difference", label: "Net profit", unit: "inr", goodDirection: "up", minuend: "pbt", subtrahend: "tax" },
  ],

  dashboard: [
    {
      id: "p-ca-pnl",
      kind: "statement",
      statement: "pnl",
      title: "The trading year the CEO wants to lead with",
      caption: "Rs crore. Every line of this is true.",
      unit: "inr",
      periods: ["FY26", "FY25"],
      sections: [
        {
          lines: [
            { label: "Revenue", value: 400.0 * CRORE, priorValue: 320.0 * CRORE, goodDirection: "up" },
            { label: "EBITDA", value: 67.5 * CRORE, priorValue: 50.0 * CRORE, emphasis: true, goodDirection: "up", note: "Up 35%. The best in the company's history, and the number on slide 3 of the pitch deck." },
            { label: "Depreciation", value: -27.5 * CRORE, priorValue: -15.0 * CRORE, indent: true, note: "The new line came on the books in June. This is what it costs to own, before anything is paid to the lenders." },
            { label: "Operating profit (EBIT)", value: 40.0 * CRORE, priorValue: 35.0 * CRORE, emphasis: true, goodDirection: "up", note: "Up 14%, on revenue up 25% and EBITDA up 35%." },
            { label: "Interest", value: -35.0 * CRORE, priorValue: -5.0 * CRORE, indent: true, goodDirection: "down", note: "Up 600%. The moratorium ended and the full coupon is now running." },
            { label: "Profit before tax", value: 5.0 * CRORE, priorValue: 30.0 * CRORE, emphasis: true, goodDirection: "up" },
            { label: "Net profit", value: 3.75 * CRORE, priorValue: 22.5 * CRORE, emphasis: true, goodDirection: "up" },
          ],
        },
      ],
    },
    {
      id: "p-ca-balance",
      kind: "statement",
      statement: "balance",
      title: "Pragati Precision - balance sheet at 31 March",
      caption: "Rs crore. The half of the story the pitch deck does not contain.",
      unit: "inr",
      periods: ["FY26", "FY25"],
      sections: [
        {
          title: "Assets",
          lines: [
            { label: "Cash", value: 6.0 * CRORE, priorValue: 11.0 * CRORE, indent: true, goodDirection: "up" },
            { label: "Receivables", value: 78.0 * CRORE, priorValue: 58.0 * CRORE, indent: true },
            { label: "Inventory", value: 64.0 * CRORE, priorValue: 38.0 * CRORE, indent: true, note: "Coil steel and work in progress built to run the new line at a volume the order book has not reached." },
            { label: "Other current assets", value: 8.0 * CRORE, priorValue: 6.0 * CRORE, indent: true },
            { label: "Total current assets", value: 156.0 * CRORE, priorValue: 113.0 * CRORE, emphasis: true },
            { label: "Property, plant and equipment", value: 372.0 * CRORE, priorValue: 96.0 * CRORE, indent: true, note: "The automated line was commissioned in June FY26 and is Rs 268 crore of this." },
            { label: "Total assets", value: 528.0 * CRORE, priorValue: 209.0 * CRORE, emphasis: true },
          ],
        },
        {
          title: "Liabilities",
          lines: [
            { label: "Payables", value: 46.0 * CRORE, priorValue: 41.0 * CRORE, indent: true },
            { label: "Working-capital facility", value: 44.2 * CRORE, priorValue: 8.0 * CRORE, indent: true, goodDirection: "down" },
            { label: "Term loan due within a year", value: 72.0 * CRORE, priorValue: 6.0 * CRORE, indent: true, goodDirection: "down", note: "The moratorium ended. No new borrowing - this moved column on a date." },
            { label: "Other current liabilities", value: 4.0 * CRORE, priorValue: 3.0 * CRORE, indent: true },
            { label: "Total current liabilities", value: 166.2 * CRORE, priorValue: 58.0 * CRORE, emphasis: true, goodDirection: "down" },
            { label: "Term loan due after a year", value: 230.0 * CRORE, priorValue: 36.0 * CRORE, indent: true, goodDirection: "down" },
            { label: "Deferred tax and provisions", value: 28.0 * CRORE, priorValue: 15.0 * CRORE, indent: true },
          ],
        },
        {
          title: "Equity",
          lines: [
            { label: "Share capital and reserves", value: 103.8 * CRORE, priorValue: 100.0 * CRORE, indent: true, goodDirection: "up", note: "The whole expansion was debt. The owners put in nothing and now carry all of the risk." },
            { label: "Total liabilities and equity", value: 528.0 * CRORE, priorValue: 209.0 * CRORE, emphasis: true },
          ],
        },
      ],
    },
    {
      id: "p-ca-ratios",
      kind: "stat",
      title: "What the credit officer opens first",
      caption: "Against FY25. The covenant tests are interest cover at 2.00x and debt service cover at 1.25x.",
      tiles: [
        { label: "Return on capital employed", value: 0.0889, unit: "ratio", deltaPct: -0.619, goodDirection: "up" },
        { label: "Interest cover", value: 1.14, unit: "multiple", deltaPct: -0.837, goodDirection: "up" },
        { label: "Capital turnover", value: 0.889, unit: "multiple", deltaPct: -0.583, goodDirection: "up" },
        { label: "Debt to equity", value: 3.34, unit: "multiple", deltaPct: 5.68, goodDirection: "down" },
      ],
    },
    {
      id: "p-ca-run",
      kind: "timeseries",
      title: "The chart on slide 3",
      caption: "Five years of revenue and EBITDA. Nothing on it is wrong, and nothing on it is a denominator.",
      series: [
        {
          label: "Revenue",
          unit: "inr_crore",
          points: [
            { period: "FY22", value: 214 },
            { period: "FY23", value: 248 },
            { period: "FY24", value: 279 },
            { period: "FY25", value: 320 },
            { period: "FY26", value: 400 },
          ],
        },
        {
          label: "EBITDA",
          unit: "inr_crore",
          points: [
            { period: "FY22", value: 31.2 },
            { period: "FY23", value: 37.4 },
            { period: "FY24", value: 43.1 },
            { period: "FY25", value: 50.0 },
            { period: "FY26", value: 67.5 },
          ],
        },
      ],
    },
    {
      id: "p-ca-capacity",
      kind: "segments",
      title: "Stamping capacity, by line",
      caption: "Tonnes of pressed steel a year, installed against actual.",
      dimension: "Press line",
      rows: [
        { label: "Line 1 (1998, mechanical)", value: 41200, unit: "count", deltaPct: 0.9 },
        { label: "Line 2 (2011, mechanical)", value: 38600, unit: "count", deltaPct: -1.4 },
        { label: "Line 3 (FY26, servo, automated)", value: 96000, unit: "count", deltaPct: 0 },
      ],
    },
    {
      id: "p-ca-quality",
      kind: "stat",
      title: "Plant and quality",
      caption: "How the factory itself is running.",
      tiles: [
        { label: "Parts per million rejected", value: 46, unit: "count", goodDirection: "down" },
        { label: "On-time-in-full delivery", value: 0.981, unit: "ratio", goodDirection: "up" },
        { label: "Unplanned downtime", value: 0.019, unit: "ratio", goodDirection: "down" },
        { label: "Revenue per employee, Rs lakh", value: 51.3, unit: "inr_lakh", goodDirection: "up" },
      ],
    },
    {
      id: "p-ca-room",
      kind: "note",
      title: "What the room is saying",
      body:
        "CEO: we are a growth machine. EBITDA is up 35%, revenue crossed Rs 400 crore, and the margin is the best in the sector. Print the deck - the bank is going to love this.\n" +
        "Head of manufacturing: the new line is extraordinary. We have more than doubled total capacity. We are future-proofed for five years.\n" +
        "Lead auditor: current liabilities are up Rs 108 crore and your moratorium ended last month. We want to talk about the twelve-month repayment profile.\n" +
        "Treasury: the syndicate's covenant pack tests interest cover at 2.00x. I have not run it this quarter.\n" +
        "Nobody in the room has divided the operating profit by the capital it took to earn it, and nobody has asked what the last Rs 300 crore returned.",
    },
    {
      id: "p-ca-deal",
      kind: "note",
      title: "The ask, as drafted",
      body:
        "Facility requested: Rs 100 crore, five years, secured on the target's assets.\n" +
        "Target: Sanghvi Stampings, a Nashik competitor. Revenue Rs 55 crore, EBITDA Rs 12 crore.\n" +
        "Rationale in the deck: consolidation, scale, and a second OEM relationship.\n" +
        "Indicative pricing from the relationship bank: 10.1%, in line with the existing term loan.\n" +
        "The deck contains no return calculation on the Rs 100 crore, and no covenant headroom test.",
    },
  ],

  budget: { analystDays: 6, sprints: 5, rupees: 18 * CRORE },

  drilldowns: [
    {
      id: "dd-incremental",
      label: "Ask what the last Rs 300 crore returned",
      question: "The expansion is done and paid for. What did it actually earn?",
      cost: 2,
      evidenceFor: ["capital.idle"],
      readsAs:
        "The incremental return on the completed expansion is the honest forecast of what the next one will earn. At 1.7% against money costing 10.1%, the answer to the acquisition is already on this card.",
      reveals: [
        {
          id: "p-ca-incremental",
          kind: "stat",
          title: "What the expansion returned",
          caption: "FY26 against FY25, on the new capital only.",
          tiles: [
            { label: "Increase in capital employed, Rs cr", value: 300.0, unit: "inr_crore", goodDirection: "down" },
            { label: "Increase in EBIT, Rs cr", value: 5.0, unit: "inr_crore", goodDirection: "up" },
            { label: "Incremental return on capital", value: 0.0167, unit: "ratio", goodDirection: "up" },
            { label: "Marginal cost of that debt", value: 0.1011, unit: "ratio", goodDirection: "down" },
          ],
        },
        {
          id: "p-ca-incremental-note",
          kind: "note",
          title: "Read it twice",
          body:
            "Capital employed rose Rs 300.0 crore. Operating profit rose Rs 5.0 crore. Rs 5.0 / Rs 300.0 is 1.7%.\n\n" +
            "The money that paid for it costs 10.1%. Every rupee of the expansion is losing about 8.4 paise a year, and there are three hundred crore of them.\n\n" +
            "The average return of 8.9% is the kinder number, and it is kinder only because the old business is holding it up. Judge the next Rs 100 crore against 1.7%, not against 8.9% - the marginal return is what a marginal deployment will earn.",
        },
      ],
    },
    {
      id: "dd-line-util",
      label: "Pull the run-hours on the new line",
      question: "We doubled capacity. Are we using it?",
      cost: 2,
      evidenceFor: ["capital.idle"],
      readsAs:
        "Ratios say the capital is not working; run-hours say why. A line at 38% of a plan of 75% is not a financing problem wearing a factory costume - it is an idle asset.",
      reveals: [
        {
          id: "p-ca-util",
          kind: "segments",
          title: "Utilisation against plan",
          caption: "Share of installed capacity actually run in FY26.",
          dimension: "Press line",
          rows: [
            { label: "Line 1 - actual", value: 0.91, unit: "ratio" },
            { label: "Line 2 - actual", value: 0.88, unit: "ratio" },
            { label: "Line 3 - plan at sanction", value: 0.75, unit: "ratio" },
            { label: "Line 3 - actual", value: 0.38, unit: "ratio" },
          ],
        },
        {
          id: "p-ca-util-note",
          kind: "note",
          title: "Why the plan was missed",
          body:
            "Line 3 was sanctioned against a platform award from a single OEM. That platform slipped a model year in October and now starts in FY28.\n\n" +
            "Line 3 is Rs 268 crore of the Rs 372 crore of plant on the books - 72% of the asset base, running at 38%.\n\n" +
            "Separately, Rs 38 crore of legacy press shop and the Ranjangaon land parcel are still capitalised. Line 3 replaced what they did. They appear in no production plan for FY27 or FY28.",
        },
      ],
    },
    {
      id: "dd-dupont",
      label: "Decompose the return into margin and turnover",
      question: "ROCE fell by two thirds. Was that the profit or the capital?",
      cost: 2,
      dependsOn: ["dd-incremental"],
      evidenceFor: ["capital.idle", "market.pricing"],
      readsAs:
        "A margin problem and a turnover problem look identical in the ratio and share no decisions. Here the margin moved nine-tenths of a point and the turnover fell 58%.",
      reveals: [
        {
          id: "p-ca-dupont",
          kind: "stat",
          title: "ROCE = EBIT margin x capital turnover",
          caption: "FY26, with the change on FY25.",
          tiles: [
            { label: "EBIT margin", value: 0.100, unit: "ratio", deltaPct: -0.086, goodDirection: "up" },
            { label: "Capital turnover", value: 0.889, unit: "multiple", deltaPct: -0.583, goodDirection: "up" },
            { label: "ROCE", value: 0.0889, unit: "ratio", deltaPct: -0.619, goodDirection: "up" },
            { label: "EBITDA margin", value: 0.169, unit: "ratio", deltaPct: 0.080, goodDirection: "up" },
          ],
        },
        {
          id: "p-ca-dupont-note",
          kind: "note",
          title: "Which half broke",
          body:
            "FY25: an EBIT margin of 10.9% x a capital turnover of 2.13 = 23.3%.\n" +
            "FY26: an EBIT margin of 10.0% x a capital turnover of 0.89 = 8.9%.\n\n" +
            "The margin fell nine-tenths of a point. The turnover fell 58%. And the EBITDA margin actually ROSE, from 15.6% to 16.9% - the trading is the best it has ever been.\n\n" +
            "This is not a trading problem. Anything aimed at price or cost is aimed at the half that did not break.",
        },
      ],
    },
    {
      id: "dd-covenant",
      label: "Read the covenant pack",
      question: "What did we already promise the syndicate?",
      cost: 2,
      evidenceFor: ["funding.maturity", "market.scale"],
      readsAs:
        "The return question decides whether the acquisition is worth doing. This decides whether it is possible, and the answer is no before the return is even discussed.",
      reveals: [
        {
          id: "p-ca-covenant",
          kind: "stat",
          title: "Covenant tests at 31 March",
          caption: "Tested quarterly. The next test date is 30 June.",
          tiles: [
            { label: "Interest cover - actual", value: 1.14, unit: "multiple", goodDirection: "up" },
            { label: "Interest cover - covenant", value: 2.00, unit: "multiple", goodDirection: "up" },
            { label: "Debt service cover - actual", value: 0.72, unit: "multiple", goodDirection: "up" },
            { label: "Debt service cover - covenant", value: 1.25, unit: "multiple", goodDirection: "up" },
          ],
        },
        {
          id: "p-ca-covenant-note",
          kind: "note",
          title: "Clause 14.3",
          body:
            "Both financial covenants are breached at 31 March. The syndicate has not yet called the test.\n\n" +
            "Clause 14.3 bars incremental financial indebtedness while interest cover sits below 2.00x, without the consent of lenders holding two thirds of commitments.\n\n" +
            "So the Rs 100 crore facility is not a request the relationship bank can price. It is a request for a waiver from a syndicate that is about to discover it has a breach - which is why walking in with the EBITDA slide and no covenant page is worse than not walking in at all.\n\n" +
            "Note the two ratios move differently. Stretching the loan's tenor cuts the principal falling due, so debt service cover improves sharply. Interest cover never contained principal, so it does not improve at all.",
        },
      ],
    },
    {
      id: "dd-target",
      label: "Underwrite the acquisition target",
      question: "What does Rs 100 crore actually buy?",
      cost: 2,
      evidenceFor: ["market.scale"],
      readsAs:
        "Take the CEO's own numbers and finish the sum they stop short of. Rs 8 crore of EBIT on Rs 100 crore is 8%, funded at 10.1% - and 8% is the optimistic case.",
      reveals: [
        {
          id: "p-ca-target",
          kind: "stat",
          title: "Sanghvi Stampings, as the deck models it",
          caption: "Post-synergy, absorbed into existing corporate overhead.",
          tiles: [
            { label: "Revenue acquired, Rs cr", value: 55.0, unit: "inr_crore", goodDirection: "up" },
            { label: "EBIT acquired, Rs cr", value: 8.0, unit: "inr_crore", goodDirection: "up" },
            { label: "Return on the Rs 100 cr", value: 0.080, unit: "ratio", goodDirection: "up" },
            { label: "Cost of the Rs 100 cr", value: 0.1011, unit: "ratio", goodDirection: "down" },
          ],
        },
        {
          id: "p-ca-target-note",
          kind: "note",
          title: "The charitable case still loses",
          body:
            "These are the deck's own numbers, and they are generous: Rs 12 crore of EBITDA less Rs 4 crore of depreciation, with no incremental corporate overhead beyond Rs 2.2 crore.\n\n" +
            "Even so, Rs 100 crore returns 8.0% against money costing 10.1%. Doing the deal takes capital employed to Rs 550 crore and EBIT to Rs 48 crore - a return of 8.7%, which is LOWER than the 8.9% it started at. Interest cover falls from 1.14x to 1.06x.\n\n" +
            "Sanghvi also runs two mechanical lines at 84%. It brings no capacity Pragati is short of. What Pragati is short of is orders for the capacity it already owns.",
        },
      ],
    },
    {
      id: "dd-orderbook",
      label: "Open the order book and the unquoted enquiries",
      question: "Is there demand for the capacity we already own?",
      cost: 2,
      evidenceFor: ["market.demand", "capital.idle"],
      readsAs:
        "The demand exists at a price. On a line at 38%, 9% off realisation is an extremely cheap way to buy utilisation, and the contribution lands on an asset that is already paid for.",
      reveals: [
        {
          id: "p-ca-orders",
          kind: "segments",
          title: "Enquiries not converted, FY26",
          caption: "Annualised revenue, by why it was not taken.",
          rows: [
            { label: "Tier-2 aftermarket programme, 9% below OEM realisation", value: 88.0, unit: "inr_crore" },
            { label: "Export contract manufacture, quoted and lost on price", value: 21.0, unit: "inr_crore" },
            { label: "Lost on lead time", value: 6.0, unit: "inr_crore" },
            { label: "Declined - outside our tooling envelope", value: 14.0, unit: "inr_crore" },
          ],
          dimension: "Enquiry",
        },
        {
          id: "p-ca-orders-note",
          kind: "note",
          title: "Five months in the sales director's tray",
          body:
            "Two aftermarket distributors have asked for a servo-stamped programme worth about Rs 88 crore a year, at 9% below what the OEM contracts realise. It has sat unanswered since November because it dilutes blended realisation and the sales incentive plan pays on realisation.\n\n" +
            "It fits Line 3's tooling envelope and would take it from 38% to roughly 75%.\n\n" +
            "Nine per cent off a price, on a machine you have already bought and are already depreciating, is close to pure return. The incentive plan is measuring the wrong thing.",
        },
      ],
    },
    {
      id: "dd-workingcapital",
      label: "Age the receivables and the stock",
      question: "Is there money trapped anywhere else?",
      cost: 2,
      evidenceFor: ["capital.workingcapital"],
      readsAs:
        "Real, and much the smaller half. Releasing working capital only reaches the return to the extent it repays the facility - about Rs 24 crore against Rs 300 crore of new capital.",
      reveals: [
        {
          id: "p-ca-wc",
          kind: "stat",
          title: "Working capital",
          caption: "FY26, with the change on FY25.",
          tiles: [
            { label: "Days sales outstanding", value: 71, unit: "days", deltaPct: 0.075, goodDirection: "down" },
            { label: "Days inventory outstanding", value: 79, unit: "days", deltaPct: 0.234, goodDirection: "down" },
            { label: "Days payable outstanding", value: 57, unit: "days", deltaPct: 0.020, goodDirection: "up" },
            { label: "Working-capital facility drawn, Rs cr", value: 44.2, unit: "inr_crore", goodDirection: "down" },
          ],
        },
        {
          id: "p-ca-wc-note",
          kind: "note",
          title: "Where the increase came from",
          body:
            "Inventory rose Rs 26 crore, about Rs 19 crore of it coil steel and work in progress bought to run Line 3 at a volume the order book never reached. Receivables rose with revenue and the ageing profile barely moved.\n\n" +
            "Clearing the surplus coil and collecting the over-90 bucket would release roughly Rs 27 crore of cash, of which about Rs 24 crore can go against the working-capital facility.\n\n" +
            "That is Rs 24 crore off capital employed, against Rs 300 crore of new capital employed. Worth doing. Not the answer.",
        },
      ],
    },
    {
      id: "dd-peer",
      label: "Benchmark against the listed comparables",
      question: "Is this the sector, or is it us?",
      cost: 2,
      evidenceFor: ["market.pricing", "capital.idle"],
      readsAs:
        "Best EBITDA margin of the four and the worst return on capital. That combination has exactly one explanation, and it is not on the profit and loss statement.",
      reveals: [
        {
          id: "p-ca-peer",
          kind: "stat",
          title: "Pragati against three listed auto-component peers",
          caption: "FY26 or nearest reported year.",
          tiles: [
            { label: "Pragati - EBITDA margin", value: 0.169, unit: "ratio", goodDirection: "up" },
            { label: "Peer median - EBITDA margin", value: 0.142, unit: "ratio", goodDirection: "up" },
            { label: "Pragati - ROCE", value: 0.0889, unit: "ratio", goodDirection: "up" },
            { label: "Peer median - ROCE", value: 0.187, unit: "ratio", goodDirection: "up" },
          ],
        },
        {
          id: "p-ca-peer-note",
          kind: "note",
          title: "One outlier, and it is not the margin",
          body:
            "Pragati has the best EBITDA margin of the four and the worst return on capital by a distance. Peer capital turnover runs 1.6 to 2.2; Pragati is at 0.89.\n\n" +
            "A company can only be best on margin and worst on return if its capital turnover is the outlier. A soft sector compresses everyone's margin - it does not choose one company's denominator.",
        },
      ],
    },
  ],

  causes: [
    { id: "capital", parentId: null, label: "The capital side", verdict: "Where the whole problem is, and where the decision on the table makes it worse." },
    {
      id: "capital.idle",
      parentId: "capital",
      label: "We built capacity we are not using",
      verdict:
        "This was it. Rs 300 crore of new capital employed produced Rs 5 crore of extra operating profit - an incremental return of 1.7% against debt costing 10.1%. Line 3 runs at 38% against a plan of 75% because the OEM platform it was sanctioned for slipped to FY28, and it is 72% of the net book value. A further Rs 38 crore of legacy press shop and land sits in no production plan at all.",
    },
    {
      id: "capital.workingcapital",
      parentId: "capital",
      label: "Cash is trapped in stock and receivables",
      verdict:
        "Real and much the smaller half. Inventory rose Rs 26 crore, about Rs 19 crore of it bought to feed a line the order book never reached. Releasing it repays roughly Rs 24 crore of the facility - against Rs 300 crore of new capital employed. Worth doing, and about a twelfth of the problem.",
    },
    { id: "funding", parentId: null, label: "How the expansion was funded", verdict: "Badly, and separately from why it is not earning." },
    {
      id: "funding.maturity",
      parentId: "funding",
      label: "We funded a twelve-year asset with five-year money",
      verdict:
        "Entirely true, and it explains the repayment cliff rather than the return. Rs 72 crore reclassified as current when the moratorium ended, with no transaction at all. Stretching the tenor takes debt service cover from 0.72x back over 1.25x and moves the return on capital by nothing, because a liability changing its due date does not change how much capital is employed. It also does not move interest cover, which never contained principal - the covenant that gates the acquisition stays breached.",
    },
    {
      id: "funding.leverage",
      parentId: "funding",
      label: "We simply borrowed too much",
      verdict:
        "Debt to equity of 3.34x is genuinely alarming and still not the reason the capital earns 1.7%. Leverage decided how fast this became urgent; it did not decide what the line would produce. Swapping Rs 80 crore of debt for Rs 80 crore of equity leaves capital employed - and therefore the return - exactly where it was, and the owners are diluted for it.",
    },
    { id: "market", parentId: null, label: "The market and our position in it", verdict: "The CEO's reading, and the one the deck is written from." },
    {
      id: "market.scale",
      parentId: "market",
      label: "We are sub-scale, and the acquisition is the answer",
      verdict:
        "The most expensive wrong answer available. On the deck's own generous numbers the target returns 8.0% on Rs 100 crore against money costing 10.1%, which takes group ROCE from 8.9% to 8.7% and interest cover from 1.14x to 1.06x. It also buys two mechanical lines running at 84% - capacity Pragati is not short of. And clause 14.3 bars incremental debt below 2.00x interest cover, so the facility cannot be written at all. Scale was never the constraint; orders for the capacity already owned is.",
    },
    {
      id: "market.demand",
      parentId: "market",
      label: "There is no demand for the extra capacity",
      verdict:
        "The demand exists at a price. Two aftermarket distributors have asked for a servo-stamped programme worth about Rs 88 crore a year at 9% below OEM realisation, and it has sat unanswered for five months because the sales incentive plan pays on realisation. On a line at 38%, 9% off price is a very cheap way to buy utilisation.",
      unactionable: {
        why: "If there were genuinely no demand for the capacity, no spend would create it - the answer would be to shrink the asset base rather than to fund anything. That there is nothing here to buy is the tell that this reading is wrong.",
      },
    },
    {
      id: "market.pricing",
      parentId: "market",
      label: "We are priced too thin to carry this balance sheet",
      verdict:
        "The EBITDA margin ROSE, from 15.6% to 16.9%, and is the best of the four listed comparables. The EBIT margin moved nine-tenths of a point while capital turnover fell 58%. A company with the sector's best margin and its worst return on capital does not have a pricing problem - and raising price takes volume off a line that is already 62% idle.",
    },
  ],
  trueCauseIds: ["capital.idle"],

  interventions: [
    {
      id: "iv-fill-line",
      label: "Sign the tier-2 aftermarket programme",
      pitch:
        "Take the servo-stamped aftermarket volume at 9% below OEM realisation, and re-point the sales incentive plan at utilisation instead of realisation. Fills Line 3 from 38% toward 75% with demand that already exists.",
      addresses: "capital.idle",
      cost: { sprints: 3, rupees: 11 * CRORE },
      minSprints: 3,
      effects: {
        whenRootCause: [
          { driver: "revenue", deltaPct: 0.22, rampQuarters: 3 },
          // The volume sells 9% below OEM realisation, so the cost of goods
          // rises as a share of it. That is the trade, and it is worth taking
          // because the capital was already bought.
          { driver: "cogsRate", deltaPct: 0.014, rampQuarters: 3 },
        ],
        otherwise: [
          { driver: "revenue", deltaPct: 0.06, rampQuarters: 3 },
          { driver: "cogsRate", deltaPct: 0.014, rampQuarters: 3 },
        ],
      },
      debrief:
        "The single largest lever, and the one that had been sitting in a tray since November. Contribution earned on a machine already bought and already being depreciated is very close to pure return - and utilisation is the half of the return that broke. The 9% discount looks like a concession only if you are still measuring realisation instead of capital.",
    },
    {
      id: "iv-sell-legacy",
      label: "Sell the legacy press shop and the Ranjangaon land",
      pitch:
        "Rs 38 crore of superseded mechanical plant and a land parcel appear in no production plan for FY27 or FY28. Sell them and take the proceeds straight off the term loan.",
      addresses: "capital.idle",
      cost: { sprints: 2, rupees: 7 * CRORE },
      minSprints: 2,
      effects: {
        // Both sides of the entry, so the balance sheet still balances:
        // Rs 38 cr off fixed assets is Rs 38 cr off the term loan (16.52% of
        // Rs 230 cr). Identical in both arms because it is the same
        // transaction whatever the diagnosis was.
        whenRootCause: [
          { driver: "netFixedAssets", deltaPct: -0.1022, rampQuarters: 2 },
          { driver: "longTermDebt", deltaPct: -0.1652, rampQuarters: 2 },
          { driver: "depreciation", deltaPct: -0.055, rampQuarters: 2 },
        ],
        otherwise: [
          { driver: "netFixedAssets", deltaPct: -0.1022, rampQuarters: 2 },
          { driver: "longTermDebt", deltaPct: -0.1652, rampQuarters: 2 },
          { driver: "depreciation", deltaPct: -0.055, rampQuarters: 2 },
        ],
      },
      debrief:
        "The unglamorous half of the answer, and the one that works on the denominator directly. Capital employed falls Rs 38 crore, interest falls with it, and not one rupee of operating profit is given up - the assets sold were producing none. Shrinking the capital base is a way of raising a return, and it is the way nobody puts in a deck.",
    },
    {
      id: "iv-acquire",
      label: "Ask for the Rs 100 crore and buy Sanghvi Stampings",
      pitch:
        "The CEO's proposal. Consolidate the region, add Rs 55 crore of revenue and a second OEM relationship, and lead the credit paper with an EBITDA that is up 35%.",
      addresses: "market.scale",
      cost: { sprints: 2, rupees: 6 * CRORE },
      effects: {
        // Modelled on the deck's OWN optimistic numbers - Rs 55 cr of revenue
        // at group cost of goods, Rs 2.2 cr of incremental overhead and Rs 4 cr
        // of depreciation, giving the Rs 8 cr of EBIT the deck claims. It still
        // lowers the north star, because 8.0% is below the 10.1% it is funded
        // at. Identical in both arms: it is the same transaction either way.
        whenRootCause: [
          { driver: "longTermDebt", deltaPct: 0.43478, rampQuarters: 2 },
          { driver: "revenue", deltaPct: 0.1375, rampQuarters: 2 },
          { driver: "opex", deltaPct: 0.06162, rampQuarters: 2 },
          { driver: "depreciation", deltaPct: 0.145455, rampQuarters: 2 },
        ],
        otherwise: [
          { driver: "longTermDebt", deltaPct: 0.43478, rampQuarters: 2 },
          { driver: "revenue", deltaPct: 0.1375, rampQuarters: 2 },
          { driver: "opex", deltaPct: 0.06162, rampQuarters: 2 },
          { driver: "depreciation", deltaPct: 0.145455, rampQuarters: 2 },
        ],
      },
      debrief:
        "The trap, and it is modelled on the deck's own generous numbers rather than a strawman. Rs 100 crore buys Rs 8 crore of operating profit - 8.0%, funded at 10.1% - so group ROCE goes from 8.9% to 8.7% and interest cover from 1.14x to 1.06x. Doing more of a thing that returns less than it costs is how a company with one bad expansion becomes a company with two. And clause 14.3 means the facility could not have been written anyway.",
    },
    {
      id: "iv-refinance",
      label: "Refinance the term loan over ten years",
      pitch:
        "Match the loan to the asset's life. Term the Rs 302 crore out over ten years at about 70 basis points more, take the repayment cliff away and clear the debt service covenant.",
      addresses: "funding.maturity",
      cost: { sprints: 2, rupees: 4 * CRORE },
      effects: {
        whenRootCause: [
          { driver: "currentPortionLtd", deltaPct: -0.70 },
          { driver: "longTermDebt", deltaPct: 0.21913 },
          { driver: "interestRate", deltaPct: 0.0693 },
        ],
        otherwise: [
          { driver: "currentPortionLtd", deltaPct: -0.70 },
          { driver: "longTermDebt", deltaPct: 0.21913 },
          { driver: "interestRate", deltaPct: 0.0693 },
        ],
      },
      debrief:
        "Genuinely worth doing, urgent, and not an answer to the question asked. Total debt is unchanged, so capital employed is unchanged, so the return is unchanged to the rupee. Debt service cover goes from 0.72x to comfortably over 1.25x - and interest cover, the covenant that gates the acquisition, gets slightly WORSE, because the extra 70 basis points is real and principal was never in that ratio. It buys the time to fix the real problem. It is not the fix.",
    },
    {
      id: "iv-equity",
      label: "Raise Rs 80 crore of equity and repay the term loan",
      pitch:
        "De-risk the balance sheet before the meeting. A Rs 80 crore rights issue takes debt to equity from 3.34x to 1.45x and interest cover to about 1.49x.",
      addresses: "funding.leverage",
      cost: { sprints: 1, rupees: 5 * CRORE },
      effects: {
        whenRootCause: [
          { driver: "equity", deltaPct: 0.77071 },
          { driver: "longTermDebt", deltaPct: -0.34783 },
        ],
        otherwise: [
          { driver: "equity", deltaPct: 0.77071 },
          { driver: "longTermDebt", deltaPct: -0.34783 },
        ],
      },
      debrief:
        "The clearest illustration in the scenario of what a return on capital actually measures. Debt to equity more than halves, interest cover nearly doubles, net profit rises because interest falls - and the return on capital employed does not move by a single basis point, because capital employed is equity PLUS debt and Rs 80 crore simply crossed from one to the other. The owners are diluted to buy a ratio, and the asset still runs at 38%.",
    },
    {
      id: "iv-working-capital",
      label: "Clear the surplus coil and collect the old debtors",
      pitch:
        "About Rs 19 crore of coil and work in progress was bought to feed Line 3, not to fill an order. Sell it down, chase the over-90 bucket, and repay the working-capital facility.",
      addresses: "capital.workingcapital",
      cost: { sprints: 1, rupees: 3 * CRORE },
      effects: {
        whenRootCause: [
          { driver: "inventory", deltaPct: -0.26, rampQuarters: 2 },
          { driver: "receivables", deltaPct: -0.09, rampQuarters: 2 },
          { driver: "shortTermDebt", deltaPct: -0.55, rampQuarters: 2 },
        ],
        otherwise: [
          { driver: "inventory", deltaPct: -0.26, rampQuarters: 2 },
          { driver: "receivables", deltaPct: -0.09, rampQuarters: 2 },
          { driver: "shortTermDebt", deltaPct: -0.55, rampQuarters: 2 },
          // Clearing surplus coil into a soft steel market costs something on
          // the way out.
          { driver: "cogsRate", deltaPct: 0.004 },
        ],
      },
      debrief:
        "Real money and the right instinct, applied to about a twelfth of the problem. It takes roughly Rs 24 crore off capital employed against the Rs 300 crore that was added, and it is the one lever here that costs almost nothing to pull. Worth doing alongside the answer; not a substitute for it.",
    },
    {
      id: "iv-price-up",
      label: "Take 4% on OEM pricing",
      pitch:
        "Recover the margin the depreciation charge took away. A 4% rise across the OEM book at the annual price round, on contracts that are up for renewal anyway.",
      addresses: "market.pricing",
      cost: { sprints: 1, rupees: 2 * CRORE },
      effects: {
        whenRootCause: [
          { driver: "revenue", deltaPct: -0.054 },
          { driver: "cogsRate", deltaPct: -0.018 },
        ],
        otherwise: [
          { driver: "revenue", deltaPct: -0.054 },
          { driver: "cogsRate", deltaPct: -0.018 },
        ],
      },
      debrief:
        "Aimed at the half of the return that did not break, and it costs more than it earns. OEMs re-source on price, so 4% on the book loses about 9% of the volume - taking work off a line that is already 62% idle, to improve a margin that is already the best of the four comparables. It makes the ratio the CEO is proud of look slightly better and the number the bank cares about slightly worse.",
    },
  ],

  // The OEM price-down clause runs at about 1.2% a quarter, and the fixed cost
  // of an idle line keeps escalating whether or not it is used.
  drift: [
    { driver: "revenue", deltaPct: -0.012 },
    { driver: "opex", deltaPct: 0.015 },
  ],
  horizonQuarters: 4,
  periodNoun: "quarter",

  parInvestigation: ["dd-incremental", "dd-line-util"],
  bestAllocation: [
    { interventionId: "iv-fill-line", sprints: 3, rupees: 11 * CRORE },
    { interventionId: "iv-sell-legacy", sprints: 2, rupees: 7 * CRORE },
  ],

  debrief: {
    causalChain: [
      "A Rs 300 crore automated stamping line was commissioned in FY26 on a five-year syndicated term loan, taking property, plant and equipment from Rs 96 crore to Rs 372 crore and capital employed from Rs 150.0 crore to Rs 450.0 crore.",
      "Line 3 runs at 38% against a plan of 75%, because the OEM platform it was sanctioned against slipped to FY28. It is 72% of the net book value.",
      "Operating profit rose Rs 5.0 crore on Rs 300.0 crore of new capital - an incremental return of 1.7%, against debt costing 10.1%.",
      "So ROCE fell from 23.3% to 8.9%: the EBIT margin moved only from 10.9% to 10.0%, while capital turnover fell from 2.13 to 0.89. The EBITDA margin actually rose, which is why the deck reads so well.",
      "Interest rose from Rs 5.0 crore to Rs 35.0 crore as the moratorium ended, putting interest cover at 1.14x against a 2.00x covenant and debt service cover at 0.72x against 1.25x. Both are already breached.",
      "And clause 14.3 bars incremental debt below 2.00x interest cover - so the Rs 100 crore facility the meeting was called to request cannot be written, whatever it would have earned.",
    ],
    whereTheLeverageWas:
      "Both halves of the capital turnover, and neither of them is in the deck. Signing the aftermarket programme that has sat unanswered since November uses the machine that was already bought; selling the legacy press shop and the Ranjangaon land takes Rs 38 crore of capital out that was producing nothing. The acquisition is the trap, and the two sensible-looking defences - refinancing and a rights issue - each fix the ratio they aim at and leave the return exactly where it was. What this scenario has to teach is that the number which decides whether to deploy the next rupee is the incremental return, not the average one, and the CEO's deck contains neither.",
    strongAnswer: [
      "Start by agreeing with the CEO. EBITDA really is up 35%, the margin really is the best in the sector, and the plant really does run well.",
      "Then say what EBITDA is defined to exclude: depreciation and interest. Those are the entire cost of the expansion, so EBITDA is the one measure that cannot judge one.",
      "So divide operating profit by the capital it took to earn. Return on capital employed is 8.9%, against 23.3% last year.",
      "Split that in two to see which half broke: profit margin moved 10.9% to 10.0%. Sales per rupee of capital collapsed, 2.13 to 0.89.",
      "So this is about the capital, not the trading - and the peer table settles it. Best EBITDA margin of the four comparables, worst return on capital. Only the turnover is an outlier.",
      "Now the move the deck never makes. Look at the new money on its own: EBIT rose Rs 5 crore, capital employed rose Rs 300 crore. That is 1.7%, against debt at 10.1%.",
      "That number is the forecast. An average return grades everything you have ever built; the incremental one tells you what the next thing will earn.",
      "Confirm it physically rather than by ratio. Lines 1 and 2 run at 91% and 88%. Line 3 runs at 38% against a plan of 75%, and it is 72% of the book value.",
      "So the answer to the acquisition is no, and not because Rs 100 crore is a lot of money. On the deck's own numbers it returns 8.0% against money costing 10.1%, and it takes group ROCE from 8.9% to 8.7%.",
      "It is also not available. Interest cover is 1.14x against a 2.00x covenant and clause 14.3 bars new debt below that - so the meeting as planned is a request for a waiver, made by someone who has not read the covenant page.",
      "What to do instead has two halves, and both work on the turnover. Sign the aftermarket programme even at 9% below OEM price - on a machine already bought, almost all of that comes back as return.",
      "And sell what is in no production plan: Rs 38 crore of legacy press shop and land, straight out of capital employed, giving up no profit because it was producing none.",
      "Name the two traps that look like answers. Refinancing to ten years fixes debt service cover and moves the return by nothing - and it does not even move interest cover, because principal was never in that ratio.",
      "And a Rs 80 crore rights issue halves the gearing, nearly doubles interest cover, and moves the return on capital by zero - because capital employed is equity plus debt, and the money just crossed from one side to the other.",
      "Close with what to say tomorrow. Go to the bank with the covenant breach, the refinancing proposal and a utilisation plan. Do not go with the EBITDA slide and an acquisition request.",
    ],
  },

  coachFallback: [
    {
      topic: ["incremental", "marginal", "new capital", "300 crore", "1.7", "next rupee"],
      answer: [
        "Look at the new money on its own, not blended with the old.",
        "Capital employed rose Rs 300 crore. Operating profit rose Rs 5 crore. That is 1.7%.",
        "The debt that funded it costs 10.1%. And 1.7% is the honest forecast for the next Rs 100 crore, because it is what the last Rs 300 crore actually did.",
      ],
    },
    {
      topic: ["roce", "return on capital", "8.9", "denominator", "capital employed", "spread"],
      answer: [
        "Return on capital is operating profit divided by the money tied up earning it.",
        "The money tied up went from Rs 150 crore to Rs 450 crore. The profit went from Rs 35 crore to Rs 40 crore.",
        "So 8.9%, against a cost of capital of about 11%. The company is destroying value while growing 25% a year.",
      ],
    },
    {
      topic: ["ebitda", "vanity", "35%", "record", "margin best"],
      answer: [
        "EBITDA is earnings before interest, tax, depreciation and amortisation - and the expansion's entire cost is depreciation and interest.",
        "So EBITDA is the one measure structurally incapable of judging an expansion. It is up 35% precisely because it excludes what the expansion cost.",
        "Depreciation went from Rs 15 crore to Rs 27.5 crore and interest from Rs 5 crore to Rs 35 crore. That is where the 35% went.",
      ],
    },
    {
      topic: ["dupont", "margin", "turnover", "decompose", "capital turnover"],
      answer: [
        "Split the return into two questions: profit per rupee of sales, and sales per rupee of capital.",
        "FY25: 10.9% x 2.13 = 23.3%. FY26: 10.0% x 0.89 = 8.9%.",
        "The margin moved nine-tenths of a point. The turnover fell 58%. This was never a trading problem.",
      ],
    },
    {
      topic: ["interest cover", "icr", "covenant", "1.14", "2.0", "breach", "clause"],
      answer: [
        "Operating profit covers the interest bill 1.14 times, against a promise to the syndicate of 2.00. That is a breach.",
        "Debt service cover, which adds the principal falling due, is 0.72x against 1.25x. Also a breach.",
        "And clause 14.3 bars new borrowing below 2.00x interest cover - so the Rs 100 crore facility cannot be written at all.",
      ],
    },
    {
      topic: ["acquisition", "acquire", "sanghvi", "100 crore", "m&a", "target", "buy"],
      answer: [
        "Take the deck's own numbers and finish the sum. Rs 100 crore buys Rs 8 crore of operating profit - 8.0%.",
        "It would be funded at 10.1%. Group ROCE goes from 8.9% to 8.7% and interest cover from 1.14x to 1.06x.",
        "The target also runs two mechanical lines at 84%. It brings capacity, and capacity is the thing Pragati already has too much of.",
      ],
    },
    {
      topic: ["refinance", "tenor", "ten year", "maturity", "dscr", "debt service"],
      answer: [
        "Refinancing is urgent and it is not the answer to the return.",
        "Total debt is unchanged, so capital employed is unchanged, so ROCE does not move by a rupee.",
        "It fixes debt service cover, because that ratio contains principal. It does not fix interest cover, which never did - and the extra 70 basis points makes interest cover slightly worse.",
      ],
    },
    {
      topic: ["equity", "rights issue", "leverage", "debt to equity", "dilute", "de-risk"],
      answer: [
        "This is the sharpest lesson in the case.",
        "Raising Rs 80 crore from owners to repay Rs 80 crore of debt takes gearing from 3.34x to 1.45x and nearly doubles interest cover.",
        "And it moves the return on capital by zero - because capital employed is debt plus equity, and the money crossed from one to the other. The line still runs at 38%.",
      ],
    },
    {
      topic: ["utilisation", "38", "line 3", "idle", "capacity", "platform", "run hours"],
      answer: [
        "Lines 1 and 2 run at 91% and 88%. Line 3 runs at 38% against a sanctioned plan of 75%.",
        "It is Rs 268 crore of the Rs 372 crore of plant on the books.",
        "The OEM platform it was built for slipped a model year and now starts in FY28.",
      ],
    },
    {
      topic: ["aftermarket", "discount", "9%", "realisation", "order book", "demand", "fill"],
      answer: [
        "Two distributors have asked for about Rs 88 crore a year of servo-stamped aftermarket work, at 9% below OEM realisation.",
        "It has sat unanswered since November because the sales incentive plan pays on realisation, not on utilisation.",
        "On a machine already bought and already being depreciated, 9% off price is a very cheap way to buy the utilisation the return needs.",
      ],
    },
    {
      topic: ["sell", "legacy", "land", "ranjangaon", "divest", "shrink", "denominator"],
      answer: [
        "Rs 38 crore of superseded press shop and a land parcel appear in no production plan for FY27 or FY28.",
        "Selling them takes Rs 38 crore straight out of capital employed and repays term debt with it.",
        "No operating profit is given up, because those assets were producing none. Shrinking the denominator is a way of raising a return.",
      ],
    },
  ],
};
