import { describe, expect, it } from "vitest";
import {
  isEvidenceFor,
  isUnlocked,
  parCost,
  priceDrilldown,
  remainingDays,
  visibleDashboard,
} from "@/lib/sim/investigate";
import { CAUSE_TRUE, fixtureScenario } from "./sim-fixture";

const run = (over: Partial<Parameters<typeof priceDrilldown>[1]> = {}) => ({
  phase: "investigate" as const,
  daysSpent: 0,
  owned: [] as string[],
  ...over,
});

describe("remainingDays", () => {
  it("never goes negative", () => {
    expect(remainingDays(fixtureScenario(), 99)).toBe(0);
  });
});

describe("priceDrilldown", () => {
  it("sells an affordable, unlocked pull and reports what is left", () => {
    const decision = priceDrilldown(fixtureScenario(), run(), "d-city");
    expect(decision).toEqual({ ok: true, cost: 2, daysSpentAfter: 2, remaining: 3 });
  });

  it("refuses outside the investigate phase", () => {
    const decision = priceDrilldown(fixtureScenario(), run({ phase: "observe" }), "d-city");
    expect(decision).toEqual({ ok: false, reason: "wrong_phase" });
  });

  it("refuses an unknown pull", () => {
    expect(priceDrilldown(fixtureScenario(), run(), "nope")).toEqual({
      ok: false,
      reason: "unknown_drilldown",
    });
  });

  it("refuses to charge twice for the same cut", () => {
    const decision = priceDrilldown(fixtureScenario(), run({ owned: ["d-city"] }), "d-city");
    expect(decision).toEqual({ ok: false, reason: "already_owned" });
  });

  it("refuses a pull whose prerequisite is unbought", () => {
    expect(priceDrilldown(fixtureScenario(), run(), "d-riders")).toEqual({
      ok: false,
      reason: "locked",
    });
  });

  it("sells the same pull once its prerequisite is owned", () => {
    const decision = priceDrilldown(
      fixtureScenario(),
      run({ owned: ["d-city"], daysSpent: 2 }),
      "d-riders",
    );
    expect(decision.ok).toBe(true);
  });

  it("refuses when the budget cannot cover it", () => {
    const decision = priceDrilldown(
      fixtureScenario(),
      run({ owned: ["d-city"], daysSpent: 4 }),
      "d-riders",
    );
    expect(decision).toEqual({ ok: false, reason: "insufficient_budget" });
  });

  // Being locked is the more useful thing to say, so it is checked first: an
  // unaffordable pull you cannot open yet is not a budgeting problem.
  it("reports the lock before the price when both apply", () => {
    const decision = priceDrilldown(fixtureScenario(), run({ daysSpent: 4 }), "d-riders");
    expect(decision).toEqual({ ok: false, reason: "locked" });
  });

  // The UI disables the card; this is the check that actually holds, because a
  // client can call the server action directly.
  it("refuses a pull that would exactly overrun the budget", () => {
    const decision = priceDrilldown(fixtureScenario(), run({ daysSpent: 2 }), "d-noise");
    expect(decision).toEqual({ ok: false, reason: "insufficient_budget" });
  });
});

describe("isUnlocked", () => {
  it("treats a pull with no prerequisites as open", () => {
    const scenario = fixtureScenario();
    const city = scenario.drilldowns.find((d) => d.id === "d-city")!;
    expect(isUnlocked(city, [])).toBe(true);
  });
});

describe("visibleDashboard", () => {
  it("shows only the base panels before anything is bought", () => {
    const panels = visibleDashboard(fixtureScenario(), []);
    expect(panels.map((p) => p.id)).toEqual(["p-orders"]);
  });

  it("appends bought panels in purchase order, so the board reads as a narrative", () => {
    const panels = visibleDashboard(fixtureScenario(), ["d-funnel", "d-city"]);
    expect(panels.map((p) => p.id)).toEqual(["p-orders", "p-funnel", "p-city"]);
  });

  it("skips an id that no longer exists rather than throwing", () => {
    const panels = visibleDashboard(fixtureScenario(), ["ghost", "d-city"]);
    expect(panels.map((p) => p.id)).toEqual(["p-orders", "p-city"]);
  });
});

describe("parCost", () => {
  it("adds up the cheapest sufficient investigation", () => {
    expect(parCost(fixtureScenario())).toBe(2);
  });
});

describe("isEvidenceFor", () => {
  it("matches a pull against the causes it speaks to", () => {
    const scenario = fixtureScenario();
    const city = scenario.drilldowns.find((d) => d.id === "d-city")!;
    const noise = scenario.drilldowns.find((d) => d.id === "d-noise")!;
    expect(isEvidenceFor(city, [CAUSE_TRUE])).toBe(true);
    expect(isEvidenceFor(noise, [CAUSE_TRUE])).toBe(false);
  });
});
