"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getOrCreateGuest, getSessionUser } from "@/lib/auth";
import { guestConfig } from "@/lib/config";
import { canAdvanceSimPhase, type SimPhase } from "@/lib/types";
import { getScenario } from "@/lib/sim/registry";
import { priceDrilldown } from "@/lib/sim/investigate";
import { runOutcome } from "@/lib/sim/outcome";
import { scoreSimulation } from "@/lib/sim/score";
import { parseCommit, parseHypothesis } from "@/lib/sim/payload";
import type { SimScenario } from "@/lib/sim/types";
import {
  commitHypothesisToRun,
  commitRun,
  countCompletedRuns,
  loadRun,
  openCommitPhase,
  ownedInOrder,
  recordPurchase,
  startRun,
  toRunState,
} from "@/lib/simulations";
import { applySimulationRewards } from "@/lib/gamification";

export interface SimActionResult {
  ok: boolean;
  error?: string;
}

/**
 * Load a run, prove it belongs to the caller, and resolve its scenario.
 *
 * Same posture as `assertOwner` in `app/actions/practice.ts`: every mutation
 * re-derives ownership from the session rather than trusting an id from the
 * client.
 */
async function ownedRun(runId: string) {
  const user = await getSessionUser();
  if (!user) return null;

  const run = await loadRun(runId);
  if (!run || run.userId !== user.id) return null;

  const scenario = getScenario(run.scenarioSlug);
  if (!scenario) return null;

  return { user, run, scenario };
}

/**
 * Open a simulation from its library card.
 *
 * Guests get their own cap. `startAttempt` counts submitted attempts, so
 * without a separate count here a simulation would have been unlimited for
 * guests — the most expensive surface in the app to leave open.
 */
export async function startSimulation(questionId: string): Promise<void> {
  const user = await getOrCreateGuest();

  const question = await db.question.findUnique({
    where: { id: questionId },
    select: { id: true, externalId: true, type: true },
  });
  if (!question || question.type !== "simulation") redirect("/library");

  const slug = question.externalId;
  if (!slug || !getScenario(slug)) redirect("/library");

  if (user.isGuest) {
    const done = await countCompletedRuns(user.id);
    if (done >= guestConfig.simRunCap) redirect("/signup?wall=sim");
  }

  const runId = await startRun(user.id, question.id, slug);
  redirect(`/simulate/${runId}`);
}

/** Lock the opening hypothesis and open the investigation. */
export async function commitHypothesis(
  runId: string,
  suspects: string[],
  note: string,
): Promise<SimActionResult> {
  const owned = await ownedRun(runId);
  if (!owned) return { ok: false, error: "Not found" };

  if (!canAdvanceSimPhase(owned.run.phase as SimPhase, "investigate")) {
    // Re-opening after seeing the data would make the hypothesis score theatre.
    return { ok: false, error: "The hypothesis is already locked" };
  }

  const parsed = parseHypothesis(owned.scenario, suspects);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  await commitHypothesisToRun(runId, parsed.value, note);
  return { ok: true };
}

export interface PurchaseResult extends SimActionResult {
  /** Panels revealed by this pull, appended to the board. */
  reveals?: SimScenario["drilldowns"][number]["reveals"];
  daysSpent?: number;
  remaining?: number;
}

/**
 * Buy one data pull.
 *
 * The affordability and lock rules are re-checked here against the persisted
 * run, not taken from the client: a disabled card is a courtesy, and this is
 * the control. Only the purchased pull's panels are returned — the rest of the
 * board never crosses the wire.
 */
export async function buyDrilldown(
  runId: string,
  drilldownId: string,
): Promise<PurchaseResult> {
  const owned = await ownedRun(runId);
  if (!owned) return { ok: false, error: "Not found" };

  const { run, scenario } = owned;
  const state = toRunState(run);

  const decision = priceDrilldown(
    scenario,
    { phase: state.phase, daysSpent: state.daysSpent, owned: ownedInOrder(run.purchases) },
    drilldownId,
  );
  if (!decision.ok) return { ok: false, error: refusalMessage(decision.reason) };

  await recordPurchase(runId, drilldownId, decision.cost);

  const drilldown = scenario.drilldowns.find((d) => d.id === drilldownId);
  return {
    ok: true,
    reveals: drilldown?.reveals ?? [],
    daysSpent: decision.daysSpentAfter,
    remaining: decision.remaining,
  };
}

function refusalMessage(reason: string): string {
  switch (reason) {
    case "wrong_phase":
      return "That is not available in this phase";
    case "unknown_drilldown":
      return "No such analysis";
    case "already_owned":
      return "You already have that one";
    case "locked":
      return "Run the analysis it depends on first";
    case "insufficient_budget":
      return "Not enough analyst-days left for that";
    default:
      return "That request was refused";
  }
}

/** Stop investigating and move to the decision. */
export async function openDecision(runId: string): Promise<SimActionResult> {
  const owned = await ownedRun(runId);
  if (!owned) return { ok: false, error: "Not found" };

  if (!canAdvanceSimPhase(owned.run.phase as SimPhase, "commit")) {
    return { ok: false, error: "Not available yet" };
  }

  await openCommitPhase(runId);
  return { ok: true };
}

export interface CommitResult extends SimActionResult {
  reward?: {
    xpGained: number;
    leveledUp: boolean;
    level: number;
    streak: number;
    newAchievements: string[];
    overall: number;
    band: string;
  };
}

/**
 * Name the cause, commit the capacity, and run the quarters forward.
 *
 * The outcome and the score are computed server-side from the authored model
 * and persisted — the client never sees the causal model, and a later content
 * edit cannot rewrite this run's report.
 */
export async function commitDecision(
  runId: string,
  diagnosis: string[],
  allocation: { interventionId: string; sprints: number; rupees: number }[],
): Promise<CommitResult> {
  const owned = await ownedRun(runId);
  if (!owned) return { ok: false, error: "Not found" };

  const { run, scenario } = owned;
  if (run.phase !== "commit") return { ok: false, error: "Not available yet" };
  if (run.result) return { ok: true }; // already committed; the page shows the report

  const parsed = parseCommit(scenario, { diagnosis, allocation });
  if (!parsed.ok) return { ok: false, error: parsed.error };

  const state = toRunState(run);
  const outcome = runOutcome(scenario, parsed.value.allocation);
  const score = scoreSimulation({
    scenario,
    hypothesis: state.hypothesis,
    purchases: state.purchases,
    diagnosis: parsed.value.diagnosis,
    allocation: parsed.value.allocation,
    outcome,
  });

  await commitRun({
    runId,
    diagnosis: parsed.value.diagnosis,
    allocation: parsed.value.allocation,
    outcome,
    score,
  });

  const reward = await applySimulationRewards(owned.user.id, {
    overall: score.overall,
    diagnosisScore: score.scores.diagnosis,
    decisionScore: score.scores.decision,
    causeFound: score.causeFound,
    underPar: score.daysSpent <= score.daysPar,
  });

  return {
    ok: true,
    reward: {
      xpGained: reward.xpGained,
      leveledUp: reward.leveledUp,
      level: reward.level,
      streak: reward.streak,
      newAchievements: reward.newAchievements,
      overall: score.overall,
      band: score.band,
    },
  };
}
