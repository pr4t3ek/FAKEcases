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
 * Resume an in-progress run for this question, or start a fresh one.
 *
 * Resuming rather than restarting matters more here than on an attempt: the
 * analyst-day budget is already partly spent, so a second run would silently
 * hand back spent capacity.
 */
export async function startRun(
  userId: string,
  questionId: string,
  scenarioSlug: string,
): Promise<string> {
  const existing = await db.simRun.findFirst({
    where: { userId, questionId, phase: { not: "debrief" } },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await db.simRun.create({
    data: { userId, questionId, scenarioSlug },
    select: { id: true },
  });
  return created.id;
}

/** The pure view the engine takes. No Prisma types cross this line. */
export function toRunState(run: {
  phase: string;
  daysSpent: number;
  hypothesis: string | null;
  diagnosis: string | null;
  allocation: string | null;
  purchases: { drilldownId: string; cost: number; seq: number }[];
}): SimRunState {
  return {
    phase: run.phase as SimPhase,
    daysSpent: run.daysSpent,
    purchases: run.purchases.map(
      (p): SimPurchaseRecord => ({ drilldownId: p.drilldownId, cost: p.cost, seq: p.seq }),
    ),
    hypothesis: parseJsonArray<CauseId>(run.hypothesis),
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

/** Lock the hypothesis and open the investigation. */
export async function commitHypothesisToRun(
  runId: string,
  suspects: CauseId[],
  note: string | null,
): Promise<void> {
  await db.simRun.update({
    where: { id: runId },
    data: {
      hypothesis: JSON.stringify(suspects),
      hypothesisNote: note?.trim() || null,
      phase: "investigate",
    },
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
  diagnosis: CauseId[];
  allocation: SimAllocationLine[];
  outcome: SimOutcomeResult;
  score: SimScoreResult;
}): Promise<void> {
  const { runId, diagnosis, allocation, outcome, score } = args;

  await db.$transaction(async (tx) => {
    await tx.simRun.update({
      where: { id: runId },
      data: {
        diagnosis: JSON.stringify(diagnosis),
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

/** Completed runs, for the guest wall and the dashboard. */
export async function countCompletedRuns(userId: string): Promise<number> {
  return db.simRun.count({ where: { userId, phase: "debrief" } });
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
  };
}

/** Question ids the user has already finished a run for. */
export async function completedSimQuestionIds(userId: string): Promise<string[]> {
  const rows = await db.simRun.findMany({
    where: { userId, phase: "debrief" },
    select: { questionId: true },
  });
  return rows.map((r) => r.questionId);
}
