/**
 * When the hypothesis may still be changed.
 *
 * The rule the whole reversibility change turns on: freely changeable until it
 * has cost you something, final afterwards. Getting the boundary wrong in
 * either direction breaks something real — too early and a misclick sets a
 * score the candidate can never influence; too late and a hypothesis can be
 * revised in the light of evidence, which makes scoring it meaningless.
 */

import { describe, expect, it } from "vitest";
import { hypothesisEditFor, SIM_PHASES, type SimPhase } from "@/lib/types";

describe("hypothesisEditFor", () => {
  it("advances the phase when set for the first time", () => {
    expect(hypothesisEditFor("observe", 0)).toBe("advance");
  });

  it("still advances if a run somehow has purchases while in observe", () => {
    // Not reachable through the UI, but the rule should not depend on that.
    expect(hypothesisEditFor("observe", 3)).toBe("advance");
  });

  it("allows an amend while investigating and nothing has been bought", () => {
    expect(hypothesisEditFor("investigate", 0)).toBe("amend");
  });

  // The integrity rule. A hypothesis revised after seeing evidence is not a
  // hypothesis, so the window closes on the first purchase — not on the phase.
  it("locks the moment one pull has been bought", () => {
    expect(hypothesisEditFor("investigate", 1)).toBe("locked");
    expect(hypothesisEditFor("investigate", 9)).toBe("locked");
  });

  it("locks once the run has moved past investigating", () => {
    expect(hypothesisEditFor("commit", 0)).toBe("locked");
    expect(hypothesisEditFor("debrief", 0)).toBe("locked");
  });

  it("never returns anything but the three known outcomes", () => {
    for (const phase of SIM_PHASES) {
      for (const purchases of [0, 1, 5]) {
        expect(["advance", "amend", "locked"]).toContain(
          hypothesisEditFor(phase as SimPhase, purchases),
        );
      }
    }
  });
});
