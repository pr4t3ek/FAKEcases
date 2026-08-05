/**
 * "Our ROAS is 4 and we're losing money on every order."
 *
 * The beginner entry point to the simulation track, and a deliberate
 * counterweight to NukkadEats: the model is shown rather than hidden, the
 * vocabulary is taught before it is used, and there are five pulls instead of
 * ten.
 *
 * ── The truth, for whoever maintains this ─────────────────────────────────
 *
 * Every rupee of ad spend points at the ₹1,450 starter pack, which carries 22%
 * gross margin. The ₹2,900 subscription bundle carries 41%. At a CAC of ₹364
 * against ₹319 of margin per order, the campaign loses ₹45 on every customer it
 * buys — while reporting a ROAS of 4.0, which the whole industry treats as good.
 *
 * The single number the scenario exists to teach: **ROAS has to clear
 * 1 ÷ gross margin before a campaign makes money.** At 22% margin that is 4.55,
 * so 4.0 is a failing grade wearing a passing one.
 *
 * ── Balance notes ─────────────────────────────────────────────────────────
 *
 * The efficiency plays are deliberately *realistic* rather than generous — a
 * 12% lift in click-through, a 10% cut in CPM. Both genuinely narrow the loss,
 * and neither closes it, because you cannot squeeze your way out of a margin
 * problem. That near-miss is the point: a student who funds them sees the loss
 * shrink and still be a loss.
 *
 * `iv-spend-more` is the sharpest trap, and it is the one the CMO in the brief
 * is arguing for. At a fixed conversion rate, orders scale with budget, so net
 * profit scales with `orders × margin per order − budget` — which at ₹319
 * against ₹364 means every extra rupee buys more loss. Scaling a negative unit
 * economic is the most expensive mistake in the scenario and the easiest to
 * justify with a ROAS chart.
 *
 * `tests/sim-scenario.test.ts` brute-forces every affordable combination, so if
 * a retune ever makes an efficiency play beat the margin fix, the suite says so.
 */

import type { SimScenario } from "../types";

const LAKH = 100_000;

