/**
 * "Orders are down 9% and nobody knows why" — the metric war room.
 *
 * The most-asked format in PM interviews, and the one this engine was built
 * for. India context and ₹ throughout, per the app's convention.
 *
 * ── The truth, for whoever maintains this ─────────────────────────────────
 *
 * A competitor raised rider payouts in tier-2 cities six weeks ago. NukkadEats
 * riders followed the money, tier-2 rider hours fell 22%, delivery ETAs
 * stretched from 31 to 48 minutes, and customers who saw a 48-minute ETA at
 * checkout abandoned. So **sessions are flat and conversion is broken**, and the
 * cause is `supply.riders`.
 *
 * The scenario is built around that one distinction, because it is what a good
 * PM does first and a weak one skips: separate the demand side from the
 * conversion side before hypothesising. `orders = sessions × conversion` is
 * modelled explicitly so the arithmetic makes the point on its own — which is
 * also why the national brand campaign is the sharpest trap in here. It lifts
 * sessions 5% and nets almost nothing, because pouring traffic into a broken
 * funnel is exactly as useless as it sounds once you can see the two terms.
 *
 * The other trap is deeper discounting. It genuinely works on the north star —
 * orders go up — and it does it by handing back the entire contribution margin,
 * which the outcome report shows next to the orders line. A candidate who
 * chases the headline metric gets to watch the business pay for it.
 *
 * ── Balance notes ─────────────────────────────────────────────────────────
 *
 * `bestAllocation` uses every people-week and **banks ₹5.38 crore of ₹12**.
 * That inversion is the point of the v2 conversion. Capacity is still the
 * binding constraint — there is no spare slot to bolt a discount push onto —
 * but money is no longer something to get rid of: response curves make the
 * fourth crore behind the right fix nearly worthless, and `spend` charges every
 * committed rupee to contribution every week, so the fourth crore is worse than
 * worthless. The answer to "how much?" is a number strictly inside the budget.
 *
 * `checkBalance` searches the money lattice rather than sweeping full-cost
 * subsets, and `tests/sim-scenario.test.ts` runs it. If you retune an effect or
 * a curve, that test is what will tell you — and `scripts/best-allocation.ts`
 * is what will tell you the new answer.
 */

import type { SimScenario } from "../types";

const CRORE = 10_000_000;

