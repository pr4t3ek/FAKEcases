/**
 * Content and run types for decision simulations.
 *
 * A simulation is a metric war room: a dashboard shows something that moved, the
 * candidate commits to a hypothesis, spends a budget of analyst-days pulling
 * data, names a cause, and allocates engineering capacity across candidate
 * fixes. The next quarters are then projected forward and reported as moved
 * metrics rather than as a mark.
 *
 * Scenario content is authored in TypeScript under `./scenarios` rather than in
 * the database, because nothing queries into it and the causal model needs
 * compile-time id checking that a JSON text column cannot give. See
 * `./validate.ts` for the invariants TypeScript can't express.
 *
 * This module imports nothing from `lib/db` and holds no runtime logic, so
 * tests and the pure engine can take it without touching Prisma.
 */

import type { Difficulty, SimPhase } from "@/lib/types";
import type { MetricMapNode } from "./metric-map";
import type { HypothesisLog } from "./hypothesis-log";

export type DriverId = string;
export type CauseId = string;
export type DrilldownId = string;
export type InterventionId = string;
export type PanelId = string;

/** How a figure is rendered. Formatting lives at the UI edge, not in the model. */
export const SIM_UNITS = [
  "count",
  "inr",
  "inr_lakh",
  "inr_crore",
  "percent",
  /** A share, rendered as a percentage — conversion, churn, margin. */
  "ratio",
  /**
   * A multiple, rendered as "4.0×" — ROAS, LTV:CAC.
   *
   * Distinct from `ratio` because rendering a ROAS of 4 as "399%" is not a
   * formatting quibble: nobody in marketing says it that way, and a student
   * comparing it against the "break even above 4.55" rule has to do a
   * conversion in their head to see they are below it.
   */
  "multiple",
  "minutes",
  "days",
] as const;
export type SimUnit = (typeof SIM_UNITS)[number];

/** Which way is good. Drives the colour of a delta without a second field. */
export type GoodDirection = "up" | "down";

// ─── Drivers: the quantities the causal model moves ────────────────────────

interface SimDriverBase {
  id: DriverId;
  label: string;
  unit: SimUnit;
  goodDirection: GoodDirection;
}

/**
 * A small DAG of quantities.
 *
 * Only `input` drivers carry a baseline and only they can be moved by an
 * intervention; every other kind falls out of its parents. That is the whole
 * point of the shape: "cost per order fell 12%, so contribution margin rose
 * 18%" becomes a derivation rather than a second authored number that can
 * quietly disagree with the first. `validateScenario` rejects an effect aimed at
 * a derived driver, which would otherwise silently do nothing.
 */
