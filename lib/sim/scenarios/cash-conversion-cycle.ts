/**
 * "A record profit and no money for payroll."
 *
 * The second finance scenario. The first taught a student to read a profit and
 * loss statement; this one teaches them that the statement they just learned to
 * read does not tell them whether the company can pay anybody.
 *
 * ── The truth, for whoever maintains this ─────────────────────────────────
 *
 * The profit is real. So is the hole.
 *
 * Nirmal won large infrastructure orders and grew revenue from ₹71 crore to
 * ₹96 crore. Infra customers pay against certified milestones, so receivable
 * days went from 52 to 118. Stock was built ahead of the monsoon, taking
 * inventory days to 96. And — the part nobody in the room volunteers —
 * procurement took a 2% early-settlement discount from the resin suppliers,
 * which cut payable days from 62 to 34 and was reported as a margin win.
 *
 * Cash conversion cycle: 61 days last year, 180 this year. Working capital went
 * from ₹11.4 crore to ₹42.8 crore, so ₹31.4 crore of cash was absorbed by
 * growth that the P&L records as a record year.
 *
 * The lesson: **profit is an opinion about timing; cash is a fact.** The bridge
 * between them is the change in working capital, and the three levers on that
 * bridge are the days you collect in, hold stock for, and pay in.
 *
 * ── Balance notes ─────────────────────────────────────────────────────────
 *
 * Two things needed care.
 *
 * First, `wcOpening` is a `constant`, not an input. Last year's balance sheet
 * has already happened, so no intervention may move it — and the driver graph
 * is a level model with no time axis, so without it "the *increase* in working
 * capital" cannot be derived at all and the cash bridge would have to be
 * asserted rather than computed. Modelled this way, `operatingCashFlow` is
 * genuinely EBITDA less the movement, which is what an indirect cash flow
 * statement says.
 *
 * Second, the honest answer does not get to zero. Fixing the terms takes free
 * cash flow from about −₹27 crore to about −₹10 crore; it cannot make a company
 * growing 35% cash-generative inside a year. That is deliberate and it is what
 * makes the overdraft a *nuanced* trap rather than a stupid one: borrowing is
 * genuinely part of the answer, and borrowing ₹27 crore because nobody looked at
 * the cycle is not. If a retune ever makes the best allocation cash-positive,
 * the scenario stops teaching that.
 *
 * The supplier-terms lever has to keep its cost — `cogsRate` +1.4%, which is the
 * 2% discount being handed back — or restoring terms becomes free and the trade
 * the scenario is built on disappears.
 */

import type { SimScenario } from "../types";

const CRORE = 10_000_000;

/** Last year's working capital: ₹10.12cr receivables + ₹9.94cr stock − ₹8.68cr payables. */
const WC_OPENING = 11.376 * CRORE;

