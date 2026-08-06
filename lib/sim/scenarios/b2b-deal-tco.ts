/**
 * "Our most profitable logo wants 18% off."
 *
 * The B2B contract scenario. Teaches ARR, cost to serve, seats-versus-usage
 * pricing, net revenue retention, and — the one the whole thing turns on —
 * **total cost of ownership**, from both sides of the table.
 *
 * ── The truth, for whoever maintains this ─────────────────────────────────
 *
 * The deck says 78% gross margin because the margin line has only ever counted
 * hosting. Fully loaded, this account costs ₹54.3 lakh a quarter to serve
 * against ₹67.5 lakh of revenue — a 19.5% margin — and ₹17 lakh of that is one
 * thing: a bespoke ERP connector built during onboarding, which breaks every
 * time the customer's ERP vendor ships a patch. Forty of nine hundred seats
 * drive 71% of the document volume and 64% of the tickets, and the contract
 * charges by seat.
 *
 * The other half of the lesson is on the customer's side of the table. Their
 * total cost of ownership is ₹4.60 crore a year, of which your licence is 59%;
 * the rest is two of their engineers keeping the connector alive and nine
 * person-days a month of manual reconciliation. So when their CFO says the
 * system costs a fortune, they are not talking about the invoice — and an 18%
 * discount moves their TCO 10.6% while moving your contract contribution from
 * ₹72 lakh to minus ₹37 lakh.
 *
 * ── Balance notes ─────────────────────────────────────────────────────────
 *
 * `iv-expand` is the sharpest trap because it is the one every SaaS board asks
 * for: land the second division, 44% more seats, net revenue retention of 144%.
 * It has to be modelled honestly to be a trap — a second division on the same
 * batch pattern needs its own connector and its own implementation, so revenue
 * rises 44% and contract contribution falls 83%. Under-model any of those and
 * expansion becomes correct.
 *
 * The metric map is deliberately **off**. On this scenario the shape of the
 * model — that cost to serve has four lines and one of them dwarfs the rest —
 * is most of the answer, so it is bought with `dd-cost-to-serve` rather than
 * given away on arrival. The primer still ships: the vocabulary is a barrier,
 * the structure is the exercise.
 */

import type { SimScenario } from "../types";

const LAKH = 100_000;

