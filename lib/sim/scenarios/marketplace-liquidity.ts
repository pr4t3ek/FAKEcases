/**
 * "Both sides grew and both sides are angry."
 *
 * The two-sided marketplace scenario. Teaches match rate, liquidity,
 * utilisation and take rate — and the failure mode that only exists in
 * marketplaces: **a city-level average that is true and useless.**
 *
 * ── The truth, for whoever maintains this ─────────────────────────────────
 *
 * Requests grew 22% and professionals grew 19%, so on paper the platform is
 * balanced. It is not, because supply and demand have to meet in the same place
 * at the same hour to be worth anything. 71% of the new professionals signed up
 * in the three central zones where match rate was already 92%, while the growth
 * in requests came from three suburbs at commute hours where it is now 41% to
 * 52%. Three zones in a three-hour window are 31% of requests and 78% of
 * failures.
 *
 * The model charges for that properly. A failed request costs ₹185 — support,
 * the apology credit, and the customer who does not come back — so the
 * marketplace loses ₹33.6 lakh a month while GMV rises. Without that cost the
 * demand push would be profitable and the scenario would teach the opposite of
 * what it exists to teach.
 *
 * ── Balance notes ─────────────────────────────────────────────────────────
 *
 * `iv-demand` is the trap and it is the one the growth team is asking for: 20%
 * more requests into a marketplace that cannot fill the ones it has. GMV rises
 * about 12% and contribution roughly triples the loss, which is exactly the
 * shape of the mistake.
 *
 * `iv-recruit` is the honest near-miss: signing 6,000 more professionals
 * nationally does help, because some of them land in the deficit zones by
 * accident. It costs incentives on all 34,500 to move the 4,000 that mattered,
 * and it pushes utilisation down while it does it.
 *
 * The brute-force balance check in `tests/sim-scenario.test.ts` enumerates every
 * affordable combination against the declared best. Retune anything here and
 * run it.
 */

import type { SimScenario } from "../types";

const LAKH = 100_000;
const CRORE = 100 * LAKH;

