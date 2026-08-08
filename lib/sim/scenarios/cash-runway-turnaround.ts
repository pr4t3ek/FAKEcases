/**
 * "Eleven months of runway and a board meeting in the morning."
 *
 * The first scenario in the catalogue that is not a diagnosis. Nothing here is
 * hidden: the founder knows the company is losing money and can see every line
 * of it from the first screen. The exercise is what to do about it, four times,
 * with each quarter's result visible before the next decision — which is the one
 * thing a single-shot war room structurally cannot teach.
 *
 * ── The truth, for whoever maintains this ─────────────────────────────────
 *
 * Sutradhar sells a logistics SaaS to mid-market shippers at ₹36,000 a quarter
 * per customer. Two thousand customers is ₹7.2 crore a quarter of revenue
 * against ₹10.2 crore of burn, so the company loses ₹3 crore a quarter and has
 * ₹12 crore in the bank. Four quarters, exactly.
 *
 * The company is underpriced and under-serviced, and those are the two true
 * causes. Everything else on the board is a cost line that looks tempting.
 *
 * The trap is `iv-cut-marketing`, and it is built to be the most attractive
 * option on the screen for the first two quarters. Turning acquisition off saves
 * ₹1.35 crore a quarter immediately, which is the single largest improvement to
 * cash any lever produces *this period*. It also drops new customers from 200 a
 * quarter to 50 while churn keeps taking 180, so the customer stock — and with
 * it every future quarter's revenue — starts shrinking. A founder watching the
 * cash line will feel rewarded for two quarters and then discover the business
 * underneath it has gone.
 *
 * That trap only exists because `customers` is a `stock`. In the old engine a
 * cut to marketing would have moved a number and stayed moved; here it drains a
 * balance that cannot be refilled by reversing the decision later.
 *
 * The second trap, `iv-cut-eng`, is quieter and uses the `lagged` link: cutting
 * engineering raises `churnFloor` on a two-quarter ramp, so the damage lands
 * after the quarter in which it looked free.
 *
 * ── Balance notes ─────────────────────────────────────────────────────────
 *
 * `bestSchedule` is NOT hand-reasoned. It was brute-forced against every
 * affordable sequence by `scripts/best-schedule.ts` and pinned to what actually
 * won — see `tests/sim-turnaround.test.ts`, which re-derives it and fails if a
 * retune makes some other sequence better. Authoring a "best" by argument is
 * exactly how the ceiling stops being a ceiling.
 *
 * Support capacity is deliberately set to bind at exactly today's customer
 * count: `supportSpend ÷ costToServe` is 2,000 and there are 2,000 customers. So
 * growing without funding support pushes `serviceRatio` below 1, which raises
 * churn a quarter later. Growth that outruns service is the mechanism, not a
 * penalty bolted on afterwards.
 */

import type { SimScenario } from "../types";

const LAKH = 100_000;
const CRORE = 100 * LAKH;

