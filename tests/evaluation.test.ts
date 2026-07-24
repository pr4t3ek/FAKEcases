import { describe, it, expect } from "vitest";
import { evaluate, rateAssumption } from "@/lib/evaluation";
import type { EvaluationInput } from "@/lib/evaluation";

const base: EvaluationInput = {
  idealLow: 6_000_000,
  idealHigh: 12_000_000,
  betterApproach: "Segment adults vs children, apply replacement frequency.",
  sampleSolution: "~80 lakh",
  finalEstimate: 8_000_000,
  frameworkCount: 4,
  assumptions: [
    { value: "2 crore because census", rating: "Excellent" },
    { value: "70% adults", rating: "Reasonable" },
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
      frameworkCount: 0,
      assumptions: [{ value: "dunno", rating: "Weak" }],
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
