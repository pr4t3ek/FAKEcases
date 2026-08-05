/**
 * "We're adding subscribers every month and losing more money every month."
 *
 * The subscription counterpart to the ad-funnel scenario. Teaches LTV, CAC,
 * payback and — the one that actually decides the business — churn.
 *
 * ── The truth, for whoever maintains this ─────────────────────────────────
 *
 * The subscriber base is not a number the company controls directly. It settles
 * wherever monthly joiners divided by monthly churn puts it:
 *
 *     steady-state subscribers = new subscribers per month ÷ churn rate
 *
 * That single quotient is the whole scenario. At 18,000 joiners and 11% monthly
 * churn the base settles at about 1.64 lakh, and no amount of extra acquisition
 * changes the *shape* of that — it only moves the numerator, at a cost. Halving
 * churn doubles the base for the same spend, which is why retention beats
 * acquisition here and why the model is built to make that arithmetic visible
 * rather than assert it.
 *
 * The flattering number is LTV:CAC of 4.6, which every deck treats as healthy.
 * It is healthy per subscriber. It says nothing about whether the base is large
 * enough to cover ₹2.6 crore of fixed costs, and it isn't.
 *
 * ── Balance notes ─────────────────────────────────────────────────────────
 *
 * `iv-more-ads` genuinely helps — more joiners really do raise the steady-state
 * base — which makes it a much better trap than a simply-wrong option. It just
 * helps about a quarter as much as fixing churn, and costs more to do it.
 * `iv-price-up` raises ARPU and churn together, and the churn term wins because
 * it is divided into the base.
 */

import type { SimScenario } from "../types";

const LAKH = 100_000;
const CRORE = 100 * LAKH;

