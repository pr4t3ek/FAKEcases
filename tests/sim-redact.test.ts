/**
 * The leak test.
 *
 * A server component serialises whatever it hands a client component into the
 * RSC payload, so anything on the client object is readable in the page source.
 * These assertions are deliberately made against the *serialised* projection
 * rather than its typed shape: a field smuggled in through a nested object or a
 * spread would satisfy the types and still put the answer on the page.
 */

import { describe, expect, it } from "vitest";
import { toClientScenario } from "@/lib/sim/redact";
import { CAUSE_TRUE, fixtureScenario } from "./sim-fixture";

const scenario = fixtureScenario();

const serialise = (owned: string[] = [], phase: "observe" | "investigate" | "commit" = "investigate") =>
  JSON.stringify(toClientScenario(scenario, { phase, owned }));

describe("toClientScenario", () => {
  /**
   * Every cause id ships — they are the options in the picker, and withholding
   * them would leave nothing to choose from. What must not ship is *which one
   * is true*, so the real invariant is that the answer is indistinguishable
   * from the decoys rather than that it is absent.
   */
  it("ships the true cause looking exactly like every decoy", () => {
    const client = toClientScenario(scenario, { phase: "investigate", owned: [] });
    const trueCause = client.causes.find((c) => c.id === CAUSE_TRUE);
    expect(trueCause).toBeDefined();

    const shape = (o: object) => Object.keys(o).sort().join(",");
    const shapes = new Set(client.causes.map(shape));
    expect(shapes.size).toBe(1);
    expect([...shapes][0]).toBe("id,label,parentId");
  });

  it("never ships which causes are the true ones", () => {
    const client = toClientScenario(scenario, { phase: "investigate", owned: [] });
    expect(client).not.toHaveProperty("trueCauseIds");
    // Nor smuggled onto a cause under another name.
    for (const cause of client.causes) {
      expect(Object.values(cause)).not.toContain(true);
    }
  });

  it("never ships a cause verdict", () => {
    const payload = serialise();
    for (const cause of scenario.causes) {
      expect(payload).not.toContain(cause.verdict);
    }
  });

  it("never ships an unbought reveal", () => {
    const payload = serialise(["d-city"]);
    // The one that was bought is present...
    expect(payload).toContain("Tier-2 is down 30%.");
    // ...and nothing else is.
    expect(payload).not.toContain("Checkout is flat.");
    expect(payload).not.toContain("Tier-2 riders down 22%.");
  });

  it("ships nothing revealed at all before anything is bought", () => {
    const payload = serialise([]);
    for (const drilldown of scenario.drilldowns) {
      for (const panel of drilldown.reveals) {
        expect(payload).not.toContain(panel.id);
      }
    }
  });

  it("never ships what a pull is evidence for", () => {
    // Three pulls flagged for one cause is itself a steer toward the answer.
    const client = toClientScenario(scenario, { phase: "investigate", owned: [] });
    for (const d of client.drilldowns) {
      expect(d).not.toHaveProperty("evidenceFor");
      expect(d).not.toHaveProperty("readsAs");
    }
  });

  it("never ships which intervention is on target, or what it does", () => {
    const payload = serialise();
    const client = toClientScenario(scenario, { phase: "investigate", owned: [] });
    for (const iv of client.interventions) {
      expect(iv).not.toHaveProperty("addresses");
      expect(iv).not.toHaveProperty("effects");
      expect(iv).not.toHaveProperty("debrief");
    }
    for (const iv of scenario.interventions) {
      expect(payload).not.toContain(iv.debrief);
    }
  });

  it("never ships the debrief, the drivers, the drift or the answers", () => {
    const payload = serialise();
    const client = toClientScenario(scenario, { phase: "investigate", owned: [] });

    expect(client).not.toHaveProperty("trueCauseIds");
    expect(client).not.toHaveProperty("drivers");
    expect(client).not.toHaveProperty("drift");
    expect(client).not.toHaveProperty("bestAllocation");
    expect(client).not.toHaveProperty("parInvestigation");
    expect(client).not.toHaveProperty("debrief");
    expect(client).not.toHaveProperty("coachFallback");

    for (const line of scenario.debrief.causalChain) {
      expect(payload).not.toContain(line);
    }
    expect(payload).not.toContain(scenario.debrief.whereTheLeverageWas);
    expect(payload).not.toContain(scenario.debrief.strongAnswer);
    expect(payload).not.toContain(scenario.coachFallback[0].answer);
  });

  it("still ships everything the candidate needs to play", () => {
    const client = toClientScenario(scenario, { phase: "investigate", owned: [] });

    expect(client.title).toBe(scenario.title);
    expect(client.situation).toBe(scenario.situation);
    expect(client.budget).toEqual(scenario.budget);
    expect(client.panels.map((p) => p.id)).toEqual(["p-orders"]);
    expect(client.drilldowns).toHaveLength(scenario.drilldowns.length);
    expect(client.causes.map((c) => c.label)).toEqual(scenario.causes.map((c) => c.label));
    expect(client.interventions.map((i) => i.pitch)).toEqual(
      scenario.interventions.map((i) => i.pitch),
    );
  });

  it("marks what is owned and what is still locked", () => {
    const client = toClientScenario(scenario, { phase: "investigate", owned: ["d-city"] });
    const byId = new Map(client.drilldowns.map((d) => [d.id, d]));

    expect(byId.get("d-city")?.owned).toBe(true);
    expect(byId.get("d-riders")?.owned).toBe(false);
    // Its prerequisite is bought, so it is open now.
    expect(byId.get("d-riders")?.unlocked).toBe(true);
  });

  it("locks a dependent pull until its prerequisite is bought", () => {
    const client = toClientScenario(scenario, { phase: "investigate", owned: [] });
    const riders = client.drilldowns.find((d) => d.id === "d-riders");
    expect(riders?.unlocked).toBe(false);
  });
});