export type SimDriver =
  | (SimDriverBase & { kind: "input"; baseline: number })
  | (SimDriverBase & { kind: "product"; of: DriverId[] })
  | (SimDriverBase & { kind: "sum"; of: DriverId[] })
  | (SimDriverBase & { kind: "difference"; minuend: DriverId; subtrahend: DriverId })
  /**
   * Division. Most of the marketing vocabulary is a ratio — CAC is spend ÷
   * orders, ROAS is revenue ÷ spend, a subscriber's lifetime is 1 ÷ churn — so
   * without this the concepts cannot be modelled, only asserted.
   *
   * A zero denominator yields zero rather than throwing: ROAS on no ad spend
   * reading as zero is the honest answer, and an exception here would take out
   * a whole report mid-projection.
   */
  | (SimDriverBase & { kind: "quotient"; numerator: DriverId; denominator: DriverId })
  /**
   * A fixed number that is deliberately NOT a lever — the 1000 in a CPM, the 1
   * in `lifetime = 1 ÷ churn`.
   *
   * Distinct from an `input` with the same value precisely so that
   * `validateScenario` can reject an intervention authored against it. "Improve
   * the number of months in a year by 8%" should be a build failure.
   */
  | (SimDriverBase & { kind: "constant"; value: number })
  /**
   * A quantity that ACCUMULATES: `prior + inflow − outflow`.
   *
   * The first kind that carries anything between periods, and the reason the
   * resolver had to learn about history at all. Everything above is memoryless —
   * evaluate the graph at quarter 3 and quarter 2 never happened — which is why
   * no scenario could previously ask "is there any cash left", only "is this
   * ratio wrong". Cash, inventory, a subscriber base, a backlog and debt are all
   * stocks, and none of them were expressible.
   *
   * `floor` clamps the bottom for the quantities that physically cannot go
   * negative — you cannot hold −40 units of inventory. It is deliberately
   * OPTIONAL and deliberately absent on cash: a company whose balance goes below
   * zero has run out of money, and clamping that away would hide the single
   * outcome the scenario exists to teach.
   */
  | (SimDriverBase & {
      kind: "stock";
      initial: number;
      inflow: DriverId;
      outflow: DriverId;
      floor?: number;
    })
  /**
   * The value another driver had `periods` ago. Default 1 — last period.
   *
   * **This is what makes feedback loops legal.** `dependenciesOf` reports NO
   * dependency for it, because it reads history rather than the current period,
   * so `driverOrder` still sees a strict DAG and still throws on a genuine
   * instantaneous cycle. The loop closes across time instead of within a period,
   * which is both how the real system works and the only way to keep a
   * single-pass evaluator.
   *
   * What it buys: cutting support this quarter raises churn next quarter and
   * shrinks collections the quarter after. A death spiral is a cycle, and a
   * cycle was previously a build failure.
   *
   * `initial` is the value to use before that far back exists — the quarter
   * before the run started. It is authored explicitly rather than read off `of`
   * for an ordering reason that matters: since this kind reports no dependency,
   * `of` is not guaranteed to be computed yet when this one is, so there is
   * nothing to read at period 0. Normally it equals `of`'s baseline (the system
   * was in equilibrium); authoring it separately also allows a scenario to open
   * mid-swing on purpose.
   */
  | (SimDriverBase & {
      kind: "lagged";
      of: DriverId;
      periods?: number;
      initial: number;
    })
  /**
   * The smallest of its inputs — the binding constraint.
   *
   * You cannot spend cash you do not have, and you cannot sell what you cannot
   * make. Modelled rather than scored, for the same reason `minSprints` is: a
   * constraint that only shows up in the debrief is a rule the student never got
   * to bump into.
   */
  | (SimDriverBase & { kind: "min"; of: DriverId[] });

// ─── Dashboard panels ──────────────────────────────────────────────────────

export interface SimSeriesPoint {
  /** Display label for the period — "W-5", "Q3 FY25". Never parsed. */
  period: string;
  value: number;
}

export interface SimSeries {
  label: string;
  unit: SimUnit;
  points: SimSeriesPoint[];
}

export interface SimStatTile {
  label: string;
  value: number;
  unit: SimUnit;
  /** Change vs the comparison period, as a fraction. -0.09 renders as −9%. */
  deltaPct?: number;
  goodDirection?: GoodDirection;
}

export interface SimFunnelStep {
  label: string;
  value: number;
  deltaPct?: number;
}

export interface SimSegmentRow {
  label: string;
  value: number;
  unit: SimUnit;
  deltaPct?: number;
}

/**
 * One row of a financial statement.
 *
 * `emphasis` and `indent` are presentation, and that is the point: a statement
 * is a document with a shape, and the shape carries the meaning. "Gross profit"
 * sitting under a rule after revenue and cost of goods is what tells a reader it
 * is a subtotal rather than a fourth cost line, and a beginner who cannot see
 * that cannot read the statement at all.
 */
