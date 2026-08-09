/**
 * Brute-force the best sequence for a turnaround scenario.
 *
 * `checkBalance` proves a war room's `bestAllocation` really is best by sweeping
 * every affordable combination. A schedule's space is that raised to the number
 * of periods, so this sweeps the tractable projection of it: each intervention
 * is funded at full cost in exactly one period, or never. That is 5^4 here.
 *
 * Deliberately a script and not a test — it PRINTS the winner so a human can
 * paste it into the scenario. `tests/sim-turnaround.test.ts` is what then pins
 * the authored answer against a re-derivation.
 */
import { getScenario } from "../lib/sim/registry";
import { pathsForSchedule } from "../lib/sim/outcome";
import { finalValue } from "../lib/sim/outcome";
import type { SimAllocationLine, SimScenario } from "../lib/sim/types";

const scenario = getScenario(process.argv[2] ?? "cash-runway-turnaround") as SimScenario;
const periods = scenario.decisionPeriods ?? scenario.horizonQuarters;

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

type Row = { label: string; cash: number; customers: number; schedule: SimAllocationLine[][] };
const rows: Row[] = [];
const ids = scenario.interventions.map((i) => i.id);

// choice[k] = period in which intervention k is funded, or -1 for never
const choices: number[] = new Array(ids.length).fill(-1);
const walk = (k: number) => {
  if (k === ids.length) {
    const schedule: SimAllocationLine[][] = Array.from({ length: periods }, () => []);
    choices.forEach((p, i) => { if (p >= 0) schedule[p].push(lineFor(ids[i])); });
    if (!fits(schedule)) return;
    const paths = pathsForSchedule(scenario, schedule);
    rows.push({
      label: choices.map((p, i) => (p < 0 ? `${ids[i]}:—` : `${ids[i]}:Q${p}`)).join("  "),
      cash: finalValue(paths, scenario.northStar),
      customers: finalValue(paths, "customers"),
      schedule,
    });
    return;
  }
  for (let p = -1; p < periods; p++) { choices[k] = p; walk(k + 1); }
  choices[k] = -1;
};
walk(0);

rows.sort((a, b) => b.cash - a.cash);
const cr = (n: number) => (n / 1e7).toFixed(3).padStart(9) + " cr";

console.log(`${rows.length} affordable sequences\n`);
console.log("TOP 8");
for (const r of rows.slice(0, 8)) console.log(`  ${cr(r.cash)}  cust ${Math.round(r.customers).toString().padStart(5)}   ${r.label}`);
console.log("\nWORST 4");
for (const r of rows.slice(-4)) console.log(`  ${cr(r.cash)}  cust ${Math.round(r.customers).toString().padStart(5)}   ${r.label}`);

const doNothing = rows.find((r) => r.label.split("  ").every((s) => s.endsWith("—")))!;
console.log(`\nDo nothing: ${cr(doNothing.cash)}  cust ${Math.round(doNothing.customers)}`);
console.log("\nBEST:", JSON.stringify(rows[0].schedule));
