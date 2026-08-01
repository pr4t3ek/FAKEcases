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
    expect(poor.overall).toBeLessThan(good.overall);
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

  // Teacher mode states the answer. Identical work either side of it must not
  // score the same, or "never reveal the answer early" is only true of the chat.
  it("charges for a solution that was walked through", () => {
    const cold = evaluate(base);
    const told = evaluate({ ...base, solutionRevealed: true });
    expect(told.scores.confidence).toBeLessThan(cold.scores.confidence);
    expect(told.overall).toBeLessThan(cold.overall);
    expect(told.feedback.some((f) => /Teacher mode/i.test(f.text))).toBe(true);
  });

  it("costs at least as much as exhausting the hint ladder", () => {
    const allHints = evaluate({ ...base, hintsUsed: hintConfig.levels });
    const told = evaluate({ ...base, solutionRevealed: true });
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