export interface SimStatementLine {
  label: string;
  value: number;
  /** The comparison period. Absent on a single-column statement. */
  priorValue?: number;
  /** A subtotal — Gross profit, EBITDA, Total assets. Ruled off and bolded. */
  emphasis?: boolean;
  /** A component of the line above it. */
  indent?: boolean;
  /**
   * Which way is good on this line, colouring the change column.
   *
   * Per line rather than per statement, and absent by default, because on a
   * statement there is no single answer: revenue rising is good, interest cost
   * rising is not, and cash rising while payables rise with it is a question
   * rather than either. A line that does not say stays neutral, which is the
   * honest rendering of "it depends" and stops the colour teaching a direction
   * the author never claimed.
   */
  goodDirection?: GoodDirection;
  /**
   * Where the number came from, shown under the label.
   *
   * The investigation affordance for a document: an analyst reading a real
   * statement has the notes to the accounts, and "₹64 cr of the term loan falls
   * due within 12 months" is exactly the kind of line that is buried in note 14
   * and explains the whole balance sheet.
   */
  note?: string;
}

export interface SimStatementSection {
  /** "Current assets", "Cash from operations". Absent on a flat statement. */
  title?: string;
  lines: SimStatementLine[];
}

/**
 * What a panel shows.
 *
 * The `note` arm matters more than it looks: not every data pull comes back as
 * a chart. A support-ticket theme or a partner email is often the pull that
 * cracks a case open, and forcing everything into a series would flatten the
 * scenario into pure arithmetic.
 *
 * The `statement` arm exists because none of the others can render a P&L. A
 * statement is a ruled table of sections and subtotals against a comparative
 * column, and the alternatives lose precisely what is being taught: stat tiles
 * drop the ordering that makes revenue → gross profit → EBITDA a derivation,
 * and a segment chart of balance-sheet lines throws away the one fact a balance
 * sheet exists to assert, which is that the two sides are equal.
 */
export type SimPanel =
  | { id: PanelId; kind: "timeseries"; title: string; caption?: string; series: SimSeries[] }
  | { id: PanelId; kind: "stat"; title: string; caption?: string; tiles: SimStatTile[] }
  | { id: PanelId; kind: "funnel"; title: string; caption?: string; steps: SimFunnelStep[] }
  | {
      id: PanelId;
      kind: "segments";
      title: string;
      caption?: string;
      /** What the rows are cut by — "City tier", "App version". */
      dimension: string;
      rows: SimSegmentRow[];
    }
  | { id: PanelId; kind: "note"; title: string; body: string }
  | {
      id: PanelId;
      kind: "statement";
      title: string;
      caption?: string;
      /** Which statement this is. Drives the column headers and the footer. */
      statement: "pnl" | "balance" | "cashflow";
      unit: SimUnit;
      /** Column headers, current period first. */
      periods: [string] | [string, string];
      sections: SimStatementSection[];
    };

// ─── Investigate: priced data pulls ────────────────────────────────────────

export interface SimDrilldown {
  id: DrilldownId;
  label: string;
  /**
   * The question this pull answers, shown *before* it is bought. Without it the
   * budget is a lottery rather than a choice, and choosing is the exercise.
   */
  question: string;
  /** Analyst-days. */
  cost: number;
  /**
   * Pulls this one reads alongside — advisory, never a gate.
   *
   * It used to be a prerequisite: the pull was unbuyable until its parents were
   * owned. That lock is gone, because the only thing that should stop a
   * candidate asking a question is the analyst-day budget. What survives is the
   * authored knowledge that two pulls belong together, which the card shows as
   * a hint so a student can see the relationship and still buy either first.
   */
  dependsOn?: DrilldownId[];
  /** Panels appended to the dashboard once bought. */
  reveals: SimPanel[];
  /** Causes this is evidence for. Drives investigation scoring and the debrief. */
  evidenceFor: CauseId[];
  /** One line the debrief quotes: what a strong PM takes from this cut. */
  readsAs: string;
}

// ─── Commit: the cause tree ────────────────────────────────────────────────

