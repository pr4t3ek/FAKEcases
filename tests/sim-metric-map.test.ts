import { describe, expect, it } from "vitest";
import { resolveDrivers } from "@/lib/sim/drivers";
import { chainTo, metricMap } from "@/lib/sim/metric-map";
import { fixtureScenario } from "./sim-fixture";

const scenario = fixtureScenario();
const values = resolveDrivers(scenario.drivers);
const map = metricMap(scenario, values);
const node = (id: string) => map.find((n) => n.id === id);

describe("metricMap", () => {
  it("includes every driver exactly once", () => {
    expect(map).toHaveLength(scenario.drivers.length);
    expect(new Set(map.map((n) => n.id)).size).toBe(map.length);
  });

  it("carries the current value of each driver", () => {
    expect(node("orders")?.value).toBe(1000);
    expect(node("revenue")?.value).toBe(1000 * 500);
  });

  /**
   * The whole point: a student should be able to read the row aloud and have it
   * be a true sentence about the arithmetic.
   */
  it("writes the formula in the operator the driver actually uses", () => {
    expect(node("revenue")?.formula).toBe("Orders × AOV");
    expect(node("margin")?.formula).toBe("Revenue − Total cost");
  });

  it("leaves a leaf with no formula", () => {
    expect(node("orders")?.formula).toBeNull();
  });

  it("marks inputs as levers and derived drivers as not", () => {
    expect(node("orders")?.isLever).toBe(true);
    expect(node("revenue")?.isLever).toBe(false);
  });

  it("orders dependencies before the drivers built from them", () => {
    const at = (id: string) => map.findIndex((n) => n.id === id);
    expect(at("orders")).toBeLessThan(at("revenue"));
    expect(at("revenue")).toBeLessThan(at("margin"));
  });

  it("gives a leaf depth zero and stacks derived drivers above it", () => {
    expect(node("orders")?.depth).toBe(0);
    expect(node("revenue")?.depth).toBe(1);
    // margin sits above revenue and totalCost, both of which are depth 1.
    expect(node("margin")?.depth).toBe(2);
  });

  it("describes a quotient as a division", () => {
    const withRatio = fixtureScenario({
      drivers: [
        ...scenario.drivers,
        {
          id: "marginPerOrder",
          kind: "quotient",
          label: "Margin per order",
          unit: "inr",
          goodDirection: "up",
          numerator: "margin",
          denominator: "orders",
        },
      ],
    });
    const withRatioMap = metricMap(withRatio, resolveDrivers(withRatio.drivers));
    const ratio = withRatioMap.find((n) => n.id === "marginPerOrder");
    expect(ratio?.formula).toBe("Contribution margin ÷ Orders");
    expect(ratio?.value).toBeCloseTo(200);
  });

  it("marks a constant as neither a lever nor a formula", () => {
    const withConst = fixtureScenario({
      drivers: [
        ...scenario.drivers,
        { id: "k", kind: "constant", label: "1000", unit: "count", goodDirection: "up", value: 1000 },
      ],
    });
    const k = metricMap(withConst, resolveDrivers(withConst.drivers)).find((n) => n.id === "k");
    expect(k?.isConstant).toBe(true);
    expect(k?.isLever).toBe(false);
    expect(k?.formula).toBeNull();
  });
});

describe("chainTo", () => {
  it("returns only the drivers that feed the target", () => {
    const chain = chainTo(scenario, values, "revenue").map((n) => n.id);
    expect(chain).toContain("revenue");
    expect(chain).toContain("orders");
    expect(chain).toContain("aov");
    // Cost per order has nothing to do with revenue.
    expect(chain).not.toContain("cpo");
  });

  it("keeps dependency order", () => {
    const chain = chainTo(scenario, values, "margin").map((n) => n.id);
    expect(chain.indexOf("orders")).toBeLessThan(chain.indexOf("revenue"));
    expect(chain[chain.length - 1]).toBe("margin");
  });

  it("returns just the driver for a leaf", () => {
    expect(chainTo(scenario, values, "orders").map((n) => n.id)).toEqual(["orders"]);
  });
});
