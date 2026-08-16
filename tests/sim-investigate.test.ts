import { describe, expect, it } from "vitest";
import {
  isEvidenceFor,
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

  // The inverse of what this used to assert. `d-riders` names `d-city` in its
  // `dependsOn`, and that used to make it unbuyable until `d-city` was owned.
  // The relationship survives as a hint on the card; the refusal does not.
  it("sells a pull whose prerequisite was never bought", () => {
    expect(priceDrilldown(fixtureScenario(), run(), "d-riders").ok).toBe(true);
  });

  it("sells it just the same once the related pull is owned", () => {
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

  // Time is now the only thing that can stop you asking a question, so the
  // pull that used to be refused as "locked" is refused on price or not at all.
  it("refuses on price alone when the days are gone", () => {
    const decision = priceDrilldown(fixtureScenario(), run({ daysSpent: 4 }), "d-riders");
    expect(decision).toEqual({ ok: false, reason: "insufficient_budget" });
  });

  // The UI disables the card; this is the check that actually holds, because a
  // client can call the server action directly.
  //
  // Every pull costs 2 against a 5-day budget, so two are affordable and the
  // third is one day short. The odd budget is deliberate: under uniform pricing
  // it is the only way to leave a stranded day, which is exactly the boundary
  // this test exists to sit on.
  it("refuses a pull that would exactly overrun the budget", () => {
    const decision = priceDrilldown(fixtureScenario(), run({ daysSpent: 4 }), "d-noise");
    expect(decision).toEqual({ ok: false, reason: "insufficient_budget" });
  });
});

describe("visibleDashboard", () => {
  /** The fixture's opening board, in order. Bought panels append after these. */
  const BASE = ["p-orders", "p-headline", "p-unit", "p-mix", "p-steps", "p-room-note"];

  it("shows only the base panels before anything is bought", () => {
    const panels = visibleDashboard(fixtureScenario(), []);
    expect(panels.map((p) => p.id)).toEqual(BASE);
  });

  it("appends bought panels in purchase order, so the board reads as a narrative", () => {
    const panels = visibleDashboard(fixtureScenario(), ["d-funnel", "d-city"]);
    expect(panels.map((p) => p.id)).toEqual([...BASE, "p-funnel", "p-city"]);
  });

  it("skips an id that no longer exists rather than throwing", () => {
    const panels = visibleDashboard(fixtureScenario(), ["ghost", "d-city"]);
    expect(panels.map((p) => p.id)).toEqual([...BASE, "p-city"]);
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

/**
 * What may be bought, and what may not.
 *
 * Play-testing produced the report that prompted this: a candidate who had
 * named demand, found the supply pull showing a padlock, and concluded the
 * board only offered analyses for the branch they had committed to. It never
 * has — but nothing said so, and the card carrying the padlock was the one card
 * whose reason was hidden behind a tooltip.
 *
 * So the rule gets a test rather than a comment. Any analysis on any branch is
 * buyable at any time, which is the property that makes it possible to disprove
 * your own hypothesis — and disproving your own hypothesis is the entire point
 * of being able to revise it.
 */
describe("what gates an analysis", () => {
  const scenario = fixtureScenario();

  it("never consults a prerequisite pull", () => {
    // The board is open in every order. `d-riders` reads alongside `d-city`,
    // and a candidate who wants the expensive specific cut before the cheap
    // general one is making a decision — quite possibly a bad one, since they
    // may be paying for detail they cannot yet place. That is the exercise.
    const run = { phase: "investigate" as const, daysSpent: 0, owned: [] };
    expect(priceDrilldown(scenario, run, "d-riders").ok).toBe(true);
  });

  it("never consults the hypothesis", () => {
    // `d-funnel` is evidence for the price branch. A run that named the rider
    // branch — the opposite corner of the tree — may still buy it.
    const run = { phase: "investigate" as const, daysSpent: 0, owned: [] };
    expect(priceDrilldown(scenario, run, "d-funnel").ok).toBe(true);

    // And the reverse: having named price, the supply pull is still open.
    expect(priceDrilldown(scenario, run, "d-city").ok).toBe(true);
  });

  it("gates only on phase, dependencies, ownership and budget", () => {
    // The exhaustive list, asserted as a list. A refusal reason that is not one
    // of these is a gate somebody added without saying so.
    const reasons = new Set<string>();
    for (const phase of ["observe", "investigate", "commit", "debrief"] as const) {
      for (const owned of [[], ["d-city"]]) {
        for (const days of [0, 99]) {
          for (const id of ["d-city", "d-riders", "d-funnel", "d-noise", "nope"]) {
            const decision = priceDrilldown(scenario, { phase, daysSpent: days, owned }, id);
            if (!decision.ok) reasons.add(decision.reason);
          }
        }
      }
    }
    expect([...reasons].sort()).toEqual([
      "already_owned",
      "insufficient_budget",
      "unknown_drilldown",
      "wrong_phase",
    ]);
  });
});
