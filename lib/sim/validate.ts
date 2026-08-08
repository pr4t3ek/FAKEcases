/**
 * Authoring invariants for a scenario.
 *
 * A scenario is a 500-line hand-written object full of cross-references, and
 * TypeScript checks none of them: `DriverId` and `CauseId` are string aliases,
 * so a typo in `addresses` compiles perfectly and then silently makes an
 * intervention useless. This is what turns those into failures a test can catch.
 *
 * Deliberately not Zod. Zod earns its keep at trust boundaries — the admin form,
 * the CSV importer, client payloads — where the input is hostile or unknown.
 * Scenario content is neither: it is code, checked once in CI, and a plain
 * function returning readable strings tests better than a schema error tree.
 *
 * Returns an empty array for a valid scenario.
 */

import { driverOrder } from "./drivers";
import { drilldownById, parCost } from "./investigate";
import type { CauseId, SimEffect, SimScenario } from "./types";

/**
 * What "Easy" is allowed to mean, in numbers.
 *
 * Derived from what makes NukkadEats hard: not one big thing, but ten pulls,
 * twelve causes across four branches and seven interventions, all held at once.
 * Roughly half of each is the target.
 */
export const EASY_CAPS = {
  drilldowns: 6,
  causes: 6,
  interventions: 5,
} as const;

function duplicates(ids: string[]): string[] {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) dupes.add(id);
    seen.add(id);
  }
  return [...dupes];
}

