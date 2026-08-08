/**
 * Run state and grading for the turnaround format.
 *
 * Kept apart from `./score.ts` for the same reason `lib/config/simulation.ts` is
 * kept apart from `./evaluation.ts`: two rubrics that cannot be mistaken for one
 * another is the point. A turnaround has no hypothesis, no investigation and no
 * diagnosis, so grading it through the war room's five dimensions would mean
 * writing zeros into four columns and calling it a score.
 *
 * Pure and DB-free. The server action does the persisting.
 */

import { clamp } from "@/lib/utils";
import { bandForSimScore } from "@/lib/config/simulation";
import { turnaroundFormat } from "./formats/turnaround";
import { weightedOverallFor } from "./formats/types";
import { bestScheduleFor, finalValue, pathsForSchedule } from "./outcome";
import { fundingFor } from "./outcome";
import type { SimSchedule } from "./outcome";
import type { FeedbackItem } from "@/lib/types";
import type { SimScenario } from "./types";

/** What `SimRun.stateJson` holds for this format. */
export interface TurnaroundState {
  /** Committed allocations, index = the period they were decided in. */
  schedule: SimSchedule;
}

export function parseTurnaroundState(json: string | null): TurnaroundState {
  if (!json) return { schedule: [] };
  try {
    const parsed = JSON.parse(json) as Partial<TurnaroundState>;
    return { schedule: Array.isArray(parsed.schedule) ? parsed.schedule : [] };
  } catch {
    return { schedule: [] };
  }
}

export function decisionPeriodsFor(scenario: SimScenario): number {
  return scenario.decisionPeriods ?? scenario.horizonQuarters;
}

/** Which period is open for allocation, or null once they are all spent. */
export function openPeriod(scenario: SimScenario, state: TurnaroundState): number | null {
  const periods = decisionPeriodsFor(scenario);
  return state.schedule.length >= periods ? null : state.schedule.length;
}

/** Interventions aimed at a cause the scenario says is genuinely driving this. */
function addressesTrueCause(scenario: SimScenario, interventionId: string): boolean {
  const iv = scenario.interventions.find((i) => i.id === interventionId);
  return !!iv && scenario.trueCauseIds.includes(iv.addresses);
}

export interface TurnaroundScore {
  scores: Record<string, number>;
  overall: number;
  band: string;
  /** Did the company end the horizon with money in the bank? */
  solvent: boolean;
  periodsPlayed: number;
  feedback: FeedbackItem[];
}

/**
 * Grade a finished sequence.
 *
 * The three process dimensions are PROXIES and are documented as such rather
 * than dressed up — there is no way to read intent off an allocation. What they
 * measure is deliberately narrow and checkable:
 *
 *   - **Read**: what share of committed capacity went to a cause that was really
 *     driving the outcome, scaled by HOW EARLY it was committed. Nothing is
 *     hidden in this format — everything needed to decide is on screen before
 *     the first quarter — so arriving at the right answer in the last period is
 *     a late read, not a good one. Without the timeliness factor, funding both
 *     correct levers in the final quarter scored a perfect 100 while the company
 *     went bankrupt.
 *   - **Adaptation**: whether capacity went to a false cause *after* the first
 *     period, i.e. after a quarter's results had already shown what the levers
 *     were doing. Making the wrong call once is a judgement; repeating it with
 *     the evidence in front of you is the thing this format exists to catch.
 *   - **Patience**: whether funding actually shipped. Capacity below an
 *     intervention's `minSprints` is spent and produces nothing, and spreading
 *     it thinly across the board is the classic way to fund four things and
 *     finish none.
 */
