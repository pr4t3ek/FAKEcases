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
import { toClientScenario, type RedactionContext } from "@/lib/sim/redact";
import { CAUSE_TRUE, CAUSE_WRONG_LEAF, fixtureScenario } from "./sim-fixture";

const scenario = fixtureScenario();

/**
 * A redaction context, defaulting to mid-investigation with nothing named.
 *
 * `diagnosis: []` is the important default — it is the state a run is in for
 * everything up to the moment it commits to a cause, and the one where the
 * intervention list has to be empty.
 */
const ctx = (
  over: Partial<RedactionContext> = {},
): RedactionContext => ({
  phase: "investigate",
  owned: [],
  diagnosis: [],
  ...over,
});

const serialise = (owned: string[] = [], phase: "observe" | "investigate" | "commit" = "investigate") =>
  JSON.stringify(toClientScenario(scenario, ctx({ phase, owned })));

describe("toClientScenario", () => {
  /**
   * Every cause id ships — they are the options in the picker, and withholding
   * them would leave nothing to choose from. What must not ship is *which one
   * is true*, so the real invariant is that the answer is indistinguishable
   * from the decoys rather than that it is absent.
   */
  it("ships the true cause looking exactly like every decoy", () => {
    const client = toClientScenario(scenario, ctx());
    const trueCause = client.causes.find((c) => c.id === CAUSE_TRUE);
    expect(trueCause).toBeDefined();

    const shape = (o: object) => Object.keys(o).sort().join(",");
    const shapes = new Set(client.causes.map(shape));
    expect(shapes.size).toBe(1);
    expect([...shapes][0]).toBe("id,label,parentId");
  });

  it("never ships which causes are the true ones", () => {
    const client = toClientScenario(scenario, ctx());
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
    const client = toClientScenario(scenario, ctx());
    for (const d of client.drilldowns) {
      expect(d).not.toHaveProperty("evidenceFor");
      expect(d).not.toHaveProperty("readsAs");
    }
  });

  it("never ships which intervention is on target, or what it does", () => {
    const payload = serialise();
    const client = toClientScenario(scenario, ctx());
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
    const client = toClientScenario(scenario, ctx());

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
    const client = toClientScenario(scenario, ctx());

    expect(client.title).toBe(scenario.title);
    expect(client.situation).toBe(scenario.situation);
    expect(client.budget).toEqual(scenario.budget);
    expect(client.panels.map((p) => p.id)).toEqual(["p-orders"]);
    expect(client.drilldowns).toHaveLength(scenario.drilldowns.length);
    expect(client.causes.map((c) => c.label)).toEqual(scenario.causes.map((c) => c.label));
  });

  /**
   * The investment gate.
   *
   * Interventions used to ship in full from the first render, which is what let
   * a run name the wrong cause and still fund the right fix. They are now
   * withheld until a diagnosis is locked, and then narrowed to the ones that
   * treat it — enforced here rather than in the UI, because filtering in the
   * client would need `addresses` to cross the wire.
   */
  it("ships no interventions at all before a diagnosis is named", () => {
    const client = toClientScenario(scenario, ctx({ phase: "commit" }));
    expect(client.interventions).toEqual([]);
  });

  it("ships only the interventions that treat the named cause", () => {
    const client = toClientScenario(scenario, ctx({ phase: "commit", diagnosis: [CAUSE_TRUE] }));
    const ids = client.interventions.map((i) => i.id).sort();
    // Both fixes pointed at the true cause, and not the one aimed elsewhere.
    expect(ids).toEqual(["iv-payout", "iv-rebuild"]);
  });

  it("does not leak the fix for the real cause to a run that named the wrong one", () => {
    // The whole point. Serialised rather than inspected field by field, because
    // a leak through a nested object would satisfy the typed shape.
    const payload = JSON.stringify(
      toClientScenario(scenario, ctx({ phase: "commit", diagnosis: [CAUSE_WRONG_LEAF] })),
    );
    expect(payload).not.toContain("iv-payout");
    expect(payload).not.toContain("iv-rebuild");
    expect(payload).not.toContain("Pay riders enough to come back.");
    expect(payload).toContain("iv-discount");
  });

  it("never ships which cause an intervention addresses", () => {
    const client = toClientScenario(scenario, ctx({ phase: "commit", diagnosis: [CAUSE_TRUE] }));
    for (const iv of client.interventions) {
      expect(iv).not.toHaveProperty("addresses");
      expect(iv).not.toHaveProperty("effects");
      expect(iv).not.toHaveProperty("debrief");
    }
  });

  /**
   * `unactionable` marks a cause nothing on the board can fix. Before a
   * diagnosis is locked that is a tell — it separates the causes the scenario
   * can act on from the ones it cannot — so it must not ship, and it must not
   * show up as an extra field on one cause and not the others.
   */
  const withUnactionable = () =>
    fixtureScenario({
      causes: scenario.causes.map((c) =>
        c.id === CAUSE_WRONG_LEAF ? { ...c, unactionable: { why: "A monsoon." } } : c,
      ),
    });

  it("never ships that a cause is unactionable, before it is named", () => {
    const client = toClientScenario(withUnactionable(), ctx());
    expect(JSON.stringify(client.causes)).not.toContain("monsoon");
    expect(client.unactionableNote).toBeNull();

    // And the causes stay indistinguishable from one another.
    const shapes = new Set(client.causes.map((c) => Object.keys(c).sort().join(",")));
    expect(shapes).toEqual(new Set(["id,label,parentId"]));
  });

  it("does not name it either when a different cause is locked", () => {
    const client = toClientScenario(
      withUnactionable(),
      ctx({ phase: "commit", diagnosis: [CAUSE_TRUE] }),
    );
    expect(client.unactionableNote).toBeNull();
  });

  it("explains it once that cause is the one they named", () => {
    // The reveal is the point: having committed to it, they are owed the reason
    // there is nothing to spend against.
    const client = toClientScenario(
      withUnactionable(),
      ctx({ phase: "commit", diagnosis: [CAUSE_WRONG_LEAF] }),
    );
    expect(client.unactionableNote).toBe("A monsoon.");
  });

  it("marks what is owned and what is still locked", () => {
    const client = toClientScenario(scenario, ctx({ owned: ["d-city"] }));
    const byId = new Map(client.drilldowns.map((d) => [d.id, d]));

    expect(byId.get("d-city")?.owned).toBe(true);
    expect(byId.get("d-riders")?.owned).toBe(false);
    // Its prerequisite is bought, so it is open now.
    expect(byId.get("d-riders")?.unlocked).toBe(true);
  });

  it("locks a dependent pull until its prerequisite is bought", () => {
    const client = toClientScenario(scenario, ctx());
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
    const client = toClientScenario(scenario, ctx());
    expect(client.metricMap).toBeNull();
    expect(client.teaching).toBeNull();
    // And no driver graph leaks in by another name.
    expect(JSON.stringify(client)).not.toContain("goodDirection");
  });

  it("ships the map when the scenario opts in", () => {
    const teaching_ = fixtureScenario({ teaching });
    const client = toClientScenario(teaching_, ctx());
    expect(client.metricMap).toHaveLength(teaching_.drivers.length);
    expect(client.metricMap?.find((n) => n.id === "revenue")?.formula).toBe("Orders × AOV");
  });

  it("ships the primer, which is the opposite of the answer", () => {
    const client = toClientScenario(fixtureScenario({ teaching }), ctx({ phase: "observe" }));
    expect(client.teaching?.primer.terms[0].term).toBe("ROAS");
  });

  // The map explains how metrics relate. It must not reveal which lever moves
  // them, or it becomes a free drilldown.
  it("still withholds drift and every intervention effect with the map on", () => {
    const withMap = fixtureScenario({ teaching });
    const payload = JSON.stringify(
      toClientScenario(withMap, ctx()),
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
