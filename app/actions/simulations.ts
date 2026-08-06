"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getOrCreateGuest, getSessionUser } from "@/lib/auth";
import { canOpen, tierFor, wallRedirect } from "@/lib/entitlements";
import { canAdvanceSimPhase, hypothesisEditFor, type SimPhase } from "@/lib/types";
import { loadScenario, scenarioExists } from "@/lib/scenario-store";
import { priceDrilldown } from "@/lib/sim/investigate";
import { runOutcome } from "@/lib/sim/outcome";
import { scoreSimulation } from "@/lib/sim/score";
import { parseCommit, parseHypothesis } from "@/lib/sim/payload";
import type { SimScenario } from "@/lib/sim/types";
import {
  commitHypothesisToRun,
  commitRun,
  findResumableRun,
  loadRun,
  openCommitPhase,
  ownedInOrder,
  recordPurchase,
  startRun,
  toRunState,
} from "@/lib/simulations";
import { applySimulationRewards } from "@/lib/gamification";
import { recordFirstResult } from "@/lib/leaderboard";

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

  const scenario = await loadScenario(run.scenarioSlug);
  if (!scenario) return null;

  return { user, run, scenario };
}

/**
 * Open a simulation from its library card.
 *
 * The same tier gate as `startAttempt`, reading the same `freeTier` flag — a
 * simulation is the most expensive surface in the app, so it must not be the one
 * that quietly stays open.
 */
export async function startSimulation(questionId: string): Promise<void> {
  const user = await getOrCreateGuest();

  const question = await db.question.findUnique({
    where: { id: questionId },
    select: { id: true, externalId: true, type: true, freeTier: true },
  });
  if (!question || question.type !== "simulation") redirect("/library");

  // Existence only — an override can retune a scenario but never introduce one,
  // so there is nothing here the authored registry cannot answer.
  const slug = question.externalId;
  if (!slug || !scenarioExists(slug)) redirect("/library");

  // Resume before gating, matching `startAttempt`: a run already under way has
  // spent analyst-days that a refusal would strand.
  const resumable = await findResumableRun(user.id, question.id);
  if (resumable) redirect(`/simulate/${resumable}`);

  if (!canOpen(tierFor(user), question)) redirect(wallRedirect());

  const runId = await startRun(user.id, question.id, slug);
  redirect(`/simulate/${runId}`);
}

/**
 * Set the opening hypothesis — first time, or a change of mind before any data
 * has been bought.
 *
 * `hypothesisEditFor` is the rule: freely changeable until it has cost you
 * something, final afterwards. Re-opening it after seeing evidence would make
 * the hypothesis score theatre, which is why the window closes at the first
 * purchase rather than at the phase boundary.
 */
export async function commitHypothesis(
  runId: string,
  suspects: string[],
  note: string,
): Promise<SimActionResult> {
  const owned = await ownedRun(runId);
  if (!owned) return { ok: false, error: "Not found" };

  const edit = hypothesisEditFor(owned.run.phase as SimPhase, owned.run.purchases.length);
  if (edit === "locked") {
    return { ok: false, error: "You've started pulling data, so the hypothesis is locked" };
  }

  const parsed = parseHypothesis(owned.scenario, suspects);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  // Writing `phase: "investigate"` is a no-op when amending, since that is
  // already the phase — so one path serves both.
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

  // Ranked only if this is their first run of this scenario. Effort is
  // analyst-days rather than wall-clock: a war room is judged on how cheaply it
  // was investigated, not on how long the tab was open.
  await recordFirstResult({
    userId: owned.user.id,
    questionId: owned.run.questionId,
    kind: "simulation",
    score: score.overall,
    effort: score.daysSpent,
    sourceId: runId,
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
