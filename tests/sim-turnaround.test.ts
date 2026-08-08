/**
 * The turnaround format's content guarantees.
 *
 * `tests/sim-scenario.test.ts` skips six checks for this format because they
 * describe the war room's exercise — a priced drilldown board, a par
 * investigation, one best allocation with no spare capacity. This file carries
 * the equivalents, and one thing the war room never needed: proof that the
 * authored `bestSchedule` really is the best SEQUENCE, not merely a good one.
 *
 * That proof is why this file exists. An authored ceiling that isn't a ceiling
 * makes the outcome score uninterpretable — a student can beat it — and the
 * failure is invisible to inspection, because the winner depends on stocks,
 * lagged feedback and ramps interacting over six periods.
 */

import { describe, expect, it } from "vitest";
import { listScenarios } from "@/lib/sim/registry";
import { validateScenario } from "@/lib/sim/validate";
import { formatFor, isTurnaround } from "@/lib/sim/formats/registry";
import { turnaroundFormat } from "@/lib/sim/formats/turnaround";
import { canAdvanceIn, weightedOverallFor } from "@/lib/sim/formats/types";
import { bestScheduleFor, finalValue, pathsForSchedule, runSchedule } from "@/lib/sim/outcome";
import { resolveDrivers } from "@/lib/sim/drivers";
import type { SimAllocationLine, SimScenario } from "@/lib/sim/types";

const turnarounds = listScenarios().filter(isTurnaround);

describe("the turnaround format", () => {
  it("is registered and reachable", () => {
    expect(formatFor({ format: "turnaround" }).slug).toBe("turnaround");
  });

  it("defaults an unmarked scenario to the war room, so the twelve stay unchanged", () => {
    expect(formatFor({ format: undefined }).slug).toBe("war-room");
  });

  it("shares no rubric key with the war room — which is why scoresJson exists", () => {
    const warRoomKeys = new Set(formatFor({ format: "war-room" }).rubric.map((d) => d.key));
    const shared = turnaroundFormat.rubric.map((d) => d.key).filter((k) => warRoomKeys.has(k));
    expect(shared).toEqual(["outcome"]);
  });

  it("advances one phase at a time and never backwards", () => {
    expect(canAdvanceIn(turnaroundFormat, "brief", "period")).toBe(true);
    expect(canAdvanceIn(turnaroundFormat, "period", "debrief")).toBe(true);
    expect(canAdvanceIn(turnaroundFormat, "brief", "debrief")).toBe(false);
    expect(canAdvanceIn(turnaroundFormat, "debrief", "period")).toBe(false);
  });

  it("weights its own dimensions", () => {
    const perfect = Object.fromEntries(turnaroundFormat.rubric.map((d) => [d.key, 100]));
    expect(weightedOverallFor(turnaroundFormat, perfect)).toBe(100);
    expect(weightedOverallFor(turnaroundFormat, {})).toBe(0);
  });

  it("has at least one scenario, or none of the above is reachable", () => {
    expect(turnarounds.length).toBeGreaterThan(0);
  });
});

/** Every affordable sequence, funding each intervention at full cost or not at all. */
function sweepSchedules(scenario: SimScenario): { schedule: SimAllocationLine[][]; north: number }[] {
  const periods = scenario.decisionPeriods ?? scenario.horizonQuarters;
  const ids = scenario.interventions.map((i) => i.id);
  const lineFor = (id: string): SimAllocationLine => {
    const iv = scenario.interventions.find((i) => i.id === id)!;
    return { interventionId: id, sprints: iv.cost.sprints, rupees: iv.cost.rupees };
  };
  const fits = (schedule: SimAllocationLine[][]) =>
    schedule.every((lines) => {
      const sprints = lines.reduce((s, l) => s + l.sprints, 0);
      const rupees = lines.reduce((s, l) => s + l.rupees, 0);
      return sprints <= scenario.budget.sprints && rupees <= scenario.budget.rupees;
    });

  const out: { schedule: SimAllocationLine[][]; north: number }[] = [];
  const choices: number[] = new Array(ids.length).fill(-1);
  const walk = (k: number) => {
    if (k === ids.length) {
      const schedule: SimAllocationLine[][] = Array.from({ length: periods }, () => []);
      choices.forEach((p, i) => { if (p >= 0) schedule[p].push(lineFor(ids[i])); });
      if (!fits(schedule)) return;
      out.push({
        schedule,
        north: finalValue(pathsForSchedule(scenario, schedule), scenario.northStar),
      });
      return;
    }
    for (let p = -1; p < periods; p++) { choices[k] = p; walk(k + 1); }
    choices[k] = -1;
  };
  walk(0);
  return out;
}