export interface SimCause {
  id: CauseId;
  parentId: CauseId | null;
  label: string;
  /** Why this was or wasn't it. Revealed only in the debrief. */
  verdict: string;
  /**
   * Nothing on this board fixes it, and that is the authored answer rather than
   * a gap.
   *
   * Under gating a diagnosis only unlocks the interventions that address it, so
   * a cause with no fix behind it would leave the student unable to commit. The
   * cheap escape would be to invent one — but there is no intervention that
   * addresses a monsoon or a competitor's launch, and writing a fake one is
   * worse content than saying plainly that the quarter is not winnable from
   * here. Holding the capacity is then the correct answer, and the run scores
   * the do-nothing path honestly.
   *
   * Stripped by `toClientCause`: visible before the diagnosis is locked, this
   * would be a tell about which causes are decoys.
   */
  unactionable?: { why: string };
}

// ─── Commit: candidate interventions ───────────────────────────────────────

/**
 * How an effect responds to the money behind it, in **ask multiples**
 * (`u = rupees ÷ cost.rupees`). See `lib/sim/response.ts` for the shapes and
 * why these three.
 *
 * `halfAt` is the ask multiple at which half the ceiling has arrived, so it is
 * the "how fast" knob and `ceiling` is the "how high" one. A `ceiling` above 1
 * is legal and meaningful: it says over-funding this lever really can do more
 * than the authored `deltaPct`, which is true of a fix that is working and
 * false of one that is not.
 */
export type SimResponse =
  /** `clamp(u, 0, 1)` — the v1 curve, written down. */
  | { kind: "linear" }
  /** `slope · u`, uncapped. The cost side of a lever whose benefit flattens. */
  | { kind: "proportional"; slope?: number }
  /** `ceiling · (1 − 2^(−u/halfAt))`. Hard ceiling, satiates fast. */
  | { kind: "exponential"; ceiling: number; halfAt: number }
  /** `ceiling · u / (halfAt + u)`. Michaelis–Menten; always a little more. */
  | { kind: "hill"; ceiling: number; halfAt: number };

export interface SimEffect {
  /** Must name an `input` driver — enforced by `validateScenario`. */
  driver: DriverId;
  /** Fractional change at full funding. -0.18 is 18% lower. Must be > -1. */
  deltaPct: number;
  /** Quarters to reach full effect. Default 1, i.e. immediate. */
  rampQuarters?: number;
  /**
   * How this effect responds to money. Absent falls back to the intervention's
   * arm default, then the engine default for the arm.
   *
   * Only read when the scenario is on `engine: "v2"`; `validateScenario`
   * refuses it otherwise rather than letting it sit there doing nothing.
   */
  saturation?: SimResponse;
}

export interface SimIntervention {
  id: InterventionId;
  label: string;
  /** The one-line business case, phrased as a PM would hear it in the room. */
  pitch: string;
  addresses: CauseId;
  cost: SimCapacity;
  /**
   * Below this, nothing ships and the money is spent for no effect.
   *
   * Half a migration is not half a migration's value, and spreading capacity
   * thinly across every option is the mistake this format exists to punish —
   * so it has to be modelled rather than merely scored.
   */
  minSprints?: number;
  effects: {
    /** Applied when `addresses` is one of the scenario's true causes. */
    whenRootCause: SimEffect[];
    /**
     * Applied when it isn't. Usually small, sometimes genuinely negative:
     * discounting lifts orders and craters margin whether or not price was ever
     * the problem.
     */
    otherwise: SimEffect[];
  };
  /**
   * Default response curves for this intervention's effects, per arm.
   *
   * The arm defaults in `simConfig.responseDefaults` are usually right, and an
   * intervention should only state its own when it genuinely behaves
   * differently — a fix whose benefit is bounded by something physical, or a
   * lever whose cost side has to keep rising while its benefit flattens.
   */
  saturation?: { whenRootCause?: SimResponse; otherwise?: SimResponse };
  /**
   * Money cap as a multiple of `cost.rupees`. Bounds the slider and the
   * optimiser's search. Defaults to `simConfig.maxAskMultiple`.
   */
  maxAskMultiple?: number;
  /** What the debrief says about funding this. */
  debrief: string;
}

