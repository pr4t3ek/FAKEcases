/**
 * Derived views for the debrief.
 *
 * Everything here reveals authored truth — what each pull was really saying,
 * which interventions were on target, what the best allocation would have been —
 * so it must only ever be called once a run has committed and reached the
 * debrief phase. It is the counterpart to `./redact.ts`, not a sibling of it.
 *
 * Pure: no DB, no formatting. Rupee and percentage rendering belongs at the UI
 * edge, where `formatINR` and `toIndianWords` already live.
 */

import { totalsByIntervention } from "./outcome";
import { drilldownById, isEvidenceFor } from "./investigate";
import type {
  DriverId,
  SimAllocationLine,
  SimOutcomeResult,
  SimPurchaseRecord,
  SimScenario,
} from "./types";

export interface OutcomeRow {
  driver: DriverId;
  label: string;
  unit: string;
  goodDirection: "up" | "down";
  /** Today's value — index 0 of every path, so shared across all three. */
  baseline: number;
  /** End of horizon under this run's allocation. */
  actual: number;
  /** End of horizon having funded nothing. */
  doNothing: number;
  /** End of horizon under the scenario's best allocation. */
  best: number;
  /** Fractional change from baseline to `actual`. */
  changePct: number;
}

/** The north star first, then the scenario's other reported metrics. */
export function outcomeRows(
  scenario: SimScenario,
  outcome: SimOutcomeResult,
): OutcomeRow[] {
  const ids = [scenario.northStar, ...scenario.reported.filter((d) => d !== scenario.northStar)];

  return ids.flatMap((id) => {
    const driver = scenario.drivers.find((d) => d.id === id);
    const path = outcome.paths[id];
    if (!driver || !path?.length) return [];

    const baseline = path[0];
    const actual = path[path.length - 1];
    const doNothingPath = outcome.doNothing[id] ?? [];
    const bestPath = outcome.best[id] ?? [];

    return [
      {
        driver: id,
        label: driver.label,
        unit: driver.unit,
        goodDirection: driver.goodDirection,
        baseline,
        actual,
        doNothing: doNothingPath[doNothingPath.length - 1] ?? baseline,
        best: bestPath[bestPath.length - 1] ?? baseline,
        changePct: baseline === 0 ? 0 : (actual - baseline) / Math.abs(baseline),
      },
    ];
  });
}

export interface AllocationComparisonRow {
  interventionId: string;
  label: string;
  /** What the debrief says about funding this one. */
  note: string;
  onTarget: boolean;
  yours: { sprints: number; rupees: number } | null;
  best: { sprints: number; rupees: number } | null;
  /** Funded below `minSprints`: paid for, never shipped. */
  stalled: boolean;
}

/**
 * Your capacity against the best use of it, one row per intervention that either
 * side funded. Interventions nobody funded are left out — the comparison is
 * about the choices made, not a catalogue.
 */
export function allocationComparison(
  scenario: SimScenario,
  allocation: SimAllocationLine[],
  outcome: SimOutcomeResult,
): AllocationComparisonRow[] {
  const mine = totalsByIntervention(allocation);
  const best = totalsByIntervention(scenario.bestAllocation);

  return scenario.interventions
    .filter((iv) => mine.has(iv.id) || best.has(iv.id))
    .map((iv) => ({
      interventionId: iv.id,
      label: iv.label,
      note: iv.debrief,
      onTarget: scenario.trueCauseIds.includes(iv.addresses),
      yours: mine.get(iv.id) ?? null,
      best: best.get(iv.id) ?? null,
      stalled: outcome.stalled.includes(iv.id),
    }));
}

export interface TrailStep {
  drilldownId: string;
  label: string;
  cost: number;
  seq: number;
  /** What a strong PM takes from this cut. */
  readsAs: string;
  /** Whether it bore on a cause that was actually driving the metric. */
  onTrail: boolean;
}

/** The investigation, in the order it happened, with what each pull was saying. */
export function investigationTrail(
  scenario: SimScenario,
  purchases: SimPurchaseRecord[],
): TrailStep[] {
  return [...purchases]
    .sort((a, b) => a.seq - b.seq)
    .flatMap((p) => {
      const d = drilldownById(scenario, p.drilldownId);
      if (!d) return [];
      return [
        {
          drilldownId: d.id,
          label: d.label,
          cost: p.cost,
          seq: p.seq,
          readsAs: d.readsAs,
          onTrail: isEvidenceFor(d, scenario.trueCauseIds),
        },
      ];
    });
}

/** Pulls that would have cracked it and were never bought. */
export function missedEvidence(
  scenario: SimScenario,
  purchases: SimPurchaseRecord[],
): TrailStep[] {
  const bought = new Set(purchases.map((p) => p.drilldownId));
  return scenario.drilldowns
    .filter((d) => !bought.has(d.id) && isEvidenceFor(d, scenario.trueCauseIds))
    .map((d, i) => ({
      drilldownId: d.id,
      label: d.label,
      cost: d.cost,
      seq: i + 1,
      readsAs: d.readsAs,
      onTrail: true,
    }));
}

/** Cause labels for the ones that were actually driving it. */
export function trueCauseLabels(scenario: SimScenario): string[] {
  return scenario.trueCauseIds.flatMap((id) => {
    const cause = scenario.causes.find((c) => c.id === id);
    return cause ? [cause.label] : [];
  });
}

/**
 * Authored bullets, flattened into the one string a text surface can take.
 *
 * `strongAnswer` and every `coachFallback` answer are arrays now, and two
 * consumers still want a string: the LLM prompt blocks, and `sampleSolution` /
 * `dataPack`, whose contract is shared with ordinary practice questions and is
 * not worth forking for this.
 *
 * A leading "- " rather than a joined paragraph, because the chat bubble is
 * `whitespace-pre-wrap` over plain text (see `AssistantText`, which is
 * deliberately not a markdown renderer). A hyphen and a newline is what a
 * bullet *is* in that surface — so the same authored array reads as a list in
 * the report, in the mock's offline reply, and in what a real model is shown.
 */
export function asBulletText(lines: string[]): string {
  return lines.map((line) => `- ${line}`).join("\n");
}