export const metricDropFoodDelivery: SimScenario = {
  slug: "metric-drop-food-delivery",
  title: "NukkadEats: orders are down 9% and nobody knows why",
  company: "NukkadEats",
  premise:
    "A food-delivery app's weekly orders have fallen 9% over six weeks. Find out why, then spend a quarter's capacity fixing it.",
  situation:
    "You are the PM for growth at NukkadEats, a food-delivery app operating in 180 Indian cities. " +
    "Weekly orders have fallen from 26.4 lakh to 24 lakh over the last six weeks — about 9% — and the drop has not flattened out. " +
    "Nobody has a convincing explanation yet. Marketing thinks a competitor is outspending us. Engineering thinks it started around a release. Ops thinks it's the festival calendar. " +
    "You have 8 analyst-days to find out what is actually happening, and then engineering capacity and ₹12 crore to do something about it. " +
    "The board's question is not the orders line: you are judged on weekly contribution margin, which is what is left after every rupee this business pays to serve an order and every rupee you spend fixing it.",
  difficulty: "Medium",

  /**
   * Saturating response, so "how much?" has an answer that is not "all of it".
   *
   * See lib/sim/response.ts for the family. What makes the money decision real
   * here is `spend` below rather than the curves alone: saturation stops an
   * extra crore from *helping*, and only a cost that reaches the P&L stops it
   * from being free.
   */
  engine: "v2",

  // ── The model ───────────────────────────────────────────────────────────
  // Orders is deliberately derived rather than an input: it is the product of
  // traffic and conversion, and keeping those two terms visible is most of the
  // lesson. An intervention that lifts sessions while conversion is broken can
  // then be seen doing almost nothing, rather than asserted to.
  /**
   * The quarter is judged on contribution, not on the number in the title.
   *
   * Orders was the north star while money was free inside the model: nothing
   * a candidate could spend touched it, so "fund everything to its ask" was
   * weakly optimal however the response curves were tuned, and the scenario
   * could not ask "how much?" at all.
   *
   * Contribution is the honest fix and it is the same lesson the debrief was
   * already teaching in prose. Deeper discounting genuinely lifts orders and
   * hands back the whole unit margin to do it; the brand campaign buys traffic
   * a broken funnel cannot convert. Under a volume north star both are punished
   * only by a report nobody is scored on. Under this one the model itself says
   * so, and the money committed says so too.
   *
   * The situation names the objective outright. A trap that works by hiding
   * what is being measured is a gotcha, and the mistake worth catching here is
   * an error of analysis — believing volume carries a business whose unit
   * contribution is ₹11.80 against a ₹96 cost — not an error of reading.
   */
  northStar: "contributionMargin",
  reported: ["orders", "conversion", "sessions", "avgEta", "revenue"],
  drivers: [
    {
      id: "sessions",
      kind: "input",
      label: "Weekly app sessions",
      unit: "count",
      goodDirection: "up",
      baseline: 9_600_000,
    },
    {
      id: "conversion",
      kind: "input",
      label: "Session → order conversion",
      unit: "ratio",
      goodDirection: "up",
      baseline: 0.25,
    },
    {
      id: "orders",
      kind: "product",
      label: "Weekly orders",
      unit: "count",
      goodDirection: "up",
      of: ["sessions", "conversion"],
    },
    {
      id: "aov",
      kind: "input",
      label: "Average order value",
      unit: "inr",
      goodDirection: "up",
      baseline: 385,
    },
    {
      id: "takeRate",
      kind: "input",
      label: "Revenue take rate",
      unit: "ratio",
      goodDirection: "up",
      baseline: 0.28,
    },
    {
      id: "revenue",
      kind: "product",
      label: "Weekly net revenue",
      unit: "inr",
      goodDirection: "up",
      of: ["orders", "aov", "takeRate"],
    },
    {
      id: "deliveryCost",
      kind: "input",
      label: "Delivery cost per order",
      unit: "inr",
      goodDirection: "down",
      baseline: 62,
    },
    {
      id: "discount",
      kind: "input",
      label: "Discount per order",
      unit: "inr",
      goodDirection: "down",
      baseline: 34,
    },
    {
      id: "costPerOrder",
      kind: "sum",
      label: "Variable cost per order",
      unit: "inr",
      goodDirection: "down",
      of: ["deliveryCost", "discount"],
    },
    {
      id: "totalCost",
      kind: "product",
      label: "Weekly variable cost",
      unit: "inr",
      goodDirection: "down",
      of: ["orders", "costPerOrder"],
    },
    /**
     * What the fixes cost to run, in the same weekly terms as everything else.
     *
     * Non-zero at baseline because `spend` scales a driver rather than setting
     * it: a programme cost of zero would stay zero however much was committed,
     * and the budget would be free again. ₹15 lakh a week is what the growth
     * programme already costs before this quarter's decision.
     */
    {
      id: "programmeSpend",
      kind: "input",
      label: "Programme cost / week",
      unit: "inr",
      goodDirection: "down",
      baseline: 15_00_000,
    },
    {
      id: "weeklyCost",
      kind: "sum",
      label: "Weekly cost, all in",
      unit: "inr",
      goodDirection: "down",
      of: ["totalCost", "programmeSpend"],
    },
    {
      id: "contributionMargin",
      kind: "difference",
      label: "Weekly contribution margin",
      unit: "inr",
      goodDirection: "up",
      minuend: "revenue",
      subtrahend: "weeklyCost",
    },
    {
      id: "avgEta",
      kind: "input",
      label: "Average delivery ETA",
      unit: "minutes",
      goodDirection: "down",
      baseline: 34,
    },
  ],

  // ── What you get for free ───────────────────────────────────────────────
  // Enough to rule out a traffic problem and to see that margin is falling
  // faster than orders. Not enough to say where.
  dashboard: [
    {
      id: "p-orders-trend",
      kind: "timeseries",
      title: "Weekly orders, last 8 weeks",
      caption: "The drop has not flattened out.",
      series: [
        {
          label: "Orders (lakh)",
          unit: "count",
          points: [
            { period: "W-7", value: 26.5 },
            { period: "W-6", value: 26.4 },
            { period: "W-5", value: 26.1 },
            { period: "W-4", value: 25.6 },
            { period: "W-3", value: 25.1 },
            { period: "W-2", value: 24.7 },
            { period: "W-1", value: 24.3 },
            { period: "W-0", value: 24.0 },
          ],
        },
      ],
    },
    {
      id: "p-headline",
      kind: "stat",
      title: "This week vs six weeks ago",
      tiles: [
        { label: "Weekly orders", value: 24_00_000, unit: "count", deltaPct: -0.091, goodDirection: "up" },
        { label: "App sessions", value: 96_00_000, unit: "count", deltaPct: 0.01, goodDirection: "up" },
        { label: "Session → order", value: 0.25, unit: "ratio", deltaPct: -0.096, goodDirection: "up" },
        { label: "Average order value", value: 385, unit: "inr", deltaPct: 0.021, goodDirection: "up" },
        { label: "Contribution margin / week", value: 2.68 * CRORE, unit: "inr", deltaPct: -0.34, goodDirection: "up" },
      ],
    },
    {
      id: "p-funnel-national",
      kind: "funnel",
      title: "National funnel, this week vs six weeks ago",
      caption: "Where the 9% went.",
      steps: [
        { label: "Sessions", value: 96_00_000, deltaPct: 0.01 },
        { label: "Menu viewed", value: 62_40_000, deltaPct: 0.004 },
        { label: "Cart built", value: 37_44_000, deltaPct: -0.012 },
        { label: "Checkout opened", value: 30_72_000, deltaPct: -0.019 },
        { label: "Order placed", value: 24_00_000, deltaPct: -0.091 },
      ],
    },
    {
      id: "p-brief",
      kind: "note",
      title: "What the room already believes",
      body:
        "Marketing: a competitor has been outspending us on promos since the start of the quarter. " +
        "Engineering: the drop looks like it began within a week of the 8.4 release. " +
        "Ops: last year's festival calendar fell differently, so some of this is seasonal. " +
        "Finance has separately flagged that contribution margin is falling roughly four times faster than orders.",
    },
  ],

  /**
   * Capacity binds; money does not. That inversion is the whole conversion.
   *
   * Four people-weeks is exactly what the three fixes treating rider supply
   * cost together — 2 + 1 + 1 — so the capacity budget is consumed to the last
   * slot and there is no room to bolt a discount push on beside the correct
   * answer. The money budget is the opposite: the ceiling deliberately leaves
   * crores of it in the bank, because response curves make the fourth crore
   * behind the right fix nearly worthless and `spend` charges every committed
   * rupee to contribution every week.
   */
  budget: { analystDays: 10, sprints: 4, rupees: 12 * CRORE },

  // ── The data you can buy ────────────────────────────────────────────────
  // Twenty-eight days of pulls against a ten-day budget. The scarcity is the
  // exercise: you cannot buy your way to the answer, only reason your way there.
  //
  // Thirteen pulls rather than ten, and the three additions each do a job the
  // board was missing — a redundant pair, so buying twice is visible waste; a
  // pull that contradicts a reasonable opening call, so revising is worth
  // something; and a one-day pull that retires a branch outright, so the first
  // move is a decision rather than a coin flip.
  drilldowns: [
    {
      id: "dd-city",
      label: "Orders by city tier",
      question: "Is the drop national, or concentrated somewhere?",
      cost: 2,
      evidenceFor: ["supply.riders"],
      readsAs:
        "A national story that turns out to be regional. Almost every wrong hypothesis in the room assumes the drop is everywhere, and it isn't.",
      reveals: [
        {
          id: "p-city",
          kind: "segments",
          title: "Order change by city tier, six weeks",
          dimension: "City tier",
          rows: [
            { label: "Metro (8 cities)", value: 11_28_000, unit: "count", deltaPct: -0.008 },
            { label: "Tier 2 (46 cities)", value: 8_16_000, unit: "count", deltaPct: -0.243 },
            { label: "Tier 3 (126 cities)", value: 4_56_000, unit: "count", deltaPct: -0.108 },
          ],
        },
      ],
    },
    {
      id: "dd-funnel-tier",
      label: "Funnel by step, split by city tier",
      question: "Which step of the funnel is leaking, and where?",
      cost: 3,
      evidenceFor: ["supply.riders", "product.release"],
      readsAs:
        "The leak is entirely at checkout → order placed, and entirely outside the metros. Whatever is wrong happens at the moment of committing to an order.",
      reveals: [
        {
          id: "p-funnel-tier",
          kind: "segments",
          title: "Checkout → order placed, by tier",
          dimension: "City tier",
          rows: [
            { label: "Metro", value: 0.79, unit: "ratio", deltaPct: -0.005 },
            { label: "Tier 2", value: 0.61, unit: "ratio", deltaPct: -0.221 },
            { label: "Tier 3", value: 0.72, unit: "ratio", deltaPct: -0.094 },
          ],
        },
        {
          id: "p-funnel-note",
          kind: "note",
          title: "Where it isn't",
          body:
            "Sessions, menu views and cart builds are within 1.5% of their six-week baseline in every tier. Customers are arriving and choosing food as usual — they are stopping at the last step.",
        },
      ],
    },
    {
      id: "dd-eta",
      label: "Delivery ETA shown at checkout, by tier",
      question: "What are we promising customers at the moment they abandon?",
      cost: 2,
      dependsOn: ["dd-city"],
      evidenceFor: ["supply.riders"],
      readsAs:
        "Tier-2 ETAs went from 31 to 48 minutes. The abandonment is a rational response to a worse offer, not a broken button.",
      reveals: [
        {
          id: "p-eta",
          kind: "timeseries",
          title: "Median ETA shown at checkout (minutes)",
          series: [
            {
              label: "Metro",
              unit: "minutes",
              points: [
                { period: "W-6", value: 29 },
                { period: "W-4", value: 30 },
                { period: "W-2", value: 30 },
                { period: "W-0", value: 31 },
              ],
            },
            {
              label: "Tier 2",
              unit: "minutes",
              points: [
                { period: "W-6", value: 31 },
                { period: "W-4", value: 36 },
                { period: "W-2", value: 43 },
                { period: "W-0", value: 48 },
              ],
            },
          ],
        },
      ],
    },
    {
      id: "dd-riders",
      label: "Active rider hours by city tier",
      question: "Do we still have the riders we had six weeks ago?",
      cost: 3,
      dependsOn: ["dd-city"],
      evidenceFor: ["supply.riders"],
      readsAs:
        "Tier-2 rider hours are down 22% and the exits cluster in the week a competitor raised payouts. This is the cause; everything else is a symptom of it.",
      reveals: [
        {
          id: "p-riders",
          kind: "segments",
          title: "Weekly active rider hours, six-week change",
          dimension: "City tier",
          rows: [
            { label: "Metro", value: 9_80_000, unit: "count", deltaPct: -0.012 },
            { label: "Tier 2", value: 5_60_000, unit: "count", deltaPct: -0.221 },
            { label: "Tier 3", value: 3_10_000, unit: "count", deltaPct: -0.084 },
          ],
        },
        {
          id: "p-riders-note",
          kind: "note",
          title: "Rider exit interviews, tier-2, last six weeks",
          body:
            "Rider churn in tier-2 rose from 6% to 19% monthly. The single most cited reason in exit surveys is per-trip earnings. " +
            "A competitor raised its tier-2 per-trip payout by roughly ₹18 in the same week our churn stepped up. Our payout has not moved in eleven months.",
        },
      ],
    },
    {
      id: "dd-release",
      label: "Crash rate and latency by app version",
      question: "Did the 8.4 release break something?",
      cost: 2,
      evidenceFor: ["product.release"],
      readsAs:
        "The release is a coincidence of timing. Worth two days to kill the theory the room is most confident about.",
      reveals: [
        {
          id: "p-release",
          kind: "segments",
          title: "8.4 vs 8.3, all tiers",
          dimension: "App version",
          rows: [
            { label: "Crash-free sessions 8.3", value: 0.994, unit: "ratio", deltaPct: 0 },
            { label: "Crash-free sessions 8.4", value: 0.993, unit: "ratio", deltaPct: -0.001 },
            { label: "Checkout p95 latency 8.3 (ms)", value: 840, unit: "count", deltaPct: 0 },
            { label: "Checkout p95 latency 8.4 (ms)", value: 855, unit: "count", deltaPct: 0.018 },
          ],
        },
      ],
    },
    {
      id: "dd-payments",
      label: "Payment success rate by gateway",
      question: "Are orders failing at payment?",
      cost: 2,
      evidenceFor: ["product.payments"],
      readsAs: "Payments are flat. A cheap way to rule out the scariest explanation.",
      reveals: [
        {
          id: "p-payments",
          kind: "segments",
          title: "Payment success, six-week change",
          dimension: "Gateway",
          rows: [
            { label: "UPI", value: 0.971, unit: "ratio", deltaPct: 0.002 },
            { label: "Cards", value: 0.943, unit: "ratio", deltaPct: -0.004 },
            { label: "Wallet", value: 0.982, unit: "ratio", deltaPct: 0.001 },
            { label: "Cash on delivery", value: 1.0, unit: "ratio", deltaPct: 0 },
          ],
        },
      ],
    },
    {
      id: "dd-discount",
      label: "Discount spend and coupon redemption",
      question: "Have we changed what we're giving away?",
      cost: 2,
      evidenceFor: ["demand.price"],
      readsAs:
        "Discount per order is already up 19% — somebody has been quietly buying the metric back for a month. It explains the margin collapse and none of the order drop.",
      reveals: [
        {
          id: "p-discount",
          kind: "timeseries",
          title: "Discount per order (₹)",
          series: [
            {
              label: "Discount per order",
              unit: "inr",
              points: [
                { period: "W-6", value: 28.5 },
                { period: "W-4", value: 30.1 },
                { period: "W-2", value: 32.4 },
                { period: "W-0", value: 34.0 },
              ],
            },
          ],
        },
        {
          id: "p-discount-note",
          kind: "note",
          title: "Redemption",
          body:
            "Coupon redemption rate is flat at 41%, and the mix of coupons issued has not changed. We are spending more per order to hold a number that is falling anyway.",
        },
      ],
    },
    {
      id: "dd-restaurants",
      label: "Active restaurant supply by tier",
      question: "Have restaurants left the platform?",
      cost: 2,
      evidenceFor: ["supply.restaurants"],
      readsAs: "Restaurant supply is up slightly everywhere. Not this.",
      reveals: [
        {
          id: "p-restaurants",
          kind: "segments",
          title: "Active restaurants, six-week change",
          dimension: "City tier",
          rows: [
            { label: "Metro", value: 48_200, unit: "count", deltaPct: 0.019 },
            { label: "Tier 2", value: 61_400, unit: "count", deltaPct: 0.012 },
            { label: "Tier 3", value: 39_900, unit: "count", deltaPct: 0.026 },
          ],
        },
      ],
    },
    {
      id: "dd-competitor",
      label: "Competitor pricing and promo tracker",
      question: "Is a competitor taking our orders?",
      cost: 3,
      evidenceFor: ["external.competitor"],
      readsAs:
        "Competitor promo intensity is up, but evenly across tiers — so it cannot explain a drop that is four times worse in tier-2 than in the metros. The expensive way to learn that a national explanation can't produce a regional pattern.",
      reveals: [
        {
          id: "p-competitor",
          kind: "segments",
          title: "Competitor promo intensity, six-week change",
          dimension: "City tier",
          rows: [
            { label: "Metro", value: 1.14, unit: "ratio", deltaPct: 0.14 },
            { label: "Tier 2", value: 1.16, unit: "ratio", deltaPct: 0.16 },
            { label: "Tier 3", value: 1.12, unit: "ratio", deltaPct: 0.12 },
          ],
        },
      ],
    },
    /**
     * The redundant pair, and the reason the board is worth triaging.
     *
     * This and `dd-riders` both reach the answer, from opposite ends: one shows
     * the hours are gone, the other shows the hours that remain are being used
     * exactly as well as before. Three days each, six of ten if you buy both —
     * and the second one tells you nothing the first did not. A candidate who
     * buys both has paid full price for a confirmation, which is the most
     * common way an investigation budget actually gets wasted.
     */
    {
      id: "dd-dispatch",
      label: "Dispatch efficiency in tier-2",
      question: "Are the riders we still have being assigned badly?",
      cost: 3,
      dependsOn: ["dd-riders"],
      evidenceFor: ["supply.dispatch", "supply.riders"],
      readsAs:
        "Every efficiency measure is where it was and the hours are not. This is how you tell a routing problem from a supply problem, and it says supply — the same answer the rider-hours pull gives for the same money.",
      reveals: [
        {
          id: "p-dispatch",
          kind: "segments",
          title: "Tier-2 dispatch, this week vs six weeks ago",
          dimension: "Measure",
          rows: [
            { label: "Orders per rider-hour", value: 2.14, unit: "count", deltaPct: -0.009 },
            { label: "Average batch size", value: 1.8, unit: "count", deltaPct: 0.011 },
            { label: "Seconds to assign a rider", value: 41, unit: "count", deltaPct: 0.02 },
            { label: "Rider hours offered", value: 9_84_000, unit: "count", deltaPct: -0.221 },
          ],
        },
      ],
    },
    /**
     * The pull that can contradict a reasonable opening call.
     *
     * "Customers are ordering less" is the second-most-common hypothesis this
     * scenario draws, and it is not silly — orders are down and sessions are
     * flat, which is consistent with a retention story. This is what a
     * candidate holding that belief should buy, and it says the opposite:
     * frequency is flat and the loss is at checkout. Revising after it is
     * exactly the behaviour the format rewards.
     */
    {
      id: "dd-frequency",
      label: "Order frequency and checkout completion by cohort",
      question: "Are existing customers ordering less often, or failing to finish?",
      cost: 2,
      evidenceFor: ["demand.churn", "supply.riders"],
      readsAs:
        "Frequency held and completion collapsed, and only in tier-2. Customers did not lose the habit — they got to the last screen and left. That moves the search from the demand side to the funnel in a single pull.",
      reveals: [
        {
          id: "p-frequency",
          kind: "segments",
          title: "Monthly orders per active customer, and checkout completion",
          dimension: "Cohort",
          rows: [
            { label: "Orders / customer — metro", value: 3.5, unit: "count", deltaPct: -0.006 },
            { label: "Orders / customer — tier 2", value: 3.4, unit: "count", deltaPct: -0.012 },
            { label: "Checkout completed — metro", value: 0.79, unit: "ratio", deltaPct: -0.011 },
            { label: "Checkout completed — tier 2", value: 0.61, unit: "ratio", deltaPct: -0.212 },
          ],
        },
      ],
    },
    /**
     * One day to retire a whole branch, like `dd-seasonality` below.
     *
     * A board with nothing cheap on it has no triage in it: every pull costs
     * two or three days, so the first purchase is a coin flip. A one-day pull
     * that eliminates a plausible theory outright is what makes the opening
     * move a decision rather than a guess.
     */
    {
      id: "dd-fees",
      label: "Fee and surge screen, before and after 8.4",
      question: "Did a fee or surge change land with the release?",
      cost: 1,
      evidenceFor: ["product.fees"],
      readsAs:
        "Nothing changed and the fee went down. A fee change shipping with a release is a real cause of a drop shaped like this one, so it is worth a day to rule out — and a day is what it costs.",
      reveals: [
        {
          id: "p-fees",
          kind: "stat",
          title: "Checkout charges, this week vs six weeks ago",
          tiles: [
            { label: "Delivery fee / order", value: 27, unit: "inr", deltaPct: -0.036, goodDirection: "down" },
            { label: "Orders with surge shown", value: 0.09, unit: "ratio", deltaPct: -0.01, goodDirection: "down" },
            { label: "Small-order fee / order", value: 12, unit: "inr", deltaPct: 0, goodDirection: "down" },
          ],
        },
      ],
    },
    {
      id: "dd-seasonality",
      label: "Same six weeks, last year",
      question: "Is this just the festival calendar?",
      cost: 1,
      evidenceFor: ["external.seasonality"],
      readsAs:
        "Last year the same weeks were flat. One analyst-day to retire an explanation that would otherwise have absorbed the whole quarter.",
      reveals: [
        {
          id: "p-seasonality",
          kind: "timeseries",
          title: "Orders, same weeks last year (lakh)",
          series: [
            {
              label: "Last year",
              unit: "count",
              points: [
                { period: "W-6", value: 21.9 },
                { period: "W-4", value: 22.1 },
                { period: "W-2", value: 21.8 },
                { period: "W-0", value: 22.0 },
              ],
            },
          ],
        },
      ],
    },
  ],

  // ── The hypothesis space ────────────────────────────────────────────────
  causes: [
    { id: "demand", parentId: null, label: "Demand side", verdict: "Traffic never moved. Sessions are flat within 1%." },
    {
      id: "demand.interest",
      parentId: "demand",
      label: "Customer interest / traffic",
      verdict: "Sessions, menu views and carts are all flat. Customers kept arriving throughout.",
    },
    {
      id: "demand.churn",
      parentId: "demand",
      label: "Customers ordering less often",
      verdict:
        "Order frequency among customers who kept ordering is flat at 3.4 a month. Nobody lost the habit — they reached checkout, saw a 48-minute estimate, and stopped there. That is a conversion event wearing a retention costume.",
      unactionable: {
        why: "Win-back campaigns and loyalty spend both assume customers stopped wanting to order. They did not — frequency held, and the loss is at the last screen. There is no retention fix on this board because retention is not what moved.",
      },
    },
    {
      id: "demand.price",
      parentId: "demand",
      label: "Price sensitivity or discount pullback",
      verdict:
        "The opposite of the theory: discount per order rose 19% over the same period. Price was being pushed harder, not pulled back — which is why margin fell four times faster than orders.",
    },
    { id: "supply", parentId: null, label: "Supply side", verdict: "The right region to look in." },
    {
      id: "supply.riders",
      parentId: "supply",
      label: "Rider availability",
      verdict:
        "This was it. A competitor's tier-2 payout hike pulled 22% of rider hours out of exactly the cities where orders fell, ETAs stretched from 31 to 48 minutes, and customers abandoned at checkout rather than accept the worse offer.",
    },
    {
      id: "supply.restaurants",
      parentId: "supply",
      label: "Restaurant availability",
      verdict: "Restaurant supply grew in every tier over the period.",
    },
    {
      id: "supply.dispatch",
      parentId: "supply",
      label: "Dispatch and batching logic",
      verdict:
        "The sharpest near-miss on the board, and the one worth getting wrong. Right branch, right cities, wrong mechanism: batch size, assignment time and orders per rider-hour are all within a percent of where they were. The riders who are still working are being used exactly as well as before — there are 22% fewer of them.",
      unactionable: {
        why: "There is nothing to re-tune. Every dispatch measure is where it was six weeks ago, so a routing project would spend the quarter making an unbroken system marginally different. The constraint is how many riders are on the road, not how they are assigned.",
      },
    },
    { id: "product", parentId: null, label: "App / product", verdict: "Nothing broke." },
    {
      id: "product.release",
      parentId: "product",
      label: "The 8.4 release",
      verdict:
        "A coincidence of timing, and the most confidently held theory in the room. Crash-free sessions and checkout latency are unchanged, and the drop is regional while the release was not.",
    },
    {
      id: "product.payments",
      parentId: "product",
      label: "Payment failures",
      verdict: "Success rates are flat or up on every gateway.",
    },
    {
      id: "product.fees",
      parentId: "product",
      label: "Fees or surge shown at checkout",
      verdict:
        "Delivery fee per order fell slightly over the period and the surge screen has not changed since February. Cheap to check, and worth checking — a fee change landing with a release is a genuinely common cause of exactly this shape.",
      unactionable: {
        why: "You cannot roll back a change that was never made. Fees went down over the period, not up, so there is nothing here to reverse.",
      },
    },
    { id: "external", parentId: null, label: "External", verdict: "Real, but not load-bearing." },
    {
      id: "external.seasonality",
      parentId: "external",
      label: "Festival seasonality",
      verdict: "The same six weeks last year were flat.",
      unactionable: {
        why: "Nobody funds a fix for the calendar. If the festival window really were the cause, the quarter would be something to ride out rather than something to spend on.",
      },
    },
    {
      id: "external.competitor",
      parentId: "external",
      label: "Competitor promotions",
      verdict:
        "Competitor promo intensity did rise — evenly across tiers. A national cause cannot produce a drop four times worse in tier-2 than in the metros. It is, however, the reason the riders left.",
      unactionable: {
        why: "You cannot buy a competitor's promotions back down, and matching them is a different diagnosis — it says demand is price-sensitive, not that a rival exists.",
      },
    },
  ],
  trueCauseIds: ["supply.riders"],

  // ── What you can spend the quarter on ───────────────────────────────────
  interventions: [
    {
      id: "iv-payout",
      label: "Tier-2 rider payout correction",
      pitch:
        "Raise per-trip payouts in the 46 tier-2 cities to beat the competitor's new rate, with a surge multiplier at dinner peak. Ops say riders come back within three weeks.",
      addresses: "supply.riders",
      cost: { sprints: 2, rupees: 9 * CRORE },
      minSprints: 2,
      effects: {
        // The payout rise is not a permanent per-order cost here — it is what
        // the ₹12 crore is *for*, and `spend` above already charges it to the
        // P&L. Modelling it in both places would bill the same rupee twice, and
        // on a business whose unit contribution is ₹11.80 against a ₹96 cost
        // that double-charge is enough to make the correct answer lose.
        // ETA moves as fast as the riders do; conversion does not. Ops are
        // right that the payout brings riders back inside three weeks, and the
        // delivery estimate at checkout improves with them — but ordering
        // dinner is a habit, and the customers who were quoted 48 minutes twice
        // in a row take the better part of a year to fully come back. So the
        // recovery in conversion ramps where the recovery in ETA does not.
        //
        // **Three quarters, and the number is load-bearing.** An effect is
        // fully arrived `rampQuarters` after the period that funds it, and
        // `finalValue` reads the last quarter — so on a four-quarter horizon a
        // two-quarter ramp committed in the final period has still fully landed
        // by the end, and committing late costs nothing but Adaptation. At
        // three it does not, which is what makes *when* you commit move the
        // contribution line. See the paired tests in `tests/sim-schedule.test.ts`.
        whenRootCause: [
          { driver: "conversion", deltaPct: 0.09, rampQuarters: 3 },
          { driver: "avgEta", deltaPct: -0.22 },
        ],
        otherwise: [{ driver: "conversion", deltaPct: 0.01 }],
      },
      debrief:
        "The bet that addressed the cause, and the reason it pays is that it recovers orders that were being lost at checkout rather than buying new ones. It is not fast: riders come back inside three weeks, but the customers who were quoted 48 minutes take a couple of quarters to start checking again — so committing it early is worth real money, not just a better Adaptation score.",
    },
    {
      id: "iv-referral",
      label: "Rider referral drive in tier-2",
      pitch:
        "Pay existing riders a bounty for every rider they bring onto the platform in the affected cities. Slower than a payout change, and cheaper.",
      addresses: "supply.riders",
      cost: { sprints: 1, rupees: 2.5 * CRORE },
      effects: {
        whenRootCause: [
          { driver: "conversion", deltaPct: 0.045, rampQuarters: 2 },
          { driver: "avgEta", deltaPct: -0.1, rampQuarters: 2 },
        ],
        otherwise: [{ driver: "conversion", deltaPct: 0.005 }],
      },
      debrief:
        "Right target, slow to land — it takes two quarters to reach full effect. A sensible companion to the payout correction and a poor substitute for it.",
    },
    {
      id: "iv-eta-honesty",
      label: "Honest ETAs at checkout",
      pitch:
        "Stop showing an optimistic ETA and show the real one, with a wider range. Cheap, one sprint, no ops change.",
      addresses: "supply.riders",
      cost: { sprints: 1, rupees: 0.5 * CRORE },
      effects: {
        whenRootCause: [{ driver: "conversion", deltaPct: 0.025 }],
        otherwise: [{ driver: "conversion", deltaPct: 0.015 }],
      },
      debrief:
        "A band-aid on the right wound. It recovers some of the abandonment by not surprising people, without putting a single rider back on the road — worth funding alongside a real fix, never instead of one.",
    },
    {
      id: "iv-discount",
      label: "Deepen national discounts",
      pitch:
        "Raise the discount per order across all tiers to win back price-sensitive customers from the competitor. Marketing's preferred option, and the fastest to show up in the orders number.",
      addresses: "demand.price",
      cost: { sprints: 1, rupees: 5 * CRORE },
      effects: {
        whenRootCause: [
          { driver: "conversion", deltaPct: 0.09 },
          { driver: "discount", deltaPct: 0.3 },
        ],
        // This is the trap, and it is deliberately effective on the north star.
        otherwise: [
          { driver: "conversion", deltaPct: 0.05 },
          { driver: "discount", deltaPct: 0.28 },
        ],
      },
      debrief:
        "It works on the metric you were asked about and hands back the contribution margin to do it. Discount per order was already up 19% before you arrived — this is the same move that produced the margin collapse in the opening dashboard, made larger.",
    },
    {
      id: "iv-brand",
      label: "National brand campaign",
      pitch:
        "A six-week brand push across streaming and outdoor to rebuild top-of-mind against the competitor's spending.",
      addresses: "demand.interest",
      cost: { sprints: 1, rupees: 4.5 * CRORE },
      /**
       * The one lever that genuinely delivers what it promises.
       *
       * The off-target default saturates early and low, on the reasoning that
       * money aimed at the wrong problem stops working almost immediately.
       * That reasoning is wrong for media: reach is exactly as buyable as the
       * plan says, and a campaign that quietly failed to buy traffic would
       * teach a candidate that the campaign was badly run.
       *
       * The lesson here is the opposite and it is sharper. You buy precisely
       * the traffic you paid for, and orders barely move, because orders are
       * sessions times conversion and conversion is what broke. Blunting the
       * lever would let a candidate walk away believing the media plan was the
       * problem.
       */
      saturation: { otherwise: { kind: "hill", ceiling: 1.0, halfAt: 0.2 } },
      effects: {
        whenRootCause: [{ driver: "sessions", deltaPct: 0.12 }],
        // The clearest lesson in the scenario: traffic up, orders barely move,
        // because the funnel it arrives into is the thing that is broken.
        otherwise: [
          { driver: "sessions", deltaPct: 0.05 },
          { driver: "conversion", deltaPct: -0.03 },
        ],
      },
      debrief:
        "Sessions rise about 5% and orders barely move, because orders are sessions times conversion and conversion is what broke. The incremental traffic is also lower-intent, so it dilutes conversion slightly further. This is what buying more of a working thing looks like when a different thing is broken.",
    },
    {
      id: "iv-checkout-rewrite",
      label: "Rewrite the checkout flow",
      pitch:
        "Engineering's proposal: rebuild checkout on the new stack, fixing the latency regression in 8.4 along the way. Three sprints, and it must ship whole.",
      addresses: "product.release",
      cost: { sprints: 3, rupees: 2 * CRORE },
      minSprints: 3,
      effects: {
        whenRootCause: [{ driver: "conversion", deltaPct: 0.06 }],
        otherwise: [{ driver: "conversion", deltaPct: 0.01 }],
      },
      debrief:
        "Three of your four sprints for a 1% conversion gain, against a release that the data cleared. The expensive kind of wrong: it is not a bad piece of work, it is a good piece of work aimed at a problem you did not have.",
    },
    {
      id: "iv-restaurants",
      label: "Onboard 4,000 tier-2 restaurants",
      pitch:
        "Widen selection in the worst-hit cities so customers have more reason to order.",
      addresses: "supply.restaurants",
      cost: { sprints: 1, rupees: 3 * CRORE },
      effects: {
        whenRootCause: [{ driver: "conversion", deltaPct: 0.05 }],
        otherwise: [
          { driver: "sessions", deltaPct: 0.02 },
          { driver: "conversion", deltaPct: 0.005 },
        ],
      },
      debrief:
        "Aimed at the right cities and the wrong constraint. Restaurant supply grew over the period — customers in tier-2 were not short of places to order from, they were short of anyone to bring the food.",
    },
  ],

  // Untreated, riders keep leaving: conversion keeps sliding and ETAs keep
  // stretching, compounding each quarter. Doing nothing is a decision with a
  // cost, and the outcome report shows it as one.
  /**
   * Committing the whole ₹12 crore raises what the programme costs to run by
   * 160%, from ₹15 lakh a week to ₹39 lakh.
   *
   * Scaled against weekly contribution — ₹2.68 crore — rather than against the
   * budget's face value, because the budget is a one-off quarter's investment
   * and the north star is a weekly figure. Charging ₹12 crore a week against a
   * ₹2.68 crore margin would make doing nothing the answer to everything, which
   * is a different broken scenario from the one being fixed.
   */
  spend: { driver: "programmeSpend", atFullBudget: 1.6 },

  /**
   * The quarter not going exactly to plan.
   *
   * Conversion moves week to week on 96 lakh sessions and is the tightest of
   * the three; sessions swing wider, because a promo calendar and a weather
   * week move traffic more than they move intent; order value is steadier than
   * either. None is drawn wide enough to drown a decision — a student watching
   * a quarter come in has to be able to read their own fix out of it.
   *
   * Effects are never noised, only the weather. The payout correction works,
   * and the debrief's account of why the number moved stays true.
   */
  noise: {
    drivers: [
      { driver: "conversion", sigma: 0.02 },
      { driver: "sessions", sigma: 0.035 },
      { driver: "aov", sigma: 0.015 },
    ],
    driftSigma: 0.25,
  },

  drift: [
    { driver: "conversion", deltaPct: -0.04 },
    { driver: "avgEta", deltaPct: 0.05 },
  ],
  /**
   * Four quarters for a decision taken once.
   *
   * Longer than the two it used to be, because the payout correction's effect
   * on conversion ramps over three quarters and a two-quarter horizon would
   * score it before it had finished arriving. Everything is committed at the
   * start, so the ramp delays the player's payoff and the `best` ceiling by
   * exactly the same amount and cannot distort the score — what it does is give
   * the drift four quarters to show that doing nothing is expensive.
   */
  horizonQuarters: 4,

  parInvestigation: ["dd-city", "dd-eta"],
  /**
   * Derived by `scripts/best-allocation.ts` over 12,517 allocations, not guessed
   * — and it banks ₹5.75 crore of ₹12.
   *
   * That is the point of the v2 conversion and it is not something anyone would
   * write by hand. Every people-week goes to a fix that treats rider supply, and
   * the two expensive ones are funded at 42% and 70% of what they asked for:
   * past roughly there the payout correction is buying rider hours the cities do
   * not need, while the programme cost of the money keeps coming off
   * contribution every week. The one lever funded *above* its ask is the
   * cheapest on the board — honest ETAs cost ₹50 lakh and absorb a little more
   * usefully than that.
   *
   * The old `bestAllocation` spent all ₹12 crore, because under a linear model
   * with free money that was always weakly optimal. Re-derive with the script
   * after any retune; do not adjust these numbers by hand.
   */
  bestAllocation: [
    { interventionId: "iv-payout", sprints: 2, rupees: 3.75 * CRORE },
    { interventionId: "iv-referral", sprints: 1, rupees: 1.75 * CRORE },
    { interventionId: "iv-eta-honesty", sprints: 1, rupees: 0.75 * CRORE },
  ],

  debrief: {
    causalChain: [
      "A competitor raised per-trip rider payouts in tier-2 cities by about ₹18.",
      "NukkadEats riders followed the money: tier-2 rider hours fell 22% and monthly rider churn went from 6% to 19%.",
      "With fewer riders, median tier-2 delivery ETAs stretched from 31 minutes to 48.",
      "Customers reaching checkout saw a 48-minute ETA and abandoned — checkout-to-order conversion in tier-2 fell 22%.",
      "Orders fell 9% nationally, almost all of it from tier-2 and tier-3, while sessions never moved.",
      "Discount spend was quietly raised to defend the number, which is why contribution margin fell four times faster than orders did.",
    ],
    whereTheLeverageWas:
      "Rider supply in 46 tier-2 cities. Everything else in the dashboard — the funnel, the ETAs, the margin — is downstream of it, so a fix anywhere else buys a symptom back at full price.",
    strongAnswer:
      "Start by splitting orders into sessions and conversion. Sessions are flat, so this is not a demand problem and every national explanation — competitor spend, brand, seasonality — is already weak, because a national cause cannot produce a drop four times worse in tier-2 than in the metros. That leaves conversion, and the funnel localises it to checkout. The question then becomes: what changed about the offer at the moment of committing? ETA is the obvious candidate, and ETA is set by rider supply. From there, one pull confirms it. The trap is that discounting genuinely raises orders — so if you are measured on orders alone you can hit your number and hand back the entire contribution margin doing it, which is exactly what the previous six weeks of quiet discount increases had already started.",
  },

  coachFallback: [
    {
      topic: ["rider", "supply", "payout", "churn"],
      answer:
        "Rider supply was the constraint. A competitor's tier-2 payout hike pulled 22% of rider hours out of the affected cities, and monthly rider churn went from 6% to 19%. Everything else you saw was downstream of that.",
    },
    {
      topic: ["eta", "delivery time", "late"],
      answer:
        "Median tier-2 ETAs went from 31 to 48 minutes. That is the mechanism: customers reached checkout, saw a much worse offer than they were used to, and left.",
    },
    {
      topic: ["discount", "margin", "profit", "contribution"],
      answer:
        "Discount per order was already up 19% before you arrived, which is why contribution margin fell about four times faster than orders. Deepening discounts further does raise orders — it just pays for them out of the margin, so you hit the number and lose the business case.",
    },
    {
      topic: ["brand", "campaign", "marketing", "sessions", "traffic"],
      answer:
        "Orders are sessions times conversion. Sessions never fell, so buying more traffic adds volume to the top of a funnel that is breaking at the bottom — about 5% more sessions for almost no additional orders, and slightly worse conversion because the incremental traffic is lower-intent.",
    },
    {
      topic: ["release", "8.4", "engineering", "crash", "latency"],
      answer:
        "The 8.4 release was a coincidence of timing. Crash-free sessions and checkout latency were effectively unchanged, and the release went out nationally while the drop was regional.",
    },
    {
      topic: ["competitor", "promo", "external"],
      answer:
        "Competitor promo intensity did rise, but evenly across tiers, so it cannot explain a drop four times worse in tier-2. It is the reason the riders left, not the reason the customers did.",
    },
    {
      topic: ["seasonality", "festival", "calendar"],
      answer: "The same six weeks last year were flat, so seasonality does not explain this.",
    },
    {
      topic: ["restaurant", "selection", "supply of restaurants"],
      answer:
        "Restaurant supply grew in every tier over the period. Customers were not short of places to order from.",
    },
  ],
};
