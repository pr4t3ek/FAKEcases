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
import { isTurnaround } from "./formats/registry";
import { drilldownById, parCost } from "./investigate";
import type { CauseId, SimEffect, SimResponse, SimScenario } from "./types";

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
  const isV2 = scenario.engine === "v2";

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
   * A panel figure denominated in lakh or crore but authored in raw rupees.
   *
   * `formatValue` appends the unit to the number as-is, so `inr_crore` with
   * 120,000,000 renders as "₹120000000.00 cr" — a number a thousand times too
   * big, on the tile a student reads first. It type-checks, no test covers panel
   * copy, and the war-room scenarios all happen to get it right, so nothing
   * would have caught it. This did, on the first turnaround.
   *
   * The threshold is a heuristic and deliberately loose: a genuine figure in
   * crore is single or double digits, and anything past a lakh is rupees that
   * forgot to be converted. Use `inr`, which scales itself.
   */
  const suspiciousDenomination = (unit: string, value: number) =>
    (unit === "inr_crore" || unit === "inr_lakh") && Math.abs(value) >= 100_000;

  for (const panel of scenario.dashboard) {
    if (panel.kind === "stat") {
      for (const tile of panel.tiles) {
        if (suspiciousDenomination(tile.unit, tile.value)) {
          errors.push(
            `Panel "${panel.id}" tile "${tile.label}" is ${tile.value} in ${tile.unit} — that looks like raw rupees; use "inr"`,
          );
        }
      }
    }
    if (panel.kind === "segments") {
      for (const row of panel.rows) {
        if (suspiciousDenomination(row.unit, row.value)) {
          errors.push(
            `Panel "${panel.id}" row "${row.label}" is ${row.value} in ${row.unit} — that looks like raw rupees; use "inr"`,
          );
        }
      }
    }
    if (panel.kind === "timeseries") {
      for (const series of panel.series) {
        for (const point of series.points) {
          if (suspiciousDenomination(series.unit, point.value)) {
            errors.push(
              `Panel "${panel.id}" series "${series.label}" has ${point.value} in ${series.unit} — that looks like raw rupees; use "inr"`,
            );
            break;
          }
        }
      }
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
      if (e.saturation) {
        checkResponse(e.saturation, `${where}: effect on "${e.driver}"`);
      }
    }
  };

  /**
   * A response curve nothing will read is worse than no curve: it looks like a
   * tuning decision, and the scenario behaves as though it were never made.
   */
  const checkResponse = (curve: SimResponse, where: string) => {
    if (!isV2) {
      errors.push(
        `${where}: response curves need engine: "v2" — on v1 this does nothing at all`,
      );
      return;
    }
    if (curve.kind === "proportional") {
      if (curve.slope !== undefined && !(curve.slope > 0)) {
        errors.push(`${where}: proportional slope must be above 0`);
      }
      return;
    }
    if (curve.kind === "linear") return;

    if (!(curve.ceiling > 0)) {
      errors.push(`${where}: response ceiling must be above 0`);
    }
    if (!(curve.halfAt > 0)) {
      // The formulas divide by `halfAt`, so zero is a NaN generator rather than
      // an aggressive curve.
      errors.push(`${where}: response halfAt must be above 0 — it is an ask multiple`);
    }
  };

  checkEffects(scenario.drift, "drift");

  if (scenario.noise) {
    if (!isV2) {
      errors.push('noise needs engine: "v2" — on v1 nothing draws it');
    }
    for (const n of scenario.noise.drivers) {
      if (!driverIds.has(n.driver)) {
        errors.push(`noise targets unknown driver "${n.driver}"`);
      } else if (!inputDrivers.has(n.driver)) {
        // Same trap as an effect on a derived driver: `resolveDrivers` would
        // overwrite it from its parents and the weather would silently vanish.
        errors.push(
          `noise targets derived driver "${n.driver}" and would do nothing — noise an input it depends on`,
        );
      }
      if (!(n.sigma > 0) || n.sigma > 0.1) {
        // Above 10% per quarter the weather drowns the decision, and a student
        // stops being able to read their own effect out of the result.
        errors.push(`noise sigma on "${n.driver}" must be above 0 and at most 0.1`);
      }
    }
    if (scenario.noise.driftSigma !== undefined && !(scenario.noise.driftSigma >= 0)) {
      errors.push("noise.driftSigma must not be negative");
    }
  }

  if (scenario.spend) {
    if (!isV2) {
      errors.push('spend needs engine: "v2" — on v1 money never reaches the driver graph');
    } else if (!driverIds.has(scenario.spend.driver)) {
      errors.push(`spend targets unknown driver "${scenario.spend.driver}"`);
    } else if (!inputDrivers.has(scenario.spend.driver)) {
      // Same trap as an effect on a derived driver: it would be overwritten by
      // `resolveDrivers` a moment later and the budget would go on being free.
      errors.push(
        `spend targets derived driver "${scenario.spend.driver}" and would do nothing — point it at an input that carries cost`,
      );
    }
    if (scenario.spend.atFullBudget <= 0) {
      errors.push("spend.atFullBudget must be above 0, or the money is not being paid for");
    }
  }

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
    // Still checked, though it no longer gates anything: a dangling id is now
    // a hint pointing at nothing rather than a pull nobody can reach, and a
    // card promising to read alongside an analysis that does not exist is
    // still a bug worth failing the build over.
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
    if (iv.saturation?.whenRootCause) {
      checkResponse(iv.saturation.whenRootCause, `Intervention "${iv.id}" (whenRootCause)`);
    }
    if (iv.saturation?.otherwise) {
      checkResponse(iv.saturation.otherwise, `Intervention "${iv.id}" (otherwise)`);
    }
    if (iv.maxAskMultiple !== undefined) {
      if (!isV2) {
        errors.push(
          `Intervention "${iv.id}": maxAskMultiple needs engine: "v2" — on v1 funding caps at the ask anyway`,
        );
      } else if (!(iv.maxAskMultiple >= 1)) {
        // Below 1 the slider could not reach the intervention's own asking
        // price, which every other part of the format treats as "fully funded".
        errors.push(`Intervention "${iv.id}": maxAskMultiple must be at least 1`);
      }
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
  //
  // Investigation is the WAR ROOM's exercise, not every format's. A turnaround
  // has no analyst-days and buys no data — the numbers are all on the table from
  // the first period and the difficulty is entirely in sequencing. Demanding a
  // priced drilldown board from it would force a scenario to invent one, and an
  // invented investigation is worse content than no investigation.
  //
  // What every format still owes: a cause tree, true causes that are leaves, and
  // interventions that address them — those drive `whenRootCause` vs `otherwise`
  // in the projection, so they are engine, not phase.
  if (isTurnaround(scenario)) {
    if (scenario.drilldowns.length) {
      errors.push("A turnaround has no investigation phase, so its drilldowns are unreachable");
    }
    if (!scenario.bestSchedule?.length) {
      errors.push("A turnaround needs a bestSchedule — the ceiling is a sequence, not one line");
    }
    if (scenario.horizonQuarters < 2) {
      errors.push("A turnaround over fewer than two periods is a war room with extra steps");
    }
    for (const [p, lines] of (scenario.bestSchedule ?? []).entries()) {
      let sprints = 0;
      let rupees = 0;
      for (const line of lines) {
        if (!interventionIds.has(line.interventionId)) {
          errors.push(`bestSchedule period ${p} names unknown intervention "${line.interventionId}"`);
        }
        sprints += line.sprints;
        rupees += line.rupees;
      }
      // Per period, because the budget refreshes each period — that is what
      // makes "spend it now or hold it" a decision rather than an accounting.
      if (sprints > scenario.budget.sprints) {
        errors.push(`bestSchedule period ${p} needs ${sprints} sprints, above the ${scenario.budget.sprints} available`);
      }
      if (rupees > scenario.budget.rupees) {
        errors.push(`bestSchedule period ${p} needs ₹${rupees}, above the ₹${scenario.budget.rupees} available`);
      }
    }
  } else {
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

    // A war room that commits several times is certified against a *sequence*,
    // and `bestScheduleFor` falls back to spending `bestAllocation` in period 0
    // when there is none. That fallback is right for the degenerate case and
    // wrong here: it would quietly certify "commit everything immediately" as
    // the ceiling without anyone having checked that it is, which is the one
    // claim the format exists to make interesting.
    if ((scenario.decisionPeriods ?? 1) > 1 && !scenario.bestSchedule?.length) {
      errors.push(
        "A war room played over several periods needs a bestSchedule — the ceiling is a sequence, and when to commit is half of it",
      );
    }
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
  // The horizon has to outrun the decisions, on every format that has more than
  // one. With them equal, whatever is committed last has its consequences land
  // outside the scoring window and reads as free — the sweep found exactly that
  // on the turnaround, where cutting marketing in the second-to-last period
  // scored best because the customers it destroyed had nowhere left to be
  // missed from. One idle period at the end is what closes it.
  if ((scenario.decisionPeriods ?? 1) > 1 && scenario.horizonQuarters <= scenario.decisionPeriods!) {
    errors.push(
      `${scenario.decisionPeriods} decision periods over a ${scenario.horizonQuarters}-period horizon leaves the last commitment's consequences outside the projection — the horizon must outrun the decisions`,
    );
  }
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
