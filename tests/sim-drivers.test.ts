import { describe, expect, it } from "vitest";
import { dependenciesOf, driverOrder, resolveDrivers } from "@/lib/sim/drivers";
import type { SimDriver } from "@/lib/sim/types";
import { fixtureScenario } from "./sim-fixture";

const input = (id: string, baseline: number): SimDriver => ({
  id,
  kind: "input",
  label: id,
  unit: "count",
  goodDirection: "up",
  baseline,
});

describe("dependenciesOf", () => {
  it("reports nothing for an input", () => {
    expect(dependenciesOf(input("a", 1))).toEqual([]);
  });

  it("reports both sides of a difference", () => {
    const d: SimDriver = {
      id: "m",
      kind: "difference",
      label: "m",
      unit: "inr",
      goodDirection: "up",
      minuend: "rev",
      subtrahend: "cost",
    };
    expect(dependenciesOf(d)).toEqual(["rev", "cost"]);
  });
});

describe("driverOrder", () => {
  it("puts dependencies before the drivers that need them", () => {
    const order = driverOrder(fixtureScenario().drivers);
    expect(order.indexOf("orders")).toBeLessThan(order.indexOf("revenue"));
    expect(order.indexOf("revenue")).toBeLessThan(order.indexOf("margin"));
    expect(order.indexOf("totalCost")).toBeLessThan(order.indexOf("margin"));
  });

  it("throws on a cycle rather than returning a partial order", () => {
    const drivers: SimDriver[] = [
      { id: "a", kind: "sum", label: "a", unit: "count", goodDirection: "up", of: ["b"] },
      { id: "b", kind: "sum", label: "b", unit: "count", goodDirection: "up", of: ["a"] },
    ];
    expect(() => driverOrder(drivers)).toThrow(/cycle/i);
  });

  it("names the unknown driver and who referenced it", () => {
    const drivers: SimDriver[] = [
      { id: "a", kind: "sum", label: "a", unit: "count", goodDirection: "up", of: ["ghost"] },
    ];
    expect(() => driverOrder(drivers)).toThrow(/ghost/);
  });
});

describe("resolveDrivers", () => {
  it("computes derived drivers from their inputs", () => {
    const values = resolveDrivers(fixtureScenario().drivers);
    expect(values.revenue).toBe(1000 * 500);
    expect(values.totalCost).toBe(1000 * 300);
    expect(values.margin).toBe(1000 * 500 - 1000 * 300);
  });

  it("scales an input and lets the change propagate", () => {
    const values = resolveDrivers(fixtureScenario().drivers, { orders: 1.1 });
    expect(values.orders).toBeCloseTo(1100);
    expect(values.revenue).toBeCloseTo(1100 * 500);
    // The whole point of the DAG: margin moves because its inputs did, so it
    // cannot contradict them.
    expect(values.margin).toBeCloseTo(1100 * 500 - 1100 * 300);
  });

  it("ignores a multiplier aimed at a derived driver", () => {
    const scenario = fixtureScenario();
    const plain = resolveDrivers(scenario.drivers);
    const meddled = resolveDrivers(scenario.drivers, { margin: 5 });
    expect(meddled.margin).toBe(plain.margin);
  });

  it("multiplies and sums over the listed drivers", () => {
    const drivers: SimDriver[] = [
      input("a", 2),
      input("b", 3),
      { id: "p", kind: "product", label: "p", unit: "count", goodDirection: "up", of: ["a", "b"] },
      { id: "s", kind: "sum", label: "s", unit: "count", goodDirection: "up", of: ["a", "b"] },
    ];
    const values = resolveDrivers(drivers);
    expect(values.p).toBe(6);
    expect(values.s).toBe(5);
  });
});