export const subscriptionLtvCac: SimScenario = {
  slug: "subscription-ltv-cac",
  title: "Padhai Plus: 18,000 new subscribers a month, and a bigger hole",
  company: "Padhai Plus",
  premise:
    "A test-prep subscription is adding subscribers every month and burning more cash every month. LTV:CAC says 4.6, which is supposed to be healthy.",
  situation:
    "You are the PM for growth at Padhai Plus, a test-prep subscription for JEE and NEET aspirants at ₹249 a month. " +
    "18,000 people subscribe every month, the base is growing, and the LTV to CAC ratio is 4.6 — comfortably above the 3.0 the board asked for. " +
    "The company still burns about ₹34 lakh a month, and the burn has been getting worse, not better. " +
    "You have 6 analyst-days to find out why, then 3 sprints and ₹60 lakh to change it.",
  difficulty: "Easy",
  periodNoun: "month",

  teaching: {
    showMetricMap: true,
    primer: {
      intro:
        "A subscription business is a bucket with a tap and a hole. The tap is how many people join each month; the hole is the share who leave. The size of the bucket settles where those two balance — and most of the terms below are just ways of describing that. The metric map on the right shows the whole thing with live numbers.",
      terms: [
        {
          term: "Churn rate",
          plain: "The share of your subscribers who cancel in a month.",
          formula: "subscribers lost ÷ subscribers at the start",
          matters:
            "It is the hole in the bucket. Everything else in a subscription business is downstream of it.",
          driver: "churnRate",
        },
        {
          term: "Average lifetime",
          plain: "How many months a typical subscriber stays before cancelling.",
          formula: "1 ÷ churn rate",
          matters:
            "11% monthly churn means a subscriber lasts about 9 months. Halve the churn and they last 18 — the same person, twice the revenue.",
          driver: "lifetimeMonths",
        },
        {
          term: "Steady-state base",
          plain: "The size the subscriber base settles at if nothing changes.",
          formula: "new subscribers per month ÷ churn rate",
          matters:
            "The most important formula here. It says your base is decided as much by how fast people leave as by how many you recruit.",
          driver: "subscribers",
        },
        {
          term: "ARPU",
          full: "Average revenue per user",
          plain: "What one subscriber pays you in a month.",
          formula: "monthly revenue ÷ subscribers",
          matters: "Raising it looks like free money until you check what it did to churn.",
          driver: "arpu",
        },
        {
          term: "Contribution per subscriber",
          plain: "What one subscriber leaves behind each month after the cost of serving them.",
          formula: "ARPU × gross margin",
          matters: "The real monthly earning power of a subscriber — not the price on the pack.",
          driver: "marginPerSub",
        },
        {
          term: "CAC",
          full: "Customer acquisition cost",
          plain: "What you spent on marketing to win one subscriber.",
          formula: "acquisition spend ÷ new subscribers",
          matters: "Only meaningful next to LTV and payback. On its own it is just a bill.",
          driver: "cac",
        },
        {
          term: "LTV",
          full: "Lifetime value",
          plain: "The total contribution one subscriber leaves behind before they cancel.",
          formula: "contribution per subscriber × average lifetime",
          matters:
            "Because lifetime is 1 ÷ churn, LTV is extremely sensitive to churn — small changes there move it a long way.",
          driver: "ltv",
        },
        {
          term: "LTV : CAC",
          plain: "How many rupees a subscriber returns for each rupee spent winning them.",
          formula: "LTV ÷ CAC",
          matters:
            "Above 3 is the usual rule of thumb. It is a per-subscriber test, so it can look healthy while the company as a whole loses money — which is exactly what is happening here.",
          driver: "ltvCacRatio",
        },
        {
          term: "Payback period",
          plain: "How many months a subscriber takes to repay what you spent acquiring them.",
          formula: "CAC ÷ contribution per subscriber",
          matters: "Short payback means growth funds itself. Long payback means growth needs a bank.",
          driver: "paybackMonths",
        },
      ],
      worked: [
        "18,000 people join each month and 11% of the base cancels, so the base settles at 18,000 ÷ 0.11 ≈ 1.64 lakh subscribers.",
        "A subscriber lasts 1 ÷ 0.11 ≈ 9.1 months and contributes ₹249 × 71% = ₹177 a month, so LTV ≈ ₹1,607.",
        "CAC is ₹63,00,000 ÷ 18,000 = ₹350, so LTV:CAC is 4.6 and payback is under two months. Both look excellent.",
        "And yet: 1.64 lakh × ₹177 = ₹2.89 crore of monthly contribution, against ₹63 lakh of acquisition and ₹2.6 crore of fixed costs. The company burns ₹34 lakh a month.",
      ],
    },
  },

  northStar: "netCash",
  reported: ["churnRate", "subscribers", "ltv", "cac", "ltvCacRatio", "lifetimeMonths"],
  drivers: [
    { id: "newSubs", kind: "input", label: "New subscribers / month", unit: "count", goodDirection: "up", baseline: 18_000 },
    { id: "churnRate", kind: "input", label: "Monthly churn", unit: "ratio", goodDirection: "down", baseline: 0.11 },
    { id: "one", kind: "constant", label: "1", unit: "count", goodDirection: "up", value: 1 },
    {
      id: "lifetimeMonths",
      kind: "quotient",
      label: "Average lifetime (months)",
      unit: "count",
      goodDirection: "up",
      numerator: "one",
      denominator: "churnRate",
    },
    // The heart of the scenario: the base is not set, it settles.
    {
      id: "subscribers",
      kind: "quotient",
      label: "Subscribers",
      unit: "count",
      goodDirection: "up",
      numerator: "newSubs",
      denominator: "churnRate",
    },
    { id: "arpu", kind: "input", label: "ARPU", unit: "inr", goodDirection: "up", baseline: 249 },
    { id: "grossMarginRate", kind: "input", label: "Gross margin", unit: "ratio", goodDirection: "up", baseline: 0.71 },
    {
      id: "marginPerSub",
      kind: "product",
      label: "Contribution per subscriber",
      unit: "inr",
      goodDirection: "up",
      of: ["arpu", "grossMarginRate"],
    },
    {
      id: "grossProfit",
      kind: "product",
      label: "Monthly contribution",
      unit: "inr",
      goodDirection: "up",
      of: ["subscribers", "marginPerSub"],
    },
    { id: "acquisitionSpend", kind: "input", label: "Acquisition spend / month", unit: "inr", goodDirection: "down", baseline: 63 * LAKH },
    {
      id: "cac",
      kind: "quotient",
      label: "CAC",
      unit: "inr",
      goodDirection: "down",
      numerator: "acquisitionSpend",
      denominator: "newSubs",
    },
    { id: "ltv", kind: "product", label: "Lifetime value", unit: "inr", goodDirection: "up", of: ["marginPerSub", "lifetimeMonths"] },
    { id: "ltvCacRatio", kind: "quotient", label: "LTV : CAC", unit: "ratio", goodDirection: "up", numerator: "ltv", denominator: "cac" },
    {
      id: "paybackMonths",
      kind: "quotient",
      label: "Payback (months)",
      unit: "count",
      goodDirection: "down",
      numerator: "cac",
      denominator: "marginPerSub",
    },
    { id: "fixedCosts", kind: "input", label: "Fixed costs / month", unit: "inr", goodDirection: "down", baseline: 2.6 * CRORE },
    { id: "totalCosts", kind: "sum", label: "Total monthly costs", unit: "inr", goodDirection: "down", of: ["acquisitionSpend", "fixedCosts"] },
    {
      id: "netCash",
      kind: "difference",
      label: "Monthly net cash",
      unit: "inr",
      goodDirection: "up",
      minuend: "grossProfit",
      subtrahend: "totalCosts",
    },
  ],

  dashboard: [
    {
      id: "p-sub-headline",
      kind: "stat",
      title: "This month",
      caption: "Every ratio on this row is above target. The last number is not.",
      tiles: [
        { label: "Subscribers", value: 163_636, unit: "count", deltaPct: 0.06, goodDirection: "up" },
        { label: "New this month", value: 18_000, unit: "count", deltaPct: 0.04, goodDirection: "up" },
        { label: "LTV : CAC", value: 4.59, unit: "ratio", goodDirection: "up" },
        { label: "Payback (months)", value: 1.98, unit: "count", goodDirection: "down" },
        { label: "Monthly contribution", value: 2.893 * CRORE, unit: "inr", goodDirection: "up" },
        { label: "Monthly net cash", value: -0.337 * CRORE, unit: "inr", deltaPct: -0.22, goodDirection: "up" },
      ],
    },
    {
      id: "p-sub-trend",
      kind: "timeseries",
      title: "Subscribers and net cash, last 6 months",
      caption: "The base is growing. The burn is growing faster.",
      series: [
        {
          label: "Subscribers (lakh)",
          unit: "count",
          points: [
            { period: "M-5", value: 1.44 },
            { period: "M-4", value: 1.49 },
            { period: "M-3", value: 1.54 },
            { period: "M-2", value: 1.58 },
            { period: "M-1", value: 1.61 },
            { period: "M-0", value: 1.64 },
          ],
        },
        {
          label: "Net cash (₹ crore)",
          unit: "inr_crore",
          points: [
            { period: "M-5", value: -0.19 },
            { period: "M-4", value: -0.22 },
            { period: "M-3", value: -0.25 },
            { period: "M-2", value: -0.29 },
            { period: "M-1", value: -0.31 },
            { period: "M-0", value: -0.34 },
          ],
        },
      ],
    },
    {
      id: "p-sub-flow",
      kind: "funnel",
      title: "The bucket, this month",
      caption: "You add 18,000 and lose 18,000. The base barely moves.",
      steps: [
        { label: "Subscribers at start", value: 163_636 },
        { label: "Joined", value: 18_000 },
        { label: "Cancelled", value: 18_000 },
      ],
    },
    {
      id: "p-sub-room",
      kind: "note",
      title: "What the room is saying",
      body:
        "Growth: LTV:CAC is 4.6 and payback is under two months. Every rupee we put into acquisition comes back in eight weeks — we should be spending far more. " +
        "Finance: we have eleven months of runway and the burn is getting worse each month. " +
        "Content: our NPS is 41, which is fine for the category. Nobody has asked me about cancellations.",
    },
  ],

  budget: { analystDays: 6, sprints: 3, rupees: 60 * LAKH },

  drilldowns: [
    {
      id: "dd-retention-curve",
      label: "Retention curve by monthly cohort",
      question: "How long do subscribers actually stay?",
      cost: 3,
      evidenceFor: ["retention.churn"],
      readsAs:
        "Half of every cohort is gone by month four. At 11% a month the base replaces itself roughly every nine months, so acquisition spend never compounds — it only refills.",
      reveals: [
        {
          id: "p-retention",
          kind: "timeseries",
          title: "Share of a cohort still subscribed",
          series: [
            {
              label: "Retained",
              unit: "ratio",
              points: [
                { period: "M1", value: 1.0 },
                { period: "M2", value: 0.78 },
                { period: "M3", value: 0.63 },
                { period: "M4", value: 0.51 },
                { period: "M6", value: 0.36 },
                { period: "M9", value: 0.22 },
              ],
            },
          ],
        },
        {
          id: "p-retention-note",
          kind: "note",
          title: "What that costs",
          body:
            "Steady-state subscribers = joiners ÷ churn. At 18,000 and 11% the base settles at about 1.64 lakh. At 6.6% churn the same 18,000 joiners would settle at 2.7 lakh — a 67% bigger business for exactly the same acquisition spend.",
        },
      ],
    },
    {
      id: "dd-week-one",
      label: "What happens in the first seven days",
      question: "When do the people who leave decide to leave?",
      cost: 2,
      evidenceFor: ["retention.churn", "retention.value"],
      readsAs:
        "62% of everyone who cancels never completed a single practice test. They churn because they never started, which is an onboarding problem, not a content problem.",
      reveals: [
        {
          id: "p-week-one",
          kind: "segments",
          title: "Month-3 retention by first-week behaviour",
          dimension: "Did they finish a practice test in week 1?",
          rows: [
            { label: "Yes (38% of joiners)", value: 0.79, unit: "ratio" },
            { label: "No (62% of joiners)", value: 0.19, unit: "ratio" },
          ],
        },
      ],
    },
    {
      id: "dd-cac-channel",
      label: "CAC by acquisition channel",
      question: "Are we overpaying for subscribers?",
      cost: 2,
      evidenceFor: ["economics.cac"],
      readsAs:
        "CAC is ₹350 blended and stable. Acquisition is doing its job — the problem is what happens to the subscribers after it hands them over.",
      reveals: [
        {
          id: "p-cac-channel",
          kind: "segments",
          title: "CAC and volume by channel",
          dimension: "Channel",
          rows: [
            { label: "Performance ads", value: 402, unit: "inr" },
            { label: "Referral", value: 180, unit: "inr" },
            { label: "School partnerships", value: 291, unit: "inr" },
          ],
        },
      ],
    },
    {
      id: "dd-price-test",
      label: "Price sensitivity test",
      question: "Could we simply charge more?",
      cost: 2,
      evidenceFor: ["economics.price"],
      readsAs:
        "A 20% price rise held revenue per subscriber but pushed month-2 cancellations up by about a sixth. In a business where the base is joiners divided by churn, that trade is worse than it looks.",
      reveals: [
        {
          id: "p-price-test",
          kind: "segments",
          title: "Six-week test, ₹299 vs ₹249",
          dimension: "Cohort",
          rows: [
            { label: "₹249 — month-2 cancellations", value: 0.22, unit: "ratio" },
            { label: "₹299 — month-2 cancellations", value: 0.256, unit: "ratio" },
            { label: "₹299 — sign-up rate vs control", value: 0.85, unit: "ratio" },
          ],
        },
      ],
    },
    {
      id: "dd-content",
      label: "Content usage and NPS",
      question: "Is the product simply not good enough?",
      cost: 2,
      evidenceFor: ["retention.value"],
      readsAs:
        "Among students who actually use it, NPS is 61 and retention is strong. The product is fine — the problem is how many people never get far enough to find out.",
      reveals: [
        {
          id: "p-content",
          kind: "segments",
          title: "NPS by usage in the first month",
          dimension: "Sessions in month 1",
          rows: [
            { label: "6 or more", value: 61, unit: "count" },
            { label: "1 to 5", value: 24, unit: "count" },
            { label: "None", value: -8, unit: "count" },
          ],
        },
      ],
    },
  ],

  causes: [
    { id: "retention", parentId: null, label: "Retention", verdict: "The right place to look." },
    {
      id: "retention.churn",
      parentId: "retention",
      label: "Subscribers leave faster than we can replace them",
      verdict:
        "This was it. At 11% monthly churn the base settles at joiners ÷ churn ≈ 1.64 lakh, and 62% of leavers never completed a single practice test. Acquisition was refilling a bucket rather than filling one.",
    },
    {
      id: "retention.value",
      parentId: "retention",
      label: "The content isn't good enough to keep people",
      verdict:
        "Not supported. Among students who use the product, NPS is 61 and retention is strong. The people who leave are overwhelmingly the ones who never started.",
    },
    { id: "economics", parentId: null, label: "Unit economics", verdict: "Healthy per subscriber, which is what made this hard to see." },
    {
      id: "economics.cac",
      parentId: "economics",
      label: "Acquisition costs too much",
      verdict:
        "CAC is ₹350 and stable, payback is under two months. Acquisition was never the problem — LTV:CAC of 4.6 was true and irrelevant.",
    },
    {
      id: "economics.price",
      parentId: "economics",
      label: "We charge too little",
      verdict:
        "A 20% rise held ARPU and pushed cancellations up about a sixth. Because the base is joiners divided by churn, a churn increase costs more than the price rise earns.",
    },
  ],
  trueCauseIds: ["retention.churn"],

  interventions: [
    {
      id: "iv-onboarding",
      label: "Rebuild the first week",
      pitch:
        "Force a diagnostic test on day one, then a three-day study plan built from it. Get every new subscriber to finish something before they decide whether this was worth ₹249.",
      addresses: "retention.churn",
      cost: { sprints: 2, rupees: 40 * LAKH },
      minSprints: 2,
      effects: {
        whenRootCause: [{ driver: "churnRate", deltaPct: -0.4 }],
        otherwise: [{ driver: "churnRate", deltaPct: -0.05 }],
      },
      debrief:
        "The fix. Cutting churn from 11% to 6.6% raises the steady-state base from 1.64 lakh to 2.7 lakh without adding a rupee of acquisition spend — because the base is joiners divided by churn, and you just changed the divisor.",
    },
    {
      id: "iv-annual",
      label: "Push annual plans",
      pitch:
        "Offer twelve months for the price of ten. Locks the subscriber in for a year and takes the monthly cancel decision off the table.",
      addresses: "retention.churn",
      cost: { sprints: 1, rupees: 20 * LAKH },
      effects: {
        whenRootCause: [
          { driver: "churnRate", deltaPct: -0.25 },
          // Two months free is a real discount, and the report shows it.
          { driver: "arpu", deltaPct: -0.08 },
        ],
        otherwise: [{ driver: "arpu", deltaPct: -0.08 }],
      },
      debrief:
        "Cheaper than the onboarding work and genuinely effective, at the cost of 8% of ARPU. Worth funding alongside a real retention fix; on its own it postpones the cancellation rather than earning the renewal.",
    },
    {
      id: "iv-more-ads",
      label: "Increase acquisition spend 50%",
      pitch:
        "Growth's proposal, and the one the ratios support: payback is under two months, so every rupee comes back in eight weeks. Put more in.",
      addresses: "economics.cac",
      cost: { sprints: 1, rupees: 35 * LAKH },
      effects: {
        whenRootCause: [{ driver: "newSubs", deltaPct: 0.45 }],
        otherwise: [
          { driver: "acquisitionSpend", deltaPct: 0.5 },
          { driver: "newSubs", deltaPct: 0.45 },
        ],
      },
      debrief:
        "The good trap: it genuinely works, just badly. More joiners really do raise the steady-state base, because they are the numerator. But you are paying for every one of them every nine months, forever, and the same money spent on the denominator buys roughly four times as much base.",
    },
    {
      id: "iv-price-up",
      label: "Raise the price to ₹299",
      pitch: "A 20% rise. The test held revenue per subscriber, and the category supports it.",
      addresses: "economics.price",
      cost: { sprints: 1, rupees: 8 * LAKH },
      effects: {
        whenRootCause: [{ driver: "arpu", deltaPct: 0.2 }],
        otherwise: [
          { driver: "arpu", deltaPct: 0.2 },
          { driver: "churnRate", deltaPct: 0.12 },
          { driver: "newSubs", deltaPct: -0.15 },
        ],
      },
      debrief:
        "ARPU up 20%, churn up 12%, sign-ups down 15% — and because the base is joiners divided by churn, both of those cut into the divisor and the numerator at once. The price rise earns less than the churn it causes costs.",
    },
  ],

  // Competitive pressure and content fatigue: churn creeps up if nobody
  // touches it, so the burn compounds.
  drift: [{ driver: "churnRate", deltaPct: 0.03 }],
  horizonQuarters: 2,

  parInvestigation: ["dd-retention-curve", "dd-week-one"],
  bestAllocation: [
    { interventionId: "iv-onboarding", sprints: 2, rupees: 40 * LAKH },
    { interventionId: "iv-annual", sprints: 1, rupees: 20 * LAKH },
  ],

  debrief: {
    causalChain: [
      "62% of new subscribers never completed a practice test in their first week.",
      "Those students cancelled at four times the rate of the ones who did — month-3 retention of 19% against 79%.",
      "Blended monthly churn settled at 11%, which means a subscriber lasts about nine months.",
      "A subscriber base settles at joiners ÷ churn, so 18,000 a month at 11% churn caps the business at about 1.64 lakh subscribers.",
      "1.64 lakh subscribers × ₹177 of contribution is ₹2.89 crore a month, against ₹3.23 crore of costs — a ₹34 lakh monthly burn that acquisition spend could never close.",
    ],
    whereTheLeverageWas:
      "The divisor. Because the steady-state base is joiners divided by churn, cutting churn from 11% to 6.6% grows the business 67% without one extra rupee of acquisition — while a 50% increase in acquisition spend buys about a quarter as much base and has to be paid again every nine months.",
    strongAnswer:
      "The ratio that looks healthiest is the one causing the confusion. LTV:CAC of 4.6 is a per-subscriber test, and it was true — each subscriber really did return 4.6 times what they cost. It just says nothing about whether the base is big enough to cover ₹2.6 crore of fixed costs. So the question is not 'is a subscriber worth acquiring' but 'how big does this base get', and that is joiners ÷ churn. At 18,000 and 11%, it caps out around 1.64 lakh — structurally too small, no matter how efficient acquisition becomes. From there the diagnosis is a retention question, and the cohort data localises it hard: 62% of leavers never finished a single practice test, and the ones who did retained four times better. That is an onboarding problem, not a content problem, and the fix is in the denominator rather than the numerator.",
  },

  coachFallback: [
    {
      topic: ["churn", "retention", "leave", "cancel"],
      answer:
        "Churn was the cause. At 11% a month a subscriber lasts about nine months and the base settles at joiners ÷ churn ≈ 1.64 lakh. 62% of the people who cancelled never completed a practice test in week one — they left because they never started.",
    },
    {
      topic: ["ltv", "cac", "ratio", "4.6", "payback"],
      answer:
        "LTV:CAC of 4.6 was genuinely true and genuinely irrelevant. It is a per-subscriber test: it tells you a subscriber is worth acquiring, not whether the base ever gets big enough to cover ₹2.6 crore of fixed costs. It didn't.",
    },
    {
      topic: ["steady state", "base", "subscribers", "formula", "bucket"],
      answer:
        "The base settles at new subscribers ÷ churn rate — 18,000 ÷ 0.11 ≈ 1.64 lakh. That formula is the whole scenario: acquisition moves the numerator and retention moves the divisor, and the divisor is worth about four times as much.",
    },
    {
      topic: ["acquisition", "more ads", "spend", "growth"],
      answer:
        "Spending 50% more on acquisition really does grow the base — it is the numerator. But you pay for those subscribers again every nine months, and the same money spent on churn buys roughly four times as much base permanently.",
    },
    {
      topic: ["price", "arpu", "299", "raise"],
      answer:
        "The price rise gave 20% more ARPU, 12% more churn and 15% fewer sign-ups. Because the base is joiners over churn, that hits the numerator and the divisor at once — it earns less than it costs.",
    },
    {
      topic: ["onboarding", "week one", "practice test", "activation"],
      answer:
        "Students who finished a practice test in week one retained at 79% to month three; those who didn't retained at 19%, and they were 62% of joiners. Getting people to finish something early was the highest-leverage thing available.",
    },
    {
      topic: ["content", "nps", "product quality"],
      answer:
        "The content was fine — NPS 61 among students who actually used it. The problem was never quality, it was how many people never got far enough to encounter it.",
    },
  ],
};
