/**
 * "38% more signups, and exactly the same paying customers."
 *
 * The activation scenario, and the fourth of the beginner set. Teaches the
 * difference between **acquisition** and **activation**, and the one habit that
 * separates them: before buying more of the top of a funnel, find out what share
 * of it reaches the bottom — and whether anything downstream is already full.
 *
 * ── The truth, for whoever maintains this ─────────────────────────────────
 *
 * Onboarding will not let a shop raise its first invoice until it has supplied a
 * GST number and a photograph of a business registration document, and a human
 * team has approved both. Two things follow, and the second is the one everybody
 * misses.
 *
 * The first is ordinary friction: of 17,500 installs a month, 12,950 reach the
 * business-details screen and 6,300 submit it. That is bad and it is legible.
 *
 * The second is a **capacity constraint**. The verification team can clear about
 * 4,200 applications a month and has been at that ceiling for a year. So
 * activations are `min(submissions, review capacity)` — and the campaign, which
 * genuinely raised installs 38%, raised submissions from 4,572 to 6,300 and
 * activations from 4,200 to 4,200. The paid base moved 3.9%, which at these
 * numbers is a rounding error and reads to everyone in the room as flat.
 *
 * That is why this scenario needs the `min` driver kind and could not be written
 * without it. A funnel of pure rates cannot express "we bought 38% more and got
 * none of it", because rates multiply: double the installs and you double
 * everything downstream. A ceiling is the only shape that produces the number on
 * the dashboard, and finding a ceiling is a different skill from finding a leak.
 *
 * The single sentence the scenario exists to land: **a step gated on paperwork
 * is a product decision, not a compliance one.** The law wants a GSTIN on a
 * filed tax invoice. It does not want one before a shopkeeper is allowed to see
 * what the app does, and nobody here has ever separated those two claims.
 *
 * ── Balance notes ─────────────────────────────────────────────────────────
 *
 * `iv-price-cut` is the sharpest trap, and it is deliberately a *real* lever
 * rather than a blunted one — it keeps its full effect through an `otherwise`
 * override, because a price cut works whatever else is wrong with the product.
 * It lifts paid conversion 3.1 points and takes 33.4% off ARPU, so it grows the
 * subscriber base and shrinks the revenue at the same time. That is the most
 * legible statement in the catalogue that more customers is not more money.
 *
 * `iv-scale-campaign` is the second trap and the one with the CEO behind it. It
 * buys exactly the installs the media plan promises — the campaign is not badly
 * run — and almost no customers, because the constraint it is pushing against
 * does not move. Every extra rupee of it reaches the P&L through `spend`.
 *
 * `iv-guided-setup` is the quietest trap and worth keeping: it lifts submissions
 * into a queue that is already full, so it changes activations by nothing at all
 * while costing a sprint and ₹7 lakh. Sending more demand at a bottleneck is the
 * classic wrong answer to a bottleneck, and it should be available to get wrong.
 *
 * `tests/sim-scenario.test.ts` brute-forces every affordable combination and
 * `scripts/best-allocation.ts` re-derives the ceiling, so a retune that lets any
 * of them win fails the suite rather than the student.
 */

import type { SimScenario } from "../types";

const LAKH = 100_000;

