/**
 * "We shipped the whole roadmap and retention got worse."
 *
 * The prioritisation war room. Teaches revenue concentration, net revenue
 * retention, opportunity cost, and the habit the whole thing turns on:
 * **prioritise by the value at risk behind a request, not by how many people
 * made it.**
 *
 * ── The truth, for whoever maintains this ─────────────────────────────────
 *
 * The roadmap is scored on request count. Every quarter the product team ranks
 * asks by how many accounts raised them and builds down the list, which is a
 * defensible process, visibly fair, and the source of the entire problem.
 *
 * Request count runs *inversely* to account size here, and it does so for a
 * reason nobody designed: the twelve accounts that are 46% of ARR each have a
 * named customer success manager, so their asks arrive in a quarterly business
 * review as a conversation. They do not raise tickets. The 610 long-tail
 * accounts that are 20% of ARR have a support queue and nothing else, so every
 * ask they have ever had is in the system, counted, and ranked.
 *
 * Twelve accounts, 46% of the money, 0.5% of the requests. The roadmap has been
 * faithfully and diligently serving the loudest, smallest customers for three
 * quarters, and the demand signal driving it is precise, well-instrumented and
 * completely unrepresentative — which are not contradictory properties.
 *
 * So enterprise roadmap coverage is 11% against 72% for the tail, enterprise
 * churn is running at 6.1% a quarter against a floor of 0.8% — while the long
 * tail sits at 4.6% against a floor of 4.2% it was never going to beat — and NRR
 * has gone from 103% to 94%.
 *
 * ── Balance notes ─────────────────────────────────────────────────────────
 *
 * `iv-voting-portal` is the sharpest trap because it is the *right instinct*
 * pointed the wrong way. Everybody agrees the company should listen to customers
 * better, and a public voting portal is what listening better looks like. It
 * amplifies exactly the bias that caused this: more votes, from the same
 * over-represented accounts, counted the same way. It keeps its full effect
 * through an `otherwise` override — a voting portal genuinely does collect votes
 * and genuinely does move a roadmap — so it fails by making things worse rather
 * than by quietly doing nothing.
 *
 * `iv-hire-six` is the second trap and the most expensive. It lifts coverage
 * across all three tiers by about 22%, which on an enterprise tier sitting at
 * 11% is worth almost nothing and on a tail already at 72% is worth less. More
 * throughput pointed at the same misallocation, at ₹1.5 crore a quarter of
 * additional programme cost.
 *
 * The metric map is deliberately **off**, as on `b2b-deal-tco`. That coverage
 * and churn are connected at all is the discovery here; drawing the graph on
 * arrival would hand it over. The primer still ships, because the vocabulary is
 * a barrier and the structure is the exercise.
 */

import type { SimScenario } from "../types";

const CRORE = 10_000_000;

