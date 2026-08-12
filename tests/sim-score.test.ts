import { describe, expect, it } from "vitest";
import { runOutcome } from "@/lib/sim/outcome";
import {
  ancestorsOf,
  isAncestorOfAny,
  scoreDecision,
  scoreDiagnosisSim,
  scoreHypothesis,
  scoreInvestigation,
  scoreOutcome,
  scoreSimulation,
} from "@/lib/sim/score";
import type { SimPurchaseRecord } from "@/lib/sim/types";
import {
  BEST_ALLOCATION,
  CAUSE_ANCESTOR,
  CAUSE_TRUE,
  CAUSE_WRONG_LEAF,
  fixtureScenario,
} from "./sim-fixture";

const scenario = fixtureScenario();

const buy = (drilldownId: string, cost: number, seq: number): SimPurchaseRecord => ({
  drilldownId,
  cost,
  seq,
});

const PAR_BUY = [buy("d-city", 2, 1)];

describe("ancestorsOf", () => {
  it("walks up to the root", () => {
    expect(ancestorsOf(scenario, CAUSE_TRUE)).toEqual([CAUSE_ANCESTOR]);
  });

  it("returns nothing for a root cause", () => {
    expect(ancestorsOf(scenario, CAUSE_ANCESTOR)).toEqual([]);
  });
});

describe("isAncestorOfAny", () => {
  it("recognises the right region", () => {
    expect(isAncestorOfAny(scenario, CAUSE_ANCESTOR, [CAUSE_TRUE])).toBe(true);
  });

  it("does not count a cause as its own ancestor", () => {
    expect(isAncestorOfAny(scenario, CAUSE_TRUE, [CAUSE_TRUE])).toBe(false);
  });

  it("rejects an unrelated branch", () => {
    expect(isAncestorOfAny(scenario, CAUSE_WRONG_LEAF, [CAUSE_TRUE])).toBe(false);
  });
});

describe("scoreHypothesis", () => {
  it("gives nothing for naming no suspect", () => {
    expect(scoreHypothesis(scenario, [])).toBe(0);
  });

  it("gives full marks for a single correct suspect", () => {
    expect(scoreHypothesis(scenario, [CAUSE_TRUE])).toBe(100);
  });

  // Hedging across both allowed slots still lands it, but a hypothesis that
  // predicts less is worth less.
  it("charges for hedging even when one of the two is right", () => {
    const hedged = scoreHypothesis(scenario, [CAUSE_TRUE, CAUSE_WRONG_LEAF]);
    expect(hedged).toBeLessThan(100);
    expect(hedged).toBeGreaterThan(50);
  });

  it("gives partial credit for the right region", () => {
    const region = scoreHypothesis(scenario, [CAUSE_ANCESTOR]);
    expect(region).toBeGreaterThan(0);
    expect(region).toBeLessThan(100);
  });

  it("still credits committing to something falsifiable but wrong", () => {
    expect(scoreHypothesis(scenario, [CAUSE_WRONG_LEAF])).toBe(15);
  });
});