export function validateScenario(scenario: SimScenario): string[] {
  const errors: string[] = [];

  const driverIds = new Set(scenario.drivers.map((d) => d.id));
  const causeIds = new Set(scenario.causes.map((c) => c.id));
  const drilldownIds = new Set(scenario.drilldowns.map((d) => d.id));
  const interventionIds = new Set(scenario.interventions.map((i) => i.id));

  // ── Unique ids ──────────────────────────────────────────────────────────
  for (const [label, ids] of [
    ["driver", scenario.drivers.map((d) => d.id)],
    ["cause", scenario.causes.map((c) => c.id)],
    ["drilldown", scenario.drilldowns.map((d) => d.id)],
    ["intervention", scenario.interventions.map((i) => i.id)],
  ] as const) {
    for (const dupe of duplicates([...ids])) {
      errors.push(`Duplicate ${label} id "${dupe}"`);
    }
  }

  // ── Driver graph ────────────────────────────────────────────────────────
  try {
    driverOrder(scenario.drivers);
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
  }

  if (!driverIds.has(scenario.northStar)) {
    errors.push(`northStar "${scenario.northStar}" is not a driver`);
  }
  for (const id of scenario.reported) {
    if (!driverIds.has(id)) errors.push(`reported driver "${id}" does not exist`);
  }

  /**
   * The kinds that carry state across periods.
   *
   * `driverOrder` cannot check these: a `lagged` driver reports no dependency at
   * all (that is what makes feedback loops legal), so a typo in its `of` is
   * invisible to the topological sort and would surface as a silently frozen
   * number rather than an error.
   */
  for (const d of scenario.drivers) {
    if (d.kind === "stock") {
      for (const [role, ref] of [["inflow", d.inflow], ["outflow", d.outflow]] as const) {
        if (!driverIds.has(ref)) {
          errors.push(`Stock "${d.id}" has unknown ${role} "${ref}"`);
        } else if (ref === d.id) {
          errors.push(`Stock "${d.id}" uses itself as its ${role}`);
        }
      }
      if (!Number.isFinite(d.initial)) {
        errors.push(`Stock "${d.id}" needs a finite initial balance`);
      }
      if (d.floor !== undefined && d.floor > d.initial) {
        errors.push(
          `Stock "${d.id}" opens at ${d.initial}, below its own floor of ${d.floor}`,
        );
      }
    }
    if (d.kind === "lagged") {
      if (!driverIds.has(d.of)) {
        errors.push(`Lagged driver "${d.id}" reads unknown driver "${d.of}"`);
      } else if (d.of === d.id) {
        errors.push(`Lagged driver "${d.id}" reads itself`);
      }
      if (d.periods !== undefined && d.periods < 1) {
        errors.push(`Lagged driver "${d.id}" must look back at least one period`);
      }
      if (!Number.isFinite(d.initial)) {
        errors.push(`Lagged driver "${d.id}" needs a finite pre-run value`);
      }
    }
    if (d.kind === "min" && d.of.length < 2) {
      // One input is not a constraint, it is an alias — and an alias hides the
      // fact that nothing is actually binding.
      errors.push(`Driver "${d.id}" takes the smaller of fewer than two inputs`);
    }
  }

  /**
   * An effect on a derived driver is the quietest possible authoring bug: it
   * type-checks, it runs, and `resolveDrivers` overwrites the value from the
   * driver's parents a moment later, so the intervention simply does nothing.
   */
  const inputDrivers = new Set(
    scenario.drivers.filter((d) => d.kind === "input").map((d) => d.id),
  );
  const constantDrivers = new Set(
    scenario.drivers.filter((d) => d.kind === "constant").map((d) => d.id),
  );
  const checkEffects = (effects: SimEffect[], where: string) => {
    for (const e of effects) {
      if (!driverIds.has(e.driver)) {
        errors.push(`${where}: effect targets unknown driver "${e.driver}"`);
      } else if (constantDrivers.has(e.driver)) {
        // "Improve the 1000 in a CPM by 8%" is nonsense, and the type exists
        // to let us say so rather than let it silently do nothing.
        errors.push(
          `${where}: effect targets constant "${e.driver}" — a constant is not a lever`,
        );
      } else if (!inputDrivers.has(e.driver)) {
        errors.push(
          `${where}: effect targets derived driver "${e.driver}" and would do nothing — target its inputs instead`,
        );
      }
      if (e.deltaPct <= -1) {
        errors.push(`${where}: deltaPct ${e.deltaPct} on "${e.driver}" must be greater than -1`);
      }
      if (e.rampQuarters !== undefined && e.rampQuarters < 1) {
        errors.push(`${where}: rampQuarters must be at least 1`);
      }
    }
  };

  checkEffects(scenario.drift, "drift");

  // ── Cause tree ──────────────────────────────────────────────────────────
  for (const cause of scenario.causes) {
    if (cause.parentId && !causeIds.has(cause.parentId)) {
      errors.push(`Cause "${cause.id}" has unknown parent "${cause.parentId}"`);
    }
  }

  const hasCycle = (start: CauseId): boolean => {
    const byId = new Map(scenario.causes.map((c) => [c.id, c]));
    const seen = new Set<CauseId>();
    let current: CauseId | null = start;
    while (current) {
      if (seen.has(current)) return true;
      seen.add(current);
      current = byId.get(current)?.parentId ?? null;
    }
    return false;
  };
  for (const cause of scenario.causes) {
    if (hasCycle(cause.id)) errors.push(`Cause cycle through "${cause.id}"`);
  }

  const parents = new Set(scenario.causes.map((c) => c.parentId).filter(Boolean));
  if (!scenario.trueCauseIds.length) errors.push("trueCauseIds is empty");
  for (const id of scenario.trueCauseIds) {
    if (!causeIds.has(id)) {
      errors.push(`trueCauseIds names unknown cause "${id}"`);
      continue;
    }
    // A true cause with children is ambiguous: a candidate naming the child
    // would be more precise than the answer, and the scorer has no way to
    // reward that.
    if (parents.has(id)) {
      errors.push(`True cause "${id}" has children — name the leaf that actually holds it`);
    }
  }

  // ── Drilldowns ──────────────────────────────────────────────────────────
  for (const d of scenario.drilldowns) {
    if (d.cost <= 0) errors.push(`Drilldown "${d.id}" must cost at least one analyst-day`);
    for (const dep of d.dependsOn ?? []) {
      if (!drilldownIds.has(dep)) {
        errors.push(`Drilldown "${d.id}" depends on unknown "${dep}"`);
      }
      if (dep === d.id) errors.push(`Drilldown "${d.id}" depends on itself`);
    }
    for (const c of d.evidenceFor) {
      if (!causeIds.has(c)) errors.push(`Drilldown "${d.id}" is evidence for unknown cause "${c}"`);
    }
    if (!d.reveals.length) errors.push(`Drilldown "${d.id}" reveals nothing`);
  }

  // ── Interventions ───────────────────────────────────────────────────────
  for (const iv of scenario.interventions) {
    if (!causeIds.has(iv.addresses)) {
      errors.push(`Intervention "${iv.id}" addresses unknown cause "${iv.addresses}"`);
    }
    if (iv.cost.sprints <= 0 && iv.cost.rupees <= 0) {
      errors.push(`Intervention "${iv.id}" is free — it would always be fully funded`);
    }
    if (iv.minSprints !== undefined && iv.minSprints > iv.cost.sprints) {
      errors.push(
        `Intervention "${iv.id}" has minSprints above its own cost, so it can never ship`,
      );
    }
    checkEffects(iv.effects.whenRootCause, `Intervention "${iv.id}" (whenRootCause)`);
    checkEffects(iv.effects.otherwise, `Intervention "${iv.id}" (otherwise)`);
  }

  if (!scenario.interventions.some((i) => scenario.trueCauseIds.includes(i.addresses))) {
    errors.push("No intervention addresses a true cause — the scenario is unwinnable");
  }

  // ── The investment gate's preconditions ─────────────────────────────────
  //
  // Under gating a diagnosis unlocks only the interventions that address it, so
  // three things that used to be merely untidy are now load-bearing.

  // An intervention on a root is unfundable forever: `diagnosisSchema` accepts
  // leaves only, and `permittedInterventions` matches on exact equality.
  for (const iv of scenario.interventions) {
    if (parents.has(iv.addresses)) {
      errors.push(
        `Intervention "${iv.id}" addresses "${iv.addresses}", which is an area rather than a branch — no run can name it, so it can never be funded`,
      );
    }
  }

  // An off-target line in `bestAllocation` would put the outcome ceiling out of
  // reach of every legal allocation, so `scoreOutcome` could never return 100 —
  // the scorer would grade against something nobody is allowed to build.
  for (const line of scenario.bestAllocation) {
    const iv = scenario.interventions.find((i) => i.id === line.interventionId);
    if (iv && !scenario.trueCauseIds.includes(iv.addresses)) {
      errors.push(
        `bestAllocation funds "${iv.id}", which addresses "${iv.addresses}" rather than a true cause — no correct diagnosis could reach the ceiling`,
      );
    }
  }

  // A cause marked unactionable must genuinely have nothing behind it, and must
  // never be the answer — that would make the scenario unwinnable in a way the
  // check above does not catch.
  const addressed = new Set(scenario.interventions.map((i) => i.addresses));
  for (const cause of scenario.causes) {
    if (!cause.unactionable) continue;
    if (addressed.has(cause.id)) {
      errors.push(
        `Cause "${cause.id}" is marked unactionable but an intervention addresses it`,
      );
    }
    if (scenario.trueCauseIds.includes(cause.id)) {
      errors.push(`True cause "${cause.id}" is marked unactionable — the run cannot be won`);
    }
  }

  // ── Budget and par ──────────────────────────────────────────────────────
  const totalDrilldownCost = scenario.drilldowns.reduce((s, d) => s + d.cost, 0);
  if (totalDrilldownCost <= scenario.budget.analystDays) {
    errors.push(
      "The analyst-day budget covers every drilldown, so there is nothing to choose between — raise the costs or cut the budget",
    );
  }

  for (const id of scenario.parInvestigation) {
    if (!drilldownIds.has(id)) errors.push(`parInvestigation names unknown drilldown "${id}"`);
  }
  const par = parCost(scenario);
  if (par > scenario.budget.analystDays) {
    errors.push(`parInvestigation costs ${par} days, above the ${scenario.budget.analystDays}-day budget`);
  }
  const parReachesCause = scenario.parInvestigation.some((id) =>
    drilldownById(scenario, id)?.evidenceFor.some((c) => scenario.trueCauseIds.includes(c)),
  );
  if (!parReachesCause) {
    errors.push("parInvestigation contains no drilldown that is evidence for a true cause");
  }

  // ── Best allocation ─────────────────────────────────────────────────────
  let bestSprints = 0;
  let bestRupees = 0;
  for (const line of scenario.bestAllocation) {
    if (!interventionIds.has(line.interventionId)) {
      errors.push(`bestAllocation names unknown intervention "${line.interventionId}"`);
    }
    bestSprints += line.sprints;
    bestRupees += line.rupees;
  }
  if (bestSprints > scenario.budget.sprints) {
    errors.push(`bestAllocation needs ${bestSprints} sprints, above the ${scenario.budget.sprints} available`);
  }
  if (bestRupees > scenario.budget.rupees) {
    errors.push(`bestAllocation needs ₹${bestRupees}, above the ₹${scenario.budget.rupees} available`);
  }

  // ── Misc ────────────────────────────────────────────────────────────────
  if (scenario.horizonQuarters < 1) errors.push("horizonQuarters must be at least 1");
  if (!scenario.dashboard.length) errors.push("The scenario opens with an empty dashboard");
  if (!scenario.debrief.causalChain.length) errors.push("debrief.causalChain is empty");

  // ── Difficulty is a promise, so it gets checked ─────────────────────────
  //
  // Without this, "Easy" is a label an author can attach to anything, and the
  // beginner track quietly drifts back toward NukkadEats one scenario at a
  // time. Same posture as brute-forcing the balance rather than asserting it.
  if (scenario.difficulty === "Easy") {
    const caps: [string, number, number][] = [
      ["drilldowns", scenario.drilldowns.length, EASY_CAPS.drilldowns],
      ["causes", scenario.causes.length, EASY_CAPS.causes],
      ["interventions", scenario.interventions.length, EASY_CAPS.interventions],
    ];
    for (const [what, actual, cap] of caps) {
      if (actual > cap) {
        errors.push(
          `An Easy scenario may have at most ${cap} ${what}, and this has ${actual}`,
        );
      }
    }

    // A beginner should be able to hold the whole hypothesis space at once.
    const nested = scenario.causes.filter((c) => {
      const parent = scenario.causes.find((p) => p.id === c.parentId);
      return parent?.parentId != null;
    });
    if (nested.length) {
      errors.push("An Easy scenario's cause tree may be one level deep at most");
    }

    if (!scenario.teaching) {
      errors.push("An Easy scenario must carry a `teaching` primer — the jargon is the barrier");
    }

    // Scarce enough to force a choice, generous enough not to punish. Half the
    // board, against roughly a third on the harder scenarios.
    const totalCost = scenario.drilldowns.reduce((s, d) => s + d.cost, 0);
    if (scenario.budget.analystDays < totalCost * 0.35) {
      errors.push(
        `An Easy budget should cover about half the pulls; ${scenario.budget.analystDays} of ${totalCost} days is punishing`,
      );
    }
  }

  const allPanels = [
    ...scenario.dashboard,
    ...scenario.drilldowns.flatMap((d) => d.reveals),
  ];

  for (const dupe of duplicates(allPanels.map((p) => p.id))) {
    errors.push(`Duplicate panel id "${dupe}" — React keys would collide`);
  }

  /**
   * A statement panel is authored figures rather than a projection of the driver
   * graph, so nothing else in this file can catch a malformed one. These are the
   * two slips that render as a broken document rather than as an error.
   */
  for (const panel of allPanels) {
    if (panel.kind !== "statement") continue;

    const lines = panel.sections.flatMap((s) => s.lines);
    if (!lines.length) errors.push(`Statement panel "${panel.id}" has no lines`);

    // A "FY24 / FY25" header over rows that only carry this year prints a column
    // of em-dashes; one period with prior values silently drops last year.
    const hasPrior = lines.some((l) => l.priorValue !== undefined);
    if (hasPrior && panel.periods.length !== 2) {
      errors.push(
        `Statement panel "${panel.id}" has prior-period values but only one period header`,
      );
    }
    if (!hasPrior && panel.periods.length === 2) {
      errors.push(
        `Statement panel "${panel.id}" has two period headers and no prior-period values`,
      );
    }

    for (const dupe of duplicates(lines.map((l) => l.label))) {
      errors.push(
        `Statement panel "${panel.id}" repeats the line "${dupe}" — React keys would collide`,
      );
    }
  }

  return errors;
}
