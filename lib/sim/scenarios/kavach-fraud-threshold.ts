import type { SimScenario } from "../types";

/**
 * Ninety-nine point four per cent accurate, and twenty-four wrong for every one right.
 *
 * The fourth rung of the analytics track, and the one the ladder in entry 16 of
 * CHANGES.md named next: classification thresholds. Rangoli teaches a candidate
 * to read one comparison, Sahyog that a comparison between groups somebody else
 * chose is not a comparison, Chalo what fourteen questions do to a p-value. All
 * three are about reading a *number*. This one is about reading a *classifier*,
 * which fails in a way none of them prepare you for: every headline metric can
 * be computed correctly and still be the wrong metric.
 *
 * Written to the same framing constraint as the rest of the ladder — the
 * post-mortem of a decision the analysis already drove. The model shipped six
 * months ago. The war room is the diagnosis and the fix, not a quiz about
 * precision.
 *
 * ── The truth, for whoever maintains this ────────────────────────────────────
 *
 * Fraud runs at 0.06% of transactions. That base rate is the whole scenario.
 * At that prevalence:
 *
 *   - A model that flags NOTHING scores 99.94% accuracy. The shipped model
 *     scores 99.41%. Accuracy is not merely a weak metric here; it ranks the
 *     shipped model BELOW doing nothing, and nobody noticed because 99.4%
 *     sounded like a pass.
 *   - Production recall is 38% and the production false positive rate is 0.55%.
 *     0.55% of 1.98 crore legitimate payments is 1.09 lakh hard declines a
 *     month, against 4,524 frauds caught. That is 24.1 genuine customers
 *     blocked per fraudster stopped, and it is the number the room has never
 *     seen written down.
 *   - Production precision is therefore 4.0%. The deck says 94%. Both are
 *     arithmetically correct: the 94% was measured on a rebalanced 50/50
 *     downsample, where the base rate is 50% rather than 0.06%. Precision is
 *     the one headline metric that moves with prevalence, so it is the one
 *     number that cannot be carried across from a balanced holdout. Recall and
 *     specificity can. That asymmetry is the single most useful thing in here.
 *
 * The model's ranking is fine — AUC 0.91, and dd-training shows it. This is
 * deliberately NOT a scenario about a bad model, because "retrain it" is the
 * answer candidates reach for and it is wrong. The three real defects are the
 * metric the team optimised, an uncalibrated score (so a 0.5 cut is arbitrary
 * rather than chosen), and an action space with exactly two entries.
 *
 * The payoff is the third one. A confusion matrix has two error types, so
 * candidates reason as though the business has two actions. It does not. Send
 * the mid-score band to step-up auth and a false positive costs twelve seconds
 * of OTP instead of a declined payment and a support ticket — you change what
 * an error COSTS rather than how many you make. No threshold move can do that,
 * which is why iv-stepup-auth beats iv-threshold-cost on its own.
 *
 * ── Balance notes ────────────────────────────────────────────────────────────
 *
 * The trap that had to be designed around: if net loss per missed fraud is set
 * to the gross ticket value the room quotes (₹4,200), then blocking harder wins
 * on the north star and the scenario rewards precisely the error it exists to
 * correct. It is not ₹4,200. dd-costs is the pull that establishes this: after
 * issuer recovery and the chargeback split, Kavach carries ₹1,180 of a missed
 * fraud on average, because most UPI fraud is small-ticket. Meanwhile a hard
 * decline costs ₹85 of support handling, and 1.09 lakh of them a month is ₹92.7
 * lakh — already more than the ₹87.1 lakh of fraud the model fails to stop.
 * The costs of the two error types are within 6% of each other, and the room
 * has assumed a 50:1 ratio.
 *
 * So iv-block-harder is unambiguously the worst option on the board and the
 * arithmetic says so without any authored penalty doing the work: recall 38% →
 * 62% saves ₹33.7 lakh of fraud and spends ₹1.30 crore of support handling.
 * The txnsPerUser and churn penalties on it are real consequences on top, not
 * the mechanism.
 *
 * Merchant routing is modelled through `txnsPerUser` rather than as its own
 * driver. A payments business loses volume when success rate falls because
 * merchants demote it in the checkout stack, and what a user experiences is
 * fewer payments going through Kavach. Folding it into the existing driver
 * keeps the graph honest without a `merchantShare` multiplier that would sit at
 * 1.0 and mean nothing.
 */

const LAKH = 100_000;

