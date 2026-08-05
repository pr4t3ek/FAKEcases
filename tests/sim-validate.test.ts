/**
 * The validator exists because `DriverId` and `CauseId` are string aliases, so
 * every cross-reference in a scenario compiles whether or not it resolves. Each
 * case below is an authoring mistake that would otherwise ship silently.
 */

import { describe, expect, it } from "vitest";
import { validateScenario } from "@/lib/sim/validate";
import { CAUSE_TRUE, fixtureScenario } from "./sim-fixture";

const errorsFor = (over: Parameters<typeof fixtureScenario>[0]) =>
  validateScenario(fixtureScenario(over)).join(" | ");

describe("validateScenario", () => {
  it("passes a well-formed scenario", () => {
    expect(validateScenario(fixtureScenario())).toEqual([]);
  });

  it("catches a driver cycle", () => {
    expect(
      errorsFor({
        drivers: [
          { id: "a", kind: "sum", label: "a", unit: "count", goodDirection: "up", of: ["b"] },
          { id: "b", kind: "sum", label: "b", unit: "count", goodDirection: "up", of: ["a"] },
        ],
      }),
    ).toMatch(/cycle/i);
  });

  it("catches a north star that is not a driver", () => {
    expect(errorsFor({ northStar: "invented" })).toMatch(/northStar/);
  });

  /**
   * The quietest bug of the lot: it type-checks, it runs, and `resolveDrivers`
   * overwrites the value from the driver's parents a moment later — so the
   * intervention simply does nothing and nobody finds out.
   */
  it("catches an effect aimed at a derived driver", () => {
    const scenario = fixtureScenario();
    const errors = errorsFor({
      interventions: scenario.interventions.map((iv) =>
        iv.id === "iv-payout"
          ? { ...iv, effects: { ...iv.effects, whenRootCause: [{ driver: "margin", deltaPct: 0.1 }] } }
          : iv,
      ),
    });
    expect(errors).toMatch(/derived driver "margin"/);
  });

  it("catches an effect aimed at a constant", () => {
    const scenario = fixtureScenario();
    const errors = errorsFor({
      drivers: [
        ...scenario.drivers,
        { id: "k", kind: "constant", label: "1000", unit: "count", goodDirection: "up", value: 1000 },
      ],
      interventions: scenario.interventions.map((iv) =>
        iv.id === "iv-payout"
          ? { ...iv, effects: { ...iv.effects, whenRootCause: [{ driver: "k", deltaPct: 0.08 }] } }
          : iv,
      ),
    });
    expect(errors).toMatch(/constant "k" — a constant is not a lever/);
  });

  it("catches an effect that would drive a metric to nothing or below", () => {
    const scenario = fixtureScenario();
    expect(
      errorsFor({
        interventions: scenario.interventions.map((iv) =>
          iv.id === "iv-payout"
            ? { ...iv, effects: { ...iv.effects, whenRootCause: [{ driver: "orders", deltaPct: -1 }] } }
            : iv,
        ),
      }),
    ).toMatch(/greater than -1/);
  });

  it("catches an unknown cause on an intervention", () => {
    const scenario = fixtureScenario();
    expect(
      errorsFor({
        interventions: scenario.interventions.map((iv) =>
          iv.id === "iv-payout" ? { ...iv, addresses: "invented" } : iv,
        ),
      }),
    ).toMatch(/addresses unknown cause/);
  });

  it("catches a true cause that still has children", () => {
    // Naming "supply" as the answer leaves a candidate who names its child
    // strictly more precise than the answer key.
    expect(errorsFor({ trueCauseIds: ["supply"] })).toMatch(/name the leaf/);
  });

  it("catches a scenario nobody can win", () => {
    const scenario = fixtureScenario();
    expect(
      errorsFor({
        interventions: scenario.interventions.map((iv) => ({ ...iv, addresses: "demand.price" })),
      }),
    ).toMatch(/unwinnable/);
  });

  // If the budget buys everything, there is nothing to choose between and the
  // exercise evaporates.
  it("catches a budget that covers every drilldown", () => {
    expect(errorsFor({ budget: { analystDays: 999, sprints: 3, rupees: 700 } })).toMatch(
      /nothing to choose between/,
    );
  });

  it("catches a par investigation that never reaches the cause", () => {
    expect(errorsFor({ parInvestigation: ["d-noise"] })).toMatch(/no drilldown that is evidence/);
  });

  it("catches a par investigation the budget cannot afford", () => {
    expect(errorsFor({ parInvestigation: ["d-city", "d-riders", "d-noise"] })).toMatch(
      /above the 5-day budget/,
    );
  });

  it("catches a best allocation that overspends", () => {
    expect(
      errorsFor({ bestAllocation: [{ interventionId: "iv-payout", sprints: 9, rupees: 400 }] }),
    ).toMatch(/above the 3 available/);
  });

  it("catches a best allocation naming an intervention that does not exist", () => {
    expect(
      errorsFor({ bestAllocation: [{ interventionId: "ghost", sprints: 1, rupees: 100 }] }),
    ).toMatch(/unknown intervention/);
  });

  it("catches a drilldown depending on one that does not exist", () => {
    const scenario = fixtureScenario();
    expect(
      errorsFor({
        drilldowns: scenario.drilldowns.map((d) =>
          d.id === "d-riders" ? { ...d, dependsOn: ["ghost"] } : d,
        ),
      }),
    ).toMatch(/depends on unknown/);
  });

  it("catches an intervention that can never ship", () => {
    const scenario = fixtureScenario();
    expect(
      errorsFor({
        interventions: scenario.interventions.map((iv) =>
          iv.id === "iv-payout" ? { ...iv, minSprints: 9 } : iv,
        ),
      }),
    ).toMatch(/never ship/);
  });

  it("catches colliding panel ids, which would collide as React keys", () => {
    const scenario = fixtureScenario();
    expect(
      errorsFor({
        drilldowns: scenario.drilldowns.map((d) =>
          d.id === "d-funnel"
            ? { ...d, reveals: [{ id: "p-city", kind: "note", title: "x", body: "y" }] }
            : d,
        ),
      }),
    ).toMatch(/Duplicate panel id/);
  });

  it("catches an empty trueCauseIds", () => {
    expect(errorsFor({ trueCauseIds: [] })).toMatch(/trueCauseIds is empty/);
  });

  it("reports every problem at once rather than only the first", () => {
    const errors = validateScenario(
      fixtureScenario({ northStar: "invented", trueCauseIds: [], horizonQuarters: 0 }),
    );
    expect(errors.length).toBeGreaterThanOrEqual(3);
    expect(errors.join(" | ")).toMatch(/horizonQuarters/);
  });

  it("still resolves the true cause it was given", () => {
    expect(validateScenario(fixtureScenario({ trueCauseIds: [CAUSE_TRUE] }))).toEqual([]);
  });
});
