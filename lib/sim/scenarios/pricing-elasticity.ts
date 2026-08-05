/**
 * "They cut price. Do we match?"
 *
 * Teaches the calculation almost nobody does before cutting a price: how much
 * extra volume the cut has to buy just to stand still.
 *
 * ── The truth, for whoever maintains this ─────────────────────────────────
 *
 * At ₹499 against ₹312 of variable cost, a unit contributes ₹187. Cut the price
 * 15% and it contributes ₹112 — so holding total contribution needs volume up
 * **67%**. Measured elasticity is about 1.2, which buys +18%. The cut turns a
 * ₹24 lakh quarterly profit into a small loss, and it does it while looking
 * decisive.
 *
 * The volume loss was never about price at all. Trade promotion in modern trade
 * was quietly cut two quarters ago to protect margin, and modern-trade volume
 * fell 31% while general trade barely moved. A national price cut is an
 * expensive answer to a channel-specific question.
 *
 * The second lesson runs the other way: because demand is inelastic, a 5% price
 * *rise* also improves profit. Students who only ever hear "cut price to defend
 * share" find that genuinely surprising, which is the point.
 *
 * ── Balance notes ─────────────────────────────────────────────────────────
 *
 * `iv-price-up` is deliberately tuned to elasticity 1.8 rather than the 1.2 the
 * historical data shows. Without that, raising price and restoring promotion
 * together beat the declared best allocation, and the scenario would be
 * rewarding a pricing move in a scenario about not making one. The brute-force
 * balance test in `sim-scenario.test.ts` is what caught it.
 */

import type { SimScenario } from "../types";

const LAKH = 100_000;