export function scoreTurnaround(args: {
  scenario: SimScenario;
  schedule: SimSchedule;
}): TurnaroundScore {
  const { scenario, schedule } = args;

  const mine = pathsForSchedule(scenario, schedule);
  const idle = pathsForSchedule(scenario, []);
  const best = pathsForSchedule(scenario, bestScheduleFor(scenario));

  const north = scenario.northStar;
  const mineEnd = finalValue(mine, north);
  const idleEnd = finalValue(idle, north);
  const bestEnd = finalValue(best, north);

  // Normalised against what was achievable FROM HERE rather than an absolute,
  // so a run is graded on this scenario's ceiling — same principle as the war
  // room's outcome dimension.
  //
  // Doing nothing scores 25 rather than 0, deliberately. With the floor at
  // zero, holding the capacity and funding both value-destroying traps scored
  // *identically*, because anything at or below the do-nothing line clamped to
  // the same number. Leaving room underneath is what lets the model say that
  // actively making it worse is worse than inaction.
  const span = bestEnd - idleEnd;
  const relative = span <= 0 ? 1 : (mineEnd - idleEnd) / span;
  let outcome = clamp(Math.round(25 + 75 * relative), 0, 100);

  const cashPath = mine.cash;
  const cashEnd = cashPath ? finalValue(mine, "cash") : 1;
  const solvent = cashEnd > 0;

  // Running out of money is not a middling result, whatever the process looked
  // like on the way there. Capped rather than zeroed: a run that got most of the
  // way and still died is meaningfully better than one that never tried.
  if (!solvent) outcome = Math.min(outcome, 40);

  // ── Read ────────────────────────────────────────────────────────────────
  let onTargetWeight = 0;
  let totalWeight = 0;
  schedule.forEach((lines, period) => {
    const weight = period === 0 ? 2 : 1;
    for (const line of lines) {
      const capacity = line.sprints + line.rupees / Math.max(1, scenario.budget.rupees);
      if (capacity <= 0) continue;
      totalWeight += capacity * weight;
      if (addressesTrueCause(scenario, line.interventionId)) {
        onTargetWeight += capacity * weight;
      }
    }
  });
  // Committing nothing at all is not a reading of anything.
  const onTargetShare = totalWeight === 0 ? 0 : onTargetWeight / totalWeight;

  // …and neither is arriving at the right answer in the last quarter. Everything
  // needed to get this right is on screen before the first decision, so a run
  // that acts only at the end read the situation late even if it read it
  // correctly. Without this, funding the two correct levers in the final period
  // scored a perfect 100 here while the company went bankrupt.
  let capacityWeightedPeriod = 0;
  let capacityTotal = 0;
  schedule.forEach((lines, period) => {
    for (const line of lines) {
      const capacity = line.sprints + line.rupees / Math.max(1, scenario.budget.rupees);
      if (capacity <= 0) continue;
      capacityWeightedPeriod += capacity * period;
      capacityTotal += capacity;
    }
  });
  const meanPeriod = capacityTotal === 0 ? 0 : capacityWeightedPeriod / capacityTotal;
  const timeliness = clamp(1 - 0.15 * meanPeriod, 0.4, 1);

  const read = Math.round(100 * onTargetShare * timeliness);

  // ── Adaptation ──────────────────────────────────────────────────────────
  let lateMistakes = 0;
  schedule.forEach((lines, period) => {
    if (period === 0) return;
    for (const line of lines) {
      if (!addressesTrueCause(scenario, line.interventionId)) lateMistakes += 1;
    }
  });
  const adaptation = clamp(100 - lateMistakes * 35, 0, 100);

  // ── Patience ────────────────────────────────────────────────────────────
  const { stalled } = fundingFor(scenario, schedule.flat());
  const busiestPeriod = Math.max(0, ...schedule.map((lines) => lines.length));
  const patience = clamp(100 - stalled.length * 30 - Math.max(0, busiestPeriod - 2) * 20, 0, 100);

  const scores: Record<string, number> = { read, adaptation, patience, outcome };
  const overall = weightedOverallFor(turnaroundFormat, scores);

  const feedback: FeedbackItem[] = [];
  feedback.push(
    solvent
      ? { tone: "positive", text: "The company still had money in the bank at the end of the horizon." }
      : { tone: "warning", text: "The company ran out of cash before the horizon closed." },
  );
  if (onTargetShare >= 0.7 && timeliness >= 0.8) {
    feedback.push({ tone: "positive", text: "Most of the capacity you committed went to something that was genuinely driving the outcome." });
  } else if (onTargetShare >= 0.7) {
    feedback.push({ tone: "warning", text: "You funded the right things, but late — everything you needed to decide was on screen before the first quarter." });
  } else if (totalWeight > 0) {
    feedback.push({ tone: "warning", text: "Much of your capacity went to levers that were not driving the outcome — the cost lines look like decisions because they are the ones you can move alone." });
  } else {
    feedback.push({ tone: "warning", text: "You committed nothing. Holding capacity is a decision, and drift is not free." });
  }
  if (lateMistakes > 0) {
    feedback.push({ tone: "warning", text: `You funded a lever aimed at the wrong cause ${lateMistakes} time(s) after the first quarter, with the previous quarter's numbers already in front of you.` });
  }
  if (stalled.length) {
    feedback.push({ tone: "warning", text: `${stalled.length} intervention(s) were funded below the point at which anything ships — the money went and nothing was delivered.` });
  }

  return {
    scores,
    overall,
    band: bandForSimScore(overall),
    solvent,
    periodsPlayed: schedule.length,
    feedback,
  };
}
