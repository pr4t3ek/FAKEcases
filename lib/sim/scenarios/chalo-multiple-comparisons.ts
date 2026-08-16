/**
 * "Fourteen questions, one yes, and a quarter spent building it."
 *
 * The second scenario of the analytics track. Rangoli teaches a student to ask
 * what a test measured; this one teaches them to ask **how many times it was
 * asked.** A single comparison at p < 0.05 is a 5% chance of being fooled.
 * Fourteen of them, stopped at the first yes, is a coin flip.
 *
 * ── The truth, for whoever maintains this ─────────────────────────────────
 *
 * The experiment itself is clean. One change — a redesigned home screen built
 * around a streak widget — randomised properly, instrumented correctly, no
 * confound, no leakage. Everything Rangoli got wrong, this team got right.
 *
 * What they got wrong is the reading. The pre-registered primary metric was
 * 30-day retention, and it came back flat-to-negative and not significant. So
 * the team went looking: six segments crossed with a handful of secondary
 * metrics, fourteen comparisons in all, checked on the dashboard every morning
 * for twenty-one days. On day nine, one cell crossed — booking rate among
 * 25–34s on Android in metros, +11.3%, p = 0.032 — and the test was stopped
 * that afternoon.
 *
 * Two things are wrong with that number and they compound. Fourteen independent
 * comparisons at 5% carry a 51% chance of at least one false positive
 * (1 − 0.95¹⁴ = 0.512), so a Bonferroni-corrected threshold is 0.05 ÷ 14 =
 * 0.0036 and p = 0.032 is nowhere near it. And stopping the moment something
 * crosses is optional stopping, which inflates the error rate again on top. A
 * pre-registered replication run to a fixed 28 days came back at +0.4%, CI
 * −3.1% to +3.9%.
 *
 * The expensive half is the mirror image, and it is the half candidates miss.
 * While the team was overpowered to find a fluke across fourteen slices, they
 * were *underpowered* on the one comparison that mattered: 30-day retention came
 * back −1.8% at p = 0.19, which was read as "no effect" when it meant "no
 * evidence either way at this duration". Run to 45 days it clears significance.
 * The redesign really did cost retention, because it pushed the class browser
 * two taps down to make room for the streak widget, and booking a class in the
 * first week is the single strongest predictor of renewing.
 *
 * Type I error on fourteen questions nobody planned to ask; type II error on the
 * one they did. Same experiment, same data, same three weeks.
 *
 * ── Balance notes ─────────────────────────────────────────────────────────
 *
 * `iv-streak-more` is the trap and it is the room's proposal. It does what the
 * winning cell argues for, and at −₹11.9 lakh against doing nothing it is the
 * worst option on the board — because booking more classes is a *cost* in this
 * business and the retention it was supposed to buy is not there.
 *
 * `iv-discount` is close behind at −₹11.2 lakh, and wrong differently: it works
 * a little and charges the whole base for it. Two wrong answers should be wrong
 * in two different ways.
 *
 * `iv-trainers` is the honest decoy: class capacity is not the problem, but more
 * evening slots genuinely shave churn whatever is wrong upstream, so it clears
 * doing nothing by ₹1.8 lakh and loses comfortably to the two real fixes at
 * ₹5.7 and ₹4.7 lakh.
 *
 * Deliberately NOT a second Rangoli. The variant here is one change, cleanly
 * randomised, and `variant.novelty` and `reading.power` both come back clean on
 * the *headline* — so a candidate who pattern-matches to "it must be confounded"
 * or "it must be underpowered" is answering the previous scenario's question.
 *
 * `tests/sim-scenario.test.ts` brute-forces every affordable combination, so a
 * retune that lets a decoy beat the answer fails the suite rather than the
 * student.
 */

import type { SimScenario } from "../types";

const LAKH = 100_000;

