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

  it("reports both sides of a quotient", () => {
    const d: SimDriver = {
      id: "cac",
      kind: "quotient",
      label: "CAC",
      unit: "inr",
      goodDirection: "down",
      numerator: "spend",
      denominator: "orders",
    };
    expect(dependenciesOf(d)).toEqual(["spend", "orders"]);
  });

  it("reports nothing for a constant", () => {
    const d: SimDriver = {
      id: "k",
      kind: "constant",
      label: "1000",
      unit: "count",
      goodDirection: "up",
      value: 1000,
    };
    expect(dependenciesOf(d)).toEqual([]);
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

  it("divides for a quotient", () => {
    const drivers: SimDriver[] = [
      input("spend", 1_000_000),
      input("orders", 2_500),
      {
        id: "cac",
        kind: "quotient",
        label: "CAC",
        unit: "inr",
        goodDirection: "down",
        numerator: "spend",
        denominator: "orders",
      },
    ];
    expect(resolveDrivers(drivers).cac).toBe(400);
  });

  /**
   * Infinity or NaN would propagate silently through the rest of the graph and
   * surface as a blank metric on a student's report, which is a worse failure
   * than a zero that reads as "no return, because no spend".
   */
  it("yields zero rather than Infinity when the denominator is zero", () => {
    const drivers: SimDriver[] = [
      input("revenue", 500_000),
      input("spend", 0),
      {
        id: "roas",
        kind: "quotient",
        label: "ROAS",
        unit: "ratio",
        goodDirection: "up",
        numerator: "revenue",
        denominator: "spend",
      },
    ];
    const values = resolveDrivers(drivers);
    expect(values.roas).toBe(0);
    expect(Number.isFinite(values.roas)).toBe(true);
  });

  it("holds a constant against a multiplier aimed at it", () => {
    const drivers: SimDriver[] = [
      { id: "k", kind: "constant", label: "1000", unit: "count", goodDirection: "up", value: 1000 },
      input("cpm", 180),
      {
        id: "cpi",
        kind: "quotient",
        label: "Cost per impression",
        unit: "inr",
        goodDirection: "down",
        numerator: "cpm",
        denominator: "k",
      },
    ];
    expect(resolveDrivers(drivers, { k: 5 }).k).toBe(1000);
    expect(resolveDrivers(drivers).cpi).toBeCloseTo(0.18);
  });

  it("composes a whole ad funnel", () => {
    // The chain scenario A is built on, in miniature.
    const drivers: SimDriver[] = [
      input("budget", 1_000_000),
      input("cpm", 180),
      { id: "k", kind: "constant", label: "1000", unit: "count", goodDirection: "up", value: 1000 },
      { id: "cpi", kind: "quotient", label: "CPI", unit: "inr", goodDirection: "down", numerator: "cpm", denominator: "k" },
      { id: "impressions", kind: "quotient", label: "Impressions", unit: "count", goodDirection: "up", numerator: "budget", denominator: "cpi" },
      input("ctr", 0.011),
      { id: "clicks", kind: "product", label: "Clicks", unit: "count", goodDirection: "up", of: ["impressions", "ctr"] },
    ];
    const values = resolveDrivers(drivers);
    expect(values.impressions).toBeCloseTo(5_555_555.6, 0);
    expect(values.clicks).toBeCloseTo(61_111.1, 0);
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