export interface SimCapacity {
  /**
   * Team capacity. Called **people-weeks** everywhere a student can see, and
   * `sprints` everywhere the code can: the field name is persisted inside
   * `SimRun.allocation` on every run ever played, so renaming the column would
   * rewrite the meaning of stored data to buy a word. The label and the field
   * differ on purpose.
   */
  sprints: number;
  /** Rupees. Authored in absolute rupees; the UI renders crore. */
  rupees: number;
}

export interface SimAllocationLine {
  interventionId: InterventionId;
  sprints: number;
  rupees: number;
}

// ─── The scenario ──────────────────────────────────────────────────────────

export interface SimDebriefCopy {
  /** The true chain, one step per line. */
  causalChain: string[];
  whereTheLeverageWas: string;
  /** What a strong interview answer to this sounds like. */
  strongAnswer: string;
}

/** Offline coach answers, matched by topic exactly like `Question.dataPack`. */
export interface SimCoachFact {
  topic: string[];
  answer: string;
}

/**
 * Who debriefs the run, and who they think they are talking to.
 *
 * Optional, defaulting to the product leader the coach has always been. It
 * exists because the debrief is a conversation with a specific person in a
 * specific job, and a finance scenario where a "senior product leader" explains
 * a cash conversion cycle to a "PM candidate" is a small lie that the student
 * notices immediately — the whole exercise is a role-play, and the mentor is
 * part of the role.
 */
export interface SimMentor {
  /** "a CFO debriefing a junior financial analyst". Follows "You are ". */
  persona: string;
  /** What to call the student in the prose — "analyst", "candidate". */
  audience: string;
}

// ─── Teaching ──────────────────────────────────────────────────────────────

/**
 * One term the scenario is about to use.
 *
 * `plain` before `formula` is deliberate. A student who does not yet know what
 * ROAS is gets nothing from "revenue ÷ ad spend" — they need to be told it
 * measures how many rupees came back for each rupee spent, and only then does
 * the formula mean anything.
 */
export interface SimPrimerTerm {
  term: string;
  /** Expanded, when the term is an acronym. */
  full?: string;
  /** One sentence, no jargon. */
  plain: string;
  formula?: string;
  /** The decision this term changes. A definition nobody acts on is trivia. */
  matters: string;
  /** Links the term to its node on the metric map. */
  driver?: DriverId;
}

export interface SimTeaching {
  primer: {
    /** What business you are running and what you are deciding. */
    intro: string;
    terms: SimPrimerTerm[];
    /** A worked line or two: "₹10L at a ₹180 CPM buys 55.6 lakh impressions." */
    worked?: string[];
  };
  /**
   * Whether the metric map is shown.
   *
   * Opt-in, because on a hard scenario the *shape* of the model is part of the
   * answer: showing that orders = sessions × conversion hands a NukkadEats
   * candidate the insight the whole exercise is built to make them find. On a
   * beginner scenario the opposite is true — seeing the chain is the lesson.
   */
  showMetricMap: boolean;
}

export interface SimScenario {
  /** Matches the catalogue `Question.externalId`. */
  slug: string;
  /**
   * Which format this is played on — see `lib/sim/formats`. Absent means the
   * war room, which is what every scenario written before there was a choice
   * is, so the twelve of them say nothing and stay unchanged.
   */
  format?: string;
  /**
   * Which outcome engine projects this scenario. Absent means `"v1"`: effects
   * are linear in the funding ratio, money is not itself a cost, and nothing
   * saturates.
   *
   * Explicit rather than derived from the presence of a curve. `validateScenario`
   * has to know which invariant set applies *before* an author has finished
   * tuning, `checkBalance` has to choose between the sweep and the optimiser,
   * and the commit panel has to choose between a slider and a number box. A
   * derived marker would also let a half-converted scenario validate quietly as
   * v1, which is the one failure mode worth spending a field to prevent.
   *
   * Same convention as `format` above: absent means the original, so every
   * scenario written before there was a choice says nothing and is unchanged.
   */
  engine?: "v1" | "v2";
  title: string;
  company: string;
  /** One line for the catalogue card. */
  premise: string;
  /** The war-room briefing shown on arrival. */
  situation: string;
  difficulty: Difficulty;