export const marketplaceLiquidity: SimScenario = {
  slug: "marketplace-liquidity",
  title: "Ghar Sewa: customers waiting, professionals idle, both sides growing",
  company: "Ghar Sewa",
  premise:
    "Bookings up 22%, professionals up 19%, and one booking in five now goes unfilled. Work out why adding to both sides made the marketplace worse.",
  situation:
    "You are the PM for marketplace operations at Ghar Sewa, a home-services platform — salon at home, appliance repair, deep cleaning — across eight Indian cities. " +
    "Last quarter you added 22% more booking requests and 19% more professionals. Match rate fell from 88% to 79%, the average wait for a slot went from 3.1 hours to 6.8, and professionals are complaining they sit idle. " +
    "Growth wants ₹4 crore to push demand harder; the supply team wants to sign 6,000 more professionals. The marketplace lost ₹33.6 lakh last month. " +
    "You have 7 analyst-days to work out what is actually happening, then 4 sprints and ₹9 crore to fix it.",
  difficulty: "Medium",
  periodNoun: "month",

  // ── Teaching ────────────────────────────────────────────────────────────
  teaching: {
    showMetricMap: true,
    primer: {
      intro:
        "A marketplace is not one business, it is a very large number of tiny ones — every zone, in every hour, for every service. The terms below are how you talk about whether those tiny markets are working. The metric map on the right shows how the money falls out of them.",
      terms: [
        {
          term: "Match rate",
          plain: "Of the bookings customers ask for, the share that actually get filled.",
          formula: "jobs done ÷ bookings requested",
          matters:
            "The one number that says whether the marketplace is doing its job. Everything else — GMV, take rate, retention — is downstream of it.",
          driver: "matchRate",
        },
        {
          term: "Liquidity",
          plain:
            "Whether there is enough of both sides, in the same place at the same time, for a match to happen quickly.",
          matters:
            "It is local, not national. A platform can have plenty of supply in total and no liquidity at all in the zone and hour where the request came from — which is why a city average can be true and useless at once.",
        },
        {
          term: "Utilisation",
          plain: "Of the hours professionals make themselves available, the share spent on paid work.",
          formula: "productive hours ÷ available hours",
          matters:
            "The supply side's version of the same question. Low utilisation and unfilled bookings at the same time is the signature of a distribution problem rather than a shortage.",
          driver: "utilisation",
        },
        {
          term: "GMV",
          full: "Gross merchandise value",
          plain: "The total value of the work done on the platform, before your cut.",
          formula: "jobs × average ticket",
          matters:
            "The number marketplaces are usually valued on, and the easiest one to grow by doing something unprofitable. It is a size measure, not a health measure.",
          driver: "gmv",
        },
        {
          term: "Take rate",
          plain: "The share of each job's value the platform keeps.",
          formula: "platform revenue ÷ GMV",
          matters:
            "Your actual revenue line. Raising it is the fastest way to lose the side of the market that is easiest to lose.",
          driver: "takeRate",
        },
        {
          term: "Cost of a failed booking",
          plain:
            "What one unfilled request costs you — the support contact, the apology credit, and the customer who does not come back.",
          matters:
            "Marketplaces routinely leave this out of the model, which is how growth that makes match rate worse can look profitable on a GMV chart.",
          driver: "costPerFailure",
        },
        {
          term: "Contribution",
          plain:
            "What the month leaves behind: your cut of the work done, minus the cost of doing it, the incentives paid to hold supply online, the cost of the bookings you failed, and fixed costs.",
          matters: "The number this run is judged on, and the only one that knows about the failures.",
          driver: "contribution",
        },
      ],
      worked: [
        "6.2 lakh bookings were requested and 79% were filled — 4.9 lakh jobs at an average ticket of ₹840, so ₹41.1 crore of GMV.",
        "At a 24% take rate that is ₹9.87 crore of platform revenue.",
        "Serving those jobs costs ₹96 each — ₹4.70 crore — plus ₹1.5 crore of incentives paid to keep professionals online and ₹1.6 crore of fixed costs.",
        "The 1.3 lakh bookings that went unfilled cost ₹185 each: ₹2.41 crore. Total costs ₹10.21 crore against ₹9.87 crore of revenue — a ₹33.6 lakh monthly loss. Take the failures out of that month and it makes ₹2.07 crore.",
      ],
    },
  },

  northStar: "contribution",
  reported: ["matchRate", "jobs", "gmv", "utilisation", "netRevenue", "failureCost"],
  drivers: [
    { id: "requests", kind: "input", label: "Bookings requested", unit: "count", goodDirection: "up", baseline: 620_000 },
    { id: "matchRate", kind: "input", label: "Match rate", unit: "ratio", goodDirection: "up", baseline: 0.79 },
    { id: "one", kind: "constant", label: "1", unit: "count", goodDirection: "up", value: 1 },
    {
      id: "failRate",
      kind: "difference",
      label: "Share of bookings unfilled",
      unit: "ratio",
      goodDirection: "down",
      minuend: "one",
      subtrahend: "matchRate",
    },
    { id: "jobs", kind: "product", label: "Jobs completed", unit: "count", goodDirection: "up", of: ["requests", "matchRate"] },
    { id: "failedRequests", kind: "product", label: "Bookings unfilled", unit: "count", goodDirection: "down", of: ["requests", "failRate"] },

    { id: "avgTicket", kind: "input", label: "Average ticket", unit: "inr", goodDirection: "up", baseline: 840 },
    { id: "gmv", kind: "product", label: "GMV", unit: "inr", goodDirection: "up", of: ["jobs", "avgTicket"] },
    { id: "takeRate", kind: "input", label: "Take rate", unit: "ratio", goodDirection: "up", baseline: 0.24 },
    { id: "netRevenue", kind: "product", label: "Platform revenue", unit: "inr", goodDirection: "up", of: ["gmv", "takeRate"] },

    { id: "variableCostPerJob", kind: "input", label: "Cost to serve a job", unit: "inr", goodDirection: "down", baseline: 96 },
    { id: "variableCost", kind: "product", label: "Cost of jobs served", unit: "inr", goodDirection: "down", of: ["jobs", "variableCostPerJob"] },
    // The line marketplaces leave out of the model, and the reason growth that
    // breaks match rate can look profitable on a GMV chart.
    { id: "costPerFailure", kind: "input", label: "Cost of a failed booking", unit: "inr", goodDirection: "down", baseline: 185 },
    { id: "failureCost", kind: "product", label: "Cost of failed bookings", unit: "inr", goodDirection: "down", of: ["failedRequests", "costPerFailure"] },
    { id: "proIncentives", kind: "input", label: "Supply incentives / month", unit: "inr", goodDirection: "down", baseline: 1.5 * CRORE },
    { id: "fixedCosts", kind: "input", label: "Fixed costs / month", unit: "inr", goodDirection: "down", baseline: 1.6 * CRORE },
    {
      id: "totalCosts",
      kind: "sum",
      label: "Total monthly costs",
      unit: "inr",
      goodDirection: "down",
      of: ["variableCost", "failureCost", "proIncentives", "fixedCosts"],
    },
    {
      id: "contribution",
      kind: "difference",
      label: "Monthly contribution",
      unit: "inr",
      goodDirection: "up",
      minuend: "netRevenue",
      subtrahend: "totalCosts",
    },

    { id: "activePros", kind: "input", label: "Active professionals", unit: "count", goodDirection: "up", baseline: 34_500 },
    { id: "hoursPerPro", kind: "input", label: "Hours offered per professional", unit: "count", goodDirection: "up", baseline: 62 },
    { id: "availableHours", kind: "product", label: "Available hours", unit: "count", goodDirection: "up", of: ["activePros", "hoursPerPro"] },
    { id: "hoursPerJob", kind: "input", label: "Hours per job, with travel", unit: "count", goodDirection: "down", baseline: 1.9 },
    { id: "productiveHours", kind: "product", label: "Productive hours", unit: "count", goodDirection: "up", of: ["jobs", "hoursPerJob"] },
    {
      id: "utilisation",
      kind: "quotient",
      label: "Professional utilisation",
      unit: "ratio",
      goodDirection: "up",
      numerator: "productiveHours",
      denominator: "availableHours",
    },
  ],

  dashboard: [
    {
      id: "p-mk-headline",
      kind: "stat",
      title: "Last month",
      caption: "Every input grew. Every experience metric got worse. Contribution went negative in March.",
      tiles: [
        { label: "Bookings requested", value: 620_000, unit: "count", deltaPct: 0.22, goodDirection: "up" },
        { label: "Match rate", value: 0.79, unit: "ratio", deltaPct: -0.102, goodDirection: "up" },
        { label: "Jobs completed", value: 489_800, unit: "count", deltaPct: 0.09, goodDirection: "up" },
        { label: "GMV", value: 41.14 * CRORE, unit: "inr", deltaPct: 0.11, goodDirection: "up" },
        { label: "Utilisation", value: 0.435, unit: "ratio", deltaPct: -0.064, goodDirection: "up" },
        { label: "Contribution", value: -33.6 * LAKH, unit: "inr", goodDirection: "up" },
      ],
    },
    {
      id: "p-mk-both-sides",
      kind: "segments",
      title: "Both sides grew this quarter",
      caption: "Which is why nobody could agree on whose problem it was.",
      dimension: "Year-on-year change",
      rows: [
        { label: "Bookings requested", value: 0.22, unit: "percent" },
        { label: "Active professionals", value: 0.19, unit: "percent" },
        { label: "Jobs completed", value: 0.09, unit: "percent" },
        { label: "Match rate", value: -0.102, unit: "percent" },
        { label: "Professional utilisation", value: -0.064, unit: "percent" },
      ],
    },
    {
      id: "p-mk-trend",
      kind: "timeseries",
      title: "Match rate and average wait for a slot",
      caption: "Both moved through the quarter the demand campaign ran.",
      series: [
        {
          label: "Match rate",
          unit: "ratio",
          points: [
            { period: "M-5", value: 0.881 },
            { period: "M-4", value: 0.874 },
            { period: "M-3", value: 0.851 },
            { period: "M-2", value: 0.826 },
            { period: "M-1", value: 0.804 },
            { period: "M-0", value: 0.79 },
          ],
        },
        {
          label: "Average wait (hours)",
          unit: "count",
          points: [
            { period: "M-5", value: 3.1 },
            { period: "M-4", value: 3.4 },
            { period: "M-3", value: 4.2 },
            { period: "M-2", value: 5.1 },
            { period: "M-1", value: 6.0 },
            { period: "M-0", value: 6.8 },
          ],
        },
      ],
    },
    {
      id: "p-mk-room",
      kind: "note",
      title: "What the room is saying",
      body:
        "Growth: demand is the only thing we have proved we can move. Give me ₹4 crore and I will put 20% more bookings through — the supply will follow the money, it always does. " +
        "Supply: we are 6,000 professionals short. I have the recruitment pipeline ready and I need the incentive budget to activate them. " +
        "Engineering: the matching service was rewritten in January. It is not the rewrite — p95 match latency is 40 seconds and first-offer acceptance is 81%, both better than before. " +
        "Support: a fifth of our tickets are now 'nobody came'. Those customers do not book again.",
    },
  ],

  budget: { analystDays: 7, sprints: 4, rupees: 9 * CRORE },

  drilldowns: [
    {
      id: "dd-zone-hour",
      label: "Match rate by zone and by hour",
      question: "Is the failure spread across the platform or concentrated somewhere?",
      cost: 3,
      evidenceFor: ["supply.density"],
      readsAs:
        "79% is an average of 92% and 44%. Three suburbs in the 8–11am and 6–9pm windows are 31% of requests and 78% of every failure. Everywhere else the marketplace works exactly as well as it did a year ago.",
      reveals: [
        {
          id: "p-mk-zones",
          kind: "segments",
          title: "Match rate by zone, commute hours",
          dimension: "Zone",
          rows: [
            { label: "Whitefield, 8–11am", value: 0.41, unit: "ratio" },
            { label: "Electronic City, 8–11am", value: 0.47, unit: "ratio" },
            { label: "HSR & Sarjapur, 6–9pm", value: 0.52, unit: "ratio" },
            { label: "Central zones, all hours", value: 0.92, unit: "ratio" },
            { label: "Everywhere else, off-peak", value: 0.9, unit: "ratio" },
          ],
        },
        {
          id: "p-mk-concentration",
          kind: "note",
          title: "Where the failures actually are",
          body:
            "The three deficit zones in their peak windows are 31% of requests and 78% of failures. Strip them out and platform match rate is 91% — a point better than a year ago. " +
            "The city-level number is not wrong. It is an average across markets that have nothing to do with each other, and it hides both halves of what it averages.",
        },
      ],
    },
    {
      id: "dd-pro-supply",
      label: "Where and when professionals are actually online",
      question: "Did the new supply land where the new demand is?",
      cost: 2,
      evidenceFor: ["supply.density", "supply.count"],
      readsAs:
        "71% of the professionals added this year signed up in the three central zones, where match rate was already 92%. The deficit zones got 9% of the new supply and 44% of the new demand. The platform grew both sides and grew them in different places.",
      reveals: [
        {
          id: "p-mk-supply-split",
          kind: "segments",
          title: "Share of this year's growth, by zone group",
          dimension: "Zone group",
          rows: [
            { label: "Central — share of new professionals", value: 0.71, unit: "ratio" },
            { label: "Central — share of new requests", value: 0.28, unit: "ratio" },
            { label: "Deficit suburbs — share of new professionals", value: 0.09, unit: "ratio" },
            { label: "Deficit suburbs — share of new requests", value: 0.44, unit: "ratio" },
          ],
        },
        {
          id: "p-mk-idle",
          kind: "note",
          title: "Idle and unavailable at the same time",
          body:
            "Utilisation in the central zones is 31% — professionals there are online and waiting. In the deficit suburbs at peak it is 84%, which is as close to full as a travelling workforce gets. " +
            "Nobody is short of professionals. The platform is short of professionals in Whitefield at nine in the morning, which is a different problem with a different fix.",
        },
      ],
    },
    {
      id: "dd-cohort",
      label: "What a failed booking does to a customer",
      question: "Does a failure cost us anything beyond the booking?",
      cost: 3,
      dependsOn: ["dd-zone-hour"],
      evidenceFor: ["supply.density"],
      readsAs:
        "A customer whose first booking goes unfilled books again 21% of the time; one whose first booking is filled books again 68% of the time. Each failure costs about ₹185 once the support contact, the credit and the lost repeat are counted — which is why the loss is bigger than the missing revenue.",
      reveals: [
        {
          id: "p-mk-repeat",
          kind: "segments",
          title: "90-day repeat rate by first-booking outcome",
          dimension: "First booking",
          rows: [
            { label: "Filled on the slot requested", value: 0.68, unit: "ratio" },
            { label: "Filled, but rescheduled", value: 0.47, unit: "ratio" },
            { label: "Never filled", value: 0.21, unit: "ratio" },
          ],
        },
        {
          id: "p-mk-failcost",
          kind: "note",
          title: "What one unfilled booking costs",
          body:
            "₹41 of support handling, ₹90 of apology credit issued in 62% of cases, and ₹54 of amortised lost repeat value — ₹185 in total. " +
            "1.3 lakh failures a month is ₹2.41 crore, which is more than seven times last month's loss. The failures are not a symptom of the problem; on this P&L they are most of it.",
        },
      ],
    },
    {
      id: "dd-pro-churn",
      label: "Professional retention and earnings",
      question: "Are we losing professionals faster than we sign them?",
      cost: 2,
      evidenceFor: ["supply.churn", "supply.count"],
      readsAs:
        "90-day professional retention is 62% and earnings per active hour are ₹214 — both within a point of last year. Churn is not what changed, and the professionals who complain about idle time are in the zones with 31% utilisation, not the ones with 84%.",
      reveals: [
        {
          id: "p-mk-pro-retention",
          kind: "segments",
          title: "Professional metrics, this year against last",
          dimension: "Metric",
          rows: [
            { label: "90-day retention — this year", value: 0.62, unit: "ratio" },
            { label: "90-day retention — last year", value: 0.63, unit: "ratio" },
            { label: "Earnings per active hour — this year", value: 214, unit: "inr" },
            { label: "Earnings per active hour — last year", value: 211, unit: "inr" },
          ],
        },
      ],
    },
    {
      id: "dd-demand-mix",
      label: "What the new demand is asking for",
      question: "Is the growth in categories we are not set up to serve?",
      cost: 2,
      evidenceFor: ["demand.mix"],
      readsAs:
        "Category mix moved less than two points in a year — salon 44%, repair 31%, cleaning 25%. The new demand wants the same things the old demand wanted, from the same professionals. It just wants them somewhere else.",
      reveals: [
        {
          id: "p-mk-mix",
          kind: "segments",
          title: "Share of requests by category",
          dimension: "Category",
          rows: [
            { label: "Salon at home — now", value: 0.44, unit: "ratio" },
            { label: "Salon at home — a year ago", value: 0.45, unit: "ratio" },
            { label: "Appliance repair — now", value: 0.31, unit: "ratio" },
            { label: "Appliance repair — a year ago", value: 0.3, unit: "ratio" },
            { label: "Deep cleaning — now", value: 0.25, unit: "ratio" },
            { label: "Deep cleaning — a year ago", value: 0.25, unit: "ratio" },
          ],
        },
      ],
    },
    {
      id: "dd-algo",
      label: "Matching engine latency and acceptance",
      question: "Did the January rewrite break the matching?",
      cost: 2,
      evidenceFor: ["product.algo"],
      readsAs:
        "Where a professional is free within 4 km, the engine matches in 40 seconds at 81% first-offer acceptance — both better than before the rewrite. It fails only where there is nobody to offer the job to, which is not a matching problem.",
      reveals: [
        {
          id: "p-mk-algo",
          kind: "segments",
          title: "Matching engine, before and after the January rewrite",
          dimension: "Metric",
          rows: [
            { label: "p95 match latency, after (seconds)", value: 40, unit: "count" },
            { label: "p95 match latency, before (seconds)", value: 71, unit: "count" },
            { label: "First-offer acceptance, after", value: 0.81, unit: "ratio" },
            { label: "First-offer acceptance, before", value: 0.76, unit: "ratio" },
            { label: "Match rate where supply is within 4 km", value: 0.94, unit: "ratio" },
          ],
        },
      ],
    },
    {
      id: "dd-pricing",
      label: "What we charge against what else is available",
      question: "Are we priced wrong?",
      cost: 2,
      evidenceFor: ["demand.price"],
      readsAs:
        "The average ticket of ₹840 sits mid-market against ₹805 and ₹890 for the two comparable platforms, and the local unorganised alternative is ₹610. There is no pricing error to correct — and the last 6% rise cost 15% of bookings, so this is a category customers leave easily.",
      reveals: [
        {
          id: "p-mk-pricing",
          kind: "segments",
          title: "Average ticket, comparable services",
          dimension: "Platform",
          rows: [
            { label: "Ghar Sewa", value: 840, unit: "inr" },
            { label: "Competitor A", value: 805, unit: "inr" },
            { label: "Competitor B", value: 890, unit: "inr" },
            { label: "Local salon or technician", value: 610, unit: "inr" },
          ],
        },
        {
          id: "p-mk-elasticity",
          kind: "note",
          title: "The last time we raised the ticket",
          body:
            "A 6% rise fourteen months ago cost 15% of bookings within two months and they did not come back — an elasticity of about 2.5. " +
            "The reason is on the row above: for salon at home and small repairs, the alternative is a technician down the road at ₹610 and a phone call. Switching costs almost nothing.",
        },
      ],
    },
  ],

  causes: [
    { id: "supply", parentId: null, label: "The professional side", verdict: "The right branch — but not for the reason the supply team thinks." },
    {
      id: "supply.density",
      parentId: "supply",
      label: "Supply is in the wrong zones at the wrong hours",
      verdict:
        "This was it. 71% of new professionals signed up in central zones already matching at 92%, while 44% of new demand came from three suburbs at commute hours. Central utilisation is 31% and deficit-suburb peak utilisation is 84% — idle and short at the same time, on the same platform.",
    },
    {
      id: "supply.count",
      parentId: "supply",
      label: "We simply do not have enough professionals",
      verdict:
        "Not supported. Strip out three zones in a three-hour window and platform match rate is 91%, a point better than last year. National headcount was never the binding constraint; where it stands is.",
    },
    {
      id: "supply.churn",
      parentId: "supply",
      label: "Professionals are leaving faster than we sign them",
      verdict:
        "Not supported. 90-day retention is 62% against 63% last year and earnings per active hour are up ₹3. Nothing changed on the retention side.",
    },
    { id: "demand", parentId: null, label: "The customer side", verdict: "Grew hard, and the growth was not the mistake — where it was pointed was." },
    {
      id: "demand.mix",
      parentId: "demand",
      label: "The new demand is for services we cannot staff",
      verdict:
        "Not supported. Category mix moved under two points in a year. The new demand wants the same services from the same professionals, in different places.",
    },
    {
      id: "demand.price",
      parentId: "demand",
      label: "We are priced wrong for the market",
      verdict:
        "Not supported. ₹840 sits between the two comparable platforms at ₹805 and ₹890. Nothing in the pricing explains a match-rate collapse.",
    },
    { id: "product", parentId: null, label: "The matching product", verdict: "Better than it was, which took it off the list quickly." },
    {
      id: "product.algo",
      parentId: "product",
      label: "The January matching rewrite made things worse",
      verdict:
        "Not supported. Latency went from 71 seconds to 40 and first-offer acceptance from 76% to 81%. Where supply exists within 4 km the engine matches 94% of the time. It cannot offer a job to somebody who is not there.",
    },
  ],
  trueCauseIds: ["supply.density"],

  interventions: [
    {
      id: "iv-zone-supply",
      label: "Recruit and schedule against the gap",
      pitch:
        "Zone-and-hour recruitment targets instead of national ones, a commute-hour earnings guarantee in the three deficit suburbs, and travel-time compensation so a Whitefield morning is worth taking.",
      addresses: "supply.density",
      cost: { sprints: 2, rupees: 5 * CRORE },
      minSprints: 2,
      effects: {
        whenRootCause: [
          { driver: "matchRate", deltaPct: 0.12 },
          { driver: "proIncentives", deltaPct: 0.18 },
        ],
        otherwise: [
          { driver: "matchRate", deltaPct: 0.02 },
          { driver: "proIncentives", deltaPct: 0.18 },
        ],
      },
      debrief:
        "The core of the answer. Guarantees cost 18% more incentive, and they buy back nine points of match rate because they are pointed at the three zone-hours where every failure lives rather than spread evenly over a platform that mostly works.",
    },
    {
      id: "iv-pro-app",
      label: "Show professionals where the demand is",
      pitch:
        "Put a live heat map in the professional app — where bookings are going unfilled, in which hour, with the surge multiplier attached — so professionals can choose to be there.",
      addresses: "supply.density",
      cost: { sprints: 1, rupees: 2.4 * CRORE },
      effects: {
        whenRootCause: [{ driver: "matchRate", deltaPct: 0.03 }],
        otherwise: [{ driver: "matchRate", deltaPct: 0.01 }],
      },
      debrief:
        "Cheap and durable. It does not create supply, it redistributes the supply you already pay for — which is the whole problem restated as a fix.",
    },
    {
      id: "iv-flex-slots",
      label: "Stop promising slots we cannot fill",
      pitch:
        "Show honest availability at booking time, and offer a small credit to move a flexible customer into an adjacent hour where a professional is already free.",
      addresses: "supply.density",
      cost: { sprints: 1, rupees: 1.6 * CRORE },
      effects: {
        whenRootCause: [
          { driver: "matchRate", deltaPct: 0.05 },
          { driver: "avgTicket", deltaPct: -0.02 },
        ],
        otherwise: [
          { driver: "matchRate", deltaPct: 0.01 },
          { driver: "avgTicket", deltaPct: -0.02 },
        ],
      },
      debrief:
        "The demand-side half of a supply problem, and the cheapest point of match rate you can buy without giving up bookings to get it. It costs 2% of the ticket in credits and stops the platform manufacturing failures by promising hours it never had.",
    },
    {
      id: "iv-demand",
      label: "Push demand 20% harder",
      pitch:
        "Growth's proposal. Demand is the only lever we have proved we can move — ₹4 crore of performance marketing puts 20% more bookings through, and supply follows the money.",
      addresses: "demand.mix",
      cost: { sprints: 1, rupees: 4 * CRORE },
      effects: {
        whenRootCause: [{ driver: "requests", deltaPct: 0.2 }],
        otherwise: [
          { driver: "requests", deltaPct: 0.2 },
          { driver: "matchRate", deltaPct: -0.07 },
        ],
      },
      debrief:
        "The most expensive mistake available, and it grows GMV about 12% on the way. Pouring requests into a marketplace that cannot fill the ones it has converts marketing spend directly into failed bookings — and a failed booking costs ₹185 and a customer.",
    },
    {
      id: "iv-recruit",
      label: "Sign 6,000 more professionals nationally",
      pitch:
        "The supply team's proposal. The pipeline is ready; activate it, put the incentive budget behind onboarding, and the shortage goes away.",
      addresses: "supply.count",
      cost: { sprints: 1, rupees: 3.5 * CRORE },
      effects: {
        whenRootCause: [
          { driver: "activePros", deltaPct: 0.17 },
          { driver: "matchRate", deltaPct: 0.1 },
          { driver: "proIncentives", deltaPct: 0.12 },
        ],
        otherwise: [
          { driver: "activePros", deltaPct: 0.17 },
          { driver: "matchRate", deltaPct: 0.04 },
          { driver: "proIncentives", deltaPct: 0.12 },
        ],
      },
      debrief:
        "The honest near-miss: it genuinely helps, because some of 6,000 new professionals land in the deficit zones by accident. You pay onboarding and incentives on all of them to move the four thousand that mattered, and utilisation falls again as the rest join the queue in the zones that were already idle.",
    },
    {
      id: "iv-retention",
      label: "Fix professional retention",
      pitch:
        "Better earnings visibility, a loyalty tier and faster payouts. Keeping the professionals we have is cheaper than signing new ones.",
      addresses: "supply.churn",
      cost: { sprints: 1, rupees: 2.2 * CRORE },
      effects: {
        whenRootCause: [
          { driver: "activePros", deltaPct: 0.06 },
          { driver: "matchRate", deltaPct: 0.05 },
          { driver: "proIncentives", deltaPct: 0.08 },
        ],
        otherwise: [
          { driver: "activePros", deltaPct: 0.06 },
          { driver: "matchRate", deltaPct: 0.01 },
          { driver: "proIncentives", deltaPct: 0.08 },
        ],
      },
      debrief:
        "Good work aimed at a metric that had not moved. Retention was 62% against 63% a year ago, so there was no leak to plug — and holding on to more professionals in zones already running at 31% utilisation adds cost without adding matches.",
    },
    {
      id: "iv-price-up",
      label: "Raise the average ticket 8%",
      pitch:
        "We sit below Competitor B and we have a waiting list. Take the price up and let the market clear on price rather than on luck.",
      addresses: "demand.price",
      cost: { sprints: 1, rupees: 0.8 * CRORE },
      effects: {
        whenRootCause: [{ driver: "avgTicket", deltaPct: 0.08 }],
        otherwise: [
          { driver: "avgTicket", deltaPct: 0.08 },
          // Elasticity of about 2.5, which is what the last rise measured — a
          // ₹610 technician down the road makes this an easy category to leave.
          { driver: "requests", deltaPct: -0.2 },
          // Rationing by price genuinely relieves a squeezed market — the same
          // supply against less demand fills a larger share of it. Leaving this
          // out would make the debrief's own argument untrue in the model.
          { driver: "matchRate", deltaPct: 0.04 },
        ],
      },
      debrief:
        "Rationing by price is a real answer to a shortage, and this is not a shortage. Fewer requests does lift match rate — the same supply against less demand — and at an elasticity of 2.5 you have bought four points of it with a fifth of your bookings. The deficit zones are still unserved; there are simply fewer people left to be failed by them.",
    },
  ],

  // Demand keeps growing on its own while match rate erodes and supply costs
  // more to hold. All three compound if the quarter is spent arguing.
  drift: [
    { driver: "requests", deltaPct: 0.04 },
    { driver: "matchRate", deltaPct: -0.03 },
    { driver: "proIncentives", deltaPct: 0.05 },
  ],
  horizonQuarters: 2,

  parInvestigation: ["dd-zone-hour", "dd-pro-supply"],
  bestAllocation: [
    { interventionId: "iv-zone-supply", sprints: 2, rupees: 5 * CRORE },
    { interventionId: "iv-pro-app", sprints: 1, rupees: 2.4 * CRORE },
    { interventionId: "iv-flex-slots", sprints: 1, rupees: 1.6 * CRORE },
  ],

  debrief: {
    causalChain: [
      "Requests grew 22% and professionals grew 19%, so at platform level the two sides look balanced.",
      "They are not in the same places: 71% of the new professionals signed up in central zones already matching at 92%, while 44% of the new requests came from three suburbs.",
      "Those three suburbs in the 8–11am and 6–9pm windows now match at 41% to 52%. They are 31% of requests and 78% of every failure.",
      "So the platform is idle and short at once — 31% utilisation in the centre, 84% at peak in the deficit suburbs.",
      "A failed booking costs ₹185 in support, credits and the customer who does not come back: a first booking that goes unfilled repeats at 21% against 68%.",
      "1.3 lakh failures a month is ₹2.41 crore — against a ₹33.6 lakh loss, which means the failures are not a symptom of the problem, they are the problem.",
    ],
    whereTheLeverageWas:
      "Three zones in a three-hour window. Every lever that works here is pointed at them and nothing else: guaranteed earnings for a Whitefield morning, a heat map that lets a professional choose to be there, and an honest slot picker that stops promising hours the platform never had. Everything that was proposed at platform level — more demand, more professionals, better retention, higher prices — spends real money across a marketplace that is already working at 91% everywhere the failures are not.",
    strongAnswer:
      "The first thing I would say is that 79% is not a number, it is an average of 92% and 44%, and the two have nothing to do with each other. Cut match rate by zone and hour and three suburbs in the commute windows are 31% of requests and 78% of failures; take them out and the platform matches at 91%, better than last year. So this is not a shortage. 71% of the professionals we added signed up in the central zones, where utilisation is 31% — people sitting online waiting — while 44% of the new demand landed in suburbs running at 84% at peak. We grew both sides and grew them in different places. What makes it urgent rather than annoying is what a failure costs: a customer whose first booking goes unfilled comes back 21% of the time against 68%, so at ₹185 a failure we are burning ₹2.41 crore a month against a ₹33.6 lakh loss. That rules out the demand push immediately — 20% more requests into these zones is 20% more failures. I would put the money into the three zone-hours specifically: earnings guarantees at commute time, a demand heat map so professionals can self-select into the gap, and an honest slot picker that stops selling hours we cannot deliver. And I would change the dashboard, because a platform-level match rate is a number that can only ever hide this.",
  },

  coachFallback: [
    {
      topic: ["zone", "hour", "density", "where", "whitefield", "suburb"],
      answer:
        "The failures are concentrated: three suburbs in the 8–11am and 6–9pm windows are 31% of requests and 78% of failures, matching at 41% to 52%. Everywhere else the platform runs at about 91%. A city-level match rate averages markets that have nothing to do with each other.",
    },
    {
      topic: ["utilisation", "idle", "waiting", "31%", "84%"],
      answer:
        "Utilisation is 31% in the central zones and 84% at peak in the deficit suburbs. Idle and short at the same time on the same platform is the signature of a distribution problem, not a shortage.",
    },
    {
      topic: ["demand", "growth", "marketing", "push", "gmv"],
      answer:
        "Pushing demand 20% raises GMV about 12% and roughly triples the loss, because the extra requests land in the zones that already cannot fill them. Every one of those failures costs ₹185 and a customer who repeats at 21% instead of 68%.",
    },
    {
      topic: ["recruit", "6000", "more professionals", "supply count", "hire"],
      answer:
        "Signing 6,000 professionals nationally does help — some of them land in the deficit zones by accident. You pay onboarding and incentives on all of them to move the four thousand that mattered, and utilisation falls further as the rest queue in zones already at 31%.",
    },
    {
      topic: ["match rate", "liquidity", "average", "79"],
      answer:
        "Match rate is jobs filled ÷ bookings requested, and it is only meaningful at the level a match actually happens — a zone, in an hour, for a service. 79% platform-wide is 92% in most of the market and 44% in the part that broke.",
    },
    {
      topic: ["failure", "failed booking", "185", "repeat", "cost"],
      answer:
        "A failed booking costs ₹41 of support, ₹90 of credit in 62% of cases and ₹54 of lost repeat value — ₹185, and 1.3 lakh of them a month is ₹2.41 crore. The loss is ₹33.6 lakh, so the failures are not a symptom of the problem, they are most of it.",
    },
    {
      topic: ["algorithm", "matching", "rewrite", "engine", "latency"],
      answer:
        "The rewrite improved things: latency 71 seconds to 40, first-offer acceptance 76% to 81%, and 94% match where a professional is free within 4 km. The engine fails only when it has nobody to offer the job to.",
    },
    {
      topic: ["churn", "retention", "professional retention"],
      answer:
        "Professional retention is 62% against 63% a year ago and earnings per active hour are up ₹3. Nothing changed there, and holding more professionals in zones running at 31% utilisation adds cost without adding matches.",
    },
    {
      topic: ["price", "ticket", "raise price", "take rate"],
      answer:
        "₹840 sits between the comparable platforms at ₹805 and ₹890, so nothing in pricing explains the collapse. Raising it lifts match rate arithmetically by removing demand — you have bought the improvement with the customers who left, and the deficit zones are still unserved.",
    },
  ],
};
