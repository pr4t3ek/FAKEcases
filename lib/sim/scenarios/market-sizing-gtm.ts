/**
 * "We hit 40% of plan. Whose fault is it?"
 *
 * Teaches TAM / SAM / SOM by making the classic error visible, and channel
 * economics by making the student pay for it.
 *
 * ── The truth, for whoever maintains this ─────────────────────────────────
 *
 * Nobody missed. The plan was wrong.
 *
 * The SAM was built as "households with an unreliable grid who can afford
 * ₹1,899" — 18% of 30 crore households, so 5.4 crore. It never asked whether
 * those households could physically install a rooftop panel, and only 34% of
 * them own an unshaded roof. The genuinely serviceable market was 1.84 crore,
 * and 2% of that is about 3.7 lakh units — which is roughly what the team sold.
 *
 * That is the lesson: **addressable is not the same as reachable**, and a SAM
 * that skips the qualifying constraint produces a plan the sales team is then
 * blamed for missing.
 *
 * ── Balance notes ─────────────────────────────────────────────────────────
 *
 * The D2C option is the interesting trap. Cutting a 35% channel margin looks
 * enormous against ₹82 crore of gross revenue, and it is — which is why the
 * costs of running a direct operation (fulfilment in `cogsPerUnit`, marketing
 * and service in `fixedCosts`) have to be modelled honestly, or "go direct"
 * beats the correct answer. Those numbers were tuned until the brute-force
 * balance test in `sim-scenario.test.ts` stopped complaining, and that test is
 * what will tell you if a retune breaks it again.
 */

import type { SimScenario } from "../types";

const CRORE = 10_000_000;