/**
 * The metric map exposes the *shape* of the model, which on a hard scenario is
 * part of what the candidate has to work out. These pin both arms, because
 * getting the gate backwards would silently hand away the insight NukkadEats is
 * built around.
 */
describe("toClientScenario: the metric map gate", () => {
  const teaching = {
    primer: {
      intro: "You are running a campaign.",
      terms: [
        {
          term: "ROAS",
          full: "Return on ad spend",
          plain: "How many rupees of sales came back for each rupee spent on ads.",
          formula: "revenue from ads ÷ ad spend",
          matters: "It tells you nothing about profit on its own.",
        },
      ],
    },
    showMetricMap: true,
  };

  it("withholds the map when a scenario does not opt in", () => {
    const client = toClientScenario(scenario, { phase: "investigate", owned: [] });
    expect(client.metricMap).toBeNull();
    expect(client.teaching).toBeNull();
    // And no driver graph leaks in by another name.
    expect(JSON.stringify(client)).not.toContain("goodDirection");
  });

  it("ships the map when the scenario opts in", () => {
    const teaching_ = fixtureScenario({ teaching });
    const client = toClientScenario(teaching_, { phase: "investigate", owned: [] });
    expect(client.metricMap).toHaveLength(teaching_.drivers.length);
    expect(client.metricMap?.find((n) => n.id === "revenue")?.formula).toBe("Orders × AOV");
  });

  it("ships the primer, which is the opposite of the answer", () => {
    const client = toClientScenario(fixtureScenario({ teaching }), {
      phase: "observe",
      owned: [],
    });
    expect(client.teaching?.primer.terms[0].term).toBe("ROAS");
  });

  // The map explains how metrics relate. It must not reveal which lever moves
  // them, or it becomes a free drilldown.
  it("still withholds drift and every intervention effect with the map on", () => {
    const withMap = fixtureScenario({ teaching });
    const payload = JSON.stringify(
      toClientScenario(withMap, { phase: "investigate", owned: [] }),
    );

    expect(payload).not.toContain("whenRootCause");
    expect(payload).not.toContain("otherwise");
    // Not `CAUSE_TRUE` — cause ids ship as picker options, and the invariant is
    // that the true one is indistinguishable from the decoys. See above.
    expect(payload).not.toContain("trueCauseIds");
    expect(payload).not.toContain("bestAllocation");
    for (const iv of withMap.interventions) {
      expect(payload).not.toContain(iv.debrief);
    }
    for (const line of withMap.debrief.causalChain) {
      expect(payload).not.toContain(line);
    }
  });
});
