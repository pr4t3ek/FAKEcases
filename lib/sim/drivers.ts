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
import type { DriverId, SimDriver, SimPaths } from "./types";

/**
 * What a driver needs from the periods already computed.
 *
 * Absent means "period 0" — the baseline, where no history exists yet. A `stock`
 * then takes its `initial` and a `lagged` its authored pre-run value, which is
 * exactly what those fields are for.
 */
export interface DriverHistory {
  /** Resolved values per driver for periods `0 … period-1`. */
  paths: SimPaths;
  /** The period being computed. */
  period: number;
}

/**
 * The drivers this one is computed from, WITHIN the current period.
 *
 * `lagged` deliberately reports nothing. It reads a previous period, so it
 * imposes no ordering constraint now — and that is precisely what lets a
 * scenario close a feedback loop (support cuts → churn → collections → support
 * budget) while `driverOrder` still refuses a genuine instantaneous cycle. A
 * loop through time is a model; a loop within a period is a contradiction.
 *
 * `stock` reports its inflow and outflow but NOT itself: the `prior + …` term
 * comes out of history, so the self-reference is across periods too.
 */
export function dependenciesOf(driver: SimDriver): DriverId[] {
  switch (driver.kind) {
    case "input":
    case "constant":
    case "lagged":
      return [];
    case "product":
    case "sum":
    case "min":
      return driver.of;
    case "difference":
      return [driver.minuend, driver.subtrahend];
    case "quotient":
      return [driver.numerator, driver.denominator];
    case "stock":
      return [driver.inflow, driver.outflow];
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
  history?: DriverHistory,
): Record<DriverId, number> {
  const byId = indexById(drivers);
  const values: Record<DriverId, number> = {};

  const valueOf = (id: DriverId): number => {
    const v = values[id];
    if (v === undefined) throw new Error(`Driver "${id}" read before it was computed`);
    return v;
  };

  /**
   * A driver's value `back` periods ago, or undefined if the run has not run
   * that long. Undefined is the signal to fall back to an authored initial
   * rather than an error: period 0 legitimately has no yesterday.
   */
  const past = (id: DriverId, back: number): number | undefined => {
    if (!history) return undefined;
    const index = history.period - back;
    if (index < 0) return undefined;
    return history.paths[id]?.[index];
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
      case "quotient": {
        const denominator = valueOf(driver.denominator);
        // Zero yields zero rather than Infinity or NaN. Both of those would
        // propagate silently through the rest of the graph and surface as a
        // blank metric on a student's report.
        values[id] = denominator === 0 ? 0 : valueOf(driver.numerator) / denominator;
        break;
      }
      case "constant":
        // Not scaled by `multipliers`, by definition — see the type.
        values[id] = driver.value;
        break;
      case "min":
        values[id] = Math.min(...driver.of.map(valueOf));
        break;
      case "stock": {
        const prior = past(id, 1);
        // No yesterday means this is the opening balance.
        const base =
          prior === undefined
            ? driver.initial
            : prior + valueOf(driver.inflow) - valueOf(driver.outflow);
        values[id] = driver.floor === undefined ? base : Math.max(driver.floor, base);
        break;
      }
      case "lagged": {
        const back = Math.max(1, driver.periods ?? 1);
        const prior = past(driver.of, back);
        // Before the run began, the authored pre-run value. See the type: `of`
        // may not be computed yet, so reading it here is not an option.
        values[id] = prior === undefined ? driver.initial : prior;
        break;
      }
      default:
        assertNever(driver, "driver kind");
    }
  }

  return values;
}