export const chaloMultipleComparisons: SimScenario = {
  slug: "chalo-multiple-comparisons",
  title: "Chalo Fitness: fourteen ways to read one test, and the one that said yes",
  company: "Chalo Fitness",
  premise:
    "A home-screen redesign was declared a winner on +11.3% booking rate in one segment. It shipped to everyone and nothing happened. Work out what the readout was worth before you build more of it.",
  situation:
    "You are the analytics lead at Chalo Fitness, a class-booking subscription for gyms and studios across Pune, Hyderabad and Jaipur. " +
    "Three months ago the growth team tested a redesigned home screen built around a streak widget. The pre-registered metric came back flat, so they cut the data by segment and found one: booking rate among 25–34s on Android in metros, +11.3%, p = 0.032. The redesign shipped to everyone the following week. " +
    "Since then bookings per member are up slightly, monthly churn has drifted from 5.6% to 6.2%, and net contribution is down ₹9 lakh a month. " +
    "The growth lead wants the next quarter spent on streak rewards and an iOS rollout. " +
    "You have 6 analyst-days to work out what that readout was actually worth, then 3 sprints and ₹28 lakh to act on it.",
  difficulty: "Easy",
  engine: "v2",
  periodNoun: "month",

  mentor: {
    persona: "a head of analytics debriefing a junior data analyst",
    audience: "analyst",
  },

  // ── Teaching ────────────────────────────────────────────────────────────
  teaching: {
    showMetricMap: true,
    primer: {
      intro:
        "You already know what a p-value is. This scenario is about what happens to it when you ask more than one question — which is what every real analysis does, and what almost no readout admits to. The first six terms are that problem and its fixes. The last four are the subscription business underneath, where the answer has to pay for itself. The metric map on the right shows the business side with live numbers.",
      terms: [
        {
          term: "Null hypothesis",
          plain:
            "The starting assumption that your change did nothing, and any difference you see is the ordinary bounce of the data.",
          matters:
            "A test never proves your change worked. It only measures how uncomfortable your result would be if the change did nothing — and that is a much weaker claim than most readouts make.",
        },
        {
          term: "p-value",
          plain:
            "The chance of seeing a difference at least this big if the change actually did nothing. p = 0.032 means about a 3-in-100 chance.",
          matters:
            "It is a per-question number. Its guarantee — wrong about one time in twenty at p < 0.05 — holds for one pre-specified question, and quietly stops holding the moment you ask a second.",
        },
        {
          term: "Multiple comparisons",
          plain:
            "Asking the same data many questions — several metrics, several segments, several cuts — and reporting the one that came back significant.",
          formula: "chance of at least one false positive = 1 − (1 − 0.05)^number of tests",
          matters:
            "Fourteen questions at the 5% threshold carry a 51% chance that at least one says yes when nothing is there. Report only the winner and you have built a machine for finding things that are not real.",
        },
        {
          term: "Bonferroni correction",
          plain:
            "The blunt fix: divide your threshold by how many comparisons you ran, and judge every result against that instead.",
          formula: "corrected threshold = 0.05 ÷ number of tests",
          matters:
            "It is the fastest way to see whether a result survives its own context. Fourteen comparisons means the bar was 0.0036, not 0.05 — and a p of 0.032 is nearly ten times too big.",
        },
        {
          term: "Optional stopping",
          plain:
            "Watching a test daily and ending it the moment it crosses significance, rather than at a duration fixed in advance.",
          matters:
            "A result that wanders across the line and back will eventually be caught on the day it is across. Peeking daily for three weeks turns a 5% error rate into something several times larger, on its own, before any segment slicing.",
        },
        {
          term: "Statistical power",
          plain:
            "The chance your test would notice a real effect of a given size, if there were one. Driven by sample size, effect size and how long you run.",
          matters:
            "It is the other way to be wrong, and the one nobody looks for. A flat result from an underpowered test does not mean 'no effect' — it means 'this test could not have told you either way', and those get filed as wins for the status quo.",
        },
        {
          term: "Monthly churn",
          plain: "The share of members who cancel in a month.",
          formula: "cancellations ÷ members",
          matters:
            "In a subscription it is the number that sets everything else. A base fed by a steady stream of joiners settles at joiners ÷ churn, so a small move in churn moves the whole business.",
          driver: "churnRate",
        },
        {
          term: "Steady-state base",
          plain:
            "Where your member count settles if joiners and churn both hold: the base stops growing when the people leaving equal the people arriving.",
          formula: "members = joiners ÷ churn rate",
          matters:
            "It is why churn is worth more than acquisition here. Cutting churn from 6.2% to 5.4% is worth more members than any campaign this budget could buy.",
          driver: "subscribers",
        },
        {
          term: "Sessions per member",
          plain: "How many classes the average member actually attends in a month.",
          matters:
            "Unusually for an engagement metric, it is a cost as well as a benefit — Chalo pays the studio for every attended class. More bookings is only good news if it buys retention, so a change that lifts bookings and not renewals makes the business worse.",
          driver: "sessionsPerSubscriber",
        },
        {
          term: "Net contribution",
          plain:
            "What the month leaves behind: subscription revenue, minus what the attended classes cost to supply, minus what your own squad costs to run.",
          formula: "revenue − (session cost + programme cost)",
          matters:
            "This is the number to decide on. Booking rate is upstream of the cost line and only indirectly upstream of the revenue line, which is exactly how a booking-rate win can be a contribution loss.",
          driver: "netContribution",
        },
      ],
      worked: [
        "2,400 people join each month and 6.2% of members cancel, so the base settles at 2,400 ÷ 0.062 = 38,710 members.",
        "At ₹749 a month that is ₹2.90 crore of subscription revenue.",
        "Those members attend 4.6 classes each — 1.78 lakh sessions — and Chalo pays the studio ₹96 a session, so supply costs ₹1.71 crore. The growth squad and its tooling cost another ₹14 lakh.",
        "₹2.90 crore minus ₹1.85 crore is ₹1.05 crore of net contribution. Note which way the booking metric points in that sum: every extra class attended is ₹96 out, and only earns its keep if the member renews because of it.",
      ],
    },
  },

  northStar: "netContribution",
  reported: [
    "churnRate",
    "subscribers",
    "sessionsPerSubscriber",
    "revenue",
    "sessionCost",
    "totalCost",
  ],
  drivers: [
    { id: "joiners", kind: "input", label: "Joiners / month", unit: "count", goodDirection: "up", baseline: 2_400 },
    { id: "churnRate", kind: "input", label: "Monthly churn", unit: "ratio", goodDirection: "down", baseline: 0.062 },
    /**
     * The base as a steady state rather than an authored headcount.
     *
     * `joiners ÷ churn` is the one piece of subscription arithmetic a beginner
     * has to feel rather than be told, and making it a driver means an
     * intervention that shaves churn grows the base by itself — the student
     * sees the leverage in the projection instead of reading a claim about it
     * in the debrief.
     */
    {
      id: "subscribers",
      kind: "quotient",
      label: "Members",
      unit: "count",
      goodDirection: "up",
      numerator: "joiners",
      denominator: "churnRate",
    },
    { id: "arpu", kind: "input", label: "Revenue per member / month", unit: "inr", goodDirection: "up", baseline: 749 },
    {
      id: "revenue",
      kind: "product",
      label: "Subscription revenue",
      unit: "inr",
      goodDirection: "up",
      of: ["subscribers", "arpu"],
    },

    /**
     * The metric the experiment claimed, and the reason it is a trap.
     *
     * Sessions are a cost line here: Chalo pays the studio for every class
     * attended. So this driver sits on the *wrong side* of the contribution sum
     * unless it buys retention, and no effect wired in this scenario lets it —
     * the streak widget lifts bookings and moves churn by nothing. A student who
     * optimises the metric the readout reported watches the north star fall,
     * which is the lesson stated in arithmetic rather than in prose.
     */
    {
      id: "sessionsPerSubscriber",
      kind: "input",
      label: "Sessions per member / month",
      unit: "count",
      goodDirection: "up",
      baseline: 4.6,
    },
    {
      id: "sessions",
      kind: "product",
      label: "Classes attended",
      unit: "count",
      goodDirection: "up",
      of: ["subscribers", "sessionsPerSubscriber"],
    },
    { id: "costPerSession", kind: "input", label: "Cost per class supplied", unit: "inr", goodDirection: "down", baseline: 96 },
    {
      id: "sessionCost",
      kind: "product",
      label: "Cost of classes supplied",
      unit: "inr",
      goodDirection: "down",
      of: ["sessions", "costPerSession"],
    },

    { id: "programmeCost", kind: "input", label: "Programme cost / month", unit: "inr", goodDirection: "down", baseline: 14 * LAKH },
    {
      id: "totalCost",
      kind: "sum",
      label: "Cost of service",
      unit: "inr",
      goodDirection: "down",
      of: ["sessionCost", "programmeCost"],
    },
    {
      id: "netContribution",
      kind: "difference",
      label: "Net contribution / month",
      unit: "inr",
      goodDirection: "up",
      minuend: "revenue",
      subtrahend: "totalCost",
    },
  ],

  dashboard: [
    {
      id: "p-chalo-readout",
      kind: "stat",
      title: "The result the redesign shipped on",
      caption: "The cell that crossed, as it appeared in the launch deck. Nothing here is mis-stated.",
      tiles: [
        { label: "Booking rate lift — 25–34, Android, metro", value: 0.113, unit: "percent", goodDirection: "up" },
        { label: "p-value", value: 0.032, unit: "ratio", goodDirection: "down" },
        { label: "Members in that cell", value: 4_180, unit: "count", goodDirection: "up" },
        { label: "Test ran for", value: 9, unit: "days", goodDirection: "up" },
      ],
    },
    {
      id: "p-chalo-business",
      kind: "stat",
      title: "The business, last month",
      caption: "Three months after the redesign went to everybody.",
      tiles: [
        { label: "Members", value: 38_710, unit: "count", deltaPct: -0.089, goodDirection: "up" },
        { label: "Monthly churn", value: 0.062, unit: "ratio", deltaPct: 0.107, goodDirection: "down" },
        { label: "Sessions per member", value: 4.6, unit: "count", deltaPct: 0.038, goodDirection: "up" },
        { label: "Subscription revenue", value: 2_89_93_790, unit: "inr", deltaPct: -0.089, goodDirection: "up" },
        { label: "Cost of classes supplied", value: 1_70_94_336, unit: "inr", deltaPct: -0.055, goodDirection: "down" },
        { label: "Net contribution", value: 1_04_99_454, unit: "inr", deltaPct: -0.079, goodDirection: "up" },
      ],
    },
    {
      id: "p-chalo-trend",
      kind: "timeseries",
      title: "Churn and sessions per member, last six months",
      caption: "The redesign shipped between M-3 and M-2. Both lines respond, in opposite directions.",
      series: [
        {
          label: "Monthly churn",
          unit: "ratio",
          points: [
            { period: "M-5", value: 0.056 },
            { period: "M-4", value: 0.055 },
            { period: "M-3", value: 0.056 },
            { period: "M-2", value: 0.059 },
            { period: "M-1", value: 0.061 },
            { period: "M-0", value: 0.062 },
          ],
        },
        {
          label: "Sessions per member",
          unit: "count",
          points: [
            { period: "M-5", value: 4.43 },
            { period: "M-4", value: 4.44 },
            { period: "M-3", value: 4.42 },
            { period: "M-2", value: 4.53 },
            { period: "M-1", value: 4.58 },
            { period: "M-0", value: 4.6 },
          ],
        },
      ],
    },
    {
      id: "p-chalo-funnel",
      kind: "funnel",
      title: "A joiner's first month, current cohort",
      caption: "Where a new member stops. The step with the biggest fall is not the one people talk about.",
      steps: [
        { label: "Signed up", value: 2_400 },
        { label: "Opened the app in week 1", value: 2_016, deltaPct: -0.02 },
        { label: "Booked a first class in week 1", value: 1_104, deltaPct: -0.164 },
        { label: "Attended the first class", value: 981, deltaPct: -0.151 },
        { label: "Booked a second class", value: 806, deltaPct: -0.139 },
        { label: "Still a member at day 90", value: 671, deltaPct: -0.142 },
      ],
    },
    {
      id: "p-chalo-room",
      kind: "note",
      title: "What the room is saying",
      body:
        "Growth lead: we found a +11.3% and we shipped it. The next step is obvious — streak rewards, then the iOS rollout, and we run the same play on the booking screen. " +
        "Data science: I was asked whether the segment result was significant and it was, at p = 0.032. I was not asked how many segments we looked at. " +
        "Design: the streak widget is the best-received thing we have shipped. App store rating has gone up, not down. " +
        "Finance: members are down 8.9% since launch and we are paying for more classes per member. Contribution is down ₹9 lakh a month and nobody has connected the two.",
    },
    // ── Decoys ──────────────────────────────────────────────────────────
    //
    // Both true, both correctly measured, neither evidence for any cause. The
    // satisfaction panel is the one that matters: it is genuinely good news, and
    // a candidate has to decide that members liking a screen is not the same
    // claim as members renewing because of it.
    {
      id: "p-chalo-satisfaction",
      kind: "stat",
      title: "How members feel about the app",
      caption: "Measured on the app itself, monthly, unchanged methodology.",
      tiles: [
        { label: "App store rating", value: 4.4, unit: "count", deltaPct: 0.048, goodDirection: "up" },
        { label: "Net promoter score", value: 38, unit: "count", deltaPct: 0.026, goodDirection: "up" },
        { label: "Support tickets per 1,000 members", value: 11.2, unit: "count", deltaPct: -0.07, goodDirection: "down" },
        { label: "Crash-free sessions", value: 0.997, unit: "ratio", deltaPct: 0.001, goodDirection: "up" },
      ],
    },
    {
      id: "p-chalo-city",
      kind: "segments",
      title: "Churn by city",
      caption: "Whether one market is carrying the whole move.",
      dimension: "City",
      rows: [
        { label: "Pune", value: 0.061, unit: "ratio", deltaPct: 0.105 },
        { label: "Hyderabad", value: 0.063, unit: "ratio", deltaPct: 0.113 },
        { label: "Jaipur", value: 0.062, unit: "ratio", deltaPct: 0.102 },
      ],
    },
  ],

  budget: { analystDays: 6, sprints: 3, rupees: 28 * LAKH },

  drilldowns: [
    {
      id: "dd-comparisons",
      label: "How many comparisons were actually run?",
      question: "How many ways was this test read before one of them said yes?",
      cost: 2,
      evidenceFor: ["reading.multiplicity"],
      readsAs:
        "Fourteen. Six segments crossed with the metrics the team had to hand, one of which crossed p < 0.05. Fourteen comparisons at a 5% threshold carry a 51% chance of at least one false positive even if the redesign did nothing at all — and a Bonferroni-corrected bar would be 0.0036, not 0.05.",
      reveals: [
        {
          id: "p-chalo-grid",
          kind: "segments",
          title: "Every comparison run on this experiment, by p-value",
          caption: "One of the fourteen is below 0.05. Thirteen are not. Only one went in the deck.",
          dimension: "Comparison",
          rows: [
            { label: "30-day retention — all members (pre-registered primary)", value: 0.19, unit: "ratio" },
            { label: "Booking rate — all members", value: 0.31, unit: "ratio" },
            { label: "Booking rate — 25–34, Android, metro", value: 0.032, unit: "ratio" },
            { label: "Booking rate — 25–34, iOS, metro", value: 0.44, unit: "ratio" },
            { label: "Booking rate — 35–44, Android, metro", value: 0.27, unit: "ratio" },
            { label: "Booking rate — 18–24, all platforms", value: 0.61, unit: "ratio" },
            { label: "Booking rate — non-metro", value: 0.53, unit: "ratio" },
            { label: "Sessions per member — all", value: 0.09 , unit: "ratio" },
            { label: "Sessions per member — Android", value: 0.14, unit: "ratio" },
            { label: "Week-1 activation — all", value: 0.22, unit: "ratio" },
            { label: "Week-1 activation — metro", value: 0.36, unit: "ratio" },
            { label: "Class cancellations — all", value: 0.47, unit: "ratio" },
            { label: "App opens per week — all", value: 0.08, unit: "ratio" },
            { label: "Streak widget engagement — Android", value: 0.12, unit: "ratio" },
          ],
        },
        {
          id: "p-chalo-fwer-note",
          kind: "note",
          title: "What fourteen questions does to a 5% threshold",
          body:
            "Each comparison at p < 0.05 carries a one-in-twenty chance of a false positive. Run fourteen and the chance that at least one fires is 1 − 0.95¹⁴ = 51.2%. On a change that did precisely nothing, you would expect to find a 'winner' more often than not. " +
            "The standard correction is to divide the threshold by the number of comparisons: 0.05 ÷ 14 = 0.0036. The winning cell's p was 0.032, about nine times too large to survive it. " +
            "Note what this does not say. It does not prove the effect is absent — it says this analysis provides no evidence for it, which is a different and much more common finding than either side of the room wants.",
        },
      ],
    },
    {
      id: "dd-stopping",
      label: "When was the test stopped, and who decided?",
      question: "Was the duration fixed in advance, or fixed by the result?",
      cost: 2,
      evidenceFor: ["reading.multiplicity"],
      readsAs:
        "The test was planned for 21 days and stopped on day 9, the afternoon the Android metro cell first crossed 0.05. The dashboard was checked every morning. That is optional stopping, and it inflates the error rate again on top of the fourteen comparisons — the cell was back above 0.05 by day 12.",
      reveals: [
        {
          id: "p-chalo-pvalue-walk",
          kind: "timeseries",
          title: "The winning cell's p-value, checked daily",
          caption: "It crosses on day 9, and the test ends that afternoon. The line does not stay there.",
          series: [
            {
              label: "p-value, 25–34 Android metro",
              unit: "ratio",
              points: [
                { period: "D3", value: 0.41 },
                { period: "D5", value: 0.22 },
                { period: "D7", value: 0.11 },
                { period: "D9", value: 0.032 },
                { period: "D12", value: 0.087 },
                { period: "D16", value: 0.14 },
                { period: "D21", value: 0.21 },
              ],
            },
          ],
        },
        {
          id: "p-chalo-stopping-note",
          kind: "note",
          title: "The test document, and what happened to it",
          body:
            "The written plan says: primary metric 30-day retention, minimum detectable effect 3%, duration 21 days, no interim analysis. It is a good document and somebody wrote it properly. " +
            "The dashboard was then read every morning from day 3, and the test was closed on day 9 with the note 'hit significance in core segment, shipping'. " +
            "A wandering line will eventually be caught on a day it is across the threshold. Days 12 through 21 were collected — the test kept running in the background — and the cell sat above 0.05 for all of them.",
        },
      ],
    },
    {
      id: "dd-replication",
      label: "Has anybody re-run the winning cell?",
      question: "If you test that one segment again, properly, does the effect come back?",
      cost: 2,
      evidenceFor: ["reading.multiplicity", "variant.android"],
      readsAs:
        "It does not. A pre-registered replication on the same segment, one comparison, fixed at 28 days, came back at +0.4% with a confidence interval from −3.1% to +3.9%. The original +11.3% is not in that interval's neighbourhood. This is what a false positive looks like when you make it stand still.",
      reveals: [
        {
          id: "p-chalo-replication",
          kind: "stat",
          title: "Replication: 25–34, Android, metro — one pre-specified comparison",
          tiles: [
            { label: "Measured lift", value: 0.004, unit: "percent", goodDirection: "up" },
            { label: "Confidence interval, low", value: -0.031, unit: "percent", goodDirection: "up" },
            { label: "Confidence interval, high", value: 0.039, unit: "percent", goodDirection: "up" },
            { label: "p-value", value: 0.81, unit: "ratio", goodDirection: "down" },
            { label: "Members in the replication", value: 9_240, unit: "count", goodDirection: "up" },
            { label: "Ran for", value: 28, unit: "days", goodDirection: "up" },
          ],
        },
        {
          id: "p-chalo-replication-note",
          kind: "note",
          title: "Why this one is worth more than the original",
          body:
            "Same segment, same widget, more than twice the members, run to a duration fixed before it started, and exactly one comparison — the one the original claimed. Everything that inflated the first result has been removed. " +
            "The interval −3.1% to +3.9% is wide enough to contain a small real effect in either direction, and narrow enough to exclude +11.3% comfortably. " +
            "This is also the cheapest thing the team could have done before spending a quarter on the rollout, and it costs one analyst two days.",
        },
      ],
    },
    {
      id: "dd-primary",
      label: "What did the pre-registered primary metric do?",
      question: "The test was designed to measure retention. What did retention say?",
      cost: 2,
      evidenceFor: ["reading.power"],
      readsAs:
        "30-day retention came back at −1.8% relative, p = 0.19, and was filed as 'no effect'. It was not no effect — it was an underpowered look at a real one. The test had power to detect 3%; the true effect is smaller than that and negative, and at 45 days the same design clears significance.",
      reveals: [
        {
          id: "p-chalo-primary",
          kind: "stat",
          title: "The pre-registered primary: 30-day retention",
          tiles: [
            { label: "Retention — control", value: 0.623, unit: "ratio", goodDirection: "up" },
            { label: "Retention — variant", value: 0.612, unit: "ratio", goodDirection: "up" },
            { label: "Relative difference", value: -0.018, unit: "percent", goodDirection: "up" },
            { label: "p-value at 21 days", value: 0.19, unit: "ratio", goodDirection: "down" },
            { label: "Minimum effect the test could detect", value: 0.03, unit: "percent", goodDirection: "down" },
            { label: "p-value the same design reaches at 45 days", value: 0.021, unit: "ratio", goodDirection: "down" },
          ],
        },
        {
          id: "p-chalo-power-note",
          kind: "note",
          title: "The other way to be wrong",
          body:
            "'Not significant' and 'no effect' are different statements, and the gap between them is where this test was actually lost. The design was powered to detect a 3% move in retention. The real move is about 1.8% and downward, so the test was never going to catch it at 21 days — a flat readout was the expected outcome whether or not the redesign hurt. " +
            "So the team was simultaneously overpowered and underpowered: fourteen chances to find something that was not there, and one look, too short, at something that was. " +
            "The mechanism is on the home screen itself. The streak widget took the top slot and pushed the class browser two taps down. Booking a class in the first week is the strongest single predictor of a member reaching day 90 — 68% of week-1 bookers renew against 31% of everyone else — and week-1 booking has fallen from 51% to 46% since the redesign shipped.",
        },
      ],
    },
    {
      id: "dd-cohort",
      label: "Have the joiners themselves changed?",
      question: "Are newer cohorts different from the ones that came before the redesign?",
      cost: 2,
      evidenceFor: ["member.mix"],
      readsAs:
        "No. Channel mix, city split, plan mix and joining age are all within a point of where they were six months ago. The people arriving are the same people; what changed is what they meet when they open the app.",
      reveals: [
        {
          id: "p-chalo-cohort",
          kind: "segments",
          title: "Joiner mix, six months ago against now",
          dimension: "Attribute",
          rows: [
            { label: "Paid acquisition share — then", value: 0.44, unit: "ratio" },
            { label: "Paid acquisition share — now", value: 0.45, unit: "ratio" },
            { label: "Annual plan share — then", value: 0.21, unit: "ratio" },
            { label: "Annual plan share — now", value: 0.2, unit: "ratio" },
            { label: "Median joining age — then", value: 29, unit: "count" },
            { label: "Median joining age — now", value: 29, unit: "count" },
            { label: "Metro share — then", value: 0.67, unit: "ratio" },
            { label: "Metro share — now", value: 0.68, unit: "ratio" },
          ],
        },
        {
          id: "p-chalo-cohort-note",
          kind: "note",
          title: "Price, while we are here",
          body:
            "The ₹749 price has not moved in fourteen months and no competitor in these three cities has cut theirs. Exit-survey reasons are stable: 'not using it enough' 46%, 'too expensive' 19%, 'moved city' 11%, the rest scattered. " +
            "The 'not using it enough' share has risen four points since the redesign, which is a usage answer wearing a price answer's clothes — members who never booked a first class do not renew, and they tend to report it as value for money.",
        },
      ],
    },
    {
      id: "dd-capacity",
      label: "Can members actually get into the classes they want?",
      question: "Is supply the thing pushing people out?",
      cost: 2,
      evidenceFor: ["member.supply"],
      readsAs:
        "Not really. Studio utilisation is 71%, waitlists occur on 4% of slots and clear 82% of the time. There is a genuine peak-hour squeeze on weekday evenings, but it has been there all year and it did not move when churn did.",
      reveals: [
        {
          id: "p-chalo-capacity",
          kind: "stat",
          title: "Class supply across the three cities",
          tiles: [
            { label: "Studio slot utilisation", value: 0.71, unit: "ratio", goodDirection: "up" },
            { label: "Slots that hit a waitlist", value: 0.04, unit: "ratio", goodDirection: "down" },
            { label: "Waitlists that clear", value: 0.82, unit: "ratio", goodDirection: "up" },
            { label: "Weekday 7-9pm utilisation", value: 0.94, unit: "ratio", goodDirection: "up" },
            { label: "Average trainer rating", value: 4.6, unit: "count", goodDirection: "up" },
          ],
        },
        {
          id: "p-chalo-capacity-note",
          kind: "note",
          title: "The peak-hour squeeze, in proportion",
          body:
            "Weekday evenings run at 94% and members do occasionally fail to get the slot they wanted. That is worth fixing on its own terms and it is not what moved churn: peak utilisation was 93% six months ago, before the redesign, when churn was 5.6%. " +
            "Adding trainers relieves a real constraint and would shave churn a little. It does not touch the members who never booked a first class, and those are the ones leaving.",
        },
      ],
    },
  ],

  causes: [
    {
      id: "reading",
      parentId: null,
      label: "How the experiment was read",
      verdict:
        "The right branch — and note that the experiment itself is clean. One change, randomised properly, instrumented correctly. What went wrong happened after the data came back.",
    },
    {
      id: "reading.multiplicity",
      parentId: "reading",
      label: "Fourteen comparisons were run and the one that said yes was reported",
      verdict:
        "This was it. Fourteen comparisons at a 5% threshold carry a 51% chance of at least one false positive; a corrected bar would be 0.0036 against the reported 0.032. The test was also stopped on day 9, the afternoon it first crossed, against a written plan of 21 days — and the cell was back above 0.05 by day 12. A pre-registered replication returned +0.4%, CI −3.1% to +3.9%.",
    },
    {
      id: "reading.power",
      parentId: "reading",
      label: "The test was too small to detect anything",
      verdict:
        "Not on the headline — the winning cell had ample data to produce that number, which is why it looked convincing. But it is half-right in a way worth keeping: the *primary* metric was underpowered, so a real −1.8% on retention was filed as 'no effect'. The test was overpowered for finding flukes and underpowered for the one thing it was built to measure.",
    },
    {
      id: "variant",
      parentId: null,
      label: "Something about the redesign itself",
      verdict:
        "One branch clean, one that mattered less than it looks. The widget works exactly as designed; the question was never whether members like it.",
    },
    {
      id: "variant.android",
      parentId: "variant",
      label: "The effect is real, just narrow — Android metros only",
      verdict:
        "Not supported. This is the most reasonable wrong answer on the board, and the replication is what settles it: same segment, twice the members, one pre-specified comparison, 28 days — +0.4%, p = 0.81. There is no Android effect to be narrow about.",
    },
    {
      id: "variant.novelty",
      parentId: "variant",
      label: "The streak widget worked at first and members got bored of it",
      verdict:
        "No. Streak engagement is flat at 34–36% of weekly actives across all three months since launch, and app rating has risen rather than fallen. Members like it as much as they ever did — liking it was never the same claim as renewing because of it.",
    },
    {
      id: "member",
      parentId: null,
      label: "Something about the members rather than the app",
      verdict: "All three branches clean. Nothing about who joins or what they can book has changed.",
    },
    {
      id: "member.price",
      parentId: "member",
      label: "Members are leaving over price",
      verdict:
        "No. ₹749 has held for fourteen months, no competitor has cut, and 'too expensive' is stable at 19% of exit reasons. What has risen is 'not using it enough', up four points — a usage answer that reads as a price answer.",
    },
    {
      id: "member.mix",
      parentId: "member",
      label: "Newer joiner cohorts are simply worse",
      verdict:
        "No. Paid share 44% → 45%, annual plan share 21% → 20%, median joining age 29 both times, metro share 67% → 68%. The people arriving are the same people.",
    },
    {
      id: "member.supply",
      parentId: "member",
      label: "Classes are full and members cannot book",
      verdict:
        "Not the cause. Utilisation is 71% overall with waitlists on 4% of slots. Weekday evenings do run at 94%, but they ran at 93% six months ago when churn was 5.6% — the squeeze is real, old, and not what moved.",
    },
  ],
  trueCauseIds: ["reading.multiplicity"],

  interventions: [
    {
      id: "iv-rollback",
      label: "Put the class browser back on the home screen",
      pitch:
        "The evidence for the redesign does not survive its own context, so stop treating it as the default. Restore the class browser to the top slot and keep the streak widget below the fold.",
      addresses: "reading.multiplicity",
      cost: { sprints: 1, rupees: 4 * LAKH },
      effects: {
        whenRootCause: [{ driver: "churnRate", deltaPct: -0.071 }],
        otherwise: [{ driver: "churnRate", deltaPct: -0.018 }],
      },
      debrief:
        "The cheap half of the answer, and mostly it is undoing damage. The streak widget took the top slot and pushed booking two taps down; week-1 booking fell from 51% to 46%, and week-1 bookers renew at 68% against 31%. Nothing here is a new idea — it is the home screen you had before somebody read a p-value wrong.",
    },
    {
      id: "iv-firstweek",
      label: "Rebuild the first week around booking one class",
      pitch:
        "Week-1 booking is the strongest predictor of a member reaching day 90. Make it the whole job of the first week: a slot suggestion at signup that matches the time they said they were free, and a reminder before the class they booked.",
      addresses: "reading.multiplicity",
      cost: { sprints: 2, rupees: 13 * LAKH },
      minSprints: 2,
      effects: {
        whenRootCause: [
          { driver: "churnRate", deltaPct: -0.128 },
          { driver: "sessionsPerSubscriber", deltaPct: 0.021 },
        ],
        otherwise: [{ driver: "churnRate", deltaPct: -0.035 }],
      },
      debrief:
        "The expensive half, and the one that compounds through the steady state. 68% of members who book in week 1 reach day 90 against 31% of those who do not, and only 46% currently book. Every point of churn you take out grows the base by joiners ÷ churn without buying a single extra joiner — which is why this is worth more than anything acquisition could do with the same money.",
    },
    {
      id: "iv-streak-more",
      label: "Double down: streak rewards and the iOS rollout",
      pitch:
        "The room's proposal. We measured +11.3% on booking rate and shipped it; the obvious next step is to build more of what worked — reward tiers, a leaderboard, and the same widget on iOS.",
      addresses: "variant.android",
      cost: { sprints: 1, rupees: 5 * LAKH },
      effects: {
        whenRootCause: [{ driver: "sessionsPerSubscriber", deltaPct: 0.06 }],
        otherwise: [
          { driver: "sessionsPerSubscriber", deltaPct: 0.15 },
          { driver: "churnRate", deltaPct: 0.03 },
        ],
      },
      debrief:
        "It delivers exactly what the winning cell promised, and it is the worst thing you can do with this budget. Members do book more — the widget works. But a booked class costs ₹96 to supply and buys no renewal, so the metric the readout reported is on the cost side of the contribution sum. Building more of a false positive is still building a false positive, and here you pay ₹96 a time for the privilege.",
    },
    {
      id: "iv-discount",
      label: "Win back lapsed members with a month at 30% off",
      pitch:
        "Churn is up and the fastest lever on a subscription is price. Offer everyone who cancelled in the last quarter a month at ₹524 and a free class credit.",
      addresses: "member.price",
      cost: { sprints: 1, rupees: 9 * LAKH },
      effects: {
        whenRootCause: [{ driver: "churnRate", deltaPct: -0.062 }],
        otherwise: [
          { driver: "churnRate", deltaPct: -0.028 },
          { driver: "arpu", deltaPct: -0.084 },
        ],
      },
      debrief:
        "Answers a question the exit survey already closed. 'Too expensive' has been flat at 19% for a year while 'not using it enough' rose four points, so price was never what moved. It does buy some churn back, and it charges you for it across the whole base — an 8.4% cut in revenue per member against a 2.8% cut in churn is a trade the steady state does not repay.",
    },
    {
      id: "iv-trainers",
      label: "Add weekday-evening trainer capacity",
      pitch:
        "Peak slots run at 94% and members do get turned away. Fund additional evening classes across the three cities so the squeeze stops costing renewals.",
      addresses: "member.supply",
      cost: { sprints: 1, rupees: 4 * LAKH },
      /**
       * The honest decoy, given the same treatment as Rangoli's festive lever
       * and Sahyog's officers for the same reason: the engine's off-target
       * default saturates hard and low, on the theory that a lever aimed at the
       * wrong cause cannot work. More evening classes are not that. A member who
       * gets the slot they wanted is more likely to stay whatever else is wrong
       * with the home screen, so this keeps most of its effect and is a bad
       * decision because it is small and mistimed, rather than because the model
       * decided a wrong diagnosis makes money stop working.
       */
      saturation: {
        otherwise: { kind: "hill", ceiling: 1.0, halfAt: 0.4 },
      },
      effects: {
        whenRootCause: [{ driver: "churnRate", deltaPct: -0.062 }],
        // No cost-per-class penalty: this schedules more classes at existing
        // studios on existing per-class terms, so what it buys is capacity
        // rather than a worse unit economic. The ₹4 lakh is the scheduling and
        // negotiation, and it is the whole of what the lever costs.
        otherwise: [{ driver: "churnRate", deltaPct: -0.045 }],
      },
      debrief:
        "Genuinely beats standing still, which is what makes it a good decoy. The peak squeeze is real and relieving it does shave churn. But it was there at 93% six months ago when churn was 5.6%, so it is not what moved — and it does nothing at all for the members who never booked a first class, who are the ones actually leaving.",
    },
  ],

  /**
   * Committing the whole budget roughly triples what the growth squad costs to
   * run for the horizon.
   *
   * Scaled against the gains the fixes produce rather than the budget's face
   * value, for the reason given on Rangoli: the ₹28 lakh is a programme
   * investment and the north star is a monthly figure, so charging the full
   * amount every month would make doing nothing the answer to everything. The
   * multiple is higher here than on Rangoli because churn compounds through
   * `joiners ÷ churn` — the gains are large enough that money has to cost
   * something real before the optimum stops being "spend it all".
   */
  spend: { driver: "programmeCost", atFullBudget: 0.95 },

  /**
   * The month not going exactly to plan.
   *
   * Churn is the noisier of the two: it is a decision thousands of members make
   * independently about a discretionary purchase, and January and the start of
   * a festival week both move it. Sessions per member is steadier — it is a
   * habit. Neither is drawn wide enough to drown a decision.
   */
  noise: {
    drivers: [
      { driver: "churnRate", sigma: 0.03 },
      { driver: "sessionsPerSubscriber", sigma: 0.018 },
    ],
    driftSigma: 0.25,
  },

  // Week-1 booking is still falling as the redesign reaches the slower-updating
  // half of the Android base, and churn follows it with a lag. Doing nothing is
  // not holding position.
  drift: [
    { driver: "churnRate", deltaPct: 0.021 },
    { driver: "sessionsPerSubscriber", deltaPct: 0.008 },
  ],
  horizonQuarters: 2,

  parInvestigation: ["dd-comparisons", "dd-replication"],
  /** Derived by `scripts/best-allocation.ts`, not by hand. */
  bestAllocation: [
    { interventionId: "iv-rollback", sprints: 1, rupees: 5.25 * LAKH },
    { interventionId: "iv-firstweek", sprints: 2, rupees: 9.33 * LAKH },
  ],

  debrief: {
    causalChain: [
      "The experiment was clean: one change, randomised properly, correctly instrumented. Everything that went wrong happened after the data came back.",
      "The pre-registered primary metric — 30-day retention — came back flat, so the team cut the data by segment and metric until something crossed. Fourteen comparisons in all.",
      "Fourteen comparisons at a 5% threshold carry a 51% chance of at least one false positive on a change that does nothing. A corrected threshold would have been 0.05 ÷ 14 = 0.0036, against the reported 0.032.",
      "The test was also stopped on day 9, the afternoon that cell first crossed, against a written plan of 21 days and daily dashboard checks. By day 12 it was back above 0.05.",
      "A pre-registered replication — same segment, twice the members, one comparison, 28 days — returned +0.4% with a confidence interval of −3.1% to +3.9%. The +11.3% was not there.",
      "Meanwhile the real effect was in the metric everyone dismissed. Retention came back −1.8% at p = 0.19 and was filed as 'no effect', when the test only had power to detect 3%; the same design reaches p = 0.021 at 45 days.",
      "The mechanism is the home screen itself: the streak widget took the top slot and pushed the class browser two taps down. Week-1 booking fell from 51% to 46%, and week-1 bookers reach day 90 at 68% against 31%.",
      "So churn went 5.6% → 6.2%, the base fell 8.9% through joiners ÷ churn, and members booked slightly more classes at ₹96 each — a cost, not a benefit. Net contribution down ₹9 lakh a month.",
    ],
    whereTheLeverageWas:
      "The replication, which costs one analyst two days and would have stopped the whole thing before a quarter was spent on it. Underneath that, the first week: 68% of members who book a class in week 1 reach day 90 against 31% of those who do not, and only 46% book. Restoring discovery undoes the damage; rebuilding the first week around a single booked class is the lever that compounds, because every point of churn taken out grows the base without buying a single extra joiner.",
    strongAnswer: [
      "I would not build more of this — and not because the experiment was badly run. It was run well.",
      "The number that shipped it was one of fourteen comparisons, and only the winner went in the deck.",
      "Fourteen questions at a 5% threshold means a 51% chance something says yes when nothing is there. The corrected bar was 0.0036; the result was 0.032.",
      "It was also stopped on the day it crossed, against a written 21-day plan, with the dashboard checked every morning. By day 12 it was back above 0.05.",
      "The cheapest check is a replication: same segment, one pre-specified comparison, fixed duration. It came back +0.4%, interval −3.1% to +3.9%. There is no effect.",
      "Then the harder half. The primary metric said −1.8% on retention at p = 0.19, and the team read that as 'no effect'.",
      "It was not no effect — the test could only detect 3%, so it was never going to see a real 1.8%. Not significant and no effect are different statements.",
      "The mechanism was on the screen the whole time: the widget took the top slot and buried the class browser. Week-1 booking went 51% to 46%, and week-1 bookers renew at 68% against 31%.",
      "So I would restore the class browser, then spend the real money making the first week about booking one class.",
      "And I would change the rule: one pre-registered primary metric, a duration fixed before the test starts, and any segment finding replicated before it ships.",
    ],
  },

  coachFallback: [
    {
      topic: ["multiple", "comparison", "fourteen", "segments", "fishing", "p-hacking", "bonferroni", "family"],
      answer: [
        "Fourteen comparisons were run on this test and only the one that crossed was reported.",
        "At a 5% threshold, fourteen questions carry a 51% chance that at least one fires on a change that does nothing — 1 − 0.95¹⁴.",
        "Corrected for that, the bar was 0.05 ÷ 14 = 0.0036. The reported result was 0.032, about nine times too large.",
      ],
    },
    {
      topic: ["stopping", "peeking", "stopped", "day 9", "duration", "early"],
      answer: [
        "The written plan said 21 days with no interim analysis. The dashboard was read every morning from day 3.",
        "The test was closed on day 9, the afternoon the cell first crossed 0.05.",
        "A p-value that wanders will eventually be caught on a day it is across — and this one was back above 0.05 by day 12.",
      ],
    },
    {
      topic: ["replication", "replicate", "re-run", "again", "0.4"],
      answer: [
        "A pre-registered replication on the same segment came back at +0.4%, with an interval of −3.1% to +3.9% and p = 0.81.",
        "Twice the members, one pre-specified comparison, 28 days fixed in advance.",
        "It costs one analyst two days, and it would have stopped a whole quarter of work.",
      ],
    },
    {
      topic: ["power", "underpowered", "retention", "primary", "not significant", "type ii", "0.19"],
      answer: [
        "The primary metric was 30-day retention. It came back −1.8% at p = 0.19 and was filed as 'no effect'.",
        "The test only had power to detect a 3% move, so it could never have caught a real 1.8% one.",
        "'Not significant' means the test could not tell you. It does not mean nothing happened — the same design reaches p = 0.021 at 45 days.",
      ],
    },
    {
      topic: ["mechanism", "discovery", "browser", "home screen", "week 1", "first class", "taps"],
      answer: [
        "The streak widget took the top slot and pushed the class browser two taps down.",
        "Week-1 booking fell from 51% to 46% after the redesign shipped.",
        "Members who book in week 1 reach day 90 at 68%, against 31% for those who do not — which is how a screen layout becomes a churn number.",
      ],
    },
    {
      topic: ["streak", "widget", "novelty", "engagement", "rating", "liked"],
      answer: [
        "Members genuinely like the widget — engagement is flat at 34–36% of weekly actives and the app rating went up.",
        "That is not novelty wearing off, and it is not the question.",
        "Liking a screen and renewing because of it are different claims, and only one of them is on the contribution line.",
      ],
    },
    {
      topic: ["churn", "base", "steady state", "joiners", "members", "leverage"],
      answer: [
        "The base settles at joiners ÷ churn, so 2,400 joiners against 6.2% churn is about 38,700 members.",
        "Churn went from 5.6% to 6.2% and the base fell 8.9% without acquisition changing at all.",
        "That is why a point of churn is worth more here than anything this budget could buy on the joiner side.",
      ],
    },
    {
      topic: ["price", "discount", "expensive", "cheaper", "749"],
      answer: [
        "Price has not moved in fourteen months and no competitor has cut.",
        "'Too expensive' is stable at 19% of exit reasons; what rose is 'not using it enough', up four points.",
        "That is a usage answer wearing a price answer's clothes — members who never booked a first class report it as poor value.",
      ],
    },
  ],
};
