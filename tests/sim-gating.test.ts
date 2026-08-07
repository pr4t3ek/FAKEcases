import { describe, expect, it } from "vitest";
import {
  causesWithNoIntervention,
  interventionsByLeaf,
  permittedInterventions,
  permittedInterventionIds,
} from "@/lib/sim/gating";
import { parseAllocation, parseDiagnosis } from "@/lib/sim/payload";
import { runOutcome } from "@/lib/sim/outcome";
import { scoreSimulation } from "@/lib/sim/score";
import { CAUSE_TRUE, CAUSE_WRONG_LEAF, fixtureScenario } from "./sim-fixture";

/**
 * The investment gate.
 *
 * `runOutcome` reads `scenario.trueCauseIds` and not the student's claim, which
 * is correct — the world does not care what you believed — but it meant a run
 * could name the wrong cause and still fund the fix that works. These pin that
 * the allocation is now unconstructible rather than merely penalised.
 */

const scenario = fixtureScenario();

describe("permittedInterventions", () => {
  it("permits nothing before a cause is named", () => {
    expect(permittedInterventions(scenario, [])).toEqual([]);
    expect(permittedInterventionIds(scenario, []).size).toBe(0);
  });

  it("permits exactly the fixes that address the named cause", () => {
    const ids = permittedInterventions(scenario, [CAUSE_TRUE])
      .map((i) => i.id)
      .sort();
    expect(ids).toEqual(["iv-payout", "iv-rebuild"]);
  });

  it("permits only the decoy's own fix when the wrong cause is named", () => {
    const ids = permittedInterventions(scenario, [CAUSE_WRONG_LEAF]).map((i) => i.id);
    expect(ids).toEqual(["iv-discount"]);
  });

  it("unions the slates when two causes are named", () => {
    const ids = permittedInterventions(scenario, [CAUSE_TRUE, CAUSE_WRONG_LEAF])
      .map((i) => i.id)
      .sort();
    expect(ids).toEqual(["iv-discount", "iv-payout", "iv-rebuild"]);
  });

  it("never resolves descendants: a root unlocks nothing", () => {
    // If naming an area unlocked every fix beneath it, the root would be the
    // optimal shotgun and the gate would be pointless. `diagnosisSchema` also
    // refuses roots — this is the second lock on the same door.
    expect(permittedInterventions(scenario, ["supply"])).toEqual([]);
    expect(permittedInterventions(scenario, ["demand"])).toEqual([]);
  });

  it("permits nothing for a cause no intervention addresses", () => {
    const orphaned = fixtureScenario({
      causes: [
        ...scenario.causes,
        { id: "external.rain", parentId: "demand", label: "Monsoon", verdict: "Weather." },
      ],
    });
    expect(permittedInterventions(orphaned, ["external.rain"])).toEqual([]);
  });
});

describe("interventionsByLeaf / causesWithNoIntervention", () => {
  it("groups every intervention under the cause it addresses", () => {
    const byLeaf = interventionsByLeaf(scenario);
    expect(byLeaf.get(CAUSE_TRUE)?.sort()).toEqual(["iv-payout", "iv-rebuild"]);
    expect(byLeaf.get(CAUSE_WRONG_LEAF)).toEqual(["iv-discount"]);
  });

  it("finds leaves with nothing behind them, and ignores roots", () => {
    expect(causesWithNoIntervention(scenario)).toEqual([]);

    const orphaned = fixtureScenario({
      causes: [
        ...scenario.causes,
        { id: "external.rain", parentId: "demand", label: "Monsoon", verdict: "Weather." },
      ],
    });
    // Roots never appear — they cannot be named in the first place.
    expect(causesWithNoIntervention(orphaned)).toEqual(["external.rain"]);
  });
});

describe("the allocation a wrong diagnosis can build", () => {
  const fund = (diagnosis: string[], interventionId: string) => {
    const parsed = parseDiagnosis(scenario, diagnosis);
    if (!parsed.ok) return parsed;
    return parseAllocation(scenario, parsed.value, [
      { interventionId, sprints: 2, rupees: 400 },
    ]);
  };

  it("refuses to fund the real fix for a run that named the wrong cause", () => {
    // The bug, in one assertion. This used to parse cleanly and score 100 on
    // both decision and outcome.
    const result = fund([CAUSE_WRONG_LEAF], "iv-payout");
    expect(result.ok).toBe(false);
    expect(result.ok ? null : result.error).toMatch(/doesn't address the cause you named/i);
  });

  it("still funds the real fix for a run that named the real cause", () => {
    expect(fund([CAUSE_TRUE], "iv-payout").ok).toBe(true);
  });

  it("refuses an empty allocation while there is still something to fund", () => {
    const parsed = parseDiagnosis(scenario, [CAUSE_TRUE]);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parseAllocation(scenario, parsed.value, []).ok).toBe(false);
  });

  it("accepts an empty allocation when the named cause has no fix at all", () => {
    // Holding the capacity is the honest answer to a cause nothing addresses —
    // see `SimCause.unactionable`. Without this the student would be stuck on a
    // screen with no legal move.
    const orphaned = fixtureScenario({
      causes: [
        ...scenario.causes,
        {
          id: "external.rain",
          parentId: "demand",
          label: "Monsoon",
          verdict: "Weather.",
          unactionable: { why: "Nobody funds a fix for the weather." },
        },
      ],
    });
    const parsed = parseDiagnosis(orphaned, ["external.rain"]);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const allocation = parseAllocation(orphaned, parsed.value, []);
    expect(allocation).toEqual({ ok: true, value: [] });
  });

  it("scores an unfunded quarter as the do-nothing path", () => {
    // The consequence has to be real, not just permitted: an empty allocation
    // runs the counterfactual the engine already computes, and the outcome
    // score is the floor.
    const outcome = runOutcome(scenario, []);
    expect(outcome.paths).toEqual(outcome.doNothing);

    const score = scoreSimulation({
      scenario,
      hypothesis: [CAUSE_WRONG_LEAF],
      purchases: [],
      diagnosis: [CAUSE_WRONG_LEAF],
      allocation: [],
      outcome,
    });
    expect(score.scores.outcome).toBe(0);
    expect(score.scores.decision).toBe(0);
    expect(score.causeFound).toBe(false);
  });
});
