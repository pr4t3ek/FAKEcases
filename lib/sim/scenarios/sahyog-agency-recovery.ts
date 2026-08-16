/**
 * "Agency C recovers eight points better. Give it the book."
 *
 * The first scenario of the analytics track, and the one that has to land before
 * any of the others are worth playing: **a difference between group averages is
 * not a finding until you know the groups were comparable.** Teaches the shape
 * of an ANOVA without ever printing an F-statistic — variation *between* groups
 * held up against the variation *within* them, which is the only comparison that
 * tells you whether a gap means anything.
 *
 * ── The truth, for whoever maintains this ─────────────────────────────────
 *
 * Recovery on an overdue loan is decided almost entirely by how old the arrear
 * is. A 0–30 day account pays back 61% of what it owes; a 90+ day account pays
 * back 11%. That is a fifty-point spread, and it belongs to the *bucket*, not to
 * whoever is telephoning the borrower.
 *
 * Shreeji Collections looked eight points better than the other three because
 * 42% of the book it was handed sat in the 0–30 bucket, against 24–27% for
 * everyone else. Put the four agencies side by side *inside* a single bucket and
 * they land within 1.5 points of each other — and one agency's own month-to-month
 * swing inside one bucket is ±2.8 points, wider than the entire spread between
 * agencies. There is no agency effect to find. The league table was a bucket-mix
 * table wearing a performance table's clothes.
 *
 * So when ops moved 60% of the book to Shreeji, two things happened at once.
 * Shreeji's mix reverted to the portfolio's, and its blended recovery fell from
 * 41.4% to about the average — the eight points were never portable. And the
 * volume arrived faster than officers did, so contact rate fell as well. Blended
 * recovery went 35.6% → 33.8%.
 *
 * The leverage is not *who* works an account. It is *when*: everything that is
 * worth recovering is recovered early, so the fix is to work the 0–30 bucket hard
 * before it rolls, and to stop allocating on a number that only measures which
 * book somebody was given.
 *
 * ── Balance notes ─────────────────────────────────────────────────────────
 *
 * `iv-shift-more` is the trap and it is the room's proposal — it does the thing
 * the league table argues for, and it is the worst option on the board at
 * −₹10.8 lakh against doing nothing, because more volume at an already
 * overloaded agency buys contact rate down and no settlement at all.
 *
 * `iv-commission` is negative too (−₹9.8 lakh), and for a different reason worth
 * keeping distinct: it works a little, and you pay the higher rate on the whole
 * base that was already coming back. Two wrong answers should be wrong in two
 * different ways.
 *
 * `iv-officers` is the honest decoy, shaped like Rangoli's festive lever: more
 * field officers genuinely raise contact rate whatever is wrong with the
 * allocation, so it clears doing nothing by ₹2.9 lakh and loses comfortably to
 * the two real fixes at ₹12.9 and ₹11.8 lakh. Its `otherwise` arm keeps most of
 * its effect for that reason.
 *
 * `tests/sim-scenario.test.ts` brute-forces every affordable combination, so a
 * retune that lets a decoy beat the answer fails the suite rather than the
 * student.
 */

import type { SimScenario } from "../types";

const LAKH = 100_000;
const CRORE = 10_000_000;

