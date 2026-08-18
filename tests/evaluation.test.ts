import { describe, it, expect } from "vitest";
import {
  deriveAssumptions,
  evaluate,
  rateAssumption,
  solutionWasRevealed,
} from "@/lib/evaluation";
import type { EvaluationInput } from "@/lib/evaluation";
import { hintConfig } from "@/lib/config";

const base: EvaluationInput = {
  idealLow: 6_000_000,
  idealHigh: 12_000_000,
  betterApproach: "Segment adults vs children, apply replacement frequency.",
  sampleSolution: "~80 lakh",
  finalEstimate: 8_000_000,
  framework: [
    { label: "Population", value: "2cr" },
    { label: "Adults", value: "70%" },
    { label: "Urban share", value: "60%" },
    { label: "Replacement", value: "50%", multiplier: "2" },
  ],
  calculationCount: 3,
  userMessageText: [
    "I'll segment adults and children",
    "assume replacement every 2 years, plus monsoon institutional demand",
  ],
  hintsUsed: 0,
};

describe("evaluate", () => {
  it("rewards a well-structured, accurate attempt", () => {
    const r = evaluate(base);
    expect(r.overall).toBeGreaterThanOrEqual(75);
    expect(r.accuracyHit).toBe(true);
    expect(r.readiness).toMatch(/Advanced|Interview Ready/);
    expect(r.scores.segmentation).toBeGreaterThanOrEqual(70);
  });

  it("penalizes an unstructured, off-target attempt", () => {
    const good = evaluate(base);
    const poor = evaluate({
      ...base,
      finalEstimate: 500, // wildly off
      framework: [],
      calculationCount: 0,
      userMessageText: ["um I think a lot"],
      hintsUsed: 3,
    });
    expect(poor.overall!).toBeLessThan(good.overall!);
    expect(poor.accuracyHit).toBe(false);
    expect(poor.scores.segmentation).toBeLessThan(60);
  });

  it("flags when no final estimate is given", () => {
    const r = evaluate({ ...base, finalEstimate: null });
    expect(r.accuracyHit).toBe(false);
    expect(r.feedback.some((f) => /final estimate|land on a number/i.test(f.text))).toBe(true);
  });
});

describe("deriveAssumptions", () => {
  it("reads every figure off the tree, values and rates alike", () => {
    const got = deriveAssumptions({
      framework: [
        { label: "Population", value: "1.3cr" },
        { label: "Segmentation", value: "40%", multiplier: "3" },
        { label: "Grouping only", value: "" },
      ],
      userMessageText: [],
    });
    expect(got.map((a) => a.key)).toEqual([
      "Population",
      "Segmentation",
      "Segmentation (rate)",
    ]);
    expect(got.every((a) => a.source === "framework")).toBe(true);
  });

  // The tree has nowhere to say *why*, so a figure in it is quantified at best.
  it("caps a tree figure at Reasonable even when it reads as justified", () => {
    const got = deriveAssumptions({
      framework: [{ label: "Population", value: "2 crore based on census" }],
      userMessageText: [],
    });
    expect(got[0].rating).toBe("Reasonable");
  });

  it("takes quantified claims from chat and rewards a stated basis", () => {
    const got = deriveAssumptions({
      framework: [],
      userMessageText: ["assume 40% are urban because the census says so. 3 cups a day"],
    });
    expect(got).toHaveLength(2);
    expect(got[0].rating).toBe("Excellent");
    expect(got[1].rating).toBe("Reasonable");
    expect(got.every((a) => a.source === "chat")).toBe(true);
  });

  it("ignores chat that never commits to a number", () => {
    expect(
      deriveAssumptions({ framework: [], userMessageText: ["quite a lot I think", ""] }),
    ).toEqual([]);
  });
});

