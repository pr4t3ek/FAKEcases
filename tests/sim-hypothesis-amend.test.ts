/**
 * When the hypothesis may still be changed.
 *
 * The window used to close at the first purchase, on the argument that a
 * hypothesis revised in the light of evidence is not a hypothesis. Play-testing
 * found the half of that argument it got wrong: a prediction you may not revise
 * when the data contradicts it is not a hypothesis either. A candidate who
 * bought the pull that disproved their opening call had no way to say so, and
 * watched the rest of the run proceed under a belief they no longer held.
 *
 * So the boundary moved to Commit, and the integrity it was protecting moved to
 * where it belongs — `scoreInvestigation` judges each pull against the belief
 * standing when it was bought (`hypothesisAtPurchase`), so revising to match
 * what you happened to buy earns nothing. That pair of tests lives in
 * `tests/sim-score.test.ts`; this file is the boundary itself.
 */

import { describe, expect, it } from "vitest";
import { hypothesisEditFor, SIM_PHASES, type SimPhase } from "@/lib/types";

describe("hypothesisEditFor", () => {
  it("advances the phase when set for the first time", () => {
    expect(hypothesisEditFor("observe")).toBe("advance");
  });

  it("allows an amend throughout the investigation", () => {
    // The change. Buying data is what should *prompt* a revision, not what
    // forbids one.
    expect(hypothesisEditFor("investigate")).toBe("amend");
  });

  it("locks once the run has moved on to deciding", () => {
    // Commit is where it freezes, and that boundary is what keeps Hypothesis
    // and Diagnosis measuring different things: the first is your read given
    // the data you chose to buy, the second is your final answer with the
    // fixes in view.
    expect(hypothesisEditFor("commit")).toBe("locked");
    expect(hypothesisEditFor("debrief")).toBe("locked");
  });

  it("never returns anything but the three known outcomes", () => {
    for (const phase of SIM_PHASES) {
      expect(["advance", "amend", "locked"]).toContain(hypothesisEditFor(phase as SimPhase));
    }
  });

  it("no longer depends on what has been bought", () => {
    // The regression that says the old rule is gone rather than merely
    // loosened: nothing about the purchase count can reach this decision,
    // because it is not an argument any more.
    expect(hypothesisEditFor.length).toBe(1);
  });
});
