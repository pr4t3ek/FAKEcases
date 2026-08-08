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
  /** Pulls that must be owned first, giving the scenario a real second level. */
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

export interface SimEffect {
  /** Must name an `input` driver — enforced by `validateScenario`. */
  driver: DriverId;
  /** Fractional change at full funding. -0.18 is 18% lower. Must be > -1. */
  deltaPct: number;
  /** Quarters to reach full effect. Default 1, i.e. immediate. */
  rampQuarters?: number;
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
  /** What the debrief says about funding this. */
  debrief: string;
}

export interface SimCapacity {
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

  /** Untreated bleed, compounding per period, so doing nothing is not free. */
  drift: SimEffect[];
  horizonQuarters: number;
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
  hypothesis: CauseId[];
  diagnosis: CauseId[];
  allocation: SimAllocationLine[];
}

// ─── Outcome ───────────────────────────────────────────────────────────────

/** driverId → value per quarter. Index 0 is today's baseline. */
export type SimPaths = Record<DriverId, number[]>;

export interface SimOutcomeResult {
  /** What this run's allocation produced. */
  paths: SimPaths;
  /** Drift only — the counterfactual where nothing was funded. */
  doNothing: SimPaths;
  /** The scenario's `bestAllocation`, i.e. the achievable ceiling. */
  best: SimPaths;
  /** Funding ratio actually achieved per intervention, for the debrief. */
  funding: Record<InterventionId, number>;
  /** Funded but never shipped, below `minSprints`. The expensive mistake. */
  stalled: InterventionId[];
}

// ─── Purchase decisions ────────────────────────────────────────────────────

export type PurchaseRefusal =
  | "unknown_drilldown"
  | "already_owned"
  | "locked"
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
  /** Whether `dependsOn` is satisfied. */
  unlocked: boolean;
};

export type ClientCause = Omit<SimCause, "verdict" | "unactionable">;

export type ClientIntervention = Omit<SimIntervention, "addresses" | "effects" | "debrief">;

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
