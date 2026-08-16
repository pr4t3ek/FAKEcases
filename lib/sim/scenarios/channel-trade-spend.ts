/**
 * "We're number one on quick commerce and the money went."
 *
 * The channel-economics scenario. Teaches net realisation, trade promotion,
 * incrementality, cannibalisation and — the one that makes the rest bite —
 * **market share is not a result**.
 *
 * ── The truth, for whoever maintains this ─────────────────────────────────
 *
 * A ₹60 pack is a completely different business depending on where it is sold.
 * In a kirana, 21 paise in the rupee goes to the trade and ₹47.40 reaches the
 * brand. On quick commerce, 42 paise goes to the platform in commission and
 * visibility and ₹34.80 reaches the brand. Same pack, same ₹26 of cost, and
 * ₹21.40 of contribution against ₹8.80.
 *
 * So the growth story is arithmetic rather than opinion. Quick-commerce share
 * went 4% → 11.5% and total volume moved 1.8%, because roughly two-thirds of
 * quick-commerce buyers were already buying the pack from a kirana. The brand
 * is paying a 42% deduction to move volume it already had at a 21% deduction.
 *
 * The scenario is built so the right answer *loses share*: rebalancing takes
 * quick-commerce share from 11.5% back to about 8.6% and grows net contribution
 * by more than a third. A student who cannot bring themselves to give up the
 * share number will not find it.
 *
 * ── Balance notes ─────────────────────────────────────────────────────────
 *
 * `iv-cogs` and `iv-mrp` are the dangerous decoys, because at ₹8.80 of
 * contribution per pack a small change in cost or price is worth a great deal.
 * Both are tuned to be genuinely profitable and clearly inferior — the MRP rise
 * carries an elasticity of about 1.7, which is what the historical data in
 * `dd-price` actually shows. An earlier tuning at −6% volume let "raise price
 * and rebalance" beat the declared best; the brute-force balance test in
 * `tests/sim-scenario.test.ts` is what caught it, and is what will catch the
 * next one.
 */

import type { SimScenario } from "../types";

const LAKH = 100_000;
const CRORE = 100 * LAKH;

