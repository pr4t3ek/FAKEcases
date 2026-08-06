/**
 * Admin driver overrides: the parse, the merge, and the fallback.
 *
 * The property under test throughout is that a stored override can never make
 * the app worse than not having one. Every malformed, dangling or unbalanced
 * edit must end at the authored scenario rather than at a broken dashboard, a
 * thrown page, or — worst of the three, because it is silent — a scorer whose
 * ceiling is no longer the ceiling.
 *
 * Nothing here is mocked. `getScenario` reads the real authored content, and the
 * balance checks brute-force the real outcome model.
 */

import { describe, expect, it } from "vitest";
import { getScenario } from "@/lib/sim/registry";
import {
  driversSchema,
  leverDriverIds,
  parseDrivers,
  parseDriversJson,
  resolveOverride,
  withDrivers,
} from "@/lib/sim/overlay";
import { checkBalance } from "@/lib/sim/balance";
import { validateScenario } from "@/lib/sim/validate";
import { resolveDrivers } from "@/lib/sim/drivers";
import type { SimDriver } from "@/lib/sim/types";

const SLUG = "ad-funnel-roas";

function scenario() {
  const s = getScenario(SLUG);
  if (!s) throw new Error(`missing scenario ${SLUG}`);
  return s;
}

/** The authored drivers, deep-copied so a test can edit without leaking. */
function drivers(): SimDriver[] {
  return JSON.parse(JSON.stringify(scenario().drivers)) as SimDriver[];
}

const asJson = (d: SimDriver[]) => JSON.stringify(d);

describe("driversSchema: the trust boundary", () => {
  it("accepts every authored scenario's graph unchanged", () => {
    for (const slug of ["ad-funnel-roas", "subscription-ltv-cac", "metric-drop-food-delivery"]) {
      const s = getScenario(slug);
      expect(driversSchema.safeParse(s?.drivers).success, slug).toBe(true);
    }
  });

  it("rejects an input driver with no baseline", () => {
    const next = drivers().map((d) =>
      d.id === "cpm" ? { id: d.id, label: d.label, unit: d.unit, goodDirection: d.goodDirection, kind: "input" } : d,
    );
    const { drivers: parsed, error } = parseDrivers(next);
    expect(parsed).toBeUndefined();
    expect(error).toMatch(/baseline/i);
  });

  it("rejects a non-finite baseline, which would poison the whole graph", () => {
    // JSON has no Infinity, but a hand-edited payload can carry 1e999, which
    // parses to Infinity and then makes every derived driver NaN.
    const { drivers: parsed } = parseDriversJson(
      asJson(drivers()).replace('"baseline":180', '"baseline":1e999'),
    );
    expect(parsed).toBeUndefined();
  });

  it("rejects an unknown driver kind rather than ignoring it", () => {
    const next = [...drivers(), { id: "x", label: "X", unit: "count", goodDirection: "up", kind: "power", of: ["cpm"] }];
    expect(parseDrivers(next).drivers).toBeUndefined();
  });

  it("rejects an empty graph", () => {
    expect(parseDrivers([]).drivers).toBeUndefined();
  });

  it("reads a syntax error as one, not as a shape failure", () => {
    const { error } = parseDriversJson("[{not json");
    expect(error).toMatch(/valid JSON/i);
  });
});

