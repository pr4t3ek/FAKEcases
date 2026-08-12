/**
 * Data access for decision simulations — the domain's counterpart to
 * `lib/questions.ts` and `lib/progress.ts`.
 *
 * Everything that touches Prisma for a simulation goes through here, so the
 * engine under `lib/sim/` stays pure and testable and the server actions stay
 * thin. Note what is absent: nothing in this file writes an `Attempt` or an
 * `Evaluation`, which is what keeps interview readiness and percentile rank
 * structurally insulated from simulation results.
 */

import { db } from "@/lib/db";
import { parseJsonArray, parseJson } from "@/lib/json";
import type { SimPhase } from "@/lib/types";
import { loadScenario } from "@/lib/scenario-store";
import type {
  CauseId,
  SimAllocationLine,
  SimOutcomeResult,
  SimPurchaseRecord,
  SimRunState,
  SimScenario,
} from "@/lib/sim/types";
import type { SimScoreResult } from "@/lib/sim/score";
import type { TurnaroundScore } from "@/lib/sim/turnaround";
import { serialiseJournal, type RunJournal } from "@/lib/sim/engine/journal";
import {
  appendRevision,
  parseHypothesisLog,
  withHypothesisLog,
} from "@/lib/sim/hypothesis-log";
import { simStateFromRuns, type SimQuestionState } from "@/lib/sim/replay";

// Re-exported so callers have one import for "simulation data access", while the
// rule itself stays in a module a test can reach — see lib/sim/replay.ts.
export { simStateFromRuns };
export type { SimCardState, SimQuestionState } from "@/lib/sim/replay";

/** A run with everything the page and the engine need. */
export type LoadedRun = NonNullable<Awaited<ReturnType<typeof loadRun>>>;

export async function loadRun(runId: string) {
  return db.simRun.findUnique({
    where: { id: runId },
    include: {
      purchases: { orderBy: { seq: "asc" } },
      result: true,
      question: { include: { category: true } },
    },
  });
}

/**
 * An unfinished run for this question, if there is one.
 *
 * Split out of `startRun` so the caller can resume *before* deciding whether the
 * visitor's tier may open the scenario — an access rule should not be able to
 * strand a war room that is already half-played.
 */
