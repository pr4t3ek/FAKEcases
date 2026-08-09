/**
 * "How is this number built?"
 *
 * The single most useful thing you can show a student who is struggling: not
 * that net ad profit is −₹1.2 lakh, but that it is gross profit minus ad spend,
 * and gross profit is revenue times margin, and revenue is orders times average
 * order value — all the way down to the two or three numbers they can actually
 * move.
 *
 * Derived entirely from the driver graph. There is no second copy of the model
 * to keep in sync, so the map cannot disagree with the arithmetic it explains —
 * which is the failure mode a hand-authored diagram would have on day one.
 *
 * Pure: takes a scenario and a set of values, returns rows. No DB, no
 * formatting — units are rendered at the UI edge.
 */

import { assertNever } from "@/lib/utils";
import { dependenciesOf, driverOrder } from "./drivers";
import type { DriverId, SimDriver, SimScenario, SimUnit } from "./types";

export interface MetricMapNode {
  id: DriverId;
  label: string;
  unit: SimUnit;
  value: number;
  /** "Impressions × Click-through rate", or null for a leaf. */
  formula: string | null;
  inputs: DriverId[];
  /** Longest path from a leaf, so the UI can lay the chain out left to right. */
  depth: number;
  /** An `input` — something an intervention could move. Marked in the UI. */
  isLever: boolean;
  /** A fixed number, shown but visibly not a dial. */
  isConstant: boolean;
}

/** The operator that joins a driver's inputs, in words a student reads aloud. */
function formulaFor(driver: SimDriver, labelOf: (id: DriverId) => string): string | null {
  switch (driver.kind) {
    case "input":
    case "constant":
      return null;
    case "product":
      return driver.of.map(labelOf).join(" × ");
    case "sum":
      return driver.of.map(labelOf).join(" + ");
    case "difference":
      return `${labelOf(driver.minuend)} − ${labelOf(driver.subtrahend)}`;
    case "quotient":
      return `${labelOf(driver.numerator)} ÷ ${labelOf(driver.denominator)}`;
    case "min":
      // "whichever is smaller" rather than "min(a, b)": the point of the node is
      // that one of them is binding, and a student reads the constraint faster
      // in words than in a function call.
      return `whichever is smaller: ${driver.of.map(labelOf).join(" or ")}`;
    case "stock":
      return `last period + ${labelOf(driver.inflow)} − ${labelOf(driver.outflow)}`;
    case "lagged": {
      const back = Math.max(1, driver.periods ?? 1);
      return `${labelOf(driver.of)}, ${back === 1 ? "last period" : `${back} periods ago`}`;
    }
    default:
      return assertNever(driver, "driver kind");
  }
}

/**
 * Rows in dependency order — every driver appears after the ones it is built
 * from, so rendering top to bottom or left to right both read correctly.
 */
export function metricMap(
  scenario: SimScenario,
  values: Record<DriverId, number>,
): MetricMapNode[] {
  const byId = new Map(scenario.drivers.map((d) => [d.id, d]));
  const labelOf = (id: DriverId) => byId.get(id)?.label ?? id;

  const depths = new Map<DriverId, number>();
  const ordered = driverOrder(scenario.drivers);

  for (const id of ordered) {
    const driver = byId.get(id);
    if (!driver) continue;
    const deps = dependenciesOf(driver);
    // Dependency order guarantees every input already has a depth.
    const depth = deps.length ? Math.max(...deps.map((d) => (depths.get(d) ?? 0) + 1)) : 0;
    depths.set(id, depth);
  }

  return ordered.flatMap((id) => {
    const driver = byId.get(id);
    if (!driver) return [];
    return [
      {
        id,
        label: driver.label,
        unit: driver.unit,
        value: values[id] ?? 0,
        formula: formulaFor(driver, labelOf),
        inputs: dependenciesOf(driver),
        depth: depths.get(id) ?? 0,
        isLever: driver.kind === "input",
        isConstant: driver.kind === "constant",
      },
    ];
  });
}

/**
 * The chain that produced one driver, nearest cause first.
 *
 * Used by the debrief to answer "why did this move?" by walking back from the
 * north star through exactly the drivers that feed it, rather than showing the
 * whole graph again.
 */
export function chainTo(
  scenario: SimScenario,
  values: Record<DriverId, number>,
  target: DriverId,
): MetricMapNode[] {
  const all = metricMap(scenario, values);
  const byId = new Map(all.map((n) => [n.id, n]));

  const wanted = new Set<DriverId>();
  const walk = (id: DriverId) => {
    if (wanted.has(id)) return;
    wanted.add(id);
    for (const input of byId.get(id)?.inputs ?? []) walk(input);
  };
  walk(target);

  return all.filter((n) => wanted.has(n.id));
}