export const setuRoadmapValue: SimScenario = {
  slug: "setu-roadmap-value",
  title: "Setu: three quarters of shipping the most-requested features, and NRR at 94%",
  company: "Setu",
  premise:
    "A logistics software company built everything its customers asked for most often, and retention went backwards. Work out what the request queue was actually measuring.",
  situation:
    "You are the head of product at Setu, which sells transport-management software to Indian freight and distribution companies. " +
    "For three quarters the roadmap has been ranked by how many accounts asked for each thing, and the team has shipped down that list with unusual discipline — 91% of committed items delivered on time. " +
    "Net revenue retention has gone from 103% to 94% over the same period, and two of the largest accounts have opened renewal conversations early. " +
    "The CEO wants a public feature-voting portal so the company can listen to customers properly. Engineering wants six more people. Sales wants a discount pool for renewals. " +
    "You have 6 analyst-days, then 4 people-weeks and ₹6 crore to decide what the next quarter is for.",
  difficulty: "Medium",
  /**
   * On the saturating engine, and `spend` matters more here than on most: three
   * of the six levers are things you can simply buy more of, and the trap the
   * CEO is proposing is one of them. Without money reaching the P&L, funding
   * every option at once would never be a mistake.
   */
  engine: "v2",
  periodNoun: "quarter",

  // ── Teaching ────────────────────────────────────────────────────────────
  teaching: {
    /**
     * Off, for the same reason as `b2b-deal-tco`. The discovery here is that
     * roadmap coverage and churn are connected at all, and that the connection
     * is worth wildly different amounts on different accounts. A metric map
     * showing churn hanging off coverage per tier is not a hint — it is the
     * answer, drawn.
     *
     * The primer stays. Net revenue retention and value at risk are vocabulary,
     * and a candidate who does not know what NRR counts cannot be expected to
     * notice what it is failing to say.
     */
    showMetricMap: false,
    primer: {
      intro:
        "Almost every business-to-business software company is really two businesses: a small number of large customers and a large number of small ones. The words below are how you tell them apart and how you decide what to build for whom — the first few are about where your revenue actually lives, the last few are about what it costs you to choose.",
      terms: [
        {
          term: "ARR",
          full: "Annual recurring revenue",
          plain: "The subscription revenue your existing customers are contributing over a year, at today's rate.",
          matters:
            "The headline number, and an aggregate — so it says nothing at all about how concentrated it is. Two companies with identical ARR can have completely different businesses underneath.",
          driver: "totalArr",
        },
        {
          term: "Revenue concentration",
          plain: "How much of your revenue sits with how few customers.",
          matters:
            "It decides who you are actually working for. If a handful of accounts are half your revenue, then half your company's future is a conversation with a handful of people — and any process that treats every customer as one vote is quietly working against you.",
          driver: "enterpriseArrShare",
        },
        {
          term: "Churn",
          plain: "The share of revenue that leaves in a period, because customers cancel or shrink.",
          matters:
            "Read it in rupees, not in logos. Losing one account in twelve sounds survivable until you notice which twelve.",
          driver: "grossChurnRate",
        },
        {
          term: "NRR",
          full: "Net revenue retention",
          plain:
            "What this period's customers are worth next period, counting upgrades and downgrades as well as cancellations.",
          formula: "(starting revenue + expansion − contraction − churn) ÷ starting revenue",
          matters:
            "Above 100% means the business grows without winning a single new customer. Below it means you are refilling a leaking bucket, and every rupee of sales effort buys less than it looks like it does.",
          driver: "nrr",
        },
        {
          term: "Value at risk",
          plain:
            "The revenue that would actually be in danger if you do not do a given piece of work.",
          matters:
            "The number a roadmap should be ranked on, and almost never is. 'How many people asked for this' and 'how much money depends on it' are different questions, and they only give the same answer when your customers are all the same size.",
          driver: "enterpriseArr",
        },
        {
          term: "Roadmap coverage",
          plain:
            "The share of a group of customers' asks that the roadmap actually addresses.",
          matters:
            "The link between what you build and whether they stay. It is worth measuring per segment, because an average across segments can look reasonable while one segment gets nothing.",
          driver: "enterpriseCoverage",
        },
        {
          term: "Opportunity cost",
          plain: "What you gave up by doing this instead of the next best thing.",
          matters:
            "The real price of any roadmap decision, and the one that never appears on a plan. A quarter spent on the most-requested features is a quarter not spent on something else, whether or not anybody wrote that down.",
        },
        {
          term: "Selection bias",
          plain:
            "When the way you gather information decides what you find, before anyone looks at it.",
          matters:
            "A demand signal can be precise, well-instrumented and completely unrepresentative at the same time — those are not contradictory. Always ask who is able to appear in the data at all, and who is structurally missing from it.",
        },
      ],
      worked: [
        "ARR is ₹96 crore. Twelve enterprise accounts carry ₹44.2 crore of it, 140 mid-market accounts carry ₹32.6 crore, and 610 long-tail accounts carry ₹19.2 crore.",
        "Requests last quarter: 108 from the twelve enterprise accounts, 1,960 from mid-market, and 18,910 from the long tail. That is 20,978 in total.",
        "So enterprise is 46% of the revenue and 0.5% of the requests. Ranked by request count, they are twelve rows from the bottom of a list of twenty thousand.",
        "Roadmap coverage lands where the ranking puts it: 11% of enterprise asks, 38% of mid-market, 72% of the tail.",
        "Enterprise churn is running at 6.1% a quarter against a floor of 0.8%, and the tail at 4.6% against a floor of 4.2% — so the tail is nearly as good as it can get and the enterprise tier is nearly as bad.",
        "₹4.76 crore of ARR leaves each quarter and ₹3.31 crore comes back as expansion, which is quarterly NRR of 98.5% — about 94% annualised.",
      ],
    },
  },

  // ── The model ───────────────────────────────────────────────────────────
  northStar: "netRetainedArr",
  reported: [
    "retainedArr",
    "nrr",
    "grossChurnRate",
    "churnedArr",
    "enterpriseChurn",
    "enterpriseCoverage",
    "enterpriseArrShare",
  ],
  drivers: [
    { id: "one", kind: "constant", label: "1", unit: "count", goodDirection: "up", value: 1 },

    // ── Where the revenue actually lives ──────────────────────────────────
    { id: "enterpriseArr", kind: "input", label: "Enterprise ARR (12 accounts)", unit: "inr", goodDirection: "up", baseline: 44.16 * CRORE },
    { id: "midArr", kind: "input", label: "Mid-market ARR (140 accounts)", unit: "inr", goodDirection: "up", baseline: 32.64 * CRORE },
    { id: "tailArr", kind: "input", label: "Long-tail ARR (610 accounts)", unit: "inr", goodDirection: "up", baseline: 19.2 * CRORE },
    { id: "totalArr", kind: "sum", label: "ARR", unit: "inr", goodDirection: "up", of: ["enterpriseArr", "midArr", "tailArr"] },
    { id: "enterpriseArrShare", kind: "quotient", label: "Enterprise share of ARR", unit: "ratio", goodDirection: "up", numerator: "enterpriseArr", denominator: "totalArr" },

    // ── Where the requests come from, which is the opposite place ─────────
    { id: "enterpriseRequests", kind: "input", label: "Enterprise requests / quarter", unit: "count", goodDirection: "up", baseline: 108 },
    { id: "midRequests", kind: "input", label: "Mid-market requests / quarter", unit: "count", goodDirection: "up", baseline: 1_960 },
    { id: "tailRequests", kind: "input", label: "Long-tail requests / quarter", unit: "count", goodDirection: "up", baseline: 18_910 },
    { id: "totalRequests", kind: "sum", label: "Requests / quarter", unit: "count", goodDirection: "up", of: ["enterpriseRequests", "midRequests", "tailRequests"] },
    // 46% of the money against 0.5% of the votes. The whole scenario is the gap
    // between this driver and `enterpriseArrShare`.
    { id: "enterpriseRequestShare", kind: "quotient", label: "Enterprise share of requests", unit: "ratio", goodDirection: "up", numerator: "enterpriseRequests", denominator: "totalRequests" },

    /**
     * What share of each tier's asks the roadmap actually addresses.
     *
     * These are the levers. Nothing here allocates a fixed pool between them —
     * the driver graph cannot hold a simplex — so the trade-off is carried where
     * it belongs, in the interventions: every one of them that lifts enterprise
     * coverage lowers the tail's, because a quarter is a quarter.
     */
    { id: "enterpriseCoverage", kind: "input", label: "Enterprise roadmap coverage", unit: "ratio", goodDirection: "up", baseline: 0.11 },
    { id: "midCoverage", kind: "input", label: "Mid-market roadmap coverage", unit: "ratio", goodDirection: "up", baseline: 0.38 },
    { id: "tailCoverage", kind: "input", label: "Long-tail roadmap coverage", unit: "ratio", goodDirection: "up", baseline: 0.72 },
    // A share cannot exceed 1, and two levers pointed at the same tier can
    // multiply past it. Capping here rather than trusting the tuning keeps churn
    // from going negative if anybody ever retunes upward.
    { id: "enterpriseCovered", kind: "min", label: "Enterprise coverage (capped)", unit: "ratio", goodDirection: "up", of: ["enterpriseCoverage", "one"] },
    { id: "midCovered", kind: "min", label: "Mid-market coverage (capped)", unit: "ratio", goodDirection: "up", of: ["midCoverage", "one"] },
    { id: "tailCovered", kind: "min", label: "Long-tail coverage (capped)", unit: "ratio", goodDirection: "up", of: ["tailCoverage", "one"] },
    { id: "enterpriseUncovered", kind: "difference", label: "Enterprise asks not addressed", unit: "ratio", goodDirection: "down", minuend: "one", subtrahend: "enterpriseCovered" },
    { id: "midUncovered", kind: "difference", label: "Mid-market asks not addressed", unit: "ratio", goodDirection: "down", minuend: "one", subtrahend: "midCovered" },
    { id: "tailUncovered", kind: "difference", label: "Long-tail asks not addressed", unit: "ratio", goodDirection: "down", minuend: "one", subtrahend: "tailCovered" },

    /**
     * Churn, in two parts: a floor that happens whatever you build, and a part
     * that responds to whether the roadmap covered them.
     *
     * The split is the quantitative heart of the scenario. The long tail has a
     * high floor and almost no roadmap sensitivity — those accounts leave
     * because the business closes or somebody finds a cheaper tool, and no
     * feature was going to change that. An enterprise account has a floor near
     * zero and is almost entirely roadmap-sensitive, because the roadmap *is*
     * the relationship: there is a named CSM, a quarterly business review and a
     * list of asks with dates against them.
     *
     * That is what makes coverage worth thirty times more per rupee of ARR on
     * one tier than the other, and it is not visible in any blended number.
     */
    { id: "enterpriseChurnFloor", kind: "input", label: "Enterprise churn floor", unit: "ratio", goodDirection: "down", baseline: 0.008 },
    { id: "enterpriseChurnAtRisk", kind: "input", label: "Enterprise churn at stake on the roadmap", unit: "ratio", goodDirection: "down", baseline: 0.06 },
    { id: "midChurnFloor", kind: "input", label: "Mid-market churn floor", unit: "ratio", goodDirection: "down", baseline: 0.016 },
    { id: "midChurnAtRisk", kind: "input", label: "Mid-market churn at stake on the roadmap", unit: "ratio", goodDirection: "down", baseline: 0.032 },
    { id: "tailChurnFloor", kind: "input", label: "Long-tail churn floor", unit: "ratio", goodDirection: "down", baseline: 0.042 },
    { id: "tailChurnAtRisk", kind: "input", label: "Long-tail churn at stake on the roadmap", unit: "ratio", goodDirection: "down", baseline: 0.014 },

    { id: "enterpriseChurnVariable", kind: "product", label: "Enterprise churn from unmet asks", unit: "ratio", goodDirection: "down", of: ["enterpriseChurnAtRisk", "enterpriseUncovered"] },
    { id: "midChurnVariable", kind: "product", label: "Mid-market churn from unmet asks", unit: "ratio", goodDirection: "down", of: ["midChurnAtRisk", "midUncovered"] },
    { id: "tailChurnVariable", kind: "product", label: "Long-tail churn from unmet asks", unit: "ratio", goodDirection: "down", of: ["tailChurnAtRisk", "tailUncovered"] },
    { id: "enterpriseChurn", kind: "sum", label: "Enterprise churn / quarter", unit: "ratio", goodDirection: "down", of: ["enterpriseChurnFloor", "enterpriseChurnVariable"] },
    { id: "midChurn", kind: "sum", label: "Mid-market churn / quarter", unit: "ratio", goodDirection: "down", of: ["midChurnFloor", "midChurnVariable"] },
    { id: "tailChurn", kind: "sum", label: "Long-tail churn / quarter", unit: "ratio", goodDirection: "down", of: ["tailChurnFloor", "tailChurnVariable"] },

    { id: "enterpriseChurnedArr", kind: "product", label: "Enterprise ARR lost", unit: "inr", goodDirection: "down", of: ["enterpriseArr", "enterpriseChurn"] },
    { id: "midChurnedArr", kind: "product", label: "Mid-market ARR lost", unit: "inr", goodDirection: "down", of: ["midArr", "midChurn"] },
    { id: "tailChurnedArr", kind: "product", label: "Long-tail ARR lost", unit: "inr", goodDirection: "down", of: ["tailArr", "tailChurn"] },
    { id: "churnedArr", kind: "sum", label: "ARR lost / quarter", unit: "inr", goodDirection: "down", of: ["enterpriseChurnedArr", "midChurnedArr", "tailChurnedArr"] },
    { id: "grossChurnRate", kind: "quotient", label: "Gross revenue churn / quarter", unit: "ratio", goodDirection: "down", numerator: "churnedArr", denominator: "totalArr" },

    { id: "expansionRate", kind: "input", label: "Expansion rate / quarter", unit: "ratio", goodDirection: "up", baseline: 0.0345 },
    { id: "expansionArr", kind: "product", label: "ARR expansion / quarter", unit: "inr", goodDirection: "up", of: ["totalArr", "expansionRate"] },
    { id: "arrPlusExpansion", kind: "sum", label: "ARR plus expansion", unit: "inr", goodDirection: "up", of: ["totalArr", "expansionArr"] },
    { id: "retainedArr", kind: "difference", label: "Retained ARR", unit: "inr", goodDirection: "up", minuend: "arrPlusExpansion", subtrahend: "churnedArr" },
    { id: "nrr", kind: "quotient", label: "Net revenue retention / quarter", unit: "ratio", goodDirection: "up", numerator: "retainedArr", denominator: "totalArr" },

    /**
     * What the product and engineering organisation costs to run for a quarter,
     * and the driver the committed budget inflates (see `spend`).
     *
     * The north star nets it off, so that "how much?" has an answer that is not
     * "all of it". A roadmap scenario in which spending were free would be a
     * strange thing to teach opportunity cost with.
     */
    { id: "programmeCost", kind: "input", label: "Product and engineering cost / quarter", unit: "inr", goodDirection: "down", baseline: 3.6 * CRORE },
    {
      id: "netRetainedArr",
      kind: "difference",
      label: "Retained ARR, net of programme cost",
      unit: "inr",
      goodDirection: "up",
      minuend: "retainedArr",
      subtrahend: "programmeCost",
    },
  ],

  // ── The free dashboard ──────────────────────────────────────────────────
  dashboard: [
    {
      id: "p-setu-headline",
      kind: "stat",
      title: "The quarter, as the board pack shows it",
      caption: "A delivery organisation doing extremely well at something.",
      tiles: [
        { label: "ARR", value: 96, unit: "inr_crore", deltaPct: 0.02, goodDirection: "up" },
        { label: "Net revenue retention (annualised)", value: 0.94, unit: "ratio", deltaPct: -0.087, goodDirection: "up" },
        { label: "Roadmap items delivered on time", value: 0.91, unit: "ratio", deltaPct: 0.06, goodDirection: "up" },
        { label: "Requests received this quarter", value: 20_978, unit: "count", deltaPct: 0.09, goodDirection: "up" },
        { label: "Requests closed this quarter", value: 14_240, unit: "count", deltaPct: 0.12, goodDirection: "up" },
        { label: "ARR lost this quarter", value: 4.76, unit: "inr_crore", deltaPct: 0.31, goodDirection: "down" },
      ],
    },
    {
      id: "p-setu-nrr",
      kind: "timeseries",
      title: "Net revenue retention, six quarters",
      caption: "The roadmap process was introduced in Q-3.",
      series: [
        {
          label: "NRR, annualised (%)",
          unit: "percent",
          points: [
            { period: "Q-5", value: 103 },
            { period: "Q-4", value: 102 },
            { period: "Q-3", value: 101 },
            { period: "Q-2", value: 98 },
            { period: "Q-1", value: 96 },
            { period: "Q-0", value: 94 },
          ],
        },
      ],
    },
    {
      id: "p-setu-delivery",
      kind: "stat",
      title: "How the product organisation is performing",
      caption: "By every measure the team is judged on, this is the best year it has had.",
      tiles: [
        { label: "Committed items delivered", value: 0.91, unit: "ratio", goodDirection: "up" },
        { label: "Median cycle time (days)", value: 19, unit: "count", deltaPct: -0.24, goodDirection: "down" },
        { label: "Releases per quarter", value: 26, unit: "count", deltaPct: 0.18, goodDirection: "up" },
        { label: "Escaped defects per release", value: 1.4, unit: "count", deltaPct: -0.31, goodDirection: "down" },
      ],
    },
    // ── Decoys ──────────────────────────────────────────────────────────
    //
    // Both true, both correctly derived, both off the causal path. The support
    // panel is the sharper of the two: it is the operational picture of exactly
    // the queue whose shape is causing all of this, and read on its own terms it
    // says the queue is being run excellently — which it is.
    {
      id: "p-setu-support",
      kind: "stat",
      title: "Support and reliability",
      caption: "The operational scorecard for the same quarter.",
      tiles: [
        { label: "Uptime", value: 0.9991, unit: "ratio", goodDirection: "up" },
        { label: "First response within SLA", value: 0.968, unit: "ratio", goodDirection: "up" },
        { label: "Tickets resolved within 48 hours", value: 0.884, unit: "ratio", goodDirection: "up" },
        { label: "Customer satisfaction", value: 4.4, unit: "count", goodDirection: "up" },
      ],
    },
    {
      id: "p-setu-market",
      kind: "segments",
      title: "New business, by industry",
      caption: "Where this year's new logos came from.",
      dimension: "Industry",
      rows: [
        { label: "Third-party logistics", value: 41, unit: "count", deltaPct: 0.22 },
        { label: "Manufacturing distribution", value: 28, unit: "count", deltaPct: 0.15 },
        { label: "Retail and e-commerce", value: 24, unit: "count", deltaPct: 0.31 },
        { label: "Agri and cold chain", value: 9, unit: "count", deltaPct: 0.05 },
      ],
    },
    {
      id: "p-setu-room",
      kind: "note",
      title: "What the room is saying",
      body:
        "CEO: we are clearly not listening to customers well enough. Build a public feature-voting portal so everybody can see what we are working on and vote on what comes next. " +
        "VP Engineering: we are listening fine, we cannot build fast enough. Give me six more engineers and the backlog stops being a queue. " +
        "Sales: they are leaving on price. Give me a discount pool for renewals and I will hold the book together. " +
        "Head of customer success, who has been in the room for all three of these conversations: I have asked four times whether anybody has looked at which accounts the requests are coming from. Nobody has, and I do not have an analyst.",
    },
  ],

  budget: { analystDays: 6, sprints: 4, rupees: 6 * CRORE },

  // ── The data you can buy (14 days of pulls, 6 to spend) ─────────────────
  drilldowns: [
    {
      id: "dd-requests-by-size",
      label: "Requests and ARR, by account size",
      question: "Who is actually asking for things, and who is actually paying us?",
      cost: 2,
      evidenceFor: ["prioritisation.volume"],
      readsAs:
        "They are the same list upside down. Twelve enterprise accounts are 46% of ARR and 0.5% of requests. 610 long-tail accounts are 20% of ARR and 90% of requests. Ranking a roadmap by request count therefore ranks it very nearly by inverse account size.",
      reveals: [
        {
          id: "p-setu-inversion",
          kind: "segments",
          title: "Share of ARR against share of requests",
          dimension: "Tier",
          rows: [
            { label: "Enterprise (12) — share of ARR", value: 0.46, unit: "ratio" },
            { label: "Enterprise (12) — share of requests", value: 0.005, unit: "ratio" },
            { label: "Mid-market (140) — share of ARR", value: 0.34, unit: "ratio" },
            { label: "Mid-market (140) — share of requests", value: 0.093, unit: "ratio" },
            { label: "Long tail (610) — share of ARR", value: 0.2, unit: "ratio" },
            { label: "Long tail (610) — share of requests", value: 0.902, unit: "ratio" },
          ],
        },
        {
          id: "p-setu-inversion-note",
          kind: "note",
          title: "Requests per ₹1 crore of ARR",
          body:
            "Enterprise: 2.4 requests per crore of ARR. Mid-market: 60. Long tail: 985. " +
            "That is a four-hundred-fold difference in how loudly a rupee of revenue is able to speak, and the ranking process treats every request as one vote. " +
            "Nothing about this was decided. It is what happens when you count something without asking who is able to be counted.",
        },
      ],
    },
    {
      id: "dd-roadmap-audit",
      label: "What the last three quarters actually shipped, and for whom",
      question: "Did the process do what it was designed to do?",
      cost: 2,
      dependsOn: ["dd-requests-by-size"],
      evidenceFor: ["prioritisation.volume"],
      readsAs:
        "It did, faultlessly. 11% of enterprise asks are covered by shipped or committed work, against 72% of the long tail's. The team executed a ranked list with 91% on-time delivery — the process worked exactly as designed, and what it was designed to do was serve whoever files the most tickets.",
      reveals: [
        {
          id: "p-setu-coverage",
          kind: "segments",
          title: "Roadmap coverage of open asks, by tier",
          dimension: "Tier",
          rows: [
            { label: "Enterprise", value: 0.11, unit: "ratio" },
            { label: "Mid-market", value: 0.38, unit: "ratio" },
            { label: "Long tail", value: 0.72, unit: "ratio" },
          ],
        },
        {
          id: "p-setu-shipped",
          kind: "note",
          title: "The three quarters, item by item",
          body:
            "Of 34 roadmap items shipped since the process started, 23 came from the top of the request-count ranking and were asked for by 40 or more accounts each — bulk label printing, a mobile POD app, three dashboard variants, CSV import improvements. Every one of those is a genuinely good piece of work and none of it was asked for by any of the twelve largest accounts. " +
            "The enterprise asks that did not make the list are of a different kind: multi-leg rate contracts, a customs-broker integration, granular audit trails for tax assessment, and control-tower APIs. Each was raised by between one and four accounts, which put them between rows 400 and 900 of a ranking by request count. " +
            "Two of those four items appear by name in the renewal conversations that have just opened.",
        },
      ],
    },
    {
      id: "dd-churn-by-size",
      label: "Churn and retention by account size",
      question: "Where is the ARR actually leaving from?",
      cost: 2,
      evidenceFor: ["prioritisation.volume"],
      readsAs:
        "The enterprise tier is churning at 6.1% a quarter against a floor of 0.8%, and the long tail at 4.6% against a floor of 4.2%. So the tail is within half a point of the best it can ever be, and the enterprise tier is running at almost eight times its floor. All of the recoverable churn is in the tier the roadmap is not serving.",
      reveals: [
        {
          id: "p-setu-churn",
          kind: "segments",
          title: "Quarterly revenue churn by tier",
          dimension: "Tier",
          rows: [
            { label: "Enterprise — churn", value: 0.061, unit: "ratio" },
            { label: "Enterprise — churn floor (unavoidable)", value: 0.008, unit: "ratio" },
            { label: "Mid-market — churn", value: 0.036, unit: "ratio" },
            { label: "Mid-market — churn floor", value: 0.016, unit: "ratio" },
            { label: "Long tail — churn", value: 0.046, unit: "ratio" },
            { label: "Long tail — churn floor", value: 0.042, unit: "ratio" },
          ],
        },
        {
          id: "p-setu-churn-note",
          kind: "note",
          title: "Why the floors are so different",
          body:
            "A long-tail account leaves because the business closed, the owner retired, or somebody found a tool at a third of the price. Almost none of that is a feature decision, which is why its churn barely responds to the roadmap however much of it you cover. " +
            "An enterprise account leaves because a two-year list of commitments stopped moving. For those twelve, the roadmap *is* the relationship — there is a named CSM, a quarterly business review and a list of asks with dates against them — so coverage and retention are very nearly the same variable. " +
            "In rupees: a point of coverage is worth about thirty times more on an enterprise account than on a long-tail one. Nothing in the ranking process knows that.",
        },
      ],
    },
    {
      id: "dd-channel",
      label: "How each tier's asks reach us",
      question: "Is the queue even capable of hearing from the big accounts?",
      cost: 2,
      evidenceFor: ["signal.channel"],
      readsAs:
        "Largely not. Every enterprise account has a named CSM, so their asks arrive in a quarterly business review as a conversation and are written into a slide. 4% of them ever become a ticket. The long tail has a support queue and nothing else, so 100% of what they want is in the system, counted and ranked.",
      reveals: [
        {
          id: "p-setu-channel",
          kind: "segments",
          title: "Where an ask ends up, by tier",
          dimension: "Tier",
          rows: [
            { label: "Enterprise — has a named CSM", value: 1, unit: "ratio" },
            { label: "Enterprise — asks that become a ticket", value: 0.04, unit: "ratio" },
            { label: "Mid-market — has a named CSM", value: 0.21, unit: "ratio" },
            { label: "Mid-market — asks that become a ticket", value: 0.63, unit: "ratio" },
            { label: "Long tail — has a named CSM", value: 0, unit: "ratio" },
            { label: "Long tail — asks that become a ticket", value: 1, unit: "ratio" },
          ],
        },
        {
          id: "p-setu-channel-note",
          kind: "note",
          title: "The good intention that built this",
          body:
            "Named CSMs were introduced for the largest accounts three years ago precisely so they would not have to queue behind a support desk. It worked: those accounts have never had to file a ticket in their lives, and they are extremely happy with their CSMs. " +
            "Then a roadmap process was built on the ticket system, because that is where the data was. Two entirely sensible decisions, eighteen months apart, made by different people, and between them they deleted the largest accounts from the demand signal. " +
            "This is the mechanism. It is not quite the cause — moving enterprise asks into the ticket queue would put twelve accounts' worth of tickets against 18,910 others and change the ranking by nothing at all. The cause is what the ranking is counting.",
        },
      ],
    },
    {
      id: "dd-capacity",
      label: "Throughput, and what a bigger team would buy",
      question: "Is this simply a matter of not being able to build fast enough?",
      cost: 2,
      evidenceFor: ["prioritisation.capacity"],
      readsAs:
        "Throughput is up 34% year on year at 91% on-time delivery, and the backlog still grows, because 20,978 requests a quarter arrive against a team that can ship 34 things. No achievable amount of capacity closes that — it is a ranking problem wearing a throughput costume.",
      reveals: [
        {
          id: "p-setu-capacity",
          kind: "segments",
          title: "Delivery, year on year",
          dimension: "Measure",
          rows: [
            { label: "Items shipped per quarter", value: 34, unit: "count", deltaPct: 0.34 },
            { label: "Committed items delivered on time", value: 0.91, unit: "ratio", deltaPct: 0.06 },
            { label: "Requests arriving per quarter", value: 20_978, unit: "count", deltaPct: 0.09 },
            { label: "Open backlog", value: 41_600, unit: "count", deltaPct: 0.27 },
          ],
        },
        {
          id: "p-setu-capacity-note",
          kind: "note",
          title: "What six more engineers buys",
          body:
            "Six engineers on a team of forty is about 15% more capacity, and it costs ₹1.5 crore a quarter fully loaded. Applied to the current ranking, it would ship about five more items a quarter, taken from rows 35 to 40 of a list sorted by request count. " +
            "Those five items would be asked for by roughly 30 accounts each, from the tier whose churn is already within half a point of its floor. " +
            "The arithmetic that matters: the backlog is growing by 8,800 requests a quarter. To close it by building, the team would have to grow by a factor of about six hundred. Capacity is not the variable.",
        },
      ],
    },
    {
      id: "dd-reliability",
      label: "Is the platform letting them down?",
      question: "Are they leaving because the product does not work?",
      cost: 2,
      evidenceFor: ["retention.reliability"],
      readsAs:
        "No. Uptime is 99.91%, escaped defects are down 31%, and satisfaction is 4.4 out of 5 — and it is 4.5 among the twelve accounts that are leaving. They are not unhappy with what exists. They are unhappy about what does not.",
      reveals: [
        {
          id: "p-setu-reliability",
          kind: "segments",
          title: "Reliability and satisfaction, by tier",
          dimension: "Measure",
          rows: [
            { label: "Uptime", value: 0.9991, unit: "ratio" },
            { label: "Satisfaction — enterprise", value: 4.5, unit: "count" },
            { label: "Satisfaction — long tail", value: 4.3, unit: "count" },
            { label: "Enterprise tickets about a defect", value: 0.09, unit: "ratio" },
            { label: "Enterprise tickets about a missing capability", value: 0.71, unit: "ratio" },
          ],
        },
      ],
    },
    {
      id: "dd-pricing",
      label: "What renewal conversations are actually about",
      question: "Are we losing them on price?",
      cost: 2,
      evidenceFor: ["retention.price"],
      readsAs:
        "Price comes up and it is not what decides it. Of eleven accounts lost in the last year, two cited price alone; seven cited a capability they had been asking for. And the two large accounts now in early renewal both put a named roadmap item in writing before anybody mentioned a number.",
      reveals: [
        {
          id: "p-setu-pricing",
          kind: "segments",
          title: "Stated reason, eleven lost accounts",
          dimension: "Reason",
          rows: [
            { label: "A capability we did not build", value: 7, unit: "count" },
            { label: "Price alone", value: 2, unit: "count" },
            { label: "Business closed or was acquired", value: 2, unit: "count" },
          ],
        },
        {
          id: "p-setu-pricing-note",
          kind: "note",
          title: "What a discount would buy",
          body:
            "A renewal discount pool is real money against a real risk, and it works on exactly the accounts whose objection is price. Two of eleven. " +
            "On the other seven it buys a cheaper version of the same conversation next year, and it does it by permanently lowering the ARR of the accounts that are 46% of the book. " +
            "One of the two large accounts in early renewal has already said, in writing, that they would sign three years today for a committed date on the customs-broker integration. Nobody has replied to that email.",
        },
      ],
    },
  ],

  // ── The hypothesis space (10 causes, two levels) ────────────────────────
  causes: [
    { id: "prioritisation", parentId: null, label: "How the roadmap is chosen", verdict: "The right branch, and the answer is what the ranking is denominated in." },
    {
      id: "prioritisation.volume",
      parentId: "prioritisation",
      label: "The roadmap is ranked by how many accounts asked, not by what is at stake",
      verdict:
        "This was it. Request count runs inversely to account size — 2.4 requests per crore of ARR from enterprise against 985 from the long tail — so ranking by votes ranks very nearly by inverse revenue. Enterprise coverage is 11% against the tail's 72%, and enterprise churn is running at almost eight times its floor while the tail is within half a point of its own.",
    },
    {
      id: "prioritisation.capacity",
      parentId: "prioritisation",
      label: "We cannot build fast enough to keep up",
      verdict:
        "Not supported. Throughput is up 34% at 91% on-time delivery, and 20,978 requests arrive each quarter against 34 items shipped. Closing that gap by building would need the team to grow about six hundredfold. More capacity applied to this ranking ships more of the same thing.",
    },
    {
      id: "prioritisation.sequencing",
      parentId: "prioritisation",
      label: "We build the right things in the wrong order",
      verdict:
        "Not supported. Median cycle time is down 24% and 91% of committed items land on time — the sequencing is unusually good. It is a well-run process executing the wrong list, and doing it in a different order would not change which list it is.",
    },
    { id: "signal", parentId: null, label: "What we can hear", verdict: "The mechanism that built the problem, and a step short of the cause." },
    {
      id: "signal.channel",
      parentId: "signal",
      label: "Large accounts have a CSM instead of a ticket queue, so their asks never enter the system",
      verdict:
        "True, and the closest near-miss on the board — this is *how* the bias arose, not what makes it harmful. Only 4% of enterprise asks ever become a ticket. But putting twelve accounts' asks into a queue of 18,910 would change a ranking by request count by essentially nothing. The channel explains why they are invisible; the ranking is what makes invisibility fatal.",
    },
    {
      id: "signal.instrumentation",
      parentId: "signal",
      label: "We cannot see which accounts are at risk until they tell us",
      verdict:
        "Not supported. Every account has a CSM-maintained health score, the twelve largest have quarterly business reviews with minutes, and two of them have put a named roadmap item in writing. The information arrived. Nothing in the prioritisation process was built to read it.",
    },
    { id: "retention", parentId: null, label: "Why customers leave", verdict: "Both branches are things that happen, and neither is what is happening here." },
    {
      id: "retention.reliability",
      parentId: "retention",
      label: "The platform is unreliable and they are leaving over it",
      verdict:
        "Not supported. Uptime is 99.91%, escaped defects are down 31%, and satisfaction among the departing enterprise accounts is 4.5 out of 5 — higher than the book. 71% of their tickets are about a capability that does not exist and 9% about one that is broken.",
    },
    {
      id: "retention.price",
      parentId: "retention",
      label: "We are too expensive at renewal",
      verdict:
        "Not supported, and expensive to act on. Of eleven accounts lost last year, two cited price and seven cited a capability we did not build. A discount pool works on the two, and on the other seven it permanently lowers the ARR of the tier that is 46% of the book to buy the same conversation again next year.",
    },
  ],
  trueCauseIds: ["prioritisation.volume"],

  // ── What you can spend the quarter on ───────────────────────────────────
  interventions: [
    {
      id: "iv-value-at-risk",
      label: "Rank the roadmap by revenue at risk instead of request count",
      pitch:
        "Score every candidate item on the ARR that depends on it — request count times the revenue behind each requester — and rebuild the ranking. Same process, same cadence, same delivery discipline, different denominator.",
      addresses: "prioritisation.volume",
      cost: { sprints: 2, rupees: 2.4 * CRORE },
      minSprints: 2,
      effects: {
        whenRootCause: [
          { driver: "enterpriseCoverage", deltaPct: 2.6 },
          { driver: "midCoverage", deltaPct: 0.25 },
          // The opportunity cost, modelled rather than merely mentioned. A
          // quarter is a quarter, and the tail is where it comes from.
          { driver: "tailCoverage", deltaPct: -0.3 },
        ],
        otherwise: [
          { driver: "enterpriseCoverage", deltaPct: 0.3 },
          { driver: "tailCoverage", deltaPct: -0.1 },
        ],
      },
      debrief:
        "The answer, and the cheapest thing on the board because it changes a sort order rather than a capacity. Enterprise coverage goes from 11% to roughly 37%, mid-market improves, and the long tail falls from 72% to about 53% — which is the honest price and worth paying, because the tail's churn is already within half a point of its floor and no roadmap item was going to move it. The team, the cadence and the 91% delivery record all stay exactly as they are.",
    },
    {
      id: "iv-enterprise-squad",
      label: "Stand up a squad against the twelve largest accounts",
      pitch:
        "Take eight engineers and a PM out of the general pool and point them at the enterprise commitment list — multi-leg rate contracts, the customs-broker integration, audit trails — with dates the CSMs can put in front of a customer.",
      addresses: "prioritisation.volume",
      cost: { sprints: 2, rupees: 1.6 * CRORE },
      effects: {
        whenRootCause: [
          { driver: "enterpriseCoverage", deltaPct: 1.4 },
          { driver: "tailCoverage", deltaPct: -0.12 },
        ],
        otherwise: [
          { driver: "enterpriseCoverage", deltaPct: 0.2 },
          { driver: "tailCoverage", deltaPct: -0.12 },
        ],
      },
      debrief:
        "The delivery half of the same idea, and it needs the ranking change to be worth much — a squad pointed at the enterprise list by a process that still ranks on votes will be re-tasked within a quarter. Together they take enterprise coverage past 80% and enterprise churn from 6.1% to about 1.8%, which is most of the recoverable churn in the business.",
    },
    {
      id: "iv-voting-portal",
      label: "Build a public feature-voting portal",
      pitch:
        "The CEO's proposal. Publish the roadmap, let every customer vote on what comes next, and make the whole process transparent. Nobody could accuse us of not listening after this.",
      addresses: "signal.channel",
      cost: { sprints: 1, rupees: 1.2 * CRORE },
      /**
       * The trap has to work, or the lesson inverts.
       *
       * The engine's off-target default saturates early and low, on the
       * reasoning that money aimed at the wrong cause stops working almost
       * immediately. A voting portal is not that: it genuinely collects votes
       * and a roadmap ranked on votes genuinely moves in response. It works
       * perfectly, and what it does is amplify the exact bias that caused this —
       * more votes, from the same over-represented accounts, counted the same
       * way.
       *
       * Blunting it would teach the wrong thing entirely. The point is not that
       * listening to customers is futile; it is that a demand signal can be
       * precise, well-instrumented and unrepresentative at once, and that
       * collecting more of a biased signal makes the bias stronger rather than
       * visible.
       */
      saturation: { whenRootCause: { kind: "hill", ceiling: 1.0, halfAt: 0.3 }, otherwise: { kind: "hill", ceiling: 1.0, halfAt: 0.3 } },
      effects: {
        whenRootCause: [
          { driver: "tailCoverage", deltaPct: 0.18 },
          { driver: "midCoverage", deltaPct: 0.05 },
          { driver: "enterpriseCoverage", deltaPct: -0.35 },
        ],
        otherwise: [
          { driver: "tailCoverage", deltaPct: 0.18 },
          { driver: "midCoverage", deltaPct: 0.05 },
          { driver: "enterpriseCoverage", deltaPct: -0.35 },
        ],
      },
      debrief:
        "The most instructive way to make this worse, and it does exactly what it promised. Votes go up, the roadmap becomes more responsive to them, and the twelve accounts that are 46% of ARR — who do not use a ticket queue and will not use a voting portal either — lose what little coverage they had. The instinct is right: the company is not hearing its customers. The move takes the channel that is already deafening it and turns the volume up.",
    },
    {
      id: "iv-hire-six",
      label: "Hire six more engineers",
      pitch:
        "The VP Engineering's proposal: the backlog is 41,600 items and growing. Add 15% more capacity and start closing the gap.",
      addresses: "prioritisation.capacity",
      cost: { sprints: 1, rupees: 2.8 * CRORE },
      /**
       * Capacity is exactly as buyable as the hiring plan says. Blunting it
       * would teach that hiring does not work, when the lesson is that hiring
       * works fine and is pointed at the wrong list.
       */
      saturation: { otherwise: { kind: "hill", ceiling: 1.0, halfAt: 0.35 } },
      effects: {
        whenRootCause: [
          { driver: "enterpriseCoverage", deltaPct: 0.3 },
          { driver: "midCoverage", deltaPct: 0.3 },
          { driver: "tailCoverage", deltaPct: 0.3 },
          { driver: "programmeCost", deltaPct: 0.55 },
        ],
        otherwise: [
          { driver: "enterpriseCoverage", deltaPct: 0.3 },
          { driver: "midCoverage", deltaPct: 0.3 },
          { driver: "tailCoverage", deltaPct: 0.3 },
          { driver: "programmeCost", deltaPct: 0.55 },
        ],
      },
      debrief:
        "More throughput, pointed at the same misallocation. Coverage rises about 22% on every tier, which on an enterprise tier sitting at 11% is worth roughly two points and on a tail already at 72% is worth nothing at all — and it adds ₹1.5 crore a quarter of permanent cost to buy it. The backlog grows by 8,800 requests a quarter; to close it by building you would need to grow the team about six hundredfold. When arithmetic is that far off, the variable you are pulling is not the one that matters.",
    },
    {
      id: "iv-renewal-discount",
      label: "Open a renewal discount pool",
      pitch:
        "Sales' proposal: ₹1 crore of discretionary discount to hold the book together while the roadmap catches up.",
      addresses: "retention.price",
      cost: { sprints: 1, rupees: 1.0 * CRORE },
      effects: {
        whenRootCause: [
          { driver: "enterpriseChurnFloor", deltaPct: -0.15 },
          { driver: "expansionRate", deltaPct: -0.08 },
        ],
        otherwise: [
          { driver: "enterpriseChurnFloor", deltaPct: -0.1 },
          // A discount is a permanent reduction in what the base is worth, and
          // it lands on the tier that is 46% of it.
          { driver: "enterpriseArr", deltaPct: -0.055 },
          { driver: "expansionRate", deltaPct: -0.12 },
        ],
      },
      debrief:
        "Paying to postpone the conversation. It works on the two of eleven lost accounts whose objection was actually price, and on the other seven it buys a cheaper version of the same discussion next year — while permanently lowering the ARR of the tier that is 46% of the book and taking expansion down with it. The account that offered three years for a committed integration date was not asking for a discount.",
    },
    {
      id: "iv-health-scoring",
      label: "Build account health scoring and churn prediction",
      pitch:
        "Instrument usage, support and CSM signals into a single risk score so we know which accounts are in trouble before the renewal conversation opens.",
      addresses: "signal.instrumentation",
      cost: { sprints: 1, rupees: 1.4 * CRORE },
      effects: {
        whenRootCause: [
          { driver: "enterpriseCoverage", deltaPct: 0.35 },
          { driver: "midCoverage", deltaPct: 0.1 },
        ],
        otherwise: [
          { driver: "enterpriseCoverage", deltaPct: 0.08 },
          { driver: "midCoverage", deltaPct: 0.04 },
        ],
      },
      debrief:
        "A better answer to a question that has already been answered. Every account already has a CSM-maintained health score, the twelve largest have minuted quarterly reviews, and two of them have put the specific roadmap item they need in writing. There is no shortage of signal about which accounts are at risk or why — there is a prioritisation process with no input for it. Building a more precise version of information you are already ignoring is one of the most reliable ways to spend a quarter.",
    },
  ],

  /**
   * Committing the whole budget adds about 38% to what the product and
   * engineering organisation costs for the quarter — contractors, a migration
   * running alongside the existing process, and the management to hold both.
   *
   * Sized against the ARR actually at stake rather than against the budget's
   * face value: ₹6 crore is a one-off programme and the north star is a
   * quarterly figure.
   */
  spend: { driver: "programmeCost", atFullBudget: 0.38 },

  /**
   * The quarter not going exactly to plan.
   *
   * Enterprise churn is twelve accounts, so it is lumpy in a way a rate cannot
   * express and the sigma is the widest here; the long tail is 610 accounts and
   * averages out to something close to arithmetic. Expansion moves with how many
   * renewals happen to land in the quarter.
   */
  noise: {
    drivers: [
      { driver: "enterpriseChurnAtRisk", sigma: 0.045 },
      { driver: "tailChurnFloor", sigma: 0.012 },
      { driver: "expansionRate", sigma: 0.03 },
    ],
    driftSigma: 0.25,
  },

  // Every quarter the enterprise commitment list goes unserved, more of it comes
  // due — and the long tail keeps filing tickets, so the ranking keeps drifting
  // further from where the money is.
  drift: [
    { driver: "enterpriseChurnAtRisk", deltaPct: 0.06 },
    { driver: "tailRequests", deltaPct: 0.05 },
    { driver: "expansionRate", deltaPct: -0.04 },
  ],
  horizonQuarters: 2,

  parInvestigation: ["dd-requests-by-size", "dd-roadmap-audit"],
  // Certified by `pnpm tsx scripts/best-allocation.ts setu-roadmap-value`, not
  // chosen by hand.
  bestAllocation: [
    { interventionId: "iv-value-at-risk", sprints: 2, rupees: 2.4375 * CRORE },
    { interventionId: "iv-enterprise-squad", sprints: 2, rupees: 1.75 * CRORE },
  ],

  debrief: {
    causalChain: [
      "The roadmap is ranked by how many accounts asked for each item, and built down the list.",
      "Request count runs inversely to account size: 2.4 requests per crore of ARR from the enterprise tier, 60 from mid-market, 985 from the long tail.",
      "That inversion has a cause nobody designed. The twelve largest accounts each have a named CSM, so their asks arrive as a conversation in a quarterly review — only 4% ever become a ticket. The 610 smallest have a support queue and nothing else, so all of their asks are in the system.",
      "So ranking by votes ranks very nearly by inverse revenue, and the roadmap has been faithfully serving the loudest, smallest accounts for three quarters.",
      "Coverage lands where the ranking puts it: 11% of enterprise asks, 38% of mid-market, 72% of the long tail.",
      "Churn responds to coverage very differently by tier. Long-tail accounts leave because businesses close, so their churn sits at 4.6% against a 4.2% floor no feature can move.",
      "Enterprise accounts leave because a list of commitments stopped moving — for them the roadmap is the relationship — so their churn is at 6.1% against a floor of 0.8%.",
      "Almost all of the recoverable churn in the business is therefore in the tier the roadmap does not serve, and NRR has gone from 103% to 94% while the delivery organisation had its best year on record.",
    ],
    whereTheLeverageWas:
      "The denominator of the ranking, not the size of the team and not the volume of the signal. Scoring items on the ARR that depends on them rather than on how many accounts asked takes enterprise coverage from 11% to about 37% without changing the team, the cadence or the 91% delivery record — and pointing a squad at the twelve accounts' commitment list takes it past 84%, which takes enterprise churn from 6.1% to about 1.9% and quarterly NRR back above 100%. The long tail's coverage falls from 72% to about 53% on the re-ranking alone, and to about 47% with the squad alongside it — that is the honest price: their churn is already within half a point of a floor no roadmap item can move, so the revenue given up is much smaller than the revenue recovered. Everything else on the board pushes harder on a process that is already working perfectly at the wrong thing.",
    strongAnswer: [
      "The first thing worth saying is that nothing here looks broken, and that is the problem — the delivery organisation had its best year while retention fell nine points.",
      "So I would not start with what we shipped. I would start with how we decided.",
      "The roadmap is ranked by how many accounts asked for each item. That sounds fair, and it is only fair if your customers are all the same size.",
      "Ours are not. Twelve accounts are 46% of ARR; 610 accounts are 20%.",
      "Now put those together: enterprise raises 2.4 requests per crore of revenue, the long tail raises 985. Four hundred times louder per rupee.",
      "So a ranking by request count is very close to a ranking by inverse revenue, and we have executed it with 91% on-time delivery for three quarters.",
      "The mechanism is worth naming because it was two good decisions colliding. We gave the largest accounts named CSMs so they would never have to queue — and then built the roadmap process on the ticket system, because that is where the data was.",
      "That is selection bias, and it is the kind that is hardest to see: the signal is precise, well-instrumented, and structurally missing the people who matter most.",
      "Then the number that decides the whole case. Long-tail churn is 4.6% against a 4.2% floor — those accounts leave because businesses close, and no feature changes that.",
      "Enterprise churn is 6.1% against a floor of 0.8%. Almost all the recoverable churn we have is in the tier we are not building for.",
      "Name the trap, and be careful with it because the instinct is right: a public voting portal is what listening better looks like, and it would work exactly as designed.",
      "It collects more votes from the same over-represented accounts and counts them the same way. It makes the bias stronger, not visible. The twelve accounts that are 46% of ARR will not use a voting portal any more than they use the ticket queue.",
      "Name the second: six more engineers is 15% more capacity against a backlog growing by 8,800 items a quarter. To close that by building, we would need to grow about six hundredfold.",
      "What I would do: re-rank the roadmap on the ARR at risk behind each item, and put a squad on the twelve accounts' commitment list with dates the CSMs can show them.",
      "Accept the price honestly — long-tail coverage falls from 72% to under half, and that is worth paying precisely because their churn is already within half a point of a floor no feature can move.",
      "And answer the email. One of the two accounts in early renewal has offered three years for a committed date on the customs-broker integration, and nobody has replied.",
    ],
  },

  coachFallback: [
    {
      topic: ["request count", "votes", "ranking", "prioritisation", "how we decide"],
      answer: [
        "The roadmap is ranked by how many accounts asked for each item, which sounds fair and only is fair if your customers are the same size.",
        "Enterprise raises 2.4 requests per crore of revenue; the long tail raises 985 — four hundred times louder per rupee.",
        "So ranking by votes is very nearly ranking by inverse revenue, and we executed that list faultlessly for three quarters.",
      ],
    },
    {
      topic: ["concentration", "12 accounts", "46%", "enterprise", "who pays us"],
      answer: [
        "Twelve accounts are 46% of ARR. 610 accounts are 20%.",
        "Those twelve raised 108 requests last quarter out of 20,978 — half a per cent of the signal.",
        "Any process that treats a request as one vote is quietly working for the other half of the book.",
      ],
    },
    {
      topic: ["csm", "channel", "ticket", "why invisible", "selection bias"],
      answer: [
        "The largest accounts each have a named CSM, introduced three years ago so they would never have to queue behind a support desk. It worked — only 4% of their asks ever become a ticket.",
        "Then the roadmap process was built on the ticket system, because that is where the data was. Two sensible decisions, eighteen months apart, that between them deleted the biggest customers from the demand signal.",
        "That is the mechanism rather than the cause. Putting twelve accounts into a queue of 18,910 would not change a ranking by request count — what has to change is what the ranking counts.",
      ],
    },
    {
      topic: ["voting portal", "vote", "listen to customers", "ceo", "transparency"],
      answer: [
        "It would work exactly as designed, and that is the trouble: it collects more votes from the same over-represented accounts and counts them the same way.",
        "The twelve accounts that are 46% of ARR do not use the ticket queue and will not use a voting portal either, so their coverage falls further.",
        "The instinct is right — we are not hearing our customers. The move turns up the volume on the channel that is already deafening us.",
      ],
    },
    {
      topic: ["hire", "engineers", "capacity", "throughput", "backlog", "build faster"],
      answer: [
        "Throughput is already up 34% year on year at 91% on-time delivery, and the backlog still grew 27%.",
        "20,978 requests arrive each quarter against 34 items shipped. Six more engineers is about five more items, taken from rows 35 to 40 of the same wrong list.",
        "To close the backlog by building, the team would have to grow roughly six hundredfold. When the arithmetic is that far out, capacity is not the variable.",
      ],
    },
    {
      topic: ["churn", "floor", "nrr", "retention", "which tier"],
      answer: [
        "Long-tail churn is 4.6% a quarter against a floor of 4.2% — those accounts leave because businesses close or somebody is cheaper, and no feature moves that.",
        "Enterprise churn is 6.1% against a floor of 0.8%, because for those twelve the roadmap *is* the relationship.",
        "So nearly all the recoverable churn in the company is in the tier the roadmap is not serving. A point of coverage is worth about thirty times more there.",
      ],
    },
    {
      topic: ["discount", "price", "renewal", "sales", "too expensive"],
      answer: [
        "Of eleven accounts lost last year, two cited price and seven cited a capability we had not built.",
        "A discount pool works on the two, and on the other seven it buys a cheaper version of the same conversation next year — while permanently cutting the ARR of the tier that is 46% of the book.",
        "The account that offered three years for a committed integration date was not asking for a discount.",
      ],
    },
    {
      topic: ["opportunity cost", "long tail", "price of the fix", "what do we give up"],
      answer: [
        "Long-tail coverage falls from 72% to about 53%. That is real and it is the honest price of the fix.",
        "It is worth paying because their churn is already within half a point of a floor no roadmap item can move, so what you give up is much less than what you recover.",
        "That comparison — what is at stake on each side — is the whole decision, and a ranking by request count cannot express it.",
      ],
    },
    {
      topic: ["health score", "instrumentation", "predict", "at risk", "signal"],
      answer: [
        "Every account already has a CSM-maintained health score, and the twelve largest have minuted quarterly reviews.",
        "Two of them have put the exact roadmap item they need in writing. The information arrived.",
        "There is no shortage of signal about who is at risk — there is a prioritisation process with nowhere to put it. A more precise version of something you are already ignoring is not an answer.",
      ],
    },
    {
      topic: ["reliability", "uptime", "quality", "unhappy", "product broken"],
      answer: [
        "Uptime is 99.91%, escaped defects are down 31%, and satisfaction among the departing enterprise accounts is 4.5 out of 5 — higher than the book average.",
        "71% of their tickets are about a capability that does not exist; 9% are about one that is broken.",
        "They are not unhappy with what we built. They are leaving over what we did not.",
      ],
    },
  ],
};