export const kavachFraudThreshold: SimScenario = {
  slug: "kavach-fraud-threshold",
  title: "Kavach Pay: the model is 99.4% accurate, and payment success is falling",
  company: "Kavach Pay",
  premise:
    "A fraud model shipped six months ago on 99.4% accuracy and 94% precision. Fraud losses barely moved, payment success fell, and merchants are routing volume elsewhere. Work out what those numbers were actually measuring before you tune anything.",
  situation:
    "You are the analytics lead at Kavach Pay, a UPI payments app that also runs the payment stack for about 40,000 online merchants. " +
    "Six months ago the risk team shipped a fraud model. It scores every transaction, and anything above 0.5 is declined outright. " +
    "The launch deck reported 99.4% accuracy and 94% precision, and both numbers were computed correctly. " +
    "Since then: fraud losses are down about a fifth, payment success rate has gone from 99.83% to 99.39%, complaint volume has trebled, and three of the ten largest merchants have moved Kavach down their checkout waterfall. " +
    "Net contribution is down ₹63 lakh a month. The risk lead wants to raise recall to 62% and catch more of what is getting through; the merchant team wants the model switched off entirely. " +
    "You have 6 analyst-days to work out which of them is right, then 3 sprints and ₹24 lakh to act on it.",
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
        "Every number in the launch deck is arithmetically correct. That is what makes this hard. A classifier makes two kinds of mistake, and almost every metric you have met compresses both into one figure — which works fine until the thing you are looking for is rare. The first eight terms below are how to take that figure apart. The last three are the payments business underneath, where the answer has to pay for itself. The metric map on the right shows the business side with live numbers.",
      terms: [
        {
          term: "Confusion matrix",
          plain:
            "The whole picture of a classifier's performance in four boxes: true positives (flagged, and it was fraud), false positives (flagged, and it was not), false negatives (missed fraud), true negatives (correctly left alone).",
          matters:
            "Every classification metric is a ratio of two of these four boxes. If somebody reports a single number without showing you the matrix, they have chosen which two boxes you get to see. Ask for all four.",
        },
        {
          term: "Base rate",
          plain:
            "How common the thing you are looking for actually is. Here, 0.06% of transactions are fraudulent — about 6 in every 10,000.",
          matters:
            "The base rate decides what good performance even looks like. When one class is this rare, the true-negative box is enormous and it swamps any metric that includes it. Almost every mistake in this scenario traces back to a number that was read without asking what the base rate was.",
          driver: "fraudRate",
        },
        {
          term: "Accuracy",
          plain: "The share of all calls the model got right, of either kind.",
          formula: "accuracy = (true positives + true negatives) ÷ everything",
          matters:
            "It is the default metric and it is useless at a 0.06% base rate. A model that flags nothing at all scores 99.94% here, which is better than the 99.41% the shipped model manages. Accuracy is being carried almost entirely by the true-negative box, and that box is not what anybody is paid to get right.",
          driver: "accuracy",
        },
        {
          term: "Recall",
          plain:
            "Of all the fraud that actually happened, the share the model caught. Also called sensitivity, or the true positive rate.",
          formula: "recall = true positives ÷ (true positives + false negatives)",
          matters:
            "This is the half of performance the risk team feels. It says nothing whatsoever about how much collateral damage was done to get there — you can take recall to 100% by declining every payment on the platform.",
          driver: "recall",
        },
        {
          term: "Precision",
          plain: "Of everything the model flagged, the share that really was fraud.",
          formula: "precision = true positives ÷ (true positives + false positives)",
          matters:
            "This is the half the customer feels, and it is the one number that moves with the base rate. Measure it on a 50/50 sample and you get 94%. Measure it in production, where fraud is 0.06%, and you get 4.0%. Same model, same threshold, same day. Recall and specificity do carry across from a rebalanced test set; precision does not, ever.",
          driver: "precision",
        },
        {
          term: "False positive rate",
          plain:
            "Of all the genuine transactions, the share the model wrongly flagged. One minus specificity.",
          formula: "false positive rate = false positives ÷ all genuine transactions",
          matters:
            "The trap worth memorising: precision is not one minus this. A false positive rate of 0.55% sounds like a rounding error, and it is — 0.55% of 1.98 crore genuine payments is 1.09 lakh declined customers a month, against 4,524 frauds caught. A tiny rate against a huge denominator beats a large rate against a tiny one every time.",
          driver: "falsePositiveRate",
        },
        {
          term: "Threshold",
          plain:
            "The score above which a transaction is acted on. Kavach uses 0.5, which is the default in the library rather than a decision anybody made.",
          matters:
            "This is the dial, and it is a business choice rather than a modelling one. Moving it up buys precision and spends recall; moving it down does the reverse. The model's ranking does not change at all — only where you cut it. Most 'the model is bad' conversations are really threshold conversations.",
        },
        {
          term: "Calibration",
          plain:
            "Whether a score of 0.7 actually means a 70% chance of fraud. A model can rank perfectly and still be badly calibrated.",
          matters:
            "Kavach's model was trained on a rebalanced 50/50 sample, so its scores are inflated by roughly three orders of magnitude at the low end. A 0.5 cut on an uncalibrated score is an arbitrary line. You cannot choose a cost-optimal threshold until the score means something, which is why recalibration comes before tuning rather than instead of it.",
        },
        {
          term: "Payment success rate",
          plain:
            "The share of attempted payments that go through. Kavach's own declines count against it.",
          formula: "successful payments ÷ attempted payments",
          matters:
            "In payments this is the product. Merchants measure every provider on it and route volume to whoever is highest, so a false positive is not only an annoyed customer — it is a slow leak of the merchant volume that pays for everything.",
          driver: "successRate",
        },
        {
          term: "Blocked customers per fraud caught",
          plain: "False positives divided by true positives — precision turned upside down.",
          formula: "false positives ÷ true positives",
          matters:
            "The same fact as precision, in the unit the room will actually argue about. '4% precision' gets nodded through in a readout. '24 genuine customers declined for every fraudster we stop' does not.",
          driver: "blockedPerCatch",
        },
        {
          term: "Net contribution",
          plain:
            "What the month leaves behind: the take on payments that succeed, minus fraud Kavach carries, minus what the declines cost to handle, minus the risk platform.",
          formula: "payment revenue − (fraud loss + block handling + platform + review)",
          matters:
            "This is the number to decide on, and it is where the two error types finally become comparable. A missed fraud costs ₹1,180 net of recovery. A wrong decline costs ₹85 to handle plus the payment and, eventually, the merchant. Until you put both on this line you are trading a metric against a metric.",
          driver: "netContribution",
        },
      ],
      worked: [
        "1.98 crore payments a month, of which 0.06% are fraudulent: 11,904 fraud attempts and 1,98,28,096 genuine ones.",
        "Recall is 38%, so the model catches 4,524 frauds and misses 7,380. The false positive rate is 0.55%, so it also declines 1,09,055 genuine payments.",
        "Precision is therefore 4,524 ÷ (4,524 + 1,09,055) = 4.0%, and the model blocks 1,09,055 ÷ 4,524 = 24.1 genuine customers for every fraudster it stops.",
        "Accuracy is (4,524 + 1,97,19,041) ÷ 1,98,40,000 = 99.41%. Now do the same sum for a model that flags nothing: 1,98,28,096 ÷ 1,98,40,000 = 99.94%. The model that does nothing scores higher, and that is the metric the launch was signed off on.",
        "In money: 7,380 missed frauds at ₹1,180 each is ₹87.1 lakh, and 1,09,055 declines at ₹85 each is ₹92.7 lakh. The false positives already cost more than the fraud does, before a single merchant reroutes.",
      ],
    },
  },

  northStar: "netContribution",
  reported: [
    "successRate",
    "precision",
    "recall",
    "blockedPerCatch",
    "accuracy",
    "fraudLoss",
    "blockSupportCost",
  ],

  drivers: [
    // ── The base, as a steady state ──────────────────────────────────────
    //
    // `usersPrior` is lagged so the block → churn → smaller base → fewer
    // transactions loop is legal: it closes across months instead of within
    // one, which is both how it really works and what keeps the graph a DAG.
    {
      id: "usersPrior",
      kind: "lagged",
      of: "users",
      initial: 62_00_000,
      label: "Active users, start of month",
      unit: "count",
      goodDirection: "up",
    },
    /**
     * Payments per user per month — and the merchant routing lever.
     *
     * When success rate falls, merchants demote Kavach in the checkout
     * waterfall, and what that looks like from inside is a user making fewer
     * payments through the app. Modelled here rather than as a separate
     * `merchantShare` driver that would sit at 1.0 and carry no information.
     */
    {
      id: "txnsPerUser",
      kind: "input",
      label: "Payments per user / month",
      unit: "count",
      goodDirection: "up",
      baseline: 3.2,
    },
    {
      id: "transactions",
      kind: "product",
      label: "Payments attempted",
      unit: "count",
      goodDirection: "up",
      of: ["usersPrior", "txnsPerUser"],
    },

    // ── The confusion matrix, derived rather than asserted ────────────────
    //
    // Every metric in the primer falls out of these. Nothing below is a second
    // authored number that could quietly disagree with the first, which is the
    // whole reason the driver graph exists.
    {
      id: "fraudRate",
      kind: "constant",
      label: "Fraud base rate",
      unit: "ratio",
      goodDirection: "down",
      value: 0.0006,
    },
    {
      id: "fraudAttempts",
      kind: "product",
      label: "Fraud attempts",
      unit: "count",
      goodDirection: "down",
      of: ["transactions", "fraudRate"],
    },
    {
      id: "legitTransactions",
      kind: "difference",
      label: "Genuine payments",
      unit: "count",
      goodDirection: "up",
      minuend: "transactions",
      subtrahend: "fraudAttempts",
    },
    {
      id: "recall",
      kind: "input",
      label: "Recall (fraud caught)",
      unit: "ratio",
      goodDirection: "up",
      baseline: 0.38,
    },
    {
      id: "fraudCaught",
      kind: "product",
      label: "True positives",
      unit: "count",
      goodDirection: "up",
      of: ["fraudAttempts", "recall"],
    },
    {
      id: "fraudMissed",
      kind: "difference",
      label: "False negatives",
      unit: "count",
      goodDirection: "down",
      minuend: "fraudAttempts",
      subtrahend: "fraudCaught",
    },
    {
      id: "falsePositiveRate",
      kind: "input",
      label: "False positive rate",
      unit: "ratio",
      goodDirection: "down",
      baseline: 0.0055,
    },
    {
      id: "falsePositives",
      kind: "product",
      label: "Genuine payments declined",
      unit: "count",
      goodDirection: "down",
      of: ["legitTransactions", "falsePositiveRate"],
    },
    {
      id: "flagged",
      kind: "sum",
      label: "Transactions flagged",
      unit: "count",
      goodDirection: "down",
      of: ["fraudCaught", "falsePositives"],
    },
    {
      id: "precision",
      kind: "quotient",
      label: "Precision",
      unit: "ratio",
      goodDirection: "up",
      numerator: "fraudCaught",
      denominator: "flagged",
    },
    /**
     * Precision, in the unit the room will argue about.
     *
     * Same fact, and it survives a meeting in a way "4% precision" does not.
     */
    {
      id: "blockedPerCatch",
      kind: "quotient",
      label: "Customers blocked per fraud caught",
      unit: "multiple",
      goodDirection: "down",
      numerator: "falsePositives",
      denominator: "fraudCaught",
    },
    {
      id: "successfulTransactions",
      kind: "difference",
      label: "Payments that went through",
      unit: "count",
      goodDirection: "up",
      minuend: "legitTransactions",
      subtrahend: "falsePositives",
    },
    {
      id: "successRate",
      kind: "quotient",
      label: "Payment success rate",
      unit: "ratio",
      goodDirection: "up",
      numerator: "successfulTransactions",
      denominator: "transactions",
    },
    /**
     * Carried as a reported driver on purpose.
     *
     * Across the entire decision space it moves about one and a quarter
     * percentage points — 98.66% at the risk lead's setting, 99.41% today,
     * 99.88% at the cost-optimal cut, 99.94% flagging nothing — while net
     * contribution over the same range swings from ₹27 lakh to ₹1.97 crore. So
     * a student watching the outcome report sees the metric this launch was
     * signed off on register a seven-fold change in the business as a rounding
     * difference, and register it in the wrong order at one end. That is the
     * lesson stated in the projection rather than in the debrief.
     */
    {
      id: "correctCalls",
      kind: "sum",
      label: "Correct calls",
      unit: "count",
      goodDirection: "up",
      of: ["fraudCaught", "successfulTransactions"],
    },
    {
      id: "accuracy",
      kind: "quotient",
      label: "Accuracy",
      unit: "ratio",
      goodDirection: "up",
      numerator: "correctCalls",
      denominator: "transactions",
    },

    // ── What the two error types cost ────────────────────────────────────
    {
      id: "netLossPerMissedFraud",
      kind: "constant",
      label: "Net loss per missed fraud",
      unit: "inr",
      goodDirection: "down",
      value: 1_180,
    },
    {
      id: "fraudLoss",
      kind: "product",
      label: "Fraud loss carried",
      unit: "inr",
      goodDirection: "down",
      of: ["fraudMissed", "netLossPerMissedFraud"],
    },
    {
      id: "costPerBlock",
      kind: "input",
      label: "Cost of handling a decline",
      unit: "inr",
      goodDirection: "down",
      baseline: 85,
    },
    {
      id: "blockSupportCost",
      kind: "product",
      label: "Cost of handling declines",
      unit: "inr",
      goodDirection: "down",
      of: ["falsePositives", "costPerBlock"],
    },

    // ── The review queue, and the ceiling on it ───────────────────────────
    //
    // `min` rather than an authored cap: a queue that can clear 6,000 of
    // 1.14 lakh flags is a constraint the student should bump into while
    // funding it, not read about afterwards.
    {
      id: "reviewCapacity",
      kind: "input",
      label: "Manual review capacity / month",
      unit: "count",
      goodDirection: "up",
      baseline: 6_000,
    },
    {
      id: "reviewed",
      kind: "min",
      label: "Flags actually reviewed",
      unit: "count",
      goodDirection: "up",
      of: ["reviewCapacity", "flagged"],
    },
    {
      id: "costPerReview",
      kind: "constant",
      label: "Cost per manual review",
      unit: "inr",
      goodDirection: "down",
      value: 42,
    },
    {
      id: "reviewCost",
      kind: "product",
      label: "Manual review cost",
      unit: "inr",
      goodDirection: "down",
      of: ["reviewed", "costPerReview"],
    },

    // ── Churn, fed by the declines ───────────────────────────────────────
    {
      id: "blocksPerBlockedUser",
      kind: "constant",
      label: "Declines per affected user",
      unit: "count",
      goodDirection: "down",
      value: 1.4,
    },
    {
      id: "usersBlocked",
      kind: "quotient",
      label: "Users who hit a decline",
      unit: "count",
      goodDirection: "down",
      numerator: "falsePositives",
      denominator: "blocksPerBlockedUser",
    },
    {
      id: "blockedUserShare",
      kind: "quotient",
      label: "Share of users declined",
      unit: "ratio",
      goodDirection: "down",
      numerator: "usersBlocked",
      denominator: "usersPrior",
    },
    {
      id: "blockAbandonRate",
      kind: "constant",
      label: "Share of declined users who leave",
      unit: "ratio",
      goodDirection: "down",
      value: 0.09,
    },
    {
      id: "blockChurn",
      kind: "product",
      label: "Churn caused by declines",
      unit: "ratio",
      goodDirection: "down",
      of: ["blockedUserShare", "blockAbandonRate"],
    },
    {
      id: "baseChurnRate",
      kind: "input",
      label: "Churn from everything else",
      unit: "ratio",
      goodDirection: "down",
      baseline: 0.0295,
    },
    {
      id: "churnRate",
      kind: "sum",
      label: "Monthly churn",
      unit: "ratio",
      goodDirection: "down",
      of: ["baseChurnRate", "blockChurn"],
    },
    {
      id: "joiners",
      kind: "input",
      label: "New users / month",
      unit: "count",
      goodDirection: "up",
      baseline: 1_89_911,
    },
    /**
     * The base as a steady state, the same arithmetic Padhai Plus and Chalo
     * teach: a base fed by a steady stream settles at joiners ÷ churn. Here it
     * is what turns a decline into a number on the contribution line two months
     * later.
     */
    {
      id: "users",
      kind: "quotient",
      label: "Active users",
      unit: "count",
      goodDirection: "up",
      numerator: "joiners",
      denominator: "churnRate",
    },

    // ── The P&L ──────────────────────────────────────────────────────────
    {
      id: "revenuePerTxn",
      kind: "constant",
      label: "Net take per successful payment",
      unit: "inr",
      goodDirection: "up",
      value: 2.1,
    },
    {
      id: "paymentRevenue",
      kind: "product",
      label: "Payment revenue",
      unit: "inr",
      goodDirection: "up",
      of: ["successfulTransactions", "revenuePerTxn"],
    },
    {
      id: "platformCost",
      kind: "input",
      label: "Risk platform cost / month",
      unit: "inr",
      goodDirection: "down",
      baseline: 105 * LAKH,
    },
    {
      id: "totalCost",
      kind: "sum",
      label: "Total cost",
      unit: "inr",
      goodDirection: "down",
      of: ["fraudLoss", "blockSupportCost", "reviewCost", "platformCost"],
    },
    {
      id: "netContribution",
      kind: "difference",
      label: "Net contribution / month",
      unit: "inr",
      goodDirection: "up",
      minuend: "paymentRevenue",
      subtrahend: "totalCost",
    },
  ],

  dashboard: [
    {
      id: "p-kavach-deck",
      kind: "stat",
      title: "The model's scorecard, as it appeared at launch",
      caption:
        "Six months old, still on the risk dashboard, and every figure computed correctly. Two of them were measured on a rebalanced test set.",
      tiles: [
        { label: "Accuracy", value: 0.9941, unit: "ratio", goodDirection: "up" },
        { label: "Precision (holdout)", value: 0.94, unit: "ratio", goodDirection: "up" },
        { label: "Recall (holdout)", value: 0.91, unit: "ratio", goodDirection: "up" },
        { label: "AUC", value: 0.91, unit: "ratio", goodDirection: "up" },
        { label: "Decision threshold", value: 0.5, unit: "ratio", goodDirection: "up" },
      ],
    },
    {
      id: "p-kavach-business",
      kind: "stat",
      title: "The business, last month",
      caption: "Six months after the model went live. Deltas are against the month before it shipped.",
      tiles: [
        { label: "Payments attempted", value: 1_98_40_000, unit: "count", deltaPct: -0.041, goodDirection: "up" },
        { label: "Payment success rate", value: 0.9939, unit: "ratio", deltaPct: -0.0044, goodDirection: "up" },
        { label: "Genuine payments declined", value: 1_09_055, unit: "count", deltaPct: 4.62, goodDirection: "down" },
        { label: "Fraud loss carried", value: 87_08_966, unit: "inr", deltaPct: -0.211, goodDirection: "down" },
        { label: "Cost of handling declines", value: 92_69_635, unit: "inr", deltaPct: 4.62, goodDirection: "down" },
        { label: "Net contribution", value: 1_26_79_386, unit: "inr", deltaPct: -0.332, goodDirection: "up" },
      ],
    },
    {
      id: "p-kavach-trend",
      kind: "timeseries",
      title: "Success rate and fraud loss, last seven months",
      caption:
        "The model shipped between M-6 and M-5. Both lines respond. Only one of them has an owner watching it.",
      series: [
        {
          label: "Payment success rate",
          unit: "ratio",
          points: [
            { period: "M-6", value: 0.9983 },
            { period: "M-5", value: 0.9952 },
            { period: "M-4", value: 0.9947 },
            { period: "M-3", value: 0.9944 },
            { period: "M-2", value: 0.9942 },
            { period: "M-1", value: 0.994 },
            { period: "M-0", value: 0.9939 },
          ],
        },
        {
          label: "Fraud loss carried (₹ lakh)",
          unit: "inr_lakh",
          points: [
            { period: "M-6", value: 110.4 },
            { period: "M-5", value: 88.1 },
            { period: "M-4", value: 87.4 },
            { period: "M-3", value: 87.2 },
            { period: "M-2", value: 87.3 },
            { period: "M-1", value: 87.1 },
            { period: "M-0", value: 87.1 },
          ],
        },
      ],
    },
    {
      id: "p-kavach-complaints",
      kind: "funnel",
      title: "What happens to a declined genuine payment",
      caption:
        "Of 1.09 lakh wrongly declined payments last month. The bottom of this funnel is the churn number.",
      steps: [
        { label: "Genuine payment declined", value: 1_09_055 },
        { label: "Customer retried at least once", value: 71_896, deltaPct: -0.341 },
        { label: "Retry also declined", value: 43_622, deltaPct: -0.393 },
        { label: "Raised a support ticket", value: 26_173, deltaPct: -0.4 },
        { label: "Stopped using Kavach within 30 days", value: 7_011, deltaPct: -0.732 },
      ],
    },
    {
      id: "p-kavach-room",
      kind: "note",
      title: "What the room is saying",
      body:
        "Risk lead: we are catching 38% of fraud. That is the number I am judged on and it is too low. Take recall to 62% and we stop another ₹34 lakh a month walking out. " +
        "Data science: the model is good. AUC 0.91, precision 94% on the holdout, and it has not drifted — I re-ran the evaluation last week and got the same numbers. " +
        "Merchant team: three of our top ten have moved us down the waterfall this quarter. They all said the same thing, which is that our success rate is the worst on their stack. Switch the model off. " +
        "Support: declined-payment tickets went from 5,600 a month to 26,000. It is now the single biggest ticket category and it was not in the top five a year ago. " +
        "Finance: contribution is down ₹63 lakh a month since the model shipped, and the fraud line is the only one that improved.",
    },
    // ── Decoys ──────────────────────────────────────────────────────────
    //
    // Both true, both correctly measured, neither evidence for any cause. The
    // issuer panel is the useful one: bank-side declines are a real and
    // familiar cause of a falling success rate, and a candidate has to notice
    // that the movement in it is two orders of magnitude too small.
    {
      id: "p-kavach-issuers",
      kind: "segments",
      title: "Bank-side declines by issuer",
      caption:
        "Declines the issuing bank made, not Kavach. Measured the same way throughout the period.",
      dimension: "Issuer",
      rows: [
        { label: "Bank A", value: 0.0011, unit: "ratio", deltaPct: 0.09 },
        { label: "Bank B", value: 0.0009, unit: "ratio", deltaPct: 0.02 },
        { label: "Bank C", value: 0.0014, unit: "ratio", deltaPct: 0.21 },
        { label: "Bank D", value: 0.0008, unit: "ratio", deltaPct: -0.04 },
        { label: "Everyone else", value: 0.001, unit: "ratio", deltaPct: 0.05 },
      ],
    },
    {
      id: "p-kavach-infra",
      kind: "stat",
      title: "Platform health",
      caption: "The risk service and the payment path, measured continuously.",
      tiles: [
        { label: "Scoring latency, p99 (ms)", value: 41, unit: "count", deltaPct: 0.02, goodDirection: "down" },
        { label: "Risk service uptime", value: 0.9997, unit: "ratio", deltaPct: 0.0, goodDirection: "up" },
        { label: "Timed-out scoring calls", value: 0.0002, unit: "ratio", deltaPct: -0.11, goodDirection: "down" },
        { label: "App crash-free sessions", value: 0.998, unit: "ratio", deltaPct: 0.001, goodDirection: "up" },
      ],
    },
  ],

  budget: { analystDays: 6, sprints: 3, rupees: 24 * LAKH },

  drilldowns: [
    {
      id: "dd-confusion",
      label: "Pull the confusion matrix on production traffic",
      question: "What are all four boxes, on real traffic rather than the test set?",
      cost: 2,
      evidenceFor: ["reading.accuracy", "reading.holdout"],
      readsAs:
        "4,524 caught, 7,380 missed, and 1,09,055 genuine payments declined. That is precision of 4.0%, not 94%, and 24.1 customers blocked for every fraudster stopped. Accuracy is 99.41% — and a model that flagged nothing at all would score 99.94% on the same month. The metric the launch was signed off on ranks this model below doing nothing.",
      reveals: [
        {
          id: "p-kavach-matrix",
          kind: "segments",
          title: "The four boxes, last month, production traffic",
          caption:
            "1.98 crore payments. 11,904 of them fraudulent. Every metric below is a ratio of two of these rows.",
          dimension: "Outcome",
          rows: [
            { label: "True positives — flagged, was fraud", value: 4_524, unit: "count" },
            { label: "False positives — flagged, was genuine", value: 1_09_055, unit: "count" },
            { label: "False negatives — missed fraud", value: 7_380, unit: "count" },
            { label: "True negatives — correctly allowed", value: 1_97_19_041, unit: "count" },
          ],
        },
        {
          id: "p-kavach-metrics",
          kind: "stat",
          title: "The same month, as metrics",
          caption: "Deck figure alongside, where the two differ.",
          tiles: [
            { label: "Precision — production", value: 0.04, unit: "ratio", goodDirection: "up" },
            { label: "Precision — the deck", value: 0.94, unit: "ratio", goodDirection: "up" },
            { label: "Recall — production", value: 0.38, unit: "ratio", goodDirection: "up" },
            { label: "Accuracy", value: 0.9941, unit: "ratio", goodDirection: "up" },
            { label: "Accuracy if it flagged nothing", value: 0.9994, unit: "ratio", goodDirection: "up" },
            { label: "Blocked per fraud caught", value: 24.1, unit: "multiple", goodDirection: "down" },
          ],
        },
        {
          id: "p-kavach-matrix-note",
          kind: "note",
          title: "Why accuracy cannot see any of this",
          body:
            "Accuracy is (true positives + true negatives) ÷ everything. The true-negative box has 1.97 crore transactions in it and the other three have 1.2 lakh between them, so accuracy is essentially a measurement of the true-negative box and nothing else. " +
            "That is why a model which flags nothing scores 99.94% and this one scores 99.41%: declining 1.09 lakh genuine payments costs half a percentage point of accuracy, and catching 4,524 frauds buys back a fiftieth of that. " +
            "The general rule is that any metric including the true-negative box goes blind when one class is rare. Precision, recall and the ratio of false positives to true positives all exclude it, which is exactly why they still say something here.",
        },
      ],
    },
    {
      id: "dd-threshold",
      label: "Sweep the threshold",
      question: "What does the trade between precision and recall actually look like at other cuts?",
      cost: 2,
      evidenceFor: ["reading.accuracy", "action.hardblock"],
      readsAs:
        "The 0.5 cut is nowhere near the best point on the curve. Moving to 0.90 takes recall from 38% to 30% and cuts declines from 1.09 lakh to 15,000 — you give up a fifth of the fraud you catch, remove six-sevenths of the collateral damage, and contribution goes from ₹1.27 crore a month to ₹1.97 crore. Raising recall to 62% instead, which is what the risk lead is asking for, more than doubles declines to 2.62 lakh and takes contribution to ₹27.5 lakh.",
      reveals: [
        {
          id: "p-kavach-sweep",
          kind: "segments",
          title: "Recall, declines and net contribution at each threshold",
          caption:
            "The same model throughout — only the cut moves. Net contribution is the monthly figure at that operating point, everything else held.",
          dimension: "Threshold",
          rows: [
            { label: "0.30 — recall 62%, 2,61,731 declined, precision 2.7%", value: 27_52_478, unit: "inr" },
            { label: "0.50 — recall 38%, 1,09,055 declined, precision 4.0% (today)", value: 1_26_79_386, unit: "inr" },
            { label: "0.70 — recall 34%, 41,000 declined, precision 9.0%", value: 1_80_45_066, unit: "inr" },
            { label: "0.90 — recall 30%, 15,000 declined, precision 19.2%", value: 1_97_47_798, unit: "inr" },
            { label: "0.97 — recall 21%, 4,100 declined, precision 37.9%", value: 1_94_32_983, unit: "inr" },
            { label: "Flag nothing — recall 0%, 0 declined", value: 1_70_92_282, unit: "inr" },
          ],
        },
        {
          id: "p-kavach-sweep-note",
          kind: "note",
          title: "What the sweep does and does not tell you",
          body:
            "Note the shape. The curve has an interior optimum around 0.90, and both ends are worse than the middle — but the low end is far worse than the high end, and switching the model off entirely beats today's setting comfortably. The merchant team is closer to right than the risk team, and both are wrong. " +
            "Note also what has not changed: the model's ranking is identical at every row. AUC is a property of the ranking and it is 0.91 whatever cut you pick, which is why 'the model is good' and 'the threshold is wrong' are both true statements about the same system. " +
            "One caveat that matters for what you do next. These scores are not calibrated, so 0.90 is a position on this curve rather than a 90% probability of fraud. The sweep tells you where to cut today; it does not let you price the cut against the cost of an error until the score means something.",
        },
      ],
    },
    {
      id: "dd-costs",
      label: "Price both kinds of error",
      question: "What does a missed fraud actually cost us, and what does a wrong decline cost?",
      cost: 2,
      evidenceFor: ["action.hardblock", "reading.accuracy"],
      readsAs:
        "The room has been working from ₹4,200, which is the average fraudulent ticket. Kavach does not carry that. After issuer recovery and the chargeback split the net loss is ₹1,180. A wrong decline costs ₹85 to handle, plus ₹2.10 of lost take, plus a 9% chance the customer stops using Kavach. So the two error types cost roughly ₹1,180 and ₹85 — a ratio of about 14:1, against the 50:1 everyone has assumed.",
      reveals: [
        {
          id: "p-kavach-costs",
          kind: "stat",
          title: "What each error type costs, measured",
          caption: "Twelve months of resolved cases, and the support ledger.",
          tiles: [
            { label: "Average fraudulent ticket", value: 4_200, unit: "inr", goodDirection: "down" },
            { label: "Recovered from issuer / merchant", value: 3_020, unit: "inr", goodDirection: "up" },
            { label: "Net loss Kavach carries", value: 1_180, unit: "inr", goodDirection: "down" },
            { label: "Support cost of one decline", value: 85, unit: "inr", goodDirection: "down" },
            { label: "Take lost on a declined payment", value: 2.1, unit: "inr", goodDirection: "down" },
            { label: "Declined users who leave within 30 days", value: 0.09, unit: "ratio", goodDirection: "down" },
          ],
        },
        {
          id: "p-kavach-costs-note",
          kind: "note",
          title: "The sum nobody had done",
          body:
            "Last month the model let 7,380 frauds through, which cost ₹87.1 lakh. It declined 1,09,055 genuine payments, which cost ₹92.7 lakh to handle. The false positives are already the larger line, and that is before the ₹2.3 lakh of lost take and before a single merchant reroutes. " +
            "This is the sum that decides the threshold. A cost-optimal cut is the point where one more false positive costs the same as one more missed fraud, and you cannot find it without both numbers. Kavach had one of them, off by a factor of 3.6, and was not treating it as an input to anything. " +
            "The ₹4,200 figure is not wrong, incidentally. It is the right answer to a different question — how much fraud is attempted — and it belongs in a board pack rather than a threshold calculation.",
        },
      ],
    },
    {
      id: "dd-training",
      label: "Read the training and validation setup",
      question: "How was this model trained, and where did 94% precision come from?",
      cost: 2,
      evidenceFor: ["reading.holdout", "model.calibration"],
      readsAs:
        "Trained on a rebalanced sample: every fraud case plus a random equal-sized draw of genuine ones, so the training base rate is 50% rather than 0.06%. The 94% precision was measured on a holdout built the same way. Recall and specificity carry across from that holdout; precision does not, because it depends on prevalence. The model is also uncalibrated — a score of 0.5 corresponds to about a 0.4% chance of fraud in production, not 50%.",
      reveals: [
        {
          id: "p-kavach-training",
          kind: "stat",
          title: "Training and holdout composition",
          tiles: [
            { label: "Fraud share — production", value: 0.0006, unit: "ratio", goodDirection: "down" },
            { label: "Fraud share — training sample", value: 0.5, unit: "ratio", goodDirection: "down" },
            { label: "Precision on the balanced holdout", value: 0.94, unit: "ratio", goodDirection: "up" },
            { label: "Precision on production traffic", value: 0.04, unit: "ratio", goodDirection: "up" },
            { label: "Recall on the balanced holdout", value: 0.91, unit: "ratio", goodDirection: "up" },
            { label: "AUC, both samples", value: 0.91, unit: "ratio", goodDirection: "up" },
          ],
        },
        {
          id: "p-kavach-calibration",
          kind: "segments",
          title: "What a score actually means in production",
          caption:
            "Every transaction scored last month, bucketed, against the share of each bucket that turned out to be fraud.",
          dimension: "Model score",
          rows: [
            { label: "0.50 – 0.60 — implied 55%, actual", value: 0.004, unit: "ratio" },
            { label: "0.60 – 0.70 — implied 65%, actual", value: 0.009, unit: "ratio" },
            { label: "0.70 – 0.80 — implied 75%, actual", value: 0.023, unit: "ratio" },
            { label: "0.80 – 0.90 — implied 85%, actual", value: 0.071, unit: "ratio" },
            { label: "0.90 – 0.97 — implied 93%, actual", value: 0.196, unit: "ratio" },
            { label: "0.97 – 1.00 — implied 99%, actual", value: 0.483, unit: "ratio" },
          ],
        },
        {
          id: "p-kavach-training-note",
          kind: "note",
          title: "Which metrics survive a rebalanced test set, and which do not",
          body:
            "Downsampling the majority class is a reasonable thing to do while training — it stops the model learning to predict 'not fraud' every time. The mistake was evaluating on a set built the same way and carrying one of the numbers across. " +
            "Recall is computed entirely within the fraud class, so rebalancing does not touch it. Specificity is computed entirely within the genuine class, same argument. Precision spans both classes, so it moves with the ratio between them — and going from a 50% base rate to 0.06% is a factor of roughly 830. " +
            "Calibration is the second half of the same problem. The scores were fitted where fraud was half the data, so they are inflated by about three orders of magnitude at the low end. That is survivable for ranking and fatal for deciding, because a cost-optimal threshold is a statement about probabilities.",
        },
      ],
    },
    {
      id: "dd-merchants",
      label: "Ask the merchants what they see",
      question: "What has happened to our position in the checkout waterfall?",
      cost: 2,
      evidenceFor: ["action.hardblock", "demand.issuers"],
      readsAs:
        "Kavach has the worst success rate on every stack it sits in — 99.39% against 99.71% to 99.86% for the alternatives. Three of the top ten merchants demoted it this quarter and volume is following: attempted payments are down 4.1% while the merchant count is up. This is a slow leak rather than a cliff, and it does not reverse on its own once a routing rule is changed.",
      reveals: [
        {
          id: "p-kavach-waterfall",
          kind: "segments",
          title: "Success rate by provider, as merchants measure it",
          caption: "Taken from three merchants' own routing dashboards, same definition throughout.",
          dimension: "Provider",
          rows: [
            { label: "Competitor 1", value: 0.9986, unit: "ratio" },
            { label: "Competitor 2", value: 0.9979, unit: "ratio" },
            { label: "Competitor 3", value: 0.9971, unit: "ratio" },
            { label: "Kavach Pay", value: 0.9939, unit: "ratio" },
          ],
        },
        {
          id: "p-kavach-volume",
          kind: "timeseries",
          title: "Attempted payments and merchant count",
          caption: "More merchants, fewer payments. The routing rules are doing the work.",
          series: [
            {
              label: "Payments attempted (lakh)",
              unit: "count",
              points: [
                { period: "M-6", value: 206.9 },
                { period: "M-5", value: 205.1 },
                { period: "M-4", value: 203.4 },
                { period: "M-3", value: 201.8 },
                { period: "M-2", value: 200.3 },
                { period: "M-1", value: 199.2 },
                { period: "M-0", value: 198.4 },
              ],
            },
            {
              label: "Merchants live",
              unit: "count",
              points: [
                { period: "M-6", value: 37_100 },
                { period: "M-5", value: 37_600 },
                { period: "M-4", value: 38_200 },
                { period: "M-3", value: 38_700 },
                { period: "M-2", value: 39_200 },
                { period: "M-1", value: 39_700 },
                { period: "M-0", value: 40_100 },
              ],
            },
          ],
        },
      ],
    },
    {
      id: "dd-issuers",
      label: "Check the issuing banks",
      question: "How much of the success-rate fall is bank-side rather than ours?",
      cost: 2,
      evidenceFor: ["demand.issuers"],
      readsAs:
        "Almost none of it. Bank-side declines went from 0.103% to 0.106% of attempts over the period, which is 0.003 percentage points. The success rate fell by 0.44 percentage points. Issuer behaviour explains under 1% of the movement, and one bank's NPCI downtime window in M-3 is visible in the daily data and gone within 48 hours.",
      reveals: [
        {
          id: "p-kavach-issuer-trend",
          kind: "timeseries",
          title: "Decline rate, split by who declined",
          caption: "The two lines are on the same axis. Only one of them moved.",
          series: [
            {
              label: "Declined by Kavach's model",
              unit: "ratio",
              points: [
                { period: "M-6", value: 0.0 },
                { period: "M-5", value: 0.0043 },
                { period: "M-4", value: 0.0048 },
                { period: "M-3", value: 0.0051 },
                { period: "M-2", value: 0.0053 },
                { period: "M-1", value: 0.0054 },
                { period: "M-0", value: 0.0055 },
              ],
            },
            {
              label: "Declined by the issuing bank",
              unit: "ratio",
              points: [
                { period: "M-6", value: 0.00103 },
                { period: "M-5", value: 0.00104 },
                { period: "M-4", value: 0.00104 },
                { period: "M-3", value: 0.00112 },
                { period: "M-2", value: 0.00105 },
                { period: "M-1", value: 0.00106 },
                { period: "M-0", value: 0.00106 },
              ],
            },
          ],
        },
      ],
    },
  ],

  causes: [
    {
      id: "reading",
      parentId: null,
      label: "How the model's performance was read",
      verdict:
        "The right branch, and the uncomfortable one: every number in the launch deck is arithmetically correct. What went wrong is which numbers were computed and what they were compared against.",
    },
    {
      id: "reading.accuracy",
      parentId: "reading",
      label: "Accuracy was the metric it was signed off on, and it is blind at this base rate",
      verdict:
        "This was it. Fraud is 0.06% of transactions, so accuracy is almost entirely a measurement of the true-negative box. The model scores 99.41%; a model that flagged nothing would score 99.94%. The metric the launch was approved on ranks this model below doing nothing, and because 99.4% reads like a pass, nobody ever computed the two numbers that were not blind — precision on production traffic, and false positives per fraud caught.",
    },
    {
      id: "reading.holdout",
      parentId: "reading",
      label: "The 94% precision came from a rebalanced holdout, not production",
      verdict:
        "Half-right, and worth keeping. It is a true statement — training downsampled genuine transactions to a 50/50 split, the holdout was built the same way, and precision measured at a 50% base rate is 94% where production is 4.0%. But it is the reason the wrong metric went unchallenged rather than a second defect to fix. Recall and specificity do carry across a rebalanced set; precision never can. Fix which metrics get reported and this stops being possible.",
    },
    {
      id: "model",
      parentId: null,
      label: "Something wrong with the model itself",
      verdict:
        "Half a branch. The model is not broken, and 'retrain it' is the most expensive wrong answer available. But one thing under here does need fixing before the threshold can be chosen properly.",
    },
    {
      id: "model.discrimination",
      parentId: "model",
      label: "The model cannot tell fraud from normal traffic",
      verdict:
        "No. AUC is 0.91 on both the balanced holdout and production traffic, and the score buckets separate cleanly — the top bucket is 48% fraud, the bottom is 0.4%. The ranking is good. It has also not drifted: the evaluation was re-run last week and returned the same figures. Nothing about the ordering of these scores is the problem.",
    },
    {
      id: "model.calibration",
      parentId: "model",
      label: "The scores are not probabilities, so the 0.5 cut is arbitrary",
      verdict:
        "True, and it is what has to be fixed first. Fitted on a 50/50 sample, the scores are inflated by roughly three orders of magnitude at the low end: the 0.50–0.60 bucket is 0.4% fraud in reality. That is survivable for ranking and fatal for deciding, because a cost-optimal threshold is a claim about probabilities. Until this is fixed you can only pick a point on a curve, not price it.",
    },
    {
      id: "action",
      parentId: null,
      label: "What the system does once a transaction is flagged",
      verdict:
        "The branch with the leverage on it, and the one nobody in the room is arguing about. Both the risk team and the merchant team have accepted that a flag can only mean allow or decline.",
    },
    {
      id: "action.hardblock",
      parentId: "action",
      label: "A flag can only mean allow or decline — there is no third action",
      verdict:
        "This is where the money is. A confusion matrix has two error types, so everybody reasons as though there are two available actions, and the whole argument becomes where to put one line. Step-up auth is a third action: challenge the mid-score band with an OTP and a false positive costs twelve seconds instead of a declined payment, a support ticket and a 9% chance the customer leaves. That changes what an error costs rather than how many you make, which no threshold move can do.",
    },
    {
      id: "demand",
      parentId: null,
      label: "Something outside Kavach's own stack",
      verdict:
        "Clean, in the sense that matters. What is under here is real, and it is two orders of magnitude too small to explain a 0.44-point fall in success rate.",
    },
    {
      id: "demand.issuers",
      parentId: "demand",
      label: "The issuing banks are declining more",
      verdict:
        "No. Bank-side declines moved from 0.103% to 0.106% of attempts across the whole period — three thousandths of a percentage point, against a 0.44-point fall in success rate. Under 1% of the movement. The one visible NPCI downtime window in M-3 lasted 48 hours and is gone from the daily series. Merchants are genuinely routing volume away, but every one of them cited success rate when asked, so that is a symptom of the declines rather than a separate cause.",
    },
  ],
  trueCauseIds: ["reading.accuracy", "model.calibration", "action.hardblock"],

  interventions: [
    {
      id: "iv-recalibrate",
      label: "Retrain at production prevalence and calibrate the scores",
      pitch:
        "Stop evaluating on a rebalanced holdout. Retrain with the real class ratio, fit a calibration curve on production traffic, and republish the scorecard with precision measured where the model actually runs. The score becomes a probability, which is what a threshold needs in order to be chosen rather than defaulted to.",
      addresses: "model.calibration",
      cost: { sprints: 2, rupees: 18 * LAKH },
      minSprints: 2,
      effects: {
        whenRootCause: [
          { driver: "recall", deltaPct: 0.079 },
          { driver: "falsePositiveRate", deltaPct: -0.309 },
        ],
        otherwise: [
          { driver: "recall", deltaPct: 0.021 },
          { driver: "falsePositiveRate", deltaPct: -0.082 },
        ],
      },
      debrief:
        "On its own this moves less than it should, and that is the honest shape of it: calibration is a prerequisite rather than a fix. What it buys is the ability to say 'a transaction at this score has a 4% chance of being fraud, and 4% of ₹1,180 is less than the ₹85 a decline costs, so let it through' — which is an argument, where 'the threshold is 0.5' is a default. Ship it with the threshold move and the two together are worth far more than either alone.",
    },
    {
      id: "iv-threshold-cost",
      label: "Move the cut to the cost-optimal point",
      pitch:
        "Set the threshold where one more false positive costs the same as one more missed fraud, using the measured ₹1,180 and ₹85 rather than the ₹4,200 in everyone's head. That is around 0.90 on today's scores. Recall drops from 38% to about 30%; declines fall from 1.09 lakh to about 15,000.",
      addresses: "reading.accuracy",
      cost: { sprints: 1, rupees: 4 * LAKH },
      effects: {
        whenRootCause: [
          { driver: "recall", deltaPct: -0.211 },
          { driver: "falsePositiveRate", deltaPct: -0.864 },
        ],
        otherwise: [
          { driver: "recall", deltaPct: -0.211 },
          { driver: "falsePositiveRate", deltaPct: -0.4 },
        ],
      },
      debrief:
        "The cheapest thing on the board by a distance — one sprint and ₹4 lakh, because it is a configuration change — and it recovers most of the damage. Note what it gives up: a fifth of the fraud the model was catching, which is exactly the trade the risk lead will object to. It is the right trade, because the fraud given up costs ₹1,180 a case and the declines removed cost ₹85 each and there are ninety-four thousand of them. Being cheap is not the same as being small.",
    },
    {
      id: "iv-stepup-auth",
      label: "Send the mid-score band to step-up auth instead of declining it",
      pitch:
        "Stop treating a flag as a verdict. Above 0.97, decline. Between the cost-optimal cut and 0.97, challenge with an OTP and let the customer through if they pass. A false positive then costs twelve seconds rather than a declined payment, a support ticket and a 9% chance of losing the customer.",
      addresses: "action.hardblock",
      cost: { sprints: 2, rupees: 14 * LAKH },
      minSprints: 2,
      effects: {
        whenRootCause: [
          { driver: "falsePositiveRate", deltaPct: -0.72 },
          { driver: "recall", deltaPct: 0.13 },
          { driver: "txnsPerUser", deltaPct: 0.035 },
        ],
        otherwise: [
          { driver: "falsePositiveRate", deltaPct: -0.3 },
          { driver: "recall", deltaPct: 0.04 },
        ],
      },
      debrief:
        "The one that is not a threshold move, and the reason this scenario exists. Every other option on the board accepts that a flag means allow or decline and argues about where to put the line. A challenge is a third action, and it breaks the trade the whole argument was premised on: recall goes UP while hard declines go down, which no point on the sweep can do. It also pays twice, because success rate is what the merchants route on and it is the only lever here that moves that back.",
    },
    {
      id: "iv-manual-review",
      label: "Staff the manual review queue",
      pitch:
        "Ninety-five per cent of declines are never seen by a human. Triple the review team so more flagged transactions get looked at before the customer is turned away, and feed the outcomes back as labels.",
      addresses: "action.hardblock",
      cost: { sprints: 1, rupees: 9 * LAKH },
      effects: {
        whenRootCause: [
          { driver: "reviewCapacity", deltaPct: 2.0 },
          { driver: "falsePositiveRate", deltaPct: -0.12 },
        ],
        otherwise: [
          { driver: "reviewCapacity", deltaPct: 2.0 },
          { driver: "falsePositiveRate", deltaPct: -0.05 },
        ],
      },
      debrief:
        "Genuinely helps, and it is capacity-bound in a way the model makes you feel: `reviewed` is the smaller of the queue's capacity and the number of flags, so tripling the team takes it from 6,000 to 18,000 against 1.14 lakh flags. You are still missing six in seven, and you are now paying ₹7.6 lakh a month to do it. Reviewing false positives is absorbing them after the fact. It is worth doing alongside a fix, and it is a poor substitute for one.",
    },
    {
      id: "iv-block-harder",
      label: "Raise recall to 62%",
      pitch:
        "This is what the risk lead is asking for. We catch 38% of fraud and ₹87 lakh a month is walking out of the door. Drop the threshold to 0.30, catch 62%, and stop another ₹34 lakh of it.",
      addresses: "model.discrimination",
      cost: { sprints: 1, rupees: 5 * LAKH },
      effects: {
        whenRootCause: [
          { driver: "recall", deltaPct: 0.632 },
          { driver: "falsePositiveRate", deltaPct: 1.4 },
          { driver: "txnsPerUser", deltaPct: -0.06 },
        ],
        otherwise: [
          { driver: "recall", deltaPct: 0.632 },
          { driver: "falsePositiveRate", deltaPct: 1.4 },
          { driver: "txnsPerUser", deltaPct: -0.075 },
          { driver: "baseChurnRate", deltaPct: 0.09 },
        ],
      },
      debrief:
        "The worst option on the board, and the arithmetic says so without any authored penalty doing the work. Recall 38% → 62% saves ₹33.7 lakh of fraud a month. It also takes declines from 1.09 lakh to 2.62 lakh, which costs ₹1.30 crore in handling alone. The trade is only attractive if a missed fraud costs ₹4,200 and a decline costs nothing, which is precisely the pair of assumptions dd-costs disproves. It is worth noticing that this is the option with a named owner and a metric attached to somebody's review.",
    },
  ],

  /**
   * Committing the whole budget roughly doubles what the risk platform costs to
   * run for the horizon.
   *
   * Scaled against the gains rather than the budget's face value, for the
   * reason given on Rangoli: the ₹38 lakh is a programme investment and the
   * north star is a monthly figure, so charging the full amount every month
   * would make doing nothing the answer to everything. The multiple is high
   * because the fixes here are worth a lot — recovering ₹60 lakh a month on a
   * ₹1.05 crore platform means money has to cost something real before the
   * optimum stops being "spend all of it".
   */
  spend: { driver: "platformCost", atFullBudget: 0.62 },

  /**
   * The month not going exactly to plan.
   *
   * The false positive rate is the noisier of the two: fraud patterns shift
   * week to week and the score distribution moves with them, so the same
   * threshold catches a different slice. Payments per user is steadier — it is
   * a routing rule rather than a decision anybody remakes daily.
   */
  noise: {
    drivers: [
      { driver: "falsePositiveRate", sigma: 0.04 },
      { driver: "txnsPerUser", sigma: 0.018 },
    ],
    driftSigma: 0.25,
  },

  // Merchants are still working through their routing reviews, and the churn
  // from six months of declines is still arriving. Doing nothing is not holding
  // position.
  drift: [
    { driver: "txnsPerUser", deltaPct: -0.018 },
    { driver: "baseChurnRate", deltaPct: 0.012 },
  ],
  horizonQuarters: 2,

  parInvestigation: ["dd-confusion", "dd-costs"],
  /** Derived by `scripts/best-allocation.ts`, not by hand. */
  bestAllocation: [
    { interventionId: "iv-threshold-cost", sprints: 1, rupees: 475_000 },
    { interventionId: "iv-stepup-auth", sprints: 2, rupees: 325_000 },
  ],

  debrief: {
    causalChain: [
      "The model is not broken. AUC is 0.91 on production traffic, the score buckets separate cleanly, and it has not drifted. Every number in the launch deck was computed correctly. All of the damage was done by which numbers were computed.",
      "Fraud is 0.06% of transactions. At that base rate accuracy is essentially a measurement of the true-negative box, which holds 1.97 crore of the 1.98 crore rows. The model scores 99.41%. A model that flagged nothing would score 99.94%.",
      "So the metric the launch was approved on ranks this model below doing nothing, and because 99.4% reads like a pass, nobody computed the two metrics that were not blind.",
      "Those are precision and false positives per fraud caught. On production traffic: 4,524 frauds caught, 1,09,055 genuine payments declined. Precision 4.0%, and 24.1 customers blocked for every fraudster stopped.",
      "The 94% in the deck was real too — measured on a holdout rebalanced to 50/50. Precision is the one headline metric that moves with prevalence, so it is the one that cannot be carried across from a rebalanced set. Recall and specificity can, which is what made the error invisible.",
      "The costs were wrong in the other direction. The room worked from ₹4,200, the average fraudulent ticket. After issuer recovery Kavach carries ₹1,180. A wrong decline costs ₹85 to handle. So the true ratio is about 14:1, against the 50:1 everyone assumed, and at 24 declines per catch the false positives were already the larger line: ₹92.7 lakh against ₹87.1 lakh.",
      "Downstream of that: 26,000 support tickets a month, 9% of declined users gone within thirty days, and Kavach with the worst success rate on every merchant stack it sits in. Three of the top ten demoted it, attempts fell 4.1% while the merchant count rose 8%, and contribution is down ₹63 lakh a month.",
      "The fix is not one threshold. Calibrate so the score is a probability, cut where the measured costs say to cut, and then stop treating a flag as a verdict — challenge the mid band with an OTP instead of declining it, so a false positive costs twelve seconds rather than a customer.",
    ],
    whereTheLeverageWas:
      "The third action. Everything else on this board accepts that a flag means allow or decline and argues about where to put the line — and inside that premise every gain in recall is paid for in declines. Step-up auth breaks it: recall goes up while hard declines go down, which no point on the threshold sweep can do, because you are changing what an error costs rather than how many you make. Underneath it, the cheapest thing available was the threshold itself: one sprint, ₹4 lakh, a configuration change, and it recovers most of the damage on its own. The expensive part was never the fix. It was the six months during which the only number anybody looked at could not see the problem.",
    strongAnswer: [
      "The model is fine and the threshold is wrong, and those are both true statements about the same system.",
      "Start with the base rate. Fraud is 0.06% of transactions, and at that prevalence accuracy is blind — it is measuring the true-negative box and nothing else.",
      "The model scores 99.41% accuracy. A model that flags nothing scores 99.94%. The metric this launch was signed off on ranks it below doing nothing.",
      "What accuracy was hiding: 4,524 frauds caught against 1,09,055 genuine payments declined. That is 4% precision, and 24 customers blocked for every fraudster stopped.",
      "The 94% in the deck is not a lie — it was measured on a 50/50 rebalanced holdout. Precision moves with prevalence, so it is the one metric you can never carry across from a rebalanced test set. Recall and specificity you can, which is exactly why this got through review.",
      "Then the costs, which were wrong the other way. A missed fraud costs ₹1,180 net of recovery, not the ₹4,200 ticket. A wrong decline costs ₹85 to handle. Declines were already the bigger line — ₹92.7 lakh against ₹87.1 lakh.",
      "So raising recall to 62% is the worst thing we could do. It saves ₹34 lakh of fraud and spends ₹1.3 crore on handling declines.",
      "I would do three things. Retrain at production prevalence and calibrate, so a score means a probability and a threshold can be argued for rather than defaulted to.",
      "Then move the cut to where one more false positive costs the same as one more missed fraud. That is around 0.90, it costs one sprint, and it removes six-sevenths of the declines for a fifth of the catch.",
      "Then the part that is not a threshold at all: challenge the mid band with an OTP instead of declining it. That is a third action, and it is the only lever here that raises recall and cuts declines at the same time.",
      "And I would change what gets reported. Precision on production traffic, false positives per fraud caught, and both error types priced in rupees on the same line. Accuracy comes off the dashboard.",
    ],
  },

  coachFallback: [
    {
      topic: ["accuracy", "99.4", "99.94", "base rate", "imbalance", "rare", "blind"],
      answer: [
        "Fraud is 0.06% of transactions, so 1.97 crore of the 1.98 crore rows are true negatives.",
        "Accuracy includes that box, so it is essentially measuring it. The model scores 99.41%; a model that flags nothing scores 99.94%.",
        "That is the test: if flagging nothing beats your model on a metric, the metric cannot see what your model is for.",
      ],
    },
    {
      topic: ["precision", "94", "4%", "holdout", "rebalanced", "downsample", "prevalence", "50/50"],
      answer: [
        "Both precision figures are real. 94% was measured on a holdout rebalanced to 50% fraud; 4.0% is production, where fraud is 0.06%.",
        "Precision spans both classes, so it moves with the ratio between them. Recall and specificity are computed within one class each, so they carry across a rebalanced set unchanged.",
        "That asymmetry is why this passed review: two of the three headline numbers were transferable and the third was not, and nobody separated them.",
      ],
    },
    {
      topic: ["recall", "38", "62", "block harder", "catch more", "risk lead", "threshold up"],
      answer: [
        "Recall is 38% today. Taking it to 62% saves about ₹33.7 lakh a month of fraud.",
        "It also takes declines from 1.09 lakh to 2.62 lakh, which costs ₹1.30 crore a month in handling alone.",
        "That trade only works if a missed fraud costs ₹4,200 and a decline costs nothing. The measured figures are ₹1,180 and ₹85.",
      ],
    },
    {
      topic: ["false positive", "fpr", "0.55", "specificity", "24", "blocked per", "declined"],
      answer: [
        "The false positive rate is 0.55%, which sounds like a rounding error until you apply it to 1.98 crore genuine payments: 1,09,055 declines a month.",
        "Against 4,524 frauds caught, that is 24.1 genuine customers blocked per fraudster stopped.",
        "Note that precision is not one minus the false positive rate. A tiny rate against a huge denominator beats a large rate against a tiny one every time.",
      ],
    },
    {
      topic: ["cost", "1180", "4200", "85", "asymmetry", "recovery", "chargeback", "optimal"],
      answer: [
        "The room works from ₹4,200, which is the average fraudulent ticket rather than what Kavach carries. After issuer recovery and the chargeback split the net loss is ₹1,180.",
        "A wrong decline costs ₹85 to handle, plus ₹2.10 of lost take, plus a 9% chance the customer stops using Kavach.",
        "So the ratio is about 14:1, not 50:1 — and at 24 declines per catch the false positives are already the larger line, ₹92.7 lakh against ₹87.1 lakh.",
      ],
    },
    {
      topic: ["calibration", "probability", "uncalibrated", "score", "0.5", "threshold", "sweep"],
      answer: [
        "The 0.5 cut is the library default rather than a decision. The scores are not probabilities: the 0.50–0.60 bucket is 0.4% fraud in production, not 55%.",
        "That is survivable for ranking — AUC is 0.91 either way — and fatal for deciding, because a cost-optimal threshold is a claim about probabilities.",
        "So calibration comes before tuning. Otherwise you can pick a point on the curve but you cannot price it against ₹1,180 and ₹85.",
      ],
    },
    {
      topic: ["step-up", "stepup", "otp", "challenge", "third action", "friction", "review"],
      answer: [
        "A confusion matrix has two error types, so people reason as though there are two actions. There are three.",
        "Challenge the mid band with an OTP and a false positive costs twelve seconds instead of a declined payment, a support ticket and a 9% chance of losing the customer.",
        "That is the only lever here that raises recall and cuts hard declines at the same time, because it changes what an error costs rather than how many you make.",
      ],
    },
    {
      topic: ["merchant", "routing", "waterfall", "success rate", "volume", "switch off"],
      answer: [
        "Kavach has the worst success rate on every stack it sits in: 99.39% against 99.71% to 99.86%.",
        "Three of the top ten merchants demoted it this quarter, and attempts are down 4.1% while the merchant count is up 8%.",
        "The merchant team's instinct to switch the model off is closer to right than the risk team's — flagging nothing beats today's setting — but both are worse than calibrating and cutting properly.",
      ],
    },
    {
      topic: ["issuer", "bank", "npci", "downtime", "outage", "decline rate"],
      answer: [
        "Bank-side declines went from 0.103% to 0.106% of attempts across the whole period.",
        "Success rate fell 0.44 percentage points over the same window, so issuers explain under 1% of it.",
        "The one NPCI downtime window in M-3 lasted 48 hours and is gone from the daily series.",
      ],
    },
    {
      topic: ["auc", "model good", "drift", "retrain", "discrimination", "ranking"],
      answer: [
        "AUC is 0.91 on both the balanced holdout and production traffic, and the top score bucket is 48% fraud against 0.4% in the bottom one.",
        "The evaluation was re-run last week and returned the same numbers, so it has not drifted either.",
        "The ranking is good. 'Retrain it' is the most expensive wrong answer on this board — what needs fixing is the calibration, the cut, and what happens after a flag.",
      ],
    },
  ],
};