export const pricingElasticity: SimScenario = {
  slug: "pricing-elasticity",
  title: "Suraksha Home: the competitor cut price — do we match?",
  company: "Suraksha Home",
  premise:
    "Volume is down 9% since a competitor cut price. Marketing wants to cut 15% to match. Work out what that would actually cost before you decide.",
  situation:
    "You are the category PM for Suraksha Home replacement water filters, sold at ₹499 through general trade and modern trade. " +
    "A competitor cut their price 12% at the start of last quarter. Our volume is down 9%, and the sales director wants to cut 15% to match — 'we can't lose the shelf'. " +
    "The CFO has asked one question before signing it off: how much extra volume does a 15% cut have to buy before we are back where we started? " +
    "You have 6 analyst-days to answer that and find out what is actually driving the drop, then 3 sprints and ₹40 lakh to act.",
  difficulty: "Medium",

  teaching: {
    showMetricMap: true,
    primer: {
      intro:
        "A price change moves two things in opposite directions: what you earn on each unit, and how many units you sell. Whether it helps depends entirely on which of those moves more. These terms are how you tell.",
      terms: [
        {
          term: "Contribution per unit",
          plain: "What one sale leaves behind after the cost of making and shipping it.",
          formula: "price − variable cost",
          matters:
            "A price cut comes straight out of this, rupee for rupee. Cutting ₹75 off a ₹499 price does not cut your margin by 15% — it cuts it by 40%.",
          driver: "contributionPerUnit",
        },
        {
          term: "Contribution margin %",
          plain: "The share of the price that is contribution rather than cost.",
          formula: "contribution per unit ÷ price",
          matters: "The thinner it is, the more damage a price cut does and the less volume can rescue it.",
          driver: "contributionMarginPct",
        },
        {
          term: "Break-even volume",
          plain: "How much extra you must sell for a price cut to leave you no worse off.",
          formula: "old contribution ÷ new contribution − 1",
          matters:
            "The number to compute before any price decision. It is almost always larger than people guess, because contribution falls faster than price does.",
        },
        {
          term: "Price elasticity",
          plain: "How much volume actually moves when price moves 1%.",
          formula: "% change in volume ÷ % change in price",
          matters:
            "Elasticity of 1.2 means a 15% cut buys about 18% more volume. Compare that with break-even volume — if elasticity cannot reach it, the cut loses money by arithmetic, not by luck.",
        },
        {
          term: "Trade promotion",
          plain: "Money paid to a retailer for display space, discounts to shoppers, or listing your product.",
          formula: "promotion spend ÷ units sold in that channel",
          matters:
            "It buys visibility rather than price. Cutting it looks like a margin saving and shows up later as a volume loss that gets blamed on price.",
        },
        {
          term: "Operating profit",
          plain: "What's left after variable costs and the fixed costs of running the business.",
          formula: "(units × contribution per unit) − fixed costs",
          matters: "The number a price decision is finally judged on, and the one this simulation scores you against.",
          driver: "operatingProfit",
        },
      ],
      worked: [
        "At ₹499 with ₹312 of variable cost, each unit contributes ₹187 — a 37.5% contribution margin.",
        "Cut the price 15% to ₹424 and contribution falls to ₹112 — down 40%, not 15%, because the whole cut comes out of the margin.",
        "To keep the same total contribution you would need 187 ÷ 112 − 1 ≈ 67% more volume.",
        "The historical elasticity is about 1.2, so a 15% cut buys roughly 18% more volume. 18% against a 67% requirement is not close.",
      ],
    },
  },

  northStar: "operatingProfit",
  reported: ["units", "price", "contributionPerUnit", "contributionMarginPct", "revenue", "marketShare"],
  drivers: [
    { id: "price", kind: "input", label: "Price", unit: "inr", goodDirection: "up", baseline: 499 },
    { id: "units", kind: "input", label: "Units / quarter", unit: "count", goodDirection: "up", baseline: 46_000 },
    { id: "variableCost", kind: "input", label: "Variable cost / unit", unit: "inr", goodDirection: "down", baseline: 312 },
    {
      id: "contributionPerUnit",
      kind: "difference",
      label: "Contribution per unit",
      unit: "inr",
      goodDirection: "up",
      minuend: "price",
      subtrahend: "variableCost",
    },
    {
      id: "contributionMarginPct",
      kind: "quotient",
      label: "Contribution margin %",
      unit: "ratio",
      goodDirection: "up",
      numerator: "contributionPerUnit",
      denominator: "price",
    },
    { id: "revenue", kind: "product", label: "Revenue", unit: "inr", goodDirection: "up", of: ["units", "price"] },
    {
      id: "totalContribution",
      kind: "product",
      label: "Total contribution",
      unit: "inr",
      goodDirection: "up",
      of: ["units", "contributionPerUnit"],
    },
    { id: "fixedCosts", kind: "input", label: "Fixed costs / quarter", unit: "inr", goodDirection: "down", baseline: 62 * LAKH },
    {
      id: "operatingProfit",
      kind: "difference",
      label: "Operating profit",
      unit: "inr",
      goodDirection: "up",
      minuend: "totalContribution",
      subtrahend: "fixedCosts",
    },
    { id: "marketShare", kind: "input", label: "Market share", unit: "ratio", goodDirection: "up", baseline: 0.083 },
  ],

  dashboard: [
    {
      id: "p-price-headline",
      kind: "stat",
      title: "Last quarter",
      tiles: [
        { label: "Price", value: 499, unit: "inr", goodDirection: "up" },
        { label: "Units", value: 46_000, unit: "count", deltaPct: -0.09, goodDirection: "up" },
        { label: "Contribution per unit", value: 187, unit: "inr", goodDirection: "up" },
        { label: "Contribution margin", value: 0.375, unit: "ratio", goodDirection: "up" },
        { label: "Operating profit", value: 24.02 * LAKH, unit: "inr", deltaPct: -0.26, goodDirection: "up" },
        { label: "Market share", value: 0.083, unit: "ratio", deltaPct: -0.07, goodDirection: "up" },
      ],
    },
    {
      id: "p-price-trend",
      kind: "timeseries",
      title: "Units per quarter",
      caption: "The competitor cut price at the start of Q3.",
      series: [
        {
          label: "Units (thousand)",
          unit: "count",
          points: [
            { period: "Q1", value: 50.9 },
            { period: "Q2", value: 50.6 },
            { period: "Q3", value: 48.1 },
            { period: "Q4", value: 46.0 },
          ],
        },
      ],
    },
    {
      id: "p-price-room",
      kind: "note",
      title: "What the room is saying",
      body:
        "Sales director: they went to ₹439 and took our shelf space with it. We match at ₹424 or we lose the category. " +
        "CFO: before I sign that off, tell me how much extra volume a 15% cut has to sell to leave us no worse off. " +
        "Trade marketing: nothing to add. We're within budget on promotions this year — actually under it.",
    },
  ],

  budget: { analystDays: 6, sprints: 3, rupees: 40 * LAKH },

  drilldowns: [
    {
      id: "dd-channel",
      label: "Volume by channel",
      question: "Is the drop everywhere, or somewhere?",
      cost: 3,
      evidenceFor: ["distribution.promo", "distribution.reach"],
      readsAs:
        "Modern trade is down 31%, general trade down 2%. A competitor's national price cut cannot produce a drop that is fifteen times worse in one channel.",
      reveals: [
        {
          id: "p-channel",
          kind: "segments",
          title: "Unit change by channel, two quarters",
          dimension: "Channel",
          rows: [
            { label: "Modern trade", value: 12_400, unit: "count", deltaPct: -0.31 },
            { label: "General trade", value: 29_600, unit: "count", deltaPct: -0.02 },
            { label: "E-commerce", value: 4_000, unit: "count", deltaPct: 0.04 },
          ],
        },
      ],
    },
    {
      id: "dd-promo-spend",
      label: "Trade promotion spend by channel",
      question: "What have we been paying retailers for?",
      cost: 2,
      evidenceFor: ["distribution.promo"],
      readsAs:
        "Modern-trade promotion was cut 64% two quarters ago to protect margin. The volume fell one quarter later, in exactly that channel, and got blamed on the competitor's price.",
      reveals: [
        {
          id: "p-promo",
          kind: "timeseries",
          title: "Modern-trade promotion spend (₹ lakh / quarter)",
          series: [
            {
              label: "Promotion spend",
              unit: "inr_lakh",
              points: [
                { period: "Q1", value: 19.5 },
                { period: "Q2", value: 7.0 },
                { period: "Q3", value: 6.8 },
                { period: "Q4", value: 7.1 },
              ],
            },
          ],
        },
        {
          id: "p-promo-note",
          kind: "note",
          title: "What it bought",
          body:
            "The promotion paid for end-cap displays in 340 modern-trade stores. Those displays went away in Q2. Store audits show our facings in modern trade fell from an average of 4.1 to 1.6 over the same period.",
        },
      ],
    },
    {
      id: "dd-elasticity",
      label: "Historical price/volume elasticity",
      question: "How much volume would a price cut actually buy?",
      cost: 3,
      evidenceFor: ["demand.price"],
      readsAs:
        "Elasticity is about 1.2, so a 15% cut buys roughly 18% more volume against a break-even requirement of 67%. The cut loses money by arithmetic, not by bad luck.",
      reveals: [
        {
          id: "p-elasticity",
          kind: "segments",
          title: "Past price moves and what they did to volume",
          dimension: "Move",
          rows: [
            { label: "−8% (2 yrs ago): volume", value: 0.095, unit: "ratio" },
            { label: "+6% (last yr): volume", value: -0.071, unit: "ratio" },
            { label: "Implied elasticity", value: 1.2, unit: "ratio" },
          ],
        },
        {
          id: "p-elasticity-note",
          kind: "note",
          title: "Break-even on a 15% cut",
          body:
            "₹499 − ₹312 = ₹187 of contribution today. At ₹424 that becomes ₹112. Holding total contribution needs 187 ÷ 112 − 1 ≈ 67% more units. Elasticity of 1.2 offers about 18%.",
        },
      ],
    },
    {
      id: "dd-competitor",
      label: "Competitor price and share tracker",
      question: "Are they actually taking our customers?",
      cost: 2,
      evidenceFor: ["demand.competitor"],
      readsAs:
        "They gained 1.1 points of share while we lost 0.6 — and the rest went to private label in modern trade, where our display disappeared.",
      reveals: [
        {
          id: "p-competitor",
          kind: "segments",
          title: "Share change, two quarters",
          dimension: "Brand",
          rows: [
            { label: "Us", value: 0.083, unit: "ratio", deltaPct: -0.07 },
            { label: "Competitor (cut 12%)", value: 0.121, unit: "ratio", deltaPct: 0.1 },
            { label: "Modern-trade private label", value: 0.064, unit: "ratio", deltaPct: 0.29 },
          ],
        },
      ],
    },
    {
      id: "dd-stores",
      label: "Distribution reach",
      question: "Have we lost stores?",
      cost: 2,
      evidenceFor: ["distribution.reach"],
      readsAs: "Store count is flat. We are in the same shops — we are just no longer visible in some of them.",
      reveals: [
        {
          id: "p-stores",
          kind: "segments",
          title: "Stores carrying the product",
          dimension: "Channel",
          rows: [
            { label: "Modern trade", value: 1_190, unit: "count", deltaPct: -0.01 },
            { label: "General trade", value: 41_800, unit: "count", deltaPct: 0.02 },
          ],
        },
      ],
    },
    {
      id: "dd-complaints",
      label: "Complaints and returns",
      question: "Has the product got worse?",
      cost: 2,
      evidenceFor: ["product.quality"],
      readsAs: "Returns flat at 1.4%. Not a product problem.",
      reveals: [
        {
          id: "p-complaints",
          kind: "note",
          title: "Quality",
          body:
            "Return rate is 1.4%, unchanged for six quarters. Complaint volume per thousand units is flat. Nothing here.",
        },
      ],
    },
  ],

  causes: [
    { id: "demand", parentId: null, label: "Demand and price", verdict: "Real, and not what moved the number." },
    {
      id: "demand.price",
      parentId: "demand",
      label: "Customers switched because we cost more",
      verdict:
        "Elasticity is only 1.2, and the drop is concentrated in one channel. If price were the cause, general trade would have fallen too — it fell 2%.",
    },
    {
      id: "demand.competitor",
      parentId: "demand",
      label: "The competitor's price cut took our customers",
      verdict:
        "They did gain 1.1 points. But so did modern-trade private label, and both gains land in the channel where our display vanished — the price cut found an opening rather than creating one.",
    },
    { id: "distribution", parentId: null, label: "Distribution and visibility", verdict: "The right place to look." },
    {
      id: "distribution.promo",
      parentId: "distribution",
      label: "Trade promotion was cut in modern trade",
      verdict:
        "This was it. Promotion spend fell 64% two quarters ago to protect margin, facings went from 4.1 to 1.6, and modern-trade volume fell 31% one quarter later while general trade barely moved.",
    },
    {
      id: "distribution.reach",
      parentId: "distribution",
      label: "We lost stores",
      verdict: "Store count is flat in both channels. We are in the same shops, just not visible in them.",
    },
    { id: "product", parentId: null, label: "Product", verdict: "Nothing here." },
    {
      id: "product.quality",
      parentId: "product",
      label: "Quality complaints drove people away",
      verdict: "Returns flat at 1.4% for six quarters.",
    },
  ],
  trueCauseIds: ["distribution.promo"],

  interventions: [
    {
      id: "iv-restore-promo",
      label: "Restore modern-trade promotion",
      pitch:
        "Put the end-cap displays back in 340 modern-trade stores at the pre-cut spend. Costs margin, buys back visibility.",
      addresses: "distribution.promo",
      cost: { sprints: 1, rupees: 18 * LAKH },
      effects: {
        whenRootCause: [{ driver: "units", deltaPct: 0.11 }],
        otherwise: [{ driver: "units", deltaPct: 0.02 }],
      },
      debrief:
        "The fix, and notably cheaper than the price cut it replaces. It buys back the shelf presence that was sold two quarters ago for a margin saving that has cost far more than it saved.",
    },
    {
      id: "iv-visibility",
      label: "In-store visibility programme",
      pitch:
        "Beyond the displays: shelf strips, a trained merchandiser route, and a listing refresh across the modern-trade chains.",
      addresses: "distribution.promo",
      cost: { sprints: 2, rupees: 22 * LAKH },
      effects: {
        whenRootCause: [{ driver: "units", deltaPct: 0.06 }],
        otherwise: [{ driver: "units", deltaPct: 0.015 }],
      },
      debrief:
        "Slower and more expensive than simply restoring the promotion, and it compounds with it — the two together recover more than either alone, which is why the best use of the quarter funds both.",
    },
    {
      id: "iv-price-cut",
      label: "Match the competitor: cut price 15%",
      pitch:
        "The sales director's proposal. Go to ₹424, defend the shelf, take the volume back.",
      addresses: "demand.price",
      cost: { sprints: 1, rupees: 5 * LAKH },
      effects: {
        whenRootCause: [
          { driver: "price", deltaPct: -0.15 },
          { driver: "units", deltaPct: 0.4 },
        ],
        otherwise: [
          { driver: "price", deltaPct: -0.15 },
          // Elasticity 1.2 against a break-even requirement of 67%.
          { driver: "units", deltaPct: 0.18 },
        ],
      },
      debrief:
        "The expensive one. Contribution per unit falls from ₹187 to ₹112 — a 40% cut, from a 15% price move — and the 18% of extra volume elasticity buys is nowhere near the 67% needed to stand still. It turns a ₹24 lakh profit into roughly nothing, and you cannot put the price back up afterwards.",
    },
    {
      id: "iv-price-up",
      label: "Raise price 5%",
      pitch:
        "The opposite bet: demand looks inelastic, so take ₹25 more per unit and accept losing a few sales.",
      addresses: "demand.price",
      cost: { sprints: 1, rupees: 4 * LAKH },
      effects: {
        whenRootCause: [{ driver: "price", deltaPct: 0.05 }],
        otherwise: [
          { driver: "price", deltaPct: 0.05 },
          { driver: "units", deltaPct: -0.09 },
        ],
      },
      debrief:
        "Worth sitting with, because it is the move nobody proposes: raising price improves operating profit here. Contribution per unit goes to ₹212 and the volume you lose is worth less than the margin you gain. It does not fix the channel problem, so it is not the answer — but it shows that 'cut price to defend share' is a reflex, not a calculation.",
    },
    {
      id: "iv-expand-stores",
      label: "Add 1,200 general-trade stores",
      pitch: "Widen distribution where we are strongest and grow past the problem.",
      addresses: "distribution.reach",
      cost: { sprints: 2, rupees: 25 * LAKH },
      effects: {
        whenRootCause: [{ driver: "units", deltaPct: 0.12 }],
        otherwise: [{ driver: "units", deltaPct: 0.07 }],
      },
      debrief:
        "Genuinely additive and aimed at the wrong channel. Reach was never the constraint — store count is flat — so this grows around a hole rather than filling it, at more than twice the cost of restoring the promotion.",
    },
    {
      id: "iv-value-pack",
      label: "Launch a two-pack at a lower unit price",
      pitch:
        "Answer the price gap without a headline price cut: a bundle that lowers effective per-unit price for heavy users.",
      addresses: "demand.competitor",
      cost: { sprints: 1, rupees: 10 * LAKH },
      effects: {
        whenRootCause: [{ driver: "units", deltaPct: 0.09 }],
        otherwise: [
          { driver: "units", deltaPct: 0.05 },
          { driver: "price", deltaPct: -0.06 },
        ],
      },
      debrief:
        "A softer version of the price cut with the same arithmetic underneath: effective price down 6%, volume up 5%. Better than matching outright, and still paying margin to solve a visibility problem.",
    },
  ],

  // The competitor keeps promoting, so standing still keeps costing volume.
  drift: [{ driver: "units", deltaPct: -0.03 }],
  horizonQuarters: 2,

  parInvestigation: ["dd-channel", "dd-promo-spend"],
  bestAllocation: [
    { interventionId: "iv-restore-promo", sprints: 1, rupees: 18 * LAKH },
    { interventionId: "iv-visibility", sprints: 2, rupees: 22 * LAKH },
  ],

  debrief: {
    causalChain: [
      "Two quarters ago, modern-trade promotion spend was cut 64% to protect margin.",
      "The end-cap displays it paid for disappeared from 340 stores, and average facings fell from 4.1 to 1.6.",
      "One quarter later, modern-trade volume fell 31% while general trade fell 2% and e-commerce grew.",
      "A competitor cut price 12% in the same window, which gave everyone an explanation that fitted the timing and not the pattern.",
      "The proposed 15% price cut would take contribution per unit from ₹187 to ₹112 — needing 67% more volume against an elasticity that offers 18%.",
    ],
    whereTheLeverageWas:
      "The promotion line that was cut to save ₹12.5 lakh a quarter, and has cost far more than that in lost volume. Restoring visibility in modern trade recovers the units without touching price — and price, once cut, is extremely hard to put back.",
    strongAnswer:
      "Answer the CFO's question first, because it settles the argument: at ₹499 with ₹312 of variable cost, contribution is ₹187, and a 15% cut takes it to ₹112. That is a 40% fall in margin from a 15% fall in price, so break-even needs about 67% more volume. Historical elasticity is 1.2, which offers 18%. The cut is arithmetically a loser before you know anything else. Then find where the volume actually went: modern trade is down 31% and general trade down 2%, and no national price move produces a fifteen-fold difference between channels. What did change in that channel was our own promotion spend, cut 64% two quarters earlier — the volume followed one quarter later and the competitor's price cut arrived in time to take the blame. Worth adding that the same elasticity means a 5% price *rise* improves profit here, which is a useful check on the instinct that share is always defended with price.",
  },

  coachFallback: [
    {
      topic: ["break even", "break-even", "volume", "67", "price cut"],
      answer:
        "Contribution is ₹499 − ₹312 = ₹187. At a 15% cut the price is ₹424 and contribution is ₹112, so you need 187 ÷ 112 − 1 ≈ 67% more volume just to stand still. Elasticity of 1.2 buys about 18%. The cut loses by arithmetic.",
    },
    {
      topic: ["elasticity", "price sensitivity", "1.2"],
      answer:
        "Measured elasticity is about 1.2 — a 1% price move shifts volume 1.2%. Compare that with the break-even requirement before any price decision; here 18% of achievable volume against a 67% requirement settles it.",
    },
    {
      topic: ["promotion", "trade promotion", "display", "facings", "visibility"],
      answer:
        "That was the cause. Modern-trade promotion was cut 64% two quarters ago to protect margin, facings went from 4.1 to 1.6, and volume in that channel fell 31% a quarter later while general trade fell 2%.",
    },
    {
      topic: ["channel", "modern trade", "general trade"],
      answer:
        "Modern trade −31%, general trade −2%, e-commerce +4%. A national price cut by a competitor cannot produce a fifteen-fold difference between channels — that pattern points at something channel-specific, and it was our own promotion spend.",
    },
    {
      topic: ["raise price", "price up", "increase price", "5%"],
      answer:
        "Counter-intuitively it improves profit. Contribution goes from ₹187 to ₹212 and the volume you lose is worth less than the margin you gain, because demand is inelastic. It does not fix the channel problem, but it does show that matching a price cut is a reflex rather than a calculation.",
    },
    {
      topic: ["competitor", "match", "share"],
      answer:
        "They gained 1.1 points of share, and so did modern-trade private label — both in the channel where our display vanished. The price cut found an opening that our promotion cut had already made.",
    },
  ],
};