export const adFunnelRoas: SimScenario = {
  slug: "ad-funnel-roas",
  title: "Kadak Coffee: the ads are working and the money is going",
  company: "Kadak Coffee",
  premise:
    "A D2C coffee brand's ads report a ROAS of 4.0. Finance says every order loses money. Both are right — work out why, then fix it.",
  situation:
    "You are the growth PM at Kadak Coffee, a D2C filter-coffee brand. You spend ₹10 lakh a month on ads. " +
    "Your CMO's dashboard says ROAS is 4.0 — four rupees of sales for every rupee spent — and wants to double the budget on the strength of it. " +
    "Finance has just told the founder that the same campaign loses money on every single order, and wants it switched off. " +
    "Neither of them is lying to you. You have 6 analyst-days to find out what is actually going on, then 3 sprints and ₹6 lakh to do something about it.",
  difficulty: "Easy",
  periodNoun: "month",

  // ── Teaching ────────────────────────────────────────────────────────────
  teaching: {
    showMetricMap: true,
    primer: {
      intro:
        "Everything in this simulation is one chain of arithmetic: your budget buys impressions, impressions become clicks, clicks become orders, and orders carry margin. Each term below is one link. You do not need to memorise them — the metric map on the right shows the whole chain with live numbers, and you can reopen this any time.",
      terms: [
        {
          term: "CPM",
          full: "Cost per mille (per thousand impressions)",
          plain: "What it costs to show your ad a thousand times.",
          formula: "ad spend ÷ (impressions ÷ 1000)",
          matters: "It sets how much attention your budget can buy. A narrower audience usually costs a higher CPM but wastes fewer of those impressions.",
          driver: "cpm",
        },
        {
          term: "Impressions",
          plain: "The number of times your ad was put in front of someone.",
          formula: "ad budget ÷ cost per impression",
          matters: "The top of the funnel. Everything downstream is a percentage of this.",
          driver: "impressions",
        },
        {
          term: "CTR",
          full: "Click-through rate",
          plain: "Of the people shown the ad, the share who clicked it.",
          formula: "clicks ÷ impressions",
          matters: "It measures whether the creative earns attention. A 1% CTR means 99 of every 100 people scrolled past.",
          driver: "ctr",
        },
        {
          term: "Conversion rate",
          plain: "Of the people who clicked, the share who actually bought.",
          formula: "orders ÷ clicks",
          matters: "It measures whether the landing page and the offer deliver what the ad promised.",
          driver: "conversionRate",
        },
        {
          term: "AOV",
          full: "Average order value",
          plain: "The average rupee value of one order.",
          formula: "revenue ÷ orders",
          matters: "Raising it is usually cheaper than buying more customers — the traffic is already paid for.",
          driver: "aov",
        },
        {
          term: "Gross margin",
          plain: "The share of each rupee of sales left after what the product itself costs you.",
          formula: "(price − product cost) ÷ price",
          matters: "This is the money available to pay for the advertising. Revenue is not.",
          driver: "grossMarginRate",
        },
        {
          term: "Contribution per order",
          plain: "The rupees one order actually leaves behind, before ad spend.",
          formula: "AOV × gross margin",
          matters: "Compare it directly with CAC. If CAC is bigger, you lose money on every customer you buy.",
          driver: "marginPerOrder",
        },
        {
          term: "CAC",
          full: "Customer acquisition cost",
          plain: "What you paid in ads to get one order.",
          formula: "ad spend ÷ orders",
          matters: "The single most useful number here. It only means something next to contribution per order.",
          driver: "cac",
        },
        {
          term: "ROAS",
          full: "Return on ad spend",
          plain: "How many rupees of sales came back for each rupee of ad spend.",
          formula: "revenue from ads ÷ ad spend",
          matters:
            "It uses sales, not profit — so a high ROAS can still lose money. A campaign only breaks even when ROAS clears 1 ÷ gross margin.",
          driver: "roas",
        },
        {
          term: "ROI",
          full: "Return on investment",
          plain: "The profit the advertising made, as a percentage of what it cost.",
          formula: "(gross profit − ad spend) ÷ ad spend",
          matters: "Unlike ROAS this counts costs, so a negative ROI means the campaign destroyed money however good the ROAS looked.",
          driver: "roi",
        },
      ],
      worked: [
        "₹10,00,000 of budget at a ₹180 CPM buys 55.6 lakh impressions — that is ₹0.18 per impression.",
        "A 1.1% click-through rate turns those into 61,111 clicks; a 4.5% conversion rate turns those into 2,750 orders.",
        "2,750 orders at ₹1,450 is ₹39.9 lakh of sales — ROAS 4.0. But at 22% gross margin that is only ₹8.8 lakh of actual margin, against ₹10 lakh spent.",
        "Put another way: CAC is ₹364 and each order contributes ₹319. You lose ₹45 per customer, 2,750 times a month.",
      ],
    },
  },

  // ── The model ───────────────────────────────────────────────────────────
  northStar: "netAdProfit",
  reported: ["roas", "cac", "marginPerOrder", "orders", "grossProfit", "roi"],
  drivers: [
    { id: "adBudget", kind: "input", label: "Monthly ad budget", unit: "inr", goodDirection: "down", baseline: 10 * LAKH },
    { id: "cpm", kind: "input", label: "CPM", unit: "inr", goodDirection: "down", baseline: 180 },
    { id: "perThousand", kind: "constant", label: "1,000", unit: "count", goodDirection: "up", value: 1000 },
    {
      id: "costPerImpression",
      kind: "quotient",
      label: "Cost per impression",
      unit: "inr",
      goodDirection: "down",
      numerator: "cpm",
      denominator: "perThousand",
    },
    {
      id: "impressions",
      kind: "quotient",
      label: "Impressions",
      unit: "count",
      goodDirection: "up",
      numerator: "adBudget",
      denominator: "costPerImpression",
    },
    { id: "ctr", kind: "input", label: "Click-through rate", unit: "ratio", goodDirection: "up", baseline: 0.011 },
    { id: "clicks", kind: "product", label: "Clicks", unit: "count", goodDirection: "up", of: ["impressions", "ctr"] },
    { id: "conversionRate", kind: "input", label: "Conversion rate", unit: "ratio", goodDirection: "up", baseline: 0.045 },
    { id: "orders", kind: "product", label: "Orders", unit: "count", goodDirection: "up", of: ["clicks", "conversionRate"] },
    { id: "aov", kind: "input", label: "Average order value", unit: "inr", goodDirection: "up", baseline: 1450 },
    { id: "adRevenue", kind: "product", label: "Revenue from ads", unit: "inr", goodDirection: "up", of: ["orders", "aov"] },
    { id: "grossMarginRate", kind: "input", label: "Gross margin", unit: "ratio", goodDirection: "up", baseline: 0.22 },
    {
      id: "marginPerOrder",
      kind: "product",
      label: "Contribution per order",
      unit: "inr",
      goodDirection: "up",
      of: ["aov", "grossMarginRate"],
    },
    {
      id: "grossProfit",
      kind: "product",
      label: "Gross profit from ads",
      unit: "inr",
      goodDirection: "up",
      of: ["adRevenue", "grossMarginRate"],
    },
    {
      id: "cac",
      kind: "quotient",
      label: "Customer acquisition cost",
      unit: "inr",
      goodDirection: "down",
      numerator: "adBudget",
      denominator: "orders",
    },
    {
      id: "roas",
      kind: "quotient",
      label: "ROAS",
      unit: "ratio",
      goodDirection: "up",
      numerator: "adRevenue",
      denominator: "adBudget",
    },
    // The punchline of the whole scenario, and the north star.
    {
      id: "netAdProfit",
      kind: "difference",
      label: "Net profit from ads",
      unit: "inr",
      goodDirection: "up",
      minuend: "grossProfit",
      subtrahend: "adBudget",
    },
    {
      id: "roi",
      kind: "quotient",
      label: "ROI on ad spend",
      unit: "ratio",
      goodDirection: "up",
      numerator: "netAdProfit",
      denominator: "adBudget",
    },
  ],

  // ── The free dashboard ──────────────────────────────────────────────────
  dashboard: [
    {
      id: "p-headline",
      kind: "stat",
      title: "Last month's campaign",
      caption: "The two numbers everyone is arguing about are both on this row.",
      tiles: [
        { label: "Ad spend", value: 10 * LAKH, unit: "inr", goodDirection: "down" },
        { label: "Revenue from ads", value: 39.875 * LAKH, unit: "inr", goodDirection: "up" },
        { label: "ROAS", value: 3.99, unit: "ratio", goodDirection: "up" },
        { label: "Orders", value: 2750, unit: "count", goodDirection: "up" },
        { label: "Gross profit from ads", value: 8.7725 * LAKH, unit: "inr", goodDirection: "up" },
        { label: "Net profit from ads", value: -1.2275 * LAKH, unit: "inr", goodDirection: "up" },
      ],
    },
    {
      id: "p-funnel",
      kind: "funnel",
      title: "Where the ₹10 lakh went",
      caption: "Each step is a percentage of the one above it.",
      steps: [
        { label: "Impressions", value: 5_555_556 },
        { label: "Clicks (1.1%)", value: 61_111 },
        { label: "Orders (4.5% of clicks)", value: 2_750 },
      ],
    },
    {
      id: "p-trend",
      kind: "timeseries",
      title: "ROAS and net profit, last 6 months",
      caption: "ROAS has been stable. Net profit has not.",
      series: [
        {
          label: "Net profit from ads (₹ lakh)",
          unit: "inr_lakh",
          points: [
            { period: "M-5", value: 0.4 },
            { period: "M-4", value: 0.1 },
            { period: "M-3", value: -0.3 },
            { period: "M-2", value: -0.7 },
            { period: "M-1", value: -1.0 },
            { period: "M-0", value: -1.23 },
          ],
        },
      ],
    },
    {
      id: "p-room",
      kind: "note",
      title: "What the room is saying",
      body:
        "CMO: ROAS is 4.0, which is well above the 2.5 the agency promised. We should be spending more, not less. " +
        "Finance: I don't care about ROAS. Every order costs us ₹364 to win and leaves ₹319 behind. " +
        "Agency: your click-through is a bit below category benchmark — give us budget for new creative and we'll fix the numbers.",
    },
  ],

  budget: { analystDays: 6, sprints: 3, rupees: 6 * LAKH },

  // ── The data you can buy (11 days of pulls, 6 to spend) ─────────────────
  drilldowns: [
    {
      id: "dd-margin",
      label: "Gross margin by product",
      question: "Do all our products make the same money?",
      cost: 3,
      evidenceFor: ["economics.mix"],
      readsAs:
        "The starter pack the ads sell carries 22% margin. The subscription bundle carries 41%. The campaign is not a marketing problem, it is a product-mix problem.",
      reveals: [
        {
          id: "p-margin",
          kind: "segments",
          title: "Gross margin by product",
          dimension: "Product",
          rows: [
            { label: "₹1,450 starter pack", value: 0.22, unit: "ratio" },
            { label: "₹2,900 subscription bundle", value: 0.41, unit: "ratio" },
            { label: "₹690 single bag", value: 0.28, unit: "ratio" },
          ],
        },
        {
          id: "p-margin-note",
          kind: "note",
          title: "Break-even ROAS",
          body:
            "A campaign breaks even when ROAS = 1 ÷ gross margin. At 22% that is 4.55, so a ROAS of 4.0 loses money. At 41% it is 2.44, and the same ROAS of 4.0 would be comfortably profitable. The number that decides whether an ad campaign works is not on the ad platform's dashboard.",
        },
      ],
    },
    {
      id: "dd-basket",
      label: "What people buy after clicking an ad",
      question: "Which product are the ads actually selling?",
      cost: 2,
      evidenceFor: ["economics.mix", "economics.price"],
      readsAs:
        "91% of ad-driven orders are the starter pack. Every rupee of the budget is pointed at the lowest-margin thing we sell.",
      reveals: [
        {
          id: "p-basket",
          kind: "segments",
          title: "Ad-driven orders by product",
          dimension: "Product",
          rows: [
            { label: "₹1,450 starter pack", value: 2_503, unit: "count" },
            { label: "₹690 single bag", value: 179, unit: "count" },
            { label: "₹2,900 subscription bundle", value: 68, unit: "count" },
          ],
        },
        {
          id: "p-basket-note",
          kind: "note",
          title: "For comparison",
          body:
            "Customers who arrive through search or word of mouth pick the subscription bundle 31% of the time. Nothing about the product stops it selling — the ads simply never mention it, and the landing page they arrive on only offers the starter pack.",
        },
      ],
    },
    {
      id: "dd-benchmark",
      label: "Our CTR and CPM against the category",
      question: "Is the campaign badly run?",
      cost: 2,
      evidenceFor: ["efficiency.creative", "efficiency.audience"],
      readsAs:
        "Slightly below benchmark on click-through, slightly above on CPM. Real, worth fixing, and nowhere near big enough to explain the loss.",
      reveals: [
        {
          id: "p-benchmark",
          kind: "segments",
          title: "Us vs D2C food & beverage benchmark",
          dimension: "Metric",
          rows: [
            { label: "Our CTR", value: 0.011, unit: "ratio" },
            { label: "Benchmark CTR", value: 0.0125, unit: "ratio" },
            { label: "Our CPM (₹)", value: 180, unit: "inr" },
            { label: "Benchmark CPM (₹)", value: 165, unit: "inr" },
          ],
        },
      ],
    },
    {
      id: "dd-cohort",
      label: "Do ad-acquired customers come back?",
      question: "Is a second purchase paying back the first?",
      cost: 2,
      evidenceFor: ["economics.price"],
      readsAs:
        "Only 14% reorder within 90 days, against 44% for bundle buyers. There is no second order rescuing the economics of the first.",
      reveals: [
        {
          id: "p-cohort",
          kind: "segments",
          title: "90-day repeat rate by first purchase",
          dimension: "First purchase",
          rows: [
            { label: "Starter pack", value: 0.14, unit: "ratio" },
            { label: "Subscription bundle", value: 0.44, unit: "ratio" },
          ],
        },
      ],
    },
    {
      id: "dd-platform",
      label: "CPM trend by platform",
      question: "Are ads simply getting more expensive?",
      cost: 2,
      evidenceFor: ["efficiency.audience"],
      readsAs:
        "CPMs are drifting up about 4% a month everywhere. It makes the problem worse over time; it did not create it.",
      reveals: [
        {
          id: "p-platform",
          kind: "timeseries",
          title: "Blended CPM (₹)",
          series: [
            {
              label: "CPM",
              unit: "inr",
              points: [
                { period: "M-5", value: 148 },
                { period: "M-3", value: 161 },
                { period: "M-1", value: 174 },
                { period: "M-0", value: 180 },
              ],
            },
          ],
        },
      ],
    },
  ],

  // ── The hypothesis space (6 causes, one level) ──────────────────────────
  causes: [
    { id: "economics", parentId: null, label: "Unit economics", verdict: "The right place to look." },
    {
      id: "economics.mix",
      parentId: "economics",
      label: "The ads sell our lowest-margin product",
      verdict:
        "This was it. Every rupee points at the 22%-margin starter pack, so the campaign needed a ROAS of 4.55 to break even and delivered 4.0. The same spend against the 41%-margin bundle breaks even at 2.44.",
    },
    {
      id: "economics.price",
      parentId: "economics",
      label: "Order value is too low to carry the cost",
      verdict:
        "Close, and worth understanding: AOV is genuinely low. But it is low *because* of what the ads sell, so it is a symptom of the mix rather than a separate cause.",
    },
    { id: "efficiency", parentId: null, label: "Campaign efficiency", verdict: "Real, and far too small to explain it." },
    {
      id: "efficiency.creative",
      parentId: "efficiency",
      label: "The creative isn't earning enough clicks",
      verdict:
        "Click-through is 1.1% against a 1.25% benchmark. Fixing it narrows the loss and does not close it — you cannot squeeze your way out of a margin problem.",
    },
    {
      id: "efficiency.audience",
      parentId: "efficiency",
      label: "The audience is too broad, so CPM is too high",
      verdict:
        "CPM is ₹180 against ₹165 benchmark and rising about 4% a month. Same verdict: it makes the loss bigger over time, it did not cause it.",
    },
  ],
  trueCauseIds: ["economics.mix"],

  // ── What you can spend the quarter on ───────────────────────────────────
  interventions: [
    {
      id: "iv-bundle",
      label: "Point the ads at the subscription bundle",
      pitch:
        "Rewrite the creative and rebuild the landing page around the ₹2,900 bundle instead of the ₹1,450 starter pack. Fewer people will buy, and the ones who do are worth more than twice as much.",
      addresses: "economics.mix",
      // Priced to absorb the whole quarter. `minSprints` below the full cost is
      // the interesting choice: you can half-fund the real fix and keep a
      // sprint for the agency's creative work, and the outcome will show you
      // what that cost.
      cost: { sprints: 3, rupees: 5.5 * LAKH },
      minSprints: 2,
      effects: {
        whenRootCause: [
          { driver: "aov", deltaPct: 1.0 },
          { driver: "grossMarginRate", deltaPct: 0.8636 },
          // A ₹2,900 offer converts worse than a ₹1,450 one. It has to, or the
          // decision would be free and there would be nothing to teach.
          { driver: "conversionRate", deltaPct: -0.45 },
        ],
        otherwise: [{ driver: "aov", deltaPct: 0.1 }],
      },
      debrief:
        "The fix. Conversion nearly halves — a ₹2,900 offer is a harder sell — and it does not matter, because each order that does land carries ₹1,189 of contribution instead of ₹319. This is what it means to fix unit economics rather than optimise around them.",
    },
    {
      id: "iv-creative",
      label: "New creative to lift click-through",
      pitch:
        "The agency's proposal: three new creative concepts to close the gap to the 1.25% category benchmark.",
      addresses: "efficiency.creative",
      cost: { sprints: 1, rupees: 1.5 * LAKH },
      effects: {
        whenRootCause: [{ driver: "ctr", deltaPct: 0.3 }],
        otherwise: [{ driver: "ctr", deltaPct: 0.12 }],
      },
      debrief:
        "Genuinely useful and genuinely not enough. A 12% lift in click-through brings CAC down from ₹364 to about ₹325 — still above the ₹319 an order contributes. It narrows the loss to roughly nothing and never turns it into a profit, which is exactly what optimising a broken margin looks like.",
    },
    {
      id: "iv-audience",
      label: "Narrow the audience to cut CPM",
      pitch:
        "Cut the broadest interest segments and concentrate spend on lookalikes of existing buyers. Should take about 10% off blended CPM.",
      addresses: "efficiency.audience",
      cost: { sprints: 1, rupees: 0.5 * LAKH },
      effects: {
        whenRootCause: [{ driver: "cpm", deltaPct: -0.25 }],
        otherwise: [{ driver: "cpm", deltaPct: -0.1 }],
      },
      debrief:
        "Cheap, sensible, and about as effective as the creative work — it buys more impressions for the same money, and every extra order still carries only ₹319 against a CAC that has barely moved.",
    },
    {
      id: "iv-spend-more",
      label: "Increase the budget 50%",
      pitch:
        "The CMO's proposal, and the one with a chart behind it: ROAS is 4.0, well above target, so put more money through the machine.",
      addresses: "economics.price",
      cost: { sprints: 1, rupees: 5 * LAKH },
      effects: {
        whenRootCause: [{ driver: "adBudget", deltaPct: 0.5 }],
        // The most expensive mistake available, and the easiest to justify.
        otherwise: [{ driver: "adBudget", deltaPct: 0.5 }],
      },
      debrief:
        "Scaling a loss. Orders rise with the budget and so does the money lost on each one, so the campaign goes from losing ₹1.2 lakh a month to losing ₹1.8 lakh. Whenever CAC is above contribution per order, spending more is strictly worse — and a ROAS chart will never tell you that.",
    },
  ],

  // CPMs drift up about 4% a month across the industry, so standing still
  // gets slowly more expensive.
  drift: [{ driver: "cpm", deltaPct: 0.04 }],
  horizonQuarters: 2,

  parInvestigation: ["dd-margin", "dd-basket"],
  bestAllocation: [{ interventionId: "iv-bundle", sprints: 3, rupees: 5.5 * LAKH }],

  debrief: {
    causalChain: [
      "Every rupee of the ad budget pointed at the ₹1,450 starter pack — the creative sold it and the landing page only offered it.",
      "The starter pack carries 22% gross margin, so each ₹1,450 order left behind ₹319.",
      "₹10 lakh of spend bought 2,750 orders, which is a customer acquisition cost of ₹364.",
      "₹364 to win an order worth ₹319 is a loss of ₹45 per customer, 2,750 times a month.",
      "The campaign reported a ROAS of 4.0 throughout, because ROAS is measured on sales and never sees the margin.",
    ],
    whereTheLeverageWas:
      "The product the ads sell, not the ads. A campaign breaks even when ROAS clears 1 ÷ gross margin — 4.55 for the starter pack, 2.44 for the subscription bundle. Pointing the same budget at the bundle turns the same ROAS from a loss into a profit without changing a single thing about the advertising.",
    strongAnswer:
      "Start by asking what a rupee of sales is actually worth, because ROAS treats all of them the same and the business does not. At 22% gross margin, break-even ROAS is 1 ÷ 0.22 = 4.55, so a ROAS of 4.0 is below water — the CMO and Finance are both reading correct numbers and only one of them is reading a profit number. Then check what the ads sell: 91% of ad-driven orders are the lowest-margin product we make, while organic customers pick the bundle a third of the time. So this is a mix problem wearing a marketing problem's clothes. The trap is that the efficiency fixes are real — click-through is below benchmark, CPM is above it — and fixing both still leaves CAC roughly level with contribution, because you cannot optimise your way out of a margin that is too thin. And scaling spend, which is what the ROAS chart argues for, multiplies the loss rather than the profit.",
  },

  coachFallback: [
    {
      topic: ["roas", "return on ad spend", "4.0", "why was roas wrong"],
      answer:
        "ROAS is measured on sales, not profit, so it never sees your margin. A campaign only breaks even when ROAS clears 1 ÷ gross margin. At 22% that is 4.55, so the 4.0 everyone was celebrating was a loss the whole time.",
    },
    {
      topic: ["margin", "mix", "product", "bundle", "starter pack"],
      answer:
        "91% of ad-driven orders were the ₹1,450 starter pack at 22% margin, while the ₹2,900 subscription bundle carries 41%. The ads were pointed at the worst thing you sell — that was the cause, and the fix was to point them somewhere else.",
    },
    {
      topic: ["cac", "acquisition cost", "per order", "contribution"],
      answer:
        "CAC was ₹10,00,000 ÷ 2,750 orders = ₹364. Each order contributed ₹1,450 × 22% = ₹319. Paying ₹364 for ₹319 loses ₹45 a customer, and you did it 2,750 times a month.",
    },
    {
      topic: ["budget", "spend more", "scale", "double"],
      answer:
        "Orders scale with budget, so scaling spend scales the loss on each one — 50% more budget took the monthly loss from ₹1.2 lakh to about ₹1.8 lakh. When CAC is above contribution per order, spending more is always worse, however good the ROAS chart looks.",
    },
    {
      topic: ["creative", "ctr", "click", "agency"],
      answer:
        "Click-through was 1.1% against a 1.25% benchmark, so the agency was right that there was room. Closing it takes CAC from ₹364 to about ₹325 — still above the ₹319 an order contributes. It narrows the loss and never closes it, because the problem is the margin, not the clicks.",
    },
    {
      topic: ["cpm", "audience", "targeting", "platform"],
      answer:
        "CPM was ₹180 against a ₹165 benchmark and rising about 4% a month. Narrowing the audience buys more impressions for the same money, but every extra order still carries only ₹319 — same verdict as the creative work.",
    },
    {
      topic: ["repeat", "cohort", "second order", "ltv", "lifetime"],
      answer:
        "Only 14% of starter-pack buyers reorder within 90 days, against 44% of bundle buyers. There was no second purchase quietly rescuing the first — which is exactly why the first order had to pay for itself.",
    },
  ],
};