export const cashConversionCycle: SimScenario = {
  slug: "cash-conversion-cycle",
  title: "Nirmal Pipes: a record profit and no money for payroll",
  company: "Nirmal Pipes",
  premise:
    "A pipe manufacturer just posted its best ever profit and cannot meet next month's salary run. Both statements are true. Find out where the money went.",
  situation:
    "You are the financial analyst at Nirmal Pipes, a PVC and CPVC manufacturer that won its first large infrastructure contracts this year. Revenue rose 35% to ₹96 crore and net profit rose 57% to ₹4.19 crore — the best year in the company's history. " +
    "This morning the treasurer told the managing director there is not enough in the current account to run March payroll. " +
    "The sales head thinks finance is being alarmist. The MD wants to call the bank. You have 6 analyst-days to find out where ₹4 crore of profit turned into an empty account, then 4 sprints and ₹3 crore to do something about it.",
  difficulty: "Easy",

  mentor: {
    persona: "a CFO debriefing a junior financial analyst",
    audience: "analyst",
  },

  teaching: {
    showMetricMap: true,
    primer: {
      intro:
        "A sale becomes profit the moment you ship it and becomes cash the moment somebody pays you, and those can be four months apart. Everything in this scenario lives in that gap.",
      terms: [
        {
          term: "Working capital",
          plain: "The money tied up in running the business day to day — what customers owe you, plus the stock on your shelves, minus what you owe suppliers.",
          formula: "receivables + inventory − payables",
          matters:
            "It is cash you have already earned and cannot spend. Growing a business almost always means growing this, which is why fast growth and an empty bank account go together so often.",
          driver: "workingCapital",
        },
        {
          term: "DSO",
          full: "Days sales outstanding",
          plain: "How many days, on average, between sending an invoice and being paid.",
          formula: "receivables ÷ (revenue ÷ 365)",
          matters:
            "Every extra day is one more day of sales you have funded for your customer out of your own pocket. At ₹96 crore of revenue, one day is ₹26 lakh.",
          driver: "dso",
        },
        {
          term: "DIO",
          full: "Days inventory outstanding",
          plain: "How many days of stock you are holding before it sells.",
          formula: "inventory ÷ (cost of goods ÷ 365)",
          matters:
            "Stock is cash in the shape of pipe. It costs money to hold, and it cannot pay a salary.",
          driver: "dio",
        },
        {
          term: "DPO",
          full: "Days payable outstanding",
          plain: "How many days you take to pay your own suppliers.",
          formula: "payables ÷ (cost of goods ÷ 365)",
          matters:
            "The only one of the three where a bigger number is better for you — your suppliers are funding you for free. Paying early is buying something, and the price is cash.",
          driver: "dpo",
        },
        {
          term: "Cash conversion cycle",
          full: "CCC",
          plain: "How many days pass between paying for materials and being paid for what you made from them.",
          formula: "DSO + DIO − DPO",
          matters:
            "The number of days of trading you have to fund yourself. Multiply it by daily costs and you have the size of the hole. It is the single most useful number in this scenario.",
          driver: "ccc",
        },
        {
          term: "Operating cash flow",
          plain: "The cash the trading actually produced, after the money it had to lock up to produce it.",
          formula: "EBITDA − increase in working capital",
          matters:
            "This is the bridge between profit and cash, and it has exactly one plank. A profitable company with a rising working capital balance can generate negative operating cash flow indefinitely.",
          driver: "operatingCashFlow",
        },
        {
          term: "Free cash flow",
          plain: "What is left for the owners and the lenders after the business has been kept running and re-equipped.",
          formula: "operating cash flow − capex − interest − tax",
          matters:
            "The number that answers 'can we make payroll'. Profit does not answer that question and was never meant to.",
          driver: "freeCashFlow",
        },
        {
          term: "Accrual accounting",
          plain: "The rule that a sale is recorded when it is earned, not when it is paid for.",
          matters:
            "It is why the profit and loss statement is honest and insufficient at the same time. Nothing here is an accounting error — the statement is doing exactly what it is supposed to do.",
        },
      ],
      worked: [
        "₹96 crore of revenue is ₹26.3 lakh of sales a day. At 118 days of DSO, customers are holding ₹31.0 crore of it.",
        "₹69.1 crore of cost of goods is ₹18.9 lakh a day. At 96 days of stock that is ₹18.2 crore, and at 34 days of payables the suppliers are funding only ₹6.4 crore of it.",
        "₹31.0 cr + ₹18.2 cr − ₹6.4 cr = ₹42.8 crore of working capital, against ₹11.4 crore last year.",
        "So ₹31.4 crore of cash went into working capital, against ₹9.48 crore of EBITDA. That subtraction is the whole scenario.",
      ],
    },
  },

  northStar: "freeCashFlow",
  reported: [
    "netProfit",
    "operatingCashFlow",
    "freeCashFlow",
    "ccc",
    "workingCapital",
    "dso",
    "dpo",
  ],
  drivers: [
    // ── The P&L, which is having an excellent year ──
    { id: "revenue", kind: "input", label: "Revenue", unit: "inr", goodDirection: "up", baseline: 96 * CRORE },
    { id: "cogsRate", kind: "input", label: "Cost of goods, as a share of revenue", unit: "ratio", goodDirection: "down", baseline: 0.72 },
    { id: "cogs", kind: "product", label: "Cost of goods sold", unit: "inr", goodDirection: "down", of: ["revenue", "cogsRate"] },
    { id: "grossProfit", kind: "difference", label: "Gross profit", unit: "inr", goodDirection: "up", minuend: "revenue", subtrahend: "cogs" },
    { id: "opex", kind: "input", label: "Operating expenses", unit: "inr", goodDirection: "down", baseline: 17.4 * CRORE },
    { id: "ebitda", kind: "difference", label: "EBITDA", unit: "inr", goodDirection: "up", minuend: "grossProfit", subtrahend: "opex" },
    { id: "depreciation", kind: "input", label: "Depreciation", unit: "inr", goodDirection: "down", baseline: 2.6 * CRORE },
    { id: "ebit", kind: "difference", label: "Operating profit (EBIT)", unit: "inr", goodDirection: "up", minuend: "ebitda", subtrahend: "depreciation" },
    { id: "interest", kind: "input", label: "Interest", unit: "inr", goodDirection: "down", baseline: 1.3 * CRORE },
    { id: "pbt", kind: "difference", label: "Profit before tax", unit: "inr", goodDirection: "up", minuend: "ebit", subtrahend: "interest" },
    { id: "taxRate", kind: "constant", label: "Tax rate", unit: "ratio", goodDirection: "down", value: 0.25 },
    { id: "tax", kind: "product", label: "Tax", unit: "inr", goodDirection: "down", of: ["pbt", "taxRate"] },
    { id: "netProfit", kind: "difference", label: "Net profit", unit: "inr", goodDirection: "up", minuend: "pbt", subtrahend: "tax" },

    // ── The three sets of days, and what they tie up ──
    { id: "daysInYear", kind: "constant", label: "Days in the year", unit: "days", goodDirection: "up", value: 365 },
    { id: "dailyRevenue", kind: "quotient", label: "Revenue per day", unit: "inr", goodDirection: "up", numerator: "revenue", denominator: "daysInYear" },
    { id: "dailyCogs", kind: "quotient", label: "Cost of goods per day", unit: "inr", goodDirection: "down", numerator: "cogs", denominator: "daysInYear" },

    { id: "dso", kind: "input", label: "Days sales outstanding", unit: "days", goodDirection: "down", baseline: 118 },
    { id: "dio", kind: "input", label: "Days inventory outstanding", unit: "days", goodDirection: "down", baseline: 96 },
    // The one set of days where later is better: a supplier waiting is a
    // supplier lending to you, interest-free.
    { id: "dpo", kind: "input", label: "Days payable outstanding", unit: "days", goodDirection: "up", baseline: 34 },

    { id: "receivables", kind: "product", label: "Receivables", unit: "inr", goodDirection: "down", of: ["dso", "dailyRevenue"] },
    { id: "inventory", kind: "product", label: "Inventory", unit: "inr", goodDirection: "down", of: ["dio", "dailyCogs"] },
    { id: "payables", kind: "product", label: "Payables", unit: "inr", goodDirection: "up", of: ["dpo", "dailyCogs"] },

    { id: "grossWorkingCapital", kind: "sum", label: "Receivables + inventory", unit: "inr", goodDirection: "down", of: ["receivables", "inventory"] },
    { id: "workingCapital", kind: "difference", label: "Working capital", unit: "inr", goodDirection: "down", minuend: "grossWorkingCapital", subtrahend: "payables" },

    { id: "dsoPlusDio", kind: "sum", label: "Days to sell and collect", unit: "days", goodDirection: "down", of: ["dso", "dio"] },
    { id: "ccc", kind: "difference", label: "Cash conversion cycle", unit: "days", goodDirection: "down", minuend: "dsoPlusDio", subtrahend: "dpo" },

    /**
     * Last year's balance sheet, and therefore not a lever — which is precisely
     * what `constant` means here. Without it the *movement* in working capital
     * cannot be derived from a level model, and the cash bridge below would be
     * an authored number that could quietly disagree with the days above it.
     */
    { id: "wcOpening", kind: "constant", label: "Working capital a year ago", unit: "inr", goodDirection: "down", value: WC_OPENING },
    { id: "wcIncrease", kind: "difference", label: "Cash absorbed by working capital", unit: "inr", goodDirection: "down", minuend: "workingCapital", subtrahend: "wcOpening" },

    // ── The bridge from earnings to cash ──
    { id: "operatingCashFlow", kind: "difference", label: "Cash generated from operations", unit: "inr", goodDirection: "up", minuend: "ebitda", subtrahend: "wcIncrease" },
    { id: "capex", kind: "input", label: "Capital expenditure", unit: "inr", goodDirection: "down", baseline: 2.2 * CRORE },
    { id: "belowOperations", kind: "sum", label: "Capex, interest and tax paid", unit: "inr", goodDirection: "down", of: ["capex", "interest", "tax"] },
    { id: "freeCashFlow", kind: "difference", label: "Free cash flow", unit: "inr", goodDirection: "up", minuend: "operatingCashFlow", subtrahend: "belowOperations" },
  ],

  dashboard: [
    {
      id: "p-ccc-pnl",
      kind: "statement",
      statement: "pnl",
      title: "Nirmal Pipes — statement of profit and loss",
      caption: "₹ crore. The best year the company has had.",
      unit: "inr",
      periods: ["FY25", "FY24"],
      sections: [
        {
          lines: [
            { label: "Revenue", value: 96.0 * CRORE, priorValue: 71.0 * CRORE, goodDirection: "up", note: "Up 35%, almost entirely the two infrastructure contracts." },
            { label: "Cost of goods sold", value: -69.12 * CRORE, priorValue: -51.12 * CRORE, indent: true },
            { label: "Gross profit", value: 26.88 * CRORE, priorValue: 19.88 * CRORE, emphasis: true, goodDirection: "up" },
            { label: "Operating expenses", value: -17.4 * CRORE, priorValue: -13.6 * CRORE, indent: true },
            { label: "EBITDA", value: 9.48 * CRORE, priorValue: 6.28 * CRORE, emphasis: true, goodDirection: "up" },
            { label: "Depreciation", value: -2.6 * CRORE, priorValue: -2.1 * CRORE, indent: true },
            { label: "Interest", value: -1.3 * CRORE, priorValue: -0.62 * CRORE, indent: true },
            { label: "Profit before tax", value: 5.58 * CRORE, priorValue: 3.56 * CRORE, emphasis: true, goodDirection: "up" },
            { label: "Tax", value: -1.4 * CRORE, priorValue: -0.89 * CRORE, indent: true },
            { label: "Net profit", value: 4.19 * CRORE, priorValue: 2.67 * CRORE, emphasis: true, goodDirection: "up", note: "Up 57%. The board pack leads with this line." },
          ],
        },
      ],
    },
    {
      id: "p-ccc-headline",
      kind: "stat",
      title: "The profit, and the bank balance",
      tiles: [
        { label: "Revenue", value: 96 * CRORE, unit: "inr", deltaPct: 0.352, goodDirection: "up" },
        { label: "Net profit", value: 4.19 * CRORE, unit: "inr", deltaPct: 0.569, goodDirection: "up" },
        { label: "Cash at bank", value: 0.41 * CRORE, unit: "inr", deltaPct: -0.87, goodDirection: "up" },
        { label: "Receivables", value: 31.04 * CRORE, unit: "inr", deltaPct: 2.068, goodDirection: "down" },
        { label: "Inventory", value: 18.18 * CRORE, unit: "inr", deltaPct: 0.828, goodDirection: "down" },
        { label: "Payables", value: 6.44 * CRORE, unit: "inr", deltaPct: -0.258, goodDirection: "up" },
      ],
    },
    // ── Decoys ──────────────────────────────────────────────────────────
    //
    // Three more panels of true, correctly stated fact, none of it evidence
    // for a cause. The collections panel is the most useful kind of decoy: it
    // shows a team working hard and hitting its targets, which is precisely
    // what makes "nobody is chasing hard enough" so tempting and so wrong.
    {
      id: "p-ccc-collections",
      kind: "stat",
      title: "The collections desk",
      caption: "What the two people chasing the money are actually doing.",
      tiles: [
        { label: "Invoices raised on time", value: 0.98, unit: "ratio", goodDirection: "up" },
        { label: "Reminders sent per overdue invoice", value: 4.2, unit: "count", goodDirection: "up" },
        { label: "Value in dispute", value: 0.6, unit: "inr_crore", goodDirection: "down" },
        { label: "Bad debt written off", value: 0.04, unit: "inr_crore", goodDirection: "down" },
      ],
    },
    {
      id: "p-ccc-capex",
      kind: "stat",
      title: "Capital spending and plant",
      caption: "What was bought this year, and whether it is running.",
      tiles: [
        { label: "Capex", value: 3.1, unit: "inr_crore", goodDirection: "down" },
        { label: "Extrusion line utilisation", value: 0.87, unit: "ratio", goodDirection: "up" },
        { label: "Maintenance downtime", value: 0.031, unit: "ratio", goodDirection: "down" },
      ],
    },
    {
      id: "p-ccc-orderbook",
      kind: "segments",
      title: "Order book by segment",
      caption: "What is contracted but not yet despatched.",
      dimension: "Segment",
      rows: [
        { label: "Infrastructure", value: 48.2, unit: "inr_crore", deltaPct: 61.4 },
        { label: "Trade distributors", value: 19.6, unit: "inr_crore", deltaPct: 7.2 },
        { label: "Institutional", value: 6.4, unit: "inr_crore", deltaPct: 12.8 },
      ],
    },
    {
      id: "p-ccc-room",
      kind: "note",
      title: "What the room is saying",
      body:
        "Managing director: we have never made this much money. Call the bank, take another ₹10 crore of overdraft and stop panicking.\n" +
        "Sales head: the infra orders are the best thing that has happened to this company. Whatever this is, it is not a sales problem.\n" +
        "Procurement: we negotiated a 2% early-settlement discount with the resin suppliers this year. That is ₹1 crore straight onto the gross margin — you are welcome.\n" +
        "Treasurer: I have ₹41 lakh in the current account and a ₹1.9 crore payroll on the 28th.",
    },
  ],

  budget: { analystDays: 6, sprints: 4, rupees: 3 * CRORE },

  drilldowns: [
    {
      id: "dd-cash-bridge",
      label: "Reconcile the profit to the cash",
      question: "₹4.19 crore of profit, ₹41 lakh in the bank. Where did the difference go?",
      cost: 2,
      evidenceFor: ["cycle.terms", "cycle.inventory"],
      readsAs:
        "₹31.4 crore was absorbed by working capital against ₹9.48 crore of EBITDA, so operations consumed ₹21.9 crore rather than producing anything. Receivables alone account for ₹20.9 crore of it. Nothing here is an error — this is what the growth cost.",
      reveals: [
        {
          id: "p-cash-bridge",
          kind: "statement",
          statement: "cashflow",
          title: "Cash flow statement, FY25 — indirect method",
          caption: "₹ crore. Start at profit, undo the accounting, arrive at cash.",
          unit: "inr",
          periods: ["FY25"],
          sections: [
            {
              title: "Cash from operating activities",
              lines: [
                { label: "Profit before tax", value: 5.58 * CRORE },
                { label: "Add back depreciation", value: 2.6 * CRORE, indent: true, note: "No cash left the building for this." },
                { label: "Add back interest", value: 1.3 * CRORE, indent: true, note: "Shown lower down, where it is actually paid." },
                { label: "Operating profit before working capital changes", value: 9.48 * CRORE, emphasis: true },
              ],
            },
            {
              title: "Movements in working capital",
              lines: [
                { label: "Increase in receivables", value: -20.92 * CRORE, indent: true, note: "₹10.12 cr to ₹31.04 cr. The infra contracts pay on certified milestones." },
                { label: "Increase in inventories", value: -8.24 * CRORE, indent: true, note: "₹9.94 cr to ₹18.18 cr, built ahead of the monsoon." },
                { label: "Decrease in payables", value: -2.24 * CRORE, indent: true, note: "₹8.68 cr to ₹6.44 cr. We started paying suppliers faster." },
                { label: "Cash generated from operations", value: -21.92 * CRORE, emphasis: true },
                { label: "Taxes paid", value: -1.4 * CRORE, indent: true },
                { label: "Net cash from operating activities", value: -23.32 * CRORE, emphasis: true },
              ],
            },
            {
              title: "Investing and financing",
              lines: [
                { label: "Purchase of plant and equipment", value: -2.2 * CRORE, indent: true },
                { label: "Interest paid", value: -1.3 * CRORE, indent: true },
                { label: "Free cash flow", value: -26.82 * CRORE, emphasis: true },
              ],
            },
          ],
        },
      ],
    },
    {
      id: "dd-ageing",
      label: "Age the receivables ledger",
      question: "Who owes us the ₹31 crore, and how long have they owed it?",
      cost: 2,
      evidenceFor: ["cycle.terms"],
      readsAs:
        "The two infra accounts are 71% of the ledger at an average of 141 days. Trade distributors pay in 38 days as they always have. This is not a collections failure across the book — it is one customer type on terms nobody costed.",
      reveals: [
        {
          id: "p-ageing",
          kind: "segments",
          title: "Receivables by customer type",
          dimension: "Customer",
          rows: [
            { label: "Infra contract A — ₹13.9 cr", value: 148, unit: "days" },
            { label: "Infra contract B — ₹8.1 cr", value: 131, unit: "days" },
            { label: "Trade distributors — ₹6.9 cr", value: 38, unit: "days" },
            { label: "Retail and projects — ₹2.1 cr", value: 44, unit: "days" },
          ],
        },
        {
          id: "p-ageing-note",
          kind: "note",
          title: "What the infra contracts actually say",
          body:
            "Payment falls due 60 days after the engineer certifies the milestone, and certification has been running 55 to 80 days behind delivery because it is batched with the client's own quarterly review. Nobody bills against delivery; everybody waits for the batch.\n\n" +
            "The contracts permit progress invoicing against delivered quantity, with certification following. It has never been used.",
        },
      ],
    },
    {
      id: "dd-payables-terms",
      label: "What we pay suppliers, and when",
      question: "Procurement says they won us a 2% discount. What did it cost?",
      cost: 2,
      evidenceFor: ["cycle.terms", "pnl.margin"],
      readsAs:
        "Paying 28 days earlier to save 2% is borrowing at roughly 26% a year. The discount is worth about ₹0.97 crore on the P&L and took ₹2.24 crore of cash off the balance sheet, from a company that had none to spare.",
      reveals: [
        {
          id: "p-payables",
          kind: "segments",
          title: "Supplier terms, this year against last",
          dimension: "Terms",
          rows: [
            { label: "Days payable outstanding — FY24", value: 62, unit: "days" },
            { label: "Days payable outstanding — FY25", value: 34, unit: "days" },
            { label: "Early-settlement discount taken", value: 0.02, unit: "ratio" },
            { label: "Implied annual cost of the early payment", value: 0.26, unit: "ratio" },
          ],
        },
        {
          id: "p-payables-note",
          kind: "note",
          title: "The arithmetic procurement did not do",
          body:
            "A 2% discount for paying 28 days sooner is 2% for 28 days of money. Annualised, that is 2 ÷ 98 × 365 ÷ 28 ≈ 26.6% a year.\n\n" +
            "The company's overdraft costs 11.5%. Borrowing at 11.5% to save 26.6% would be a good trade; the company did the reverse.",
        },
      ],
    },
    {
      id: "dd-inventory-cut",
      label: "Stock by age and movement",
      question: "Is 96 days of stock the monsoon build, or is some of it stuck?",
      cost: 2,
      evidenceFor: ["cycle.inventory"],
      readsAs:
        "About ₹4 crore is genuinely slow — large-diameter CPVC held for a project that was rescheduled. The rest is a defensible pre-monsoon build. Worth recovering and roughly a fifth of what the receivables are holding.",
      reveals: [
        {
          id: "p-inventory-cut",
          kind: "segments",
          title: "₹18.18 crore of inventory",
          dimension: "Category",
          rows: [
            { label: "Fast-moving, under 45 days", value: 8.9 * CRORE, unit: "inr" },
            { label: "Pre-monsoon build, 45–90 days", value: 5.3 * CRORE, unit: "inr" },
            { label: "Large-diameter CPVC, over 180 days", value: 3.98 * CRORE, unit: "inr" },
          ],
        },
      ],
    },
    {
      id: "dd-order-margin",
      label: "Margin on infra orders against trade",
      question: "Are the infra contracts even worth having?",
      cost: 2,
      evidenceFor: ["pnl.margin"],
      readsAs:
        "Infra runs at 24.1% gross margin against 31.8% on trade — thinner, and still comfortably profitable. The problem was never the price on the order; it was the terms behind it.",
      reveals: [
        {
          id: "p-order-margin",
          kind: "segments",
          title: "Gross margin by order type",
          dimension: "Order type",
          rows: [
            { label: "Infrastructure contracts", value: 0.241, unit: "ratio" },
            { label: "Trade distributors", value: 0.318, unit: "ratio" },
            { label: "Retail and projects", value: 0.294, unit: "ratio" },
          ],
        },
      ],
    },
    {
      id: "dd-facility",
      label: "What the bank will actually lend",
      question: "Can we just borrow our way through this?",
      cost: 2,
      evidenceFor: ["pnl.growth"],
      readsAs:
        "The bank will lend against the receivables book, not against the ambition: ₹10 crore is available at 11.5%, and the next tranche needs the cycle to come down first. Borrowing is part of the answer to a ₹10 crore gap and no answer at all to a ₹27 crore one.",
      reveals: [
        {
          id: "p-facility",
          kind: "note",
          title: "Relationship manager's note",
          body:
            "Existing facility ₹12 crore, drawn ₹11.6 crore. A further ₹10 crore is available at 11.5%, secured against the receivables book at a 60% advance rate.\n\n" +
            "Anything beyond that needs either fresh equity or a demonstrated fall in the cash conversion cycle. The covenant on the existing facility caps the cycle at 150 days from the FY26 half-year; at 180 days the company is already outside it and the bank has waived once.",
        },
      ],
    },
  ],

  causes: [
    { id: "cycle", parentId: null, label: "How cash moves through the business", verdict: "The right place to look." },
    {
      id: "cycle.terms",
      parentId: "cycle",
      label: "We collect late and pay early",
      verdict:
        "This was it. Days sales outstanding went from 52 to 118 because the infra contracts pay 60 days after a certification that runs 55 to 80 days late, and days payable went from 62 to 34 because procurement bought a 2% discount with cash the company did not have. Together that is a cash conversion cycle of 180 days against 61, and ₹23 crore of the ₹31 crore absorbed.",
    },
    {
      id: "cycle.inventory",
      parentId: "cycle",
      label: "We are carrying too much stock",
      verdict:
        "Partly true and much the smallest of the three. ₹8.2 crore went into inventory, of which about ₹4 crore is genuinely stuck — large-diameter CPVC for a rescheduled project — and the rest is a defensible pre-monsoon build.",
    },
    { id: "pnl", parentId: null, label: "The earnings themselves", verdict: "Are having their best year on record." },
    {
      id: "pnl.margin",
      parentId: "pnl",
      label: "The infra orders are less profitable than they look",
      verdict:
        "24.1% gross margin against 31.8% on trade. Thinner and genuinely profitable — the orders more than cover their own costs. Repricing them addresses a margin question the company does not have instead of the timing question it does.",
    },
    {
      id: "pnl.growth",
      parentId: "pnl",
      label: "We grew faster than the balance sheet can fund",
      verdict:
        "True as a description and useless as a diagnosis, because it points at the growth rather than at the terms. The same ₹25 crore of extra revenue on the old 61-day cycle would have absorbed about ₹4 crore, not ₹31 crore. Growth did not empty the account; the days did.",
    },
    {
      id: "pnl.capex",
      parentId: "pnl",
      label: "We spent the cash on plant rather than losing it",
      verdict:
        "No. Capex was ₹3.1 crore against a ₹31.4 crore swing in working capital. It is on the cash flow statement, it is a tenth of the problem, and the extrusion line it bought is running.",
    },
    { id: "collection", parentId: null, label: "How we bill and chase", verdict: "One branch here is the cause wearing an operational costume. Read both carefully." },
    {
      id: "collection.effort",
      parentId: "collection",
      label: "Nobody is chasing the money hard enough",
      verdict:
        "The tempting misread. Two people work collections full time and dealers still pay in 38 days on the same effort. What changed is not the chasing — it is that infra payment falls due 60 days after a sign-off that runs 55 to 80 days late. You cannot chase an invoice that is not yet due.",
    },
    {
      id: "collection.disputes",
      parentId: "collection",
      label: "Customers are disputing what we invoice",
      verdict:
        "No. ₹0.6 crore is in dispute out of a ₹31 crore ledger, and the ageing is the same with or without it. The money is not contested — it is simply not payable yet.",
    },
  ],
  trueCauseIds: ["cycle.terms"],

  interventions: [
    {
      id: "iv-collections",
      label: "Bill against delivery and put a desk on the infra ledger",
      pitch:
        "Use the progress-invoicing clause the contracts already contain, and staff a collections desk that chases certification rather than waiting for the client's quarterly batch.",
      addresses: "cycle.terms",
      cost: { sprints: 2, rupees: 1.6 * CRORE },
      minSprints: 2,
      effects: {
        // 118 days to about 61 — back to roughly where trade sits, which is
        // what the contract terms allow if anybody uses them.
        whenRootCause: [{ driver: "dso", deltaPct: -0.48, rampQuarters: 2 }],
        otherwise: [{ driver: "dso", deltaPct: -0.12, rampQuarters: 2 }],
      },
      debrief:
        "The single biggest lever in the scenario, and it needed no renegotiation: the right to invoice against delivered quantity was already in the contract and nobody had used it. About ₹16 crore of cash by the end of the year, for two sprints and a desk.",
    },
    {
      id: "iv-supplier-terms",
      label: "Give the 2% discount back and restore 60-day terms",
      pitch:
        "Hand the early-settlement discount back to the resin suppliers and return to paying at 60 days, which is what everyone in the industry does.",
      addresses: "cycle.terms",
      cost: { sprints: 2, rupees: 0.9 * CRORE },
      minSprints: 2,
      effects: {
        whenRootCause: [
          { driver: "dpo", deltaPct: 0.9, rampQuarters: 2 },
          // The discount was real money. Giving it back costs 1.4% of COGS,
          // and that cost has to stay or the trade disappears.
          { driver: "cogsRate", deltaPct: 0.014 },
        ],
        otherwise: [
          { driver: "dpo", deltaPct: 0.35, rampQuarters: 2 },
          { driver: "cogsRate", deltaPct: 0.014 },
        ],
      },
      debrief:
        "Uncomfortable, because it looks like undoing a win and shows up on the P&L as a margin cut. It is borrowing at 11.5% instead of 26.6%, which is the trade the company had backwards.",
    },
    {
      id: "iv-inventory",
      label: "Clear the slow stock and go make-to-order on large diameters",
      pitch:
        "Discount out the ₹4 crore of aged CPVC and stop building large-diameter stock speculatively.",
      addresses: "cycle.inventory",
      cost: { sprints: 2, rupees: 1.1 * CRORE },
      effects: {
        whenRootCause: [{ driver: "dio", deltaPct: -0.24, rampQuarters: 2 }],
        otherwise: [
          { driver: "dio", deltaPct: -0.2, rampQuarters: 2 },
          // Selling from stock is part of the trade proposition; making to
          // order costs some of it.
          { driver: "revenue", deltaPct: -0.02 },
        ],
      },
      debrief:
        "Genuinely worth doing and the smallest of the three days levers — inventory is ₹18 crore against ₹31 crore of receivables, and only about ₹4 crore of it is actually stuck.",
    },
    {
      id: "iv-overdraft",
      label: "Draw the extra ₹10 crore of overdraft",
      pitch:
        "The MD's answer. The bank has ₹10 crore available at 11.5%. Take it, pay the salaries and stop the drama.",
      addresses: "pnl.growth",
      cost: { sprints: 1, rupees: 0.3 * CRORE },
      effects: {
        whenRootCause: [{ driver: "interest", deltaPct: 0.88 }],
        otherwise: [{ driver: "interest", deltaPct: 0.88 }],
      },
      debrief:
        "Moves no operational number at all: the same 180-day cycle, funded more expensively. Borrowing is a reasonable answer to the ₹10 crore that is left after the cycle is fixed and no answer at all to the ₹27 crore before it — and at 180 days the company is already outside the covenant the bank has waived once.",
    },
    {
      id: "iv-price-infra",
      label: "Reprice the infra contracts up 4%",
      pitch:
        "Infra runs 7.7 points of margin below trade. Take the price up at the next milestone and make the contracts pay their way.",
      addresses: "pnl.margin",
      cost: { sprints: 1, rupees: 0.4 * CRORE },
      effects: {
        whenRootCause: [{ driver: "cogsRate", deltaPct: -0.03 }],
        otherwise: [
          { driver: "cogsRate", deltaPct: -0.03 },
          // Better margin on a longer leash: a client asked for more money
          // certifies no faster, and usually slower.
          { driver: "dso", deltaPct: 0.06 },
        ],
      },
      debrief:
        "Answers a margin question the company does not have. It improves gross profit by about ₹2 crore of accounting profit and lengthens the collection it already cannot fund — more earnings, arriving later, from a business that is short of cash rather than short of margin.",
    },
  ],

  // The certification backlog keeps growing and the pre-monsoon build keeps
  // building, so an untouched cycle gets longer on its own.
  drift: [
    { driver: "dso", deltaPct: 0.025 },
    { driver: "dio", deltaPct: 0.015 },
  ],
  horizonQuarters: 4,
  periodNoun: "quarter",

  parInvestigation: ["dd-cash-bridge", "dd-ageing"],
  bestAllocation: [
    { interventionId: "iv-collections", sprints: 2, rupees: 1.6 * CRORE },
    { interventionId: "iv-supplier-terms", sprints: 2, rupees: 0.9 * CRORE },
  ],

  debrief: {
    causalChain: [
      "Revenue grew 35% to ₹96 crore on two infrastructure contracts, and net profit grew 57% to ₹4.19 crore. Both are real.",
      "The infra contracts pay 60 days after an engineer certifies the milestone, and certification runs 55 to 80 days behind delivery because the client batches it with a quarterly review.",
      "Days sales outstanding therefore went from 52 to 118, putting ₹31.04 crore into receivables against ₹10.12 crore last year.",
      "Procurement separately took a 2% early-settlement discount, cutting days payable from 62 to 34 — borrowing at an implied 26.6% a year against an overdraft costing 11.5%.",
      "With a pre-monsoon inventory build on top, the cash conversion cycle went from 61 days to 180, and working capital from ₹11.4 crore to ₹42.8 crore.",
      "₹31.4 crore of cash went into working capital against ₹9.48 crore of EBITDA, so operations consumed ₹21.9 crore and free cash flow was minus ₹26.8 crore in the company's most profitable year.",
    ],
    whereTheLeverageWas:
      "The days, not the deals. Billing against delivered quantity — a right the contracts already contained — takes DSO from 118 to about 61 and is worth about ₹16 crore, and returning to 60-day supplier terms adds about ₹5 crore more at a cost of ₹0.97 crore of margin. Together they take free cash flow from about minus ₹27 crore to about minus ₹10 crore: not solved, but reduced to a gap the ₹10 crore facility can actually cover, which is the difference between a funding plan and a crisis.",
    strongAnswer: [
      "Don't argue about whether the profit is real. It is — and so is the empty account. The two statements answer different questions.",
      "Bridge them instead: ₹9.48 crore of operating profit, less ₹31.4 crore tied up in the business, is minus ₹21.9 crore of cash from operations.",
      "After equipment, interest and tax, that is minus ₹26.8 crore of free cash.",
      "So the question is not \"where did the profit go\" but \"what swallowed ₹31 crore\" — and there are only three places money can hide.",
      "Unpaid customer bills took ₹20.9 crore, stock took ₹8.2 crore, and paying suppliers later gave ₹2.2 crore back.",
      "Cut the customer ledger and it is one type of customer: the two infrastructure accounts are 71% of the book and take 141 days to pay, while dealers still pay in 38.",
      "That is not a collections failure, it is a terms problem — and the contracts already let us invoice against quantity delivered. Nobody has used it.",
      "The supplier side is the one nobody volunteers. We take a 2% discount for paying 28 days early, which works out to 26.6% a year — against an overdraft at 11.5%.",
      "So a reported margin win was the most expensive borrowing in the company.",
      "Fix both and the cash cycle goes from 180 days to about 100, and the hole from ₹27 crore to ₹10 crore.",
      "Then borrow the ₹10 crore — knowing what it is for, instead of borrowing ₹27 crore because nobody looked at the days.",
    ],
  },

  coachFallback: [
    {
      topic: ["profit", "cash", "difference", "bridge", "why", "accrual", "empty account"],
      answer: [
        "Both statements were honest — profit and cash answer different questions.",
        "Profit counts a sale when you make it; cash counts it when the customer pays.",
        "Operating profit was ₹9.48 crore, ₹31.4 crore got tied up in the business, so operations consumed ₹21.9 crore and free cash was minus ₹26.8 crore. That one movement is the whole bridge.",
      ],
    },
    {
      topic: ["dso", "receivables", "collect", "118", "infra", "certification", "milestone"],
      answer: [
        "Money owed by customers was the biggest piece: ₹31.04 crore against ₹10.12 crore, or 118 days' worth against 52.",
        "The two infrastructure accounts are 71% of that and take 141 days, because payment only falls due 60 days after a sign-off that itself runs 55 to 80 days late.",
        "Dealers still pay in 38 days, which tells you it is those contracts and not your collections team.",
      ],
    },
    {
      topic: ["dpo", "payables", "supplier", "discount", "2%", "early payment", "procurement"],
      answer: [
        "That 2% discount is the trap.",
        "Paying 28 days early to save 2% works out at about 26.6% a year, against an overdraft costing 11.5%.",
        "It added about ₹0.97 crore to gross profit and took ₹2.24 crore of cash out of a company with ₹41 lakh in the bank.",
      ],
    },
    {
      topic: ["ccc", "cash conversion", "cycle", "180", "days"],
      answer: [
        "The cash cycle is how long your money is out of your hands: days waiting for customers, plus days stock sits, minus days you take to pay suppliers.",
        "118 + 96 − 34 = 180 days, against 61 days last year.",
        "That is 119 extra days of trading the company had to fund itself — the cleanest single number for what went wrong.",
      ],
    },
    {
      topic: ["inventory", "stock", "dio", "monsoon", "96"],
      answer: [
        "Stock swallowed ₹8.24 crore, and about ₹4 crore of that is genuinely stuck — wide-diameter pipe for a project that was rescheduled.",
        "The rest is a sensible build-up before the monsoon.",
        "Real, but the smallest of the three levers next to ₹31 crore of unpaid bills.",
      ],
    },
    {
      topic: ["overdraft", "borrow", "bank", "loan", "facility", "8 crore", "funding"],
      answer: [
        "Borrowing changes nothing about how the business runs — the same 180-day cycle, funded more expensively.",
        "And the loan terms cap that cycle at 150 days from the FY26 half-year, so it is a temporary shelter at best.",
        "It is a fair answer to the ₹10 crore left after fixing the terms, and no answer at all to the ₹27 crore before it.",
      ],
    },
    {
      topic: ["margin", "infra margin", "reprice", "price", "24%", "profitable"],
      answer: [
        "Infrastructure work keeps 24.1% of each rupee against 31.8% on dealer sales — thinner, and comfortably profitable.",
        "Charging more adds about ₹2 crore of profit, but a client asked for more money does not sign off any faster.",
        "So it means more earnings arriving later, at a company short of cash rather than short of margin.",
      ],
    },
    {
      topic: ["growth", "grew too fast", "balance sheet", "fund"],
      answer: [
        "True as a description, misleading as a diagnosis.",
        "The same ₹25 crore of extra revenue on last year's 61-day cycle would have absorbed about ₹4 crore, not ₹31 crore.",
        "Growth did not empty the account. The days did.",
      ],
    },
  ],
};