export const sahyogAgencyRecovery: SimScenario = {
  slug: "sahyog-agency-recovery",
  title: "Sahyog Finance: the best agency got 60% of the book, and recovery fell",
  company: "Sahyog Finance",
  premise:
    "One collections agency recovers eight points better than the other three, so ops gave it most of the book. Recovery then went down. Work out what that league table was really measuring.",
  situation:
    "You are the analytics lead at Sahyog Finance, an NBFC that gives small personal loans across Gujarat and Maharashtra. " +
    "When a borrower falls behind, the account is passed to one of four outside field agencies. " +
    "Every month a league table ranks those four on recovery rate — the share of overdue money they collect. " +
    "Shreeji Collections has topped that table every month this year, at 41.4% against 33-35% for the other three. " +
    "So two months ago the head of collections moved 60% of the overdue book to Shreeji. " +
    "Since then blended recovery has fallen from 35.6% to 33.8%. " +
    "The head of collections now thinks the other three are dragging the average down, and wants the rest of the book moved as well. " +
    "You have 6 analyst-days to work out what that league table was measuring, then 3 sprints and ₹24 lakh to act on it.",
  difficulty: "Easy",
  engine: "v2",
  periodNoun: "month",

  /**
   * A collections floor debriefed by a "senior product leader" is the small lie
   * `SimMentor` exists to prevent — and on the analytics track the mentor is
   * doing double duty, because the person who should have caught this is an
   * analyst rather than a PM.
   */
  mentor: {
    persona: "a head of analytics debriefing a junior data analyst",
    audience: "analyst",
  },

  // ── Teaching ────────────────────────────────────────────────────────────
  teaching: {
    showMetricMap: true,
    primer: {
      intro:
        "This scenario asks one question. You see four numbers, one of them is bigger, and what have you actually learned? The first five terms below are how a statistician answers that. The last five are the collections business, where the answer has to work in practice. The metric map on the right shows the business side with live numbers.",
      terms: [
        {
          term: "Group mean",
          plain: "The average for one group. Here that means the recovery rate across every account a single agency worked.",
          formula: "sum of the group's values ÷ how many there are",
          matters:
            "An average is a summary, and every summary throws information away. Four averages side by side can tell you the groups came out different. They cannot tell you why, and they cannot tell you whether the difference is worth acting on.",
        },
        {
          term: "Within-group variation",
          plain:
            "How much the numbers move around inside one group. Think of a single agency's recovery rate going up and down from one month to the next.",
          matters:
            "This is your yardstick. A gap between two groups only means something once it is bigger than the noise inside those groups. Most gaps that get acted on are not.",
        },
        {
          term: "Between-group variation",
          plain: "How far the group averages sit from each other.",
          matters:
            "On its own it tells you nothing. Compare it against the within-group variation and you get a signal-to-noise ratio. That ratio is all an ANOVA really computes.",
        },
        {
          term: "ANOVA",
          full: "Analysis of variance",
          plain:
            "The test that asks one thing: is the spread between the group averages bigger than the ordinary noise inside the groups?",
          formula: "between-group variation ÷ within-group variation",
          matters:
            "It answers the question 'are these groups really different?'. Nobody ran it here before 60% of the book was moved. When the ratio is close to one, the groups are telling you nothing.",
        },
        {
          term: "Confounding variable",
          plain:
            "Something else that is different between the groups, and is the real reason for a gap you blamed on the grouping.",
          matters:
            "This is what turns a true number into a false conclusion. Say one agency was handed a younger book. Its higher recovery is then measuring the book rather than the agency, and moving more volume to it moves nothing that mattered.",
        },
        {
          term: "Ageing bucket",
          plain:
            "How overdue an account is: 0–30 days, 31–60, 61–90, or 90 and above. An account rolls into the next bucket if nothing is recovered.",
          matters:
            "This is by far the strongest predictor of whether the money comes back. Compare two collectors without holding it fixed and you are comparing their books, not their skill.",
        },
        {
          term: "Recovery rate",
          plain: "The share of the overdue amount that is actually collected in a month.",
          formula: "contact rate × settlement rate",
          matters:
            "It packs two things into one number: whether you reached the borrower, and whether reaching them worked. A fix acts on one or the other, so you have to split the number before you can decide what to fund.",
          driver: "recoveryRate",
        },
        {
          term: "Contact rate",
          plain: "The share of overdue accounts an agency actually reached in the month.",
          matters:
            "This is the half of recovery that staffing limits. Hand an agency twice the book without twice the officers, and this is the number that falls.",
          driver: "contactRate",
        },
        {
          term: "Settlement rate",
          plain: "Of the borrowers who were reached, the share who paid something.",
          matters:
            "This is the half that responds to how early you got there and how the conversation was handled. It is the part you can genuinely improve.",
          driver: "settlementRate",
        },
        {
          term: "Net recovery",
          plain:
            "What the month actually leaves behind. Take the money collected, then subtract the agency commission, the cost of working the accounts, and what your own team costs to run.",
          formula: "collected − (commission + servicing + programme cost)",
          matters:
            "This is the number to decide on. Recovery rate is only a rate, and a rate can rise on a book you shrank. Commission is paid on every rupee recovered, so an expensive fix can lift the headline number and lower this one.",
          driver: "netRecovery",
        },
      ],
      worked: [
        "₹8.4 crore of overdue principal is worked each month across 46,000 accounts.",
        "Agencies reach 56.1% of those accounts. Of the borrowers they reach, 60.2% pay something. So recovery is 0.561 × 0.602 = 33.8%, and ₹2.84 crore comes back.",
        "The agencies keep 11.8% of what they recover as commission — ₹33.5 lakh. Working 25,806 reached accounts costs ₹96 each, another ₹24.8 lakh. Your own squad and its tooling cost ₹9 lakh.",
        "₹2.84 crore minus ₹67.2 lakh is ₹2.16 crore of net recovery. That is the number this decision has to be judged on. It is not the number on the league table.",
      ],
    },
  },

  northStar: "netRecovery",
  reported: [
    "recoveryRate",
    "contactRate",
    "settlementRate",
    "recoveredAmount",
    "commissionCost",
    "totalCost",
  ],
  drivers: [
    {
      id: "overdueBook",
      kind: "input",
      label: "Overdue book worked / month",
      unit: "inr",
      goodDirection: "down",
      baseline: 8.4 * CRORE,
    },
    {
      id: "accountsInArrears",
      kind: "input",
      label: "Accounts in arrears",
      unit: "count",
      goodDirection: "down",
      baseline: 46_000,
    },
    /**
     * Recovery is authored as a product rather than as one input, and that is
     * the scenario's main modelling decision.
     *
     * A single `recoveryRate` input would let every intervention aim at the same
     * number, which is exactly the confusion the case is about: "recovery went
     * up" says nothing about whether you reached more people or persuaded more
     * of the people you reached. Split, the two fixes on the board are visibly
     * different levers — officers buy contact, working the book early buys
     * settlement — and the metric map shows the student the decomposition before
     * they spend anything.
     */
    {
      id: "contactRate",
      kind: "input",
      label: "Contact rate",
      unit: "ratio",
      goodDirection: "up",
      baseline: 0.561,
    },
    {
      id: "settlementRate",
      kind: "input",
      label: "Settlement rate",
      unit: "ratio",
      goodDirection: "up",
      baseline: 0.602,
    },
    {
      id: "recoveryRate",
      kind: "product",
      label: "Recovery rate",
      unit: "ratio",
      goodDirection: "up",
      of: ["contactRate", "settlementRate"],
    },
    {
      id: "recoveredAmount",
      kind: "product",
      label: "Recovered / month",
      unit: "inr",
      goodDirection: "up",
      of: ["overdueBook", "recoveryRate"],
    },

    {
      id: "accountsWorked",
      kind: "product",
      label: "Accounts reached",
      unit: "count",
      goodDirection: "up",
      of: ["accountsInArrears", "contactRate"],
    },
    {
      id: "costPerAccount",
      kind: "input",
      label: "Cost to work an account",
      unit: "inr",
      goodDirection: "down",
      baseline: 96,
    },
    {
      id: "servicingCost",
      kind: "product",
      label: "Servicing cost",
      unit: "inr",
      goodDirection: "down",
      of: ["accountsWorked", "costPerAccount"],
    },

    /**
     * Commission is a share of what comes back, which is what makes it a real
     * constraint rather than a line item. Any lever that buys recovery is
     * automatically paying 11.8% of the gain straight back out, so a fix has to
     * clear that bar before it is worth funding — and the commission decoy,
     * which raises the rate itself, is paying it on every rupee that was coming
     * back anyway.
     */
    {
      id: "commissionRate",
      kind: "input",
      label: "Agency commission",
      unit: "ratio",
      goodDirection: "down",
      baseline: 0.118,
    },
    {
      id: "commissionCost",
      kind: "product",
      label: "Commission paid",
      unit: "inr",
      goodDirection: "down",
      of: ["recoveredAmount", "commissionRate"],
    },

    {
      id: "programmeCost",
      kind: "input",
      label: "Programme cost / month",
      unit: "inr",
      goodDirection: "down",
      baseline: 9 * LAKH,
    },
    {
      id: "totalCost",
      kind: "sum",
      label: "Cost of collections",
      unit: "inr",
      goodDirection: "down",
      of: ["commissionCost", "servicingCost", "programmeCost"],
    },
    {
      id: "netRecovery",
      kind: "difference",
      label: "Net recovery / month",
      unit: "inr",
      goodDirection: "up",
      minuend: "recoveredAmount",
      subtrahend: "totalCost",
    },
  ],

  dashboard: [
    {
      id: "p-sahyog-headline",
      kind: "stat",
      title: "Collections, last month",
      caption: "Two months after 60% of the book moved to the agency that topped the table.",
      tiles: [
        { label: "Recovery rate", value: 0.3377, unit: "ratio", deltaPct: -0.051, goodDirection: "up" },
        { label: "Contact rate", value: 0.561, unit: "ratio", deltaPct: -0.029, goodDirection: "up" },
        { label: "Settlement rate", value: 0.602, unit: "ratio", deltaPct: -0.023, goodDirection: "up" },
        { label: "Recovered", value: 2_83_68_648, unit: "inr", deltaPct: -0.051, goodDirection: "up" },
        { label: "Cost of collections", value: 67_24_876, unit: "inr", deltaPct: -0.018, goodDirection: "down" },
        { label: "Net recovery", value: 2_16_43_772, unit: "inr", deltaPct: -0.061, goodDirection: "up" },
      ],
    },
    {
      id: "p-sahyog-league",
      kind: "segments",
      title: "The agency league table, as it goes to the monthly review",
      caption:
        "The table the allocation decision was made on. Every number in it is correct.",
      dimension: "Agency",
      rows: [
        { label: "Ganpati Associates", value: 0.331, unit: "ratio" },
        { label: "Vaibhav Recovery", value: 0.353, unit: "ratio" },
        { label: "Shreeji Collections", value: 0.414, unit: "ratio" },
        { label: "Karnavati Services", value: 0.336, unit: "ratio" },
      ],
    },
    {
      id: "p-sahyog-trend",
      kind: "timeseries",
      title: "Blended recovery, and Shreeji's share of the book",
      caption: "The share moved in M-2. The recovery line did not do what the table predicted.",
      series: [
        {
          label: "Blended recovery rate",
          unit: "ratio",
          points: [
            { period: "M-5", value: 0.357 },
            { period: "M-4", value: 0.354 },
            { period: "M-3", value: 0.356 },
            { period: "M-2", value: 0.351 },
            { period: "M-1", value: 0.342 },
            { period: "M-0", value: 0.338 },
          ],
        },
        {
          label: "Share of book with Shreeji",
          unit: "ratio",
          points: [
            { period: "M-5", value: 0.22 },
            { period: "M-4", value: 0.22 },
            { period: "M-3", value: 0.22 },
            { period: "M-2", value: 0.44 },
            { period: "M-1", value: 0.6 },
            { period: "M-0", value: 0.6 },
          ],
        },
      ],
    },
    {
      id: "p-sahyog-room",
      kind: "note",
      title: "What the room is saying",
      body:
        "Head of collections: Shreeji has beaten the other three every single month this year. Give them the rest of the book and stop paying three agencies to underperform. " +
        "Shreeji's account manager: we are working nearly three times the volume we had in March, with about 40% more officers. We have flagged this twice. " +
        "Finance: commission is 11.8% of everything recovered, so the agencies are the one cost that falls when we collect less. Net recovery is down ₹14 lakh a month. " +
        "Risk: disbursals are up 9% year on year and the credit mix has not moved. Whatever this is, it did not start on the lending side.",
    },
    // ── Decoys ──────────────────────────────────────────────────────────
    //
    // Both true, both correctly measured, and neither is evidence for any
    // cause. The branch table in particular is the same *kind* of table as the
    // league table — group averages, ranked — so a candidate has to notice that
    // it invites exactly the mistake they are here to avoid, which is a
    // judgement rather than a fact.
    {
      id: "p-sahyog-branch",
      kind: "segments",
      title: "Recovery rate by originating branch cluster",
      caption: "Where the loans were written, rather than who is collecting them.",
      dimension: "Cluster",
      rows: [
        { label: "Ahmedabad", value: 0.351, unit: "ratio" },
        { label: "Surat", value: 0.339, unit: "ratio" },
        { label: "Pune", value: 0.344, unit: "ratio" },
        { label: "Nashik", value: 0.328, unit: "ratio" },
        { label: "Rajkot", value: 0.333, unit: "ratio" },
      ],
    },
    {
      id: "p-sahyog-portfolio",
      kind: "stat",
      title: "The lending book, for context",
      caption: "Whether anything upstream of collections has changed.",
      tiles: [
        { label: "Disbursals / month", value: 41_20_00_000, unit: "inr", deltaPct: 0.09, goodDirection: "up" },
        { label: "Average ticket size", value: 68_400, unit: "inr", deltaPct: 0.011, goodDirection: "up" },
        { label: "Share of book in arrears", value: 0.061, unit: "ratio", deltaPct: 0.004, goodDirection: "down" },
        { label: "Average borrower bureau score", value: 714, unit: "count", deltaPct: 0.002, goodDirection: "up" },
      ],
    },
  ],

  budget: { analystDays: 6, sprints: 3, rupees: 24 * LAKH },

  drilldowns: [
    {
      id: "dd-mix",
      label: "What book was each agency given?",
      question: "Are the four agencies working the same kind of accounts?",
      cost: 2,
      evidenceFor: ["ranking.mix"],
      readsAs:
        "They are not. 42% of Shreeji's book sat in the 0–30 day bucket, against 24–27% for the other three. A 0–30 account recovers at 61% and a 90+ account at 11%. So the mix on its own explains almost the whole eight-point gap.",
      reveals: [
        {
          id: "p-sahyog-bucket-power",
          kind: "segments",
          title: "Recovery rate by ageing bucket, all agencies pooled",
          caption: "Fifty points of spread, and none of it is about who made the call.",
          dimension: "Days past due",
          rows: [
            { label: "0–30", value: 0.609, unit: "ratio" },
            { label: "31–60", value: 0.38, unit: "ratio" },
            { label: "61–90", value: 0.24, unit: "ratio" },
            { label: "90+", value: 0.111, unit: "ratio" },
          ],
        },
        {
          id: "p-sahyog-mix",
          kind: "segments",
          title: "Share of each agency's book sitting in the 0–30 bucket, before the move",
          dimension: "Agency",
          rows: [
            { label: "Ganpati Associates", value: 0.24, unit: "ratio" },
            { label: "Vaibhav Recovery", value: 0.27, unit: "ratio" },
            { label: "Shreeji Collections", value: 0.42, unit: "ratio" },
            { label: "Karnavati Services", value: 0.25, unit: "ratio" },
          ],
        },
        {
          id: "p-sahyog-mix-note",
          kind: "note",
          title: "How the allocation was set, historically",
          body:
            "New arrears have gone to Shreeji since 2022, back when it was the only agency with a tele-calling desk and the other three were field-only. They all have desks now, but nobody revisited the routing rule. " +
            "Now take the pooled bucket recovery rates and apply each agency's own mix to them. You get 33.2%, 35.1%, 41.4% and 33.5% — the league table, rebuilt without any agency being better at anything.",
        },
      ],
    },
    {
      id: "dd-withinbucket",
      label: "Agency against agency, inside a single bucket",
      question: "Compare the agencies on the same kind of accounts. Is any one of them better?",
      cost: 2,
      evidenceFor: ["ranking.mix", "agency.quality"],
      readsAs:
        "No. Inside any one bucket the four agencies land within 1.5 points of each other. They do not even rank the same way twice: Vaibhav is top in 0–30 and bottom in 61–90. The spread between agencies is a fraction of the fifty-point spread between buckets.",
      reveals: [
        {
          id: "p-sahyog-within",
          kind: "segments",
          title: "0–30 day bucket only: recovery rate by agency",
          caption: "The comparison the league table should have been. 1.6 points, top to bottom.",
          dimension: "Agency",
          rows: [
            { label: "Ganpati Associates", value: 0.604, unit: "ratio" },
            { label: "Vaibhav Recovery", value: 0.618, unit: "ratio" },
            { label: "Shreeji Collections", value: 0.611, unit: "ratio" },
            { label: "Karnavati Services", value: 0.602, unit: "ratio" },
          ],
        },
        {
          id: "p-sahyog-within-note",
          kind: "note",
          title: "The same comparison in the other three buckets",
          body:
            "31–60 days: Ganpati 37.6%, Vaibhav 38.9%, Shreeji 37.4%, Karnavati 38.2% — 1.5 points, and Shreeji is last. " +
            "61–90 days: 24.1%, 23.4%, 24.6%, 23.9% — 1.2 points. " +
            "90+ days: 10.8%, 11.4%, 10.6%, 11.2% — 0.8 points. " +
            "Four buckets, four different agencies at the top, and never more than 1.6 points between best and worst. Now set that against the 49.8-point gap between the 0–30 and 90+ buckets — a ratio of roughly 1:31. There is no agency effect here worth moving a book for.",
        },
      ],
    },
    {
      id: "dd-variance",
      label: "How much does one agency bounce month to month?",
      question: "Is the gap between agencies bigger than one agency's own ups and downs?",
      cost: 2,
      evidenceFor: ["ranking.noise"],
      readsAs:
        "One agency working one bucket swings ±2.8 points from month to month. That is wider than the entire 1.6-point spread between agencies in that bucket. So any single month's ranking is mostly noise being reshuffled, which is why the order keeps changing.",
      reveals: [
        {
          id: "p-sahyog-variance",
          kind: "timeseries",
          title: "0–30 bucket recovery, by agency, last six months",
          caption: "Four lines crossing each other repeatedly. The order changes almost every month.",
          series: [
            {
              label: "Ganpati Associates",
              unit: "ratio",
              points: [
                { period: "M-5", value: 0.622 },
                { period: "M-4", value: 0.588 },
                { period: "M-3", value: 0.617 },
                { period: "M-2", value: 0.594 },
                { period: "M-1", value: 0.608 },
                { period: "M-0", value: 0.601 },
              ],
            },
            {
              label: "Vaibhav Recovery",
              unit: "ratio",
              points: [
                { period: "M-5", value: 0.595 },
                { period: "M-4", value: 0.634 },
                { period: "M-3", value: 0.601 },
                { period: "M-2", value: 0.628 },
                { period: "M-1", value: 0.612 },
                { period: "M-0", value: 0.638 },
              ],
            },
            {
              label: "Shreeji Collections",
              unit: "ratio",
              points: [
                { period: "M-5", value: 0.631 },
                { period: "M-4", value: 0.597 },
                { period: "M-3", value: 0.624 },
                { period: "M-2", value: 0.606 },
                { period: "M-1", value: 0.589 },
                { period: "M-0", value: 0.619 },
              ],
            },
            {
              label: "Karnavati Services",
              unit: "ratio",
              points: [
                { period: "M-5", value: 0.586 },
                { period: "M-4", value: 0.619 },
                { period: "M-3", value: 0.593 },
                { period: "M-2", value: 0.615 },
                { period: "M-1", value: 0.627 },
                { period: "M-0", value: 0.594 },
              ],
            },
          ],
        },
        {
          id: "p-sahyog-variance-note",
          kind: "note",
          title: "Signal against noise, written out",
          body:
            "Inside the 0–30 bucket, the four agency averages sit 1.6 points apart. One agency's own month-to-month standard deviation, inside that same bucket, is 2.8 points. " +
            "So the variation between agencies is smaller than the variation within one of them. That is the definition of a difference you cannot act on, and an ANOVA on this data would not come close to significance. " +
            "Note carefully what this does not say. It does not say the eight-point gap on the league table is noise — that gap is far too big and too steady to be chance. It says the steady part of it has to come from something other than agency skill, because agency skill does not survive a like-for-like comparison.",
        },
      ],
    },
    {
      id: "dd-capacity",
      label: "Did Shreeji have the officers for a book that size?",
      question: "What happened to contact rate when the volume tripled?",
      cost: 2,
      evidenceFor: ["agency.capacity"],
      readsAs:
        "Shreeji's book went from 22% to 60% of the portfolio on 43% more officers, and its contact rate fell from 59.4% to 51.8%. That is real, and it explains why the move went badly. But it is a result of the decision, not the reason the league table was wrong.",
      reveals: [
        {
          id: "p-sahyog-capacity",
          kind: "segments",
          title: "Contact rate by agency, before and after the move",
          caption: "Only one of the four moved, and it is the one that took the volume.",
          dimension: "Agency",
          rows: [
            { label: "Ganpati Associates — before", value: 0.572, unit: "ratio" },
            { label: "Ganpati Associates — now", value: 0.579, unit: "ratio" },
            { label: "Vaibhav Recovery — before", value: 0.581, unit: "ratio" },
            { label: "Vaibhav Recovery — now", value: 0.586, unit: "ratio" },
            { label: "Shreeji Collections — before", value: 0.594, unit: "ratio" },
            { label: "Shreeji Collections — now", value: 0.518, unit: "ratio" },
            { label: "Karnavati Services — before", value: 0.569, unit: "ratio" },
            { label: "Karnavati Services — now", value: 0.574, unit: "ratio" },
          ],
        },
        {
          id: "p-sahyog-capacity-note",
          kind: "note",
          title: "Officers against accounts",
          body:
            "Shreeji had 84 field officers and 31 tele-callers in March, working about 10,100 accounts. It now works about 27,600 accounts on 118 officers and 44 tele-callers — accounts per officer up 68%. " +
            "The other three are carrying roughly 40% less volume than before, and their contact rates have each drifted up by half a point. That is the same effect running the other way.",
        },
      ],
    },
    {
      id: "dd-vintage",
      label: "Has the book itself changed?",
      question: "Is more of the book sitting in the old buckets than it used to?",
      cost: 2,
      evidenceFor: ["book.vintage", "book.borrower"],
      readsAs:
        "No. The bucket mix has moved by under a point in six months, and the borrower profile has not moved at all. It is the same book being worked. What changed is who was given which part of it.",
      reveals: [
        {
          id: "p-sahyog-vintage",
          kind: "timeseries",
          title: "Portfolio bucket mix, last six months",
          caption: "Two lines that have not done anything interesting.",
          series: [
            {
              label: "Share of book in 0–30",
              unit: "ratio",
              points: [
                { period: "M-5", value: 0.303 },
                { period: "M-4", value: 0.298 },
                { period: "M-3", value: 0.301 },
                { period: "M-2", value: 0.299 },
                { period: "M-1", value: 0.302 },
                { period: "M-0", value: 0.3 },
              ],
            },
            {
              label: "Share of book in 90+",
              unit: "ratio",
              points: [
                { period: "M-5", value: 0.197 },
                { period: "M-4", value: 0.201 },
                { period: "M-3", value: 0.199 },
                { period: "M-2", value: 0.203 },
                { period: "M-1", value: 0.198 },
                { period: "M-0", value: 0.2 },
              ],
            },
          ],
        },
        {
          id: "p-sahyog-borrower-note",
          kind: "note",
          title: "The borrowers behind the arrears",
          body:
            "Average bureau score at origination for accounts currently in arrears: 712 six months ago, 714 now. Salaried share 61% then, 60% now. Average ticket ₹67,600 then, ₹68,400 now. Self-employed share flat at 39%. " +
            "There is no income shock and no drift in who is falling behind. Whatever moved recovery, it did not come from the borrowers.",
        },
      ],
    },
    {
      id: "dd-incentive",
      label: "What does the commission structure pay for?",
      question: "Are the agencies being paid to do the thing you want done?",
      cost: 2,
      evidenceFor: ["agency.incentive"],
      readsAs:
        "A flat 11.8% on every rupee recovered, the same across all four agencies and all four buckets. It is not skewing anything. But it also pays nobody extra for early-bucket work, which is the only place a rupee of effort is worth much.",
      reveals: [
        {
          id: "p-sahyog-commission",
          kind: "stat",
          title: "The commercial terms, all four agencies",
          tiles: [
            { label: "Commission on recovered amount", value: 0.118, unit: "ratio", goodDirection: "down" },
            { label: "Variation across agencies", value: 0, unit: "ratio", goodDirection: "down" },
            { label: "Variation across buckets", value: 0, unit: "ratio", goodDirection: "down" },
            { label: "Minimum guarantee", value: 0, unit: "inr", goodDirection: "down" },
          ],
        },
        {
          id: "p-sahyog-commission-note",
          kind: "note",
          title: "What a flat rate does and does not do",
          body:
            "All four contracts pay 11.8% of the rupees recovered. No floor, no bucket loading, no volume tier. Nobody is paid to game a mix, and nobody is paid extra to work a hard account instead of an easy one. " +
            "Raising the rate also raises what you pay on every rupee that was already coming back — about ₹33.5 lakh a month of it. That is an expensive way to buy a small amount of settlement.",
        },
      ],
    },
  ],

  causes: [
    {
      id: "ranking",
      parentId: null,
      label: "How the league table was built",
      verdict: "The right branch, and the answer is not that anybody got the arithmetic wrong.",
    },
    {
      id: "ranking.mix",
      parentId: "ranking",
      label: "The agencies were working different books",
      verdict:
        "This was it. 42% of Shreeji's book sat in the 0–30 bucket, against 24–27% for the others. A 0–30 account recovers at 61%, a 90+ account at 11%. Rebuild each agency's blended rate from the pooled bucket rates and its own mix, and the league table comes back exactly — with no agency being better at anything.",
    },
    {
      id: "ranking.noise",
      parentId: "ranking",
      label: "The gap between agencies is chance",
      verdict:
        "Not quite, and the difference is the lesson. Inside a bucket the agencies really are the same — 1.6 points apart, against a 2.8-point monthly swing within one of them. But the eight-point headline gap is far too big and too steady to be chance. Something is producing it, and that something is the mix rather than the agencies.",
    },
    {
      id: "agency",
      parentId: null,
      label: "Something about the agencies themselves",
      verdict:
        "One branch here is real and two are not. The real one is a result of the decision rather than a reason for it.",
    },
    {
      id: "agency.quality",
      parentId: "agency",
      label: "The other three agencies are simply worse at collecting",
      verdict:
        "Not supported. Inside a single bucket the four land within 1.6 points, and they do not rank consistently: Vaibhav tops 0–30 and comes last in 61–90. There is no lasting skill difference in this data.",
    },
    {
      id: "agency.capacity",
      parentId: "agency",
      label: "Shreeji could not staff the book it was given",
      verdict:
        "True, and it is why the move cost more than it should have. Accounts per officer rose 68%, and Shreeji's contact rate fell from 59.4% to 51.8%. But that explains the size of the loss, not the mistake. Staffing Shreeji properly would only have made a pointless reallocation cost nothing.",
    },
    {
      id: "agency.incentive",
      parentId: "agency",
      label: "The commission structure rewards the wrong thing",
      verdict:
        "Not supported as a cause. The 11.8% is flat across agencies and buckets, so it is not skewing the comparison. It is fair to say the contract pays nothing extra for early-bucket work. But that is a fix, not an explanation.",
    },
    {
      id: "book",
      parentId: null,
      label: "Something about the loans rather than the collectors",
      verdict: "Both branches clean. The book being worked is the same book it was six months ago.",
    },
    {
      id: "book.vintage",
      parentId: "book",
      label: "The book has aged into the deep buckets",
      verdict:
        "No. Over six months the 0–30 share moved from 30.3% to 30.0%, and the 90+ share from 19.7% to 20.0%. The mix is flat. Only its spread across the agencies changed.",
    },
    {
      id: "book.borrower",
      parentId: "book",
      label: "The borrowers falling behind have got worse",
      verdict:
        "No. Bureau score at origination 712 → 714, salaried share 61% → 60%, ticket size flat. There is no shift in who is going overdue.",
    },
  ],
  trueCauseIds: ["ranking.mix"],

  interventions: [
    {
      id: "iv-rebalance",
      label: "Give every agency a like-for-like book",
      pitch:
        "Undo the concentration. Give each agency a slice with the same bucket mix, sized to the officers it actually has. Rank them after that, on a comparison that means something.",
      addresses: "ranking.mix",
      cost: { sprints: 1, rupees: 5 * LAKH },
      effects: {
        whenRootCause: [
          { driver: "contactRate", deltaPct: 0.072 },
          { driver: "settlementRate", deltaPct: 0.028 },
        ],
        otherwise: [{ driver: "contactRate", deltaPct: 0.02 }],
      },
      debrief:
        "The cheap half of the answer, and mostly it undoes damage. Spreading the book back across four agencies that have the officers to work it takes contact rate back toward where it was. It buys no skill, because there was never any skill to buy. What it buys is a league table you can actually read next month.",
    },
    {
      id: "iv-early",
      label: "Work the 0–30 bucket before it rolls",
      pitch:
        "Put a dedicated tele-desk on accounts in their first thirty days of arrears. Set a same-week contact standard, and let the officer make a settlement offer on the call. Everything worth recovering is recovered early.",
      addresses: "ranking.mix",
      cost: { sprints: 2, rupees: 12 * LAKH },
      minSprints: 2,
      effects: {
        whenRootCause: [
          { driver: "settlementRate", deltaPct: 0.094 },
          { driver: "contactRate", deltaPct: 0.041 },
        ],
        otherwise: [{ driver: "settlementRate", deltaPct: 0.03 }],
      },
      debrief:
        "The expensive half, and the one that compounds. The bucket table is the finding the league table was hiding: recovery is decided by when you reach somebody, not by who reaches them. Moving effort forward is the only lever here that acts on what actually drives the number. And every account that settles in 0–30 is an account that never reaches the 11% bucket.",
    },
    {
      id: "iv-shift-more",
      label: "Move the rest of the book to Shreeji",
      pitch:
        "The room's proposal. Shreeji has topped the table every month this year and the other three have not. Move the whole book to the agency that performs, and stop paying for three that do not.",
      addresses: "agency.quality",
      cost: { sprints: 1, rupees: 3 * LAKH },
      effects: {
        whenRootCause: [{ driver: "settlementRate", deltaPct: 0.03 }],
        otherwise: [
          { driver: "contactRate", deltaPct: -0.104 },
          { driver: "settlementRate", deltaPct: 0.008 },
        ],
      },
      debrief:
        "It does exactly what the league table argues for, and it is the worst thing you can do with this budget. Shreeji's eight points were its book, not its people, so moving more volume buys no settlement. The volume also arrives at an agency already 68% over on accounts per officer, so contact rate falls again. The cheapest option on the board, and the one that destroys the most money.",
    },
    {
      id: "iv-commission",
      label: "Raise commission to 14.5% across all four agencies",
      pitch:
        "If recovery is falling, pay for more of it. A 2.7-point rise in commission is the fastest lever available and needs no operational change at all.",
      addresses: "agency.incentive",
      cost: { sprints: 1, rupees: 7 * LAKH },
      effects: {
        whenRootCause: [{ driver: "settlementRate", deltaPct: 0.052 }],
        otherwise: [
          { driver: "settlementRate", deltaPct: 0.026 },
          { driver: "commissionRate", deltaPct: 0.229 },
        ],
      },
      debrief:
        "The lever that pays for itself in the wrong direction. A flat commission is paid on every rupee that was already coming back — about ₹33.5 lakh a month. So buying 2.6% more settlement costs you 22.9% more commission on the entire base. The model charges you for that honestly. It is why 'just pay them more' is almost never the answer when a rate fell for structural reasons.",
    },
    {
      id: "iv-officers",
      label: "Fund 40 more field officers and a predictive dialler",
      pitch:
        "Contact rate is the half of recovery that headcount limits. Add officers across all four agencies, and put a dialler in front of them so fewer hours go into unanswered calls.",
      addresses: "agency.capacity",
      cost: { sprints: 1, rupees: 6 * LAKH },
      /**
       * The honest decoy, and it gets the same treatment as Rangoli's festive
       * lever for the same reason.
       *
       * The engine's off-target default saturates hard and low, on the theory
       * that a lever aimed at the wrong cause usually cannot work. Officers are
       * not that: a dialler raises contact rate whatever is wrong with the
       * allocation, because a call that connects connects regardless of why you
       * wanted it. So this keeps most of its effect and is a bad decision for
       * the reason the debrief gives — it buys the cheap half of recovery at the
       * expensive end of the book — rather than because the model quietly
       * decided a wrong diagnosis makes money stop working.
       */
      saturation: {
        otherwise: { kind: "hill", ceiling: 1.0, halfAt: 0.4 },
      },
      effects: {
        whenRootCause: [{ driver: "contactRate", deltaPct: 0.11 }],
        otherwise: [
          { driver: "contactRate", deltaPct: 0.082 },
          { driver: "costPerAccount", deltaPct: 0.06 },
        ],
      },
      debrief:
        "Genuinely beats standing still, and that is what makes it a good decoy. More officers reach more borrowers, and the model gives you most of it. But you are buying contact evenly across a book that is 20% dead paper. Much of the extra calling lands on accounts that recover at 11%, and each one costs ₹96 to work. Under a quarter of what the same capacity does at the front of the book.",
    },
  ],

  /**
   * Committing the whole budget roughly doubles what the collections-strategy
   * squad costs to run.
   *
   * Scaled against the gains the fixes actually produce — a few lakh a month
   * against a ₹2.16 crore north star — rather than against the budget's face
   * value: the ₹32 lakh is a programme investment and the north star is a
   * monthly figure, so charging the full amount every month would make doing
   * nothing the answer to everything.
   */
  spend: { driver: "programmeCost", atFullBudget: 3.6 },

  /**
   * The month not going exactly to plan.
   *
   * Contact rate is the steadier of the two — it is mostly staffing, and
   * staffing does not move week to week. Settlement is noisier because it is a
   * decision a borrower makes about money they do not have, and that responds
   * to things nobody at Sahyog can see. Neither is drawn wide enough to drown a
   * decision: a student has to be able to read their own fix out of the result.
   */
  noise: {
    drivers: [
      { driver: "contactRate", sigma: 0.02 },
      { driver: "settlementRate", sigma: 0.028 },
    ],
    driftSigma: 0.25,
  },

  // Accounts nobody reaches early roll into the next bucket, and a bucket down
  // is worth roughly a third as much. Left alone, that compounds — which is why
  // holding capacity here is not a neutral choice.
  drift: [
    { driver: "settlementRate", deltaPct: -0.022 },
    { driver: "contactRate", deltaPct: -0.014 },
    { driver: "costPerAccount", deltaPct: 0.018 },
  ],
  horizonQuarters: 2,

  parInvestigation: ["dd-mix", "dd-withinbucket"],
  /**
   * Derived by `scripts/best-allocation.ts`, not by hand — under saturating
   * response curves against a spend that reaches the P&L, the ceiling is an
   * interior point rather than "buy the two good ones at list price".
   */
  bestAllocation: [
    { interventionId: "iv-rebalance", sprints: 1, rupees: 5 * LAKH },
    { interventionId: "iv-early", sprints: 2, rupees: 8 * LAKH },
  ],

  debrief: {
    causalChain: [
      "Recovery on an overdue loan is decided by how old the arrear is: a 0–30 day account pays back 60.9%, a 90+ day account 11.1%. That is a 49.8-point spread and it belongs to the bucket, not to the collector.",
      "New arrears had gone to Shreeji since 2022, when it was the only agency with a tele-calling desk. Nobody revisited the rule. So 42% of Shreeji's book sat in the 0–30 bucket, against 24–27% for the other three.",
      "Rebuild each agency's blended recovery from the pooled bucket rates and its own mix. You get 33.2%, 35.1%, 41.4%, 33.5% — the league table exactly, with every agency performing identically.",
      "Inside a single bucket the four agencies land within 1.6 points of each other, and they do not rank consistently. One agency's own month-to-month swing in that bucket is 2.8 points. So the variation between agencies is smaller than the variation within one of them.",
      "The eight-point gap was therefore measuring bucket mix. Moving 60% of the book to Shreeji moved a mix rather than a skill: Shreeji's mix went back to the portfolio's, and its blended rate fell to the average.",
      "The volume also arrived faster than the officers did, with accounts per officer up 68%. Shreeji's contact rate fell from 59.4% to 51.8%. Blended recovery went 35.6% → 33.8%, and net recovery fell ₹14 lakh a month.",
    ],
    whereTheLeverageWas:
      "The bucket table, which was hiding underneath the league table the whole time. Once you see that recovery is 61% at thirty days and 11% at ninety, the question changes. It stops being which agency should get the book, and becomes how fast anybody gets to it. Rebalancing undoes the damage. Working the 0–30 bucket before it rolls is the only lever on the board that acts on what actually drives the number.",
    strongAnswer: [
      "I would not move any more of the book — and not because I doubt the 41.4%.",
      "Every number on that league table is correct. The problem is that it compares four agencies that were never working the same accounts.",
      "Recovery is decided by how old the arrear is: 61% at 0–30 days, 11% at 90-plus. Nearly fifty points, and none of it is about the collector.",
      "Shreeji had 42% of its book in the 0–30 bucket. The others had 24 to 27%. That mix alone rebuilds the whole league table.",
      "The check that settles it is holding the bucket fixed. Inside 0–30 the four agencies are within 1.6 points, and they do not even rank the same way in different buckets.",
      "And one agency's own month-to-month swing inside a bucket is 2.8 points — wider than the gap between agencies. Between-group variation smaller than within-group variation is a difference you cannot act on.",
      "So the move bought a mix, not a skill. Shreeji's book went back to the portfolio average, and the volume outran its officers, so contact fell from 59.4% to 51.8%.",
      "I would rebalance to like-for-like books sized to each agency's officers, and rank on that comparison from next month.",
      "Then spend the real money on working the 0–30 bucket hard, because that is where the bucket table says the rupees are.",
      "And change the report. An agency league table has to be reported within bucket, or it is measuring the allocation rule rather than the agency.",
    ],
  },

  coachFallback: [
    {
      topic: ["mix", "bucket", "confound", "ageing", "allocation", "different books"],
      answer: [
        "The four agencies were not working comparable accounts.",
        "42% of Shreeji's book was in the 0–30 day bucket, against 24–27% for the other three.",
        "A 0–30 account recovers at 61% and a 90+ account at 11%, so the mix alone rebuilds the entire eight-point gap.",
      ],
    },
    {
      topic: ["anova", "variance", "within", "between", "spread", "noise", "significance"],
      answer: [
        "Hold the bucket fixed and the agencies land within 1.6 points of each other.",
        "One agency's own month-to-month swing inside that same bucket is 2.8 points.",
        "When the variation between groups is smaller than the variation within them, there is no difference to act on — that comparison is what an ANOVA computes.",
      ],
    },
    {
      topic: ["shreeji", "best agency", "quality", "skill", "better"],
      answer: [
        "No agency on this data is better than any other.",
        "Inside a single bucket the four are within 1.6 points, and the ranking changes from bucket to bucket — Vaibhav is top in 0–30 and last in 61–90.",
        "Shreeji's eight points were the book it was given, and books do not travel with the agency.",
      ],
    },
    {
      topic: ["capacity", "officers", "contact", "staffing", "overload"],
      answer: [
        "Shreeji's book went from 22% to 60% of the portfolio on 43% more officers.",
        "Accounts per officer rose 68% and its contact rate fell from 59.4% to 51.8%.",
        "That is why the move cost as much as it did — but staffing it properly would only have made a pointless reallocation cost-neutral.",
      ],
    },
    {
      topic: ["early", "0-30", "roll", "fix", "leverage", "what should"],
      answer: [
        "Rebalance to like-for-like books first, so next month's table means something.",
        "Then put the real money on working the 0–30 bucket before accounts roll into 31–60.",
        "Everything worth recovering is recovered early — that is what the bucket table is telling you, and it is the finding the league table was hiding.",
      ],
    },
    {
      topic: ["commission", "incentive", "pay more", "contract", "11.8"],
      answer: [
        "Commission is a flat 11.8% of rupees recovered, identical across agencies and buckets.",
        "It is not distorting the comparison, so it is not the cause.",
        "And raising it is expensive: you pay the higher rate on the ₹33.5 lakh a month that was already coming back, to buy a small amount of extra settlement.",
      ],
    },
    {
      topic: ["borrower", "book", "vintage", "credit", "aged", "npa"],
      answer: [
        "The book has not changed. The 0–30 share moved 30.3% → 30.0% over six months and the 90+ share 19.7% → 20.0%.",
        "Borrower profile is flat too — bureau score 712 → 714, salaried share 61% → 60%.",
        "What changed was which agency was given which part of the same book.",
      ],
    },
  ],
};
