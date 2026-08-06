/**
 * "The test says +6%. Do we ship it?"
 *
 * The experiment-reading scenario, and the third of the beginner set. Teaches
 * what an A/B test is, what significance does and does not promise, and the one
 * habit that separates a PM from a dashboard: **read the test on the metric that
 * pays the bills, not the metric you happened to instrument.**
 *
 * ── The truth, for whoever maintains this ─────────────────────────────────
 *
 * The variant is two changes shipped in one arm: a redesigned product page, and
 * a pre-ticked "send me two sizes, return the one that doesn't fit" box in the
 * cart. The redesign is worth about +1.4%. The pre-tick is worth the rest of the
 * +6% — and it is also a machine for manufacturing returns, because returning
 * one of the two is how it is *supposed* to work.
 *
 * The reason nobody caught it is timing, not competence. A return takes twelve
 * to sixteen days to come back through reverse pickup. The test ran six. On day
 * six the two arms return at 2.1% and 2.4% and look identical; followed to
 * thirty days they are 6.1% and 9.8%.
 *
 * So the model has to charge a return properly, and it does: a returned order
 * loses its gross margin *and* costs ₹210 to handle. That is why shipping a
 * genuine, significant, correctly-measured +6% conversion win takes net
 * contribution **down 6.7%** — the single number this scenario exists to land.
 *
 * ── Balance notes ─────────────────────────────────────────────────────────
 *
 * `iv-ship-all` is the trap and it is the room's unanimous proposal. It does
 * exactly what the test promised: orders up 6%, revenue up 6%. It is the only
 * option in the set that takes the north star *below* doing nothing.
 *
 * `iv-festive` is the good trap — a real 6% more traffic, at slightly worse
 * economics. It genuinely beats standing still and loses comfortably to fixing
 * the sizing, which is the shape a decoy should have.
 *
 * `tests/sim-scenario.test.ts` brute-forces every affordable combination, so a
 * retune that lets a decoy beat the answer fails the suite rather than the
 * student.
 */

import type { SimScenario } from "../types";

const LAKH = 100_000;