export async function findResumableRun(
  userId: string,
  questionId: string,
): Promise<string | null> {
  const existing = await db.simRun.findFirst({
    where: { userId, questionId, phase: { not: "debrief" } },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  return existing?.id ?? null;
}

/**
 * Resume an in-progress run for this question, or start a fresh one.
 *
 * Resuming rather than restarting matters more here than on an attempt: the
 * analyst-day budget is already partly spent, so a second run would silently
 * hand back spent capacity. The check is kept here as well as in the caller so
 * no future entry point can create a duplicate run by forgetting it.
 */
export async function startRun(
  userId: string,
  questionId: string,
  scenarioSlug: string,
  /**
   * The format's first phase. Defaults to the war room's, so the twelve
   * scenarios that predate formats keep the behaviour the column default gave
   * them.
   */
  firstPhase = "observe",
  /**
   * The RNG seed for a stochastic simulator, or null for the authored formats,
   * which draw nothing. Assigned ONCE here and never regenerated — every replay,
   * counterfactual and resume derives from it.
   */
  seed: string | null = null,
): Promise<string> {
  const existing = await findResumableRun(userId, questionId);
  if (existing) return existing;

  const created = await db.simRun.create({
    data: { userId, questionId, scenarioSlug, phase: firstPhase, seed },
    select: { id: true },
  });
  return created.id;
}

/**
 * A fresh seed for a stochastic run.
 *
 * The one place in the simulation stack that is allowed to be non-deterministic,
 * and only because it is the entropy source: everything downstream is a pure
 * function of what this returns, which is exactly why it is stored.
 */
export function runSeed(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** The pure view the engine takes. No Prisma types cross this line. */
export function toRunState(run: {
  phase: string;
  daysSpent: number;
  hypothesis: string | null;
  diagnosis: string | null;
  allocation: string | null;
  stateJson?: string | null;
  purchases: { drilldownId: string; cost: number; seq: number }[];
}): SimRunState {
  return {
    phase: run.phase as SimPhase,
    daysSpent: run.daysSpent,
    purchases: run.purchases.map(
      (p): SimPurchaseRecord => ({ drilldownId: p.drilldownId, cost: p.cost, seq: p.seq }),
    ),
    hypothesis: parseJsonArray<CauseId>(run.hypothesis),
    // Empty for every run played before revisions existed, which then scores
    // against its single hypothesis exactly as it always did.
    hypothesisLog: parseHypothesisLog(run.stateJson ?? null),
    diagnosis: parseJsonArray<CauseId>(run.diagnosis),
    allocation: parseJsonArray<SimAllocationLine>(run.allocation),
  };
}

/** Purchased pulls in the order they were bought — the dashboard's narrative. */
export function ownedInOrder(purchases: { drilldownId: string; seq: number }[]): string[] {
  return [...purchases].sort((a, b) => a.seq - b.seq).map((p) => p.drilldownId);
}

export async function scenarioForRun(
  run: { scenarioSlug: string },
): Promise<SimScenario | undefined> {
  return loadScenario(run.scenarioSlug);
}

/**
 * Record the hypothesis — the opening call, or a revision made after the data
 * started arriving — and open the investigation.
 *
 * The two typed columns hold the *current* belief, because that is what the
 * final score reads and what every existing caller expects. The log alongside
 * them holds what was believed before it, which `scoreInvestigation` needs to
 * rate each pull against the belief that was standing when it was bought.
 *
 * One update, so a revision cannot half-land: the columns and the history it
 * has to agree with are written together or not at all.
 */
export async function commitHypothesisToRun(args: {
  runId: string;
  suspects: CauseId[];
  note: string | null;
  purchaseCount: number;
  daysSpent: number;
  stateJson: string | null;
}): Promise<void> {
  const { runId, suspects, note, purchaseCount, daysSpent, stateJson } = args;
  const trimmed = note?.trim() || null;

  const log = appendRevision(parseHypothesisLog(stateJson), {
    causeIds: suspects,
    note: trimmed,
    afterPurchases: purchaseCount,
    afterDays: daysSpent,
    at: new Date().toISOString(),
  });

  await db.simRun.update({
    where: { id: runId },
    data: {
      hypothesis: JSON.stringify(suspects),
      hypothesisNote: trimmed,
      stateJson: withHypothesisLog(stateJson, log),
      // A no-op when amending, since that is already the phase — so one path
      // serves the opening call and every revision after it.
      phase: "investigate",
    },
  });
}

/**
 * Lock the diagnosis, before the board narrows to it.
 *
 * Written *before* the permitted interventions are computed, and never rewritten
 * — that ordering is the anti-enumeration property. If the slate could be
 * re-rolled by naming a different cause, anyone could learn which branch has
 * three fixes behind it and which has one, and the branch with three is the
 * answer. `commitRun` no longer writes this column.
 */
export async function commitDiagnosisToRun(
  runId: string,
  diagnosis: CauseId[],
): Promise<void> {
  await db.simRun.update({
    where: { id: runId },
    data: { diagnosis: JSON.stringify(diagnosis) },
  });
}

/**
 * Charge for a pull and record it.
 *
 * One transaction, because a purchase that debited the budget without recording
 * the pull would cost a candidate a day for nothing. `seq` is derived inside the
 * transaction from the current count, and `@@unique([runId, drilldownId])` is
 * the backstop against a double-click racing itself.
 */
export async function recordPurchase(
  runId: string,
  drilldownId: string,
  cost: number,
): Promise<void> {
  await db.$transaction(async (tx) => {
    const seq = await tx.simPurchase.count({ where: { runId } });
    await tx.simPurchase.create({
      data: { runId, drilldownId, cost, seq: seq + 1 },
    });
    await tx.simRun.update({
      where: { id: runId },
      data: { daysSpent: { increment: cost } },
    });
  });
}

/** Move from investigating to committing. Nothing is charged. */
export async function openCommitPhase(runId: string): Promise<void> {
  await db.simRun.update({ where: { id: runId }, data: { phase: "commit" } });
}

/**
 * Write the decision, the outcome and the score, and close the run.
 *
 * The outcome is persisted rather than recomputed on read. The causal model is
 * code, so re-deriving it later would let a content edit silently rewrite a
 * student's history — the same reason `Evaluation` snapshots `betterApproach`.
 */
export async function commitRun(args: {
  runId: string;
  allocation: SimAllocationLine[];
  outcome: SimOutcomeResult;
  score: SimScoreResult;
}): Promise<void> {
  const { runId, allocation, outcome, score } = args;

  await db.$transaction(async (tx) => {
    await tx.simRun.update({
      where: { id: runId },
      data: {
        // `diagnosis` is deliberately absent: it was written by
        // `commitDiagnosisToRun` before the interventions were shown, and
        // rewriting it here would let the commit disagree with the slate it
        // was offered.
        allocation: JSON.stringify(allocation),
        phase: "debrief",
        committedAt: new Date(),
      },
    });
    await tx.simResult.create({
      data: {
        runId,
        overall: score.overall,
        band: score.band,
        hypothesis: score.scores.hypothesis,
        investigation: score.scores.investigation,
        diagnosis: score.scores.diagnosis,
        decision: score.scores.decision,
        outcome: score.scores.outcome,
        causeFound: score.causeFound,
        daysSpent: score.daysSpent,
        daysPar: score.daysPar,
        outcomeJson: JSON.stringify(outcome),
        feedback: JSON.stringify(score.feedback),
      },
    });
  });
}

export function outcomeFromResult(result: { outcomeJson: string }): SimOutcomeResult | null {
  return parseJson<SimOutcomeResult>(result.outcomeJson);
}

export async function listRunsForUser(userId: string) {
  return db.simRun.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { result: true, question: { select: { title: true } } },
  });
}

export interface SimSummary {
  completed: number;
  inProgress: number;
  bestOverall: number | null;
  causesFound: number;
  latest: { runId: string; title: string; overall: number; band: string } | null;
  /**
   * The unfinished run to go back to, if there is one.
   *
   * Derived from rows `listRunsForUser` already returns, so the dashboard can
   * link a resumable run without a second query. `phase` rather than `result` is
   * the test, matching `findResumableRun` — a run that reached debrief without a
   * result is not something to send anyone back into.
   */
  resumable: { runId: string; title: string } | null;
}

/**
 * Simulation stats for the dashboard.
 *
 * Reported on their own rather than folded into `Progress`, because a
 * simulation is scored on a different rubric and averaging the two numbers
 * would produce something that means nothing.
 */
export async function simSummary(userId: string): Promise<SimSummary> {
  const runs = await listRunsForUser(userId);
  const done = runs.filter((r) => r.result);

  const overalls = done.map((r) => r.result!.overall);
  const latestDone = done[0];
  const open = runs.find((r) => r.phase !== "debrief");

  return {
    completed: done.length,
    inProgress: runs.length - done.length,
    bestOverall: overalls.length ? Math.max(...overalls) : null,
    causesFound: done.filter((r) => r.result!.causeFound).length,
    latest: latestDone
      ? {
          runId: latestDone.id,
          title: latestDone.question.title,
          overall: latestDone.result!.overall,
          band: latestDone.result!.band,
        }
      : null,
    resumable: open ? { runId: open.id, title: open.question.title } : null,
  };
}

/**
 * Simulation state for every question this user has touched, in ONE query.
 *
 * One query rather than one per card: the library renders the whole grid, so a
 * per-card lookup would be an N+1 on the busiest page in the app.
 */
export async function simStateByQuestion(
  userId: string,
): Promise<Record<string, SimQuestionState>> {
  const rows = await db.simRun.findMany({
    where: { userId },
    select: {
      id: true,
      questionId: true,
      phase: true,
      createdAt: true,
      result: { select: { overall: true } },
    },
  });
  return simStateFromRuns(rows);
}

// ─── Turnaround format ─────────────────────────────────────────────────────

/**
 * Append one period's allocation and advance, finishing the run when the last
 * decision is spent.
 *
 * The whole sequence lives in `stateJson` rather than in the typed `allocation`
 * column, because a turnaround commits several times and that column holds one
 * commitment. `allocation` is still written on the final period with the flat
 * sequence, so anything reading a run's committed capacity generically — the
 * admin panel, a future export — sees something true rather than null.
 */
export async function commitTurnaroundPeriod(args: {
  runId: string;
  schedule: SimAllocationLine[][];
  finished: boolean;
  score?: TurnaroundScore;
  outcome?: SimOutcomeResult;
  formatSlug: string;
}): Promise<void> {
  const { runId, schedule, finished, score, outcome, formatSlug } = args;

  if (!finished) {
    await db.simRun.update({
      where: { id: runId },
      data: { phase: "period", stateJson: JSON.stringify({ schedule }) },
    });
    return;
  }

  await db.$transaction(async (tx) => {
    await tx.simRun.update({
      where: { id: runId },
      data: {
        phase: "debrief",
        stateJson: JSON.stringify({ schedule }),
        allocation: JSON.stringify(schedule.flat()),
        committedAt: new Date(),
      },
    });
    await tx.simResult.create({
      data: {
        runId,
        overall: score!.overall,
        band: score!.band,
        formatSlug,
        // The format's own dimensions. The five typed columns below cannot hold
        // them — they are named after the war room's — so they take zero and
        // `formatSlug` tells the report which side to read.
        scoresJson: JSON.stringify(score!.scores),
        hypothesis: 0,
        investigation: 0,
        diagnosis: 0,
        decision: 0,
        outcome: 0,
        causeFound: score!.solvent,
        daysSpent: score!.periodsPlayed,
        daysPar: schedule.length,
        outcomeJson: JSON.stringify(outcome ?? {}),
        feedback: JSON.stringify(score!.feedback),
      },
    });
  });
}

// ─── Config-driven simulators ──────────────────────────────────────────────

/**
 * Persist a finished simulator run.
 *
 * The journal goes in `stateJson` and the KPI dimensions in `scoresJson`, both
 * of which exist for exactly this — see the notes on those columns. The five
 * typed score columns take zero, because they are named after the war room's
 * dimensions and a buyback run has none of them; `formatSlug` is what tells the
 * report which side to read.
 *
 * `outcomeJson` carries the Monte Carlo distribution rather than a projection,
 * pinned for the same reason everything else here is pinned: a debrief that drew
 * a different histogram on every visit would be worse than one that drew none.
 */
export async function commitSimulatorRun(args: {
  runId: string;
  journal: RunJournal;
  score: { overall: number; band: string; scores: Record<string, number>; riskPercentile: number };
  distribution: number[];
  formatSlug: string;
}): Promise<void> {
  const { runId, journal, score, distribution, formatSlug } = args;

  await db.$transaction(async (tx) => {
    await tx.simRun.update({
      where: { id: runId },
      data: {
        phase: "debrief",
        stateJson: serialiseJournal(journal),
        committedAt: new Date(),
      },
    });
    await tx.simResult.create({
      data: {
        runId,
        overall: score.overall,
        band: score.band,
        formatSlug,
        scoresJson: JSON.stringify(score.scores),
        hypothesis: 0,
        investigation: 0,
        diagnosis: 0,
        decision: 0,
        outcome: 0,
        causeFound: score.riskPercentile >= 0.5,
        daysSpent: journal.entries.length,
        daysPar: journal.entries.length,
        outcomeJson: JSON.stringify({ distribution }),
        feedback: "[]",
      },
    });
  });
}