describe.each(turnarounds.map((s) => [s.slug, s] as const))("turnaround: %s", (_slug, scenario) => {
  it("passes every authoring invariant", () => {
    expect(validateScenario(scenario)).toEqual([]);
  });

  it("decides for fewer periods than it is judged over", () => {
    // Otherwise anything that ramps falls off the end of the projection and
    // reads as free — the sweep found exactly that when the two were equal.
    const decisions = scenario.decisionPeriods ?? scenario.horizonQuarters;
    expect(decisions).toBeLessThan(scenario.horizonQuarters);
  });

  /**
   * The headline guarantee, and the reason the authored schedule was
   * brute-forced rather than argued. `scripts/best-schedule.ts` prints the
   * winner; this re-derives it and fails if a retune ever promotes another one.
   */
  it("authors a bestSchedule that really is the best sequence", () => {
    const swept = sweepSchedules(scenario);
    expect(swept.length).toBeGreaterThan(50);

    const authored = finalValue(
      pathsForSchedule(scenario, bestScheduleFor(scenario)),
      scenario.northStar,
    );
    const champion = Math.max(...swept.map((s) => s.north));
    // Equal is the pass: the authored answer should BE the winner, not merely
    // near it.
    expect(authored).toBeCloseTo(champion, 4);
  });

  it("makes doing nothing clearly worse than playing well", () => {
    const idle = finalValue(runSchedule(scenario, []).paths, scenario.northStar);
    const best = finalValue(
      pathsForSchedule(scenario, bestScheduleFor(scenario)),
      scenario.northStar,
    );
    expect(best).toBeGreaterThan(idle * 1.2);
  });

  it("is winnable — playing well leaves the company solvent", () => {
    // A scenario whose best line still ends in bankruptcy teaches nothing except
    // that the exercise was rigged. An earlier tuning did exactly that, in all
    // 589 affordable sequences.
    const best = pathsForSchedule(scenario, bestScheduleFor(scenario));
    expect(finalValue(best, "cash")).toBeGreaterThan(0);
  });

  it("punishes the cost-cutting traps rather than rewarding them", () => {
    const swept = sweepSchedules(scenario);
    const best = swept.reduce((a, b) => (b.north > a.north ? b : a));
    const funded = new Set(best.schedule.flat().map((l) => l.interventionId));
    // Whatever the winner funds, it must not be an intervention aimed at a cause
    // the scenario says is false.
    for (const id of funded) {
      const iv = scenario.interventions.find((i) => i.id === id)!;
      expect(scenario.trueCauseIds).toContain(iv.addresses);
    }
  });

  it("opens exactly where the briefing says it does", () => {
    // The situation copy quotes hard numbers at the student. If a retune moves a
    // baseline, the prose becomes a lie and nothing else would catch it.
    const v = resolveDrivers(scenario.drivers);
    expect(v.customers).toBe(2_000);
    expect(v.revenue).toBeCloseTo(7.2e7, 0);
    expect(v.burn).toBeCloseTo(10.2e7, 0);
    expect(v.netBurn).toBeCloseTo(3e7, 0);
    expect(v.cash).toBeCloseTo(12e7, 0);
    expect(v.runwayQuarters).toBeCloseTo(4, 6);
    expect(v.serviceRatio).toBe(1);
  });

  it("closes the feedback loop it claims to: less support now, more churn later", () => {
    const starved = {
      ...scenario,
      drivers: scenario.drivers.map((d) =>
        d.id === "supportSpend" && d.kind === "input" ? { ...d, baseline: d.baseline / 2 } : d,
      ),
    };
    const paths = pathsForSchedule(starved, []);
    // Period 0 churn is untouched — the damage is lagged, which is the point.
    expect(paths.churnRate[0]).toBeCloseTo(pathsForSchedule(scenario, []).churnRate[0], 6);
    expect(paths.churnRate[1]).toBeGreaterThan(paths.churnRate[0]);
  });
});