export const channelTradeSpend: SimScenario = {
  slug: "channel-trade-spend",
  title: "Chaska: share is up five points and the profit is down a third",
  company: "Chaska",
  premise:
    "A snack brand went from 4% to 11.5% share on quick commerce in three quarters. Volume barely moved and profit fell a third. Work out why before the board doubles the budget.",
  situation:
    "You are the category PM at Chaska, a roasted-makhana snack brand selling a ₹60 pack through kirana stores and, for the last year, through quick commerce. " +
    "Quick-commerce share has gone from 4% to 11.5% and the founder has been on a podcast about it. Monthly net contribution has fallen from ₹1.12 crore to ₹70.8 lakh over the same period. " +
    "Sales wants ₹18 lakh more a month for visibility slots to take share past 15%; finance wants the quick-commerce listing pulled entirely. " +
    "You have 6 analyst-days to work out what is actually happening, then 3 sprints and ₹40 lakh to act on it.",
  difficulty: "Easy",
  periodNoun: "month",

  // ── Teaching ────────────────────────────────────────────────────────────
  teaching: {
    showMetricMap: true,
    primer: {
      intro:
        "One pack, one price, two very different businesses. Everything below is about the gap between what a shopper pays and what reaches you — and about telling growth you created apart from growth you moved. The metric map on the right runs both channels side by side with live numbers.",
      terms: [
        {
          term: "Channel",
          plain:
            "The route a pack takes to the shopper — a kirana store, a supermarket, a quick-commerce app, your own website.",
          matters:
            "Each one deducts a different amount before the money reaches you, so the same pack is worth different money in each. Treating them as one business is how brands grow into a loss.",
        },
        {
          term: "MRP",
          full: "Maximum retail price",
          plain: "The price printed on the pack. By law it is the same everywhere in India.",
          matters:
            "Because the shopper pays the same in both channels, every difference in what you earn comes from what the channel deducts — not from what you charge.",
          driver: "mrp",
        },
        {
          term: "Channel margin / commission",
          plain:
            "The cut the channel keeps for stocking and selling your pack — the distributor and retailer in general trade, the platform's commission on quick commerce.",
          matters:
            "It is the price of access to that channel's shoppers, and on quick commerce it is roughly a third higher than the whole general-trade chain takes.",
          driver: "qcCommissionRate",
        },
        {
          term: "Trade promotion",
          plain:
            "Money you pay *into* a channel on top of its margin — listing fees, a visibility slot at the top of the search page, funding a 2-for-1 offer, a display in the aisle.",
          matters:
            "It is usually the largest line nobody owns. It comes out of the same rupee as your margin, and unlike advertising it is rarely measured for whether it created anything.",
          driver: "qcTradeSpendRate",
        },
        {
          term: "Net realisation",
          plain: "What actually reaches you from one pack after everything the channel takes.",
          formula: "MRP × (1 − channel margin − trade promotion)",
          matters:
            "The only price that matters to your P&L. A ₹60 pack realising ₹34.80 is a ₹34.80 product, whatever the label says.",
          driver: "qcRealisedPrice",
        },
        {
          term: "Contribution per pack",
          plain: "What one pack leaves behind after the channel's cut and the cost of making it.",
          formula: "net realisation − cost to make the pack",
          matters:
            "This is what pays for the factory, the team and the brand. Compare it across channels and the strategy usually names itself.",
          driver: "gtContributionPerPack",
        },
        {
          term: "Incrementality",
          plain:
            "Whether money you spent created sales that would not otherwise have happened.",
          matters:
            "A promotion that sells to people who were going to buy anyway is a discount, not a growth investment. The test is what happened where you did *not* spend.",
        },
        {
          term: "Cannibalisation",
          plain:
            "Sales a new channel takes from one of your own existing channels rather than from a competitor or from new demand.",
          matters:
            "It is invisible in the new channel's numbers, which always look excellent, and it is only ever visible in the total. Cannibalising into a channel that pays you less is the specific failure this simulation is about.",
        },
        {
          term: "Market share",
          plain: "Your share of everything the category sells in a channel.",
          formula: "your packs ÷ category packs",
          matters:
            "A useful diagnostic and a terrible target. Share can always be bought with trade promotion, so a rising share tells you nothing until you know what it cost.",
          driver: "qcMarketShare",
        },
      ],
      worked: [
        "A ₹60 pack in a kirana: 18% to the distributor and retailer, 3% to trade schemes — ₹47.40 reaches you. Take off the ₹26 it costs to make and you keep ₹21.40.",
        "The same ₹60 pack on quick commerce: 26% platform commission and 16% visibility and offer funding — ₹34.80 reaches you. Take off the same ₹26 and you keep ₹8.80.",
        "So 4.6 lakh packs on quick commerce earn about ₹40 lakh, and 12.4 lakh packs in kirana earn ₹2.65 crore. The channel with 2.7 times the volume earns six and a half times the money.",
        "Together that is ₹3.06 crore of contribution against ₹2.35 crore of fixed costs — ₹70.8 lakh a month, down from ₹1.12 crore a year ago.",
      ],
    },
  },

  northStar: "netContribution",
  reported: [
    "qcMarketShare",
    "qcPacks",
    "gtPacks",
    "qcContributionPerPack",
    "gtContributionPerPack",
    "totalContribution",
  ],
  drivers: [
    { id: "mrp", kind: "input", label: "MRP per pack", unit: "inr", goodDirection: "up", baseline: 60 },
    { id: "cogsPerPack", kind: "input", label: "Cost to make a pack", unit: "inr", goodDirection: "down", baseline: 26 },
    { id: "one", kind: "constant", label: "1", unit: "count", goodDirection: "up", value: 1 },

    // ── Quick commerce ────────────────────────────────────────────────────
    { id: "qcPacks", kind: "input", label: "Packs — quick commerce", unit: "count", goodDirection: "up", baseline: 460_000 },
    { id: "qcCommissionRate", kind: "input", label: "Platform commission", unit: "ratio", goodDirection: "down", baseline: 0.26 },
    { id: "qcTradeSpendRate", kind: "input", label: "Visibility & offer funding", unit: "ratio", goodDirection: "down", baseline: 0.16 },
    {
      id: "qcDeductionRate",
      kind: "sum",
      label: "Total deduction — quick commerce",
      unit: "ratio",
      goodDirection: "down",
      of: ["qcCommissionRate", "qcTradeSpendRate"],
    },
    {
      id: "qcRealisationRate",
      kind: "difference",
      label: "Share of MRP reaching us — QC",
      unit: "ratio",
      goodDirection: "up",
      minuend: "one",
      subtrahend: "qcDeductionRate",
    },
    { id: "qcRealisedPrice", kind: "product", label: "Realised price — QC", unit: "inr", goodDirection: "up", of: ["mrp", "qcRealisationRate"] },
    {
      id: "qcContributionPerPack",
      kind: "difference",
      label: "Contribution per pack — QC",
      unit: "inr",
      goodDirection: "up",
      minuend: "qcRealisedPrice",
      subtrahend: "cogsPerPack",
    },
    { id: "qcContribution", kind: "product", label: "Contribution — QC", unit: "inr", goodDirection: "up", of: ["qcPacks", "qcContributionPerPack"] },

    // ── General trade ─────────────────────────────────────────────────────
    { id: "gtPacks", kind: "input", label: "Packs — general trade", unit: "count", goodDirection: "up", baseline: 1_240_000 },
    { id: "gtChannelMarginRate", kind: "input", label: "Distributor & retailer margin", unit: "ratio", goodDirection: "down", baseline: 0.18 },
    { id: "gtTradeSpendRate", kind: "input", label: "Trade schemes", unit: "ratio", goodDirection: "down", baseline: 0.03 },
    {
      id: "gtDeductionRate",
      kind: "sum",
      label: "Total deduction — general trade",
      unit: "ratio",
      goodDirection: "down",
      of: ["gtChannelMarginRate", "gtTradeSpendRate"],
    },
    {
      id: "gtRealisationRate",
      kind: "difference",
      label: "Share of MRP reaching us — GT",
      unit: "ratio",
      goodDirection: "up",
      minuend: "one",
      subtrahend: "gtDeductionRate",
    },
    { id: "gtRealisedPrice", kind: "product", label: "Realised price — GT", unit: "inr", goodDirection: "up", of: ["mrp", "gtRealisationRate"] },
    {
      id: "gtContributionPerPack",
      kind: "difference",
      label: "Contribution per pack — GT",
      unit: "inr",
      goodDirection: "up",
      minuend: "gtRealisedPrice",
      subtrahend: "cogsPerPack",
    },
    { id: "gtContribution", kind: "product", label: "Contribution — GT", unit: "inr", goodDirection: "up", of: ["gtPacks", "gtContributionPerPack"] },

    // ── The totals, and the number everyone is watching instead ───────────
    { id: "totalContribution", kind: "sum", label: "Total contribution", unit: "inr", goodDirection: "up", of: ["qcContribution", "gtContribution"] },
    { id: "fixedCosts", kind: "input", label: "Fixed costs / month", unit: "inr", goodDirection: "down", baseline: 2.35 * CRORE },
    {
      id: "netContribution",
      kind: "difference",
      label: "Net contribution / month",
      unit: "inr",
      goodDirection: "up",
      minuend: "totalContribution",
      subtrahend: "fixedCosts",
    },
    { id: "qcCategoryPacks", kind: "input", label: "Category packs on quick commerce", unit: "count", goodDirection: "up", baseline: 4_000_000 },
    {
      id: "qcMarketShare",
      kind: "quotient",
      label: "Quick-commerce market share",
      unit: "ratio",
      goodDirection: "up",
      numerator: "qcPacks",
      denominator: "qcCategoryPacks",
    },
  ],

  dashboard: [
    {
      id: "p-ch-headline",
      kind: "stat",
      title: "This month",
      caption: "The first tile is on the founder's podcast. The last tile is not.",
      tiles: [
        { label: "Quick-commerce share", value: 0.115, unit: "ratio", deltaPct: 0.18, goodDirection: "up" },
        { label: "Packs sold", value: 1_700_000, unit: "count", deltaPct: 0.018, goodDirection: "up" },
        { label: "Consumer sales (MRP)", value: 10.2 * CRORE, unit: "inr", deltaPct: 0.018, goodDirection: "up" },
        { label: "Total contribution", value: 3.0584 * CRORE, unit: "inr", deltaPct: -0.09, goodDirection: "up" },
        { label: "Net contribution", value: 70.84 * LAKH, unit: "inr", deltaPct: -0.28, goodDirection: "up" },
      ],
    },
    {
      id: "p-ch-channels",
      kind: "segments",
      title: "Packs by channel — this month against a year ago",
      caption: "Quick commerce is five times the size it was. Total volume moved 1.8%.",
      dimension: "Channel",
      rows: [
        { label: "Quick commerce — a year ago", value: 90_000, unit: "count" },
        { label: "Quick commerce — now", value: 460_000, unit: "count", deltaPct: 4.11 },
        { label: "General trade — a year ago", value: 1_580_000, unit: "count" },
        { label: "General trade — now", value: 1_240_000, unit: "count", deltaPct: -0.215 },
      ],
    },
    {
      id: "p-ch-trend",
      kind: "timeseries",
      title: "Quick-commerce share and monthly net contribution",
      caption: "The two lines have moved in opposite directions for six months.",
      series: [
        {
          label: "Quick-commerce share",
          unit: "ratio",
          points: [
            { period: "M-5", value: 0.04 },
            { period: "M-4", value: 0.055 },
            { period: "M-3", value: 0.071 },
            { period: "M-2", value: 0.088 },
            { period: "M-1", value: 0.102 },
            { period: "M-0", value: 0.115 },
          ],
        },
        {
          label: "Net contribution (₹ crore)",
          unit: "inr_crore",
          points: [
            { period: "M-5", value: 1.12 },
            { period: "M-4", value: 1.04 },
            { period: "M-3", value: 0.96 },
            { period: "M-2", value: 0.87 },
            { period: "M-1", value: 0.79 },
            { period: "M-0", value: 0.708 },
          ],
        },
      ],
    },
    // ── Decoys ──────────────────────────────────────────────────────────
    //
    // Real instrumentation that answers a question nobody asked here. Brand
    // health being intact and wastage being flat are both worth knowing and
    // neither localises anything — which is the point: the candidate has to
    // rule them out rather than never meet them.
    {
      id: "p-ch-brand",
      kind: "stat",
      title: "Brand health tracker",
      caption: "The quarterly consumer panel, against the same quarter last year.",
      tiles: [
        { label: "Unprompted awareness", value: 0.41, unit: "ratio", goodDirection: "up" },
        { label: "Household penetration", value: 0.186, unit: "ratio", goodDirection: "up" },
        { label: "Would buy again", value: 0.78, unit: "ratio", goodDirection: "up" },
        { label: "Wastage as share of despatch", value: 0.012, unit: "ratio", goodDirection: "down" },
      ],
    },
    {
      id: "p-ch-supply",
      kind: "segments",
      title: "Despatch and fill rate by region",
      caption: "Whether we are simply failing to get stock onto shelves.",
      dimension: "Region",
      rows: [
        { label: "North", value: 0.972, unit: "ratio", deltaPct: 0.4 },
        { label: "West", value: 0.968, unit: "ratio", deltaPct: -0.3 },
        { label: "South", value: 0.981, unit: "ratio", deltaPct: 1.1 },
        { label: "East", value: 0.964, unit: "ratio", deltaPct: 0.2 },
      ],
    },
    {
      id: "p-ch-room",
      kind: "note",
      title: "What the room is saying",
      body:
        "Sales: we are the number two makhana brand on quick commerce and closing. Give me ₹18 lakh a month for the top slot and a 2+1 and we take 15% share by March. " +
        "Finance: our contribution per rupee of sales has fallen every month for six months. I want the quick-commerce listing pulled. " +
        "Supply chain: general-trade orders from our Bihar and eastern UP distributors are down badly, and they are asking why our pack is cheaper on an app than they can buy it for. " +
        "Founder: I do not want to be the brand that gave up on quick commerce.",
    },
  ],

  budget: { analystDays: 6, sprints: 3, rupees: 40 * LAKH },

  drilldowns: [
    {
      id: "dd-source",
      label: "Where the quick-commerce buyers came from",
      question: "Is this new demand, or the same shoppers arriving by a different route?",
      cost: 2,
      evidenceFor: ["channel.cannibal"],
      readsAs:
        "Two-thirds of quick-commerce buyers already bought the pack from a kirana. And where quick commerce went live first, our general-trade offtake fell 21% over the same period; in pincodes it has not reached, general trade is flat. This is not new demand — it is the same demand, moved to a channel that keeps more of it.",
      reveals: [
        {
          id: "p-ch-panel",
          kind: "segments",
          title: "Consumer panel — where our quick-commerce buyers were buying before",
          dimension: "Previous source",
          rows: [
            { label: "Bought our pack from a kirana", value: 0.68, unit: "ratio" },
            { label: "Bought a competitor's pack", value: 0.14, unit: "ratio" },
            { label: "New to the category", value: 0.18, unit: "ratio" },
          ],
        },
        {
          id: "p-ch-geo",
          kind: "note",
          title: "The test nobody ran on purpose",
          body:
            "Quick commerce reached our 42 largest pincodes first and the rest not at all — which makes an accidental control group. " +
            "In the 42 live pincodes, general-trade offtake is down 21% year on year. In the pincodes quick commerce has not reached, it is up 1%. " +
            "Same brand, same pack, same advertising, same year. The only difference is the channel.",
        },
      ],
    },
    {
      id: "dd-pnl",
      label: "What a ₹60 pack earns in each channel",
      question: "Are the two channels equally worth having?",
      cost: 2,
      evidenceFor: ["channel.cannibal"],
      readsAs:
        "The same pack contributes ₹21.40 in general trade and ₹8.80 on quick commerce, because 42 paise in the rupee goes to the platform before the makhana is paid for. Quick commerce has 27% of our volume and 13% of our contribution.",
      reveals: [
        {
          id: "p-ch-perpack",
          kind: "segments",
          title: "One ₹60 pack, followed to the bank",
          dimension: "Line",
          rows: [
            { label: "General trade — reaches us", value: 47.4, unit: "inr" },
            { label: "General trade — after the ₹26 cost", value: 21.4, unit: "inr" },
            { label: "Quick commerce — reaches us", value: 34.8, unit: "inr" },
            { label: "Quick commerce — after the ₹26 cost", value: 8.8, unit: "inr" },
          ],
        },
        {
          id: "p-ch-deductions",
          kind: "note",
          title: "Where the other 42% goes on quick commerce",
          body:
            "26% is platform commission — the price of being listed and picked. 16% is ours to control: ₹4.4 lakh a month on the top visibility slot in search, ₹2.9 lakh funding the 2+1 offer, and ₹0.5 lakh in listing and new-SKU fees. " +
            "In general trade the whole distributor and retailer chain takes 18%, plus 3% of trade schemes. " +
            "Nothing here is a platform being unreasonable. It is what the channel costs, and it has to be earned back before the first rupee of profit.",
        },
      ],
    },
    {
      id: "dd-gt-category",
      label: "Is general trade actually dying?",
      question: "Are we losing kirana volume, or is everybody?",
      cost: 2,
      evidenceFor: ["channel.gtdecline"],
      readsAs:
        "Kirana is not collapsing. The category grew 4% in general trade last year and our nearest competitor grew 6% in it. We are the only brand in the top five going backwards there — which means it is something we did, not something that happened to us.",
      reveals: [
        {
          id: "p-ch-gt",
          kind: "segments",
          title: "General-trade offtake, year on year",
          dimension: "Brand",
          rows: [
            { label: "Category (all brands)", value: 0.04, unit: "percent" },
            { label: "Nearest competitor", value: 0.06, unit: "percent" },
            { label: "Third and fourth brands", value: 0.02, unit: "percent" },
            { label: "Chaska", value: -0.215, unit: "percent" },
          ],
        },
        {
          id: "p-ch-gt-note",
          kind: "note",
          title: "From the eastern UP distributor call",
          body:
            "Three of our five largest distributors have cut their standing order. The reason each of them gives is the same: the 2+1 offer on the app puts our pack below what they buy it for, so the retailers who used to push it have stopped. " +
            "Two have taken on a competing brand in the space our pack used to hold.",
        },
      ],
    },
    {
      id: "dd-cogs",
      label: "Cost per pack, eighteen months",
      question: "Has it simply got dearer to make?",
      cost: 2,
      evidenceFor: ["value.cogs"],
      readsAs:
        "Cost per pack has moved from ₹25.40 to ₹26.00 in eighteen months — 2.4%, well under food inflation. Input cost is not what changed.",
      reveals: [
        {
          id: "p-ch-cogs",
          kind: "timeseries",
          title: "Fully loaded cost of one pack",
          series: [
            {
              label: "Cost per pack",
              unit: "inr",
              points: [
                { period: "18m ago", value: 25.4 },
                { period: "12m ago", value: 25.6 },
                { period: "6m ago", value: 25.9 },
                { period: "Now", value: 26.0 },
              ],
            },
          ],
        },
      ],
    },
    {
      id: "dd-price",
      label: "What happened last time we raised MRP",
      question: "Could we just charge more?",
      cost: 2,
      evidenceFor: ["value.mrp"],
      readsAs:
        "The last ₹55 to ₹60 move — 9% — cost about 15% of volume, so elasticity is roughly 1.7. A rise is worth having and it is worth a fraction of what the channel mix is costing: it adds about ₹4 lakh a month against the ₹40 lakh sitting in the mix.",
      reveals: [
        {
          id: "p-ch-price",
          kind: "segments",
          title: "The ₹55 → ₹60 move, fourteen months ago",
          dimension: "Effect",
          rows: [
            { label: "Price increase", value: 0.09, unit: "percent" },
            { label: "General-trade volume, month 2", value: -0.16, unit: "percent" },
            { label: "General-trade volume, settled", value: -0.15, unit: "percent" },
            { label: "Quick-commerce volume, settled", value: -0.14, unit: "percent" },
          ],
        },
      ],
    },
  ],

  causes: [
    {
      id: "channel",
      parentId: null,
      label: "Where the volume goes and what it earns there",
      verdict: "The right branch, and the whole answer is inside it.",
    },
    {
      id: "channel.cannibal",
      parentId: "channel",
      label: "Quick-commerce growth is coming out of our own kirana sales",
      verdict:
        "This was it. 68% of quick-commerce buyers already bought the pack from a kirana, and general-trade offtake fell 21% in exactly the pincodes quick commerce reached. The brand moved 3.4 lakh packs a month from a channel paying ₹21.40 to one paying ₹8.80, and paid for the privilege.",
    },
    {
      id: "channel.gtdecline",
      parentId: "channel",
      label: "Kirana is structurally declining, so the shift is inevitable",
      verdict:
        "Not supported. General trade grew 4% for the category and 6% for our nearest competitor. We are the only brand in the top five losing volume there, and our own distributors say why: the app offer undercuts what they pay.",
    },
    {
      id: "value",
      parentId: null,
      label: "What one pack is worth to us",
      verdict: "Both branches here check out clean, which is what makes the mix the answer.",
    },
    {
      id: "value.cogs",
      parentId: "value",
      label: "The pack costs more to make than it used to",
      verdict:
        "Not supported. Cost per pack moved 2.4% in eighteen months, from ₹25.40 to ₹26.00. Worth attacking on its own merits, but it is not what changed.",
    },
    {
      id: "value.mrp",
      parentId: "value",
      label: "We have not raised MRP while everything else got dearer",
      verdict:
        "Not supported as the cause. Elasticity of about 1.7 means a ₹5 rise nets roughly ₹4 lakh a month — real money, and about a tenth of what the channel mix is costing.",
    },
    {
      id: "value.wastage",
      parentId: "value",
      label: "Returns and near-expiry stock are eating the margin",
      verdict:
        "No. Wastage runs at 1.2% of despatch, flat for six quarters, and quick commerce actually returns less than general trade because the stock moves faster. A steady line cannot explain a change.",
    },
    { id: "demand", parentId: null, label: "Whether people still want the product", verdict: "They do. Every branch here comes back clean, which is what leaves the channel." },
    {
      id: "demand.competitor",
      parentId: "demand",
      label: "A competitor is taking our customers",
      verdict:
        "Not in the way it looks. Our nearest competitor grew 6% in general trade — in the same channel we shrank 21%. Somebody taking share from us everywhere would not spare the channel where we still have display.",
    },
    {
      id: "demand.brand",
      parentId: "demand",
      label: "The brand has weakened with shoppers",
      verdict:
        "No. Unprompted awareness is 41% against 40% last year and household penetration is flat. People still ask for us — they are just being sold to us somewhere that keeps less of the money.",
    },
  ],
  trueCauseIds: ["channel.cannibal"],

  interventions: [
    {
      id: "iv-rebalance",
      label: "Stop buying the share",
      pitch:
        "Cut quick-commerce visibility and offer funding to a maintenance level, end the 2+1, and hold the listing. Accept that share falls back, and put the released money behind the kirana trade calendar.",
      addresses: "channel.cannibal",
      cost: { sprints: 2, rupees: 24 * LAKH },
      minSprints: 2,
      effects: {
        whenRootCause: [
          { driver: "qcTradeSpendRate", deltaPct: -0.55 },
          { driver: "qcPacks", deltaPct: -0.25 },
          { driver: "gtPacks", deltaPct: 0.08 },
        ],
        otherwise: [
          { driver: "qcTradeSpendRate", deltaPct: -0.55 },
          { driver: "qcPacks", deltaPct: -0.25 },
        ],
      },
      debrief:
        "The answer, and it costs you the number the founder was proud of: quick-commerce share falls from 11.5% to about 8.6%. Contribution per pack there goes from ₹8.80 to ₹14.08, the shoppers who wanted the pack mostly still buy it, and most of the volume that leaves comes back through the kirana at ₹21.40.",
    },
    {
      id: "iv-gt-reach",
      label: "Add 8,000 kirana outlets where quick commerce doesn't reach",
      pitch:
        "The 18% of quick-commerce buyers who were new to the category are the only genuinely incremental volume you found. Go and get more of that — in the towns no ten-minute delivery will serve for years.",
      addresses: "channel.cannibal",
      cost: { sprints: 1, rupees: 16 * LAKH },
      effects: {
        whenRootCause: [{ driver: "gtPacks", deltaPct: 0.09 }],
        otherwise: [{ driver: "gtPacks", deltaPct: 0.04 }],
      },
      debrief:
        "The growth half of the answer. Distribution in unserved towns is the one lever here that adds packs rather than moving them, and each of those packs arrives at ₹21.40 rather than ₹8.80.",
    },
    {
      id: "iv-double-down",
      label: "Buy the top slot and fund a 2+1",
      pitch:
        "Sales' proposal. We are second and closing. ₹18 lakh a month takes the top visibility slot in every dark store and funds a 2+1 — share past 15% by March.",
      addresses: "channel.gtdecline",
      cost: { sprints: 1, rupees: 18 * LAKH },
      effects: {
        whenRootCause: [
          { driver: "qcPacks", deltaPct: 0.35 },
          { driver: "qcTradeSpendRate", deltaPct: 0.4 },
        ],
        otherwise: [
          { driver: "qcPacks", deltaPct: 0.35 },
          { driver: "qcTradeSpendRate", deltaPct: 0.4 },
          { driver: "gtPacks", deltaPct: -0.12 },
        ],
      },
      debrief:
        "It delivers the share. Quick-commerce share goes past 15% and quick-commerce volume up 35% — and deduction goes from 42% to 48%, contribution per pack from ₹8.80 to ₹4.96, and another 12% of kirana volume walks because the offer undercuts what the distributor pays. Bought share, at a price you can read off the P&L.",
    },
    {
      id: "iv-mrp",
      label: "Take MRP from ₹60 to ₹65",
      pitch:
        "We have held ₹60 for fourteen months while everything went up. A ₹5 rise across both channels goes straight to the bottom line.",
      addresses: "value.mrp",
      cost: { sprints: 1, rupees: 6 * LAKH },
      effects: {
        whenRootCause: [
          { driver: "mrp", deltaPct: 0.0833 },
          { driver: "qcPacks", deltaPct: -0.06 },
          { driver: "gtPacks", deltaPct: -0.07 },
        ],
        otherwise: [
          { driver: "mrp", deltaPct: 0.0833 },
          { driver: "qcPacks", deltaPct: -0.15 },
          { driver: "gtPacks", deltaPct: -0.16 },
        ],
      },
      debrief:
        "Genuinely profitable and genuinely small. At an elasticity of about 1.7 the ₹5 buys roughly ₹4 lakh a month once volume settles — worth doing, and about a tenth of what was sitting in the channel mix. Fixing the mix does not stop you doing this next quarter.",
    },
    {
      id: "iv-cogs",
      label: "Re-negotiate makhana sourcing and lighten the laminate",
      pitch:
        "Direct contracts with the Bihar cooperatives and a thinner pack film. At ₹8.80 of contribution on quick commerce, every rupee out of cost is worth more than a rupee of sales.",
      addresses: "value.cogs",
      cost: { sprints: 1, rupees: 9 * LAKH },
      effects: {
        whenRootCause: [{ driver: "cogsPerPack", deltaPct: -0.06 }],
        otherwise: [
          { driver: "cogsPerPack", deltaPct: -0.03 },
          { driver: "qcPacks", deltaPct: -0.02 },
          { driver: "gtPacks", deltaPct: -0.02 },
        ],
      },
      debrief:
        "The pitch is right that cost is leveraged here — and cost was never what moved. A 3% saving on a ₹26 pack is about ₹7 lakh a month, partly given back because the lighter laminate costs a little repeat. Good housekeeping, not a strategy.",
    },
  ],

  // Platforms raise their take and their ad rates every cycle, and the kirana
  // base keeps eroding while the offer undercuts it. Nothing here is free to
  // ignore.
  drift: [
    { driver: "qcCommissionRate", deltaPct: 0.05 },
    { driver: "qcTradeSpendRate", deltaPct: 0.06 },
    { driver: "gtPacks", deltaPct: -0.02 },
  ],
  horizonQuarters: 2,

  parInvestigation: ["dd-source", "dd-pnl"],
  bestAllocation: [
    { interventionId: "iv-rebalance", sprints: 2, rupees: 24 * LAKH },
    { interventionId: "iv-gt-reach", sprints: 1, rupees: 16 * LAKH },
  ],

  debrief: {
    causalChain: [
      "A ₹60 pack realises ₹47.40 in a kirana and ₹34.80 on quick commerce, because the platform takes 26% in commission and we hand back another 16% in visibility and offer funding.",
      "Against the same ₹26 of cost, that is ₹21.40 of contribution a pack against ₹8.80 — the same pack is worth 2.4 times as much through the older channel.",
      "68% of our quick-commerce buyers were already buying the pack from a kirana, and only 18% were new to the category.",
      "In the 42 pincodes quick commerce reached, our general-trade offtake fell 21%; in the pincodes it has not reached, it rose 1%.",
      "So quick-commerce share rose from 4% to 11.5% while total volume moved 1.8% — 3.4 lakh packs a month changed channel rather than being won.",
      "Every one of those packs lost ₹12.60 of contribution on the way — ₹42.8 lakh a month moved out of the P&L, against ₹2.6 lakh brought in by the 0.3 lakh packs that were genuinely new. That is the ₹41 lakh that has come off the bottom line.",
    ],
    whereTheLeverageWas:
      "The 16% you control. Platform commission is the price of the channel and you cannot argue with it; visibility and offer funding is yours, and it was buying volume you already had. Cutting it back gives up about three points of share and takes contribution per pack on quick commerce from ₹8.80 to ₹14.08 — and the kirana volume it was suppressing comes back at ₹21.40.",
    strongAnswer: [
      "The share number and the profit number are both correct — they are measuring different things.",
      "Share went from 4% to 11.5%, but total volume moved only 1.8%. That gap is the whole finding.",
      "We did not win 3.4 lakh packs a month. We moved them from one shelf to another.",
      "The evidence is strong: 68% of quick-commerce buyers already bought us from a corner shop.",
      "And the pincode split is almost an experiment — corner-shop sales fell 21% where quick commerce is live, and rose 1% where it isn't.",
      "Moving a pack costs us ₹12.60. On a ₹60 pack we keep ₹34.80 through quick commerce against ₹47.40 through the corner shop.",
      "That is the platform's 26% cut plus the 16% we ourselves spend on prime placement and offers.",
      "So: cut our own visibility and offer spend back to a maintenance level, and keep the listing — the 18% who are genuinely new to the category are worth serving.",
      "Move that money to 8,000 corner-shop outlets in towns quick commerce will not reach for years.",
      "That costs about three points of quick-commerce share, and I would tell the board so in those words — because the alternative is to keep buying a number at ₹12.60 a pack.",
    ],
  },

  coachFallback: [
    {
      topic: ["cannibal", "moved", "shift", "kirana", "general trade", "pincode"],
      answer: [
        "The growth was not new business — it was the same customers buying somewhere else.",
        "68% of quick-commerce buyers already bought us from a corner shop, and corner-shop sales fell 21% in exactly the pincodes quick commerce reached, while rising 1% where it did not.",
        "Share rose seven points. Total volume moved 1.8%.",
      ],
    },
    {
      topic: ["realisation", "deduction", "commission", "platform", "42%", "34.80"],
      answer: [
        "On a ₹60 pack we keep ₹34.80 through quick commerce: the platform takes 26%, and we spend another 16% on placement and offers.",
        "Through the corner shop we keep ₹47.40, because the whole trade chain takes 21%.",
        "The pack costs the same ₹26 to make either way — so we earn ₹8.80 there against ₹21.40 here.",
      ],
    },
    {
      topic: ["trade promotion", "trade spend", "visibility", "slot", "2+1", "offer"],
      answer: [
        "The 16% is the part you control: ₹4.4 lakh a month for the top search slot, ₹2.9 lakh funding the buy-two-get-one, ₹0.5 lakh in listing fees.",
        "It was buying volume that was already yours.",
        "And the buy-two-get-one was undercutting the price your own distributors pay.",
      ],
    },
    {
      topic: ["incremental", "incrementality", "new demand", "18%"],
      answer: [
        "Only 18% of quick-commerce buyers were new to the category.",
        "That part is genuinely new business, and it is worth serving.",
        "The other 82% was volume you already had, moved to a channel that hands back twice as much of it.",
      ],
    },
    {
      topic: ["share", "market share", "number one", "15%"],
      answer: [
        "Share can always be bought with promotion money, which is exactly what makes it a bad target.",
        "Doubling down takes share past 15% and takes what we keep per pack from ₹8.80 to ₹4.96.",
        "The right answer gives up about three points of share and grows total profit by roughly three-quarters.",
      ],
    },
    {
      topic: ["decline", "dying", "structural", "competitor"],
      answer: [
        "Corner shops are not dying. The category grew 4% there, and our nearest competitor grew 6%.",
        "We are the only brand in the top five going backwards in that channel.",
        "That makes it something we did, not something that happened to us.",
      ],
    },
    {
      topic: ["cogs", "cost", "sourcing", "laminate", "input"],
      answer: [
        "The cost of making a pack moved 2.4% in eighteen months — ₹25.40 to ₹26.00.",
        "Attacking it is worth about ₹7 lakh a month, and it is good housekeeping.",
        "But it is not what changed, so it cannot be the cause.",
      ],
    },
    {
      topic: ["mrp", "price", "raise", "elasticity", "65"],
      answer: [
        "The last ₹5 rise cost about 15% of volume, so customers here are fairly price-sensitive.",
        "Another ₹5 nets about ₹4 lakh a month — real money, and roughly a tenth of what the channel mix is costing us.",
        "Fix the mix first. The price rise still works next quarter.",
      ],
    },
  ],
};
