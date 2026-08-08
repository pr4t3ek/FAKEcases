"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getOrCreateGuest, getSessionUser } from "@/lib/auth";
import { canOpen, tierFor, wallRedirect } from "@/lib/entitlements";
import { canAdvanceSimPhase, hypothesisEditFor, type SimPhase } from "@/lib/types";
import { loadScenario, scenarioExists } from "@/lib/scenario-store";
import { priceDrilldown } from "@/lib/sim/investigate";
import { runOutcome, runSchedule } from "@/lib/sim/outcome";
import { formatFor, isTurnaround } from "@/lib/sim/formats/registry";
import {
  decisionPeriodsFor,
  openPeriod,
  parseTurnaroundState,
  scoreTurnaround,
} from "@/lib/sim/turnaround";
import { scoreSimulation } from "@/lib/sim/score";
import { parseAllocation, parseDiagnosis, parseHypothesis } from "@/lib/sim/payload";
import type { SimScenario } from "@/lib/sim/types";
import {
  commitDiagnosisToRun,
  commitHypothesisToRun,
  commitRun,
  commitTurnaroundPeriod,
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
  if (!question || question.type !== "simulation") redirect("/simulations");

  // Existence only — an override can retune a scenario but never introduce one,
  // so there is nothing here the authored registry cannot answer.
  const slug = question.externalId;
  if (!slug || !scenarioExists(slug)) redirect("/simulations");

  // Resume before gating, matching `startAttempt`: a run already under way has
  // spent analyst-days that a refusal would strand.
  const resumable = await findResumableRun(user.id, question.id);
  if (resumable) redirect(`/simulate/${resumable}`);

  if (!canOpen(tierFor(user), question)) redirect(wallRedirect("simulation"));

  // The first phase is the format's, not a constant: a turnaround opens on its
  // briefing, a war room on Observe.
  const scenario = await loadScenario(slug);
  const runId = await startRun(
    user.id,
    question.id,
    slug,
    scenario ? formatFor(scenario).phases[0].id : "observe",
  );
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

/**
 * Name the cause, and narrow the board to the fixes that treat it.
 *
 * Its own step, and irreversible. Until this runs the client has been sent no
 * interventions at all; afterwards it is sent only the ones addressing what was
 * named. Persisting first and refusing to rewrite is what stops the slate being
 * used as an oracle — a run that could re-name freely would learn that the true
 * cause is the one with three fixes behind it and the decoys have one.
 *
 * Returns nothing but `ok`. The permitted slate arrives through the ordinary
 * page render, so there is no second serialisation path to keep honest.
 */
export async function lockDiagnosis(
  runId: string,
  causeIds: string[],
): Promise<SimActionResult> {
  const owned = await ownedRun(runId);
  if (!owned) return { ok: false, error: "Not found" };

  if (owned.run.phase !== "commit") return { ok: false, error: "Not available yet" };
  // Idempotent rather than an error: a double submit, or a retry after a dropped
  // response, should land on the decision screen rather than on a failure.
  if (owned.run.diagnosis) return { ok: true };

  const parsed = parseDiagnosis(owned.scenario, causeIds);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  await commitDiagnosisToRun(runId, parsed.value);
  return { ok: true };
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
  allocation: { interventionId: string; sprints: number; rupees: number }[],
): Promise<CommitResult> {
  const owned = await ownedRun(runId);
  if (!owned) return { ok: false, error: "Not found" };

  const { run, scenario } = owned;
  if (run.phase !== "commit") return { ok: false, error: "Not available yet" };
  if (run.result) return { ok: true }; // already committed; the page shows the report

  // The diagnosis comes off the run, never off the request. `lockDiagnosis`
  // wrote it before any intervention was shown, so the allocation is checked
  // against the same slate the student was actually offered.
  const state = toRunState(run);
  if (!state.diagnosis.length) {
    return { ok: false, error: "Name the cause first" };
  }

  const parsed = parseAllocation(scenario, state.diagnosis, allocation);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  const outcome = runOutcome(scenario, parsed.value);
  const score = scoreSimulation({
    scenario,
    hypothesis: state.hypothesis,
    purchases: state.purchases,
    diagnosis: state.diagnosis,
    allocation: parsed.value,
    outcome,
  });

  await commitRun({
    runId,
    allocation: parsed.value,
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

// ─── Turnaround format ─────────────────────────────────────────────────────

/**
 * Commit one period's capacity and run the quarter.
 *
 * Same posture as `commitDecision`: the allocation is re-validated server-side
 * against the budget rather than trusted, and the period being written is
 * derived from stored state rather than taken from the request — otherwise a
 * replayed call could overwrite an earlier quarter after seeing its result,
 * which is the one thing this format must not allow.
 */
export async function commitPeriod(
  runId: string,
  allocation: { interventionId: string; sprints: number; rupees: number }[],
): Promise<SimActionResult> {
  const owned = await ownedRun(runId);
  if (!owned) return { ok: false, error: "Not found" };

  const { run, scenario } = owned;
  if (!isTurnaround(scenario)) return { ok: false, error: "Not a turnaround" };
  if (run.result) return { ok: true }; // already finished; the page shows the report

  const state = parseTurnaroundState(run.stateJson);
  const period = openPeriod(scenario, state);
  if (period === null) return { ok: false, error: "Every period has been decided" };

  const known = new Set(scenario.interventions.map((i) => i.id));
  const lines = allocation.filter(
    (l) => known.has(l.interventionId) && (l.sprints > 0 || l.rupees > 0),
  );
  for (const line of lines) {
    if (line.sprints < 0 || line.rupees < 0) return { ok: false, error: "Capacity cannot be negative" };
  }
  const sprints = lines.reduce((s, l) => s + l.sprints, 0);
  const rupees = lines.reduce((s, l) => s + l.rupees, 0);
  if (sprints > scenario.budget.sprints) return { ok: false, error: "That is more sprints than you have this quarter" };
  if (rupees > scenario.budget.rupees) return { ok: false, error: "That is more money than you have this quarter" };

  const schedule = [...state.schedule, lines];
  const finished = schedule.length >= decisionPeriodsFor(scenario);

  if (!finished) {
    await commitTurnaroundPeriod({ runId, schedule, finished: false, formatSlug: "turnaround" });
    return { ok: true };
  }

  const score = scoreTurnaround({ scenario, schedule });
  const outcome = runSchedule(scenario, schedule);
  await commitTurnaroundPeriod({
    runId,
    schedule,
    finished: true,
    score,
    outcome,
    formatSlug: "turnaround",
  });

  // Ranked like any other question. Effort is periods played rather than
  // analyst-days — a turnaround spends none, and writing a zero there would sort
  // every turnaround run to the top of a board that breaks ties on effort.
  await recordFirstResult({
    userId: owned.user.id,
    questionId: run.questionId,
    kind: "simulation",
    score: score.overall,
    effort: score.periodsPlayed,
    sourceId: runId,
  });

  await applySimulationRewards(owned.user.id, {
    overall: score.overall,
    // The nearest honest mapping: this format has no diagnosis or decision
    // dimension, so the two that drive the reward read from what it does have.
    diagnosisScore: score.scores.read ?? 0,
    decisionScore: score.scores.adaptation ?? 0,
    causeFound: score.solvent,
    underPar: score.overall >= 70,
  });

  return { ok: true };
}

/** Move a turnaround off its briefing and into the first quarter. */
export async function beginTurnaround(runId: string): Promise<SimActionResult> {
  const owned = await ownedRun(runId);
  if (!owned) return { ok: false, error: "Not found" };
  if (!isTurnaround(owned.scenario)) return { ok: false, error: "Not a turnaround" };
  if (owned.run.phase !== "brief") return { ok: true };

  await db.simRun.update({ where: { id: runId }, data: { phase: "period" } });
  return { ok: true };
}