export const cashRunwayTurnaround: SimScenario = {
  slug: "cash-runway-turnaround",
  format: "turnaround",
  title: "Sutradhar: four quarters of cash and three ways to spend it",
  company: "Sutradhar",
  premise:
    "A logistics SaaS has ₹12 crore in the bank and loses ₹3 crore a quarter. You get four quarters, and you decide again after each one.",
  situation:
    "You have just been made CEO of Sutradhar, which sells shipment-tracking software to mid-market exporters. There are 2,000 customers paying ₹36,000 a quarter. Revenue is ₹7.2 crore a quarter, burn is ₹10.2 crore, and there is ₹12 crore left — four quarters, if nothing changes.\n\nNothing is hidden from you. The board is not asking you to find out what is wrong; they are asking what you are going to do about it, and they will ask again at the end of every quarter. You have 4 sprints of engineering and ₹1 crore of discretionary spend each quarter. Unspent capacity does not carry over.",
  difficulty: "Medium",
  periodNoun: "quarter",

  teaching: {
    primer: {
      intro:
        "You are running a subscription business that is losing money. Four numbers decide whether it survives, and they move each other.",
      terms: [
        {
          term: "Runway",
          plain: "How many quarters of cash are left at the current rate of loss.",
          formula: "Cash ÷ net burn",
          matters:
            "It is the only deadline that cannot be negotiated. Every other decision is really a decision about this number.",
          driver: "runwayQuarters",
        },
        {
          term: "Net burn",
          plain: "What the company loses in a quarter after the money customers pay you.",
          formula: "Total burn − revenue",
          matters:
            "Cutting costs and winning revenue are the same lever seen from two ends. Watch this rather than either half.",
          driver: "netBurn",
        },
        {
          term: "Churn",
          full: "Quarterly churn rate",
          plain: "The share of customers who leave each quarter.",
          formula: "Customers lost ÷ customers you had",
          matters:
            "Churn is a leak in a bucket you are paying to fill. At 9% a quarter you replace a fifth of the base every year before you grow at all.",
          driver: "churnRate",
        },
        {
          term: "CAC",
          full: "Customer acquisition cost",
          plain: "What it costs in marketing to win one new customer.",
          formula: "Marketing spend ÷ new customers",
          matters:
            "It tells you what growth costs. It does not tell you whether that customer is worth having — compare it against what they pay you and how long they stay.",
          driver: "cac",
        },
        {
          term: "Service ratio",
          plain:
            "The share of your customers you actually have the support capacity to look after.",
          formula: "Customers served ÷ customers",
          matters:
            "Below 1 it means you have sold more than you can support, and the bill for that arrives next quarter as churn rather than this quarter as a complaint.",
          driver: "serviceRatio",
        },
      ],
      worked: [
        "₹12 crore of cash against ₹3 crore of net burn is four quarters of runway.",
        "₹1.8 crore of marketing at a ₹90,000 CAC buys 200 customers a quarter; 9% churn on 2,000 loses 180. The base grows by 20.",
        "Support of ₹75 lakh at ₹3,750 a customer covers exactly 2,000 — every customer above that is unsupported.",
      ],
    },
    // Shown, deliberately. On a war room the shape of the model is part of the
    // puzzle; here the whole exercise is sequencing a model you can already see,
    // and hiding it would just make the first quarter a guess.
    showMetricMap: true,
  },

  mentor: {
    persona: "an operating partner who has taken two companies through a cash crunch, debriefing a first-time CEO",
    audience: "CEO",
  },

  northStar: "equityValue",
  reported: ["cash", "runwayQuarters", "customers", "churnRate", "revenue"],

  drivers: [
    // ── The levers ────────────────────────────────────────────────────────
    { id: "arpu", kind: "input", label: "Revenue per customer", unit: "inr", goodDirection: "up", baseline: 36_000 },
    { id: "cac", kind: "input", label: "Customer acquisition cost", unit: "inr", goodDirection: "down", baseline: 90_000 },
    { id: "marketingSpend", kind: "input", label: "Marketing spend", unit: "inr", goodDirection: "down", baseline: 1.8 * CRORE },
    { id: "supportSpend", kind: "input", label: "Support spend", unit: "inr", goodDirection: "down", baseline: 75 * LAKH },
    { id: "engineeringSpend", kind: "input", label: "Engineering spend", unit: "inr", goodDirection: "down", baseline: 1.05 * CRORE },
    { id: "salaries", kind: "input", label: "Everything else (salaries, rent, cloud)", unit: "inr", goodDirection: "down", baseline: 6.6 * CRORE },
    { id: "churnFloor", kind: "input", label: "Underlying churn", unit: "ratio", goodDirection: "down", baseline: 0.09 },
    { id: "costToServe", kind: "constant", label: "Support cost per customer", unit: "inr", goodDirection: "down", value: 3_750 },

    // ── Acquisition ───────────────────────────────────────────────────────
    { id: "newCustomers", kind: "quotient", label: "New customers", unit: "count", goodDirection: "up", numerator: "marketingSpend", denominator: "cac" },

    // ── Service capacity: the bottleneck ──────────────────────────────────
    { id: "supportCapacity", kind: "quotient", label: "Customers we can support", unit: "count", goodDirection: "up", numerator: "supportSpend", denominator: "costToServe" },
    // The binding constraint. Sell past your support capacity and the extra
    // customers are not actually being looked after.
    { id: "served", kind: "min", label: "Customers actually served", unit: "count", goodDirection: "up", of: ["customers", "supportCapacity"] },
    { id: "serviceRatio", kind: "quotient", label: "Service ratio", unit: "ratio", goodDirection: "up", numerator: "served", denominator: "customers" },

    // ── The feedback loop ─────────────────────────────────────────────────
    // Last quarter's service quality sets this quarter's churn. This is the
    // link that makes cutting support feel free in the quarter you do it.
    { id: "serviceLast", kind: "lagged", label: "Service ratio last quarter", unit: "ratio", goodDirection: "up", of: "serviceRatio", initial: 1 },
    { id: "churnRate", kind: "quotient", label: "Quarterly churn", unit: "ratio", goodDirection: "down", numerator: "churnFloor", denominator: "serviceLast" },
    // Churn applies to the base you started the quarter with, which is also what
    // keeps the customer stock from depending on itself within a period.
    { id: "customersLast", kind: "lagged", label: "Customers last quarter", unit: "count", goodDirection: "up", of: "customers", initial: 2_000 },
    { id: "churned", kind: "product", label: "Customers lost", unit: "count", goodDirection: "down", of: ["customersLast", "churnRate"] },

    // ── The two balances that carry across quarters ───────────────────────
    { id: "customers", kind: "stock", label: "Customers", unit: "count", goodDirection: "up", initial: 2_000, inflow: "newCustomers", outflow: "churned", floor: 0 },
    { id: "revenue", kind: "product", label: "Revenue", unit: "inr", goodDirection: "up", of: ["customers", "arpu"] },
    { id: "burn", kind: "sum", label: "Total burn", unit: "inr", goodDirection: "down", of: ["salaries", "marketingSpend", "supportSpend", "engineeringSpend"] },
    { id: "netBurn", kind: "difference", label: "Net burn", unit: "inr", goodDirection: "down", minuend: "burn", subtrahend: "revenue" },
    // No floor, deliberately. A company whose balance goes below zero has run
    // out of money, and clamping that at zero would hide the only outcome this
    // scenario exists to teach.
    { id: "cash", kind: "stock", label: "Cash in the bank", unit: "inr", goodDirection: "up", initial: 12 * CRORE, inflow: "revenue", outflow: "burn" },
    { id: "runwayQuarters", kind: "quotient", label: "Runway", unit: "count", goodDirection: "up", numerator: "cash", denominator: "netBurn" },

    // ── What the company is worth ─────────────────────────────────────────
    // Cash alone is the wrong scoreboard and the balance sweep proved it: with
    // cash as the north star, gutting acquisition in the last decision period
    // scored BEST, because the customers it destroys never get to be missed
    // inside the horizon. A subscription company is worth its bank balance plus
    // a multiple of what it recurringly earns, so that is what the run is judged
    // on — and a lever that buys cash by shrinking the base now pays for it.
    { id: "quartersPerYear", kind: "constant", label: "Quarters in a year", unit: "count", goodDirection: "up", value: 4 },
    { id: "valuationMultiple", kind: "constant", label: "Revenue multiple", unit: "multiple", goodDirection: "up", value: 1.2 },
    { id: "arr", kind: "product", label: "Annual recurring revenue", unit: "inr", goodDirection: "up", of: ["revenue", "quartersPerYear"] },
    { id: "baseValue", kind: "product", label: "What the customer base is worth", unit: "inr", goodDirection: "up", of: ["arr", "valuationMultiple"] },
    { id: "equityValue", kind: "sum", label: "What the company is worth", unit: "inr", goodDirection: "up", of: ["cash", "baseValue"] },
  ],

  dashboard: [
    {
      id: "p-position",
      kind: "stat",
      title: "Where you are this morning",
      caption: "The board has seen all of these.",
      tiles: [
        { label: "Cash in the bank", value: 12 * CRORE, unit: "inr_crore" },
        { label: "Net burn per quarter", value: 3 * CRORE, unit: "inr_crore", goodDirection: "down" },
        { label: "Runway", value: 4, unit: "count" },
        { label: "Customers", value: 2_000, unit: "count", deltaPct: 0.01 },
        { label: "Quarterly churn", value: 0.09, unit: "ratio", goodDirection: "down" },
        { label: "Revenue per customer", value: 36_000, unit: "inr" },
      ],
    },
    {
      id: "p-cash-history",
      kind: "timeseries",
      title: "Cash, last six quarters",
      caption: "The line has been straight for a year and a half. That is the problem.",
      series: [
        {
          label: "Cash",
          unit: "inr_crore",
          points: [
            { period: "Q-5", value: 27 * CRORE },
            { period: "Q-4", value: 24 * CRORE },
            { period: "Q-3", value: 21 * CRORE },
            { period: "Q-2", value: 18 * CRORE },
            { period: "Q-1", value: 15 * CRORE },
            { period: "Q-0", value: 12 * CRORE },
          ],
        },
      ],
    },
    {
      id: "p-burn-split",
      kind: "segments",
      title: "Where ₹10.2 crore a quarter goes",
      dimension: "Cost line",
      rows: [
        { label: "Salaries, rent, cloud", value: 6.6 * CRORE, unit: "inr_crore" },
        { label: "Marketing", value: 1.8 * CRORE, unit: "inr_crore" },
        { label: "Engineering", value: 1.05 * CRORE, unit: "inr_crore" },
        { label: "Support", value: 75 * LAKH, unit: "inr_crore" },
      ],
    },
    {
      id: "p-room",
      kind: "note",
      title: "What the room is saying",
      body:
        "Board member: the fastest ₹1.35 crore a quarter on that chart is the marketing line. Turn it off and you buy yourself two more quarters to think.\n\nHead of sales: we are the cheapest product our customers buy and they tell us so in every renewal call. We have not raised the price in three years.\n\nHead of support: we are staffed for exactly the customers we have. Every deal sales closes this quarter is a customer nobody has been funded to look after.\n\nCTO: engineering is a third of what marketing is. Cutting it saves a rounding error and costs us the roadmap.",
    },
  ],

  // Per quarter. Unspent capacity does not carry over, which is what makes
  // "hold it" a real decision rather than free optionality.
  budget: { analystDays: 0, sprints: 4, rupees: 1 * CRORE },

  // No investigation phase — see the note in `validateScenario`. Everything the
  // board knows is on the first screen.
  drilldowns: [],
  parInvestigation: [],

  causes: [
    { id: "money", parentId: null, label: "Why the money is going", verdict: "Both halves are real." },
    {
      id: "money.churn",
      parentId: "money",
      label: "We cannot keep the customers we buy",
      verdict:
        "True. 200 in and 180 out is not growth, it is a treadmill you are paying ₹1.8 crore a quarter to stand on.",
    },
    {
      id: "money.pricing",
      parentId: "money",
      label: "We are charging far too little for it",
      verdict:
        "True, and the cheapest fix on the board. ₹36,000 a quarter for software the customer runs their shipping on has not moved in three years.",
    },
    {
      id: "money.acquisition",
      parentId: "money",
      label: "We are overspending to acquire",
      verdict:
        "False, and the most expensive mistake available. Marketing is the only thing replacing the customers churn takes; switching it off improves cash for two quarters and removes the business underneath it.",
    },
    {
      id: "money.engineering",
      parentId: "money",
      label: "Engineering costs too much",
      verdict:
        "False. It is 10% of burn, and the churn it prevents costs more than the salary it saves — a quarter later, which is why it reads as free at the time.",
    },
  ],
  trueCauseIds: ["money.churn", "money.pricing"],

  interventions: [
    {
      id: "iv-success",
      label: "Fund customer success properly",
      pitch: "Staff support ahead of the customer base instead of behind it, and fix onboarding.",
      addresses: "money.churn",
      cost: { sprints: 2, rupees: 60 * LAKH },
      minSprints: 2,
      effects: {
        whenRootCause: [
          { driver: "supportSpend", deltaPct: 0.8 },
          { driver: "churnFloor", deltaPct: -0.45, rampQuarters: 2 },
        ],
        otherwise: [{ driver: "supportSpend", deltaPct: 0.8 }],
      },
      debrief:
        "Costs cash in the quarter you do it and pays back through a balance rather than a line — which is why it is the hardest one to fund when the runway is short.",
    },
    {
      id: "iv-price",
      label: "Reprice the base",
      pitch: "Move the list price to what the product is worth and take the renewal conversations.",
      addresses: "money.pricing",
      cost: { sprints: 1, rupees: 20 * LAKH },
      effects: {
        whenRootCause: [
          { driver: "arpu", deltaPct: 0.32 },
          // Some customers leave over it. Fewer than the board fears.
          { driver: "churnFloor", deltaPct: 0.12 },
        ],
        otherwise: [{ driver: "arpu", deltaPct: 0.05 }],
      },
      debrief:
        "The only lever that improves cash in the quarter you pull it without shrinking anything. Its cost is churn, and that cost is smaller than it feels.",
    },
    {
      id: "iv-cut-marketing",
      label: "Switch acquisition off",
      pitch: "Stop buying customers until the unit economics work. Saves ₹1.35 crore a quarter immediately.",
      addresses: "money.acquisition",
      cost: { sprints: 1, rupees: 5 * LAKH },
      effects: {
        whenRootCause: [
          { driver: "marketingSpend", deltaPct: -0.75 },
          { driver: "cac", deltaPct: -0.2 },
        ],
        // What actually happens: burn falls at once, and the customer stock
        // starts draining because churn keeps taking 180 a quarter.
        otherwise: [{ driver: "marketingSpend", deltaPct: -0.75 }],
      },
      debrief:
        "The best-looking decision on the board for two quarters and the worst one by the fourth. Cash is a balance and so are customers; this trades the one you can rebuild for the one you cannot.",
    },
    {
      id: "iv-cut-eng",
      label: "Cut engineering by 40%",
      pitch: "The roadmap can wait. Salary saved is runway bought.",
      addresses: "money.engineering",
      cost: { sprints: 2, rupees: 10 * LAKH },
      effects: {
        whenRootCause: [{ driver: "engineeringSpend", deltaPct: -0.4 }],
        otherwise: [
          { driver: "engineeringSpend", deltaPct: -0.4 },
          // Arrives a quarter late, which is exactly why it reads as free.
          { driver: "churnFloor", deltaPct: 0.3, rampQuarters: 2 },
        ],
      },
      debrief:
        "Saves ₹42 lakh a quarter and costs more than that in churn from the quarter after next. The lag is the whole trap.",
    },
  ],

  // Competition does not wait. Untreated, churn creeps and acquisition gets
  // dearer, so holding the capacity is not a neutral act.
  drift: [
    { driver: "churnFloor", deltaPct: 0.06 },
    { driver: "cac", deltaPct: 0.05 },
  ],
  // Four decisions, judged on where they leave the company two years out. The
  // gap is deliberate — see `decisionPeriods` in lib/sim/types.ts for what the
  // balance sweep found when the two were equal.
  horizonQuarters: 6,
  decisionPeriods: 4,

  // Brute-forced, not argued. See the note at the top of this file and
  // `tests/sim-turnaround.test.ts`, which re-derives it.
  bestSchedule: [
    [
      { interventionId: "iv-success", sprints: 2, rupees: 60 * LAKH },
      { interventionId: "iv-price", sprints: 1, rupees: 20 * LAKH },
    ],
    [],
    [],
    [],
  ],
  bestAllocation: [
    { interventionId: "iv-success", sprints: 2, rupees: 60 * LAKH },
    { interventionId: "iv-price", sprints: 1, rupees: 20 * LAKH },
  ],

  debrief: {
    causalChain: [
      "2,000 customers at ₹36,000 a quarter is ₹7.2 crore of revenue against ₹10.2 crore of burn — ₹3 crore a quarter of loss and ₹12 crore in the bank.",
      "Marketing buys 200 customers a quarter at a ₹90,000 CAC; 9% churn takes 180 of them. The base is a treadmill, not a growth curve.",
      "Support is funded for exactly 2,000 customers, so any growth at all pushes the service ratio below 1 — and last quarter's service ratio sets this quarter's churn.",
      "So the two things actually worth money are the price (which lifts every customer's revenue at once) and retention (which stops you paying ₹1.8 crore a quarter to stand still).",
      "Cutting marketing improves cash faster than either of them for two quarters, and then the customer balance it was holding up runs down and takes the revenue with it.",
    ],
    whereTheLeverageWas:
      "Price is the fastest lever and retention is the largest one, and they are complements rather than alternatives: repricing raises what each customer is worth, and fixing churn raises how many quarters you collect it for. The trap is that the cost lines look like the decision, because they are the only numbers a founder can move without asking anyone's permission.",
    strongAnswer:
      "Start from the deadline: ₹12 crore against ₹3 crore a quarter is four quarters, so whatever you do has to show up inside that. Separate the two ways to close a ₹3 crore gap — earn more or spend less — and notice that the spending is 65% salaries and only 10% engineering, so the cost side cannot close it without cutting the thing that generates revenue. Then look at what a customer is worth: ₹36,000 a quarter, unchanged in three years, against a product they run their shipping on. Reprice first because it lands immediately and costs only a little churn. Fund support second because churn is a stock problem — every quarter you leave it, you lose customers you have already paid ₹90,000 each to acquire. Refuse the marketing cut, and say why out loud: it is the only thing replacing the base, and turning it off buys two good-looking quarters and a smaller company.",
  },

  coachFallback: [
    {
      topic: ["marketing", "acquisition", "cut", "switch off"],
      answer:
        "It saves ₹1.35 crore a quarter, which is more than any other single lever, and it is still wrong. Marketing is buying 200 customers a quarter against churn of 180. Switch it off and the base starts falling by roughly 180 a quarter — around ₹65 lakh of revenue gone every quarter, permanently, and compounding. Cash looks better for two quarters and the company is smaller for good.",
    },
    {
      topic: ["price", "repricing", "arpu"],
      answer:
        "A 20% rise takes revenue per customer from ₹36,000 to ₹43,200 — about ₹1.4 crore a quarter at today's base — and costs roughly a tenth more churn. It is the only lever that improves cash in the quarter you pull it without shrinking anything.",
    },
    {
      topic: ["support", "churn", "retention", "success"],
      answer:
        "Support is funded for exactly the 2,000 customers you have, so growth immediately pushes the service ratio below 1, and last quarter's service ratio sets this quarter's churn. Funding it costs ₹60 lakh and two sprints and pays back through the customer balance rather than through a line on the P&L, which is why it is the hardest one to justify and usually the right one.",
    },
    {
      topic: ["runway", "cash", "how long"],
      answer:
        "₹12 crore of cash against ₹3 crore a quarter of net burn is four quarters. Runway moves when either half moves, which is why net burn rather than burn is the number to watch.",
    },
    {
      topic: ["engineering", "eng", "layoff", "headcount"],
      answer:
        "Engineering is ₹1.05 crore of a ₹10.2 crore quarter — 10%. Cutting 40% of it saves ₹42 lakh and raises underlying churn by about a third on a two-quarter ramp, so the bill arrives after the quarter in which the saving looked free.",
    },
  ],
};
