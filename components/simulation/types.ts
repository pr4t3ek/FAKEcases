import type { SimPhase } from "@/lib/types";
import type { ClientScenario, SimPanel } from "@/lib/sim/types";
import type { OutcomeRow, AllocationComparisonRow, TrailStep } from "@/lib/sim/debrief";
import type { FeedbackItem } from "@/lib/types";
import type { SimRubricKey } from "@/lib/config/simulation";

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
}

/** A panel added to the board by a purchase, after the fact. */
export type RevealedPanels = SimPanel[];

/**
 * The debrief. Only built once a run is committed, at which point revealing the
 * authored truth is the entire point.
 */
export interface SimulationReportData {
  runId: string;
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
  causalChain: string[];
  whereTheLeverageWas: string;
  strongAnswer: string;
  /** Whether an LLM debrief coach is reachable at all. */
  coachAvailable: boolean;
}
