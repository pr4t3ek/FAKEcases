import { describe, expect, it } from "vitest";
import { parseCommit, parseHypothesis } from "@/lib/sim/payload";
import { CAUSE_TRUE, CAUSE_WRONG_LEAF, fixtureScenario } from "./sim-fixture";

const scenario = fixtureScenario();

const commit = (over: Record<string, unknown> = {}) =>
  parseCommit(scenario, {
    diagnosis: [CAUSE_TRUE],
    allocation: [{ interventionId: "iv-payout", sprints: 2, rupees: 400 }],
    ...over,
  });

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

  it("rejects a non-finite amount", () => {
    expect(
      commit({
        allocation: [{ interventionId: "iv-payout", sprints: 2, rupees: Number.POSITIVE_INFINITY }],
      }).ok,
    ).toBe(false);
  });
});
