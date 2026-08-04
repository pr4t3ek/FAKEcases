import { describe, it, expect } from "vitest";
import {
  levelForXp,
  xpForLevel,
  computeSkillRating,
  rankForPercentile,
  rankPlacementAttempts,
  simRubric,
  simBands,
  bandForSimScore,
  weightedSimOverall,
  type SimScores,
} from "@/lib/config";
import { computeAttemptXp, computeSimulationXp } from "@/lib/gamification";

describe("levels", () => {
  it("level increases with xp and is monotonic", () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(100000)).toBeGreaterThan(levelForXp(500));
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(3)).toBeGreaterThan(xpForLevel(2));
  });
});

describe("computeAttemptXp", () => {
  it("rewards higher scores and no-hint runs", () => {
    const low = computeAttemptXp({ overall: 40, hintsUsed: 3, isFirstToday: false });
    const high = computeAttemptXp({ overall: 90, hintsUsed: 0, isFirstToday: false });
    expect(high).toBeGreaterThan(low);
  });
});

describe("computeSimulationXp", () => {
  it("rewards a higher score", () => {
    const low = computeSimulationXp({ overall: 40, underPar: false, isFirstToday: false });
    const high = computeSimulationXp({ overall: 90, underPar: false, isFirstToday: false });
    expect(high).toBeGreaterThan(low);
  });

  // The behaviour the format is trying to build: find it without buying
  // everything.
  it("pays for finishing inside the analyst-day budget", () => {
    const over = computeSimulationXp({ overall: 70, underPar: false, isFirstToday: false });
    const under = computeSimulationXp({ overall: 70, underPar: true, isFirstToday: false });
    expect(under).toBeGreaterThan(over);
  });

  it("gives the same first-of-the-day bonus an attempt does", () => {
    const later = computeSimulationXp({ overall: 70, underPar: false, isFirstToday: false });
    const first = computeSimulationXp({ overall: 70, underPar: false, isFirstToday: true });
    expect(first).toBeGreaterThan(later);
  });
});

describe("the simulation rubric", () => {
  const flat = (value: number): SimScores => ({
    hypothesis: value,
    investigation: value,
    diagnosis: value,
    decision: value,
    outcome: value,
  });

  it("averages a flat scorecard back to itself", () => {
    expect(weightedSimOverall(flat(70))).toBe(70);
  });

  // Weighted, not averaged: getting the cause right has to matter more than
  // getting the opening guess right.
  it("weights diagnosis above hypothesis", () => {
    const diagnosisKey = simRubric.find((d) => d.key === "diagnosis");
    const hypothesisKey = simRubric.find((d) => d.key === "hypothesis");
    expect(diagnosisKey!.weight).toBeGreaterThan(hypothesisKey!.weight);

    const goodDiagnosis = weightedSimOverall({ ...flat(40), diagnosis: 100 });
    const goodHypothesis = weightedSimOverall({ ...flat(40), hypothesis: 100 });
    expect(goodDiagnosis).toBeGreaterThan(goodHypothesis);
  });

  it("weights outcome the lightest of the five", () => {
    const outcome = simRubric.find((d) => d.key === "outcome")!.weight;
    for (const dim of simRubric) {
      expect(outcome).toBeLessThanOrEqual(dim.weight);
    }
  });

  it("maps scores to bands", () => {
    expect(bandForSimScore(100)).toBe("Shipping-ready");
    expect(bandForSimScore(75)).toBe("Strong");
    expect(bandForSimScore(55)).toBe("Developing");
    expect(bandForSimScore(0)).toBe("Reactive");
  });

  /**
   * Sharing wording with `readinessBands` would invite a simulation score being
   * read as a claim about interview readiness, which is exactly what the
   * separate tables exist to prevent.
   */
  it("uses none of the interview readiness vocabulary", () => {
    const words = simBands.map((b) => b.band);
    for (const readiness of ["Interview Ready", "Advanced", "Intermediate", "Beginner"]) {
      expect(words).not.toContain(readiness);
    }
  });
});

describe("skill rating + percentile rank", () => {
  it("returns null rating with no scores", () => {
    expect(computeSkillRating([])).toBeNull();
  });

  it("weights recent scores and rewards consistency", () => {
    const improving = computeSkillRating([50, 60, 70, 90])!;
    const flat = computeSkillRating([65, 65, 65, 65])!;
    expect(improving).toBeGreaterThan(0);
    expect(flat).toBeGreaterThan(60); // consistency bonus keeps it healthy
  });

  it("maps percentiles to the right rank bands", () => {
    const enough = rankPlacementAttempts;
    expect(rankForPercentile(95, enough)).toBe("Diamond");
    expect(rankForPercentile(80, enough)).toBe("Platinum");
    expect(rankForPercentile(55, enough)).toBe("Gold");
    expect(rankForPercentile(20, enough)).toBe("Silver");
  });

  it("stays Unranked during placement", () => {
    expect(rankForPercentile(99, rankPlacementAttempts - 1)).toBe("Unranked");
    expect(rankForPercentile(null, 100)).toBe("Unranked");
  });
});