export const abTestReadout: SimScenario = {
  slug: "ab-test-readout",
  title: "Rangoli: the test says +6%, and the room wants it live on Monday",
  company: "Rangoli",
  premise:
    "An A/B test on the product page came back +6% on conversion, properly significant. Work out what it actually measured before you ship it.",
  situation:
    "You are the PM for the shopping experience at Rangoli, an ethnic-wear marketplace. " +
    "A six-day A/B test on the product page came back at +6% conversion — the biggest win the team has ever measured, and the data scientist has signed off that it is real. " +
    "Design wants it live on Monday. Growth has already put the extra revenue in the quarterly forecast. " +
    "The only dissenting voice is warehouse ops, who say their reverse-logistics queue has been growing for three weeks and nobody has told them why. " +
    "You have 6 analyst-days to work out what the test actually measured, then 3 sprints and ₹30 lakh to act on it.",
  difficulty: "Easy",
  periodNoun: "month",

  // ── Teaching ────────────────────────────────────────────────────────────
  teaching: {
    showMetricMap: true,
    primer: {
      intro:
        "An A/B test is the cleanest tool a PM has, and the easiest to misread. The terms below are the whole vocabulary you need — the first six are about the test, the last four are about the business the test is supposed to be helping. Reading a test well means holding both at once. The metric map on the right shows the business side with live numbers.",
      terms: [
        {
          term: "A/B test",
          plain:
            "You split your traffic at random into two halves, show each half a different version, and compare what they did.",
          matters:
            "Because the split is random and both versions run at the same time, anything else going on in the world — a festival, a competitor's sale, the weather — lands on both halves equally and cancels out of the comparison.",
        },
        {
          term: "Control and variant",
          plain: "The control is what you have today. The variant is the new thing you are testing.",
          matters:
            "Everything you learn is a difference between the two, so what matters is that they differ in exactly one way. If the variant changes two things, the test cannot tell you which one moved the number.",
        },
        {
          term: "Lift",
          plain: "How much better the variant did, as a percentage of the control.",
          formula: "(variant − control) ÷ control",
          matters:
            "It is always a lift *on one specific metric*. A +6% lift on conversion is not a +6% lift on profit, and nothing about the test makes it so.",
        },
        {
          term: "Sample size",
          plain: "How many people saw each version.",
          matters:
            "Too few and a real difference hides in the noise; too few and a fluke looks like a finding. It is the first thing to check and the last thing that is usually wrong.",
        },
        {
          term: "Statistical significance",
          plain:
            "How confident you can be that the difference you measured is not just luck. Usually written as a p-value: p = 0.004 means a difference this big would turn up by chance about four times in a thousand.",
          matters:
            "Significance tells you the number is real. It says nothing at all about whether the number is the one you should be deciding on — and that gap is where most bad ships come from.",
        },
        {
          term: "Novelty effect",
          plain:
            "A lift that comes from the change being *new* rather than better — people notice it, poke at it, and then go back to normal.",
          matters:
            "It is the standard reason a big early win fades. You test for it by checking whether the lift is steady across the test and whether the earliest users still show it weeks later.",
        },
        {
          term: "Return rate",
          plain: "The share of orders that come back.",
          formula: "returns ÷ orders",
          matters:
            "In fashion it is the number that decides whether the business works. A returned order loses the margin you booked *and* costs money to bring back, inspect and repack.",
          driver: "returnRate",
        },
        {
          term: "Gross margin",
          plain: "The share of each rupee of kept sales left after what the garment itself cost you.",
          formula: "(price − cost of goods) ÷ price",
          matters:
            "It is the money available to pay for everything else. Nineteen paise in the rupee does not leave much room for a return that costs ₹210 to process.",
          driver: "marginRate",
        },
        {
          term: "AOV",
          full: "Average order value",
          plain: "The average rupee value of one order.",
          formula: "revenue ÷ orders",
          matters:
            "Worth watching in any test that changes the cart, because a change that adds items and a change that adds orders look identical on a revenue chart.",
          driver: "aov",
        },
        {
          term: "Net contribution",
          plain:
            "What the month actually leaves behind: margin on the orders people kept, minus the cost of handling the ones they sent back.",
          formula: "(kept revenue × gross margin) − cost of returns",
          matters:
            "This is the number to decide on. Conversion, orders and revenue are all upstream of it, and a change can move every one of them up while moving this one down.",
          driver: "netContribution",
        },
      ],
      worked: [
        "18.5 lakh people used the app last month and 4.12% of them ordered — 76,220 orders at an average of ₹640, so about ₹4.88 crore of sales.",
        "6.1% of those orders came back, so customers kept ₹4.58 crore of it. At 19% gross margin that is ₹87.0 lakh of margin.",
        "The 4,649 returns cost ₹210 each to collect, inspect and repack — ₹9.8 lakh.",
        "₹87.0 lakh minus ₹9.8 lakh is ₹77.3 lakh of net contribution. That is the number a ship decision has to be judged on, and it is not the number the test reported.",
      ],
    },
  },

  northStar: "netContribution",
  reported: ["conversionRate", "orders", "revenue", "returnRate", "returnCost", "grossProfit"],
  drivers: [
    { id: "monthlyUsers", kind: "input", label: "Monthly users", unit: "count", goodDirection: "up", baseline: 1_850_000 },
    { id: "conversionRate", kind: "input", label: "Conversion rate", unit: "ratio", goodDirection: "up", baseline: 0.0412 },
    { id: "orders", kind: "product", label: "Orders", unit: "count", goodDirection: "up", of: ["monthlyUsers", "conversionRate"] },
    { id: "aov", kind: "input", label: "Average order value", unit: "inr", goodDirection: "up", baseline: 640 },
    { id: "revenue", kind: "product", label: "Revenue booked", unit: "inr", goodDirection: "up", of: ["orders", "aov"] },

    { id: "returnRate", kind: "input", label: "Return rate", unit: "ratio", goodDirection: "down", baseline: 0.061 },
    { id: "one", kind: "constant", label: "1", unit: "count", goodDirection: "up", value: 1 },
    // The link that makes a return cost what it really costs. Without it a
    // returned order still books its margin, and the whole scenario collapses
    // into "returns are a small handling fee".
    {
      id: "keepRate",
      kind: "difference",
      label: "Share of orders kept",
      unit: "ratio",
      goodDirection: "up",
      minuend: "one",
      subtrahend: "returnRate",
    },
    { id: "netRevenue", kind: "product", label: "Revenue kept", unit: "inr", goodDirection: "up", of: ["revenue", "keepRate"] },
    { id: "marginRate", kind: "input", label: "Gross margin", unit: "ratio", goodDirection: "up", baseline: 0.19 },
    { id: "grossProfit", kind: "product", label: "Gross margin (₹)", unit: "inr", goodDirection: "up", of: ["netRevenue", "marginRate"] },

    { id: "returnedOrders", kind: "product", label: "Orders returned", unit: "count", goodDirection: "down", of: ["orders", "returnRate"] },
    { id: "returnCostPerOrder", kind: "input", label: "Cost to handle a return", unit: "inr", goodDirection: "down", baseline: 210 },
    {
      id: "returnCost",
      kind: "product",
      label: "Cost of returns",
      unit: "inr",
      goodDirection: "down",
      of: ["returnedOrders", "returnCostPerOrder"],
    },
    {
      id: "netContribution",
      kind: "difference",
      label: "Net contribution / month",
      unit: "inr",
      goodDirection: "up",
      minuend: "grossProfit",
      subtrahend: "returnCost",
    },
  ],

  dashboard: [
    {
      id: "p-ab-readout",
      kind: "stat",
      title: "The test readout, as it went to the room",
      caption: "Six days, the whole of the traffic, split down the middle. Nothing here is wrong.",
      tiles: [
        { label: "Conversion — control", value: 0.0412, unit: "ratio", goodDirection: "up" },
        { label: "Conversion — variant", value: 0.043672, unit: "ratio", goodDirection: "up" },
        { label: "Lift", value: 0.06, unit: "percent", goodDirection: "up" },
        { label: "Users per arm", value: 185_000, unit: "count", goodDirection: "up" },
        { label: "Test ran for", value: 6, unit: "days", goodDirection: "up" },
      ],
    },
    {
      id: "p-ab-business",
      kind: "stat",
      title: "The business, last month",
      caption: "The test moved the first tile. The decision is judged on the last one.",
      tiles: [
        { label: "Orders", value: 76_220, unit: "count", deltaPct: 0.01, goodDirection: "up" },
        { label: "Revenue booked", value: 48_780_800, unit: "inr", deltaPct: 0.012, goodDirection: "up" },
        { label: "Return rate", value: 0.061, unit: "ratio", deltaPct: 0.04, goodDirection: "down" },
        { label: "Cost of returns", value: 976_378, unit: "inr", deltaPct: 0.05, goodDirection: "down" },
        { label: "Gross margin (₹)", value: 8_702_983, unit: "inr", deltaPct: -0.004, goodDirection: "up" },
        { label: "Net contribution", value: 7_726_604, unit: "inr", deltaPct: -0.011, goodDirection: "up" },
      ],
    },
    {
      id: "p-ab-trend",
      kind: "timeseries",
      title: "Conversion and returns, last six months",
      caption: "Conversion has been flat for half a year. The other line has not.",
      series: [
        {
          label: "Conversion rate",
          unit: "ratio",
          points: [
            { period: "M-5", value: 0.0409 },
            { period: "M-4", value: 0.0414 },
            { period: "M-3", value: 0.041 },
            { period: "M-2", value: 0.0413 },
            { period: "M-1", value: 0.0411 },
            { period: "M-0", value: 0.0412 },
          ],
        },
        {
          label: "Return rate",
          unit: "ratio",
          points: [
            { period: "M-5", value: 0.052 },
            { period: "M-4", value: 0.054 },
            { period: "M-3", value: 0.056 },
            { period: "M-2", value: 0.058 },
            { period: "M-1", value: 0.059 },
            { period: "M-0", value: 0.061 },
          ],
        },
      ],
    },
    {
      id: "p-ab-room",
      kind: "note",
      title: "What the room is saying",
      body:
        "Design: we have never measured a +6% on this page. Ship it Monday and let's go and find the next one. " +
        "Growth: +6% conversion is about ₹29 lakh more revenue a month. Every week we spend discussing it is ₹7 lakh we didn't earn. " +
        "Data science: I ran the numbers twice. 1.85 lakh users per arm, p = 0.004. The result is real and I've signed it off. " +
        "Warehouse ops: nobody asked us. Our reverse-pickup queue is up about a third over three weeks and we are paying overtime to clear it.",
    },
  ],

  budget: { analystDays: 6, sprints: 3, rupees: 30 * LAKH },

  drilldowns: [
    {
      id: "dd-split",
      label: "What the variant actually changed",
      question: "Is the variant one change or several, and which one moved the number?",
      cost: 3,
      evidenceFor: ["test.confound"],
      readsAs:
        "The variant is two changes in one arm. Among the 29% who un-ticked the two-sizes box, conversion was 4.18% — the redesign on its own is worth about +1.4%. Among the 71% who left it ticked it was 4.44%. Nearly the whole +6% is the pre-tick, not the page.",
      reveals: [
        {
          id: "p-ab-changelog",
          kind: "note",
          title: "The change log for the variant arm",
          body:
            "Two things shipped into the variant on the same build. (1) A redesigned product page — larger photos, the size chart moved above the fold, reviews pulled up. " +
            "(2) A checkbox in the cart reading \"Send me two sizes, return the one that doesn't fit — free\", pre-ticked by default. " +
            "The second was added late, by a different squad, and was not in the test document.",
        },
        {
          id: "p-ab-by-behaviour",
          kind: "segments",
          title: "Conversion by arm, and by what the shopper did with the box",
          dimension: "Group",
          rows: [
            { label: "Control", value: 0.0412, unit: "ratio" },
            { label: "Variant — box un-ticked (29% of the arm)", value: 0.041777, unit: "ratio" },
            { label: "Variant — box left ticked (71% of the arm)", value: 0.044446, unit: "ratio" },
          ],
        },
      ],
    },
    {
      id: "dd-returns",
      label: "Returns by order date, followed to 30 days",
      question: "What happened to the orders the test won, after the test ended?",
      cost: 2,
      evidenceFor: ["test.confound"],
      readsAs:
        "Followed to 30 days the variant returns at 9.8% against the control's 6.1% — 60% more. On day six, when the test was read, the two arms were indistinguishable, because a return takes about a fortnight to come back.",
      reveals: [
        {
          id: "p-ab-return-curve",
          kind: "timeseries",
          title: "Share of an order cohort returned, by days since the order",
          caption: "The test was read on day 6. The curves have not separated yet on day 6.",
          series: [
            {
              label: "Control",
              unit: "ratio",
              points: [
                { period: "D3", value: 0.004 },
                { period: "D6", value: 0.021 },
                { period: "D14", value: 0.048 },
                { period: "D21", value: 0.058 },
                { period: "D30", value: 0.061 },
              ],
            },
            {
              label: "Variant",
              unit: "ratio",
              points: [
                { period: "D3", value: 0.005 },
                { period: "D6", value: 0.024 },
                { period: "D14", value: 0.071 },
                { period: "D21", value: 0.091 },
                { period: "D30", value: 0.098 },
              ],
            },
          ],
        },
        {
          id: "p-ab-return-note",
          kind: "note",
          title: "Why the readout could not have seen this",
          body:
            "Reverse pickup takes 12 to 16 days end to end: the customer raises the request, the courier collects, the item reaches the warehouse and is inspected. " +
            "A six-day test therefore measures every rupee a change earns and almost none of what it costs. " +
            "And the mechanism is not a bug — \"order two, send one back\" is what the pre-ticked box invites the shopper to do. It worked exactly as designed.",
        },
      ],
    },
    {
      id: "dd-significance",
      label: "Sample size, p-value and confidence interval",
      question: "Is the +6% real, or is it noise?",
      cost: 2,
      evidenceFor: ["test.power"],
      readsAs:
        "1.85 lakh users per arm, p = 0.004, and a confidence interval that comfortably excludes zero. The test is not underpowered — the number is exactly as real as it looks, which is what makes the mistake so easy to walk into.",
      reveals: [
        {
          id: "p-ab-stats",
          kind: "stat",
          title: "The statistics on the conversion result",
          tiles: [
            { label: "Users per arm", value: 185_000, unit: "count", goodDirection: "up" },
            { label: "Orders — control", value: 7_622, unit: "count", goodDirection: "up" },
            { label: "Orders — variant", value: 8_079, unit: "count", goodDirection: "up" },
            { label: "Measured lift", value: 0.06, unit: "percent", goodDirection: "up" },
          ],
        },
        {
          id: "p-ab-stats-note",
          kind: "note",
          title: "The data scientist's note",
          body:
            "Powered to detect a 2% minimum effect at 80% power; we cleared that on day four. Measured lift +6.0%, 95% confidence interval +3.7% to +8.3%, p = 0.004. " +
            "I am confident the conversion difference is real and roughly this size. " +
            "I was asked to test conversion and that is what I tested — I have no read on returns, refunds or margin, and the six-day window would not have supported one.",
        },
      ],
    },
    {
      id: "dd-decay",
      label: "Lift by day, and the first cohort three weeks on",
      question: "Is the lift fading, or is it here to stay?",
      cost: 2,
      evidenceFor: ["impact.novelty"],
      readsAs:
        "Flat at about +6% on every day of the test, and the day-one cohort is still +5.7% three weeks later. This is not novelty — it is a durable change in how people shop, which is precisely what makes it expensive.",
      reveals: [
        {
          id: "p-ab-daily",
          kind: "segments",
          title: "Lift over control, by day of the test",
          dimension: "Test day",
          rows: [
            { label: "Day 1", value: 0.058, unit: "percent" },
            { label: "Day 2", value: 0.061, unit: "percent" },
            { label: "Day 3", value: 0.059, unit: "percent" },
            { label: "Day 4", value: 0.062, unit: "percent" },
            { label: "Day 5", value: 0.06, unit: "percent" },
            { label: "Day 6", value: 0.061, unit: "percent" },
          ],
        },
        {
          id: "p-ab-cohort-note",
          kind: "note",
          title: "The day-one cohort, re-measured",
          body:
            "The users who first saw the variant on day one were re-measured three weeks after the test closed. They are still converting +5.7% above control. " +
            "A novelty effect decays — you would expect the daily lift to slope down across the test and the early cohort to be back at parity by now. Neither is happening.",
        },
      ],
    },
    {
      id: "dd-season",
      label: "Was the festive run-up inside the test window?",
      question: "Could seasonality be producing the difference?",
      cost: 2,
      evidenceFor: ["impact.seasonal"],
      readsAs:
        "Both arms ran on the same six days on randomly split traffic, so the festive lift landed on both and cancels out of the difference. Seasonality is real here and it is not the answer — and the test design is the reason you can say that with confidence.",
      reveals: [
        {
          id: "p-ab-season",
          kind: "timeseries",
          title: "Conversion by day, both arms",
          caption: "Both lines rise together. The gap between them is what the test measured.",
          series: [
            {
              label: "Control",
              unit: "ratio",
              points: [
                { period: "D1", value: 0.039 },
                { period: "D2", value: 0.0395 },
                { period: "D3", value: 0.0409 },
                { period: "D4", value: 0.0418 },
                { period: "D5", value: 0.0427 },
                { period: "D6", value: 0.0433 },
              ],
            },
            {
              label: "Variant",
              unit: "ratio",
              points: [
                { period: "D1", value: 0.0413 },
                { period: "D2", value: 0.0419 },
                { period: "D3", value: 0.0433 },
                { period: "D4", value: 0.0444 },
                { period: "D5", value: 0.0453 },
                { period: "D6", value: 0.0459 },
              ],
            },
          ],
        },
        {
          id: "p-ab-season-note",
          kind: "note",
          title: "Why running both arms at once matters",
          body:
            "Sitewide conversion climbed from 3.9% to 4.3% across the six days as the festive run-up started. If the variant had run *after* the control instead of alongside it, all of that would have been credited to the variant. " +
            "Because the split was random and concurrent, the festive lift is in both arms and drops out of the comparison entirely.",
        },
      ],
    },
  ],

  causes: [
    {
      id: "test",
      parentId: null,
      label: "How the test was built and read",
      verdict: "The right place to look — though not because the number was wrong.",
    },
    {
      id: "test.confound",
      parentId: "test",
      label: "The variant changed two things at once",
      verdict:
        "This was it. A redesigned page and a pre-ticked \"send me two sizes\" box shipped in the same arm. The page is worth +1.4%; the pre-tick is worth the rest of the +6% and a 60% rise in returns that the six-day window could not see.",
    },
    {
      id: "test.power",
      parentId: "test",
      label: "There wasn't enough traffic for the result to be trusted",
      verdict:
        "Not supported. 1.85 lakh users per arm, p = 0.004, confidence interval +3.7% to +8.3%. The conversion result is real and correctly measured — it simply is not the result the decision needed.",
    },
    {
      id: "impact",
      parentId: null,
      label: "What the lift will do once it is live",
      verdict: "Worth asking, and both branches here turn out to be clean.",
    },
    {
      id: "impact.novelty",
      parentId: "impact",
      label: "The lift is novelty and will fade",
      verdict:
        "Not supported. The daily lift was flat across all six days and the day-one cohort is still +5.7% three weeks later. The behaviour change is durable — which is the bad news, not the good news.",
    },
    {
      id: "impact.seasonal",
      parentId: "impact",
      label: "It is the festive run-up, not the variant",
      verdict:
        "Not supported. Both arms ran concurrently on randomly split traffic, so the festive lift is in both and cancels out of the difference. This is exactly what concurrent randomisation is for.",
    },
  ],
  trueCauseIds: ["test.confound"],

  interventions: [
    {
      id: "iv-unbundle",
      label: "Ship the page, drop the pre-tick",
      pitch:
        "Separate the two changes and take only the one that earns its keep: the redesigned product page goes live, the pre-ticked two-sizes box does not.",
      addresses: "test.confound",
      cost: { sprints: 1, rupees: 8 * LAKH },
      effects: {
        whenRootCause: [{ driver: "conversionRate", deltaPct: 0.014 }],
        otherwise: [{ driver: "conversionRate", deltaPct: 0.005 }],
      },
      debrief:
        "The cheap half of the answer. The page on its own is worth +1.4% conversion at no cost in returns — a smaller number than the headline and the only part of it you actually wanted.",
    },
    {
      id: "iv-sizing",
      label: "Fix the sizing problem the test exposed",
      pitch:
        "The pre-tick worked because shoppers cannot tell what will fit. Publish real garment measurements, add \"shoppers your size usually took M\" from past orders, and flag the sellers whose sizing runs small.",
      addresses: "test.confound",
      cost: { sprints: 2, rupees: 22 * LAKH },
      minSprints: 2,
      effects: {
        whenRootCause: [
          { driver: "conversionRate", deltaPct: 0.015 },
          { driver: "returnRate", deltaPct: -0.16 },
        ],
        otherwise: [{ driver: "returnRate", deltaPct: -0.04 }],
      },
      debrief:
        "The expensive half, and the one that compounds. The variant did not invent demand for two sizes — it exposed it. Answering the underlying question converts on its own merits and takes 16% out of returns rather than adding 60%.",
    },
    {
      id: "iv-ship-all",
      label: "Ship the variant exactly as it tested",
      pitch:
        "The room's proposal. The result is significant, the effect is durable, and every week of delay is revenue we did not book. Ship the whole arm on Monday.",
      addresses: "test.power",
      cost: { sprints: 1, rupees: 5 * LAKH },
      effects: {
        whenRootCause: [{ driver: "conversionRate", deltaPct: 0.06 }],
        otherwise: [
          { driver: "conversionRate", deltaPct: 0.06 },
          { driver: "returnRate", deltaPct: 0.6 },
        ],
      },
      debrief:
        "It delivers precisely what the test promised: conversion up 6%, orders up 6%, revenue up 6%. It also takes returns from 6.1% to 9.8%, and a return costs you the margin plus ₹210. The only option here that ends the horizon below doing nothing.",
    },
    {
      id: "iv-refresh",
      label: "Re-test a fresh layout every month",
      pitch:
        "If the win is novelty, keep manufacturing novelty: put one squad on a rolling programme of page refreshes so there is always something new in front of the shopper.",
      addresses: "impact.novelty",
      cost: { sprints: 1, rupees: 9 * LAKH },
      effects: {
        whenRootCause: [{ driver: "conversionRate", deltaPct: 0.03 }],
        otherwise: [
          { driver: "conversionRate", deltaPct: 0.008 },
          { driver: "returnRate", deltaPct: 0.04 },
        ],
      },
      debrief:
        "An answer to a question the data already closed — the lift was flat across the test and the first cohort has held it for three weeks, so there was no novelty to chase. The small lift it buys is cancelled almost exactly by the returns it adds, because a page that changes every month teaches shoppers not to trust last month's size chart. A sprint and ₹9 lakh for a rounding error.",
    },
    {
      id: "iv-festive",
      label: "Put the money behind the festive window instead",
      pitch:
        "Park the test, spend the quarter's capacity on festive merchandising and paid traffic while demand is high, and revisit the page in January.",
      addresses: "impact.seasonal",
      cost: { sprints: 1, rupees: 14 * LAKH },
      effects: {
        whenRootCause: [{ driver: "monthlyUsers", deltaPct: 0.09 }],
        otherwise: [
          { driver: "monthlyUsers", deltaPct: 0.06 },
          { driver: "returnRate", deltaPct: 0.05 },
          { driver: "marginRate", deltaPct: -0.03 },
        ],
      },
      debrief:
        "The honest decoy: 6% more traffic is 6% more traffic, and this genuinely beats standing still. But festive shoppers return more and are sold at a deeper discount, so it captures under a fifth of what was available — and unlike a sizing fix, none of it is still there in January.",
    },
  ],

  // The catalogue keeps widening into unbranded sellers with inconsistent
  // sizing, and everyone discounts into the festive season. Both bleed if
  // nobody touches them.
  drift: [
    { driver: "returnRate", deltaPct: 0.04 },
    { driver: "marginRate", deltaPct: -0.01 },
  ],
  horizonQuarters: 2,

  parInvestigation: ["dd-split", "dd-returns"],
  bestAllocation: [
    { interventionId: "iv-unbundle", sprints: 1, rupees: 8 * LAKH },
    { interventionId: "iv-sizing", sprints: 2, rupees: 22 * LAKH },
  ],

  debrief: {
    causalChain: [
      "The variant was two changes in one arm: a redesigned product page, and a pre-ticked \"send me two sizes, return the one that doesn't fit\" box added late by another squad.",
      "Among the 29% of variant shoppers who un-ticked the box, conversion was 4.18% — the redesign on its own was worth +1.4%.",
      "Among the 71% who left it ticked it was 4.44%. Nearly the whole +6% came from the pre-tick.",
      "A return takes 12 to 16 days to come back through reverse pickup, and the test ran for six. On day six both arms returned at about 2%; followed to 30 days they returned at 6.1% and 9.8%.",
      "A returned order loses its 19% margin and costs ₹210 to collect, inspect and repack — so 60% more returns is a cost roughly twice the size of the margin the extra orders brought in.",
      "Shipped whole, the variant delivers exactly what it promised — conversion, orders and revenue all up 6% — and takes net contribution down 6.7%.",
    ],
    whereTheLeverageWas:
      "Unbundling. The +6% was real, significant, durable and correctly measured, and about a quarter of it was worth having. Splitting the arm let you keep the +1.4% from the page and refuse the returns that came with the rest — and the pre-tick's success pointed straight at the fix worth funding, because shoppers only wanted two sizes sent because they could not tell which one would fit.",
    strongAnswer:
      "I would not ship it, and my reason is not that I doubt the number. The conversion result is real: 1.85 lakh per arm, p = 0.004, flat across the test, still holding three weeks later. The problem is that it is a result about conversion in a business whose economics run on returns. The variant bundled two changes, and the change carrying the lift was a pre-ticked box inviting the shopper to order two sizes and send one back — which they did, at 9.8% against 6.1%. That was invisible on day six only because reverse pickup takes a fortnight, so a six-day test measures everything a change earns and nothing of what it costs. Netted out, a returned order loses its margin and costs ₹210 to process, so the ship is worth minus 6.7% on contribution. So: ship the page alone for the +1.4% it genuinely earns, and treat the pre-tick's success as the actual finding — shoppers ordered two sizes because they could not tell what would fit, which is a sizing-data problem worth solving properly. And I would change the default: from now on the ship bar is contribution measured to 30 days, not conversion measured to the end of the test.",
  },

  coachFallback: [
    {
      topic: ["confound", "two changes", "bundle", "variant", "pre-tick", "checkbox"],
      answer:
        "The variant was two changes in one arm — a redesigned page and a pre-ticked \"send me two sizes\" box. The page was worth +1.4%; the box was worth the rest of the +6% and a 60% rise in returns. A test can only tell you which change worked if the arm contains one change.",
    },
    {
      topic: ["return", "returns", "reverse", "refund", "9.8"],
      answer:
        "Returns went from 6.1% to 9.8% in the variant — but only visibly so once orders were followed to 30 days. Reverse pickup takes 12 to 16 days, so on day six, when the test was read, both arms sat at about 2% and looked identical.",
    },
    {
      topic: ["significance", "p-value", "sample", "power", "confidence", "real"],
      answer:
        "The result was solid: 1.85 lakh users per arm, p = 0.004, a 95% interval of +3.7% to +8.3%. Significance tells you the number is real. It says nothing about whether it is the number you should be deciding on, and here it wasn't.",
    },
    {
      topic: ["novelty", "fade", "decay", "wear off"],
      answer:
        "Not novelty. The daily lift was flat across all six days and the day-one cohort was still +5.7% three weeks after the test closed. The behaviour change is durable — which makes the returns durable too.",
    },
    {
      topic: ["seasonal", "festive", "season", "diwali"],
      answer:
        "Seasonality was in the test and it cancelled out. Both arms ran on the same six days on randomly split traffic, so the festive lift landed on both — sitewide conversion rose from 3.9% to 4.3% across the window, in the control as well as the variant.",
    },
    {
      topic: ["ship", "launch", "monday", "decision"],
      answer:
        "Shipping the whole variant does exactly what the test promised — conversion, orders and revenue all up 6% — and takes net contribution down 6.7%, because a returned order loses its 19% margin and costs ₹210 to handle. Shipping the page alone keeps the +1.4% and none of that.",
    },
    {
      topic: ["sizing", "size guide", "fit", "measurements"],
      answer:
        "The pre-tick worked because shoppers cannot tell what will fit. Publishing real garment measurements and fit data from past orders answers the same need directly: it converts on its own merits and takes returns down 16% instead of up 60%.",
    },
    {
      topic: ["contribution", "margin", "profit", "north star", "metric"],
      answer:
        "Net contribution is margin on the orders people kept, minus the cost of handling the ones they sent back. Conversion, orders and revenue are all upstream of it — and this scenario exists because a change can move every one of them up while moving contribution down.",
    },
  ],
};
