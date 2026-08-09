/**
 * The validator exists because `DriverId` and `CauseId` are string aliases, so
 * every cross-reference in a scenario compiles whether or not it resolves. Each
 * case below is an authoring mistake that would otherwise ship silently.
 */

import { describe, expect, it } from "vitest";
import { validateScenario } from "@/lib/sim/validate";
import type { SimPanel } from "@/lib/sim/types";
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

  /**
   * A statement panel is authored figures rather than a projection of the driver
   * graph, so none of the checks above can see inside one. These are the slips
   * that render as a broken document rather than as an error.
   */
  describe("statement panels", () => {
    const withStatement = (panel: SimPanel) =>
      errorsFor({ dashboard: [...fixtureScenario().dashboard, panel] });

    const statement = (over: Partial<Extract<SimPanel, { kind: "statement" }>> = {}) =>
      ({
        id: "p-statement",
        kind: "statement",
        statement: "pnl",
        title: "P&L",
        unit: "inr",
        periods: ["FY25"],
        sections: [{ lines: [{ label: "Revenue", value: 100 }] }],
        ...over,
      }) as SimPanel;

    it("passes a well-formed statement", () => {
      expect(withStatement(statement())).toBe("");
    });

    it("catches a statement with no lines at all", () => {
      expect(withStatement(statement({ sections: [{ title: "Empty", lines: [] }] }))).toMatch(
        /has no lines/,
      );
    });

    // A "FY25 / FY24" header over rows carrying only this year prints a column
    // of em-dashes, and the reverse silently drops last year from the page.
    it("catches prior-period values with only one period header", () => {
      expect(
        withStatement(
          statement({ sections: [{ lines: [{ label: "Revenue", value: 100, priorValue: 90 }] }] }),
        ),
      ).toMatch(/only one period header/);
    });

    it("catches two period headers with no prior-period values", () => {
      expect(withStatement(statement({ periods: ["FY25", "FY24"] }))).toMatch(
        /two period headers and no prior-period values/,
      );
    });

    it("catches a repeated line label, which would collide as a React key", () => {
      expect(
        withStatement(
          statement({
            sections: [
              { title: "A", lines: [{ label: "Revenue", value: 100 }] },
              { title: "B", lines: [{ label: "Revenue", value: 50 }] },
            ],
          }),
        ),
      ).toMatch(/repeats the line "Revenue"/);
    });
  });

  /**
   * "Easy" is a promise to a struggling student, so it is enforced rather than
   * trusted — otherwise the beginner track drifts back toward NukkadEats one
   * scenario at a time.
   */
  describe("Easy difficulty caps", () => {
    const easy = (over: Parameters<typeof fixtureScenario>[0] = {}) =>
      validateScenario(
        fixtureScenario({
          difficulty: "Easy",
          teaching: {
            primer: { intro: "x", terms: [{ term: "T", plain: "p", matters: "m" }] },
            showMetricMap: true,
          },
          budget: { analystDays: 6, sprints: 3, rupees: 700 },
          ...over,
        }),
      ).join(" | ");

    it("passes a scenario that is genuinely small", () => {
      expect(easy()).toBe("");
    });

    it("rejects too many drilldowns", () => {
      const scenario = fixtureScenario();
      const many = Array.from({ length: 7 }, (_, i) => ({
        ...scenario.drilldowns[0],
        id: `dd-${i}`,
        reveals: [{ id: `p-${i}`, kind: "note" as const, title: "t", body: "b" }],
      }));
      expect(easy({ drilldowns: many, parInvestigation: ["dd-0"] })).toMatch(
        /at most 6 drilldowns/,
      );
    });

    it("rejects too many interventions", () => {
      const scenario = fixtureScenario();
      const many = Array.from({ length: 6 }, (_, i) => ({
        ...scenario.interventions[0],
        id: `iv-${i}`,
      }));
      expect(
        easy({ interventions: many, bestAllocation: [{ interventionId: "iv-0", sprints: 2, rupees: 400 }] }),
      ).toMatch(/at most 5 interventions/);
    });

    it("rejects a cause tree more than one level deep", () => {
      const scenario = fixtureScenario();
      expect(
        easy({
          causes: [
            ...scenario.causes,
            { id: "supply.riders.tier2", parentId: CAUSE_TRUE, label: "Tier 2", verdict: "v" },
          ],
        }),
      ).toMatch(/one level deep/);
    });

    it("insists on a primer, because the jargon is the barrier", () => {
      expect(easy({ teaching: undefined })).toMatch(/must carry a `teaching` primer/);
    });

    it("rejects a budget that is punishing rather than merely scarce", () => {
      expect(easy({ budget: { analystDays: 2, sprints: 3, rupees: 700 } })).toMatch(
        /is punishing/,
      );
    });

    it("leaves harder scenarios alone", () => {
      // The fixture is Medium and breaks several Easy caps by design.
      expect(validateScenario(fixtureScenario())).toEqual([]);
    });
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

  /**
   * Three things the investment gate makes load-bearing.
   *
   * A diagnosis unlocks only the interventions that address it, so a fix aimed
   * at something nobody can name is a fix nobody can buy — which was untidy
   * before and is now a hole in the board.
   */
  describe("the gate's preconditions", () => {
    const base = fixtureScenario();

    it("catches an intervention aimed at an area rather than a branch", () => {
      // "supply" is a root. `diagnosisSchema` accepts leaves only, so nothing
      // addressed to it could ever be funded.
      expect(
        errorsFor({
          interventions: base.interventions.map((iv) =>
            iv.id === "iv-discount" ? { ...iv, addresses: "supply" } : iv,
          ),
        }),
      ).toMatch(/area rather than a branch/i);
    });

    it("catches a best allocation that a correct diagnosis could not fund", () => {
      // `iv-discount` addresses the decoy. Putting it in bestAllocation would
      // set the outcome ceiling somewhere no legal allocation can reach, so
      // scoreOutcome could never return 100.
      expect(
        errorsFor({
          bestAllocation: [{ interventionId: "iv-discount", sprints: 1, rupees: 300 }],
        }),
      ).toMatch(/rather than a true cause/i);
    });

    it("catches a cause marked unactionable that something does address", () => {
      expect(
        errorsFor({
          causes: base.causes.map((c) =>
            c.id === CAUSE_TRUE ? { ...c, unactionable: { why: "Weather." } } : c,
          ),
        }),
      ).toMatch(/marked unactionable but an intervention addresses it/i);
    });

    it("catches an unactionable cause that is also the answer", () => {
      const withOrphan = fixtureScenario({
        causes: [
          ...base.causes,
          {
            id: "external.rain",
            parentId: "demand",
            label: "Monsoon",
            verdict: "Weather.",
            unactionable: { why: "Nobody funds a fix for the weather." },
          },
        ],
        trueCauseIds: ["external.rain"],
      });
      expect(validateScenario(withOrphan).join(" | ")).toMatch(/cannot be won/i);
    });

    it("accepts an unactionable cause that is merely a decoy", () => {
      // The point of the annotation: some causes are honestly unfixable, and
      // saying so beats inventing a fix for a monsoon.
      const withOrphan = fixtureScenario({
        causes: [
          ...base.causes,
          {
            id: "external.rain",
            parentId: "demand",
            label: "Monsoon",
            verdict: "Weather.",
            unactionable: { why: "Nobody funds a fix for the weather." },
          },
        ],
      });
      expect(validateScenario(withOrphan)).toEqual([]);
    });
  });

  /**
   * The kinds that carry state across periods. `driverOrder` cannot catch a
   * mistake in a `lagged` reference at all — it reports no dependency, so a
   * typo is invisible to the topological sort and would surface as a number
   * that silently never changes.
   */
  describe("stateful drivers", () => {
    const withDriver = (driver: unknown) => {
      const scenario = fixtureScenario();
      scenario.drivers = [...scenario.drivers, driver as never];
      return validateScenario(scenario).join(" | ");
    };

    const base = { label: "X", unit: "count" as const, goodDirection: "up" as const };

    it("rejects a stock whose flows do not resolve", () => {
      expect(
        withDriver({ ...base, id: "s1", kind: "stock", initial: 5, inflow: "nope", outflow: "nah" }),
      ).toMatch(/unknown inflow "nope"[\s\S]*unknown outflow "nah"/);
    });

    it("rejects a stock that feeds on itself", () => {
      expect(
        withDriver({ ...base, id: "s2", kind: "stock", initial: 5, inflow: "s2", outflow: "s2" }),
      ).toMatch(/uses itself/);
    });

    it("rejects a stock that opens below its own floor", () => {
      const scenario = fixtureScenario();
      const flow = scenario.drivers[0].id;
      scenario.drivers = [
        ...scenario.drivers,
        { ...base, id: "s3", kind: "stock", initial: 0, floor: 10, inflow: flow, outflow: flow } as never,
      ];
      expect(validateScenario(scenario).join(" | ")).toMatch(/below its own floor/);
    });

    it("rejects a lagged driver reading a name that does not exist", () => {
      expect(withDriver({ ...base, id: "l1", kind: "lagged", of: "ghost", initial: 1 })).toMatch(
        /reads unknown driver "ghost"/,
      );
    });

    it("rejects a lagged driver reading itself", () => {
      expect(withDriver({ ...base, id: "l2", kind: "lagged", of: "l2", initial: 1 })).toMatch(
        /reads itself/,
      );
    });

    it("rejects looking back less than a period", () => {
      const scenario = fixtureScenario();
      const any = scenario.drivers[0].id;
      scenario.drivers = [
        ...scenario.drivers,
        { ...base, id: "l3", kind: "lagged", of: any, periods: 0, initial: 1 } as never,
      ];
      expect(validateScenario(scenario).join(" | ")).toMatch(/at least one period/);
    });

    it("rejects a one-sided constraint — that is an alias, not a bottleneck", () => {
      const scenario = fixtureScenario();
      const any = scenario.drivers[0].id;
      scenario.drivers = [
        ...scenario.drivers,
        { ...base, id: "m1", kind: "min", of: [any] } as never,
      ];
      expect(validateScenario(scenario).join(" | ")).toMatch(/fewer than two inputs/);
    });

    it("refuses an intervention aimed at a stock — target its flows instead", () => {
      const scenario = fixtureScenario();
      const flow = scenario.drivers[0].id;
      scenario.drivers = [
        ...scenario.drivers,
        { ...base, id: "s4", kind: "stock", initial: 5, inflow: flow, outflow: flow } as never,
      ];
      scenario.interventions[0].effects.whenRootCause = [{ driver: "s4", deltaPct: 0.1 }];
      expect(validateScenario(scenario).join(" | ")).toMatch(/derived driver "s4" and would do nothing/);
    });
  });


  /**
   * The bug this caught: a stat tile authored as `12 * CRORE` with unit
   * `inr_crore` renders as "₹120000000.00 cr", because `formatValue` appends the
   * unit to the number as-is. Nothing else would have found it — panel copy has
   * no test, and the twelve war rooms all happen to get it right.
   */
  describe("panel denominations", () => {
    const withPanel = (panel: unknown) =>
      validateScenario(
        fixtureScenario({ dashboard: [...fixtureScenario().dashboard, panel as never] }),
      ).join(" | ");

    it("catches a stat tile authored in rupees but labelled crore", () => {
      expect(
        withPanel({
          id: "p-bad",
          kind: "stat",
          title: "Position",
          tiles: [{ label: "Cash", value: 120_000_000, unit: "inr_crore" }],
        }),
      ).toMatch(/looks like raw rupees/);
    });

    it("catches it in a segment row and in a series", () => {
      expect(
        withPanel({
          id: "p-bad2",
          kind: "segments",
          title: "Split",
          dimension: "Line",
          rows: [{ label: "Salaries", value: 66_000_000, unit: "inr_lakh" }],
        }),
      ).toMatch(/looks like raw rupees/);
      expect(
        withPanel({
          id: "p-bad3",
          kind: "timeseries",
          title: "Cash",
          series: [
            { label: "Cash", unit: "inr_crore", points: [{ period: "Q-0", value: 120_000_000 }] },
          ],
        }),
      ).toMatch(/looks like raw rupees/);
    });

    it("accepts a genuine crore figure, and rupees under the auto-scaling unit", () => {
      expect(
        withPanel({
          id: "p-ok",
          kind: "stat",
          title: "Position",
          tiles: [
            { label: "Cash", value: 12, unit: "inr_crore" },
            { label: "Cash again", value: 120_000_000, unit: "inr" },
          ],
        }),
      ).toBe("");
    });
  });

});