describe("scoreInvestigation", () => {
  it("gives nothing when no data was bought", () => {
    expect(scoreInvestigation(scenario, [], [CAUSE_TRUE])).toBe(0);
  });

  it("rewards finding it at par", () => {
    expect(scoreInvestigation(scenario, PAR_BUY, [CAUSE_TRUE])).toBe(100);
  });

  it("scores an over-par investigation below a par one", () => {
    const overPar = scoreInvestigation(
      scenario,
      [buy("d-city", 2, 1), buy("d-riders", 3, 2)],
      [CAUSE_TRUE],
    );
    expect(overPar).toBeLessThan(100);
  });

  // The gate: a confident diagnosis with nothing behind it is a guess.
  it("caps a run that never bought evidence for the real cause", () => {
    const blind = scoreInvestigation(scenario, [buy("d-noise", 4, 1)], []);
    expect(blind).toBeLessThanOrEqual(45);
  });

  it("counts a pull chasing a wrong-but-declared hypothesis as a reasonable spend", () => {
    const chasing = scoreInvestigation(
      scenario,
      [buy("d-city", 2, 1), buy("d-funnel", 2, 2)],
      [CAUSE_WRONG_LEAF],
    );
    const flailing = scoreInvestigation(
      scenario,
      [buy("d-city", 2, 1), buy("d-noise", 4, 2)],
      [CAUSE_WRONG_LEAF],
    );
    expect(chasing).toBeGreaterThan(flailing);
  });

  /**
   * The hindsight exploit, and its fix.
   *
   * The hypothesis is revisable throughout Investigate now, which opens an
   * obvious cheat: buy whatever, then rewrite the hypothesis to name whatever
   * those pulls turned out to be evidence for, and collect full relevance for
   * a search you never conducted. Relevance is judged against the belief
   * standing at each purchase instead, so the cheat pays nothing.
   */
  describe("with a revised hypothesis", () => {
    const purchases = [buy("d-city", 2, 1), buy("d-funnel", 2, 2)];

    it("does not reward rewriting the hypothesis to match what was bought", () => {
      // Both runs end holding the same belief and hold the same two pulls. The
      // difference is only when the belief was formed.
      const hindsight = scoreInvestigation(scenario, purchases, [CAUSE_WRONG_LEAF], {
        revisions: [
          // Opened somewhere the funnel pull says nothing about…
          { causeIds: [CAUSE_TRUE], note: null, afterPurchases: 0, afterDays: 0, at: "t0" },
          // …and only claimed the price branch after both pulls were in hand.
          {
            causeIds: [CAUSE_WRONG_LEAF],
            note: null,
            afterPurchases: 2,
            afterDays: 4,
            at: "t1",
          },
        ],
      });

      const genuine = scoreInvestigation(scenario, purchases, [CAUSE_WRONG_LEAF], {
        revisions: [
          {
            causeIds: [CAUSE_WRONG_LEAF],
            note: null,
            afterPurchases: 0,
            afterDays: 0,
            at: "t0",
          },
        ],
      });

      expect(hindsight).toBeLessThan(genuine);
    });

    it("still credits a pull bought under the belief it was testing", () => {
      // Revising is not itself penalised. A run that opened on the price
      // branch, bought the funnel pull to test it, then moved on scores that
      // pull as the reasonable spend it was.
      const revised = scoreInvestigation(scenario, purchases, [CAUSE_TRUE], {
        revisions: [
          {
            causeIds: [CAUSE_WRONG_LEAF],
            note: null,
            afterPurchases: 0,
            afterDays: 0,
            at: "t0",
          },
          { causeIds: [CAUSE_TRUE], note: null, afterPurchases: 2, afterDays: 4, at: "t1" },
        ],
      });
      const neverBelievedIt = scoreInvestigation(scenario, purchases, [CAUSE_TRUE]);
      expect(revised).toBeGreaterThan(neverBelievedIt);
    });

    it("scores a run with no log exactly as it did before the log existed", () => {
      expect(scoreInvestigation(scenario, purchases, [CAUSE_WRONG_LEAF], { revisions: [] })).toBe(
        scoreInvestigation(scenario, purchases, [CAUSE_WRONG_LEAF]),
      );
    });
  });
});

describe("scoreDiagnosisSim", () => {
  it("gives full marks for naming exactly the cause", () => {
    expect(scoreDiagnosisSim(scenario, [CAUSE_TRUE])).toBe(100);
  });

  it("charges for naming a second, wrong cause alongside it", () => {
    expect(scoreDiagnosisSim(scenario, [CAUSE_TRUE, CAUSE_WRONG_LEAF])).toBeLessThan(100);
  });

  it("gives partial credit for the right region", () => {
    const region = scoreDiagnosisSim(scenario, [CAUSE_ANCESTOR]);
    expect(region).toBeGreaterThan(0);
    expect(region).toBeLessThan(100);
  });

  it("gives almost nothing for the wrong leaf", () => {
    expect(scoreDiagnosisSim(scenario, [CAUSE_WRONG_LEAF])).toBeLessThan(20);
  });

  it("scores partial coverage below complete coverage", () => {
    const twoTrue = fixtureScenario({ trueCauseIds: [CAUSE_TRUE, CAUSE_WRONG_LEAF] });
    const half = scoreDiagnosisSim(twoTrue, [CAUSE_TRUE]);
    const both = scoreDiagnosisSim(twoTrue, [CAUSE_TRUE, CAUSE_WRONG_LEAF]);
    expect(half).toBeLessThan(both);
  });
});

describe("scoreDecision", () => {
  const outcomeFor = (allocation: typeof BEST_ALLOCATION) =>
    runOutcome(scenario, allocation);

  it("gives nothing when nothing was funded", () => {
    expect(scoreDecision(scenario, [], outcomeFor([]))).toBe(0);
  });

  it("gives full marks for putting everything behind the real cause", () => {
    expect(scoreDecision(scenario, BEST_ALLOCATION, outcomeFor(BEST_ALLOCATION))).toBe(100);
  });

  it("gives nothing for putting everything behind the wrong one", () => {
    const wrong = [{ interventionId: "iv-discount", sprints: 1, rupees: 300 }];
    expect(scoreDecision(scenario, wrong, outcomeFor(wrong))).toBe(0);
  });

  it("scores a split allocation between the two", () => {
    const split = [
      { interventionId: "iv-payout", sprints: 2, rupees: 400 },
      { interventionId: "iv-discount", sprints: 1, rupees: 300 },
    ];
    const score = scoreDecision(scenario, split, outcomeFor(split));
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(100);
  });

  // A stall can happen while the leverage share looks perfect, so it is charged
  // separately rather than folded into the share.
  it("charges for funding the right bet below the point where it ships", () => {
    const stalledAlloc = [{ interventionId: "iv-rebuild", sprints: 2, rupees: 200 }];
    const score = scoreDecision(scenario, stalledAlloc, outcomeFor(stalledAlloc));
    expect(score).toBeLessThan(100);
  });
});

