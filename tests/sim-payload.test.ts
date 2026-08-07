import { describe, expect, it } from "vitest";
import { parseAllocation, parseDiagnosis, parseHypothesis } from "@/lib/sim/payload";
import { CAUSE_TRUE, CAUSE_WRONG_LEAF, fixtureScenario } from "./sim-fixture";

const scenario = fixtureScenario();

/**
 * A commit, in the two steps the server now takes.
 *
 * The diagnosis is locked first and the allocation is checked against it, so
 * this helper mirrors `lockDiagnosis` followed by `commitDecision` rather than
 * the single payload the client used to send. A failure in either half is a
 * failed commit, which is what the assertions below mean.
 */
const commit = (over: { diagnosis?: unknown; allocation?: unknown } = {}) => {
  const diagnosis = parseDiagnosis(scenario, over.diagnosis ?? [CAUSE_TRUE]);
  if (!diagnosis.ok) return diagnosis;
  return parseAllocation(
    scenario,
    diagnosis.value,
    over.allocation ?? [{ interventionId: "iv-payout", sprints: 2, rupees: 400 }],
  );
};

describe("parseHypothesis", () => {
  it("accepts a single known cause", () => {
    const result = parseHypothesis(scenario, [CAUSE_TRUE]);
    expect(result).toEqual({ ok: true, value: [CAUSE_TRUE] });
  });

  it("rejects an empty hypothesis", () => {
    expect(parseHypothesis(scenario, []).ok).toBe(false);
  });

  // Uncapped, "name every branch" would guarantee a hit and predict nothing.
  it("rejects more suspects than the cap allows", () => {
    const result = parseHypothesis(scenario, [CAUSE_TRUE, CAUSE_WRONG_LEAF, "supply"]);
    expect(result.ok).toBe(false);
  });

  it("rejects a duplicate suspect padding the list", () => {
    expect(parseHypothesis(scenario, [CAUSE_TRUE, CAUSE_TRUE]).ok).toBe(false);
  });

  it("rejects a cause that does not exist", () => {
    expect(parseHypothesis(scenario, ["invented"]).ok).toBe(false);
  });

  it("rejects a non-array payload", () => {
    expect(parseHypothesis(scenario, CAUSE_TRUE).ok).toBe(false);
  });

  // "supply" is a root — an area, not a hypothesis. The Observe picker never
  // offered roots, so this was only ever reachable by a hand-rolled request,
  // and it earned `ancestorCredit` (55%) for naming nothing in particular.
  it("rejects a root cause: an area is not a hypothesis", () => {
    const result = parseHypothesis(scenario, ["supply"]);
    expect(result.ok).toBe(false);
    expect(result.ok ? null : result.error).toMatch(/specific cause/i);
  });

  it("rejects a root smuggled in beside a leaf", () => {
    expect(parseHypothesis(scenario, [CAUSE_TRUE, "demand"]).ok).toBe(false);
  });

  it("still calls an unknown id unknown rather than an area", () => {
    // Refine order matters: both checks fail for an invented id, and only the
    // first issue is surfaced.
    const result = parseHypothesis(scenario, ["invented"]);
    expect(result.ok ? null : result.error).toMatch(/unknown/i);
  });
});

describe("parseCommit", () => {
  it("accepts a well-formed commitment", () => {
    const result = commit();
    expect(result.ok).toBe(true);
  });

  // The UI caps the sliders; this is the check that actually holds, because the
  // server action can be called directly.
  it("rejects an allocation that overspends sprints", () => {
    const result = commit({
      allocation: [{ interventionId: "iv-payout", sprints: 99, rupees: 400 }],
    });
    expect(result).toEqual({ ok: false, error: "Allocation exceeds the available capacity" });
  });

  it("rejects an allocation that overspends the budget", () => {
    const result = commit({
      allocation: [{ interventionId: "iv-payout", sprints: 2, rupees: 99999 }],
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a negative amount", () => {
    expect(
      commit({ allocation: [{ interventionId: "iv-payout", sprints: -1, rupees: 400 }] }).ok,
    ).toBe(false);
  });

  it("rejects a fractional sprint", () => {
    expect(
      commit({ allocation: [{ interventionId: "iv-payout", sprints: 1.5, rupees: 400 }] }).ok,
    ).toBe(false);
  });

  it("rejects an unknown intervention", () => {
    expect(
      commit({ allocation: [{ interventionId: "iv-ghost", sprints: 1, rupees: 100 }] }).ok,
    ).toBe(false);
  });

  it("rejects the same intervention funded twice", () => {
    const result = commit({
      allocation: [
        { interventionId: "iv-payout", sprints: 1, rupees: 200 },
        { interventionId: "iv-payout", sprints: 1, rupees: 200 },
      ],
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a line that funds nothing", () => {
    expect(
      commit({ allocation: [{ interventionId: "iv-payout", sprints: 0, rupees: 0 }] }).ok,
    ).toBe(false);
  });

  it("rejects an empty allocation", () => {
    expect(commit({ allocation: [] }).ok).toBe(false);
  });

  it("rejects an unknown diagnosis", () => {
    expect(commit({ diagnosis: ["invented"] }).ok).toBe(false);
  });

  it("rejects more causes than the cap allows", () => {
    expect(commit({ diagnosis: [CAUSE_TRUE, CAUSE_WRONG_LEAF, "supply"] }).ok).toBe(false);
  });

  // The commit picker used to offer exactly this, as "Somewhere in supply".
  // Naming an area is a hedge, not a diagnosis, and the schema is what makes
  // removing the button more than a cosmetic change.
  it("rejects a root diagnosis", () => {
    const result = commit({ diagnosis: ["supply"] });
    expect(result.ok).toBe(false);
    expect(result.ok ? null : result.error).toMatch(/specific cause/i);
  });

  it("rejects a non-finite amount", () => {
    expect(
      commit({
        allocation: [{ interventionId: "iv-payout", sprints: 2, rupees: Number.POSITIVE_INFINITY }],
      }).ok,
    ).toBe(false);
  });
});
