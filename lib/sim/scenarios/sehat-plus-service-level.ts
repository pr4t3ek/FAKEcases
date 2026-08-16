/**
 * "87% fill rate, and 24% more stock than we have ever held."
 *
 * The supply-chain war room. Teaches fill rate, service level, safety stock,
 * coefficient of variation, inventory turns and the cost of a stockout — and the
 * one idea that ties them together: **a service level is a promise about a
 * single item, and averaging it across unlike items destroys the information it
 * carried.**
 *
 * ── The truth, for whoever maintains this ─────────────────────────────────
 *
 * A national rule says hold 14 days of average demand as safety stock. It is
 * applied to every SKU in the range, and the range contains two completely
 * different kinds of demand.
 *
 * Chronic medicines — diabetes, blood pressure, thyroid — are refills on a
 * schedule. Demand barely moves: a coefficient of variation of 0.14. Fourteen
 * days of average demand is roughly six standard deviations of cover, so these
 * lines sit at 98.2% availability and are enormously overstocked.
 *
 * Acute and seasonal lines — antibiotics, antipyretics, anti-allergics, the
 * monsoon respiratory range — move with the weather and the local infection
 * load, at a coefficient of variation of 0.71. The same fourteen days is barely
 * one standard deviation, so these run at 71.2% and stock out constantly. They
 * are 40% of demand and 91% of the lost sales.
 *
 * Blended, that is 87.4% availability against a promise of 96%, sitting on ₹31.2
 * crore of stock turning 9.5 times a year — which is a perfectly respectable
 * aggregate. **Every number a head office looks at is fine.** The failure is
 * entirely in a distribution that no aggregate can show.
 *
 * The chain has already pulled the obvious lever once: safety stock went from 11
 * days to 14 a year ago, inventory rose 24%, and blended fill rate moved from
 * 88.1% to 87.4%. That is in the opening dashboard, and it is the single most
 * useful fact on it — the experiment has already been run.
 *
 * ── Balance notes ─────────────────────────────────────────────────────────
 *
 * `iv-blanket-safety` is the sharpest trap and it must stay genuinely
 * attractive: raising cover everywhere really does lift fill rate, because more
 * stock really is more stock. It keeps most of its effect through an `otherwise`
 * override, since that is inventory arithmetic rather than a bet on a
 * hypothesis. It buys 6.1 points of acute availability and 2.7 points of blended
 * fill rate — the number everybody in the chain is measured on — with ₹6.5 crore
 * of extra working capital, and that leaves contribution slightly *worse* than
 * doing nothing. The segmented policy buys 27 points of acute availability while
 * releasing ₹4.3 crore of stock. A trap that visibly moves the reported metric
 * and quietly loses money is the most instructive kind there is.
 *
 * `iv-leadtime-deal` is the second trap, and the data has to indict it fairly.
 * Lead time genuinely went from 6 days to 8, which everybody has noticed. It
 * went from 6 to 8 on the chronic lines *and* the acute lines — identically —
 * so it cannot explain why one group holds 98% and the other 71%. A cause that
 * moved equally across both sides of a split cannot be what created the split.
 *
 * `tests/sim-scenario.test.ts` brute-forces every affordable combination and
 * `scripts/best-allocation.ts` re-derives the ceiling, so a retune that lets
 * either trap win fails the suite rather than the student.
 */

import type { SimScenario } from "../types";

const CRORE = 10_000_000;

