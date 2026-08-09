import type { SimPhase } from "@/lib/types";
import type {
  ClientIntervention,
  ClientScenario,
  GoodDirection,
  SimPanel,
  SimTeaching,
  SimUnit,
} from "@/lib/sim/types";
import type { MetricMapNode } from "@/lib/sim/metric-map";
import type { OutcomeRow, AllocationComparisonRow, TrailStep } from "@/lib/sim/debrief";
import type { FeedbackItem } from "@/lib/types";
import type { SimRubricKey } from "@/lib/config/simulation";
import type { BoardRow } from "@/components/leaderboard/leaderboard-table";

/**
 * What the run page hands the client.
 *
 * `scenario` is the redacted projection (see lib/sim/redact.ts) — it is the only
 * scenario shape allowed across this boundary while a run is live.
 */
export interface SimulationData {
  runId: string;
  isGuest: boolean;
  phase: SimPhase;
  scenario: ClientScenario;
  daysSpent: number;
  /** Suspects already named, once the hypothesis is locked. */
  hypothesis: string[];
  hypothesisNote: string | null;
  /**
   * How many pulls have been bought. Zero means the hypothesis is still
   * changeable — the client mirrors `hypothesisEditFor`, and the server
   * re-checks it on every write.
   */
  purchaseCount: number;
  /**
   * The causes named at Commit, once locked. Empty until then.
   *
   * Commit is two steps because of this: while it is empty, `scenario.interventions`
   * is empty too — the server ships no fixes at all until a cause has been named,
   * and afterwards only the ones that treat it.
   */
  diagnosis: string[];
}

/** A panel added to the board by a purchase, after the fact. */
export type RevealedPanels = SimPanel[];

/**
 * The debrief. Only built once a run is committed, at which point revealing the
 * authored truth is the entire point.
 */
export interface SimulationReportData {
  runId: string;
  /**
   * The catalogue row this run was played against — what `startSimulation` takes,
   * so the report can offer a replay without sending anyone back to the library
   * to find the card again.
   */
  questionId: string;
  isGuest: boolean;
  title: string;
  company: string;
  overall: number;
  band: string;
  causeFound: boolean;
  daysSpent: number;
  daysPar: number;
  /**
   * The format's own dimensions. Keyed by string rather than `SimRubricKey`
   * because a turnaround's keys are not the war room's — see `SimResult.scoresJson`.
   */
  scores: { key: string; label: string; hint: string; value: number }[];
  feedback: FeedbackItem[];
  northStarLabel: string;
  outcome: OutcomeRow[];
  /** Quarterly north-star paths for the three-line comparison chart. */
  northStarPaths: { quarter: string; actual: number; doNothing: number; best: number }[];
  allocation: AllocationComparisonRow[];
  trail: TrailStep[];
  missed: TrailStep[];
  yourDiagnosis: string[];
  trueCauses: string[];
  /** "month" or "quarter" — a monthly campaign reported in Q+1 reads as wrong. */
  periodNoun: "month" | "quarter";
  /**
   * Whether this run had an investigation phase at all.
   *
   * False on a turnaround, which buys no data and spends no analyst-days.
   * Without it the report told a turnaround player they had "spent 4
   * analyst-days" — the period count wearing the war room's noun.
   */
  hasInvestigation: boolean;
  /**
   * The scenario's money budget, so the debrief picks the same unit the
   * allocation screen used. Re-denominating between the two would silently
   * change the numbers the student just typed.
   */
  budgetRupees: number;
  /**
   * The chain at end-of-horizon values, so the student can see which link their
   * decision actually moved. Null on scenarios that keep the model hidden.
   */
  metricMap: MetricMapNode[] | null;
  /** For the recap of terms in the debrief. */
  teaching: SimTeaching | null;
  causalChain: string[];
  whereTheLeverageWas: string;
  strongAnswer: string;
  /** Whether an LLM debrief coach is reachable at all. */
  coachAvailable: boolean;
  /** Top first-run scores on this scenario. Empty until somebody ranks. */
  leaderboard: BoardRow[];
  /** The viewer's ranked run, or null. False `isThisAttempt` means a replay. */
  standing: {
    rank: number;
    total: number;
    score: number;
    effort: number;
    isThisAttempt: boolean;
  } | null;
}