describe("scoreOutcome", () => {
  it("gives full marks for matching the best achievable", () => {
    expect(scoreOutcome(scenario, runOutcome(scenario, BEST_ALLOCATION))).toBe(100);
  });

  it("gives nothing for funding nothing", () => {
    expect(scoreOutcome(scenario, runOutcome(scenario, []))).toBe(0);
  });

  it("lands between the two for a partial fix", () => {
    const partial = runOutcome(scenario, [
      { interventionId: "iv-payout", sprints: 2, rupees: 200 },
    ]);
    const score = scoreOutcome(scenario, partial);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(100);
  });

  it("stays neutral when the scenario has no gradient to grade on", () => {
    const flat = fixtureScenario({ bestAllocation: [] });
    expect(scoreOutcome(flat, runOutcome(flat, []))).toBe(50);
  });
});

describe("scoreSimulation", () => {
  const idealRun = () =>
    scoreSimulation({
      scenario,
      hypothesis: [CAUSE_TRUE],
      purchases: PAR_BUY,
      diagnosis: [CAUSE_TRUE],
      allocation: BEST_ALLOCATION,
      outcome: runOutcome(scenario, BEST_ALLOCATION),
    });

  it("scores a clean run at the top band", () => {
    const result = idealRun();
    expect(result.overall).toBe(100);
    expect(result.band).toBe("Shipping-ready");
    expect(result.causeFound).toBe(true);
    expect(result.daysSpent).toBe(2);
    expect(result.daysPar).toBe(2);
  });

  // The headline invariant: every way of doing it worse scores worse.
  it("beats every degraded variant of itself", () => {
    const best = idealRun().overall;

    const wrongCause = scoreSimulation({
      scenario,
      hypothesis: [CAUSE_WRONG_LEAF],
      purchases: [buy("d-funnel", 2, 1)],
      diagnosis: [CAUSE_WRONG_LEAF],
      allocation: [{ interventionId: "iv-discount", sprints: 1, rupees: 300 }],
      outcome: runOutcome(scenario, [{ interventionId: "iv-discount", sprints: 1, rupees: 300 }]),
    }).overall;

    const boughtEverything = scoreSimulation({
      scenario,
      hypothesis: [CAUSE_TRUE],
      purchases: [buy("d-city", 2, 1), buy("d-funnel", 2, 2)],
      diagnosis: [CAUSE_TRUE],
      allocation: BEST_ALLOCATION,
      outcome: runOutcome(scenario, BEST_ALLOCATION),
    }).overall;

    const rightCauseUnderfunded = scoreSimulation({
      scenario,
      hypothesis: [CAUSE_TRUE],
      purchases: PAR_BUY,
      diagnosis: [CAUSE_TRUE],
      allocation: [{ interventionId: "iv-rebuild", sprints: 2, rupees: 200 }],
      outcome: runOutcome(scenario, [{ interventionId: "iv-rebuild", sprints: 2, rupees: 200 }]),
    }).overall;

    expect(wrongCause).toBeLessThan(best);
    expect(boughtEverything).toBeLessThan(best);
    expect(rightCauseUnderfunded).toBeLessThan(best);
  });

  // Process over result: reasoning well and being unlucky must beat guessing.
  it("scores a well-reasoned run above a lucky guess", () => {
    const reasoned = scoreSimulation({
      scenario,
      hypothesis: [CAUSE_TRUE],
      purchases: PAR_BUY,
      diagnosis: [CAUSE_TRUE],
      allocation: [{ interventionId: "iv-payout", sprints: 2, rupees: 200 }],
      outcome: runOutcome(scenario, [{ interventionId: "iv-payout", sprints: 2, rupees: 200 }]),
    }).overall;

    const lucky = scoreSimulation({
      scenario,
      hypothesis: [],
      purchases: [buy("d-noise", 4, 1)],
      diagnosis: [CAUSE_TRUE],
      allocation: BEST_ALLOCATION,
      outcome: runOutcome(scenario, BEST_ALLOCATION),
    }).overall;

    expect(reasoned).toBeGreaterThan(lucky);
  });

  it("names the stalled bet in the feedback", () => {
    const stalledAlloc = [{ interventionId: "iv-rebuild", sprints: 2, rupees: 200 }];
    const result = scoreSimulation({
      scenario,
      hypothesis: [CAUSE_TRUE],
      purchases: PAR_BUY,
      diagnosis: [CAUSE_TRUE],
      allocation: stalledAlloc,
      outcome: runOutcome(scenario, stalledAlloc),
    });
    expect(result.feedback.some((f) => f.text.includes("Rebuild dispatch"))).toBe(true);
  });

  it("says so when the cause was missed", () => {
    const result = scoreSimulation({
      scenario,
      hypothesis: [CAUSE_WRONG_LEAF],
      purchases: [buy("d-funnel", 2, 1)],
      diagnosis: [CAUSE_WRONG_LEAF],
      allocation: [{ interventionId: "iv-discount", sprints: 1, rupees: 300 }],
      outcome: runOutcome(scenario, [{ interventionId: "iv-discount", sprints: 1, rupees: 300 }]),
    });
    expect(result.causeFound).toBe(false);
    expect(result.feedback.some((f) => f.tone === "warning")).toBe(true);
  });
});