  /** The metric the run is judged on. */
  northStar: DriverId;
  /** Metrics the outcome report tracks alongside it. */
  reported: DriverId[];
  drivers: SimDriver[];

  /** What Observe shows before a rupee is spent. */
  dashboard: SimPanel[];

  budget: { analystDays: number; sprints: number; rupees: number };
  drilldowns: SimDrilldown[];
  causes: SimCause[];
  /** Leaves only — enforced by `validateScenario`. */
  trueCauseIds: CauseId[];
  interventions: SimIntervention[];

  /**
   * Where the money goes on the way out — how committed rupees reach the P&L.
   *
   * Without this, spending is free inside the model: no driver is debited by an
   * allocation, so a saturating response curve makes over-funding *pointless*
   * but never *harmful*, and emptying the budget stays weakly optimal. A
   * student who understands nothing but "spend it all" still lands on the
   * ceiling.
   *
   * `atFullBudget` is the fractional rise in `driver` when the entire money
   * budget is committed, scaled linearly with what was actually spent —
   * linearly because money is money, and the interesting curvature belongs on
   * the benefit side. Point it at whichever input carries cost: opex, cost per
   * order, marketing spend.
   *
   * v2 only, and optional even there — a scenario whose north star is a volume
   * metric nobody pays for can honestly leave it out, and `checkBalance` will
   * then be the thing that notices there is no decision left in the budget.
   */
  spend?: { driver: DriverId; atFullBudget: number };

  /**
   * What is genuinely uncertain about the next few quarters.
   *
   * Absent means a scenario plays out exactly as its model says, which is
   * right for one built to teach a specific arithmetic and wrong for one meant
   * to be replayed. Only the weather is drawn — the drift already bleeding,
   * and whichever inputs the author calls uncertain. Intervention effects are
   * never noised: a fix that works must not randomly fail, or the causal
   * lesson stops being learnable.
   *
   * Sigmas are per quarter and multiplicative. 0.015–0.025 suits a
   * well-instrumented funnel input; 0.03–0.05 a demand-side one. v2 only.
   */
  noise?: {
    drivers: { driver: DriverId; sigma: number }[];
    /** How unreliable the bleed itself is. 0.25 is a reasonable default. */
    driftSigma?: number;
  };

  /** Untreated bleed, compounding per period, so doing nothing is not free. */
  drift: SimEffect[];
  horizonQuarters: number;
  /**
   * How many periods the student actually allocates in. Defaults to the whole
   * horizon, which is what a war room does.
   *
   * Splitting the two is what makes a turnaround honest. With decisions and
   * horizon equal, any damage that ramps — a support cut whose churn arrives two
   * quarters later — falls off the end of the projection and reads as free. The
   * brute-force sweep found exactly that: cutting marketing in the second-to-last
   * period scored BEST, because the customers it destroys had nowhere left to be
   * missed from. Deciding for four quarters and being judged on eight puts the
   * consequences back inside the picture, which is the entire point of a format
   * built on stocks.
   */
  decisionPeriods?: number;
  /**
   * What a period is called in the report. Display only — the model is
   * period-agnostic. An ad campaign or a subscription base moves monthly, and
   * a report reading "Q+1" for a monthly campaign is simply wrong.
   */
  periodNoun?: "month" | "quarter";

