/**
 * The driver DAG evaluator.
 *
 * A scenario's metrics are a small dependency graph rather than a flat list of
 * numbers. Interventions move `input` drivers; everything else is derived from
 * them. That is what stops a scenario from claiming both "cost per order fell
 * 12%" and a contribution margin that didn't move — the margin is computed, so
 * it cannot disagree with its inputs.
 *
 * Pure and DB-free. No `Math.random`, no `Date.now()`: the same allocation must
 * always produce the same numbers, or a student's report changes under them.
 */

import { assertNever } from "@/lib/utils";
import type { DriverId, SimDriver } from "./types";

/** The drivers this one is computed from. Empty for an `input`. */
export function dependenciesOf(driver: SimDriver): DriverId[] {
  switch (driver.kind) {
    case "input":
      return [];
    case "product":
    case "sum":
      return driver.of;
    case "difference":
      return [driver.minuend, driver.subtrahend];
  }
}

function indexById(drivers: SimDriver[]): Map<DriverId, SimDriver> {
  const byId = new Map<DriverId, SimDriver>();
  for (const d of drivers) byId.set(d.id, d);
  return byId;
}

/**
 * Dependencies-first ordering, so a single pass can evaluate the whole graph.
 *
 * Throws on a cycle or an unknown reference rather than returning a partial
 * order. Both are authoring mistakes, and `validateScenario` reports them as
 * such before anything reaches here — this is the backstop, not the front door.
 */
export function driverOrder(drivers: SimDriver[]): DriverId[] {
  const byId = indexById(drivers);
  const state = new Map<DriverId, "visiting" | "done">();
  const order: DriverId[] = [];

  const visit = (id: DriverId, trail: DriverId[]): void => {
    const seen = state.get(id);
    if (seen === "done") return;
    if (seen === "visiting") {
      throw new Error(`Driver cycle: ${[...trail, id].join(" → ")}`);
    }

    const driver = byId.get(id);
    if (!driver) {
      const from = trail.length ? ` (referenced by "${trail[trail.length - 1]}")` : "";
      throw new Error(`Unknown driver "${id}"${from}`);
    }

    state.set(id, "visiting");
    for (const dep of dependenciesOf(driver)) visit(dep, [...trail, id]);
    state.set(id, "done");
    order.push(id);
  };

  for (const d of drivers) visit(d.id, []);
  return order;
}

/**
 * Every driver's value, given multipliers on the inputs.
 *
 * `multipliers` scales `input` drivers only — a derived driver's value is
 * whatever its parents make it, and accepting a multiplier for one would let a
 * scenario overrule its own arithmetic. `validateScenario` refuses an effect
 * aimed at a derived driver for the same reason; a stray key here is ignored.
 */
export function resolveDrivers(
  drivers: SimDriver[],
  multipliers: Record<DriverId, number> = {},
): Record<DriverId, number> {
  const byId = indexById(drivers);
  const values: Record<DriverId, number> = {};

  const valueOf = (id: DriverId): number => {
    const v = values[id];
    if (v === undefined) throw new Error(`Driver "${id}" read before it was computed`);
    return v;
  };

  for (const id of driverOrder(drivers)) {
    const driver = byId.get(id);
    if (!driver) throw new Error(`Unknown driver "${id}"`);

    switch (driver.kind) {
      case "input":
        values[id] = driver.baseline * (multipliers[id] ?? 1);
        break;
      case "product":
        values[id] = driver.of.reduce((acc, k) => acc * valueOf(k), 1);
        break;
      case "sum":
        values[id] = driver.of.reduce((acc, k) => acc + valueOf(k), 0);
        break;
      case "difference":
        values[id] = valueOf(driver.minuend) - valueOf(driver.subtrahend);
        break;
      default:
        assertNever(driver, "driver kind");
    }
  }

  return values;
}
