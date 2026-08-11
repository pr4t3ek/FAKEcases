/**
 * A small, complete scenario for the engine tests.
 *
 * Deliberately not the shipped scenario: these tests pin the *rules*, and
 * binding them to authored content would mean every content tweak broke the
 * engine suite. `tests/sim-scenario.test.ts` is where the real scenario is
 * checked.
 *
 * Small but not degenerate — it has a derived-driver chain, a two-level cause
 * tree, a locked drilldown, an on-target and an off-target intervention, and one
 * that can stall. Vitest only collects `*.test.ts`, so this file is a helper.
 */

import type { SimScenario } from "@/lib/sim/types";

export const CAUSE_TRUE = "supply.riders";
export const CAUSE_WRONG_LEAF = "demand.price";
export const CAUSE_ANCESTOR = "supply";

export function fixtureScenario(overrides: Partial<SimScenario> = {}): SimScenario {
  const base: SimScenario = {
    slug: "fixture",
    title: "Fixture scenario",
    company: "Fixture Co",
    premise: "Orders are falling.",
    situation: "Weekly orders are down and nobody knows why.",
    difficulty: "Medium",

    northStar: "orders",
    reported: ["revenue", "margin"],
    drivers: [
      { id: "orders", kind: "input", label: "Orders", unit: "count", goodDirection: "up", baseline: 1000 },
      { id: "aov", kind: "input", label: "AOV", unit: "inr", goodDirection: "up", baseline: 500 },
      { id: "cpo", kind: "input", label: "Cost per order", unit: "inr", goodDirection: "down", baseline: 300 },
      { id: "revenue", kind: "product", label: "Revenue", unit: "inr", goodDirection: "up", of: ["orders", "aov"] },
      { id: "totalCost", kind: "product", label: "Total cost", unit: "inr", goodDirection: "down", of: ["orders", "cpo"] },
      {
        id: "margin",
        kind: "difference",
        label: "Contribution margin",
        unit: "inr",
        goodDirection: "up",
        minuend: "revenue",
        subtrahend: "totalCost",
      },
    ],

    dashboard: [
      {
        id: "p-orders",
        kind: "timeseries",
        title: "Weekly orders",
        series: [
          { label: "Orders", unit: "count", points: [{ period: "W-3", value: 1100 }, { period: "W-0", value: 1000 }] },
        ],
      },
    ],

    budget: { analystDays: 5, sprints: 3, rupees: 700 },

    drilldowns: [
      {
        id: "d-city",
        label: "Orders by city tier",
        question: "Is the drop concentrated anywhere?",
        cost: 2,
        reveals: [{ id: "p-city", kind: "note", title: "By city", body: "Tier-2 is down 30%." }],
        evidenceFor: [CAUSE_TRUE],
        readsAs: "The drop is regional, not national.",
      },
      {
        id: "d-funnel",
        label: "Checkout funnel",
        question: "Where in the funnel are we losing them?",
        cost: 2,
        reveals: [{ id: "p-funnel", kind: "note", title: "Funnel", body: "Checkout is flat." }],
        evidenceFor: [CAUSE_WRONG_LEAF],
        readsAs: "Pricing is not the leak.",
      },
      {
        id: "d-riders",
        label: "Rider supply by city",
        question: "Do we have enough riders in the affected cities?",
        cost: 3,
        dependsOn: ["d-city"],
        reveals: [{ id: "p-riders", kind: "note", title: "Riders", body: "Tier-2 riders down 22%." }],
        evidenceFor: [CAUSE_TRUE],
        readsAs: "Supply collapsed exactly where orders did.",
      },
      {
        id: "d-noise",
        label: "Brand tracker",
        question: "Has brand consideration moved?",
        cost: 4,
        reveals: [{ id: "p-noise", kind: "note", title: "Brand", body: "Unchanged." }],
        evidenceFor: [],
        readsAs: "Nothing here.",
      },
    ],

    causes: [
      { id: "supply", parentId: null, label: "Supply", verdict: "The region to look in." },
      { id: CAUSE_TRUE, parentId: "supply", label: "Rider supply", verdict: "This was it." },
      { id: "demand", parentId: null, label: "Demand", verdict: "Held up." },
      { id: CAUSE_WRONG_LEAF, parentId: "demand", label: "Price", verdict: "Unchanged." },
    ],
    trueCauseIds: [CAUSE_TRUE],

    interventions: [
      {
        id: "iv-payout",
        label: "Restore rider payouts",
        pitch: "Pay riders enough to come back.",
        addresses: CAUSE_TRUE,
        cost: { sprints: 2, rupees: 400 },
        minSprints: 2,
        effects: {
          whenRootCause: [{ driver: "orders", deltaPct: 0.2 }],
          otherwise: [{ driver: "orders", deltaPct: 0.02 }],
        },
        debrief: "The bet that actually addressed the cause.",
      },
      {
        id: "iv-discount",
        label: "Deeper national discounts",
        pitch: "Buy the orders back.",
        addresses: CAUSE_WRONG_LEAF,
        cost: { sprints: 1, rupees: 300 },
        effects: {
          whenRootCause: [{ driver: "orders", deltaPct: 0.15 }],
          // Lifts volume and wrecks unit economics whether or not price was the problem.
          otherwise: [
            { driver: "orders", deltaPct: 0.08 },
            { driver: "cpo", deltaPct: 0.1 },
          ],
        },
        debrief: "Buys the metric and pays for it in margin.",
      },
      {
        id: "iv-rebuild",
        label: "Rebuild dispatch",
        pitch: "Fix routing properly.",
        addresses: CAUSE_TRUE,
        cost: { sprints: 3, rupees: 200 },
        minSprints: 3,
        effects: {
          whenRootCause: [{ driver: "orders", deltaPct: 0.25, rampQuarters: 2 }],
          otherwise: [{ driver: "orders", deltaPct: 0.01 }],
        },
        debrief: "Right target, but it needs the whole team or it ships nothing.",
      },
    ],

    drift: [{ driver: "orders", deltaPct: -0.05 }],
    horizonQuarters: 2,

    parInvestigation: ["d-city"],
    bestAllocation: [{ interventionId: "iv-payout", sprints: 2, rupees: 400 }],

    debrief: {
      causalChain: ["Payouts were cut", "Riders left tier-2", "Orders fell"],
      whereTheLeverageWas: "Rider supply in tier-2.",
      strongAnswer: "Localise the drop, then check supply before demand.",
    },
    coachFallback: [{ topic: ["rider", "supply"], answer: "Rider supply was the constraint." }],
  };

  return { ...base, ...overrides };
}