  /** Concept primer and metric map. Absent on scenarios that assume fluency. */
  teaching?: SimTeaching;
  /** Who runs the debrief. Absent leaves the default product-leader coach. */
  mentor?: SimMentor;

  /** The cheapest sufficient investigation; efficiency is measured against it. */
  parInvestigation: DrilldownId[];
  /**
   * The authored best use of capacity, and the ceiling the outcome score
   * normalises against — so a run is graded on what was achievable in this
   * scenario rather than against an absolute nobody can calibrate.
   */
  bestAllocation: SimAllocationLine[];
  /**
   * The best SEQUENCE, for a format that allocates more than once. Index is the
   * period the capacity is committed in.
   *
   * Only meaningful on the turnaround format, and optional even there — see
   * `bestScheduleFor`, which falls back to spending `bestAllocation` in period
   * zero. Kept alongside rather than replacing it so `SimScenario` has one shape
   * for both formats and the war room is untouched.
   */
  bestSchedule?: SimAllocationLine[][];

  debrief: SimDebriefCopy;
  coachFallback: SimCoachFact[];
}

// ─── Run state (the pure view the engine takes) ────────────────────────────

export interface SimPurchaseRecord {
  drilldownId: DrilldownId;
  /** Price paid, pinned at purchase: retuning content must not move a past score. */
  cost: number;
  /** 1-based, so "cheaply AND early" is answerable. */
  seq: number;
}

/** Everything the engine needs about a run. No Prisma types cross this line. */
export interface SimRunState {
  phase: SimPhase;
  daysSpent: number;
  purchases: SimPurchaseRecord[];
  /** The belief currently held. Revisable until Commit opens. */
  hypothesis: CauseId[];
  /**
   * Every belief held along the way, oldest first.
   *
   * Empty for a run played before revisions existed. `scoreInvestigation` needs
   * it to rate a pull against what was believed when it was bought; the debrief
   * uses it to tell the candidate how their thinking moved.
   */
  hypothesisLog: HypothesisLog;
  diagnosis: CauseId[];
  allocation: SimAllocationLine[];
}

// ─── Outcome ───────────────────────────────────────────────────────────────

/** driverId → value per quarter. Index 0 is today's baseline. */
export type SimPaths = Record<DriverId, number[]>;

export interface InterventionFunding {
  /** Cleared its capacity gate. False means stalled: every response is 0. */
  shipped: boolean;
  sprints: number;
  rupees: number;
  /**
   * `rupees ÷ cost.rupees`, uncapped. What a v2 response curve reads, and the
   * number the debrief's "you paid twice what this could use" line is built on.
   */
  askMultiple: number;
  /**
   * The v1 number: `clamp(min(sprints/cost.sprints, rupees/cost.rupees), 0, 1)`.
   *
   * Produced by the original expression, unmoved, because a v1 scenario has to
   * come out of the projection bit-identical and float arithmetic does not
   * forgive an algebraically equal rewrite.
   */
  ratio: number;
}

export interface SimOutcomeResult {
  /** What this run's allocation produced. */
  paths: SimPaths;
  /** Drift only — the counterfactual where nothing was funded. */
  doNothing: SimPaths;
  /** The scenario's `bestAllocation`, i.e. the achievable ceiling. */
  best: SimPaths;
  /** Funding ratio actually achieved per intervention, for the debrief. */
  funding: Record<InterventionId, number>;
  /**
   * The full funding picture — rupees committed, the ask multiple they came to,
   * and whether the thing shipped.
   *
   * Optional because every `SimResult.outcomeJson` written before it existed
   * has no such field, and those rows are pinned records that must go on
   * reading correctly rather than be migrated. `funding` above stays the ratio
   * map for exactly the same reason.
   */
  fundingDetail?: Record<InterventionId, InterventionFunding>;
  /**
   * The same three projections with the weather taken out.
   *
   * What the scorer reads, so that two candidates who played identically score
   * identically however their luck ran — see `lib/sim/noise.ts`. Absent on a
   * run with no seed or a scenario with no `noise`, in which case the realised
   * paths above *are* the expectation and scoring falls back to them.
   */
  expected?: { paths: SimPaths; doNothing: SimPaths; best: SimPaths };
  /** The run's seed, so a stored report can be explained after the fact. */
  seed?: string;
  /** Funded but never shipped, below `minSprints`. The expensive mistake. */
  stalled: InterventionId[];
}