export const b2bDealTco: SimScenario = {
  slug: "b2b-deal-tco",
  title: "Lekha: our most profitable customer wants 18% off",
  company: "Lekha",
  premise:
    "A ₹2.7 crore account renews at 78% gross margin and wants a discount to sign three years. Work out what the contract is actually worth before you answer.",
  situation:
    "You are the PM for enterprise at Lekha, a compliance and accounting platform sold to Indian manufacturing groups. " +
    "Your largest customer — 900 seats, ₹2.7 crore of ARR, on the deck at 78% gross margin — is up for renewal and has asked for 18% off to commit to three years. " +
    "Sales wants to take it today. Customer success says this one account absorbs more of their team than the next four combined. " +
    "Finance ran a fully loaded cost-to-serve for the first time last week and has asked you to look at it before anything is signed. " +
    "You have 7 analyst-days, then 3 sprints and ₹60 lakh to decide what you are actually offering them.",
  difficulty: "Medium",
  periodNoun: "quarter",

  // ── Teaching ────────────────────────────────────────────────────────────
  teaching: {
    // Off on purpose: the structure of cost to serve is the thing being
    // investigated, and handing over the graph would hand over the answer. The
    // primer stays, because the vocabulary is a barrier and not a clue.
    showMetricMap: false,
    primer: {
      intro:
        "Enterprise software is sold on a price and lived with at a cost, and the two are rarely close on either side of the table. The terms below are the vocabulary for that gap — the first few describe what the contract earns you, the last few describe what it costs you and what it costs them.",
      terms: [
        {
          term: "ARR",
          full: "Annual recurring revenue",
          plain: "The subscription revenue a customer contributes in a year, at today's run rate.",
          matters:
            "The headline number for any B2B software business, and a revenue measure — it says nothing at all about whether the account is worth having.",
        },
        {
          term: "Seats vs usage pricing",
          plain:
            "Seat pricing charges per person with a login. Usage pricing charges for what they actually do — documents processed, API calls, transactions.",
          matters:
            "The two only agree when everyone uses the product about the same amount. When forty of nine hundred seats drive most of the work, seat pricing charges the wrong customer for the wrong thing.",
        },
        {
          term: "Cost to serve",
          plain:
            "Everything it takes to keep one customer running — hosting, support, customer success, and any code that exists only for them.",
          matters:
            "The line most SaaS gross margins leave out. Hosting is easy to allocate and small; the engineer maintaining a customer's bespoke integration is neither, so they usually end up in 'R&D' where no account ever sees them.",
          driver: "costToServe",
        },
        {
          term: "Gross margin",
          plain: "The share of a customer's revenue left after the cost of serving them.",
          formula: "(revenue − cost to serve) ÷ revenue",
          matters:
            "It is only as honest as the costs you put into it. A margin that counts hosting and nothing else will tell you every account is excellent.",
          driver: "grossMarginRate",
        },
        {
          term: "TCO",
          full: "Total cost of ownership",
          plain:
            "What owning something costs over its whole life, not what it costs to buy — licence plus implementation, integration, training, and the people inside the company who keep it running.",
          matters:
            "It is how the customer actually experiences your product, and it is usually much bigger than your invoice. If most of their TCO is work your product creates, cutting your price is the least effective thing you can do for them — and the most expensive thing you can do to yourself.",
          driver: "customerTco",
        },
        {
          term: "NRR",
          full: "Net revenue retention",
          plain:
            "What this year's customers pay you next year, including upgrades and downgrades, as a percentage of this year.",
          matters:
            "Above 100% means the base grows without new logos, which is why boards ask for it. It counts revenue only, so expanding an account that loses money improves it.",
        },
        {
          term: "Contract contribution",
          plain:
            "What the whole contract leaves behind: gross profit over its full term, minus what it cost to win and implement.",
          formula: "(quarterly gross profit × contract quarters) − deal cost",
          matters:
            "The number this run is judged on, and the only one that sees the price, the cost to serve and the cost of the sale at the same time.",
          driver: "contractContribution",
        },
      ],
      worked: [
        "900 seats at ₹7,250 a quarter is ₹65.25 lakh, plus ₹2.26 lakh of document overage — ₹67.5 lakh of revenue a quarter, ₹2.70 crore a year.",
        "Serving them costs ₹6.97 lakh of infrastructure, ₹19.84 lakh of support, ₹10.5 lakh of customer success and ₹17 lakh of engineering on their bespoke ERP connector — ₹54.3 lakh.",
        "So gross profit is ₹13.2 lakh a quarter and the real gross margin is 19.5%, not the 78% on the deck.",
        "Over twelve quarters that is ₹1.58 crore, less ₹86 lakh to win and implement the contract — ₹72 lakh of contribution for three years of being somebody's largest supplier.",
      ],
    },
  },

  northStar: "contractContribution",
  reported: ["revenue", "costToServe", "grossProfit", "grossMarginRate", "supportCost", "customerTco"],
  drivers: [
    { id: "seats", kind: "input", label: "Seats", unit: "count", goodDirection: "up", baseline: 900 },
    { id: "pricePerSeat", kind: "input", label: "Price per seat / quarter", unit: "inr", goodDirection: "up", baseline: 7_250 },
    { id: "seatRevenue", kind: "product", label: "Seat revenue", unit: "inr", goodDirection: "up", of: ["seats", "pricePerSeat"] },
    { id: "documentsMn", kind: "input", label: "Documents processed (millions)", unit: "count", goodDirection: "up", baseline: 10.25 },
    { id: "usageRatePerMnDocs", kind: "input", label: "Charge per million documents", unit: "inr", goodDirection: "up", baseline: 22_000 },
    { id: "usageRevenue", kind: "product", label: "Usage revenue", unit: "inr", goodDirection: "up", of: ["documentsMn", "usageRatePerMnDocs"] },
    { id: "revenue", kind: "sum", label: "Revenue / quarter", unit: "inr", goodDirection: "up", of: ["seatRevenue", "usageRevenue"] },

    { id: "infraPerMnDocs", kind: "input", label: "Infrastructure per million documents", unit: "inr", goodDirection: "down", baseline: 68_000 },
    { id: "infraCost", kind: "product", label: "Infrastructure", unit: "inr", goodDirection: "down", of: ["documentsMn", "infraPerMnDocs"] },
    { id: "tickets", kind: "input", label: "Support tickets / quarter", unit: "count", goodDirection: "down", baseline: 1_725 },
    { id: "costPerTicket", kind: "input", label: "Cost of a support ticket", unit: "inr", goodDirection: "down", baseline: 1_150 },
    { id: "supportCost", kind: "product", label: "Support", unit: "inr", goodDirection: "down", of: ["tickets", "costPerTicket"] },
    { id: "csmCost", kind: "input", label: "Customer success", unit: "inr", goodDirection: "down", baseline: 10.5 * LAKH },
    // The line that is not in anybody's gross margin, and is a third of the
    // cost of this account.
    { id: "connectorCost", kind: "input", label: "Bespoke ERP connector", unit: "inr", goodDirection: "down", baseline: 17 * LAKH },
    {
      id: "costToServe",
      kind: "sum",
      label: "Cost to serve / quarter",
      unit: "inr",
      goodDirection: "down",
      of: ["infraCost", "supportCost", "csmCost", "connectorCost"],
    },
    { id: "grossProfit", kind: "difference", label: "Gross profit / quarter", unit: "inr", goodDirection: "up", minuend: "revenue", subtrahend: "costToServe" },
    { id: "grossMarginRate", kind: "quotient", label: "True gross margin", unit: "ratio", goodDirection: "up", numerator: "grossProfit", denominator: "revenue" },

    { id: "contractQuarters", kind: "constant", label: "Quarters in the contract", unit: "count", goodDirection: "up", value: 12 },
    { id: "contractGrossProfit", kind: "product", label: "Gross profit over the contract", unit: "inr", goodDirection: "up", of: ["grossProfit", "contractQuarters"] },
    { id: "dealCost", kind: "input", label: "Cost to win and implement", unit: "inr", goodDirection: "down", baseline: 86 * LAKH },
    {
      id: "contractContribution",
      kind: "difference",
      label: "Contract contribution (3 years)",
      unit: "inr",
      goodDirection: "up",
      minuend: "contractGrossProfit",
      subtrahend: "dealCost",
    },

    // The other side of the table. Their invoice is not their cost.
    { id: "customerInternalCost", kind: "input", label: "What it costs them internally / quarter", unit: "inr", goodDirection: "down", baseline: 47.5 * LAKH },
    { id: "customerTco", kind: "sum", label: "Their total cost of ownership / quarter", unit: "inr", goodDirection: "down", of: ["revenue", "customerInternalCost"] },
  ],

  dashboard: [
    {
      id: "p-b2b-headline",
      kind: "stat",
      title: "The account, as the quarterly review shows it",
      caption: "The margin line counts hosting. It has never counted anything else.",
      tiles: [
        { label: "Revenue this quarter", value: 67.51 * LAKH, unit: "inr", deltaPct: 0.004, goodDirection: "up" },
        { label: "Gross margin (as reported)", value: 0.78, unit: "ratio", goodDirection: "up" },
        { label: "Seats", value: 900, unit: "count", deltaPct: 0, goodDirection: "up" },
        { label: "Seats active weekly", value: 612, unit: "count", deltaPct: -0.03, goodDirection: "up" },
        { label: "Contract value, 3 years", value: 8.1 * 100 * LAKH, unit: "inr", goodDirection: "up" },
        { label: "Discount they have asked for", value: -0.18, unit: "percent", goodDirection: "up" },
      ],
    },
    {
      id: "p-b2b-tickets",
      kind: "segments",
      title: "Support load, this account against the book",
      caption:
        "1.92 tickets per seat against a book average of 0.47 — so it is not that they are large. Nobody has ever put a number on this in a renewal conversation.",
      dimension: "Account",
      rows: [
        { label: "This account", value: 1_725, unit: "count" },
        { label: "Book average, 900-seat account", value: 420, unit: "count" },
        { label: "Next-largest account", value: 610, unit: "count" },
      ],
    },
    {
      id: "p-b2b-trend",
      kind: "timeseries",
      title: "Revenue and support tickets, six quarters",
      caption: "One of these lines has been flat since the contract was signed.",
      series: [
        {
          label: "Revenue (₹ lakh)",
          unit: "inr_lakh",
          points: [
            { period: "Q-5", value: 66.9 },
            { period: "Q-4", value: 67.1 },
            { period: "Q-3", value: 67.0 },
            { period: "Q-2", value: 67.3 },
            { period: "Q-1", value: 67.2 },
            { period: "Q-0", value: 67.5 },
          ],
        },
        {
          label: "Support tickets",
          unit: "count",
          points: [
            { period: "Q-5", value: 940 },
            { period: "Q-4", value: 1_080 },
            { period: "Q-3", value: 1_260 },
            { period: "Q-2", value: 1_410 },
            { period: "Q-1", value: 1_580 },
            { period: "Q-0", value: 1_725 },
          ],
        },
      ],
    },
    {
      id: "p-b2b-room",
      kind: "note",
      title: "What the room is saying",
      body:
        "Sales: this is our largest logo at 78% gross margin. They want 18% and a three-year lock. I would sign it this afternoon and put the case study on the website. " +
        "Customer success: my team spends more hours on this account than on the next four combined, and it is always the same ticket — their ERP vendor patches, our connector breaks, month-end stops. " +
        "Engineering: two and a half people have been on that connector for two years. It is not in anybody's gross margin because we book it as R&D. " +
        "And from the renewal meeting itself, their CFO: \"this system costs us a fortune.\" Nobody in the room asked what he meant.",
    },
  ],

  budget: { analystDays: 7, sprints: 3, rupees: 60 * LAKH },

  drilldowns: [
    {
      id: "dd-cost-to-serve",
      label: "Fully loaded cost to serve this account",
      question: "What does this contract actually cost us to deliver?",
      cost: 3,
      evidenceFor: ["economics.usage"],
      readsAs:
        "₹54.3 lakh a quarter against ₹67.5 lakh of revenue — a 19.5% gross margin, not 78%. The reported number counts hosting and nothing else. ₹17 lakh a quarter is one line: engineering on a connector that exists only for this customer.",
      reveals: [
        {
          id: "p-b2b-cts",
          kind: "segments",
          title: "Cost to serve, per quarter",
          dimension: "Line",
          rows: [
            { label: "Infrastructure (in the reported margin)", value: 6.97 * LAKH, unit: "inr" },
            { label: "Support", value: 19.84 * LAKH, unit: "inr" },
            { label: "Customer success", value: 10.5 * LAKH, unit: "inr" },
            { label: "Bespoke ERP connector — engineering", value: 17 * LAKH, unit: "inr" },
            { label: "Total", value: 54.31 * LAKH, unit: "inr" },
          ],
        },
        {
          id: "p-b2b-cts-note",
          kind: "note",
          title: "Why the deck says 78%",
          body:
            "Reported gross margin for this account is revenue minus hosting: ₹67.5 lakh minus ₹6.97 lakh — 89.7%, rounded down to 78% after a shared allocation for platform costs. That is the number in every QBR since the contract was signed. " +
            "Support sits in the customer success P&L, and the connector engineering is booked as R&D because it was scoped as a product feature two years ago and never re-classified. Neither has ever appeared next to this account's revenue.",
        },
      ],
    },
    {
      id: "dd-usage",
      label: "Who generates the volume and the tickets",
      question: "Is the cost spread across the 900 seats, or concentrated?",
      cost: 2,
      evidenceFor: ["economics.usage"],
      readsAs:
        "Forty of the 900 seats drive 71% of documents and 64% of tickets — the integration team running month-end batches. The contract charges by seat, so those forty pay the same ₹7,250 as somebody who opens a report once a fortnight. And 81% of the tickets land within five days of the customer's ERP vendor shipping a patch.",
      reveals: [
        {
          id: "p-b2b-concentration",
          kind: "segments",
          title: "Share of activity, by user group",
          dimension: "Group",
          rows: [
            { label: "40 integration seats — share of documents", value: 0.71, unit: "ratio" },
            { label: "40 integration seats — share of tickets", value: 0.64, unit: "ratio" },
            { label: "860 other seats — share of documents", value: 0.29, unit: "ratio" },
            { label: "860 other seats — weekly active", value: 0.66, unit: "ratio" },
          ],
        },
        {
          id: "p-b2b-patch",
          kind: "note",
          title: "When the tickets arrive",
          body:
            "81% of tickets are raised within five days of the customer's ERP vendor shipping a patch, and 74% are the same three failure modes in the bespoke connector. " +
            "The vendor patches quarterly, so the load is not a spike to be absorbed — it is a calendar.",
        },
      ],
    },
    {
      id: "dd-customer-tco",
      label: "What the software costs them",
      question: "The CFO said it costs them a fortune. Costs them what, exactly?",
      cost: 3,
      dependsOn: ["dd-usage"],
      evidenceFor: ["economics.usage"],
      readsAs:
        "Their total cost of ownership is ₹1.15 crore a quarter and our licence is 59% of it. The rest is two of their engineers on the connector, nine person-days a month of manual reconciliation, and a month-end process somebody has to sit through. An 18% discount moves their number by 10.6%; taking the connector work away moves it by 23%.",
      reveals: [
        {
          id: "p-b2b-tco",
          kind: "segments",
          title: "Their cost of owning this, per quarter",
          dimension: "Line",
          rows: [
            { label: "Our licence", value: 67.51 * LAKH, unit: "inr" },
            { label: "Their two engineers on the connector", value: 21.5 * LAKH, unit: "inr" },
            { label: "Manual reconciliation, 9 person-days a month", value: 14.2 * LAKH, unit: "inr" },
            { label: "Month-end batch supervision and rework", value: 11.8 * LAKH, unit: "inr" },
            { label: "Their total cost of ownership", value: 115 * LAKH, unit: "inr" },
          ],
        },
        {
          id: "p-b2b-tco-note",
          kind: "note",
          title: "What the CFO was actually complaining about",
          body:
            "41% of what this system costs them is work our product creates and does not do. That is the sentence the renewal conversation has been missing. " +
            "An 18% licence discount takes their quarterly cost from ₹115 lakh to ₹103 lakh. Retiring the bespoke connector and shipping native month-end batch takes it to ₹89 lakh — more than twice as much relief, and it costs us nothing in price.",
        },
      ],
    },
    {
      id: "dd-benchmark",
      label: "What comparable contracts are priced at",
      question: "Are we simply charging too little?",
      cost: 2,
      evidenceFor: ["economics.price"],
      readsAs:
        "₹29,000 a seat a year sits at the 78th percentile of comparable manufacturing contracts. The price is not the problem, and there is no headroom to raise it — which rules out the easy version of the fix as well as the easy version of the complaint.",
      reveals: [
        {
          id: "p-b2b-benchmark",
          kind: "segments",
          title: "Annual price per seat, comparable contracts",
          dimension: "Percentile of our book",
          rows: [
            { label: "25th percentile", value: 19_400, unit: "inr" },
            { label: "Median", value: 24_800, unit: "inr" },
            { label: "This account", value: 29_000, unit: "inr" },
            { label: "90th percentile", value: 33_500, unit: "inr" },
          ],
        },
      ],
    },
    {
      id: "dd-csat",
      label: "Satisfaction, and what the tickets are about",
      question: "Are they unhappy with the product?",
      cost: 2,
      evidenceFor: ["service.quality", "service.staffing"],
      readsAs:
        "CSAT is 4.3 out of 5 and the executive sponsor renewed the internal mandate last quarter. They like the product. What they do not like is the connector, and 74% of tickets are three failure modes in it — this is not a satisfaction problem wearing a cost disguise.",
      reveals: [
        {
          id: "p-b2b-csat",
          kind: "segments",
          title: "Satisfaction and ticket subject",
          dimension: "Measure",
          rows: [
            { label: "CSAT", value: 4.3, unit: "count" },
            { label: "Tickets about the connector", value: 0.74, unit: "ratio" },
            { label: "Tickets about the product itself", value: 0.11, unit: "ratio" },
            { label: "Tickets about billing or access", value: 0.15, unit: "ratio" },
          ],
        },
      ],
    },
    {
      id: "dd-competitive",
      label: "Is there a live competitive threat?",
      question: "Are they asking for 18% because somebody else offered it?",
      cost: 2,
      evidenceFor: ["account.competitive"],
      readsAs:
        "They evaluated an alternative eight months ago and stopped after the integration assessment came back at ₹3.4 crore of their own effort. Nobody is undercutting us. The discount request is a CFO managing a cost line, not a competitive response.",
      reveals: [
        {
          id: "p-b2b-competitive",
          kind: "note",
          title: "What the account team found",
          body:
            "An alternative platform was evaluated eight months ago and shortlisted. The evaluation stopped when their own architecture team costed the re-integration at ₹3.4 crore and eleven months. " +
            "There is no active bid and no expiring offer on the table. The 18% is a number their CFO arrived at by looking at a cost line he does not like, which is the same cost line the pricing conversation has never gone near.",
        },
      ],
    },
    {
      id: "dd-expansion",
      label: "What the second division would look like",
      question: "Should we be growing this account rather than defending it?",
      cost: 2,
      evidenceFor: ["account.penetration"],
      readsAs:
        "400 more seats and ₹1.2 crore of ARR, running the same month-end batch pattern on a different ERP instance — so it needs its own connector and its own implementation. At today's cost to serve it adds more cost than revenue, and it does it while making net revenue retention look excellent.",
      reveals: [
        {
          id: "p-b2b-expansion",
          kind: "segments",
          title: "The second division, on today's economics",
          dimension: "Line, annualised",
          rows: [
            { label: "Additional ARR", value: 116 * LAKH, unit: "inr" },
            { label: "Additional support and success", value: 51 * LAKH, unit: "inr" },
            { label: "Second bespoke connector — engineering", value: 51 * LAKH, unit: "inr" },
            { label: "Implementation, one-off", value: 47 * LAKH, unit: "inr" },
          ],
        },
      ],
    },
  ],

  causes: [
    { id: "economics", parentId: null, label: "The economics of the contract", verdict: "The right branch, and the answer is in how it is priced rather than at what level." },
    {
      id: "economics.usage",
      parentId: "economics",
      label: "Usage drives the cost and the contract charges for seats",
      verdict:
        "This was it. 40 of 900 seats drive 71% of the documents and 64% of the tickets, and a bespoke connector that exists only for those forty costs ₹17 lakh a quarter. The price is per seat, so none of that reaches the invoice — and the same connector is 41% of the customer's own cost of ownership.",
    },
    {
      id: "economics.price",
      parentId: "economics",
      label: "The seat price is too low for the market",
      verdict:
        "Not supported. ₹29,000 a seat sits at the 78th percentile of comparable contracts. There is no headroom, and if there were it would be charging the 860 light seats for what the 40 heavy ones cost.",
    },
    { id: "service", parentId: null, label: "How we serve them", verdict: "Expensive, and a symptom rather than a cause." },
    {
      id: "service.quality",
      parentId: "service",
      label: "They are unhappy and support is absorbing it",
      verdict:
        "Not supported. CSAT is 4.3 out of 5, the sponsor renewed the internal mandate last quarter, and 11% of tickets are about the product. The tickets are connector failures on the ERP patch calendar.",
    },
    {
      id: "service.staffing",
      parentId: "service",
      label: "We under-staffed the account",
      verdict:
        "Not supported. Adding people to an account whose load is a quarterly patch cycle buys you more people watching the same thing break. The load is manufactured by the architecture, not by the staffing.",
    },
    { id: "account", parentId: null, label: "The shape of the relationship", verdict: "Stable, and neither branch explains the margin." },
    {
      id: "account.penetration",
      parentId: "account",
      label: "The account is under-penetrated and should be twice this size",
      verdict:
        "Not supported as the cause, and dangerous as a response. The second division runs the same batch pattern on a different ERP instance, so it needs its own connector — expanding at today's cost to serve grows revenue 44% and cuts contract contribution 83%.",
    },
    {
      id: "account.competitive",
      parentId: "account",
      label: "A competitor is undercutting us",
      verdict:
        "Not supported. The evaluation eight months ago stopped when their own team costed re-integration at ₹3.4 crore. There is no live bid; there is a CFO with a cost line he does not like.",
    },
  ],
  trueCauseIds: ["economics.usage"],

  interventions: [
    {
      id: "iv-replatform",
      label: "Retire the bespoke connector and ship native month-end batch",
      pitch:
        "Move them onto the standard integration, and build the month-end batch process into the product so it stops being a thing two teams supervise by hand. Takes the connector out of engineering and out of their operations at the same time.",
      addresses: "economics.usage",
      cost: { sprints: 2, rupees: 46 * LAKH },
      minSprints: 2,
      effects: {
        whenRootCause: [
          { driver: "connectorCost", deltaPct: -0.72 },
          { driver: "tickets", deltaPct: -0.45 },
          { driver: "customerInternalCost", deltaPct: -0.55 },
        ],
        otherwise: [
          { driver: "connectorCost", deltaPct: -0.2 },
          { driver: "tickets", deltaPct: -0.1 },
        ],
      },
      debrief:
        "The answer, and it is the same move on both sides of the table: cost to serve falls from ₹54.3 lakh a quarter to ₹33.1 lakh, and their own cost of ownership falls further than an 18% discount would have taken it. You end up giving them more than they asked for and charging them the same.",
    },
    {
      id: "iv-usage-pricing",
      label: "Reprice: seats for access, usage for volume",
      pitch:
        "Drop the seat price 6% — the 860 light users are genuinely overpaying — and move document volume onto a metered tier so the forty integration seats pay for what they drive.",
      addresses: "economics.usage",
      cost: { sprints: 1, rupees: 14 * LAKH },
      effects: {
        whenRootCause: [
          { driver: "pricePerSeat", deltaPct: -0.06 },
          { driver: "usageRatePerMnDocs", deltaPct: 3.2 },
          { driver: "documentsMn", deltaPct: -0.15 },
        ],
        otherwise: [
          { driver: "pricePerSeat", deltaPct: -0.06 },
          { driver: "usageRatePerMnDocs", deltaPct: 3.2 },
          { driver: "documentsMn", deltaPct: -0.15 },
        ],
      },
      debrief:
        "The structural half. It hands the customer a visible price cut on 860 seats, charges the volume that actually costs you, and — the part nobody expects — cuts volume 15%, because a metered batch is a batch somebody finally tunes. Cheaper to serve and better priced at once.",
    },
    {
      id: "iv-discount",
      label: "Give them the 18% and lock three years",
      pitch:
        "Sales' proposal. Our biggest logo, a three-year commitment, and the reference case study. Eighteen points off 78% margin still leaves a very good account.",
      addresses: "economics.price",
      cost: { sprints: 1, rupees: 6 * LAKH },
      effects: {
        whenRootCause: [
          { driver: "pricePerSeat", deltaPct: -0.18 },
          { driver: "usageRatePerMnDocs", deltaPct: -0.18 },
          { driver: "seats", deltaPct: 0.08 },
        ],
        otherwise: [
          // 18% off the contract, so it comes off the metered line too.
          { driver: "pricePerSeat", deltaPct: -0.18 },
          { driver: "usageRatePerMnDocs", deltaPct: -0.18 },
          { driver: "seats", deltaPct: 0.08 },
          { driver: "documentsMn", deltaPct: 0.05 },
          { driver: "tickets", deltaPct: 0.05 },
        ],
      },
      debrief:
        "Eighteen points off a 19.5% margin, not off a 78% one. It takes contract contribution from ₹72 lakh to about minus ₹37 lakh, locks it in for three years, and relieves about 6% of a customer cost problem that was never about the price — the seats the discount buys add back part of what it took off.",
    },
    {
      id: "iv-expand",
      label: "Land the second division",
      pitch:
        "400 more seats and ₹1.2 crore of ARR from the group's other manufacturing arm. Net revenue retention of 144% and the expansion story the board has been asking for.",
      addresses: "account.penetration",
      cost: { sprints: 2, rupees: 34 * LAKH },
      effects: {
        whenRootCause: [
          { driver: "seats", deltaPct: 0.44 },
          { driver: "documentsMn", deltaPct: 0.3 },
          { driver: "tickets", deltaPct: 0.35 },
        ],
        otherwise: [
          { driver: "seats", deltaPct: 0.44 },
          { driver: "documentsMn", deltaPct: 0.3 },
          { driver: "tickets", deltaPct: 0.55 },
          { driver: "csmCost", deltaPct: 0.45 },
          { driver: "connectorCost", deltaPct: 0.75 },
          { driver: "dealCost", deltaPct: 0.55 },
        ],
      },
      debrief:
        "The most flattering way to make this worse. Revenue up 44%, net revenue retention 144%, and contract contribution down 83% — because the second division runs the same batch pattern on a different ERP instance, so it arrives with its own connector, its own implementation and its own patch calendar. Expansion multiplies the margin you have; it does not fix it.",
    },
    {
      id: "iv-support-tier",
      label: "Move them to premium support",
      pitch:
        "A dedicated queue, a two-hour SLA and a named escalation path. If we are going to carry the load anyway, we should at least carry it properly.",
      addresses: "service.quality",
      cost: { sprints: 1, rupees: 22 * LAKH },
      effects: {
        whenRootCause: [
          { driver: "tickets", deltaPct: -0.2 },
          { driver: "costPerTicket", deltaPct: 0.15 },
        ],
        otherwise: [
          { driver: "costPerTicket", deltaPct: 0.15 },
          { driver: "tickets", deltaPct: -0.12 },
          { driver: "seats", deltaPct: 0.03 },
        ],
      },
      debrief:
        "Handling the same tickets faster and 15% more expensively. Twelve per cent fewer tickets at 15% more each leaves the support line almost exactly where it was, so what you have actually bought is three per cent more seats and a customer who feels better about a connector that still breaks on schedule.",
    },
    {
      id: "iv-csm",
      label: "Add an executive sponsor and a second CSM",
      pitch:
        "Our largest logo has one customer success manager. Put a VP on it and a second CSM, and the relationship stops being a queue.",
      addresses: "service.staffing",
      cost: { sprints: 1, rupees: 18 * LAKH },
      effects: {
        whenRootCause: [
          { driver: "csmCost", deltaPct: 0.4 },
          { driver: "tickets", deltaPct: -0.25 },
        ],
        otherwise: [
          { driver: "csmCost", deltaPct: 0.4 },
          { driver: "tickets", deltaPct: -0.08 },
          { driver: "seats", deltaPct: 0.02 },
        ],
      },
      debrief:
        "Good relationship management, aimed at a problem that is not a relationship. It adds ₹4.2 lakh a quarter of customer success to save ₹1.6 lakh of support, and the connector keeps breaking on the vendor's patch calendar with more people watching it.",
    },
  ],

  // The customer's ERP vendor patches quarterly and their volume keeps rising.
  // Every quarter this is left alone, the connector costs a little more to keep
  // alive and generates a few more tickets.
  drift: [
    { driver: "tickets", deltaPct: 0.06 },
    { driver: "connectorCost", deltaPct: 0.05 },
    { driver: "documentsMn", deltaPct: 0.04 },
  ],
  horizonQuarters: 2,

  parInvestigation: ["dd-cost-to-serve", "dd-usage"],
  bestAllocation: [
    { interventionId: "iv-replatform", sprints: 2, rupees: 46 * LAKH },
    { interventionId: "iv-usage-pricing", sprints: 1, rupees: 14 * LAKH },
  ],

  debrief: {
    causalChain: [
      "The 78% gross margin on the deck is revenue minus hosting. Support sits in the customer success P&L and the connector engineering is booked as R&D, so neither has ever appeared next to this account's revenue.",
      "Fully loaded, the account costs ₹54.3 lakh a quarter to serve against ₹67.5 lakh of revenue — a gross margin of 19.5%.",
      "₹17 lakh of that quarter is one line: two and a half engineers on a bespoke ERP connector that exists only for this customer.",
      "40 of the 900 seats drive 71% of the documents and 64% of the tickets, and 81% of tickets land within five days of the customer's ERP vendor shipping a patch.",
      "The contract charges by seat, so the forty seats generating the cost pay the same ₹7,250 a quarter as the 860 who open a report occasionally.",
      "And the same connector is 41% of the customer's own ₹1.15 crore quarterly cost of ownership — which is what their CFO meant, and why an 18% discount would have relieved 10.6% of a problem that was never the price.",
    ],
    whereTheLeverageWas:
      "The connector, because it is the only line that is large on both sides of the table. Retiring it takes ₹21 lakh a quarter out of your cost to serve and ₹26 lakh a quarter out of theirs — more relief than the discount they asked for, at no cost to your price. Repricing then stops the same thing happening again: seats for access, metered volume for the work, so the forty seats driving the cost are the ones paying for it.",
    strongAnswer:
      "I would not answer the discount question until the margin question is answered, because 18% off 78% and 18% off 19.5% are different conversations. Fully loaded, this account runs at 19.5%: ₹54.3 lakh a quarter to serve ₹67.5 lakh of revenue, and a third of that cost is two and a half engineers on a connector built for one customer. It is invisible because it is booked as R&D. Underneath it is a pricing mismatch — 40 of 900 seats drive 71% of the volume and 64% of the tickets, and we charge by seat. Then the part that changes the negotiation: I would go and cost their side too. Their total cost of ownership is ₹1.15 crore a quarter, our licence is 59% of it, and 41% is work our product creates and does not do. So the CFO asking for 18% is asking us to relieve about a tenth of his problem in the most expensive way available to us. What I would take into the room instead is: we retire the connector, ship native month-end batch, and reprice — seats for access, metered volume for the work, with the seat price down 6%. That gives him more relief than the discount, gives us a margin, and gives both sides a reason to sign three years. And I would fix the margin report, because an account that looked like our best one was our worst.",
  },

  coachFallback: [
    {
      topic: ["cost to serve", "margin", "78", "19.5", "loaded"],
      answer:
        "The 78% counts hosting only. Fully loaded — support, customer success and the bespoke connector — the account costs ₹54.3 lakh a quarter against ₹67.5 lakh of revenue, so the real gross margin is 19.5%.",
    },
    {
      topic: ["connector", "erp", "integration", "patch", "bespoke"],
      answer:
        "The connector is ₹17 lakh a quarter of engineering that exists for one customer, and 81% of tickets land within five days of their ERP vendor patching. It is a third of your cost to serve and 41% of their cost of ownership — the only line that is large on both sides of the table.",
    },
    {
      topic: ["seats", "usage", "pricing", "meter", "40 seats"],
      answer:
        "40 of 900 seats drive 71% of documents and 64% of tickets, and the contract charges per seat — so the users generating the cost pay the same as the ones who open a report once a fortnight. Seats for access and metered volume for the work is what fixes that.",
    },
    {
      topic: ["tco", "total cost", "ownership", "their cost", "cfo"],
      answer:
        "Their total cost of ownership is ₹1.15 crore a quarter and our licence is 59% of it — the rest is two of their engineers on the connector, nine person-days a month of reconciliation and a supervised month-end batch. An 18% discount relieves 10.6% of that; retiring the connector relieves 23%.",
    },
    {
      topic: ["discount", "18%", "renewal", "three year"],
      answer:
        "Eighteen points off a 19.5% margin takes contract contribution from ₹72 lakh to about minus ₹37 lakh, and locks it for three years. It also relieves about a tenth of the customer's actual cost problem, which is the part that makes it a bad trade for both sides.",
    },
    {
      topic: ["expand", "expansion", "nrr", "second division", "retention"],
      answer:
        "The second division runs the same batch pattern on a different ERP instance, so it arrives with its own connector, implementation and patch calendar. Revenue up 44%, net revenue retention 144%, contract contribution down 83% — expansion multiplies the margin you have.",
    },
    {
      topic: ["support", "csat", "unhappy", "csm", "staffing"],
      answer:
        "CSAT is 4.3 out of 5 and 11% of tickets are about the product. Premium support handles the same tickets faster; a second CSM adds ₹4.2 lakh a quarter to save ₹1.6 lakh. Neither touches a connector that breaks on a schedule.",
    },
    {
      topic: ["competitor", "competitive", "undercut", "evaluation"],
      answer:
        "There is no live bid. They evaluated an alternative eight months ago and stopped when their own team costed re-integration at ₹3.4 crore and eleven months. The discount request is a CFO managing a cost line.",
    },
    {
      topic: ["price", "benchmark", "too low", "29000"],
      answer:
        "₹29,000 a seat sits at the 78th percentile of comparable contracts, so there is no headroom. And raising the seat price would charge the 860 light users for what the 40 heavy ones cost, which is the mistake already in the contract.",
    },
  ],
};
