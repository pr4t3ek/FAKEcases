/**
 * "Our best ever EBITDA, and the bank wants a word."
 *
 * The third finance scenario, and the one that puts the balance sheet in front
 * of a student who has so far only been asked to read a P&L and a cash flow. It
 * teaches the two things the balance sheet knows that neither of the others
 * does: whether the company can pay what falls due, and whether the capital tied
 * up in it is earning anything.
 *
 * ── The truth, for whoever maintains this ─────────────────────────────────
 *
 * EBITDA is up 31% and the company is one covenant test from default.
 *
 * A ₹120 crore term loan funded a third kiln that is running at 46%
 * utilisation. Capital employed went from ₹151 crore to ₹312 crore while
 * operating profit went from ₹22.3 crore to ₹25.3 crore, so return on capital
 * employed fell from 14.8% to 8.1%. Decomposed, the EBIT margin barely moved —
 * 11.4% to 10.6% — and capital turnover halved, from 1.30 to 0.76. The problem
 * is entirely in the denominator.
 *
 * The liquidity crisis is the same fact wearing a different hat: ₹64 crore of
 * the term loan has reclassified as current because it falls due within twelve
 * months, which is what took the current ratio from 2.11 to 0.93.
 *
 * The lesson: **a return is a margin and a turnover, and most of the ways a
 * company gets into trouble are in the turnover.** A P&L cannot see capital, so
 * a business can post its best trading year while destroying value.
 *
 * ── Balance notes ─────────────────────────────────────────────────────────
 *
 * The two most instructive decoys are the ones that do *nothing* to the north
 * star, and both are authored to be genuinely good ideas:
 *
 *   - **Refinancing** takes the current ratio from 0.93 to about 1.86 and
 *     leaves ROCE untouched, because moving a liability from one column to
 *     another does not change how much capital is employed. It also costs
 *     0.8 points of interest, so interest cover gets slightly *worse* — a real
 *     trade rather than a free win.
 *   - **The rights issue** repays ₹40 crore of debt with ₹40 crore of equity.
 *     Debt-to-equity halves, interest cover clears the covenant, and ROCE moves
 *     by nothing at all, because capital employed is equity *plus* debt. If a
 *     retune ever lets either of these move ROCE, the scenario loses its point.
 *
 * Note what the driver graph does and does not do. It models the ratios, not a
 * fully articulated balance sheet: an intervention that reduces stock does not
 * automatically post the other side of the entry. The accounting identity is
 * asserted where it belongs — on the authored balance-sheet panel, pinned by
 * `tests/sim-scenario.test.ts` — and the sale-and-leaseback's effects are sized
 * so its two sides do match, because there it was free to do so.
 */

import type { SimScenario } from "../types";

const CRORE = 10_000_000;

