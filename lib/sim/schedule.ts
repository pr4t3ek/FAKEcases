/**
 * Committing capacity over several periods rather than all at once.
 *
 * A one-shot war room is a pure optimisation puzzle: everything you can know is
 * on the board before you decide, so there is nothing to react to and no reason
 * to hold anything back. Splitting the decision is what turns it into a
 * judgement — you commit under uncertainty, watch a quarter happen, and decide
 * again knowing something you did not know before.
 *
 * The budget model is the whole design, and the two currencies behave
 * differently on purpose:
 *
 *   - **Money is a pool.** One rupee budget spent across every period. Holding
 *     it back is a real option — you may be wrong, and a quarter's results are
 *     worth more than a quarter's head start — and so is committing early,
 *     because a fix funded in period 1 has three quarters to ramp and one
 *     funded in period 3 has one.
 *   - **Capacity is a rate.** People-weeks refresh every period and cannot be
 *     saved up, because a team is a flow and not a stock. Not spending this
 *     quarter's engineers does not give you more of them next quarter; it gives
 *     you fewer, in the only sense that matters.
 *
 * That asymmetry is what makes the schedule interesting. If both pooled, the
 * optimum would be to wait and see; if both refreshed, there would be nothing
 * to husband and every period would be independent.
 */

import type { SimAllocationLine, SimScenario } from "./types";
import type { SimSchedule } from "./outcome";

/** How many times a scenario lets you commit. One is the degenerate war room. */
export function decisionPeriodsIn(scenario: SimScenario): number {
  return scenario.decisionPeriods ?? 1;
}

/** The period open for allocation, or null once they have all been spent. */
export function openPeriodIn(scenario: SimScenario, schedule: SimSchedule): number | null {
  const periods = decisionPeriodsIn(scenario);
  return schedule.length >= periods ? null : schedule.length;
}

function sumMoney(lines: SimAllocationLine[]): number {
  return lines.reduce((total, line) => total + line.rupees, 0);
}

function sumCapacity(lines: SimAllocationLine[]): number {
  return lines.reduce((total, line) => total + line.sprints, 0);
}

/** Rupees left in the pool after everything committed so far. */
export function moneyRemaining(scenario: SimScenario, schedule: SimSchedule): number {
  return scenario.budget.rupees - sumMoney(schedule.flat());
}

/** People-weeks left in the period being decided. Refreshes every period. */
export function capacityRemaining(
  scenario: SimScenario,
  periodLines: SimAllocationLine[],
): number {
  return scenario.budget.sprints - sumCapacity(periodLines);
}

export interface ScheduleFit {
  ok: boolean;
  /** Which rule was broken, in the words the refusal should use. */
  error?: string;
}

/**
 * Whether a schedule is affordable, checked the way the two currencies work.
 *
 * Called on the whole schedule rather than on the period being added, because
 * the money rule is a statement about the total and a per-period check cannot
 * see it. The capacity rule is per period by definition.
 */
export function scheduleFits(scenario: SimScenario, schedule: SimSchedule): ScheduleFit {
  const spent = sumMoney(schedule.flat());
  if (spent > scenario.budget.rupees + 1e-6) {
    return {
      ok: false,
      error: "That spends more than the budget has left — the money is one pool for the whole run",
    };
  }

  for (let period = 0; period < schedule.length; period++) {
    const used = sumCapacity(schedule[period] ?? []);
    if (used > scenario.budget.sprints) {
      return {
        ok: false,
        error: `That commits ${used} people-weeks in one period against ${scenario.budget.sprints} available — capacity refreshes each period and cannot be saved up`,
      };
    }
  }

  if (schedule.length > decisionPeriodsIn(scenario)) {
    return { ok: false, error: "Every period has already been decided" };
  }

  return { ok: true };
}

/**
 * The mean period capacity arrived in, weighted by how much arrived.
 *
 * Lifted from `scoreTurnaround`, which needed exactly this and computed it
 * inline. Shared rather than copied because the two formats must agree about
 * what "committed early" means — a run scored as timely on one and late on the
 * other would be two rubrics wearing one word.
 *
 * Money is normalised against the budget so a rupee-heavy and a people-heavy
 * commitment weigh comparably; without it, a scenario denominated in crore
 * would swamp its own capacity term.
 */
export function meanCommitPeriod(scenario: SimScenario, schedule: SimSchedule): number {
  let weighted = 0;
  let total = 0;

  schedule.forEach((lines, period) => {
    for (const line of lines) {
      const weight =
        line.sprints + line.rupees / Math.max(1, scenario.budget.rupees);
      if (weight <= 0) continue;
      weighted += weight * period;
      total += weight;
    }
  });

  return total === 0 ? 0 : weighted / total;
}

/** What a war room's `SimRun.stateJson` holds while it is played over periods. */
export interface PeriodicState {
  /** Committed allocations, index = the period they were decided in. */
  schedule: SimSchedule;
}

export function parsePeriodicState(json: string | null): PeriodicState {
  if (!json) return { schedule: [] };
  try {
    const parsed = JSON.parse(json) as { periodic?: Partial<PeriodicState> };
    const schedule = parsed?.periodic?.schedule;
    return { schedule: Array.isArray(schedule) ? (schedule as SimSchedule) : [] };
  } catch {
    return { schedule: [] };
  }
}

/**
 * The schedule written back into the state blob, preserving whatever else is
 * there — the hypothesis revision log lives in the same column.
 */
export function withPeriodicState(existing: string | null, state: PeriodicState): string {
  let base: Record<string, unknown> = {};
  if (existing) {
    try {
      const parsed = JSON.parse(existing);
      if (parsed && typeof parsed === "object") base = parsed as Record<string, unknown>;
    } catch {
      // Unreadable state cannot be preserved. Losing it beats refusing the
      // write and stranding a run mid-schedule.
    }
  }
  return JSON.stringify({ ...base, periodic: state });
}