// ─── Turnaround format ─────────────────────────────────────────────────────

/** One quarter's row in the timeline. */
export interface TurnaroundPeriodRow {
  /** 0-based decision period. */
  period: number;
  /** "Q1", "Q2" — what the student calls it. */
  label: string;
  state: "done" | "open" | "future";
  /** What was funded in this period, once it has been. */
  committed: { label: string; sprints: number; rupees: number }[];
  /**
   * Where the business stood at the END of this quarter. Present only for
   * quarters already played — projecting a future one onto the screen would
   * hand over the answer.
   */
  metrics: {
    driver: string;
    label: string;
    value: number;
    unit: SimUnit;
    deltaPct?: number;
    goodDirection?: GoodDirection;
  }[];
}

/** What the turnaround run page hands the client. */
export interface TurnaroundData {
  runId: string;
  isGuest: boolean;
  phase: string;
  title: string;
  company: string;
  situation: string;
  periodNoun: "month" | "quarter";
  budget: { sprints: number; rupees: number };
  /** One row per decision period, in order. */
  periods: TurnaroundPeriodRow[];
  /** Which period is open for allocation, or null when they are all spent. */
  openPeriod: number | null;
  interventions: ClientIntervention[];
  teaching: SimTeaching | null;
  metricMap: MetricMapNode[] | null;
  /** The opening board. Static — a turnaround reveals nothing by purchase. */
  panels: SimPanel[];
}

// ─── Config-driven simulators (the buyback contract) ───────────────────────

export interface BuybackKpi {
  key: string;
  label: string;
  value: number;
  unit: SimUnit;
  goodDirection: GoodDirection;
}

/** One decision control, described by the config rather than the component. */
export interface BuybackDecisionSpec {
  key: string;
  label: string;
  help: string;
  kind: "integer" | "currency";
  min: number;
  max: number;
  step: number;
  value: number;
}

/** The three statements for the month just posted. */
export interface BuybackStatements {
  pnl: { label: string; value: number; emphasis?: boolean }[];
  balance: { label: string; value: number; emphasis?: boolean }[];
  cashFlow: { label: string; value: number; emphasis?: boolean }[];
}

export interface BuybackData {
  runId: string;
  isGuest: boolean;
  phase: string;
  title: string;
  situation: string;
  /** 0-based month about to be decided. */
  monthIndex: number;
  horizon: number;

  decisions: BuybackDecisionSpec[];
  /** The fork due this month, if there is one. */
  branch: {
    prompt: string;
    options: { id: string; label: string; detail: string }[];
    chosen: string | null;
  } | null;

  /** What the supplier is offering for the coming month. */
  quote: {
    stance: string;
    wholesalePrice: number;
    buybackPrice: number;
    buybackShare: number;
  };
  /** Narrative wrappers that fired last month. */
  narrative: { id: string; headline: string; body: string }[];
  /** Public state only — hidden keys are stripped server-side. */
  signals: { key: string; label: string; value: number; unit: SimUnit }[];

  kpis: BuybackKpi[];
  /** Recharts rows: one per month played. */
  trends: Record<string, number | string>[];
  statements: BuybackStatements | null;
}

/** What the debrief needs once the year is over. */
export interface BuybackDebriefData {
  runId: string;
  questionId: string;
  title: string;
  overall: number;
  band: string;
  npv: number;
  riskPercentile: number;
  scores: { key: string; label: string; hint: string; value: number }[];
  kpis: BuybackKpi[];
  /** Monte Carlo outcomes, sorted, for the histogram. */
  distribution: number[];
  /** Per-month replay: decision, result and what was hidden at the time. */
  timeline: {
    month: number;
    decision: Record<string, number>;
    cash: number;
    npvSoFar: number;
    regimeLabel: string;
    trust: number;
    scenarios: string[];
  }[];
  /** Counterfactual paths: the same seed, one policy changed throughout. */
  counterfactuals: { label: string; detail: string; npv: number }[];
  branches: { atMonth: number; prompt: string; chosen: string | null }[];
  /** The whole run, for the JSON export. */
  exportJson: string;
}