/** The allocation that fully funds the on-target intervention. */
export const BEST_ALLOCATION = [{ interventionId: "iv-payout", sprints: 2, rupees: 400 }];

/**
 * The same scenario on the v2 engine.
 *
 * Kept as a separate builder rather than a flag on `fixtureScenario`, because
 * the v1 fixture is the control in every reduction test in the suite and it
 * must stay unreachable from the v2 path.
 *
 * The curves are the engine defaults, stated explicitly so a test reading this
 * file can see what it is asserting against rather than having to go and look
 * them up in config — and so a later retune of the defaults fails the tests
 * that care about specific numbers instead of silently changing what they mean.
 */
export function v2FixtureScenario(overrides: Partial<SimScenario> = {}): SimScenario {
  const base = fixtureScenario();
  return {
    ...base,
    engine: "v2",
    interventions: base.interventions.map((iv) => ({
      ...iv,
      saturation: {
        whenRootCause: { kind: "hill", ceiling: 1.3, halfAt: 0.45 },
        otherwise: { kind: "exponential", ceiling: 0.35, halfAt: 0.2 },
      },
    })),
    ...overrides,
  };
}

/**
 * A v2 scenario where over-spending genuinely hurts.
 *
 * Worth understanding before using it, because it encodes the sharpest lesson
 * of the v2 engine: **saturating the benefit is not enough.** A flat response
 * curve makes extra money pointless, not harmful, so on a scenario with one
 * lever and no cost side "spend it all" remains weakly optimal — never better,
 * but never worse either, and a student who empties the budget still lands on
 * the ceiling.
 *
 * An interior optimum needs the money to be *paid for*. Here the payout fix
 * lifts orders on a saturating curve and raises cost per order on a
 * `proportional` one, so the benefit flattens while the bill keeps climbing.
 * Margin therefore peaks part-way up the budget and falls after it, and the
 * correct play is to fund the fix and bank the rest.
 *
 * This is the shape every re-authored pilot scenario needs, which is why it is
 * a fixture rather than an argument in a comment.
 */
export function v2CostedFixtureScenario(overrides: Partial<SimScenario> = {}): SimScenario {
  const base = v2FixtureScenario();
  return {
    ...base,
    northStar: "margin",
    reported: ["orders", "revenue"],
    // Spending the whole budget puts 18% on cost per order. Every lever is
    // paid for, not just the ones an author remembered to charge for — which
    // is the failure this scenario-level field exists to prevent.
    spend: { driver: "cpo", atFullBudget: 0.18 },
    ...overrides,
  };
}

/**
 * The v2 fixture with every curve linear — algebraically the v1 model.
 *
 * This is the control that proves the v2 code path is a superset rather than a
 * rewrite: it must project identically to `fixtureScenario()`.
 */
export function v2LinearFixtureScenario(overrides: Partial<SimScenario> = {}): SimScenario {
  const base = fixtureScenario();
  return {
    ...base,
    engine: "v2",
    interventions: base.interventions.map((iv) => ({
      ...iv,
      saturation: { whenRootCause: { kind: "linear" }, otherwise: { kind: "linear" } },
    })),
    ...overrides,
  };
}
