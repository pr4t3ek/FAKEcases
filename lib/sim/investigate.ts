/**
 * Buying data, and what the candidate can see once they have.
 *
 * The analyst-day budget is the whole exercise. Investigation is only a skill
 * when it is scarce: given unlimited pulls, everyone clicks everything and the
 * simulation measures patience rather than thinking. So a scenario prices every
 * cut far above what the budget can cover, and the candidate has to decide what
 * their hypothesis actually predicts before spending.
 *
 * Named `investigate` rather than `budget` so it doesn't read as a sibling of
 * `lib/llm/budget.ts`, which guards LLM spend.
 *
 * Pure: the decision is computed here, the server action applies it.
 */

import type { SimPhase } from "@/lib/types";
import type {
  DrilldownId,
  PurchaseDecision,
  SimDrilldown,
  SimPanel,
  SimScenario,
} from "./types";

export function drilldownById(
  scenario: SimScenario,
  id: DrilldownId,
): SimDrilldown | undefined {
  return scenario.drilldowns.find((d) => d.id === id);
}

export function remainingDays(scenario: SimScenario, daysSpent: number): number {
  return Math.max(0, scenario.budget.analystDays - daysSpent);
}

/**
 * Can this pull be bought right now, and at what price?
 *
 * Every refusal is a distinct reason so the UI can say why rather than just
 * greying a card out. The server calls this again before writing — a disabled
 * button is a courtesy, not a control.
 *
 * **The board is open.** Four gates and none of them is the hypothesis, and
 * none of them is a prerequisite pull either: `dependsOn` used to refuse a
 * purchase until its parent was owned, and that lock is gone. In a real war
 * room you can ask an analyst any question you like — what stops you is time,
 * and time is `analystDays`, which is already the constraint this whole phase
 * is built on. A candidate who spends three days on the deep cut before the
 * cheap one has made a decision, quite possibly a bad one, and that decision is
 * the exercise. A padlock replaced it with an instruction.
 */
export function priceDrilldown(
  scenario: SimScenario,
  run: { phase: SimPhase; daysSpent: number; owned: DrilldownId[] },
  drilldownId: DrilldownId,
): PurchaseDecision {
  if (run.phase !== "investigate") return { ok: false, reason: "wrong_phase" };

  const drilldown = drilldownById(scenario, drilldownId);
  if (!drilldown) return { ok: false, reason: "unknown_drilldown" };
  if (run.owned.includes(drilldownId)) return { ok: false, reason: "already_owned" };

  const remaining = remainingDays(scenario, run.daysSpent);
  if (drilldown.cost > remaining) return { ok: false, reason: "insufficient_budget" };

  const daysSpentAfter = run.daysSpent + drilldown.cost;
  return {
    ok: true,
    cost: drilldown.cost,
    daysSpentAfter,
    remaining: remainingDays(scenario, daysSpentAfter),
  };
}

/**
 * The dashboard as it currently stands: the base panels plus everything bought,
 * in purchase order so the board reads as a narrative of the investigation.
 *
 * Unknown ids are skipped rather than throwing — a run persisted against an
 * older version of a scenario should still render.
 */
export function visibleDashboard(
  scenario: SimScenario,
  ownedInOrder: DrilldownId[],
): SimPanel[] {
  const panels: SimPanel[] = [...scenario.dashboard];
  for (const id of ownedInOrder) {
    const drilldown = drilldownById(scenario, id);
    if (drilldown) panels.push(...drilldown.reveals);
  }
  return panels;
}

/** Analyst-days the scenario's par investigation would have cost. */
export function parCost(scenario: SimScenario): number {
  return scenario.parInvestigation.reduce((sum, id) => {
    return sum + (drilldownById(scenario, id)?.cost ?? 0);
  }, 0);
}

/** Whether a pull is evidence for any of the given causes. */
export function isEvidenceFor(drilldown: SimDrilldown, causeIds: string[]): boolean {
  return drilldown.evidenceFor.some((c) => causeIds.includes(c));
}
