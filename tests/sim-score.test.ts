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
  overspendPenaltyFor,
} from "@/lib/sim/score";
import { simConfig } from "@/lib/config/simulation";
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

  it("cheapens that consolation as more branches are named", () => {
    // One wrong-but-committed suspect is a prediction that failed. Three is not
    // three predictions, it is one hedge, and it should not collect the same
    // credit for having been falsifiable.
    const one = scoreHypothesis(scenario, [CAUSE_WRONG_LEAF]);
    const two = scoreHypothesis(scenario, [CAUSE_WRONG_LEAF, "demand.other"]);
    expect(two).toBeLessThan(one);
  });

  /**
   * The property the whole dimension exists for, tested as a property rather
   * than as a number.
   *
   * A candidate who knows nothing can either name one branch at random or hedge
   * across the maximum. If hedging has the higher expected value, the phase is
   * teaching the opposite of what it claims to, and no amount of copy about
   * "commit before you look" will out-argue the scoreboard.
   *
   * This is what set `shotgunPenalty`. At the old 0.8, three picks on a
   * six-leaf tree beat one pick outright — and it is exactly the trap that
   * widening the cap from two to three would have walked into unnoticed.
   */
  describe("guessing at random", () => {
    const expectedValue = (leaves: number, picks: number) => {
      // Hypergeometric: the chance at least one of `picks` distinct leaves is
      // the single true one.
      const hit = picks / leaves;
      const hitScore = 100 * Math.pow(simConfig.shotgunPenalty, picks - 1);
      const missScore = 15 * Math.pow(simConfig.hedgedMissCredit, picks - 1);
      return hit * hitScore + (1 - hit) * missScore;
    };

    for (const leaves of [6, 8, 10, 12]) {
      it(`makes one confident pick beat hedging on a ${leaves}-leaf tree`, () => {
        const single = expectedValue(leaves, 1);
        for (let picks = 2; picks <= simConfig.maxSuspects; picks++) {
          expect(expectedValue(leaves, picks)).toBeLessThan(single);
        }
      });
    }
  });
});

/**
 * What a wasted analyst-day costs.
 *
 * Two separate bites, and the test pins the shape rather than the constants —
 * `overspendExponent` and `overspendOverallPenalty` live in `simConfig` so they
 * can be retuned, and a test asserting "8" would make retuning a test edit.
 */
describe("overspendPenaltyFor", () => {
  it("costs nothing at or under par", () => {
    expect(overspendPenaltyFor(4, 6)).toBe(0);
    expect(overspendPenaltyFor(6, 6)).toBe(0);
  });

  it("charges in proportion to the overage", () => {
    const twice = overspendPenaltyFor(12, 6);
    const thrice = overspendPenaltyFor(18, 6);

    expect(twice).toBeGreaterThan(0);
    // Linear: two multiples over costs twice what one multiple over costs.
    expect(thrice).toBeCloseTo(twice * 2, 5);
  });

  // A scenario with no par — a turnaround, or a board whose parInvestigation is
  // empty — has no waste to price, and dividing by it would be a NaN.
  it("is inert when there is no par to beat", () => {
    expect(overspendPenaltyFor(10, 0)).toBe(0);
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
   * Revision, and what crediting both beliefs does and does not buy.
   *
   * A pull counts if it spoke to the belief standing when it was bought **or**
   * to the one finally committed to. That is a deliberate relaxation of an
   * earlier rule which judged relevance at purchase only: the stricter rule
   * closed a hindsight cheat, and in closing it also punished the candidate who
   * bought the pull that changed their mind — the exact behaviour the phase is
   * meant to teach.
   *
   * So the cheat is no longer priced by this dimension's relevance term, and is
   * held instead by the `foundEvidence` gate: retro-fitting a hypothesis to
   * your purchases still caps the score unless one of those purchases actually
   * bore on the real cause. What the tests below pin is that boundary — not
   * that revision is free, but that it is bounded.
   */
  describe("with a revised hypothesis", () => {
    const purchases = [buy("d-city", 2, 1), buy("d-funnel", 2, 2)];

    it("no longer punishes a belief formed after the pulls were in hand", () => {
      // Both runs end holding the same belief and hold the same two pulls. The
      // difference is only when the belief was formed, and under credit-both
      // that difference stops being a deduction.
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

      expect(hindsight).toBe(genuine);
    });

    // The gate is what the relevance term stopped carrying. A run that revises
    // to fit its purchases still cannot score well on purchases that never
    // touched the real cause.
    it("still caps a retro-fitted hypothesis that never bought real evidence", () => {
      const retrofitted = scoreInvestigation(scenario, [buy("d-noise", 4, 1)], [CAUSE_WRONG_LEAF], {
        revisions: [
          { causeIds: [CAUSE_TRUE], note: null, afterPurchases: 0, afterDays: 0, at: "t0" },
          {
            causeIds: [CAUSE_WRONG_LEAF],
            note: null,
            afterPurchases: 1,
            afterDays: 4,
            at: "t1",
          },
        ],
      });

      expect(retrofitted).toBeLessThanOrEqual(45);
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

  /**
   * Wasted days reach the composite, not just Investigation.
   *
   * The point of putting the penalty on the overall is that it can move the
   * band — a dimension weighted 1.2 of 6.0 can only ever express a fifth of an
   * opinion about a run that bought the whole board.
   */
  it("takes points off the overall for buying past par, and says so", () => {
    const overspent = scoreSimulation({
      scenario,
      hypothesis: [CAUSE_TRUE],
      purchases: [buy("d-city", 2, 1), buy("d-funnel", 2, 2), buy("d-noise", 4, 3)],
      diagnosis: [CAUSE_TRUE],
      allocation: BEST_ALLOCATION,
      outcome: runOutcome(scenario, BEST_ALLOCATION),
    });

    expect(overspent.daysSpent).toBeGreaterThan(overspent.daysPar);

    // Below the same run's weighted rubric, because the deduction happens after
    // weighting — and below the clean run, which spent par.
    expect(overspent.overall).toBeLessThan(idealRun().overall);

    // Disclosed rather than deducted silently.
    const note = overspent.feedback.find((f) => f.text.includes("analyst-days"));
    expect(note?.text).toMatch(/points overall/);
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