export const vyaparMitraActivation: SimScenario = {
  slug: "vyapar-mitra-activation",
  title: "Vyapar Mitra: 38% more signups and the same 11,000 paying shops",
  company: "Vyapar Mitra",
  premise:
    "A billing app for small shops added 38% more installs and almost no paying customers. The CEO wants to spend more on the campaign. Work out where the people are going first.",
  situation:
    "You are the PM for growth at Vyapar Mitra, a billing and GST app for small Indian shops — kirana stores, chemists, hardware shops. " +
    "A ₹1.4 crore install campaign ran last quarter and worked: installs are up 38% and the cost per install held. " +
    "Paid subscribers have barely moved. They were about 10,600 before the campaign and they are about 11,000 now, and nobody in the company can explain the gap between those two facts. " +
    "The CEO's reading is that the campaign is finally getting traction and should be doubled. The head of sales says the price is too high for a kirana store and has been saying it for a year. " +
    "You have 6 analyst-days to find out what is actually happening, then 3 sprints and ₹24 lakh to do something about it.",
  difficulty: "Easy",
  /**
   * On the saturating engine, so money buys a response curve rather than a
   * straight line and committed rupees reach the P&L. Both matter here: the
   * traps are things you buy, and a scenario where buying is free would let a
   * candidate fund every one of them and still land on the ceiling.
   */
  engine: "v2",
  periodNoun: "month",

  // ── Teaching ────────────────────────────────────────────────────────────
  teaching: {
    showMetricMap: true,
    primer: {
      intro:
        "A subscription business is a leaky bucket with a tap on top. The campaign controls the tap; everything below decides how much of the water stays in. The terms below are one link each, in the order the money travels — and the metric map on the right shows the whole chain with live numbers, so you never have to hold it in your head.",
      terms: [
        {
          term: "Install",
          plain: "Somebody downloaded the app. That is all it means.",
          matters:
            "It is the easiest number in the business to move with money, and the furthest away from revenue. Treating it as progress is the mistake this simulation is about.",
          driver: "installs",
        },
        {
          term: "Activation",
          plain:
            "The moment a new user does the one thing the product is for. Here that is raising their first invoice.",
          matters:
            "It is the first point at which somebody has actually seen the product work. Nobody pays for software they have not yet used, so this is the step that decides whether an install was worth buying.",
          driver: "fastActivators",
        },
        {
          term: "Activation rate",
          plain: "The share of installs that reach that moment.",
          formula: "activated users ÷ installs",
          matters:
            "Multiply it by anything downstream and you see the real size of your funnel. A 24% activation rate means three quarters of every rupee of install spend bought nothing at all.",
          driver: "fastActivationRate",
        },
        {
          term: "Bottleneck",
          plain:
            "A step with a fixed capacity, which decides the output of everything after it no matter what arrives before it.",
          formula: "throughput = the smaller of (what arrives, what the step can handle)",
          matters:
            "This is the one to look for whenever a number refuses to move. Feed more into a full step and nothing happens — you do not get more output, you get a longer queue. Rates multiply; ceilings do not.",
          driver: "reviewCapacity",
        },
        {
          term: "Paid conversion",
          plain: "Of the people who activated, the share who start paying.",
          formula: "new paying users ÷ activated users",
          matters:
            "Read it *per segment*, never blended. A blended conversion rate averages people who have used the product with people who never got into it, and hides exactly the gap you are looking for.",
          driver: "fastConversion",
        },
        {
          term: "Churn",
          plain: "The share of paying customers who stop paying each month.",
          formula: "cancellations ÷ paying customers",
          matters:
            "It sets how long a customer stays, and therefore how much they are ever worth. At about 9% a month the average customer is with you for a bit under eleven months.",
          driver: "monthlyChurn",
        },
        {
          term: "Subscriber base",
          plain: "How many people are paying you right now.",
          formula: "new paying users per month ÷ monthly churn",
          matters:
            "It settles at that ratio and stays there. So the base can only move if the number of people joining moves — which is why a 38% rise at the top of the funnel can leave it sitting exactly where it was.",
          driver: "subscribers",
        },
        {
          term: "ARPU",
          full: "Average revenue per user",
          plain: "What one paying customer pays you in a month.",
          formula: "monthly revenue ÷ paying customers",
          matters:
            "The other half of revenue. Anything that trades ARPU for customers has to be judged on the product of the two, never on either one alone.",
          driver: "arpu",
        },
        {
          term: "CAC",
          full: "Customer acquisition cost",
          plain: "What you spent in marketing to win one *paying* customer.",
          formula: "marketing spend ÷ new paying customers",
          matters:
            "Per paying customer, not per install. Cost per install can be flat and excellent while CAC quietly climbs, and the only thing standing between the two numbers is activation.",
          driver: "cacPerPaid",
        },
        {
          term: "Payback period",
          plain:
            "How many months of a customer's money it takes to earn back what you paid to win them.",
          formula: "CAC ÷ monthly contribution per customer",
          matters:
            "Compare it with how long customers stay. A seven-month payback on an eleven-month customer works; the same payback on a five-month customer is a business that never gets its money back.",
          driver: "paybackMonths",
        },
        {
          term: "Contribution",
          plain: "The money left each month after what it costs to serve customers and to win them.",
          formula: "gross profit − marketing − programme cost",
          matters:
            "The number this run is judged on, and the only one that sees customers, price and spend at the same time.",
          driver: "contribution",
        },
      ],
      worked: [
        "17,500 installs a month at ₹96 each is ₹16.8 lakh of marketing spend.",
        "36% of them — 6,300 shops — finish the business-details screen and submit their GST papers.",
        "The verification team can approve about 4,200 a month. So 4,200 activate, 2,100 sit in a queue until they give up, and the activation rate is 4,200 ÷ 17,500 = 24%.",
        "Before the campaign, 12,700 installs produced 4,572 submissions — and the same 4,200 approvals. That is the whole mystery: the step that decides the output was already full.",
        "Those 4,200 convert to paid at 22% (924 customers). The other 13,300 convert at 0.8% (106). So 1,030 people start paying each month.",
        "At 9.37% monthly churn the base settles at 1,030 ÷ 0.0937 ≈ 11,000 subscribers — the number that will not move.",
        "11,000 × ₹299 is ₹32.88 lakh of revenue and ₹26.96 lakh of gross profit at 82% margin, less ₹16.8 lakh of marketing and ₹3.5 lakh of programme cost: ₹6.66 lakh a month.",
        "And CAC per paying customer is ₹16.8 lakh ÷ 1,030 = ₹1,630, against ₹245 of contribution a month — a payback of about seven months on a customer who stays under eleven.",
      ],
    },
  },

  // ── The model ───────────────────────────────────────────────────────────
  northStar: "contribution",
  reported: [
    "subscribers",
    "newPaid",
    "subscriptionRevenue",
    "fastActivationRate",
    "cacPerPaid",
    "paybackMonths",
    "grossProfit",
  ],
  drivers: [
    { id: "installs", kind: "input", label: "Monthly installs", unit: "count", goodDirection: "up", baseline: 17_500 },
    { id: "costPerInstall", kind: "input", label: "Cost per install", unit: "inr", goodDirection: "down", baseline: 96 },
    {
      id: "marketingSpend",
      kind: "product",
      label: "Marketing spend / month",
      unit: "inr",
      goodDirection: "down",
      of: ["installs", "costPerInstall"],
    },

    /**
     * The two halves of the gate, and the whole scenario.
     *
     * `attemptRate` is friction — the share of installs willing to hand over a
     * GSTIN and photograph a registration certificate at all. `reviewCapacity`
     * is throughput — what the human verification team can approve in a month.
     * Activation is the smaller of the two, which is why the campaign bought
     * 38% more installs and exactly zero more activations.
     *
     * Both are inputs because both are levers, and a scenario that modelled only
     * the first could not produce the number on the dashboard: a funnel of pure
     * rates multiplies, so 38% more installs would be 38% more of everything.
     */
    { id: "attemptRate", kind: "input", label: "Submit their GST papers", unit: "ratio", goodDirection: "up", baseline: 0.36 },
    { id: "attempts", kind: "product", label: "Applications submitted / month", unit: "count", goodDirection: "up", of: ["installs", "attemptRate"] },
    { id: "reviewCapacity", kind: "input", label: "Applications the team can approve / month", unit: "count", goodDirection: "up", baseline: 4_200 },
    {
      id: "fastActivators",
      kind: "min",
      label: "Approved, and raised a first invoice",
      unit: "count",
      goodDirection: "up",
      of: ["attempts", "reviewCapacity"],
    },
    // Derived, so no intervention can move it directly — the only way to lift
    // activation is to lift one of the two things it is made of, which is the
    // decision the scenario is about.
    {
      id: "fastActivationRate",
      kind: "quotient",
      label: "Activation rate",
      unit: "ratio",
      goodDirection: "up",
      numerator: "fastActivators",
      denominator: "installs",
    },
    {
      id: "slowUsers",
      kind: "difference",
      label: "Never got in",
      unit: "count",
      goodDirection: "down",
      minuend: "installs",
      subtrahend: "fastActivators",
    },

    { id: "fastConversion", kind: "input", label: "Paid conversion, activated users", unit: "ratio", goodDirection: "up", baseline: 0.22 },
    { id: "slowConversion", kind: "input", label: "Paid conversion, everyone else", unit: "ratio", goodDirection: "up", baseline: 0.008 },
    { id: "fastPaid", kind: "product", label: "New paid from activated users", unit: "count", goodDirection: "up", of: ["fastActivators", "fastConversion"] },
    { id: "slowPaid", kind: "product", label: "New paid from everyone else", unit: "count", goodDirection: "up", of: ["slowUsers", "slowConversion"] },
    { id: "newPaid", kind: "sum", label: "New paying customers / month", unit: "count", goodDirection: "up", of: ["fastPaid", "slowPaid"] },

    { id: "one", kind: "constant", label: "1", unit: "count", goodDirection: "up", value: 1 },
    { id: "monthlyChurn", kind: "input", label: "Monthly churn", unit: "ratio", goodDirection: "down", baseline: 0.0937 },
    // The base settles at joiners ÷ churn, so it can only move if joiners move.
    { id: "subscribers", kind: "quotient", label: "Paying subscribers", unit: "count", goodDirection: "up", numerator: "newPaid", denominator: "monthlyChurn" },
    { id: "lifetimeMonths", kind: "quotient", label: "Months a customer stays", unit: "count", goodDirection: "up", numerator: "one", denominator: "monthlyChurn" },

    { id: "arpu", kind: "input", label: "Price per month", unit: "inr", goodDirection: "up", baseline: 299 },
    { id: "subscriptionRevenue", kind: "product", label: "Revenue / month", unit: "inr", goodDirection: "up", of: ["subscribers", "arpu"] },
    { id: "grossMarginRate", kind: "input", label: "Gross margin", unit: "ratio", goodDirection: "up", baseline: 0.82 },
    { id: "grossProfit", kind: "product", label: "Gross profit / month", unit: "inr", goodDirection: "up", of: ["subscriptionRevenue", "grossMarginRate"] },
    { id: "marginPerSub", kind: "product", label: "Contribution per subscriber / month", unit: "inr", goodDirection: "up", of: ["arpu", "grossMarginRate"] },
    { id: "ltv", kind: "product", label: "Lifetime value", unit: "inr", goodDirection: "up", of: ["marginPerSub", "lifetimeMonths"] },

    { id: "cacPerPaid", kind: "quotient", label: "CAC per paying customer", unit: "inr", goodDirection: "down", numerator: "marketingSpend", denominator: "newPaid" },
    { id: "paybackMonths", kind: "quotient", label: "Payback period", unit: "count", goodDirection: "down", numerator: "cacPerPaid", denominator: "marginPerSub" },

    /**
     * What the squad and its tooling cost to run, per month.
     *
     * The baseline is the standing cost of having a team on this at all; what
     * the candidate commits inflates it (see `spend`). Without a driver like
     * this the money budget is free inside the model, and funding everything
     * would never be a mistake — which is precisely the behaviour the three
     * traps exist to punish.
     */
    { id: "programmeCost", kind: "input", label: "Programme cost / month", unit: "inr", goodDirection: "down", baseline: 3.5 * LAKH },
    { id: "totalCost", kind: "sum", label: "Marketing and programme cost", unit: "inr", goodDirection: "down", of: ["marketingSpend", "programmeCost"] },
    {
      id: "contribution",
      kind: "difference",
      label: "Monthly contribution",
      unit: "inr",
      goodDirection: "up",
      minuend: "grossProfit",
      subtrahend: "totalCost",
    },
  ],

  // ── The free dashboard ──────────────────────────────────────────────────
  dashboard: [
    {
      id: "p-vm-headline",
      kind: "stat",
      title: "Last month",
      caption: "The campaign delivered exactly what it promised. Look at the third tile.",
      tiles: [
        { label: "Installs", value: 17_500, unit: "count", deltaPct: 0.38, goodDirection: "up" },
        { label: "Cost per install", value: 96, unit: "inr", deltaPct: 0.02, goodDirection: "down" },
        { label: "Paying subscribers", value: 10_997, unit: "count", deltaPct: 0.039, goodDirection: "up" },
        { label: "Revenue", value: 32.88 * LAKH, unit: "inr", deltaPct: 0.039, goodDirection: "up" },
        { label: "Marketing spend", value: 16.8 * LAKH, unit: "inr", deltaPct: 0.41, goodDirection: "down" },
        { label: "Monthly contribution", value: 6.66 * LAKH, unit: "inr", deltaPct: -0.42, goodDirection: "up" },
      ],
    },
    {
      id: "p-vm-funnel",
      kind: "funnel",
      title: "What happens to 17,500 installs",
      caption:
        "Every step is a share of the one above it. There are two big drops here, and they are not the same kind of drop.",
      steps: [
        { label: "Installed the app", value: 17_500 },
        { label: "Opened onboarding", value: 15_750 },
        { label: "Reached the business-details step", value: 12_950 },
        { label: "Submitted GST details for review", value: 6_300 },
        { label: "Approved, and raised a first invoice", value: 4_200 },
        { label: "Started paying", value: 1_030 },
      ],
    },
    {
      id: "p-vm-scissors",
      kind: "timeseries",
      title: "Installs and paying subscribers, six months",
      caption: "The campaign started in M-3. Both lines are correct.",
      series: [
        {
          label: "Installs (thousands)",
          unit: "count",
          points: [
            { period: "M-5", value: 12.6 },
            { period: "M-4", value: 12.7 },
            { period: "M-3", value: 14.1 },
            { period: "M-2", value: 16.2 },
            { period: "M-1", value: 17.1 },
            { period: "M-0", value: 17.5 },
          ],
        },
        {
          label: "Paying subscribers (thousands)",
          unit: "count",
          points: [
            { period: "M-5", value: 10.5 },
            { period: "M-4", value: 10.6 },
            { period: "M-3", value: 10.7 },
            { period: "M-2", value: 10.8 },
            { period: "M-1", value: 10.9 },
            { period: "M-0", value: 11.0 },
          ],
        },
      ],
    },
    // ── Decoys ──────────────────────────────────────────────────────────
    //
    // Both panels below are true, correctly derived, and answer a question
    // nobody needed answered. Neither introduces a concept the primer has not
    // already taught, and neither is evidence for any cause — so the board takes
    // reading without the investigation being short-circuited by it.
    {
      id: "p-vm-app-health",
      kind: "stat",
      title: "App health",
      caption: "The engineering scorecard for the same month.",
      tiles: [
        { label: "Crash-free sessions", value: 0.994, unit: "ratio", goodDirection: "up" },
        { label: "Cold start (seconds)", value: 1.8, unit: "count", goodDirection: "down" },
        { label: "Play Store rating", value: 4.4, unit: "count", goodDirection: "up" },
        { label: "Invoices raised per active shop", value: 62, unit: "count", goodDirection: "up" },
      ],
    },
    {
      id: "p-vm-geo",
      kind: "segments",
      title: "Installs by city tier",
      caption: "Where the campaign landed. The mix is almost exactly what was planned.",
      dimension: "City tier",
      rows: [
        { label: "Tier 1", value: 4_375, unit: "count", deltaPct: 0.34 },
        { label: "Tier 2", value: 7_700, unit: "count", deltaPct: 0.41 },
        { label: "Tier 3 and below", value: 5_425, unit: "count", deltaPct: 0.37 },
      ],
    },
    {
      id: "p-vm-room",
      kind: "note",
      title: "What the room is saying",
      body:
        "CEO: installs are up 38% and the cost per install held. That is the campaign working. Put another crore behind it. " +
        "Head of sales: I have said for a year that ₹299 is too much for a kirana store. Cut it to ₹199 and watch what happens. " +
        "Head of engineering: the app is in the best shape it has ever been — 99.4% crash-free, 4.4 on the Play Store. Whatever this is, it is not the app. " +
        "Compliance: the GST number is not optional, it is the law. We cannot raise an invoice without one. " +
        "Operations, in a message nobody replied to: we are four people and we have been approving about 4,200 shops a month since last Diwali. Is somebody going to tell me what the campaign was expecting?",
    },
  ],

  budget: { analystDays: 6, sprints: 3, rupees: 24 * LAKH },

  // ── The data you can buy (12 days of pulls, 6 to spend) ─────────────────
  drilldowns: [
    {
      id: "dd-onboarding",
      label: "Where installs stop inside onboarding",
      question: "Of the people who install, where exactly do they give up?",
      cost: 2,
      evidenceFor: ["onboarding.paperwork"],
      readsAs:
        "Two walls, not one. 6,300 of 17,500 installs submit their GST papers — and only 4,200 are approved, because that is everything a four-person verification team can process in a month. The second number has not changed in a year, campaign or no campaign.",
      reveals: [
        {
          id: "p-vm-dropoff",
          kind: "funnel",
          title: "Onboarding, step by step",
          steps: [
            { label: "Installed", value: 17_500 },
            { label: "Signed up with a phone number", value: 15_750 },
            { label: "Entered shop name and address", value: 14_490 },
            { label: "Reached 'Add your GST details'", value: 12_950 },
            { label: "Entered a GSTIN", value: 8_910 },
            { label: "Uploaded a business proof and submitted", value: 6_300 },
            { label: "Approved by the verification team", value: 4_200 },
          ],
        },
        {
          id: "p-vm-queue",
          kind: "timeseries",
          title: "Applications submitted and applications approved",
          caption: "One of these lines responds to marketing. The other one is four people.",
          series: [
            {
              label: "Submitted",
              unit: "count",
              points: [
                { period: "M-5", value: 4_530 },
                { period: "M-4", value: 4_572 },
                { period: "M-3", value: 5_080 },
                { period: "M-2", value: 5_830 },
                { period: "M-1", value: 6_160 },
                { period: "M-0", value: 6_300 },
              ],
            },
            {
              label: "Approved",
              unit: "count",
              points: [
                { period: "M-5", value: 4_190 },
                { period: "M-4", value: 4_200 },
                { period: "M-3", value: 4_205 },
                { period: "M-2", value: 4_198 },
                { period: "M-1", value: 4_210 },
                { period: "M-0", value: 4_200 },
              ],
            },
          ],
        },
        {
          id: "p-vm-dropoff-note",
          kind: "note",
          title: "What the screen asks for, and what happens next",
          body:
            "The business-details step is mandatory and comes before anything else in the product is reachable. It asks for a GSTIN, a photograph of a registration certificate and a bank account, and then holds the account for a manual review. " +
            "45% of installs abandon on that screen without typing anything. A further 15% type a GSTIN and stop at the document upload. " +
            "Of the 6,300 who do submit, about 4,200 are approved and about 2,100 are still waiting when they give up: the median wait was four hours eighteen months ago and is nine days now. The team is four people and has not grown. " +
            "The support inbox carries 2,300 messages a month that are some version of the same sentence: I do not have a GST number, can I still use this?",
        },
      ],
    },
    {
      id: "dd-activation-cohort",
      label: "Paid conversion by whether they ever got in",
      question: "Does it actually matter whether somebody raises a first invoice?",
      cost: 2,
      dependsOn: ["dd-onboarding"],
      evidenceFor: ["onboarding.paperwork"],
      readsAs:
        "It is the whole game. Get approved and raise an invoice inside 48 hours and you convert at 22%. Do not, and you convert at 0.8% — twenty-seven times worse. 76% of installs are in the second group, and the campaign bought 38% more of them and not one more of the first.",
      reveals: [
        {
          id: "p-vm-cohort",
          kind: "segments",
          title: "Paid conversion by time to first invoice",
          dimension: "Time to first invoice",
          rows: [
            { label: "Within 48 hours (24% of installs)", value: 0.22, unit: "ratio" },
            { label: "Later, after a wait in the queue (5% of installs)", value: 0.061, unit: "ratio" },
            { label: "Never raised one (71% of installs)", value: 0.004, unit: "ratio" },
          ],
        },
        {
          id: "p-vm-cohort-note",
          kind: "note",
          title: "The arithmetic of the campaign",
          body:
            "4,200 installs a month are approved inside 48 hours and produce 924 paying customers. The other 13,300 produce 106. So 24% of the installs produce 90% of the paying customers. " +
            "Now put the campaign through that. Installs went from 12,700 to 17,500, so submissions went from 4,572 to 6,300 — and approvals went from 4,200 to 4,200, because that is the ceiling. " +
            "New paying customers therefore went from about 992 a month to about 1,030, and every one of those extra 38 came from the 0.8% cohort. At 9.37% churn the base settles at joiners ÷ churn, so it moved from about 10,590 to about 11,000: up 3.9%, on 38% more installs and 41% more marketing spend.",
        },
      ],
    },
    {
      id: "dd-price",
      label: "What shops say about the price",
      question: "Is ₹299 a month simply too expensive for a kirana store?",
      cost: 2,
      evidenceFor: ["demand.price"],
      readsAs:
        "Price is a real objection and a small one. Among shops that actually reached the product, 12% name price as the reason they did not subscribe; 61% never got far enough to have an opinion about it. The people the head of sales is quoting are the ones who already got in.",
      reveals: [
        {
          id: "p-vm-price",
          kind: "segments",
          title: "Why they did not subscribe, from 900 exit interviews",
          dimension: "Reason given",
          rows: [
            { label: "Could not finish setting it up, or gave up waiting", value: 0.61, unit: "ratio" },
            { label: "Too expensive", value: 0.12, unit: "ratio" },
            { label: "Do not need billing software", value: 0.11, unit: "ratio" },
            { label: "Using a competitor", value: 0.09, unit: "ratio" },
            { label: "Something else", value: 0.07, unit: "ratio" },
          ],
        },
        {
          id: "p-vm-price-note",
          kind: "note",
          title: "What a price test showed",
          body:
            "A ₹199 price was tested against ₹299 on 4,000 approved users for six weeks. Paid conversion rose from 22.0% to 25.1% — a real and repeatable 3.1 points. " +
            "Revenue per subscriber fell 33.4%, which across the base is a much bigger number than the conversion lift, and the test was stopped. " +
            "Nobody has run the same test on the 71% who never got in, because there is nothing to show them a price for.",
        },
      ],
    },
    {
      id: "dd-source",
      label: "Install quality by campaign source",
      question: "Did the campaign buy us the wrong kind of shop?",
      cost: 2,
      evidenceFor: ["acquisition.quality"],
      readsAs:
        "It bought roughly the same shop it always did. Submission rates run between 34% and 39% across every source including organic, so the campaign did not lower the quality of the funnel — it poured more people at a step that was already full.",
      reveals: [
        {
          id: "p-vm-source",
          kind: "segments",
          title: "Share who submit their GST papers, by source",
          dimension: "Source",
          rows: [
            { label: "Organic / word of mouth", value: 0.39, unit: "ratio" },
            { label: "Play Store search", value: 0.38, unit: "ratio" },
            { label: "Campaign — video", value: 0.35, unit: "ratio" },
            { label: "Campaign — performance", value: 0.34, unit: "ratio" },
            { label: "Distributor referral", value: 0.37, unit: "ratio" },
          ],
        },
        {
          id: "p-vm-source-note",
          kind: "note",
          title: "Read this one carefully",
          body:
            "A difference that shows up everywhere you look was never about where you were looking. Organic installs — people who came looking for the product by name — submit at 39%, five points above the campaign's worst source and still nowhere near a working funnel. " +
            "And it would not matter if they were better. Approvals are capped at about 4,200 a month whoever submits, so a source that submitted at 80% would produce exactly as many activated shops as one that submitted at 34%. Improving the quality of what arrives at a full step does nothing.",
        },
      ],
    },
    {
      id: "dd-app-quality",
      label: "Is the app itself getting in the way?",
      question: "Are crashes, speed or confusion losing people during setup?",
      cost: 2,
      evidenceFor: ["onboarding.complexity"],
      readsAs:
        "No. Crash-free sessions run at 99.4% and the abandoned sessions are not crashing — the median user sits on the business-details screen for 71 seconds and closes the app deliberately. This is a decision people are making, not a failure they are hitting.",
      reveals: [
        {
          id: "p-vm-quality",
          kind: "segments",
          title: "The business-details screen, instrumented",
          dimension: "Measure",
          rows: [
            { label: "Sessions ending in a crash", value: 0.006, unit: "ratio" },
            { label: "Median seconds on the screen before leaving", value: 71, unit: "count" },
            { label: "Left after opening the GSTIN help link", value: 0.29, unit: "ratio" },
            { label: "Returned to the screen a second time", value: 0.18, unit: "ratio" },
          ],
        },
      ],
    },
    {
      id: "dd-competition",
      label: "What the nearest competitor is doing",
      question: "Are we losing these shops to somebody cheaper?",
      cost: 2,
      evidenceFor: ["demand.competition"],
      readsAs:
        "Nine per cent of the shops we lose go to a competitor, and the interesting thing is not the price — the competitor is ₹249, barely cheaper. It lets you raise three invoices before it asks who you are, and it has no review queue at all.",
      reveals: [
        {
          id: "p-vm-competition",
          kind: "segments",
          title: "Us against the two nearest competitors",
          dimension: "Measure",
          rows: [
            { label: "Our price", value: 299, unit: "inr" },
            { label: "Competitor A price", value: 249, unit: "inr" },
            { label: "Competitor B price", value: 349, unit: "inr" },
            { label: "Our invoices before GST details are demanded", value: 0, unit: "count" },
            { label: "Competitor A invoices before GST details are demanded", value: 3, unit: "count" },
            { label: "Competitor B invoices before GST details are demanded", value: 10, unit: "count" },
          ],
        },
        {
          id: "p-vm-competition-note",
          kind: "note",
          title: "Both of them are subject to the same law",
          body:
            "A GST invoice needs a GSTIN on it. Neither competitor has found a way around that, and neither has tried. What they have done is separate two questions our onboarding treats as one: may this shop issue a legal tax invoice, and may this shop use the app. " +
            "Competitor A lets a new shop raise three invoices marked 'draft — not a tax invoice' before it asks for anything. Competitor B lets you raise ten. Both collect the GSTIN before the first invoice is *filed*, which is the moment the law actually cares about. " +
            "Neither runs a manual review: both check the number against the government API in about four seconds, and route to a human only when the check fails.",
        },
      ],
    },
  ],

  // ── The hypothesis space (9 causes, one level) ──────────────────────────
  causes: [
    { id: "onboarding", parentId: null, label: "Getting started in the app", verdict: "The right branch, and the answer is one screen and the four people behind it." },
    {
      id: "onboarding.paperwork",
      parentId: "onboarding",
      label: "The GST gate blocks activation, and its review queue caps it",
      verdict:
        "This was it, and it has two halves. 64% of installs will not hand over a GSTIN and a photographed certificate before they have seen the product work; of the 36% who do, a four-person team can approve about 4,200 a month and no more. Activation is the smaller of those two numbers, which is why 38% more installs produced no more activations at all.",
    },
    {
      id: "onboarding.complexity",
      parentId: "onboarding",
      label: "The app is too complicated for a small shopkeeper to set up",
      verdict:
        "Not supported. 99.4% of sessions are crash-free, the median abandoning user sits on the screen for 71 seconds and closes the app deliberately, and shops that do get through raise 62 invoices a month each. They are not confused by the product; they are refused entry to it, and then made to queue.",
    },
    { id: "demand", parentId: null, label: "What shopkeepers will pay for", verdict: "Real objections, all of them raised by people who had already got in." },
    {
      id: "demand.price",
      parentId: "demand",
      label: "₹299 a month is too much for a small shop",
      verdict:
        "True in a small way, and a trap. 12% of exit interviews name price — against 61% who could not finish setting it up or gave up waiting. A ₹199 test lifted conversion 3.1 points and cut revenue per subscriber a third, so acting on it makes the number worse rather than better.",
    },
    {
      id: "demand.competition",
      parentId: "demand",
      label: "A cheaper competitor is taking the shops we lose",
      verdict:
        "Not supported as the cause, and worth reading anyway. Only 9% of losses go to a competitor, and the competitor's advantage is not its ₹249 price — it is three invoices before anybody is asked who they are, and an API check instead of a review queue. They are beating us at onboarding, which is the same finding by another route.",
    },
    { id: "acquisition", parentId: null, label: "Who the campaign brought in", verdict: "The campaign did exactly what it was asked to do." },
    {
      id: "acquisition.quality",
      parentId: "acquisition",
      label: "The campaign bought us low-intent installs",
      verdict:
        "Not supported, and it could not have mattered. Submission rates run 34–39% across every source, with organic at the top. More importantly, approvals cap at 4,200 a month whoever submits — so even a source that submitted at 80% would have produced exactly the same number of activated shops.",
    },
    {
      id: "acquisition.cost",
      parentId: "acquisition",
      label: "Installs have become too expensive to be worth buying",
      verdict:
        "Not the cause, though it is drifting: cost per install is up 2% and rising about 5% a month. It is the wrong number to be watching. Cost per install held almost perfectly steady while CAC per paying customer went from ₹1,204 to ₹1,630, and the only thing between those two numbers is activation.",
    },
  ],
  trueCauseIds: ["onboarding.paperwork"],

  // ── What you can spend the month on ─────────────────────────────────────
  interventions: [
    {
      id: "iv-invoice-first",
      label: "Let them raise the first invoice before asking for anything",
      pitch:
        "Move the business-details screen behind the first invoice. A new shop signs up with a phone number, raises invoices marked 'draft — not a tax invoice', and is asked for a GSTIN at the point it wants to file one.",
      addresses: "onboarding.paperwork",
      cost: { sprints: 2, rupees: 12 * LAKH },
      minSprints: 2,
      effects: {
        whenRootCause: [
          // Both halves of the gate have to move. Lifting willingness alone
          // sends more people at a queue that is already full; lifting the queue
          // alone leaves 64% of installs still refusing to join it.
          { driver: "attemptRate", deltaPct: 0.55 },
          { driver: "reviewCapacity", deltaPct: 2.2 },
          // The people this lets in are, on average, less certain than the ones
          // who were already pushing through a document upload and a nine-day
          // wait. If it were free the decision would not be worth making.
          { driver: "fastConversion", deltaPct: -0.16 },
        ],
        otherwise: [{ driver: "attemptRate", deltaPct: 0.1 }],
      },
      debrief:
        "The fix, and it works on both halves of the gate at once: far more shops reach the product because nothing is asked of them first, and the review queue stops deciding the answer because almost nobody is in it during their first week. Activation goes from 24% of installs to about 54%. Paid conversion of that group falls from 22% to about 18.5%, because the extra people are less certain than the ones who were fighting through a document upload — and that trade is overwhelmingly worth making.",
    },
    {
      id: "iv-verify-async",
      label: "Verify the GST number from the invoice, in the background",
      pitch:
        "Drop the registration-document upload and the manual review entirely. Read the GSTIN off the first invoice the shop files, check it against the government API in four seconds, and involve a human only when the check fails.",
      addresses: "onboarding.paperwork",
      cost: { sprints: 1, rupees: 6 * LAKH },
      effects: {
        whenRootCause: [
          { driver: "reviewCapacity", deltaPct: 1.4 },
          { driver: "attemptRate", deltaPct: 0.12 },
        ],
        otherwise: [{ driver: "reviewCapacity", deltaPct: 0.15 }],
      },
      debrief:
        "The other half of the same screen, and the cheaper half. It removes the ceiling rather than raising it — an API check scales and four people do not — and it recovers the 15% of installs who type a valid GSTIN and then abandon at the document upload. Those shops are not refusing to identify themselves; they are refusing to photograph a certificate and wait nine days.",
    },
    {
      id: "iv-price-cut",
      label: "Cut the price to ₹199",
      pitch:
        "The head of sales' proposal, and it has a test behind it: ₹199 lifted paid conversion from 22.0% to 25.1% on 4,000 approved users over six weeks.",
      addresses: "demand.price",
      cost: { sprints: 1, rupees: 5 * LAKH },
      /**
       * A real lever, kept real — and the only one on this board that is a
       * switch rather than a dial.
       *
       * Two things are wrong with the engine's default arm here. The first is
       * that the off-target default saturates early and low, on the reasoning
       * that money aimed at the wrong cause stops working almost immediately.
       * That does not hold for a price cut: a lower price lifts conversion
       * whatever else is broken, because the shopper deciding is looking at the
       * price and nothing else.
       *
       * The second is subtler and is why this says `linear` rather than a
       * gentler hill. A price is not bought by the rupee. ₹299 becomes ₹199 or
       * it does not, and a saturating curve would quietly render the cut as −26%
       * of ARPU at full funding and −31% at triple, which is not a price anybody
       * set. `linear` gives the full authored effect at the asking price and
       * nothing extra for over-funding it, so the arithmetic on the card is the
       * arithmetic in the model.
       *
       * The result is a trap that is bad for the reason the debrief gives — it
       * buys customers by selling revenue — rather than because the model
       * decided a wrong diagnosis makes arithmetic stop working. A trap a
       * candidate can see through is worth more than one that is switched off.
       */
      saturation: { whenRootCause: { kind: "linear" }, otherwise: { kind: "linear" } },
      effects: {
        // ₹299 → ₹199 is −33.4%, exactly. The conversion figures are the
        // six-week test in `dd-price`: 22.0% → 25.1% on approved users, and a
        // larger relative lift among the ones who never got in, who are more
        // price-led — though it is applied to a 0.8% base, so it buys very
        // little.
        whenRootCause: [
          { driver: "arpu", deltaPct: -0.334 },
          { driver: "fastConversion", deltaPct: 0.141 },
          { driver: "slowConversion", deltaPct: 0.3 },
        ],
        otherwise: [
          { driver: "arpu", deltaPct: -0.334 },
          { driver: "fastConversion", deltaPct: 0.141 },
          { driver: "slowConversion", deltaPct: 0.3 },
        ],
      },
      debrief:
        "The sharpest trap in the scenario, because everything in the pitch is true. Conversion really does rise 3.1 points and the subscriber base really does grow — and revenue per subscriber falls a third, which is a much bigger number. You end up with more customers and less money, which is the most expensive way there is to look like you are winning.",
    },
    {
      id: "iv-scale-campaign",
      label: "Double the install campaign",
      pitch:
        "The CEO's proposal, and the one with a chart behind it: installs up 38%, cost per install flat. Put another crore through the machine while it is working.",
      addresses: "acquisition.quality",
      /**
       * Two people-weeks, and that is the whole decision.
       *
       * Doubling a campaign is not a cheap bolt-on — it is new creative, new
       * landing pages, regional variants and somebody running the buy — so it
       * costs two of the three sprints available and cannot be funded alongside
       * the two-sprint fix. That is deliberate, and it is what makes this a
       * trap rather than a footnote: the candidate is choosing what the quarter
       * is *for*, not whether to add a little media on the side.
       *
       * It is also what keeps the scenario honest. Once the gate is fixed this
       * business genuinely should buy more installs — activation goes from 24%
       * to 54% and a ₹96 install starts returning more than it costs. Blunting
       * the lever to hide that would teach a lie. Making it cost the quarter
       * teaches the truth: right idea, wrong order.
       */
      cost: { sprints: 2, rupees: 10 * LAKH },
      /**
       * Installs are exactly as buyable as the media plan says, whatever is
       * wrong with the funnel — so this keeps most of its effect rather than
       * being blunted by the off-target default. The lesson has to be that the
       * campaign worked and the business did not move, not that the campaign
       * mysteriously stopped working.
       */
      saturation: { otherwise: { kind: "hill", ceiling: 1.0, halfAt: 0.25 } },
      effects: {
        whenRootCause: [{ driver: "installs", deltaPct: 0.45 }],
        otherwise: [
          { driver: "installs", deltaPct: 0.45 },
          // Buying deeper into the same auction costs more per install.
          { driver: "costPerInstall", deltaPct: 0.12 },
        ],
      },
      debrief:
        "A bit over a third more installs, a bit over a third more people at a step that approves 4,200 a month, and 4,200 approvals. Paying customers rise about 5% and every one of them comes from the 0.8% cohort — the worst customers available to buy — while the marketing bill rises by half, because a deeper buy costs more per install. Watch the activation rate while it happens: it falls from 24% to under 18%, not because anything got worse, but because the denominator grew and the numerator could not. This is what pushing on a bottleneck looks like on a P&L — the bill is immediate and proportional, and the output is capped.",
    },
    {
      id: "iv-guided-setup",
      label: "Add a guided setup walkthrough",
      pitch:
        "An in-app tutorial with video in Hindi and four regional languages, walking a new shopkeeper through the business-details screen field by field.",
      addresses: "onboarding.complexity",
      cost: { sprints: 1, rupees: 7 * LAKH },
      effects: {
        whenRootCause: [{ driver: "attemptRate", deltaPct: 0.28 }],
        otherwise: [{ driver: "attemptRate", deltaPct: 0.06 }],
      },
      debrief:
        "The quietest way to spend a sprint on nothing. It genuinely persuades more shops to submit their papers — and submissions were never the binding step, so the extra ones join a queue that already turns 2,100 people a month away. Activations do not move, contribution falls by exactly what the walkthrough cost, and the people it helped wait nine days to find that out. Adding demand at a full step is the classic wrong answer to a bottleneck.",
    },
  ],

  /**
   * Committing the whole budget more than doubles what the programme costs to
   * run for the month.
   *
   * Scaled against the gains the fixes actually produce — a few lakh a month —
   * rather than against the budget's face value: the ₹24 lakh is a one-off
   * investment and the north star is a monthly figure, so charging the full
   * amount every month would make doing nothing the answer to everything.
   */
  spend: { driver: "programmeCost", atFullBudget: 1.6 },

  /**
   * The month not going exactly to plan.
   *
   * Installs move with the auction and with whatever else is being advertised
   * that week; conversion is measured on a few thousand approved users and
   * wobbles. Neither is drawn wide enough to drown a decision — past about 5% a
   * period a student cannot read their own fix out of the result.
   */
  noise: {
    drivers: [
      { driver: "installs", sigma: 0.03 },
      { driver: "fastConversion", sigma: 0.02 },
    ],
    driftSigma: 0.25,
  },

  // Install auctions get more expensive, and a competitor with no review queue
  // keeps taking shops off the bottom of the base. Both bleed if nobody acts.
  drift: [
    { driver: "costPerInstall", deltaPct: 0.05 },
    { driver: "monthlyChurn", deltaPct: 0.03 },
  ],
  horizonQuarters: 2,

  parInvestigation: ["dd-onboarding", "dd-activation-cohort"],
  // Certified by `pnpm tsx scripts/best-allocation.ts vyapar-mitra-activation`,
  // not chosen by hand. The shape is worth reading: the cheap lever is funded to
  // exactly its ask, the expensive one to 88% of its, and ₹7.5 lakh stays in the
  // bank — because past that point the programme cost the money adds outruns
  // what the curves have left to give.
  bestAllocation: [
    { interventionId: "iv-invoice-first", sprints: 2, rupees: 10.5 * LAKH },
    { interventionId: "iv-verify-async", sprints: 1, rupees: 6 * LAKH },
  ],

  debrief: {
    causalChain: [
      "Onboarding will not let a shop raise an invoice until it has supplied a GST number and a photographed registration certificate, and a person has approved both.",
      "64% of installs will not do that before they have seen the product work, so only 6,300 of 17,500 submit anything.",
      "The verification team is four people who can approve about 4,200 applications a month, and they have been at that ceiling for a year.",
      "So activation is the smaller of those two numbers — 4,200 — and about 2,100 shops a month wait nine days and give up.",
      "Approved shops convert to paid at 22%. Everybody else converts at 0.8%, so 24% of installs produce 90% of the paying customers.",
      "The campaign raised installs 38%, which raised submissions from 4,572 to 6,300 and approvals from 4,200 to 4,200.",
      "New paying customers went from about 992 a month to about 1,030, all of the difference coming from the 0.8% cohort, and a base that settles at joiners ÷ churn moved 3.9%.",
      "Marketing spend rose 41% to buy that, so the only number that moved decisively was contribution, and it moved down.",
    ],
    whereTheLeverageWas:
      "The gate, and it has to be attacked on both of its halves — willingness and throughput — because activation is the smaller of the two and lifting one alone just moves which of them binds. Letting a shop raise draft invoices before it proves who it is does most of both at once: nothing is asked up front, so far more shops reach the product, and almost nobody is in the review queue during their first week. Verifying the GSTIN from the invoice by API rather than by hand then removes the ceiling permanently instead of merely stepping around it, and recovers the 15% who type a valid number and abandon at the document upload. The redesign alone reaches about ₹20.5 lakh a month and the API check alone about ₹16.5 lakh; together they reach ₹23.6 lakh, against ₹3.4 lakh for doing nothing. Nothing else on the board multiplies: the campaign adds arrivals at a full step, the walkthrough adds applicants to a full queue, and the price cut buys customers by selling revenue.",
    strongAnswer: [
      "Before I spend anything on more installs, I want to know what happens to the ones we already buy.",
      "Only 24% of installs ever raise an invoice, which is the product's core action. So three quarters of our marketing spend buys nobody who ever sees the product work.",
      "Then I would ask a second question, and it is the one that cracks this open: is anything downstream *full*?",
      "It is. 6,300 shops a month submit their GST papers and a four-person team approves 4,200 of them. That number has not moved in a year.",
      "So activation is not a rate, it is a ceiling — the smaller of what arrives and what the team can process.",
      "That is the whole mystery. The campaign raised installs 38% and submissions 38%, and approvals by nothing, because you cannot multiply your way past a ceiling.",
      "Add the conversion split: approved shops pay at 22%, everyone else at 0.8%. A quarter of installs produce ninety per cent of the customers.",
      "And a subscriber base settles at joiners ÷ churn, so 38 extra joiners a month is invisible in a base of 11,000.",
      "Name the trap on the campaign: it worked. Installs are exactly as buyable as the plan says. It is the business that could not absorb them, and the bill arrived in full anyway.",
      "Name the trap on price: it is real and backwards. ₹199 lifts conversion 3.1 points and cuts revenue per subscriber a third. More customers, less money.",
      "Name the quiet one: a setup walkthrough persuades more shops to submit, which sends more people at the full step. That buys a longer queue and nothing else.",
      "Then separate the compliance question from the product question. The law wants a GSTIN on a filed tax invoice. It does not want one before a shopkeeper is allowed to open the app.",
      "So: let them raise draft invoices from minute one, ask for the GSTIN when they file, and verify it against the API in four seconds instead of by hand in nine days.",
      "Both halves, not one. Fixing willingness alone just fills the queue faster; fixing the queue alone still leaves 64% of installs refusing to join it.",
      "Then re-run the campaign against a funnel that can absorb it, and judge it on cost per paying customer rather than cost per install.",
    ],
  },

  coachFallback: [
    {
      topic: ["activation", "first invoice", "never", "drop off", "24%"],
      answer: [
        "Activation here means raising your first invoice — the one thing the product is actually for.",
        "Only 24% of installs get there, because the app demands a GST number and a photographed certificate first, and then a human has to approve it.",
        "So roughly three in four rupees of install spend bought somebody who never saw the product work.",
      ],
    },
    {
      topic: ["queue", "bottleneck", "capacity", "4200", "review", "verification team", "ceiling"],
      answer: [
        "Four people approve applications by hand, and they can get through about 4,200 a month.",
        "6,300 shops submit. So 4,200 are approved and about 2,100 wait nine days and give up — and that ceiling has not moved in a year.",
        "That is why the campaign changed nothing. Feed more into a step that is already full and you do not get more output, you get a longer queue.",
      ],
    },
    {
      topic: ["flat", "11000", "subscribers", "base", "churn", "why didn't it move"],
      answer: [
        "A subscriber base settles at new customers per month ÷ monthly churn, and then sits there.",
        "New paying customers went from about 992 to about 1,030, because approvals were capped and only the 0.8% cohort grew.",
        "At 9.4% churn that moves the base from about 10,590 to about 11,000 — up 3.9%, on 38% more installs. Everyone read that as flat, and they were not far wrong.",
      ],
    },
    {
      topic: ["price", "199", "299", "discount", "cheaper", "sales"],
      answer: [
        "The price test was real: ₹199 took paid conversion from 22.0% to 25.1%, about three points.",
        "It also took a third off what each subscriber pays you.",
        "Three points of conversion against 33% less revenue per customer is a losing trade — you end up with more customers and less money.",
      ],
    },
    {
      topic: ["campaign", "installs", "double", "scale", "spend more", "ceo"],
      answer: [
        "Installs are exactly as buyable as the media plan says — the campaign was not badly run.",
        "But approvals cap at about 4,200 a month, so paying customers rise about a tenth and all of it comes from the cohort that converts at 0.8%.",
        "Meanwhile marketing spend rises 62%, because a deeper buy costs more per install. The bill is immediate; the output is capped.",
      ],
    },
    {
      topic: ["gst", "compliance", "law", "paperwork", "document", "verification", "api"],
      answer: [
        "The law wants a GSTIN on a tax invoice that gets filed. It does not want one before a shopkeeper is allowed to open the app.",
        "Our onboarding treats those as one question. Both competitors treat them as two — one lets you raise three invoices first, the other ten — and both check the number against the government API in four seconds instead of by hand.",
        "That is the fix: draft invoices from minute one, GSTIN at the point of filing, verified automatically.",
      ],
    },
    {
      topic: ["both", "why two", "one lever", "half the fix", "which fix first"],
      answer: [
        "The gate has two halves — how many shops are willing to apply, and how many the team can approve — and activation is the smaller of them.",
        "So a fix has to reach both, or you just move which half is binding: persuade more shops to apply and they meet the same four people; enlarge the queue and 64% of installs still will not join it.",
        "Moving the paperwork behind the first invoice does most of both at once, and gets you to about ₹20.5 lakh a month on its own. Automating the check gets you ₹16.5 lakh on its own, and it is the one that removes the ceiling for good rather than stepping around it. Together, ₹23.6 lakh.",
      ],
    },
    {
      topic: ["cac", "cost per install", "payback", "acquisition cost"],
      answer: [
        "Cost per install held almost steady at ₹96 through the whole campaign, which is why nobody worried.",
        "Cost per *paying* customer went from ₹1,204 to ₹1,630, because the only thing between those two numbers is activation.",
        "At ₹245 of contribution a month that is about a seven-month payback on a customer who stays under eleven. It works, barely, and it got worse while the dashboard looked fine.",
      ],
    },
    {
      topic: ["app", "crash", "confusing", "tutorial", "walkthrough", "quality"],
      answer: [
        "The app is fine: 99.4% crash-free, 4.4 on the Play Store, and shops that get in raise 62 invoices a month each.",
        "People abandoning the setup screen sit on it for 71 seconds and close the app deliberately — 29% of them after opening the help link.",
        "They understand exactly what is being asked. A tutorial explains the wall more patiently, and the ones it does persuade join a queue that is already turning people away.",
      ],
    },
    {
      topic: ["competitor", "competition", "free", "cheaper rival"],
      answer: [
        "Only 9% of the shops we lose go to a competitor, so this is not where the base went.",
        "It is still worth reading: the nearest one is ₹249, so barely cheaper, and it lets a shop raise three invoices before asking who it is.",
        "They are not beating us on price. They are beating us on the same screen and the same queue we are losing everybody to.",
      ],
    },
    {
      topic: ["source", "channel", "quality of installs", "organic", "low intent"],
      answer: [
        "Submission rates run between 34% and 39% across every source, campaign and organic alike.",
        "And it would not have mattered if the campaign's were worse, because approvals cap at 4,200 whoever submits.",
        "When a problem shows up everywhere you look, it was never about where you were looking.",
      ],
    },
  ],
};
