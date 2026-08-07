import type { SimPhase } from "@/lib/types";
import type { ClientScenario, SimPanel, SimTeaching } from "@/lib/sim/types";
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
  scores: { key: SimRubricKey; label: string; hint: string; value: number }[];
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