export const sehatPlusServiceLevel: SimScenario = {
  slug: "sehat-plus-service-level",
  title: "Sehat Plus: 87% availability on 24% more stock",
  company: "Sehat Plus",
  premise:
    "A 240-store pharmacy chain promises 96% availability, holds more inventory than it ever has, and delivers 87%. The obvious fix has already been tried once. Work out what the average is hiding.",
  situation:
    "You are the supply-chain lead at Sehat Plus, a 240-store pharmacy chain across Maharashtra and Gujarat. " +
    "The chain promises customers 96% availability and is delivering 87.4%. Inventory is ₹31.2 crore — 24% more than a year ago — because safety stock was raised from 11 days to 14 the last time this came up. Fill rate did not improve; it fell slightly. " +
    "The CFO has been asked to release ₹6 crore of working capital by the end of the year and is looking at your stockroom. The head of purchase wants to raise cover to 21 days. The operations director thinks it is the distributors, whose lead times have gone from 6 days to 8. " +
    "You have 6 analyst-days to work out what is actually happening, then 4 people-weeks and ₹4 crore to fix it.",
  difficulty: "Medium",
  /**
   * On the saturating engine. Money buys a response curve rather than a straight
   * line and reaches the P&L through `opex`, which matters more here than
   * usual: three of the six levers are things you can simply buy more of, and
   * without a bill the correct answer would be to buy all of them.
   */
  engine: "v2",
  periodNoun: "quarter",

  // ── Teaching ────────────────────────────────────────────────────────────
  teaching: {
    /**
     * On, unlike `b2b-deal-tco`. The shape of this model is not the answer —
     * everybody in the room already knows that stock costs money and stockouts
     * cost sales. What has to be discovered is a *distribution*, and no metric
     * map can show one, because a map shows how the quantities relate and the
     * finding is that one of them means two different things.
     */
    showMetricMap: true,
    primer: {
      intro:
        "Inventory is a bet against uncertainty. You hold stock you do not yet need because you do not know exactly when you will need it, and every rupee of that bet costs something to carry. The vocabulary below is how supply-chain people size the bet — the first few describe how well you are serving customers, the middle few describe what you are holding to do it, and the last two are what it costs when you get either one wrong.",
      terms: [
        {
          term: "Fill rate",
          plain: "The share of what customers asked for that you were actually able to sell them.",
          formula: "units sold ÷ units demanded",
          matters:
            "It is the customer's experience of your supply chain, and the only availability number they can feel. A pharmacy that is out of stock has not delayed a sale — a patient with a prescription walks next door.",
          driver: "blendedFillRate",
        },
        {
          term: "Service level",
          plain:
            "The availability you have decided to promise on an item — the odds you are willing to run of being out.",
          matters:
            "It is a decision, not a measurement, and it is a decision *per item*. A single service level applied to a whole range is really a bet that every item behaves the same way, which is almost never true.",
        },
        {
          term: "Safety stock",
          plain:
            "The extra stock you hold on top of what you expect to sell, to absorb demand being higher than the forecast.",
          formula: "roughly: (how uncertain demand is) × (how long resupply takes)",
          matters:
            "How much you need depends on how *variable* the item is, not on how much of it you sell. Sizing it in days of average demand quietly assumes the two are the same thing.",
          driver: "acuteSafetyDays",
        },
        {
          term: "Cycle stock",
          plain: "The stock you hold simply because deliveries arrive in batches rather than continuously.",
          matters:
            "It is set by how often you reorder and how long resupply takes, and it has nothing to do with uncertainty. Cutting lead time reduces this; it does very little for safety stock.",
          driver: "cycleDays",
        },
        {
          term: "Coefficient of variation",
          full: "CV",
          plain:
            "How jumpy an item's demand is, relative to its own average. A CV of 0.1 is a metronome; a CV of 0.7 is weather.",
          formula: "standard deviation of demand ÷ average demand",
          matters:
            "This is the number that should be setting safety stock, and it is the one nobody looks at. Two items selling exactly the same volume can need completely different cover, and this is what tells you so.",
          driver: "acuteCv",
        },
        {
          term: "Lead time",
          plain: "How long it takes for stock to arrive after you order it.",
          matters:
            "Longer lead times mean more of both kinds of stock, because you are covering a longer window. It is a real cost and a favourite culprit — check whether it moved differently across the items that are failing and the ones that are not.",
          driver: "leadTimeDays",
        },
        {
          term: "Inventory turns",
          plain: "How many times a year you sell through your average stockholding.",
          formula: "annual cost of goods sold ÷ inventory value",
          matters:
            "The headline efficiency measure, and an aggregate — so it averages your best-behaved items with your worst. Healthy turns are perfectly compatible with half your range being wrong.",
          driver: "inventoryTurns",
        },
        {
          term: "Stockout cost",
          plain: "What being out of an item actually costs you, beyond the sale you did not make.",
          matters:
            "In pharmacy it is larger than it looks. A missed acute sale is a walk-out; a missed chronic refill is often a patient who moves their standing repeat somewhere more reliable, and takes twelve months of purchases with them.",
          driver: "lostSalesValue",
        },
        {
          term: "Holding cost",
          plain:
            "What it costs to keep stock on a shelf for a year — the money tied up in it, plus expiry, damage and shrinkage.",
          formula: "inventory value × holding rate",
          matters:
            "About 28% a year here, and pharmacy is at the painful end of that: stock does not just tie up cash, it expires. That is the number the CFO is really asking you about.",
          driver: "holdingCost",
        },
        {
          term: "Contribution",
          plain: "Gross profit less what it costs to hold the stock and run the stores.",
          matters:
            "The number this run is judged on, and the only one that sees availability and inventory at the same time. Either one alone can be improved by wrecking the other.",
          driver: "contribution",
        },
      ],
      worked: [
        "Demand is ₹108 crore a quarter: ₹64.8 crore of chronic refills and ₹43.2 crore of acute and seasonal lines.",
        "Chronic availability is 98.2%, so ₹63.63 crore of it sells. Acute availability is 71.2%, so ₹30.76 crore of that sells.",
        "Blended, ₹94.39 crore of ₹108 crore — 87.4%. The promise is 96%, and ₹13.61 crore a quarter walks out of the door unserved.",
        "Every SKU carries 14 days of safety stock plus 12 days of cycle stock: 26 days of cover on ₹1.2 crore a day of demand, which is ₹31.2 crore of inventory.",
        "That inventory turns 9.5 times a year and costs 28% a year to carry — ₹2.18 crore a quarter in capital, expiry and shrinkage.",
        "Gross profit is ₹20.09 crore, less ₹2.18 crore of holding and ₹16.2 crore of store operating cost: ₹1.70 crore a quarter.",
        "And the split that none of those numbers shows: chronic demand has a coefficient of variation of 0.14, acute has 0.71. Fourteen days is six standard deviations of cover for one of them and barely one for the other.",
      ],
    },
  },

  // ── The model ───────────────────────────────────────────────────────────
  northStar: "contribution",
  reported: [
    "blendedFillRate",
    "acuteFillRate",
    "inventoryValue",
    "inventoryTurns",
    "lostSalesValue",
    "holdingCost",
    "grossProfit",
  ],
  drivers: [
    // ── Demand, in two halves that head office reports as one ─────────────
    { id: "chronicDemandValue", kind: "input", label: "Chronic demand / quarter", unit: "inr", goodDirection: "up", baseline: 64.8 * CRORE },
    { id: "acuteDemandValue", kind: "input", label: "Acute and seasonal demand / quarter", unit: "inr", goodDirection: "up", baseline: 43.2 * CRORE },
    { id: "totalDemandValue", kind: "sum", label: "Total demand / quarter", unit: "inr", goodDirection: "up", of: ["chronicDemandValue", "acuteDemandValue"] },

    /**
     * The two availabilities, and the whole scenario.
     *
     * Inputs rather than something derived from safety stock and variability,
     * because the relationship between them is a normal loss function and the
     * driver graph cannot express one. What the graph carries instead is the
     * consequence — and what the interventions carry is the fact that the same
     * extra day of cover buys almost nothing on one of these and a great deal on
     * the other. That asymmetry is the lesson, and it lives where a student can
     * see it: in what each fix does.
     */
    { id: "chronicFillRate", kind: "input", label: "Chronic fill rate", unit: "ratio", goodDirection: "up", baseline: 0.982 },
    { id: "acuteFillRate", kind: "input", label: "Acute fill rate", unit: "ratio", goodDirection: "up", baseline: 0.712 },
    // Never read by the projection — carried so the metric map and the primer can
    // name the number that should have been setting the policy all along.
    { id: "chronicCv", kind: "input", label: "Chronic demand variability (CV)", unit: "ratio", goodDirection: "down", baseline: 0.14 },
    { id: "acuteCv", kind: "input", label: "Acute demand variability (CV)", unit: "ratio", goodDirection: "down", baseline: 0.71 },

    { id: "chronicSales", kind: "product", label: "Chronic sales", unit: "inr", goodDirection: "up", of: ["chronicDemandValue", "chronicFillRate"] },
    { id: "acuteSales", kind: "product", label: "Acute sales", unit: "inr", goodDirection: "up", of: ["acuteDemandValue", "acuteFillRate"] },
    { id: "totalSales", kind: "sum", label: "Sales / quarter", unit: "inr", goodDirection: "up", of: ["chronicSales", "acuteSales"] },
    {
      id: "blendedFillRate",
      kind: "quotient",
      label: "Fill rate (blended)",
      unit: "ratio",
      goodDirection: "up",
      numerator: "totalSales",
      denominator: "totalDemandValue",
    },
    {
      id: "lostSalesValue",
      kind: "difference",
      label: "Demand we could not serve",
      unit: "inr",
      goodDirection: "down",
      minuend: "totalDemandValue",
      subtrahend: "totalSales",
    },

    { id: "chronicMarginRate", kind: "input", label: "Chronic gross margin", unit: "ratio", goodDirection: "up", baseline: 0.19 },
    { id: "acuteMarginRate", kind: "input", label: "Acute gross margin", unit: "ratio", goodDirection: "up", baseline: 0.26 },
    { id: "chronicGrossProfit", kind: "product", label: "Chronic gross profit", unit: "inr", goodDirection: "up", of: ["chronicSales", "chronicMarginRate"] },
    { id: "acuteGrossProfit", kind: "product", label: "Acute gross profit", unit: "inr", goodDirection: "up", of: ["acuteSales", "acuteMarginRate"] },
    { id: "grossProfit", kind: "sum", label: "Gross profit / quarter", unit: "inr", goodDirection: "up", of: ["chronicGrossProfit", "acuteGrossProfit"] },

    // ── What we hold, and why ─────────────────────────────────────────────
    { id: "leadTimeDays", kind: "input", label: "Supplier lead time", unit: "days", goodDirection: "down", baseline: 8 },
    { id: "cycleDays", kind: "input", label: "Cycle stock cover", unit: "days", goodDirection: "down", baseline: 12 },
    // The national rule, applied to both halves of a range that behaves nothing
    // alike. Two inputs rather than one so a policy can stop being national.
    { id: "chronicSafetyDays", kind: "input", label: "Chronic safety stock", unit: "days", goodDirection: "up", baseline: 14 },
    { id: "acuteSafetyDays", kind: "input", label: "Acute safety stock", unit: "days", goodDirection: "up", baseline: 14 },
    { id: "chronicCoverDays", kind: "sum", label: "Chronic days of cover", unit: "days", goodDirection: "up", of: ["chronicSafetyDays", "cycleDays"] },
    { id: "acuteCoverDays", kind: "sum", label: "Acute days of cover", unit: "days", goodDirection: "up", of: ["acuteSafetyDays", "cycleDays"] },

    { id: "daysInQuarter", kind: "constant", label: "Days in a quarter", unit: "days", goodDirection: "up", value: 90 },
    { id: "chronicDailyDemand", kind: "quotient", label: "Chronic demand / day", unit: "inr", goodDirection: "up", numerator: "chronicDemandValue", denominator: "daysInQuarter" },
    { id: "acuteDailyDemand", kind: "quotient", label: "Acute demand / day", unit: "inr", goodDirection: "up", numerator: "acuteDemandValue", denominator: "daysInQuarter" },
    { id: "chronicStock", kind: "product", label: "Chronic inventory", unit: "inr", goodDirection: "down", of: ["chronicDailyDemand", "chronicCoverDays"] },
    { id: "acuteStock", kind: "product", label: "Acute inventory", unit: "inr", goodDirection: "down", of: ["acuteDailyDemand", "acuteCoverDays"] },
    { id: "inventoryValue", kind: "sum", label: "Inventory", unit: "inr", goodDirection: "down", of: ["chronicStock", "acuteStock"] },

    { id: "holdingRate", kind: "input", label: "Holding cost rate / quarter", unit: "ratio", goodDirection: "down", baseline: 0.07 },
    { id: "holdingCost", kind: "product", label: "Holding cost / quarter", unit: "inr", goodDirection: "down", of: ["inventoryValue", "holdingRate"] },

    { id: "cogs", kind: "difference", label: "Cost of goods sold / quarter", unit: "inr", goodDirection: "down", minuend: "totalSales", subtrahend: "grossProfit" },
    { id: "quartersInYear", kind: "constant", label: "Quarters in a year", unit: "count", goodDirection: "up", value: 4 },
    { id: "annualCogs", kind: "product", label: "Annual cost of goods sold", unit: "inr", goodDirection: "up", of: ["cogs", "quartersInYear"] },
    // The aggregate that looks perfectly healthy while half the range is wrong.
    { id: "inventoryTurns", kind: "quotient", label: "Inventory turns", unit: "multiple", goodDirection: "up", numerator: "annualCogs", denominator: "inventoryValue" },

    /**
     * Running 240 stores, and the driver the committed budget inflates (see
     * `spend`). Without it the money is free inside the model and funding every
     * lever at once is never a mistake — which would be a strange thing for a
     * scenario about the cost of holding too much of everything to teach.
     */
    { id: "opex", kind: "input", label: "Store and warehouse operating cost / quarter", unit: "inr", goodDirection: "down", baseline: 16.2 * CRORE },
    { id: "totalCost", kind: "sum", label: "Holding and operating cost", unit: "inr", goodDirection: "down", of: ["holdingCost", "opex"] },
    {
      id: "contribution",
      kind: "difference",
      label: "Contribution / quarter",
      unit: "inr",
      goodDirection: "up",
      minuend: "grossProfit",
      subtrahend: "totalCost",
    },
  ],

  // ── The free dashboard ──────────────────────────────────────────────────
  dashboard: [
    {
      id: "p-sp-headline",
      kind: "stat",
      title: "The quarter, as the board pack shows it",
      caption: "Nothing on this row is wrong, and nothing on it is the answer.",
      tiles: [
        { label: "Fill rate", value: 0.874, unit: "ratio", deltaPct: -0.008, goodDirection: "up" },
        { label: "Promised availability", value: 0.96, unit: "ratio", goodDirection: "up" },
        { label: "Inventory", value: 31.2, unit: "inr_crore", deltaPct: 0.24, goodDirection: "down" },
        { label: "Inventory turns", value: 9.5, unit: "multiple", deltaPct: -0.18, goodDirection: "up" },
        { label: "Demand we could not serve", value: 13.61, unit: "inr_crore", goodDirection: "down" },
        { label: "Contribution", value: 1.7, unit: "inr_crore", deltaPct: -0.29, goodDirection: "up" },
      ],
    },
    {
      id: "p-sp-experiment",
      kind: "timeseries",
      title: "Safety stock, inventory and fill rate, eight quarters",
      caption:
        "Cover went from 11 days to 14 in Q-4. This is the most useful chart on the board: the obvious experiment has already been run.",
      series: [
        {
          label: "Safety stock (days)",
          unit: "days",
          points: [
            { period: "Q-7", value: 11 },
            { period: "Q-5", value: 11 },
            { period: "Q-4", value: 14 },
            { period: "Q-2", value: 14 },
            { period: "Q-0", value: 14 },
          ],
        },
        {
          label: "Inventory (₹ cr)",
          unit: "inr_crore",
          points: [
            { period: "Q-7", value: 25.1 },
            { period: "Q-5", value: 25.2 },
            { period: "Q-4", value: 28.9 },
            { period: "Q-2", value: 30.6 },
            { period: "Q-0", value: 31.2 },
          ],
        },
        {
          label: "Fill rate (%)",
          unit: "percent",
          points: [
            { period: "Q-7", value: 88.4 },
            { period: "Q-5", value: 88.1 },
            { period: "Q-4", value: 88.6 },
            { period: "Q-2", value: 87.9 },
            { period: "Q-0", value: 87.4 },
          ],
        },
      ],
    },
    {
      id: "p-sp-lost",
      kind: "segments",
      title: "Where the unserved demand is, by store format",
      caption:
        "₹13.61 crore of demand a quarter that walked out. Cut by the dimension the weekly review uses.",
      dimension: "Store format",
      rows: [
        { label: "High street", value: 5.72, unit: "inr_crore", deltaPct: 0.11 },
        { label: "Hospital-adjacent", value: 4.31, unit: "inr_crore", deltaPct: 0.14 },
        { label: "Residential", value: 2.48, unit: "inr_crore", deltaPct: 0.09 },
        { label: "Mall", value: 1.1, unit: "inr_crore", deltaPct: 0.12 },
      ],
    },
    // ── Decoys ──────────────────────────────────────────────────────────
    //
    // Both true, both correctly derived, and both off the causal path. The
    // warehouse scorecard in particular is the kind of panel that absorbs a
    // whole meeting: every number on it is good, which is exactly why it cannot
    // explain a number that is bad.
    {
      id: "p-sp-warehouse",
      kind: "stat",
      title: "Distribution centre scorecard",
      caption: "The two regional warehouses, same quarter.",
      tiles: [
        { label: "Orders picked accurately", value: 0.996, unit: "ratio", goodDirection: "up" },
        { label: "Store deliveries on time", value: 0.973, unit: "ratio", goodDirection: "up" },
        { label: "Cost per line picked", value: 4.2, unit: "inr", deltaPct: -0.06, goodDirection: "down" },
        { label: "Warehouse stock accuracy", value: 0.991, unit: "ratio", goodDirection: "up" },
      ],
    },
    {
      id: "p-sp-basket",
      kind: "segments",
      title: "Basket and footfall, year on year",
      caption: "The commercial side of the same stores.",
      dimension: "Measure",
      rows: [
        { label: "Footfall per store per day", value: 214, unit: "count", deltaPct: 0.04 },
        { label: "Average basket (₹)", value: 486, unit: "inr", deltaPct: 0.07 },
        { label: "Prescriptions dispensed per day", value: 96, unit: "count", deltaPct: 0.03 },
        { label: "Loyalty members active", value: 0.61, unit: "ratio", deltaPct: 0.05 },
      ],
    },
    {
      id: "p-sp-room",
      kind: "note",
      title: "What the room is saying",
      body:
        "Head of purchase: 14 days is not enough. Take it to 21 and the fill rate problem goes away. " +
        "CFO: I have been asked to release ₹6 crore of working capital this year, and you are asking me to add ₹8 crore of stock. Also, would somebody explain why we wrote off ₹1.9 crore of expired product last year. " +
        "Operations director: it is the distributors. Lead times were 6 days and they are 8 now. Everything follows from that. " +
        "Store manager, Nashik, on the regional call: my diabetes shelf has never once been empty and I have not had cough syrup in three weeks. Both of those have been true all year.",
    },
  ],

  budget: { analystDays: 6, sprints: 4, rupees: 4 * CRORE },

  // ── The data you can buy (14 days of pulls, 6 to spend) ─────────────────
  drilldowns: [
    {
      id: "dd-fill-by-class",
      label: "Fill rate and stock by therapeutic class",
      question: "Is the 87% spread evenly, or is it an average of two different things?",
      cost: 2,
      evidenceFor: ["policy.uniform"],
      readsAs:
        "It is an average of 98.2% and 71.2%. Chronic lines are 60% of demand, hold 26 days of cover and almost never run out. Acute and seasonal lines are 40% of demand, hold the identical 26 days, and are 91% of everything we fail to serve.",
      reveals: [
        {
          id: "p-sp-by-class",
          kind: "segments",
          title: "By therapeutic class",
          dimension: "Class",
          rows: [
            { label: "Chronic — fill rate", value: 0.982, unit: "ratio" },
            { label: "Chronic — days of cover held", value: 26, unit: "days" },
            { label: "Chronic — share of unserved demand", value: 0.09, unit: "ratio" },
            { label: "Acute and seasonal — fill rate", value: 0.712, unit: "ratio" },
            { label: "Acute and seasonal — days of cover held", value: 26, unit: "days" },
            { label: "Acute and seasonal — share of unserved demand", value: 0.91, unit: "ratio" },
          ],
        },
        {
          id: "p-sp-by-class-note",
          kind: "note",
          title: "The same policy, two different outcomes",
          body:
            "Both groups are held to the identical national rule: 14 days of safety stock plus roughly 12 days of cycle stock. Both therefore carry 26 days of cover. " +
            "One of them has not had a stockout worth reporting in four quarters. The other is out of something 29% of the time. " +
            "₹18.72 crore of the ₹31.2 crore inventory sits behind the group that does not need it, and ₹12.48 crore behind the group that plainly does.",
        },
      ],
    },
    {
      id: "dd-variability",
      label: "How variable is demand, class by class?",
      question: "Should these two groups be held to the same rule at all?",
      cost: 2,
      dependsOn: ["dd-fill-by-class"],
      evidenceFor: ["policy.uniform"],
      readsAs:
        "No. Chronic demand has a coefficient of variation of 0.14 and acute has 0.71 — five times as jumpy. Safety stock should scale with variability, and ours scales with the calendar, so the same 14 days is about six standard deviations of cover for one group and about one for the other.",
      reveals: [
        {
          id: "p-sp-cv",
          kind: "segments",
          title: "Demand variability by class",
          dimension: "Class",
          rows: [
            { label: "Chronic — coefficient of variation", value: 0.14, unit: "ratio" },
            { label: "Chronic — cover held, in standard deviations", value: 6.1, unit: "count" },
            { label: "Acute and seasonal — coefficient of variation", value: 0.71, unit: "ratio" },
            { label: "Acute and seasonal — cover held, in standard deviations", value: 1.1, unit: "count" },
          ],
        },
        {
          id: "p-sp-cv-note",
          kind: "note",
          title: "Why days of demand is the wrong unit",
          body:
            "Safety stock exists to absorb demand being higher than forecast, so the amount you need depends on how far demand can stray — not on how much of it there is. Sizing it in days of average demand assumes those are the same thing, and they are only the same thing for items with identical variability. " +
            "A chronic refill is a patient collecting the same strip on roughly the same date every month. An acute line moves with the weather, the local infection load and whichever three doctors are prescribing that week. " +
            "Held to the same service level rather than the same number of days, chronic would need about 4 days of safety stock and acute about 26. We hold 14 and 14.",
        },
      ],
    },
    {
      id: "dd-leadtime",
      label: "Lead times, and which items they moved for",
      question: "The distributors got slower. Does that explain the split?",
      cost: 2,
      evidenceFor: ["supply.leadtime"],
      readsAs:
        "Lead time genuinely went from 6.1 days to 8.0 — the operations director is right about the fact. It went from 6.1 to 8.0 on the chronic lines and from 6.0 to 8.1 on the acute lines, which is the same on both sides of a split it is supposed to explain.",
      reveals: [
        {
          id: "p-sp-leadtime",
          kind: "timeseries",
          title: "Average lead time by class",
          caption: "Two lines that have been on top of each other for two years.",
          series: [
            {
              label: "Chronic lead time (days)",
              unit: "days",
              points: [
                { period: "Q-7", value: 6.1 },
                { period: "Q-5", value: 6.6 },
                { period: "Q-3", value: 7.2 },
                { period: "Q-1", value: 7.8 },
                { period: "Q-0", value: 8.0 },
              ],
            },
            {
              label: "Acute lead time (days)",
              unit: "days",
              points: [
                { period: "Q-7", value: 6.0 },
                { period: "Q-5", value: 6.5 },
                { period: "Q-3", value: 7.3 },
                { period: "Q-1", value: 7.9 },
                { period: "Q-0", value: 8.1 },
              ],
            },
          ],
        },
        {
          id: "p-sp-leadtime-note",
          kind: "note",
          title: "What a longer lead time can and cannot explain",
          body:
            "Two extra days of lead time is real and it costs money: it adds cycle stock across the whole range and it makes every buffer a little less adequate than it was. Reversing it is worth about ₹2.5 crore of released stock. " +
            "What it cannot do is explain why one half of the range holds 98% availability and the other holds 71%, because it happened equally to both halves. A cause that moved identically across both sides of a difference is not what created the difference. " +
            "It is also worth noticing what the chart does *not* show: chronic availability did not fall when lead times rose. Six standard deviations of cover absorbs two days of delay without anybody noticing. One standard deviation does not.",
        },
      ],
    },
    {
      id: "dd-supplier-fill",
      label: "Are the distributors shipping what we order?",
      question: "Is the shortfall arriving from outside rather than being created inside?",
      cost: 2,
      evidenceFor: ["supply.reliability"],
      readsAs:
        "Mostly, yes. Distributors ship 96.4% of ordered lines complete, and it is 96.1% on acute and 96.6% on chronic — again the same on both sides. Where they short us, they short us on both groups equally.",
      reveals: [
        {
          id: "p-sp-supplier",
          kind: "segments",
          title: "Supplier performance against our orders",
          dimension: "Measure",
          rows: [
            { label: "Order lines shipped complete — chronic", value: 0.966, unit: "ratio" },
            { label: "Order lines shipped complete — acute", value: 0.961, unit: "ratio" },
            { label: "Lines substituted for an equivalent", value: 0.021, unit: "ratio" },
            { label: "Lines cancelled outright", value: 0.018, unit: "ratio" },
          ],
        },
      ],
    },
    {
      id: "dd-store-orders",
      label: "Are the stores reordering when they should?",
      question: "Is this a discipline problem at 240 tills rather than a policy problem at head office?",
      cost: 2,
      evidenceFor: ["stores.replenish"],
      readsAs:
        "Largely not. 94% of replenishment orders go out inside the daily window, and the 6% that slip are spread evenly across formats and classes. Stores are following a policy that is wrong, which is a different problem from stores not following the policy.",
      reveals: [
        {
          id: "p-sp-store-orders",
          kind: "segments",
          title: "Replenishment discipline",
          dimension: "Measure",
          rows: [
            { label: "Orders raised inside the daily window", value: 0.94, unit: "ratio" },
            { label: "Manual overrides of the suggested order", value: 0.08, unit: "ratio" },
            { label: "Stores below 90% order compliance", value: 11, unit: "count" },
            { label: "Fill rate at those 11 stores", value: 0.861, unit: "ratio" },
          ],
        },
        {
          id: "p-sp-store-orders-note",
          kind: "note",
          title: "The eleven worst stores",
          body:
            "Eleven of 240 stores are below 90% order compliance, and their fill rate is 86.1% against the chain's 87.4%. So the worst-disciplined stores in the estate are 1.3 points worse than average. " +
            "Fixing all eleven completely would move the chain's fill rate by about 0.06 points. This is a real problem and it is not this problem.",
        },
      ],
    },
    {
      id: "dd-shrinkage",
      label: "Is the stock on the system actually on the shelf?",
      question: "Are we failing to sell things we are recorded as holding?",
      cost: 2,
      evidenceFor: ["stores.shrinkage"],
      readsAs:
        "Stock accuracy is 97.8% at store level, which is good for pharmacy retail. What the audit does turn up is ₹1.9 crore a year of expiry write-off, and 78% of it is chronic stock that was over-ordered — which is the overstock half of the same finding rather than a separate cause.",
      reveals: [
        {
          id: "p-sp-shrink",
          kind: "segments",
          title: "Stock audit, 40 stores",
          dimension: "Measure",
          rows: [
            { label: "System stock matching physical count", value: 0.978, unit: "ratio" },
            { label: "Annual expiry write-off (₹ cr)", value: 1.9, unit: "inr_crore" },
            { label: "Share of write-off that is chronic stock", value: 0.78, unit: "ratio" },
            { label: "Share of write-off that is acute stock", value: 0.22, unit: "ratio" },
          ],
        },
      ],
    },
    {
      id: "dd-forecast",
      label: "How good is the demand forecast?",
      question: "Are the buffers too small because the forecast they sit on is wrong?",
      cost: 2,
      evidenceFor: ["policy.forecast"],
      readsAs:
        "The forecast is unbiased on both groups — it is not systematically under-predicting anything. It is simply much less accurate on acute lines, which is not a fault to be fixed but the definition of a variable item, and precisely the reason those items need more cover rather than a better spreadsheet.",
      reveals: [
        {
          id: "p-sp-forecast",
          kind: "segments",
          title: "Forecast accuracy by class",
          dimension: "Measure",
          rows: [
            { label: "Chronic — mean absolute percentage error", value: 0.061, unit: "ratio" },
            { label: "Chronic — forecast bias", value: 0.004, unit: "ratio" },
            { label: "Acute — mean absolute percentage error", value: 0.343, unit: "ratio" },
            { label: "Acute — forecast bias", value: -0.009, unit: "ratio" },
          ],
        },
        {
          id: "p-sp-forecast-note",
          kind: "note",
          title: "Unbiased and inaccurate are different words",
          body:
            "A biased forecast is one that is wrong in a consistent direction, and it can be corrected. Ours is not biased: on acute lines it is 0.9% low, which is nothing. " +
            "It is inaccurate — 34% mean absolute error — because the thing it is forecasting genuinely moves that much. Three more analysts and a better model would take that to perhaps 29%, and the reason to hold safety stock is exactly the part that cannot be forecast. " +
            "Which is the argument for sizing buffers on variability. You cannot forecast your way out of weather; you can hold stock against it, on the items where weather is what you are selling.",
        },
      ],
    },
  ],

  // ── The hypothesis space (10 causes, two levels) ────────────────────────
  causes: [
    { id: "policy", parentId: null, label: "How we decide what to hold", verdict: "The right branch, and the answer is what the rule is denominated in." },
    {
      id: "policy.uniform",
      parentId: "policy",
      label: "One national safety-stock rule across items with very different demand",
      verdict:
        "This was it. Fourteen days of average demand is about six standard deviations of cover on chronic lines with a CV of 0.14, and about one on acute lines with a CV of 0.71. The same rule therefore produces 98.2% availability on one half of the range and 71.2% on the other, and the aggregate hides both.",
    },
    {
      id: "policy.forecast",
      parentId: "policy",
      label: "The forecast under-predicts demand, so every buffer is too small",
      verdict:
        "Not supported. The forecast is unbiased on both groups — 0.4% high on chronic, 0.9% low on acute. It is much less accurate on acute lines, but that is what a variable item *is*, and the response to unforecastable variation is safety stock sized for it, not a better model.",
    },
    {
      id: "policy.assortment",
      parentId: "policy",
      label: "We stock too many lines to keep any of them available",
      verdict:
        "Not supported. The range has grown 6% in two years and the top 400 SKUs are still 71% of demand. A narrower range would reduce complexity and would apply the same wrong rule to fewer items.",
    },
    { id: "supply", parentId: null, label: "What the distributors do", verdict: "Two real degradations, neither of which can explain a split." },
    {
      id: "supply.leadtime",
      parentId: "supply",
      label: "Distributor lead times have gone from 6 days to 8",
      verdict:
        "True, and the most respectable wrong answer on the board. It costs about ₹2.5 crore of extra cycle stock and it is worth fixing on its own merits — though not at the 1.5% price premium the deal on the table asks for, which costs more than it returns. It cannot be the cause, because it happened equally to chronic and acute lines — 6.1→8.0 and 6.0→8.1 — and one of those groups did not lose a single point of availability.",
    },
    {
      id: "supply.reliability",
      parentId: "supply",
      label: "Distributors short-ship against the orders we place",
      verdict:
        "Not supported. 96.4% of ordered lines ship complete, and the gap between chronic and acute is half a point. Whatever the distributors do badly, they do it to both halves of the range.",
    },
    { id: "stores", parentId: null, label: "What happens in the 240 stores", verdict: "Healthy, and too small to matter even if it were not." },
    {
      id: "stores.replenish",
      parentId: "stores",
      label: "Stores are not reordering on time",
      verdict:
        "Not supported. 94% of orders go out inside the daily window. The eleven worst-disciplined stores run 86.1% against a chain average of 87.4%, so fixing every one of them completely would move the chain by about 0.06 points.",
    },
    {
      id: "stores.shrinkage",
      parentId: "stores",
      label: "Stock is on the system and not on the shelf",
      verdict:
        "Not supported as a cause, and it carries the best corroboration of the real one. Stock accuracy is 97.8%. The audit does find ₹1.9 crore a year of expiry write-off, of which 78% is chronic stock nobody needed — that is the overstock half of the true cause, showing up as a cost rather than as a stockout.",
    },
  ],
  trueCauseIds: ["policy.uniform"],

  // ── What you can spend the quarter on ───────────────────────────────────
  interventions: [
    {
      id: "iv-segment-policy",
      label: "Set safety stock by demand variability, not by the calendar",
      pitch:
        "Replace the national 14-day rule with a service level per class, and let the maths set the days: about 4 days on chronic, about 26 on acute. Same promise to the customer on every item, different amount of stock behind it.",
      addresses: "policy.uniform",
      cost: { sprints: 2, rupees: 1.8 * CRORE },
      minSprints: 2,
      effects: {
        whenRootCause: [
          { driver: "chronicSafetyDays", deltaPct: -0.64 },
          { driver: "acuteSafetyDays", deltaPct: 0.86 },
          { driver: "acuteFillRate", deltaPct: 0.3 },
          // Chronic barely notices losing ten days of cover, which is the whole
          // argument: it was six standard deviations and is now about two.
          { driver: "chronicFillRate", deltaPct: -0.002 },
        ],
        otherwise: [
          { driver: "chronicSafetyDays", deltaPct: -0.2 },
          { driver: "acuteSafetyDays", deltaPct: 0.2 },
        ],
      },
      debrief:
        "The answer, and the thing that makes it a good answer is what it does *not* cost. Chronic cover falls from 26 days to about 18 and chronic availability moves from 98.2% to 98.0% — because six standard deviations of cover was always about five more than the promise needed. Acute cover rises to about 37 days and acute availability climbs about 18 points on its own — and past 93% with the store-forward buffer running alongside it. Total inventory ends up lower than it started, so the CFO gets working capital released rather than consumed.",
    },
    {
      id: "iv-acute-buffer",
      label: "Hold the top 200 acute lines forward, in the stores",
      pitch:
        "Move the buffer for the fastest-moving acute lines out of the two regional warehouses and into the stores themselves, on a twice-weekly replenishment cycle instead of weekly.",
      addresses: "policy.uniform",
      cost: { sprints: 2, rupees: 1.2 * CRORE },
      effects: {
        whenRootCause: [
          { driver: "acuteFillRate", deltaPct: 0.12 },
          // Ordering twice as often halves the average cycle stock, which is
          // where the money for the acute buffer comes from.
          { driver: "cycleDays", deltaPct: -0.28 },
          { driver: "opex", deltaPct: 0.012 },
        ],
        otherwise: [
          { driver: "cycleDays", deltaPct: -0.1 },
          { driver: "opex", deltaPct: 0.012 },
        ],
      },
      debrief:
        "The complement, and the reason the whole thing pays for itself. Stock sitting in a warehouse is not available to a patient standing in a shop, and replenishing twice a week instead of weekly halves the cycle stock across the entire range. That releases more capital than the acute buffer consumes — you end up more available and lighter at the same time, which is the shape a good inventory decision has.",
    },
    {
      id: "iv-blanket-safety",
      label: "Raise safety stock to 21 days across the range",
      pitch:
        "The head of purchase's proposal. If 14 days is not delivering 96%, hold more. It is simple, it needs no new system, and it can be switched on next Monday.",
      addresses: "policy.forecast",
      cost: { sprints: 1, rupees: 1.0 * CRORE },
      /**
       * The trap has to actually work, so it keeps its effect.
       *
       * The engine's off-target default saturates early and low, on the
       * reasoning that money aimed at the wrong cause stops working almost at
       * once. That is not true of stock: more cover is more cover whatever you
       * believe about why the fill rate is low, and a model in which buying
       * inventory mysteriously failed to raise availability would teach a
       * student something false about how supply chains behave.
       *
       * So it delivers its 8.5 points of acute availability, and it is still the
       * wrong answer — because it buys them with ₹8.4 crore of working capital
       * the CFO has been told to release, on top of a range that was already
       * carrying five standard deviations of cover it did not need. Being second
       * best while genuinely working is what makes it worth putting on the board.
       */
      saturation: { whenRootCause: { kind: "hill", ceiling: 1.0, halfAt: 0.3 }, otherwise: { kind: "hill", ceiling: 1.0, halfAt: 0.3 } },
      effects: {
        whenRootCause: [
          { driver: "chronicSafetyDays", deltaPct: 0.5 },
          { driver: "acuteSafetyDays", deltaPct: 0.5 },
          { driver: "chronicFillRate", deltaPct: 0.005 },
          { driver: "acuteFillRate", deltaPct: 0.12 },
        ],
        otherwise: [
          { driver: "chronicSafetyDays", deltaPct: 0.5 },
          { driver: "acuteSafetyDays", deltaPct: 0.5 },
          { driver: "chronicFillRate", deltaPct: 0.005 },
          { driver: "acuteFillRate", deltaPct: 0.12 },
        ],
      },
      debrief:
        "It works on the metric everybody is watching, which is what makes it dangerous. Acute availability rises about six points and blended fill rate finally moves — and it costs ₹6.5 crore of additional inventory to buy a fraction of what redistributing the stock you already hold buys for nothing. Once the holding cost lands, contribution ends up slightly *below* doing nothing: you will have improved the number on the board pack and made the quarter worse. Note where the extra stock goes, too — half of it lands on chronic lines already at 98.2%, where it will sit until it expires. And this is the second time: the first time cover went 11 days to 14, inventory rose 24%, and fill rate fell.",
    },
    {
      id: "iv-leadtime-deal",
      label: "Buy a committed 5-day lead time from the two national distributors",
      pitch:
        "The operations director's proposal: pay a 1.5% price premium for a contractual five-day lead time, reversing the drift from 6 days to 8 and then some.",
      addresses: "supply.leadtime",
      cost: { sprints: 1, rupees: 1.4 * CRORE },
      /**
       * Also kept real. A lead time you have paid for is a lead time you get,
       * whatever is wrong with your safety-stock policy — and the lesson is
       * sharper if the lever delivers exactly what it promised and the fill-rate
       * split survives it untouched.
       */
      saturation: { otherwise: { kind: "hill", ceiling: 1.0, halfAt: 0.35 } },
      effects: {
        whenRootCause: [
          { driver: "leadTimeDays", deltaPct: -0.375 },
          { driver: "cycleDays", deltaPct: -0.22 },
          { driver: "acuteFillRate", deltaPct: 0.06 },
        ],
        otherwise: [
          { driver: "leadTimeDays", deltaPct: -0.375 },
          { driver: "cycleDays", deltaPct: -0.22 },
          { driver: "acuteFillRate", deltaPct: 0.06 },
          { driver: "chronicFillRate", deltaPct: 0.002 },
          // You pay for the commitment in the invoice price, on every line.
          { driver: "chronicMarginRate", deltaPct: -0.048 },
          { driver: "acuteMarginRate", deltaPct: -0.048 },
        ],
      },
      debrief:
        "Exactly what it said on the tin, and it does not touch the problem. Lead time comes back to five days, cycle stock falls, ₹2.5 crore of inventory is released — and acute availability moves three points while chronic stays where it was, because the split was never about lead time. Then the bill: 1.5% more on every line you buy is about ₹1.1 crore a quarter against a 19% chronic margin, which is more than everything the deal just earned, so contribution ends up well below standing still. The right way to read this one is the chart — lead time rose equally on both groups and only one group's availability fell.",
    },
    {
      id: "iv-supplier-sla",
      label: "Dual-source the top 300 acute lines",
      pitch:
        "Add a second distributor for the fastest-moving acute lines so a short-ship from one can be covered by the other within 24 hours.",
      addresses: "supply.reliability",
      cost: { sprints: 1, rupees: 0.8 * CRORE },
      effects: {
        whenRootCause: [
          { driver: "acuteFillRate", deltaPct: 0.07 },
          { driver: "opex", deltaPct: 0.018 },
        ],
        otherwise: [
          { driver: "acuteFillRate", deltaPct: 0.04 },
          { driver: "opex", deltaPct: 0.018 },
          { driver: "acuteMarginRate", deltaPct: -0.02 },
        ],
      },
      debrief:
        "Insurance against a risk that is not what is hurting you. Distributors ship 96.4% of ordered lines complete, so the most a second source can recover is the 3.6% they miss — and it costs a second commercial relationship, a smaller volume discount and more administration on every acute line. Worth doing eventually, and not with this quarter's capacity.",
    },
    {
      id: "iv-store-discipline",
      label: "Auto-replenishment and handhelds for the eleven worst stores",
      pitch:
        "Take the manual override away from the stores that use it most, and put scanners in so the daily order goes out on time without anybody remembering.",
      addresses: "stores.replenish",
      cost: { sprints: 1, rupees: 0.5 * CRORE },
      effects: {
        whenRootCause: [
          { driver: "chronicFillRate", deltaPct: 0.004 },
          { driver: "acuteFillRate", deltaPct: 0.035 },
        ],
        otherwise: [
          { driver: "chronicFillRate", deltaPct: 0.001 },
          { driver: "acuteFillRate", deltaPct: 0.008 },
          { driver: "opex", deltaPct: 0.006 },
        ],
      },
      debrief:
        "A real improvement of the right size to be invisible. The eleven stores below 90% compliance run 86.1% against a chain average of 87.4%, so fixing them completely is worth about 0.06 points of chain fill rate. Do it because it is cheap and correct, not because it is an answer to the question you were asked.",
    },
  ],

  /**
   * Committing the whole budget adds about 8% to the cost of running the estate
   * for the quarter — systems work, a redesigned replenishment cycle, and the
   * people to run both while the old process is still live.
   *
   * Sized against the gains on offer rather than against the budget's face
   * value: ₹4 crore is a one-off programme and the north star is a quarterly
   * figure, so charging the whole amount every quarter would make standing still
   * the answer to everything.
   */
  spend: { driver: "opex", atFullBudget: 0.08 },

  /**
   * The quarter not going exactly to plan.
   *
   * Acute demand is the weather and the local infection load, so its
   * availability moves whatever anybody does; chronic demand is a metronome and
   * barely moves at all. That asymmetry is itself part of the lesson, so the
   * sigmas are deliberately unequal — and neither is wide enough to drown a
   * decision, which past about 5% a period it would.
   */
  noise: {
    drivers: [
      { driver: "acuteFillRate", sigma: 0.035 },
      { driver: "acuteDemandValue", sigma: 0.03 },
      { driver: "chronicDemandValue", sigma: 0.008 },
    ],
    driftSigma: 0.25,
  },

  // Lead times keep drifting out, and the acute range keeps getting jumpier as
  // the assortment widens. Both bleed if nobody touches them.
  drift: [
    { driver: "cycleDays", deltaPct: 0.025 },
    { driver: "acuteFillRate", deltaPct: -0.035 },
  ],
  horizonQuarters: 2,

  parInvestigation: ["dd-fill-by-class", "dd-variability"],
  // Certified by `pnpm tsx scripts/best-allocation.ts sehat-plus-service-level`,
  // not chosen by hand.
  bestAllocation: [
    { interventionId: "iv-segment-policy", sprints: 2, rupees: 2.0083333 * CRORE },
    { interventionId: "iv-acute-buffer", sprints: 2, rupees: 1.075 * CRORE },
  ],

  debrief: {
    causalChain: [
      "A national rule holds every SKU at 14 days of average demand as safety stock, plus about 12 days of cycle stock.",
      "The range contains two kinds of demand. Chronic refills have a coefficient of variation of 0.14; acute and seasonal lines have 0.71.",
      "Safety stock has to absorb how far demand can stray, so what matters is variability — but the rule is denominated in days of average demand, which is a different quantity.",
      "So the identical 14 days is about six standard deviations of cover on chronic lines and about one on acute lines.",
      "Chronic therefore sits at 98.2% availability and is carrying ₹18.72 crore, most of which is protecting against variation that does not happen. 78% of the ₹1.9 crore annual expiry write-off is chronic stock.",
      "Acute sits at 71.2%, is 40% of demand, and is 91% of the ₹13.61 crore a quarter that walks out unserved.",
      "Blended, that averages to 87.4% on inventory turning 9.5 times — both of which are respectable numbers, which is why nobody has been able to find the problem in them.",
      "And the obvious lever has already been pulled: cover went 11 days to 14 a year ago, inventory rose 24%, and fill rate fell from 88.1% to 87.4%.",
    ],
    whereTheLeverageWas:
      "Redistribution, not addition. The chain is holding roughly the right *amount* of stock and holding it against the wrong risks — so the fix costs nothing in working capital and buys about 27 points of acute availability. Set a service level per class and let variability set the days: chronic falls from 26 days of cover to about 18 and loses two tenths of a point of availability, because five of its six standard deviations of cover were never doing anything. Then move the acute buffer forward into the stores and replenish twice a week instead of weekly, which halves cycle stock across the whole range and pays for the acute increase. Inventory ends up ₹4.3 crore *lower* than standing still would have left it, which is the answer to the CFO's question as well as the customer's.",
    strongAnswer: [
      "The first thing I want to do is stop looking at the 87%, because it is an average of two things that have nothing to do with each other.",
      "Split it by how variable demand is. Chronic refills run at 98.2% availability; acute and seasonal lines run at 71.2%.",
      "Acute is 40% of demand and 91% of everything we fail to serve. That is the whole problem, and the blended number was hiding it.",
      "Now ask why one rule produces two answers. We hold 14 days of average demand on everything.",
      "But safety stock is there to absorb demand straying from forecast, so the right unit is standard deviations, not days.",
      "Chronic has a coefficient of variation of 0.14, so 14 days is about six standard deviations. Acute has 0.71, so the same 14 days is about one.",
      "We are not holding too much stock or too little. We are holding it against the wrong risks.",
      "Name the trap, and name it carefully because it works: raising cover to 21 days everywhere really does lift acute availability about six points, and it moves the blended fill rate everybody is measured on.",
      "It buys that with ₹6.5 crore of working capital, half of which lands on lines already at 98%, while the CFO is under instruction to release ₹6 crore. Once the carrying cost lands, the quarter is slightly worse than if we had done nothing — a better number and less money. And we have run this experiment already: 11 days to 14 last year, inventory up 24%, fill rate down.",
      "Name the second trap: lead times genuinely went from 6 days to 8. They went from 6 to 8 on both groups, so they cannot explain a gap that only opened on one.",
      "That is the test I would apply to every candidate cause here — did it move differently across the two sides of the split? Lead time did not. Supplier short-shipping did not. Store discipline did not.",
      "What I would do: set a service level per class and let the maths pick the days — about 4 on chronic, about 26 on acute.",
      "Then move the acute buffer into the stores and replenish twice a week, which halves cycle stock across the range and funds the acute increase out of the chronic release.",
      "Net effect: acute availability into the low nineties, blended fill rate past the 96% we promised, and ₹4.3 crore less inventory than standing still would have left us holding.",
      "And I would change what the board pack reports. A single fill rate across unlike items is the reason this ran for a year — I would show it by class, next to the variability that should be setting the policy.",
    ],
  },

  coachFallback: [
    {
      topic: ["fill rate", "87", "average", "blended", "split", "by class"],
      answer: [
        "The 87.4% is an average of 98.2% on chronic refills and 71.2% on acute and seasonal lines.",
        "Acute is 40% of demand and 91% of everything we could not serve.",
        "A single availability number across items that behave nothing alike is the reason nobody could find this for a year.",
      ],
    },
    {
      topic: ["safety stock", "14 days", "cover", "policy", "rule"],
      answer: [
        "The national rule is 14 days of average demand on every item, plus about 12 days of cycle stock.",
        "Safety stock exists to absorb demand straying from forecast, so the amount you need depends on how far it can stray — not on how much of it there is.",
        "Denominating the rule in days quietly assumes every item is equally jumpy, and that is the assumption that broke.",
      ],
    },
    {
      topic: ["cv", "coefficient of variation", "variability", "standard deviation", "jumpy"],
      answer: [
        "Chronic demand has a coefficient of variation of 0.14 — a patient collecting the same strip on the same date each month.",
        "Acute demand has 0.71, because it moves with the weather and the local infection load.",
        "So the same 14 days is about six standard deviations of cover for one group and about one for the other. Same rule, two completely different promises.",
      ],
    },
    {
      topic: ["21 days", "raise safety stock", "more stock", "purchase", "blanket"],
      answer: [
        "It works, and that is exactly what makes it the trap: acute availability rises about six points and the blended fill rate finally moves.",
        "It costs ₹6.5 crore of working capital to buy that, and half the extra stock lands on chronic lines already at 98.2%, where it sits until it expires. After the carrying cost, the quarter is slightly worse than doing nothing.",
        "The chain has also already run this experiment. Cover went 11 days to 14 last year: inventory up 24%, fill rate down from 88.1% to 87.4%.",
      ],
    },
    {
      topic: ["lead time", "distributor", "6 to 8", "supplier", "operations director"],
      answer: [
        "The fact is right: lead times went from about 6 days to about 8, and reversing it genuinely releases about ₹2.5 crore of cycle stock.",
        "But it went 6.1 → 8.0 on chronic and 6.0 → 8.1 on acute — the same on both sides of the split it is meant to explain.",
        "A cause that moved identically across both halves cannot be what created a difference between them. Chronic availability did not fall at all while lead times rose.",
      ],
    },
    {
      topic: ["forecast", "accuracy", "bias", "under-predict", "model"],
      answer: [
        "The forecast is not biased — it is 0.4% high on chronic and 0.9% low on acute, which is nothing.",
        "It is much less accurate on acute lines: 34% mean absolute error against 6%. But that is what a variable item is, not a fault in the spreadsheet.",
        "You cannot forecast your way out of weather. The unforecastable part is precisely what safety stock is for, which is the argument for sizing buffers on variability.",
      ],
    },
    {
      topic: ["turns", "inventory turns", "9.5", "aggregate", "healthy"],
      answer: [
        "Turns are 9.5 times a year, which is a perfectly respectable number for pharmacy retail — and that is the trouble with it.",
        "Turns are an aggregate, so they average your best-behaved items with your worst.",
        "Healthy turns are entirely compatible with half your range carrying five standard deviations of cover it does not need and the other half carrying one.",
      ],
    },
    {
      topic: ["working capital", "cfo", "cash", "release", "expiry", "write off"],
      answer: [
        "The CFO has been asked to release ₹6 crore and is looking at ₹31.2 crore of stock, ₹1.9 crore a year of which expires.",
        "78% of that write-off is chronic stock nobody needed — the overstock half of the same cause, showing up as a cost instead of a stockout.",
        "The segmented policy is the rare fix that answers both people: availability up about 19 points on acute, and slightly less inventory than today.",
      ],
    },
    {
      topic: ["stores", "discipline", "reorder", "compliance", "shrinkage", "accuracy"],
      answer: [
        "94% of store orders go out inside the daily window, and stock accuracy is 97.8%.",
        "The eleven worst-disciplined stores run 86.1% against a chain average of 87.4%, so fixing every one of them completely moves the chain about 0.06 points.",
        "Stores are following a policy that is wrong. That is a different problem from stores not following the policy.",
      ],
    },
    {
      topic: ["fix", "what should we do", "segment", "service level", "answer"],
      answer: [
        "Set a service level per class and let variability pick the days — about 4 on chronic, about 26 on acute, instead of 14 on everything.",
        "Then hold the acute buffer forward in the stores and replenish twice a week rather than weekly, which halves cycle stock across the whole range and pays for the increase.",
        "Acute availability climbs into the low nineties, blended fill rate goes past the 96% we promised, and inventory ends up ₹4.3 crore below where standing still would have left it.",
      ],
    },
  ],
};