describe("resolveOverride: code is the default", () => {
  it("serves the authored scenario when there is no override", () => {
    const resolved = resolveOverride(scenario(), null);
    expect(resolved.overridden).toBe(false);
    expect(resolved.scenario).toBe(scenario());
    expect(resolved.rejected).toBeUndefined();
  });

  it("applies a valid override", () => {
    const next = drivers().map((d) =>
      d.id === "cpm" && d.kind === "input" ? { ...d, baseline: 200 } : d,
    );
    const resolved = resolveOverride(scenario(), asJson(next));

    expect(resolved.overridden).toBe(true);
    expect(resolveDrivers(resolved.scenario.drivers).cpm).toBe(200);
    // Everything not named by the override still comes from code.
    expect(resolved.scenario.interventions).toBe(scenario().interventions);
    expect(resolved.scenario.debrief).toBe(scenario().debrief);
  });

  it("recomputes derived drivers from an edited input", () => {
    const next = drivers().map((d) =>
      d.id === "cpm" && d.kind === "input" ? { ...d, baseline: 360 } : d,
    );
    const { scenario: merged } = resolveOverride(scenario(), asJson(next));
    const before = resolveDrivers(scenario().drivers);
    const after = resolveDrivers(merged.drivers);

    // Twice the CPM buys half the impressions: the graph moved, not just the tile.
    expect(after.impressions).toBeCloseTo(before.impressions / 2, 0);
  });

  it("falls back to code on malformed JSON, and says why", () => {
    const resolved = resolveOverride(scenario(), "{ broken");
    expect(resolved.overridden).toBe(false);
    expect(resolved.scenario).toBe(scenario());
    expect(resolved.rejected).toBeTruthy();
  });

  /**
   * The case that motivates re-validating at load rather than trusting the save.
   *
   * An intervention effect names a driver id. Delete that driver and the
   * scenario still parses — the break is in a part of the content the admin
   * never touched, and only shows up when the two are put together.
   */
  it("falls back when an edit orphans a driver an intervention moves", () => {
    const lever = leverDriverIds(scenario())[0];
    const next = drivers().filter((d) => d.id !== lever);

    const resolved = resolveOverride(scenario(), asJson(next));
    expect(resolved.overridden).toBe(false);
    expect(resolved.rejected).toMatch(new RegExp(lever));
  });

  it("falls back when an edit introduces a cycle", () => {
    const next = drivers().map((d) =>
      d.id === "impressions" ? { ...d, kind: "quotient", numerator: "clicks", denominator: "cpm" } : d,
    );
    const resolved = resolveOverride(scenario(), asJson(next as SimDriver[]));
    expect(resolved.overridden).toBe(false);
    expect(resolved.rejected).toMatch(/cycle/i);
  });

  it("falls back when an edit turns a lever into a derived driver", () => {
    // An effect on a derived driver silently does nothing: `resolveDrivers`
    // overwrites it from its parents a moment later. `perThousand` is a
    // dependency-free constant, so pointing at it isolates that failure from
    // the cycle check.
    const lever = leverDriverIds(scenario()).find(
      (id) => scenario().drivers.find((x) => x.id === id)?.kind === "input",
    );
    expect(lever).toBeTruthy();

    const next = drivers().map((d) =>
      d.id === lever
        ? {
            id: d.id,
            label: d.label,
            unit: d.unit,
            goodDirection: d.goodDirection,
            kind: "sum",
            of: ["perThousand"],
          }
        : d,
    );
    const resolved = resolveOverride(scenario(), asJson(next as SimDriver[]));
    expect(resolved.overridden).toBe(false);
    expect(resolved.rejected).toMatch(/derived/i);
  });

  it("keeps a constant out of reach of multipliers", () => {
    const { scenario: merged } = resolveOverride(scenario(), asJson(drivers()));
    const constant = merged.drivers.find((d) => d.kind === "constant");
    expect(constant).toBeTruthy();

    const values = resolveDrivers(merged.drivers, { [constant!.id]: 4 });
    expect(values[constant!.id]).toBe(
      constant!.kind === "constant" ? constant!.value : Number.NaN,
    );
  });
});

describe("checkBalance: the guarantee the save path has to keep", () => {
  it("passes the authored scenario", () => {
    expect(checkBalance(scenario())).toEqual([]);
  });

  /**
   * The silent failure this whole design exists to prevent.
   *
   * `bestAllocation` is the ceiling the outcome score normalises against. Make
   * the true cause's fix feeble enough and some other affordable allocation
   * beats it — at which point the scenario still renders, still scores, and is
   * quietly grading against a ceiling that is not the top.
   *
   * Structure alone cannot see this: `validateScenario` is happy throughout.
   */
  it("catches a re-wiring that unhooks the best allocation's levers", () => {
    const s = scenario();

    /**
     * Re-wire the profit chain so it no longer reads the two drivers the
     * authored best allocation actually moves: `adRevenue` stops multiplying by
     * `aov`, and `grossProfit` stops multiplying by `grossMarginRate`.
     *
     * `iv-bundle` is then left with only its conversion-rate cost and none of
     * its benefit, so the declared best becomes an actively bad play. This is
     * the realistic version of the failure — a graph edit that is locally
     * sensible and silently invalidates a ceiling authored against the old
     * shape. Scaling baselines cannot produce it: every path to the north star
     * here is multiplicative, so the ranking of allocations is baseline-free.
     */
    const rewired = drivers().map((d) => {
      if (d.id === "adRevenue" && d.kind === "product") return { ...d, of: ["orders"] };
      if (d.id === "grossProfit" && d.kind === "product") return { ...d, of: ["adRevenue"] };
      return d;
    });
    const merged = withDrivers(s, rewired);

    // Structure is perfectly happy: every reference still resolves, and every
    // effect still targets an input driver.
    expect(validateScenario(merged)).toEqual([]);

    const errors = checkBalance(merged);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.join(" ")).toMatch(/beats the declared best|no worse than the best/i);
  });

  it("catches a best allocation that no longer fits the budget", () => {
    const s = scenario();
    const merged = { ...s, budget: { ...s.budget, sprints: 0, rupees: 0 } };
    expect(checkBalance(merged)).toContain("bestAllocation does not fit inside the budget");
  });
});

describe("leverDriverIds", () => {
  it("names every driver an intervention or the drift moves", () => {
    const s = scenario();
    const levers = leverDriverIds(s);

    for (const e of s.drift) expect(levers).toContain(e.driver);
    for (const iv of s.interventions) {
      for (const e of iv.effects.whenRootCause) expect(levers).toContain(e.driver);
    }
    // A pure reporting driver is not a lever.
    expect(levers).not.toContain(s.northStar);
  });
});
