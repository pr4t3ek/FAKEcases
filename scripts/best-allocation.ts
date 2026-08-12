/**
 * Ask the optimiser what the best play in a scenario actually is.
 *
 *     pnpm tsx scripts/best-allocation.ts ab-test-readout
 *     pnpm tsx scripts/best-allocation.ts            # every v2 scenario
 *
 * This is the authoring loop for a v2 scenario. `bestAllocation` is the ceiling
 * the outcome score normalises against, and under saturating response curves it
 * is no longer guessable: the optimum is usually an interior point that depends
 * on how three or four curves interact with a spend that reaches the P&L.
 * Hand-setting it means grading every student against a number that is not the
 * top.
 *
 * So the loop is: tune the content, run this, paste what it returns, run it
 * again to confirm nothing moved. It prints the balance errors alongside, since
 * those are what say whether the scenario is worth shipping at all — in
 * particular whether it still has a spending *decision* in it, or whether
 * emptying the budget remains the answer.
 */

import { listScenarios, getScenario } from "../lib/sim/registry";
import {
  optimiseAllocation,
  optimiseSchedule,
  formatAllocation,
  formatSchedule,
} from "../lib/sim/optimise";
import { checkBalance } from "../lib/sim/balance";
import { validateScenario } from "../lib/sim/validate";
import { bestScheduleFor, finalValue, pathsForSchedule, runOutcome } from "../lib/sim/outcome";
import type { SimScenario } from "../lib/sim/types";

function money(rupees: number): string {
  if (Math.abs(rupees) >= 1e7) return `₹${(rupees / 1e7).toFixed(2)} cr`;
  if (Math.abs(rupees) >= 1e5) return `₹${(rupees / 1e5).toFixed(2)} L`;
  return `₹${Math.round(rupees)}`;
}

function report(scenario: SimScenario): boolean {
  console.log(`\n${"=".repeat(70)}\n${scenario.slug}  (engine ${scenario.engine ?? "v1"})\n`);

  const structural = validateScenario(scenario);
  if (structural.length) {
    console.log("Structural errors — fix these before the numbers mean anything:");
    for (const e of structural) console.log(`  • ${e}`);
    return false;
  }

  if ((scenario.decisionPeriods ?? 1) > 1) return reportSchedule(scenario);

  const outcome = runOutcome(scenario, scenario.bestAllocation);
  const declared = finalValue(outcome.paths, scenario.northStar);
  const nothing = finalValue(outcome.doNothing, scenario.northStar);

  const found = optimiseAllocation(scenario, { mode: "strict" });

  console.log(`north star: ${scenario.northStar}`);
  console.log(`  do nothing      ${money(nothing)}`);
  console.log(`  declared best   ${money(declared)}`);
  console.log(`  optimiser found ${money(found.best.northStar)}`);
  console.log(
    `  searched ${found.evaluations.toLocaleString()} allocations${found.truncated ? " (TRUNCATED — proves nothing)" : ""}`,
  );

  console.log(`\nbest play:`);
  for (const line of found.best.allocation) {
    const iv = scenario.interventions.find((i) => i.id === line.interventionId);
    const ask = iv ? line.rupees / iv.cost.rupees : 1;
    const onTarget = iv && scenario.trueCauseIds.includes(iv.addresses) ? "" : "  ← OFF TARGET";
    console.log(
      `  ${line.interventionId.padEnd(22)} ${String(line.sprints)}w  ${money(line.rupees).padStart(10)}  ${(ask * 100).toFixed(0)}% of ask${onTarget}`,
    );
  }
  console.log(
    `  unspent: ${money(found.best.spare.rupees)} of ${money(scenario.budget.rupees)}  ·  ${found.best.spare.sprints} people-weeks`,
  );

  console.log(`\n${formatAllocation(found.best)}`);

  const errors = checkBalance(scenario, { mode: "strict" });
  if (!errors.length) {
    console.log("balance: OK");
    return true;
  }
  console.log("balance:");
  for (const e of errors) console.log(`  • ${e}`);
  return false;
}

/**
 * The same loop for a scenario that commits over several periods.
 *
 * Split rather than branched inside `report` because the two searches answer
 * different questions and print different things: a schedule's interesting
 * output is *when*, and an allocation's is *how much*. The search is a beam
 * rather than an enumeration, so what it prints is the best sequence found by a
 * documented search — worth saying out loud, because "no better schedule found"
 * is a weaker claim than the one-shot lattice makes.
 */
function reportSchedule(scenario: SimScenario): boolean {
  const declaredSchedule = bestScheduleFor(scenario);
  const declared = finalValue(
    pathsForSchedule(scenario, declaredSchedule),
    scenario.northStar,
  );
  const nothing = finalValue(pathsForSchedule(scenario, []), scenario.northStar);
  const found = optimiseSchedule(scenario, { mode: "strict" });

  console.log(
    `north star: ${scenario.northStar}  ·  ${scenario.decisionPeriods} periods over ${scenario.horizonQuarters}`,
  );
  console.log(`  do nothing      ${money(nothing)}`);
  console.log(`  declared best   ${money(declared)}`);
  console.log(`  optimiser found ${money(found.best.northStar)}`);
  console.log(
    `  searched ${found.evaluations.toLocaleString()} schedules${found.truncated ? " (TRUNCATED — proves nothing)" : ""}`,
  );

  console.log(`\nbest sequence:`);
  found.best.schedule.forEach((lines, period) => {
    if (!lines.length) {
      console.log(`  P${period}  (held everything)`);
      return;
    }
    for (const line of lines) {
      const iv = scenario.interventions.find((i) => i.id === line.interventionId);
      const ask = iv ? line.rupees / iv.cost.rupees : 1;
      const onTarget = iv && scenario.trueCauseIds.includes(iv.addresses) ? "" : "  ← OFF TARGET";
      console.log(
        `  P${period}  ${line.interventionId.padEnd(22)} ${String(line.sprints)}w  ${money(line.rupees).padStart(10)}  ${(ask * 100).toFixed(0)}% of ask${onTarget}`,
      );
    }
  });
  console.log(`  unspent: ${money(found.best.spare.rupees)} of ${money(scenario.budget.rupees)}`);

  console.log(`\n${formatSchedule(found.best)}`);

  const errors = checkBalance(scenario, { mode: "strict" });
  if (!errors.length) {
    console.log("balance: OK");
    return true;
  }
  console.log("balance:");
  for (const e of errors) console.log(`  • ${e}`);
  return false;
}

const [slug] = process.argv.slice(2);
const targets = slug
  ? [getScenario(slug)].filter((s): s is SimScenario => !!s)
  : listScenarios().filter((s) => s.engine === "v2");

if (!targets.length) {
  console.log(
    slug ? `No scenario named "${slug}".` : "No v2 scenarios yet — pass a slug to check a v1 one.",
  );
  process.exit(1);
}

let allOk = true;
for (const scenario of targets) allOk = report(scenario) && allOk;
console.log("");
process.exit(allOk ? 0 : 1);