// ─── Purchase decisions ────────────────────────────────────────────────────

export type PurchaseRefusal =
  | "unknown_drilldown"
  | "already_owned"
  | "insufficient_budget"
  | "wrong_phase";

export type PurchaseDecision =
  | { ok: true; cost: number; daysSpentAfter: number; remaining: number }
  | { ok: false; reason: PurchaseRefusal };

// ─── The client projection ─────────────────────────────────────────────────

/**
 * What may cross to the browser during a run.
 *
 * `evidenceFor` is stripped along with `reveals`: knowing that three pulls all
 * point at the same cause is itself a strong hint, and it is only needed by the
 * scorer, which runs on the server. See `./redact.ts` and its test.
 */
export type ClientDrilldown = Omit<SimDrilldown, "reveals" | "evidenceFor" | "readsAs"> & {
  /** Whether the run already owns it, so the UI can show it as bought. */
  owned: boolean;
};

export type ClientCause = Omit<SimCause, "verdict" | "unactionable">;

/**
 * What the funding panel needs to show a curve without showing an effect.
 *
 * Every figure here is in rupees or is a ratio of two slopes on the same curve.
 * Neither can carry `deltaPct`: the marginal ratio `r'(u)/r'(0)` cancels it
 * algebraically, and the satiation point is a property of `halfAt` alone. So a
 * student can be told "the next ₹50 L buys about a tenth as much as the first"
 * — which is the whole reason to have a slider — while learning nothing about
 * how big the effect is, or whether this lever is the right one.
 *
 * Absent on a v1 scenario, which has no curve to describe.
 */
export interface SaturationHint {
  /** Rupees at which half of what this lever can ever do has arrived. */
  halfAtRupees: number;
  /** Rupees past which it has effectively stopped. Null when it never does. */
  satiationRupees: number | null;
  /** Money this lever will absorb at all. */
  capRupees: number;
}

export type ClientIntervention = Omit<
  SimIntervention,
  "addresses" | "effects" | "debrief" | "saturation"
> & {
  saturationHint?: SaturationHint;
};

export interface ClientScenario {
  slug: string;
  title: string;
  company: string;
  premise: string;
  situation: string;
  difficulty: Difficulty;
  budget: SimScenario["budget"];
  horizonQuarters: number;
  periodNoun: "month" | "quarter";
  /**
   * Definitions are safe to ship — they are the opposite of the answer. The
   * `showMetricMap` flag rides along so the client knows whether a map was
   * withheld deliberately.
   */
  teaching: SimTeaching | null;
  /**
   * Present only when `teaching.showMetricMap`. On a hard scenario the shape of
   * the model is part of what the candidate has to work out, so it is withheld
   * along with everything else — see `./redact.ts`.
   */
  metricMap: MetricMapNode[] | null;
  /** The base dashboard plus the panels of every owned pull, in purchase order. */
  panels: SimPanel[];
  drilldowns: ClientDrilldown[];
  causes: ClientCause[];
  /**
   * Only the fixes that treat the cause this run has named — empty until one is.
   * The gate; see `toClientInterventions` in lib/sim/redact.ts.
   */
  interventions: ClientIntervention[];
  /**
   * Why the named cause has nothing to fund, when it has nothing to fund.
   *
   * Scenario-level rather than on the cause, so every `ClientCause` keeps the
   * same shape and none of them signals anything. Null until a diagnosis is
   * locked.
   */
  unactionableNote: string | null;
}