describe("assumption quality from derived figures", () => {
  it("does not let a filled-in tree alone max the score", () => {
    const treeOnly = evaluate({ ...base, userMessageText: [] });
    expect(treeOnly.scores.assumptions).toBeLessThan(85);
  });

  it("scores higher when the same figures are justified out loud", () => {
    const treeOnly = evaluate({ ...base, userMessageText: [] });
    const explained = evaluate({
      ...base,
      userMessageText: [
        "assume 70% are adults because the census age split says so",
        "replacement every 2 years based on typical usage",
      ],
    });
    expect(explained.scores.assumptions).toBeGreaterThan(treeOnly.scores.assumptions);
  });

  it("bottoms out when no number is ever committed to", () => {
    const none = evaluate({ ...base, framework: [], userMessageText: ["not sure really"] });
    expect(none.scores.assumptions).toBeLessThan(45);
    expect(none.feedback.some((f) => /never committed to a number/i.test(f.text))).toBe(true);
  });

  // Teacher mode states the answer, so there is no performance left to measure.
  // Not a lower score — no score, because a number here would travel into
  // readiness, rank and the leaderboard as though it had been earned.
  it("does not score a solution that was walked through", () => {
    const cold = evaluate(base);
    const told = evaluate({ ...base, solutionRevealed: true });
    expect(cold.overall).toBeTypeOf("number");
    expect(told.overall).toBeNull();
    expect(told.readiness).toBeNull();
    expect(told.feedback.some((f) => /Teacher mode/i.test(f.text))).toBe(true);
  });

  // The feedback item sits directly under a headline that says "Not scored", so
  // it cannot go on claiming the cost was a Confidence adjustment.
  it("tells the candidate the attempt does not count, not that Confidence dipped", () => {
    const told = evaluate({ ...base, solutionRevealed: true });
    const item = told.feedback.find((f) => /Teacher mode/i.test(f.text))!;
    expect(item.text).toMatch(/isn't scored|not scored|counts towards nothing/i);
    expect(item.text).not.toMatch(/Confidence is scored accordingly/i);
  });

  // The categories are the teaching, and the report still shows them. Only the
  // total goes.
  it("still scores the categories it can no longer total", () => {
    const told = evaluate({ ...base, solutionRevealed: true });
    expect(told.scores.logic).toBeTypeOf("number");
    expect(told.scores.assumptions).toBeTypeOf("number");
    expect(told.scores.confidence).toBeTypeOf("number");
    expect(told.scores.confidence).toBeLessThan(evaluate(base).scores.confidence);
  });

  // The rule the whole hint ladder rests on: hints escalate but never state the
  // answer, so exhausting them is still an attempt. Being told is not.
  it("costs strictly more than exhausting the hint ladder", () => {
    const allHints = evaluate({ ...base, hintsUsed: hintConfig.levels });
    const told = evaluate({ ...base, solutionRevealed: true });
    expect(allHints.overall).toBeTypeOf("number");
    expect(told.overall).toBeNull();
    expect(told.scores.confidence).toBeLessThanOrEqual(allHints.scores.confidence);
  });

  it("withholds the independence praise once the answer was handed over", () => {
    const told = evaluate({ ...base, hintsUsed: 0, solutionRevealed: true });
    expect(told.feedback.some((f) => /without hints/i.test(f.text))).toBe(false);
  });
});

describe("solutionWasRevealed", () => {
  it("detects a teacher-mode answer in the transcript", () => {
    expect(
      solutionWasRevealed([
        { role: "user", mode: "interviewer" },
        { role: "assistant", mode: "teacher" },
      ]),
    ).toBe(true);
  });

  // Picking the mode and changing your mind before a reply lands reveals
  // nothing, so the user turn alone must not trip it.
  it("ignores a user turn tagged teacher with no reply", () => {
    expect(solutionWasRevealed([{ role: "user", mode: "teacher" }])).toBe(false);
  });

  it("is false for an ordinary session", () => {
    expect(
      solutionWasRevealed([
        { role: "user", mode: "interviewer" },
        { role: "assistant", mode: "interviewer" },
        { role: "assistant", mode: "coach" },
      ]),
    ).toBe(false);
  });

  it("tolerates a null mode", () => {
    expect(solutionWasRevealed([{ role: "assistant", mode: null }])).toBe(false);
  });
});

describe("rateAssumption", () => {
  it("rates quantified + justified as Excellent", () => {
    expect(rateAssumption("population", "2 crore because census data").rating).toBe("Excellent");
  });
  it("rates a bare number as Reasonable", () => {
    expect(rateAssumption("adults", "70%").rating).toBe("Reasonable");
  });
  it("rates a value with no number as NeedsJustification", () => {
    expect(rateAssumption("frequency", "quite often").rating).toBe("NeedsJustification");
  });
  it("rates empty as Weak", () => {
    expect(rateAssumption("x", "").rating).toBe("Weak");
  });
});

/**
 * The rubric grades coverage, not attendance.
 *
 * Every category used to open with a baseline of 35–50 on a floor of 25–35, so
 * an attempt that segmented nothing, logged nothing and showed no working still
 * totalled about 52 and was told it was "Intermediate". These pin the shape that
 * replaced it: nothing is owed for turning up, and the top of the scale is
 * reachable only by covering every aspect.
 */
describe("earned coverage", () => {
  /** No tree, nothing said, no arithmetic, no answer. */
  const nothing: EvaluationInput = {
    ...base,
    framework: [],
    calculationCount: 0,
    userMessageText: [],
    finalEstimate: null,
  };

  /** The bare number: typed as a sentence, nothing behind it, lands in range. */
  const bareNumber: EvaluationInput = {
    ...base,
    framework: [],
    calculationCount: 0,
    userMessageText: ["16 crore GB per day"],
  };

  const complete: EvaluationInput = {
    ...base,
    framework: [
      { label: "Urban population", value: "4cr" },
      { label: "Adults", value: "68%" },
      { label: "Smartphone users", value: "75%" },
      { label: "Daily active", value: "60%" },
      { label: "Sessions/day", value: "3" },
      { label: "GB per session", value: "0.2", multiplier: "2" },
    ],
    calculationCount: 5,
    userMessageText: [
      "I'll split urban and rural because data pricing differs sharply between them",
      "Assuming 68% are adults, since the census age split puts under-18s at about a third",
      "Smartphone penetration is roughly 75% in urban India based on TRAI's subscriber report",
      "Daily active is about 60% of that, which means 1.8cr users driven by cheap data",
      "Add institutional and corporate bulk demand, plus a festival season uplift",
    ],
  };

  it("scores an empty attempt at zero, with no floor underneath any category", () => {
    const r = evaluate(nothing);
    for (const [key, score] of Object.entries(r.scores)) {
      if (score == null) continue; // diagnosis never applies to an estimate
      expect(score, key).toBe(0);
    }
    expect(r.overall).toBe(0);
  });

  // The complaint this rubric answers: a number that happened to land in the
  // ideal range used to score 80 on Calculation Accuracy on its own, which
  // carried the whole attempt to "Intermediate".
  it("does not reward a lucky number with nothing behind it", () => {
    const r = evaluate(bareNumber);
    expect(r.accuracyHit).toBe(true);
    expect(r.scores.calculation).toBeLessThanOrEqual(20);
    expect(r.overall!).toBeLessThan(25);
    expect(r.readiness).toBe("Beginner");
  });

  it("pays for the same estimate once it is actually worked", () => {
    const guessed = evaluate(bareNumber);
    const worked = evaluate({ ...bareNumber, calculationCount: 4 });
    expect(worked.scores.calculation).toBeGreaterThan(guessed.scores.calculation!);
    expect(worked.scores.calculation).toBeGreaterThanOrEqual(90);
  });

  // One quantified sentence is a proportion of one, so an unscaled ratio would
  // hand over the entire quantified-and-justified bonus for it.
  it("does not let a single quantified fragment collect the whole ratio bonus", () => {
    expect(evaluate(bareNumber).scores.assumptions).toBeLessThan(30);
  });

  it("reaches the top of the scale when every aspect is covered", () => {
    const r = evaluate(complete);
    expect(r.overall!).toBeGreaterThanOrEqual(90);
    expect(r.readiness).toBe("Interview Ready");
  });

  /*
   * The reveal outranks the rubric, however well the attempt scored.
   *
   * The existing Teacher-mode tests use the modest `base` fixture, where a leak
   * would surface a middling number. Now that full coverage reaches the high
   * 90s, an attempt that was walked through and then scored would publish a
   * near-perfect result into readiness, rank and the leaderboard — so the case
   * worth pinning is the strong one, not the average one.
   */
  it("withholds the total from a walked-through attempt even when every aspect is covered", () => {
    const cold = evaluate(complete);
    const told = evaluate({ ...complete, solutionRevealed: true });

    expect(cold.overall!).toBeGreaterThanOrEqual(90);
    expect(told.overall).toBeNull();
    expect(told.readiness).toBeNull();

    // The categories survive — they are the teaching, and the report still
    // shows them under a "Not scored" headline.
    expect(told.scores.structuring).toBeTypeOf("number");
    expect(told.scores.calculation).toBeTypeOf("number");
  });

  it("rises with each aspect the candidate adds", () => {
    const bare = evaluate(bareNumber).overall!;
    const structured = evaluate({ ...bareNumber, framework: base.framework }).overall!;
    const calculated = evaluate({
      ...bareNumber,
      framework: base.framework,
      calculationCount: 3,
    }).overall!;
    const explained = evaluate(complete).overall!;

    expect(structured).toBeGreaterThan(bare);
    expect(calculated).toBeGreaterThan(structured);
    expect(explained).toBeGreaterThan(calculated);
  });
});
