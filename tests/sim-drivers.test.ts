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

// ─── Drivers that carry state across periods ───────────────────────────────

/**
 * These are the kinds that gave the engine a memory. Everything above resolves
 * a period in isolation; `stock` and `lagged` are the reason `resolveDrivers`
 * takes a history at all, and the reason a scenario can now ask "is there any
 * cash left" rather than only "is this ratio wrong".
 */

/** Values-per-period, in the shape `pathsForFunding` accumulates. */
const historyOf = (paths: Record<string, number[]>, period: number) => ({ paths, period });

const stock = (over: Partial<Extract<SimDriver, { kind: "stock" }>> = {}): SimDriver => ({
  id: "cash",
  kind: "stock",
  label: "Cash",
  unit: "inr",
  goodDirection: "up",
  initial: 100,
  inflow: "in",
  outflow: "out",
  ...over,
});

const laggedOn = (over: Partial<Extract<SimDriver, { kind: "lagged" }>> = {}): SimDriver => ({
  id: "prev",
  kind: "lagged",
  label: "Prev",
  unit: "count",
  goodDirection: "up",
  of: "x",
  initial: 7,
  ...over,
});

describe("stock", () => {
  const drivers = [input("in", 30), input("out", 50), stock()];

  it("opens at its initial balance when there is no yesterday", () => {
    expect(resolveDrivers(drivers, {}, historyOf({}, 0)).cash).toBe(100);
    // …and with no history argument at all, which is the baseline resolve the
    // metric map and the admin panel both do.
    expect(resolveDrivers(drivers).cash).toBe(100);
  });

  it("accumulates: prior + inflow − outflow", () => {
    const paths = { cash: [100] };
    expect(resolveDrivers(drivers, {}, historyOf(paths, 1)).cash).toBe(80);
  });

  it("goes negative when nothing stops it — insolvency is the lesson", () => {
    const paths = { cash: [10] };
    expect(resolveDrivers(drivers, {}, historyOf(paths, 1)).cash).toBe(-10);
  });

  it("clamps at a floor when one is authored — inventory cannot go negative", () => {
    const floored = [input("in", 0), input("out", 50), stock({ floor: 0 })];
    const paths = { cash: [10] };
    expect(resolveDrivers(floored, {}, historyOf(paths, 1)).cash).toBe(0);
  });

  it("moves when an intervention scales its flows", () => {
    const paths = { cash: [100] };
    // Halve the outflow: 100 + 30 − 25 rather than 100 + 30 − 50.
    expect(resolveDrivers(drivers, { out: 0.5 }, historyOf(paths, 1)).cash).toBe(105);
  });
});

describe("lagged", () => {
  const drivers = [input("x", 42), laggedOn()];

  it("uses the authored pre-run value before the run is that old", () => {
    expect(resolveDrivers(drivers, {}, historyOf({ x: [42] }, 0)).prev).toBe(7);
  });

  it("reads the previous period once there is one", () => {
    expect(resolveDrivers(drivers, {}, historyOf({ x: [42, 55] }, 1)).prev).toBe(42);
  });

  it("looks further back when asked", () => {
    const two = [input("x", 1), laggedOn({ periods: 2 })];
    const paths = { x: [10, 20, 30] };
    expect(resolveDrivers(two, {}, historyOf(paths, 2)).prev).toBe(10);
    // One period in, two-back does not exist yet, so the pre-run value stands.
    expect(resolveDrivers(two, {}, historyOf(paths, 1)).prev).toBe(7);
  });

  it("imposes no ordering constraint, which is what makes a loop legal", () => {
    expect(dependenciesOf(laggedOn())).toEqual([]);
  });

  /**
   * The headline: a genuine feedback loop. `quality` depends on last period's
   * `churn`, and `churn` depends on this period's `quality`. Within a period
   * that is a cycle and `driverOrder` would refuse it; across periods it is a
   * death spiral, which is a thing businesses actually do.
   */
  it("closes a feedback loop that driverOrder would otherwise refuse", () => {
    const loop: SimDriver[] = [
      input("support", 100),
      laggedOn({ id: "churnLast", of: "churn", initial: 0.1 }),
      {
        id: "quality",
        kind: "difference",
        label: "Quality",
        unit: "ratio",
        goodDirection: "up",
        minuend: "support",
        subtrahend: "churnLast",
      },
      {
        id: "churn",
        kind: "quotient",
        label: "Churn",
        unit: "ratio",
        goodDirection: "down",
        numerator: "one",
        denominator: "quality",
      },
      { id: "one", kind: "constant", label: "1", unit: "count", goodDirection: "up", value: 1 },
    ];

    expect(() => driverOrder(loop)).not.toThrow();

    const p0 = resolveDrivers(loop, {}, historyOf({}, 0));
    expect(p0.quality).toBeCloseTo(99.9);
    const paths = { churn: [p0.churn], quality: [p0.quality] };
    const p1 = resolveDrivers(loop, {}, historyOf(paths, 1));
    // Last period's churn now feeds this period's quality.
    expect(p1.quality).toBeCloseTo(100 - p0.churn);
  });

  it("still refuses a cycle that closes within a single period", () => {
    const instant: SimDriver[] = [
      { id: "a", kind: "sum", label: "a", unit: "count", goodDirection: "up", of: ["b"] },
      { id: "b", kind: "sum", label: "b", unit: "count", goodDirection: "up", of: ["a"] },
    ];
    expect(() => driverOrder(instant)).toThrow(/cycle/i);
  });
});

describe("min", () => {
  it("takes the binding constraint", () => {
    const drivers: SimDriver[] = [
      input("demand", 900),
      input("capacity", 400),
      {
        id: "sold",
        kind: "min",
        label: "Units sold",
        unit: "count",
        goodDirection: "up",
        of: ["demand", "capacity"],
      },
    ];
    expect(resolveDrivers(drivers).sold).toBe(400);
    // Lift the constraint and the other side binds instead.
    expect(resolveDrivers(drivers, { capacity: 4 }).sold).toBe(900);
  });

  it("reports every input as a dependency, so ordering still holds", () => {
    const d: SimDriver = {
      id: "m",
      kind: "min",
      label: "m",
      unit: "count",
      goodDirection: "up",
      of: ["a", "b"],
    };
    expect(dependenciesOf(d)).toEqual(["a", "b"]);
  });
});