export const balanceSheetLeverage: SimScenario = {
  slug: "balance-sheet-leverage",
  title: "Deccan Ceramics: our best ever EBITDA, and the bank wants a word",
  company: "Deccan Ceramics",
  premise:
    "A tile maker posted record EBITDA the same quarter its auditor raised a going-concern note. Work out which of the two statements the board should believe.",
  situation:
    "You are the financial analyst at Deccan Ceramics, a Morbi tile manufacturer that commissioned a third kiln last year on a ₹120 crore term loan. FY25 EBITDA came in at ₹40.5 crore, up 31% and the best in the company's history. " +
    "In the same week, the auditor attached an emphasis-of-matter paragraph on going concern, and the lender's relationship manager asked for a meeting about the interest-cover covenant. " +
    "The managing director wants to announce the EBITDA. The finance director wants to refinance. Nobody has explained why both of them can be right. " +
    "You have 7 analyst-days, then 4 sprints and ₹16 crore.",
  difficulty: "Medium",

  mentor: {
    persona: "a CFO debriefing a junior financial analyst",
    audience: "analyst",
  },

  teaching: {
    showMetricMap: true,
    primer: {
      intro:
        "A profit and loss statement tells you what a year produced. A balance sheet tells you what it took to produce it, and what has to be paid for out of it. Almost every ratio worth knowing is one line of the first divided by one line of the second.",
      terms: [
        {
          term: "Current ratio",
          plain: "What the company owns and expects to turn into cash within a year, divided by what it owes within that year.",
          formula: "current assets ÷ current liabilities",
          matters:
            "Below 1.0 the company owes more inside twelve months than it expects to have. That is what triggers a going-concern paragraph, and it can happen without a single rupee of trading going wrong.",
          driver: "currentRatio",
        },
        {
          term: "Quick ratio",
          full: "Acid test",
          plain: "The same test with the stock taken out, because stock is the slowest thing on the list to turn into money.",
          formula: "(current assets − inventory) ÷ current liabilities",
          matters:
            "The honest version for a manufacturer. If most of your current assets are unsold tiles, a comfortable current ratio can be hiding a company that cannot pay next month.",
          driver: "quickRatio",
        },
        {
          term: "Debt to equity",
          plain: "How much of the business is funded by lenders against how much by its owners.",
          formula: "total debt ÷ shareholders' equity",
          matters:
            "Leverage magnifies both directions. It does not make a good year better or a bad year worse in itself — it decides how much of a bad year the company survives.",
          driver: "debtToEquity",
        },
        {
          term: "Interest cover",
          plain: "How many times over the operating profit would pay the year's interest bill.",
          formula: "EBIT ÷ interest",
          matters:
            "The covenant most loan agreements actually turn on. Below the agreed multiple the lender can call the loan, whatever the profit says — which is why this number is more urgent than net profit here.",
          driver: "interestCover",
        },
        {
          term: "Capital employed",
          plain: "All the money in the business, from owners and lenders alike.",
          formula: "equity + total debt",
          matters:
            "The denominator everyone forgets. Adding capacity always increases it, and if the profit does not increase with it, the business has got worse while looking bigger.",
          driver: "capitalEmployed",
        },
        {
          term: "ROCE",
          full: "Return on capital employed",
          plain: "The operating profit earned for each rupee of capital in the business.",
          formula: "EBIT ÷ capital employed",
          matters:
            "The one number that judges an expansion. If it sits below what the capital costs — and this company borrows at 9.9% — the company is destroying value while growing.",
          driver: "roce",
        },
        {
          term: "Asset turnover",
          plain: "How much revenue each rupee of assets generates in a year.",
          formula: "revenue ÷ total assets",
          matters:
            "The other half of a return. Two companies can earn the same margin and have completely different returns because one sweats its assets twice as hard.",
          driver: "assetTurnover",
        },
        {
          term: "Margin × turnover",
          full: "The DuPont decomposition",
          plain: "Any return breaks into how much you make per rupee of sales, times how many rupees of sales each rupee of capital produces.",
          formula: "ROCE = (EBIT ÷ revenue) × (revenue ÷ capital employed)",
          matters:
            "The most useful move in ratio analysis, because it says which half of the problem you have. A margin problem and a turnover problem look identical in the ROCE and have nothing in common as decisions.",
          driver: "capitalTurnover",
        },
        {
          term: "Current portion of long-term debt",
          plain: "The slice of a multi-year loan that falls due within the next twelve months, moved into current liabilities.",
          matters:
            "It moves on its own, with no transaction and no announcement, as a repayment date comes into range. It is the single most common reason a current ratio falls off a cliff between two balance sheets.",
          driver: "currentPortionLtd",
        },
      ],
      worked: [
        "Capital employed: ₹162.2 cr of equity plus ₹150.0 cr of debt = ₹312.2 cr, against ₹150.6 cr a year ago.",
        "ROCE: ₹25.3 cr of EBIT ÷ ₹312.2 cr = 8.1%, against 14.8% last year.",
        "Decomposed: an EBIT margin of 10.6% (₹25.3 cr ÷ ₹238 cr) × a capital turnover of 0.76 (₹238 cr ÷ ₹312.2 cr) = 8.1%. Last year that was 11.4% × 1.30 = 14.8%.",
        "The margin fell by seven-tenths of a point. The turnover fell by 42%.",
      ],
    },
  },

  northStar: "roce",
  reported: [
    "roce",
    "capitalTurnover",
    "interestCover",
    "currentRatio",
    "debtToEquity",
    "ebit",
    "netProfit",
  ],
  drivers: [
    // ── Trading ──
    { id: "revenue", kind: "input", label: "Revenue", unit: "inr", goodDirection: "up", baseline: 238 * CRORE },
    { id: "cogsRate", kind: "input", label: "Cost of goods, as a share of revenue", unit: "ratio", goodDirection: "down", baseline: 0.672 },
    { id: "cogs", kind: "product", label: "Cost of goods sold", unit: "inr", goodDirection: "down", of: ["revenue", "cogsRate"] },
    { id: "grossProfit", kind: "difference", label: "Gross profit", unit: "inr", goodDirection: "up", minuend: "revenue", subtrahend: "cogs" },
    { id: "opex", kind: "input", label: "Operating expenses", unit: "inr", goodDirection: "down", baseline: 37.56 * CRORE },
    { id: "ebitda", kind: "difference", label: "EBITDA", unit: "inr", goodDirection: "up", minuend: "grossProfit", subtrahend: "opex" },
    { id: "depreciation", kind: "input", label: "Depreciation", unit: "inr", goodDirection: "down", baseline: 15.2 * CRORE },
    { id: "ebit", kind: "difference", label: "Operating profit (EBIT)", unit: "inr", goodDirection: "up", minuend: "ebitda", subtrahend: "depreciation" },

    // ── Current assets ──
    { id: "cash", kind: "input", label: "Cash", unit: "inr", goodDirection: "up", baseline: 4.2 * CRORE },
    { id: "receivables", kind: "input", label: "Receivables", unit: "inr", goodDirection: "down", baseline: 28.6 * CRORE },
    { id: "inventory", kind: "input", label: "Inventory", unit: "inr", goodDirection: "down", baseline: 47.3 * CRORE },
    { id: "otherCurrentAssets", kind: "input", label: "Other current assets", unit: "inr", goodDirection: "up", baseline: 5.6 * CRORE },
    { id: "currentAssets", kind: "sum", label: "Current assets", unit: "inr", goodDirection: "up", of: ["cash", "receivables", "inventory", "otherCurrentAssets"] },

    // ── Current liabilities. `currentPortionLtd` is the whole liquidity story:
    //    nothing was borrowed this year, a repayment date simply came into
    //    range and ₹64 crore moved column. ──
    { id: "payables", kind: "input", label: "Payables", unit: "inr", goodDirection: "up", baseline: 19.4 * CRORE },
    { id: "shortTermDebt", kind: "input", label: "Working-capital facility", unit: "inr", goodDirection: "down", baseline: 8.0 * CRORE },
    { id: "currentPortionLtd", kind: "input", label: "Term loan due within a year", unit: "inr", goodDirection: "down", baseline: 64.0 * CRORE },
    { id: "otherCurrentLiabs", kind: "input", label: "Other current liabilities", unit: "inr", goodDirection: "down", baseline: 0.7 * CRORE },
    { id: "currentLiabilities", kind: "sum", label: "Current liabilities", unit: "inr", goodDirection: "down", of: ["payables", "shortTermDebt", "currentPortionLtd", "otherCurrentLiabs"] },

    // ── Liquidity ──
    { id: "currentRatio", kind: "quotient", label: "Current ratio", unit: "multiple", goodDirection: "up", numerator: "currentAssets", denominator: "currentLiabilities" },
    { id: "quickAssets", kind: "difference", label: "Current assets excluding stock", unit: "inr", goodDirection: "up", minuend: "currentAssets", subtrahend: "inventory" },
    { id: "quickRatio", kind: "quotient", label: "Quick ratio", unit: "multiple", goodDirection: "up", numerator: "quickAssets", denominator: "currentLiabilities" },

    // ── The capital side ──
    { id: "netFixedAssets", kind: "input", label: "Property, plant and equipment", unit: "inr", goodDirection: "up", baseline: 268 * CRORE },
    { id: "totalAssets", kind: "sum", label: "Total assets", unit: "inr", goodDirection: "up", of: ["currentAssets", "netFixedAssets"] },
    { id: "longTermDebt", kind: "input", label: "Term loan due after a year", unit: "inr", goodDirection: "down", baseline: 78 * CRORE },
    { id: "totalDebt", kind: "sum", label: "Total debt", unit: "inr", goodDirection: "down", of: ["longTermDebt", "shortTermDebt", "currentPortionLtd"] },
    { id: "equity", kind: "input", label: "Shareholders' equity", unit: "inr", goodDirection: "up", baseline: 162.2 * CRORE },
    { id: "debtToEquity", kind: "quotient", label: "Debt to equity", unit: "multiple", goodDirection: "down", numerator: "totalDebt", denominator: "equity" },
    { id: "capitalEmployed", kind: "sum", label: "Capital employed", unit: "inr", goodDirection: "down", of: ["equity", "totalDebt"] },

    // ── The returns, and the decomposition that says which half broke ──
    { id: "roce", kind: "quotient", label: "Return on capital employed", unit: "ratio", goodDirection: "up", numerator: "ebit", denominator: "capitalEmployed" },
    { id: "ebitMargin", kind: "quotient", label: "EBIT margin", unit: "ratio", goodDirection: "up", numerator: "ebit", denominator: "revenue" },
    { id: "capitalTurnover", kind: "quotient", label: "Capital turnover", unit: "multiple", goodDirection: "up", numerator: "revenue", denominator: "capitalEmployed" },
    { id: "assetTurnover", kind: "quotient", label: "Asset turnover", unit: "multiple", goodDirection: "up", numerator: "revenue", denominator: "totalAssets" },

    // ── Cost of the debt, and the covenant it is tested against ──
    { id: "interestRate", kind: "input", label: "Average cost of debt", unit: "ratio", goodDirection: "down", baseline: 0.099 },
    { id: "interest", kind: "product", label: "Interest", unit: "inr", goodDirection: "down", of: ["totalDebt", "interestRate"] },
    { id: "interestCover", kind: "quotient", label: "Interest cover", unit: "multiple", goodDirection: "up", numerator: "ebit", denominator: "interest" },

    { id: "pbt", kind: "difference", label: "Profit before tax", unit: "inr", goodDirection: "up", minuend: "ebit", subtrahend: "interest" },
    { id: "taxRate", kind: "constant", label: "Tax rate", unit: "ratio", goodDirection: "down", value: 0.25 },
    { id: "tax", kind: "product", label: "Tax", unit: "inr", goodDirection: "down", of: ["pbt", "taxRate"] },
    { id: "netProfit", kind: "difference", label: "Net profit", unit: "inr", goodDirection: "up", minuend: "pbt", subtrahend: "tax" },
    { id: "roe", kind: "quotient", label: "Return on equity", unit: "ratio", goodDirection: "up", numerator: "netProfit", denominator: "equity" },
  ],

  dashboard: [
    {
      id: "p-bs-balance",
      kind: "statement",
      statement: "balance",
      title: "Deccan Ceramics — balance sheet at 31 March",
      caption: "₹ crore. Nothing was borrowed this year; ₹64 crore simply came due.",
      unit: "inr",
      periods: ["FY25", "FY24"],
      sections: [
        {
          title: "Assets",
          lines: [
            { label: "Cash", value: 4.2 * CRORE, priorValue: 9.8 * CRORE, indent: true, goodDirection: "up" },
            { label: "Receivables", value: 28.6 * CRORE, priorValue: 24.1 * CRORE, indent: true },
            { label: "Inventory", value: 47.3 * CRORE, priorValue: 31.6 * CRORE, indent: true, note: "Stock built to run the third kiln at a volume the order book has not reached." },
            { label: "Other current assets", value: 5.6 * CRORE, priorValue: 4.4 * CRORE, indent: true },
            { label: "Total current assets", value: 85.7 * CRORE, priorValue: 69.9 * CRORE, emphasis: true },
            { label: "Property, plant and equipment", value: 268.0 * CRORE, priorValue: 112.4 * CRORE, indent: true, note: "The third kiln was commissioned in June FY25." },
            { label: "Total assets", value: 353.7 * CRORE, priorValue: 182.3 * CRORE, emphasis: true },
          ],
        },
        {
          title: "Liabilities",
          lines: [
            { label: "Payables", value: 19.4 * CRORE, priorValue: 21.3 * CRORE, indent: true },
            { label: "Working-capital facility", value: 8.0 * CRORE, priorValue: 5.2 * CRORE, indent: true, goodDirection: "down" },
            { label: "Term loan due within a year", value: 64.0 * CRORE, priorValue: 6.0 * CRORE, indent: true, goodDirection: "down", note: "The moratorium ended. No new borrowing — this moved column on a date." },
            { label: "Other current liabilities", value: 0.7 * CRORE, priorValue: 0.6 * CRORE, indent: true },
            { label: "Total current liabilities", value: 92.1 * CRORE, priorValue: 33.1 * CRORE, emphasis: true, goodDirection: "down" },
            { label: "Term loan due after a year", value: 78.0 * CRORE, priorValue: 21.0 * CRORE, indent: true, goodDirection: "down" },
            { label: "Deferred tax and provisions", value: 21.4 * CRORE, priorValue: 9.8 * CRORE, indent: true },
          ],
        },
        {
          title: "Equity",
          lines: [
            { label: "Share capital and reserves", value: 162.2 * CRORE, priorValue: 118.4 * CRORE, indent: true, goodDirection: "up", note: "A ₹36 crore rights issue part-funded the kiln." },
            { label: "Total liabilities and equity", value: 353.7 * CRORE, priorValue: 182.3 * CRORE, emphasis: true },
          ],
        },
      ],
    },
    {
      id: "p-bs-pnl",
      kind: "statement",
      statement: "pnl",
      title: "The trading year the managing director wants to announce",
      caption: "₹ crore.",
      unit: "inr",
      periods: ["FY25", "FY24"],
      sections: [
        {
          lines: [
            { label: "Revenue", value: 238.0 * CRORE, priorValue: 196.0 * CRORE, goodDirection: "up" },
            { label: "EBITDA", value: 40.5 * CRORE, priorValue: 30.9 * CRORE, emphasis: true, goodDirection: "up", note: "Up 31%. The best in the company's history, and entirely true." },
            { label: "Depreciation", value: -15.2 * CRORE, priorValue: -8.6 * CRORE, indent: true },
            { label: "Operating profit (EBIT)", value: 25.3 * CRORE, priorValue: 22.3 * CRORE, emphasis: true, goodDirection: "up" },
            { label: "Interest", value: -14.85 * CRORE, priorValue: -3.19 * CRORE, indent: true, goodDirection: "down" },
            { label: "Profit before tax", value: 10.45 * CRORE, priorValue: 19.11 * CRORE, emphasis: true, goodDirection: "up" },
            { label: "Net profit", value: 7.84 * CRORE, priorValue: 14.33 * CRORE, emphasis: true, goodDirection: "up" },
          ],
        },
      ],
    },
    {
      id: "p-bs-room",
      kind: "note",
      title: "What the room is saying",
      body:
        "Managing director: EBITDA is up 31% and it is the best number this company has ever printed. Lead the announcement with it.\n" +
        "Finance director: we have a current ratio under 1 and an interest-cover covenant at 2.0×. Refinance the term loan to a ten-year tenor and the going-concern paragraph goes away.\n" +
        "Auditor: the emphasis of matter stands until the twelve-month repayment profile is addressed.\n" +
        "Sales head: the third kiln is the future. Give it two more years.\n" +
        "Nobody has divided the operating profit by the capital it took to earn it.",
    },
  ],

  budget: { analystDays: 7, sprints: 4, rupees: 16 * CRORE },

  drilldowns: [
    {
      id: "dd-dupont",
      label: "Decompose the return into margin and turnover",
      question: "ROCE halved. Was that the profit or the capital?",
      cost: 3,
      evidenceFor: ["capital.idle", "trading.margin"],
      readsAs:
        "EBIT margin went from 11.4% to 10.6% and capital turnover from 1.30 to 0.76. Almost the entire fall is the denominator: the company put ₹162 crore of new capital in and earned ₹3 crore more operating profit on it.",
      reveals: [
        {
          id: "p-dupont",
          kind: "segments",
          title: "ROCE = EBIT margin × capital turnover",
          caption: "FY25 against FY24.",
          dimension: "Component",
          rows: [
            { label: "EBIT margin", value: 0.106, unit: "ratio", deltaPct: -0.066 },
            { label: "Capital turnover", value: 0.762, unit: "multiple", deltaPct: -0.415 },
            { label: "ROCE", value: 0.081, unit: "ratio", deltaPct: -0.453 },
          ],
        },
        {
          id: "p-dupont-note",
          kind: "note",
          title: "The same arithmetic in words",
          body:
            "FY24: 11.4% × 1.30 = 14.8%.\nFY25: 10.6% × 0.76 = 8.1%.\n\n" +
            "Capital employed went from ₹150.6 crore to ₹312.2 crore — up ₹161.6 crore. Operating profit went from ₹22.3 crore to ₹25.3 crore — up ₹3.0 crore. The incremental return on the new capital is about 1.9%.\n\n" +
            "The company borrows at 9.9%.",
        },
      ],
    },
    {
      id: "dd-kiln-util",
      label: "Capacity and utilisation, kiln by kiln",
      question: "Is the new capacity being used?",
      cost: 3,
      evidenceFor: ["capital.idle", "trading.demand"],
      readsAs:
        "Kilns one and two run at 91% and 88%. The new kiln runs at 46% and is 58% of the net book value. More than half the capital added last year is producing nothing for more than half the time.",
      reveals: [
        {
          id: "p-kiln-util",
          kind: "segments",
          title: "Utilisation by line",
          dimension: "Kiln",
          rows: [
            { label: "Kiln 1 — commissioned FY16", value: 0.91, unit: "ratio" },
            { label: "Kiln 2 — commissioned FY20", value: 0.88, unit: "ratio" },
            { label: "Kiln 3 — commissioned FY25", value: 0.46, unit: "ratio" },
          ],
        },
        {
          id: "p-kiln-note",
          kind: "note",
          title: "What is on the third line",
          body:
            "Kiln 3 has 12.0 million sq m of annual capacity and produced 5.5 million. Its net book value is ₹155 crore of the ₹268 crore total.\n\n" +
            "The commissioning plan assumed 78% by year two on the strength of a large-format export programme that has not been signed. Two national retail brands have separately asked about private-label contract manufacturing at roughly 8% below our own realisation — the enquiry has been sitting with sales for five months because it 'dilutes the brand'.\n\n" +
            "The Hosur land parcel and the mothballed second-hand press bought with it are carried at ₹34.8 crore and are not in the production plan at all.",
        },
      ],
    },
    {
      id: "dd-ratios",
      label: "Run the standard ratio pack",
      question: "Which ratios actually broke, and by how much?",
      cost: 3,
      evidenceFor: ["capital.idle", "funding.maturity", "funding.leverage"],
      readsAs:
        "Every liquidity and return ratio deteriorated and every trading ratio held. That pattern — trading flat, balance sheet ratios collapsing — points at the capital side before a single further pull is bought.",
      reveals: [
        {
          id: "p-ratios",
          kind: "stat",
          title: "FY25 ratio pack",
          caption: "Change against FY24.",
          tiles: [
            { label: "Current ratio", value: 0.93, unit: "multiple", deltaPct: -0.559, goodDirection: "up" },
            { label: "Quick ratio", value: 0.42, unit: "multiple", deltaPct: -0.64, goodDirection: "up" },
            { label: "Debt to equity", value: 0.92, unit: "multiple", deltaPct: 2.4, goodDirection: "down" },
            { label: "Interest cover", value: 1.7, unit: "multiple", deltaPct: -0.756, goodDirection: "up" },
            { label: "ROCE", value: 0.081, unit: "ratio", deltaPct: -0.453, goodDirection: "up" },
            { label: "Asset turnover", value: 0.673, unit: "multiple", deltaPct: -0.374, goodDirection: "up" },
            { label: "Gross margin", value: 0.328, unit: "ratio", deltaPct: -0.012, goodDirection: "up" },
            { label: "EBITDA margin", value: 0.17, unit: "ratio", deltaPct: 0.079, goodDirection: "up" },
            { label: "Return on equity", value: 0.048, unit: "ratio", deltaPct: -0.601, goodDirection: "up" },
          ],
        },
      ],
    },
    {
      id: "dd-loan-schedule",
      label: "The repayment schedule and the covenant pack",
      question: "What actually falls due, and what has been promised to the bank?",
      cost: 2,
      evidenceFor: ["funding.maturity", "funding.leverage"],
      readsAs:
        "A 15-year kiln was funded with a 5-year loan on a 2-year moratorium that has just ended. Nothing was borrowed this year — ₹64 crore reclassified as current on a date, and that alone took the current ratio from 2.11 to 0.93.",
      reveals: [
        {
          id: "p-loan-schedule",
          kind: "timeseries",
          title: "Term loan repayment profile",
          caption: "₹ crore falling due, by financial year.",
          series: [
            {
              label: "Repayment due",
              unit: "inr",
              points: [
                { period: "FY25", value: 6.0 * CRORE },
                { period: "FY26", value: 64.0 * CRORE },
                { period: "FY27", value: 40.0 * CRORE },
                { period: "FY28", value: 38.0 * CRORE },
                { period: "FY29", value: 0 },
              ],
            },
          ],
        },
        {
          id: "p-covenant-note",
          kind: "note",
          title: "Covenant pack, tested at each half-year",
          body:
            "Interest cover not less than 2.00×. Reported this half-year: 1.70×. Breached.\n" +
            "Debt to equity not more than 1.25×. Reported: 0.92×. Complied.\n" +
            "Current ratio not less than 1.00×. Reported: 0.93×. Breached.\n\n" +
            "The lender has indicated it will consider a ten-year amortising refinance of the outstanding ₹142 crore, at approximately 80 basis points above the current blended rate. The asset has a fifteen-year life.",
        },
      ],
    },
    {
      id: "dd-wc-detail",
      label: "Age the stock and the debtors",
      question: "Is there cash trapped in current assets?",
      cost: 2,
      evidenceFor: ["capital.workingcapital"],
      readsAs:
        "Stock rose ₹15.7 crore on revenue up ₹42 crore, and ₹11 crore of it is large-format tile made to fill the new kiln rather than to fill an order. Real money, and about a fifteenth of the capital sitting in the kiln itself.",
      reveals: [
        {
          id: "p-wc-detail",
          kind: "segments",
          title: "₹47.3 crore of inventory",
          dimension: "Category",
          rows: [
            { label: "Raw material and glaze", value: 12.4 * CRORE, unit: "inr" },
            { label: "Finished goods, core sizes", value: 23.9 * CRORE, unit: "inr" },
            { label: "Finished goods, large format", value: 11.0 * CRORE, unit: "inr" },
          ],
        },
        {
          id: "p-wc-note",
          kind: "note",
          title: "Debtors",
          body:
            "Receivables are 43.9 days against 44.9 last year, and the ageing profile is unchanged. Collections are not the problem here.",
        },
      ],
    },
    {
      id: "dd-price-volume",
      label: "What the market will take",
      question: "Could we price our way out, or sell our way out?",
      cost: 2,
      evidenceFor: ["trading.demand", "trading.margin"],
      readsAs:
        "A 5% price rise loses about 6% of volume in a market with Morbi capacity spare everywhere — roughly flat revenue at a slightly better margin. The volume for the third kiln exists, at a price, and it is contract manufacturing rather than the brand.",
      reveals: [
        {
          id: "p-price-volume",
          kind: "segments",
          title: "Demand response, from the last two price moves",
          dimension: "Scenario",
          rows: [
            { label: "Price +5%, volume", value: -0.06, unit: "ratio" },
            { label: "Price +5%, revenue", value: -0.01, unit: "ratio" },
            { label: "Private-label enquiry, realisation against own brand", value: -0.08, unit: "ratio" },
            { label: "Private-label enquiry, volume available", value: 0.2, unit: "ratio" },
          ],
        },
      ],
    },
    {
      id: "dd-peer",
      label: "Sector comparison",
      question: "Is this a Deccan problem or a tile problem?",
      cost: 2,
      evidenceFor: ["trading.margin"],
      readsAs:
        "Deccan's EBITDA margin is the best of the four listed comparables and its ROCE is the worst. That combination has only one explanation, and it is not on the profit and loss statement.",
      reveals: [
        {
          id: "p-peer",
          kind: "segments",
          title: "Listed Morbi comparables, FY25",
          dimension: "Company",
          rows: [
            { label: "Deccan — EBITDA margin", value: 0.17, unit: "ratio" },
            { label: "Peer median — EBITDA margin", value: 0.152, unit: "ratio" },
            { label: "Deccan — ROCE", value: 0.081, unit: "ratio" },
            { label: "Peer median — ROCE", value: 0.164, unit: "ratio" },
            { label: "Peer median — capital turnover", value: 1.21, unit: "multiple" },
          ],
        },
      ],
    },
  ],

  causes: [
    { id: "capital", parentId: null, label: "The capital side", verdict: "Where the whole problem is." },
    {
      id: "capital.idle",
      parentId: "capital",
      label: "We built capacity we are not using",
      verdict:
        "This was it. ₹161.6 crore of new capital employed produced ₹3.0 crore of extra operating profit — an incremental return of about 1.9% against debt costing 9.9%. Kiln 3 runs at 46% and is 58% of the net book value, and ₹34.8 crore of land and idle plant is not in the production plan at all.",
    },
    {
      id: "capital.workingcapital",
      parentId: "capital",
      label: "Cash is trapped in stock and debtors",
      verdict:
        "Partly true and much the smaller half. Stock rose ₹15.7 crore, about ₹11 crore of it large-format made to feed the new kiln. Debtor days actually improved. Worth recovering, and a fifteenth of the capital sitting in the kiln.",
    },
    { id: "funding", parentId: null, label: "How the expansion was funded", verdict: "Badly, and separately from why it is not earning." },
    {
      id: "funding.maturity",
      parentId: "funding",
      label: "We funded a 15-year asset with 5-year money",
      verdict:
        "Entirely true, and it explains the liquidity crisis rather than the return. ₹64 crore reclassifying as current took the current ratio from 2.11 to 0.93 with no transaction at all. Refinancing fixes that and moves the return on capital by nothing, because a liability changing column does not change how much capital is employed.",
    },
    {
      id: "funding.leverage",
      parentId: "funding",
      label: "We simply borrowed too much",
      verdict:
        "Debt to equity of 0.92× is inside the 1.25× covenant and unremarkable for the sector. Leverage decided how quickly this became urgent; it did not decide that the capital would earn 1.9%. Swapping ₹40 crore of debt for ₹40 crore of equity leaves capital employed — and therefore ROCE — exactly where it was.",
    },
    { id: "trading", parentId: null, label: "The trading performance", verdict: "Is the best it has ever been." },
    {
      id: "trading.margin",
      parentId: "trading",
      label: "Margins are thinner than they were",
      verdict:
        "EBIT margin fell 0.8 points, and EBITDA margin actually rose to 17% — the best of the four listed comparables. A company with the sector's best margin and its worst ROCE does not have a margin problem.",
    },
    {
      id: "trading.demand",
      parentId: "trading",
      label: "The demand for the extra capacity is not there",
      verdict:
        "The demand exists at a price. Two national brands have asked about private-label contract manufacturing at 8% below own-brand realisation, for about 20% more volume, and the enquiry has sat with sales for five months because it dilutes the brand. On a kiln at 46%, 8% off realisation is an extremely cheap way to buy utilisation.",
    },
  ],
  trueCauseIds: ["capital.idle"],

  interventions: [
    {
      id: "iv-fill-kiln",
      label: "Take the private-label contract manufacturing",
      pitch:
        "Sign the two national brands for large-format contract manufacture at 8% below own-brand realisation. Fills Kiln 3 from 46% toward 80% with volume that already exists.",
      addresses: "capital.idle",
      cost: { sprints: 2, rupees: 9 * CRORE },
      minSprints: 2,
      effects: {
        whenRootCause: [
          { driver: "revenue", deltaPct: 0.2, rampQuarters: 3 },
          // Private label sells at a discount. The margin is worse and the
          // capital was already bought, which is the entire argument.
          { driver: "cogsRate", deltaPct: 0.012, rampQuarters: 3 },
        ],
        otherwise: [
          { driver: "revenue", deltaPct: 0.06, rampQuarters: 3 },
          { driver: "cogsRate", deltaPct: 0.012, rampQuarters: 3 },
        ],
      },
      debrief:
        "The single largest lever, and the one the room refused to look at for five months. Contribution on a fixed asset you have already paid for is almost pure return — 8% off realisation on a kiln running at 46% is cheap utilisation, and utilisation is the half of the return that broke.",
    },
    {
      id: "iv-selldown",
      label: "Sell the Hosur land and idle press, and repay debt",
      pitch:
        "₹34.8 crore of land and mothballed plant is in the production plan of nobody. Sell it and take the proceeds straight off the term loan.",
      addresses: "capital.idle",
      cost: { sprints: 2, rupees: 6 * CRORE },
      minSprints: 2,
      effects: {
        // Both sides of the entry, so the balance sheet still balances: ₹34.8cr
        // off fixed assets is ₹34.8cr off the term loan (44.67% of ₹78cr).
        whenRootCause: [
          { driver: "netFixedAssets", deltaPct: -0.13, rampQuarters: 2 },
          { driver: "longTermDebt", deltaPct: -0.4467, rampQuarters: 2 },
          { driver: "depreciation", deltaPct: -0.09, rampQuarters: 2 },
        ],
        otherwise: [
          { driver: "netFixedAssets", deltaPct: -0.13, rampQuarters: 2 },
          { driver: "longTermDebt", deltaPct: -0.4467, rampQuarters: 2 },
          { driver: "depreciation", deltaPct: -0.09, rampQuarters: 2 },
        ],
      },
      debrief:
        "The unglamorous half of the answer and the one that works on the denominator directly. Capital employed falls ₹34.8 crore, interest falls with it, and not one rupee of operating profit is given up — the assets sold were producing nothing.",
    },
    {
      id: "iv-refinance",
      label: "Refinance the term loan over ten years",
      pitch:
        "The finance director's proposal. Term the ₹142 crore out over ten years at about 80 basis points more, match the loan to the asset's life, and clear the going-concern paragraph.",
      addresses: "funding.maturity",
      cost: { sprints: 2, rupees: 4 * CRORE },
      effects: {
        whenRootCause: [
          { driver: "currentPortionLtd", deltaPct: -0.72 },
          { driver: "longTermDebt", deltaPct: 0.591 },
          { driver: "interestRate", deltaPct: 0.081 },
        ],
        otherwise: [
          // Same entries either way: it is a genuine, well-understood
          // transaction. What it is not is an answer to the return.
          { driver: "currentPortionLtd", deltaPct: -0.72 },
          { driver: "longTermDebt", deltaPct: 0.591 },
          { driver: "interestRate", deltaPct: 0.081 },
        ],
      },
      debrief:
        "Genuinely worth doing and not an answer to the question asked. The current ratio goes from 0.93 to about 1.86 and the auditor's paragraph goes away — but total debt is unchanged, so capital employed is unchanged, so ROCE is unchanged, and the extra 80 basis points makes interest cover slightly worse. It buys time to fix the real problem and is not itself the fix.",
    },
    {
      id: "iv-equity",
      label: "Raise ₹40 crore of equity and repay the term loan",
      pitch:
        "De-risk the balance sheet. A ₹40 crore rights issue takes debt to equity to 0.54× and interest cover clear of the covenant.",
      addresses: "funding.leverage",
      cost: { sprints: 1, rupees: 5 * CRORE },
      effects: {
        whenRootCause: [
          { driver: "equity", deltaPct: 0.2466 },
          { driver: "longTermDebt", deltaPct: -0.5128 },
        ],
        otherwise: [
          { driver: "equity", deltaPct: 0.2466 },
          { driver: "longTermDebt", deltaPct: -0.5128 },
        ],
      },
      debrief:
        "The clearest illustration in the scenario of what ROCE actually measures. Debt to equity halves, interest cover clears the covenant, net profit rises because interest falls — and the return on capital employed does not move by a single basis point, because capital employed is equity plus debt and ₹40 crore simply moved from one to the other. The owners are diluted for it.",
    },
    {
      id: "iv-working-capital",
      label: "Clear the large-format stock and repay the facility",
      pitch:
        "₹11 crore of large-format finished goods was made to feed the kiln, not to fill an order. Sell it down and pay off the working-capital facility.",
      addresses: "capital.workingcapital",
      cost: { sprints: 2, rupees: 3 * CRORE },
      effects: {
        whenRootCause: [
          { driver: "inventory", deltaPct: -0.22, rampQuarters: 2 },
          { driver: "shortTermDebt", deltaPct: -0.5, rampQuarters: 2 },
        ],
        otherwise: [
          { driver: "inventory", deltaPct: -0.22, rampQuarters: 2 },
          { driver: "shortTermDebt", deltaPct: -0.5, rampQuarters: 2 },
          // Clearing stock into a soft market costs something on the way out.
          { driver: "cogsRate", deltaPct: 0.006 },
        ],
      },
      debrief:
        "Worth doing, and small. It frees about ₹10 crore of cash from stock, of which ₹4 crore comes off capital employed as the facility is repaid — against ₹162 crore of new capital employed. And, the counter-intuitive part, it slightly *lowers* the current ratio, from 0.93 to 0.86: taking the same amount off both sides hurts when the ratio is already below one.",
    },
    {
      id: "iv-price-up",
      label: "Take 5% on tile prices",
      pitch:
        "Recover the margin. The last two price moves suggest 5% costs about 6% of volume, which is close to revenue-neutral at a better margin.",
      addresses: "trading.margin",
      cost: { sprints: 1, rupees: 2 * CRORE },
      effects: {
        whenRootCause: [
          { driver: "revenue", deltaPct: -0.01 },
          { driver: "cogsRate", deltaPct: -0.012 },
        ],
        otherwise: [
          { driver: "revenue", deltaPct: -0.01 },
          { driver: "cogsRate", deltaPct: -0.012 },
        ],
      },
      debrief:
        "Addresses the half of the return that did not break. It adds a little margin and takes volume off a kiln that is already half idle — which is the precise opposite of what a business with the sector's best margin and its worst capital turnover needs.",
    },
  ],

  // Morbi is adding capacity faster than demand, so realisation slips and a
  // half-idle kiln keeps costing what it costs.
  drift: [
    { driver: "revenue", deltaPct: -0.012 },
    { driver: "opex", deltaPct: 0.018 },
  ],
  horizonQuarters: 4,
  periodNoun: "quarter",

  parInvestigation: ["dd-dupont", "dd-kiln-util"],
  bestAllocation: [
    { interventionId: "iv-fill-kiln", sprints: 2, rupees: 9 * CRORE },
    { interventionId: "iv-selldown", sprints: 2, rupees: 6 * CRORE },
  ],

  debrief: {
    causalChain: [
      "A ₹120 crore term loan funded a third kiln, taking property, plant and equipment from ₹112 crore to ₹268 crore and capital employed from ₹150.6 crore to ₹312.2 crore.",
      "Kiln 3 runs at 46% against a plan of 78%, because the export programme it was built for was never signed. It is 58% of the net book value.",
      "Operating profit rose ₹3.0 crore on ₹161.6 crore of new capital — an incremental return of about 1.9%, against debt costing 9.9%.",
      "So ROCE fell from 14.8% to 8.1%: the EBIT margin moved only from 11.4% to 10.6%, while capital turnover fell from 1.30 to 0.76.",
      "Separately, the loan's two-year moratorium ended, so ₹64 crore reclassified from non-current to current with no transaction at all — taking the current ratio from 2.11 to 0.93 and the quick ratio to 0.42.",
      "Interest rose from ₹3.19 crore to ₹14.85 crore, putting interest cover at 1.70× against a 2.00× covenant, which is why record EBITDA and a going-concern paragraph arrived in the same week.",
    ],
    whereTheLeverageWas:
      "Both halves of the capital turnover. Filling Kiln 3 with the private-label volume that has been sitting unanswered for five months uses the asset that was already bought; selling the Hosur land and idle press takes ₹34.8 crore of capital out that was producing nothing and repays debt with it. Refinancing and the rights issue are both sensible transactions that move liquidity and leverage and leave the return exactly where it was — which is the most useful thing this scenario has to teach.",
    strongAnswer:
      "Take the two statements at face value: EBITDA really is a record and the balance sheet really is in trouble, and they are not in conflict because a P&L cannot see capital. So divide one by the other. ROCE is 8.1% against 14.8%, and the decomposition says which half broke: EBIT margin 11.4% to 10.6%, capital turnover 1.30 to 0.76. That is a denominator problem, and ₹161.6 crore of new capital returning ₹3.0 crore — about 1.9% incremental against debt at 9.9% — is the whole story. Confirm it physically rather than by ratio: kilns one and two run at 91% and 88%, kiln three at 46% and it is 58% of the book value, plus ₹34.8 crore of land and idle plant in nobody's production plan. The peer table settles the argument — best EBITDA margin of the four comparables, worst ROCE — because a company can only have both if its capital turnover is the outlier. From there, the answer is to make the capital work or to stop owning it: sign the private-label volume even at 8% below own-brand realisation, because contribution on an asset already paid for is nearly all return, and sell what is not in the plan. The liquidity crisis is real and is a separate fact — ₹64 crore moved column on a date, not on a decision — so refinance to match the fifteen-year asset, and be clear that it buys time rather than earnings. The rights issue is the instructive trap: it halves debt to equity, clears the covenant, and moves ROCE by nothing at all, because ₹40 crore simply crosses from one side of capital employed to the other.",
  },

  coachFallback: [
    {
      topic: ["roce", "return on capital", "8.1", "denominator", "capital employed"],
      answer:
        "ROCE fell from 14.8% to 8.1% because capital employed went from ₹150.6 crore to ₹312.2 crore while operating profit went from ₹22.3 crore to ₹25.3 crore. That is an incremental return of about 1.9% on the new capital, against debt costing 9.9%.",
    },
    {
      topic: ["dupont", "margin", "turnover", "decompose", "capital turnover"],
      answer:
        "The decomposition is the move: ROCE is EBIT margin times capital turnover. FY24 was 11.4% × 1.30 = 14.8%; FY25 is 10.6% × 0.76 = 8.1%. The margin fell 0.8 points and the turnover fell 42%, so this was never a trading problem.",
    },
    {
      topic: ["kiln", "utilisation", "46", "idle", "capacity", "third kiln"],
      answer:
        "Kilns one and two run at 91% and 88%; kiln three runs at 46% and is 58% of the net book value. It has 12 million sq m of capacity and made 5.5 million, against a plan of 78% built on an export programme that was never signed.",
    },
    {
      topic: ["current ratio", "quick ratio", "liquidity", "going concern", "0.93", "64 crore"],
      answer:
        "Nothing was borrowed this year. The loan's two-year moratorium ended, so ₹64 crore reclassified from non-current to current on a date, and that alone took the current ratio from 2.11 to 0.93 and the quick ratio to 0.42. A liquidity crisis with no transaction behind it.",
    },
    {
      topic: ["refinance", "tenor", "ten year", "maturity", "match"],
      answer:
        "Refinancing is worth doing and is not the answer. It takes the current ratio to about 1.86 and clears the auditor's paragraph, but total debt is unchanged, so capital employed is unchanged and ROCE does not move — and the extra 80 basis points makes interest cover slightly worse.",
    },
    {
      topic: ["equity", "rights issue", "leverage", "debt to equity", "dilute", "de-risk"],
      answer:
        "The rights issue is the clearest lesson here: ₹40 crore of equity repaying ₹40 crore of debt halves debt-to-equity and clears the covenant, and moves ROCE by not one basis point — because capital employed is equity plus debt, and the money just crossed from one to the other. The owners are diluted for it.",
    },
    {
      topic: ["interest cover", "covenant", "1.7", "2.0", "breach", "bank"],
      answer:
        "Interest cover is 1.70× against a 2.00× covenant, breached, and the current-ratio covenant at 1.00× is breached too. Interest went from ₹3.19 crore to ₹14.85 crore — the cost of ₹150 crore of debt against ₹32 crore last year.",
    },
    {
      topic: ["private label", "contract manufacturing", "8%", "brand", "dilute the brand"],
      answer:
        "Two national brands asked about private-label contract manufacture at 8% below own-brand realisation for about 20% more volume, and it sat with sales for five months. On a kiln at 46% utilisation, contribution on an asset already paid for is almost entirely return — 8% off realisation is a very cheap way to buy the turnover that broke.",
    },
    {
      topic: ["ebitda", "record", "31%", "trading", "peer", "sector"],
      answer:
        "EBITDA really is a record and the EBITDA margin of 17% is the best of the four listed comparables — while ROCE at 8.1% is the worst against a peer median of 16.4%. A company can only hold both of those at once if its capital turnover is the outlier, which is exactly the diagnosis.",
    },
    {
      topic: ["inventory", "stock", "working capital", "large format", "receivables"],
      answer:
        "Stock rose ₹15.7 crore, about ₹11 crore of it large-format made to feed the kiln rather than to fill an order, and debtor days actually improved slightly. Clearing it releases about ₹10 crore against ₹162 crore of new capital — worth doing, and a fifteenth of the problem.",
    },
    {
      topic: ["land", "hosur", "sell", "leaseback", "sale", "press"],
      answer:
        "The Hosur land and the mothballed press are carried at ₹34.8 crore and are in nobody's production plan. Selling them takes ₹34.8 crore straight out of capital employed and off the term loan, and gives up no operating profit at all because they were producing none.",
    },
    {
      topic: ["price", "5%", "raise prices", "realisation"],
      answer:
        "A 5% price rise costs about 6% of volume in a market with spare capacity everywhere — roughly revenue-neutral at a slightly better margin. It addresses the half of the return that did not break, and takes volume off a kiln that is already half idle.",
    },
  ],
};