export const marketSizingGtm: SimScenario = {
  slug: "market-sizing-gtm",
  title: "Ujala Solar: we planned for 10.8 lakh units and sold 4.3 lakh",
  company: "Ujala Solar",
  premise:
    "A rooftop solar kit launched against a 10.8 lakh unit plan and sold 4.3 lakh. Find out whether that is a sales problem or a planning one.",
  situation:
    "You are the PM for Ujala Solar's ₹1,899 home lighting kit. The business case sized the market at 30 crore Indian households, narrowed to 5.4 crore who face daily power cuts and can afford the price, and targeted 2% of them — 10.8 lakh units in year one. " +
    "You sold 4.3 lakh. The sales head is being asked to explain the miss; he says the number was never real. " +
    "You have 6 analyst-days to work out who is right, then 4 sprints and ₹12 crore to fix whatever it turns out to be.",
  difficulty: "Medium",

  teaching: {
    showMetricMap: true,
    primer: {
      intro:
        "Market sizing is three numbers that get shortened to the same word, and a plan built on the wrong one produces a target nobody can hit. Channel economics is what happens to that revenue on its way to you.",
      terms: [
        {
          term: "TAM",
          full: "Total addressable market",
          plain: "Everyone who could conceivably ever buy this kind of product.",
          formula: "all potential customers × price",
          matters: "Useful for deciding whether a category is worth entering. Useless as a plan — nobody sells to a TAM.",
          driver: "tamHouseholds",
        },
        {
          term: "SAM",
          full: "Serviceable addressable market",
          plain: "The slice of the TAM your product can actually serve — right need, right price, right constraints.",
          formula: "TAM × the share that qualifies",
          matters:
            "Where most sizing goes wrong. Every qualifying condition you forget makes the SAM too big, and the plan built on it becomes a target the team is blamed for missing.",
          driver: "sam",
        },
        {
          term: "SOM",
          full: "Serviceable obtainable market",
          plain: "The share of the SAM you can realistically win, given competitors and your own reach.",
          formula: "SAM × realistic share",
          matters: "This is the only one of the three that belongs in a plan.",
          driver: "som",
        },
        {
          term: "Channel margin",
          plain: "The share of the price the distributor and retailer keep for selling it for you.",
          formula: "channel cost ÷ gross revenue",
          matters:
            "It comes off the top, so a 35% channel margin on ₹82 crore is ₹29 crore you never see. Cheaper channels usually cost you somewhere else instead.",
          driver: "channelMarginRate",
        },
        {
          term: "Net revenue",
          plain: "What actually reaches you after the channel takes its cut.",
          formula: "gross revenue − channel cost",
          matters: "The number to build a business case on. Gross revenue flatters every plan that uses it.",
          driver: "netRevenue",
        },
        {
          term: "Contribution",
          plain: "Net revenue minus what the units cost to make and deliver.",
          formula: "net revenue − cost of goods",
          matters: "What is left to pay for the fixed cost of running the company.",
          driver: "contribution",
        },
      ],
      worked: [
        "30 crore households (TAM) × 18% who face daily cuts and can afford ₹1,899 = 5.4 crore (SAM).",
        "5.4 crore × 2% target share = 10.8 lakh units — the plan.",
        "At 4.3 lakh units and ₹1,899, gross revenue is ₹82 crore. The channel keeps 35%, so ₹53 crore reaches us; goods cost ₹42 crore; ₹11 crore of contribution against ₹14 crore of fixed costs.",
        "Every one of those steps is arithmetic. The question is whether the 18% was ever the right number.",
      ],
    },
  },

  northStar: "operatingProfit",
  reported: ["som", "sam", "netRevenue", "contribution", "channelMarginRate", "units"],
  drivers: [
    { id: "tamHouseholds", kind: "input", label: "Indian households (TAM)", unit: "count", goodDirection: "up", baseline: 30 * CRORE },
    { id: "samRate", kind: "input", label: "Share who qualify (SAM %)", unit: "ratio", goodDirection: "up", baseline: 0.18 },
    { id: "sam", kind: "product", label: "Serviceable market (SAM)", unit: "count", goodDirection: "up", of: ["tamHouseholds", "samRate"] },
    { id: "somRate", kind: "input", label: "Share we win (SOM %)", unit: "ratio", goodDirection: "up", baseline: 0.008 },
    { id: "som", kind: "product", label: "Obtainable market (SOM)", unit: "count", goodDirection: "up", of: ["sam", "somRate"] },
    { id: "units", kind: "sum", label: "Units sold", unit: "count", goodDirection: "up", of: ["som"] },
    { id: "price", kind: "input", label: "Price", unit: "inr", goodDirection: "up", baseline: 1899 },
    { id: "grossRevenue", kind: "product", label: "Gross revenue", unit: "inr", goodDirection: "up", of: ["units", "price"] },
    { id: "channelMarginRate", kind: "input", label: "Channel margin", unit: "ratio", goodDirection: "down", baseline: 0.35 },
    { id: "channelCost", kind: "product", label: "Channel cost", unit: "inr", goodDirection: "down", of: ["grossRevenue", "channelMarginRate"] },
    {
      id: "netRevenue",
      kind: "difference",
      label: "Net revenue",
      unit: "inr",
      goodDirection: "up",
      minuend: "grossRevenue",
      subtrahend: "channelCost",
    },
    { id: "cogsPerUnit", kind: "input", label: "Cost of goods / unit", unit: "inr", goodDirection: "down", baseline: 980 },
    { id: "cogs", kind: "product", label: "Cost of goods", unit: "inr", goodDirection: "down", of: ["units", "cogsPerUnit"] },
    {
      id: "contribution",
      kind: "difference",
      label: "Contribution",
      unit: "inr",
      goodDirection: "up",
      minuend: "netRevenue",
      subtrahend: "cogs",
    },
    { id: "fixedCosts", kind: "input", label: "Fixed costs", unit: "inr", goodDirection: "down", baseline: 14 * CRORE },
    {
      id: "operatingProfit",
      kind: "difference",
      label: "Operating profit",
      unit: "inr",
      goodDirection: "up",
      minuend: "contribution",
      subtrahend: "fixedCosts",
    },
  ],

  dashboard: [
    {
      id: "p-gtm-headline",
      kind: "stat",
      title: "Year one: plan against actual",
      tiles: [
        { label: "Units planned", value: 1_080_000, unit: "count", goodDirection: "up" },
        { label: "Units sold", value: 432_000, unit: "count", deltaPct: -0.6, goodDirection: "up" },
        { label: "Gross revenue", value: 82.04 * CRORE, unit: "inr", goodDirection: "up" },
        { label: "Net revenue after channel", value: 53.32 * CRORE, unit: "inr", goodDirection: "up" },
        { label: "Contribution", value: 10.98 * CRORE, unit: "inr", goodDirection: "up" },
        { label: "Operating profit", value: -3.02 * CRORE, unit: "inr", goodDirection: "up" },
      ],
    },
    {
      id: "p-gtm-sizing",
      kind: "funnel",
      title: "The sizing the plan was built on",
      caption: "Three numbers, each a percentage of the one above.",
      steps: [
        { label: "TAM — Indian households", value: 300_000_000 },
        { label: "SAM — daily cuts + can afford ₹1,899 (18%)", value: 54_000_000 },
        { label: "SOM — target share (2%)", value: 1_080_000 },
        { label: "Actually sold", value: 432_000 },
      ],
    },
    {
      id: "p-gtm-product",
      kind: "stat",
      title: "The product, in the hands of people who have one",
      caption: "Owner research, 4,300 responses.",
      tiles: [
        { label: "Owner rating", value: 4.4, unit: "count", goodDirection: "up" },
        { label: "Would recommend", value: 0.71, unit: "ratio", goodDirection: "up" },
        { label: "Installation succeeds first time", value: 0.89, unit: "ratio", goodDirection: "up" },
        { label: "Warranty claims", value: 0.024, unit: "ratio", goodDirection: "down" },
      ],
    },
    {
      id: "p-gtm-awareness",
      kind: "segments",
      title: "Aided awareness by launch state",
      caption: "Against a 30% plan. The campaign did what it said it would.",
      dimension: "State",
      rows: [
        { label: "Uttar Pradesh", value: 0.41, unit: "ratio", deltaPct: 36.7 },
        { label: "Bihar", value: 0.34, unit: "ratio", deltaPct: 13.3 },
        { label: "Madhya Pradesh", value: 0.31, unit: "ratio", deltaPct: 3.3 },
        { label: "Rajasthan", value: 0.29, unit: "ratio", deltaPct: -3.3 },
      ],
    },
    {
      id: "p-gtm-unit",
      kind: "stat",
      title: "What one unit earns",
      caption: "Per unit sold, after the dealer's margin.",
      tiles: [
        { label: "Retail price", value: 1899, unit: "inr", goodDirection: "up" },
        { label: "Dealer margin", value: 0.35, unit: "ratio", goodDirection: "down" },
        { label: "Cost to make", value: 742, unit: "inr", goodDirection: "down" },
        { label: "Contribution per unit", value: 492, unit: "inr", goodDirection: "up" },
      ],
    },
    {
      id: "p-gtm-room",
      kind: "note",
      title: "What the room is saying",
      body:
        "CEO: we missed by 60% in year one. That is an execution problem and I want a plan to fix it. " +
        "Sales head: I put 6,400 dealers in place against a target of 6,000. The number was never real. " +
        "Finance: the channel takes 35% before we see a rupee. If we sold direct we would be profitable at these volumes.",
    },
  ],

  budget: { analystDays: 6, sprints: 4, rupees: 12 * CRORE },

  drilldowns: [
    {
      id: "dd-installability",
      label: "Can the target households actually install it?",
      question: "Does every household in our SAM have somewhere to put a panel?",
      cost: 2,
      evidenceFor: ["sizing.sam"],
      readsAs:
        "Only 34% of the SAM own an unshaded roof. The other two thirds rent, live in multi-storey buildings, or have no usable roof — they were never customers, and they were two thirds of the plan.",
      reveals: [
        {
          id: "p-installability",
          kind: "segments",
          title: "Survey of 4,200 SAM households",
          dimension: "Roof situation",
          rows: [
            { label: "Owns an unshaded roof", value: 0.34, unit: "ratio" },
            { label: "Rents — cannot fix a panel", value: 0.38, unit: "ratio" },
            { label: "Multi-storey, no roof access", value: 0.19, unit: "ratio" },
            { label: "Roof shaded or unsound", value: 0.09, unit: "ratio" },
          ],
        },
        {
          id: "p-installability-note",
          kind: "note",
          title: "What the SAM should have been",
          body:
            "5.4 crore × 34% = 1.84 crore genuinely serviceable households. At the same 2% target share that is about 3.7 lakh units — against 4.3 lakh actually sold. Measured against a SAM that included the qualifying constraint, year one beat plan.",
        },
      ],
    },
    {
      id: "dd-plan-actual",
      label: "Plan against actual by state",
      question: "Did we miss everywhere, or somewhere?",
      cost: 2,
      evidenceFor: ["sizing.sam", "gtm.reach"],
      readsAs:
        "The shortfall is 58–62% in every single state, including the ones with the best dealer coverage. A uniform miss is the signature of a wrong plan, not of bad execution.",
      reveals: [
        {
          id: "p-plan-actual",
          kind: "segments",
          title: "Achievement against plan",
          dimension: "State",
          rows: [
            { label: "Uttar Pradesh", value: 0.41, unit: "ratio" },
            { label: "Bihar", value: 0.39, unit: "ratio" },
            { label: "Maharashtra", value: 0.42, unit: "ratio" },
            { label: "Rajasthan", value: 0.4, unit: "ratio" },
            { label: "West Bengal", value: 0.38, unit: "ratio" },
          ],
        },
      ],
    },
    {
      id: "dd-channel-econ",
      label: "Contribution by route to market",
      question: "What would a different channel actually be worth?",
      cost: 2,
      evidenceFor: ["gtm.margin"],
      readsAs:
        "General trade keeps 35% but costs us nothing to run. Direct keeps 8% and costs a fulfilment network and a marketing budget — the saving is real and most of it gets spent somewhere else.",
      reveals: [
        {
          id: "p-channel-econ",
          kind: "segments",
          title: "Per-unit economics by channel",
          dimension: "Channel",
          rows: [
            { label: "General trade — channel margin", value: 0.35, unit: "ratio" },
            { label: "Modern trade — margin + listing fees", value: 0.28, unit: "ratio" },
            { label: "Direct to consumer — channel margin", value: 0.08, unit: "ratio" },
            { label: "D2C — added fulfilment cost / unit (₹)", value: 176, unit: "inr" },
          ],
        },
        {
          id: "p-channel-note",
          kind: "note",
          title: "What direct costs to run",
          body:
            "Going direct means our own logistics, returns handling, installation scheduling and customer acquisition. Comparable brands run this at ₹9–11 crore a year of fixed cost before a single extra unit is sold.",
        },
      ],
    },
    {
      id: "dd-reach",
      label: "Dealer coverage against plan",
      question: "Did we actually get distribution?",
      cost: 2,
      evidenceFor: ["gtm.reach"],
      readsAs: "6,400 dealers against a 6,000 target. Distribution was delivered; the demand behind it was not there.",
      reveals: [
        {
          id: "p-reach",
          kind: "segments",
          title: "Dealers appointed",
          dimension: "Region",
          rows: [
            { label: "North", value: 2_310, unit: "count", deltaPct: 0.09 },
            { label: "West", value: 1_840, unit: "count", deltaPct: 0.05 },
            { label: "East", value: 2_250, unit: "count", deltaPct: 0.07 },
          ],
        },
      ],
    },
    {
      id: "dd-price-test",
      label: "Willingness to pay",
      question: "Is ₹1,899 simply too much?",
      cost: 2,
      evidenceFor: ["gtm.price"],
      readsAs:
        "Among households that can install, ₹1,899 converts fine and a lower price adds little. Price was not the barrier — a roof was.",
      reveals: [
        {
          id: "p-price-test",
          kind: "segments",
          title: "Purchase intent among installable households",
          dimension: "Price point",
          rows: [
            { label: "₹1,899", value: 0.31, unit: "ratio" },
            { label: "₹1,599", value: 0.37, unit: "ratio" },
            { label: "₹1,299", value: 0.44, unit: "ratio" },
          ],
        },
      ],
    },
    {
      id: "dd-competitor",
      label: "Competitor presence",
      question: "Did someone else take the market?",
      cost: 2,
      evidenceFor: ["gtm.reach"],
      readsAs: "No national competitor at this price. We were not beaten to it — there was less of it than we thought.",
      reveals: [
        {
          id: "p-gtm-competitor",
          kind: "note",
          title: "Competitive set",
          body:
            "Two regional players, together under 60,000 units, both above ₹2,400. No national brand at our price point in year one.",
        },
      ],
    },
    // A seventh pull, so six analyst-days cannot cover half the board. It also
    // closes the branch a candidate reaches for when a launch misses and the
    // dealers are in place: that the product itself disappointed. It did not,
    // which leaves only the plan.
    {
      id: "dd-owners",
      label: "What owners say",
      question: "Is the product itself letting us down?",
      cost: 2,
      evidenceFor: ["product.quality", "product.install"],
      readsAs:
        "Owners rate it 4.4 and 89% of installations succeed first time. The people who could fit one are happy with it — there were simply far fewer of them than the plan assumed.",
      reveals: [
        {
          id: "p-gtm-owners",
          kind: "stat",
          title: "Owner research, 4,300 responses",
          tiles: [
            { label: "Owner rating", value: 4.4, unit: "count", goodDirection: "up" },
            { label: "Installed successfully first time", value: 0.89, unit: "ratio", goodDirection: "up" },
            { label: "Would recommend", value: 0.71, unit: "ratio", goodDirection: "up" },
            { label: "Warranty claims", value: 0.024, unit: "ratio", goodDirection: "down" },
          ],
        },
      ],
    },
  ],

  causes: [
    { id: "sizing", parentId: null, label: "The market estimate", verdict: "The right place to look." },
    {
      id: "sizing.sam",
      parentId: "sizing",
      label: "The addressable market was never reachable",
      verdict:
        "This was it. The SAM counted every household with power cuts who could afford the price and never asked whether they had a roof. Only 34% did, so the real SAM was 1.84 crore, not 5.4 crore — and 2% of that is roughly what we sold.",
    },
    {
      id: "sizing.som",
      parentId: "sizing",
      label: "2% share in year one was too ambitious",
      verdict:
        "Reasonable to suspect and not the issue: against the corrected SAM the team achieved about 2.3% share in year one, ahead of the target rate.",
    },
    { id: "gtm", parentId: null, label: "Go to market", verdict: "Delivered what it was asked for." },
    {
      id: "gtm.margin",
      parentId: "gtm",
      label: "The channel takes too much",
      verdict:
        "35% is real money, and going direct trades it for fulfilment cost and roughly ₹10 crore of new fixed cost. Worth examining and not the reason the plan was missed.",
    },
    {
      id: "gtm.reach",
      parentId: "gtm",
      label: "We did not get enough distribution",
      verdict:
        "6,400 dealers against a 6,000 target, and the shortfall is 58–62% in every state including the best-covered ones. Uniform misses come from plans, not from execution.",
    },
    {
      id: "gtm.price",
      parentId: "gtm",
      label: "₹1,899 is too expensive",
      verdict:
        "Among households that can install, intent at ₹1,899 is 31% and only reaches 44% at ₹1,299 — a lot of margin for a little volume. Price was not the barrier.",
    },
    { id: "product", parentId: null, label: "The product itself", verdict: "Both branches clean. What was built works; it was sized for a market that does not exist." },
    {
      id: "product.quality",
      parentId: "product",
      label: "It does not work well enough to recommend",
      verdict:
        "No. Installed units run at 4.4 out of 5 and 71% of owners would recommend it. The people who bought one are happy — there were simply far fewer of them than planned.",
    },
    {
      id: "product.install",
      parentId: "product",
      label: "Installation is too hard, so people give up",
      verdict:
        "Close to the real answer and pointed the wrong way. 89% of attempted installations succeed. The problem is not that installation fails — it is that 66% of households have nowhere to attempt it.",
    },
  ],
  trueCauseIds: ["sizing.sam"],

  interventions: [
    {
      id: "iv-replan",
      label: "Re-base the plan on the reachable market",
      pitch:
        "Rebuild the business case on the 1.84 crore households that can actually install, and resize the cost base to the business that implies.",
      addresses: "sizing.sam",
      cost: { sprints: 2, rupees: 4 * CRORE },
      minSprints: 2,
      effects: {
        whenRootCause: [{ driver: "fixedCosts", deltaPct: -0.35 }],
        otherwise: [{ driver: "fixedCosts", deltaPct: -0.1 }],
      },
      debrief:
        "Unglamorous and the highest-return thing available. The company was built to serve a market that does not exist; sizing the cost base to the one that does turns a loss into a profit without selling one extra unit.",
    },
    {
      id: "iv-renter-product",
      label: "Launch a clamp-on version for renters",
      pitch:
        "A balcony-rail and window-mount variant needing no roof and no drilling. Opens the 57% of the SAM who rent or live in multi-storey buildings.",
      addresses: "sizing.sam",
      cost: { sprints: 2, rupees: 6 * CRORE },
      minSprints: 2,
      effects: {
        whenRootCause: [{ driver: "samRate", deltaPct: 0.9 }],
        otherwise: [{ driver: "samRate", deltaPct: 0.1 }],
      },
      debrief:
        "The growth half of the answer. Rather than chase share in a small market, it makes the market bigger by removing the constraint that made it small — which is the only honest way to grow a SAM.",
    },
    {
      id: "iv-d2c",
      label: "Go direct and keep the channel margin",
      pitch:
        "Finance's proposal: 35% of ₹82 crore is ₹29 crore. Sell direct, keep most of it, fund everything else from the saving.",
      addresses: "gtm.margin",
      cost: { sprints: 2, rupees: 5 * CRORE },
      effects: {
        whenRootCause: [{ driver: "channelMarginRate", deltaPct: -0.5 }],
        otherwise: [
          { driver: "channelMarginRate", deltaPct: -0.5 },
          // The saving is real. So is what it costs to replace a channel.
          { driver: "cogsPerUnit", deltaPct: 0.18 },
          { driver: "fixedCosts", deltaPct: 0.75 },
        ],
      },
      debrief:
        "The best-looking number in the room and a poor trade. The channel margin saving is genuine, and so is the fulfilment, service and acquisition cost of replacing a distribution network you currently get for free — most of the ₹29 crore comes straight back out as your own cost.",
    },
    {
      id: "iv-expand-reach",
      label: "Add 8,000 more dealers",
      pitch: "Double distribution and take a bigger share of the market we sized.",
      addresses: "gtm.reach",
      cost: { sprints: 2, rupees: 7 * CRORE },
      effects: {
        whenRootCause: [{ driver: "somRate", deltaPct: 0.4 }],
        otherwise: [{ driver: "somRate", deltaPct: 0.25 }],
      },
      debrief:
        "More shelves in front of the same households. It sells some units, at ₹7 crore, in a market where distribution was already ahead of target — the constraint was never how many dealers could reach a customer who cannot install the product.",
    },
    {
      id: "iv-price-cut",
      label: "Cut the price to ₹1,599",
      pitch: "Buy volume with price and grow into the plan.",
      addresses: "gtm.price",
      cost: { sprints: 1, rupees: 2 * CRORE },
      effects: {
        whenRootCause: [{ driver: "somRate", deltaPct: 0.35 }],
        otherwise: [
          { driver: "price", deltaPct: -0.16 },
          { driver: "somRate", deltaPct: 0.2 },
        ],
      },
      debrief:
        "₹300 off a ₹1,899 product whose contribution after channel margin is already thin. Intent among installable households moves from 31% to 37%, which does not come close to paying for the margin given up.",
    },
  ],

  drift: [{ driver: "somRate", deltaPct: -0.04 }],
  horizonQuarters: 2,

  parInvestigation: ["dd-installability", "dd-plan-actual"],
  bestAllocation: [
    { interventionId: "iv-replan", sprints: 2, rupees: 4 * CRORE },
    { interventionId: "iv-renter-product", sprints: 2, rupees: 6 * CRORE },
  ],

  debrief: {
    causalChain: [
      "The SAM was defined as households facing daily power cuts who could afford ₹1,899 — 18% of 30 crore, or 5.4 crore households.",
      "It never asked whether those households had somewhere to put a solar panel.",
      "Only 34% of them own an unshaded roof; 38% rent, 19% live in multi-storey buildings and 9% have a shaded or unsound roof.",
      "The genuinely serviceable market was therefore 1.84 crore, and a 2% share of that is about 3.7 lakh units.",
      "The team sold 4.3 lakh — ahead of a correctly sized plan, and 60% below the one they were given.",
    ],
    whereTheLeverageWas:
      "The qualifying constraint that was left out of the SAM. Correcting the plan resizes a cost base built for a market that does not exist, and the clamp-on variant grows the market by removing the constraint rather than fighting for share inside it. Everything in the go-to-market column is an answer to a question nobody asked.",
    strongAnswer: [
      "Before accepting that the team missed, test whether the plan was right.",
      "The shortfall is 58–62% in every single state, including the best-covered ones, and we appointed more dealers than we promised.",
      "That uniformity is the tell. Execution varies by region; arithmetic does not. A miss this even comes from the plan.",
      "So go back to the sizing. The break is almost always between the whole category and the slice we can actually sell to.",
      "Ask what has to be true for a household to buy: power cuts, ₹1,899 to spend, and a roof to mount it on.",
      "The plan checked the first two and skipped the third. Only 34% of those households have a roof.",
      "So the real reachable market was 1.84 crore, not 5.4 crore — and against that, the team beat their share target.",
      "The answer is therefore not to sell harder. Resize the cost base to the market that exists.",
      "And if we want the original number, remove the constraint rather than fight inside it: build the clamp-on version for the 57% who rent.",
      "Set aside the dealer-margin idea. The ₹29 crore is real, but going direct spends most of it back — we would be replacing a distribution network we currently get for free.",
    ],
  },

  coachFallback: [
    {
      topic: ["sam", "serviceable", "sizing", "roof", "install"],
      answer: [
        "The reachable market was the problem — the slice of the category we could actually sell to.",
        "It counted households that had power cuts and could afford the price, but never asked whether they had a roof to mount it on. Only 34% did.",
        "The real number was 1.84 crore, not 5.4 crore. Two percent of that is about what you sold.",
      ],
    },
    {
      topic: ["tam", "total addressable", "30 crore"],
      answer: [
        "The 30 crore figure for the whole category was fine — it is meant to answer \"how big is this category\", not \"what will we sell\".",
        "The error came in the step after it, narrowing that down to who we can actually reach.",
        "That step is where sizing almost always breaks.",
      ],
    },
    {
      topic: ["som", "share", "2%", "ambitious"],
      answer: [
        "The 2% share target was reasonable.",
        "Measured against the corrected market, the team hit roughly 2.3% in year one.",
        "So they beat the share assumption while missing the unit number — which tells you the unit number was wrong.",
      ],
    },
    {
      topic: ["channel", "margin", "35%", "d2c", "direct"],
      answer: [
        "The 35% we give dealers is ₹29 crore of real money, so the instinct to keep it is sound.",
        "But selling direct spends most of it back: about ₹176 a unit to pack and ship, plus roughly ₹10 crore of new fixed cost for logistics, service and finding customers.",
        "You would be paying to rebuild a distribution network you currently get for free.",
      ],
    },
    {
      topic: ["dealer", "reach", "distribution", "execution"],
      answer: [
        "Distribution actually delivered: 6,400 dealers signed against a target of 6,000.",
        "And the miss was 58–62% everywhere, including the states with the best coverage.",
        "Shortfalls that even come from plans, not from people.",
      ],
    },
    {
      topic: ["price", "1599", "cut", "too expensive"],
      answer: [
        "Among households that can actually install it, interest goes from 31% at ₹1,899 to 37% at ₹1,599.",
        "That is a lot of margin given away for a little volume, on a product whose margin after the dealer's cut is already thin.",
        "Price was not the barrier. A roof was.",
      ],
    },
    {
      topic: ["renter", "clamp", "balcony", "grow the market"],
      answer: [
        "The clamp-on version is the growth half of the answer.",
        "Instead of fighting for a bigger share of a small market, it removes the thing that made the market small.",
        "That opens up the 57% who rent or live in flats.",
      ],
    },
  ],
};
