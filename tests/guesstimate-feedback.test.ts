import { describe, expect, it } from "vitest";
import { evaluate, missFactor, structureBand } from "@/lib/evaluation";
import type { EvaluationInput, FrameworkNodeInput } from "@/lib/evaluation";
import { rubric, structureJudgement } from "@/lib/config";

/**
 * The guesstimate report, tested as what it SAYS rather than as what it scores.
 *
 * `evaluation.test.ts` pins the numbers. This file pins the sentences, because
 * the failure mode here is silent: a report that scores correctly and explains
 * nothing looks perfectly healthy from the scorer's side, and that is exactly
 * what the two undisclosed deductions below were.
 */

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

const texts = (input: EvaluationInput) => evaluate(input).feedback.map((f) => f.text);
const said = (input: EvaluationInput, pattern: RegExp) =>
  texts(input).some((t) => pattern.test(t));

/** A real two-level tree: ids and parents, which most fixtures here go without. */
function split(childValues: string[], parentLabel = "Population"): FrameworkNodeInput[] {
  return [
    { id: "root", parentId: null, label: parentLabel, value: "2cr" },
    ...childValues.map((value, i) => ({
      id: `kid${i}`,
      parentId: "root",
      label: `Segment ${i + 1}`,
      value,
    })),
  ];
}

describe("missFactor", () => {
  it("is null inside the range, and either side of it says which side", () => {
    expect(missFactor(8_000_000, 6_000_000, 12_000_000)).toBeNull();
    expect(missFactor(24_000_000, 6_000_000, 12_000_000)).toEqual({
      factor: 2,
      direction: "over",
    });
    expect(missFactor(2_000_000, 6_000_000, 12_000_000)).toEqual({
      factor: 3,
      direction: "under",
    });
  });

  // A ratio against zero is not a miss anyone can act on, and Infinity would
  // reach the report as "about Infinity× below the range".
  it("declines to take a ratio it cannot take", () => {
    expect(missFactor(null, 6_000_000, 12_000_000)).toBeNull();
    expect(missFactor(0, 6_000_000, 12_000_000)).toBeNull();
    expect(missFactor(-4, 6_000_000, 12_000_000)).toBeNull();
    expect(missFactor(8_000_000, null, 12_000_000)).toBeNull();
  });
});

describe("structureBand", () => {
  it("bands the judge's read, and reports no verdict as no verdict", () => {
    expect(structureBand(undefined)).toBeNull();
    expect(structureBand(Number.NaN)).toBeNull();
    expect(structureBand(structureJudgement.incoherentBelow - 1)).toBe("incoherent");
    expect(structureBand(structureJudgement.looseBelow - 1)).toBe("loose");
    expect(structureBand(100)).toBe("coherent");
  });
});

describe("the number it came to", () => {
  it("quotes the estimate and the band it landed in", () => {
    expect(said(base, /80 lakh/)).toBe(true);
    expect(said(base, /60 lakh–1\.2 cr/)).toBe(true);
  });

  it("says how far out and which way, rather than 'well off'", () => {
    const high = { ...base, finalEstimate: 48_000_000 };
    expect(said(high, /4×\s+above the top of/)).toBe(true);

    const low = { ...base, finalEstimate: 1_500_000 };
    expect(said(low, /4×\s+below the bottom of/)).toBe(true);
  });

  // The one sentence worth the whole rewrite: a miss on a round order of
  // magnitude is a units problem, and re-doing the reasoning reproduces it.
  it("calls an order-of-magnitude miss what it almost always is", () => {
    const slipped = { ...base, finalEstimate: 1_200_000_000 }; // 100× the top
    expect(said(slipped, /unit slip/i)).toBe(true);
    expect(said(slipped, /lakh read as a crore/i)).toBe(true);
  });

  it("does not cry unit slip at a miss that is merely large", () => {
    const judgement = { ...base, finalEstimate: 540_000_000 }; // 45× — not a round order
    expect(said(judgement, /45×/)).toBe(true);
    expect(said(judgement, /unit slip/i)).toBe(false);
  });

  it("still names the missing estimate the way it always did", () => {
    expect(said({ ...base, finalEstimate: null }, /final estimate|land on a number/i)).toBe(
      true,
    );
  });
});

describe("the deductions that used to be silent", () => {
  it("names the step whose branches claim more than the whole, and its total", () => {
    const doubled = { ...base, framework: split(["80%", "70%"]) };
    expect(said(doubled, /Population/)).toBe(true);
    expect(said(doubled, /150%/)).toBe(true);
    expect(said(doubled, new RegExp(`${rubric.partitionOvershootPenalty} points`))).toBe(true);
  });

  it("says nothing about overshoot when the shares are a deliberate narrowing", () => {
    // 25% + 40% is under the whole, which `sharesOvershoot` allows on purpose.
    expect(said({ ...base, framework: split(["25%", "40%"]) }, /double counting/i)).toBe(false);
  });

  it("says what the judge's verdict did to the score", () => {
    const incoherent = { ...base, structureCoherence: 10 };
    expect(said(incoherent, /scaled to 25%/)).toBe(true);
    const loose = { ...base, structureCoherence: 50 };
    expect(said(loose, /scaled the four structural categories to 60%/)).toBe(true);
  });

  it("stays quiet when no verdict was taken", () => {
    expect(said(base, /scaled to/)).toBe(false);
  });

  /*
   * The rating this used to be read off — `Weak` — cannot occur on a numeric
   * attempt, so the bullet never fired however much junk was in the tree. It is
   * read off the parser now, which is what the tree itself is read with.
   */
  it("names a box holding something that isn't a figure", () => {
    const junk = {
      ...base,
      framework: [{ label: "Daily usage", value: "lots" }, ...base.framework],
    };
    expect(said(junk, /Daily usage/)).toBe(true);
    expect(said(junk, /isn't a figure/)).toBe(true);
  });

  it("does not call an empty box a bad one", () => {
    const blank = { ...base, framework: [{ label: "Not filled in yet", value: "" }] };
    expect(said(blank, /isn't a figure/)).toBe(false);
  });
});

describe("what a tree that isn't one is told", () => {
  it("says there is no chain at all", () => {
    expect(said({ ...base, framework: [] }, /no estimation chain/i)).toBe(true);
  });

  it("says one step is an assertion", () => {
    expect(said({ ...base, framework: [{ label: "Answer", value: "80 lakh" }] }, /One step isn't an estimate/)).toBe(true);
  });

  it("keeps the 'never committed to a number' line it always had", () => {
    const none = { ...base, framework: [], userMessageText: ["not sure really"] };
    expect(said(none, /never committed to a number/i)).toBe(true);
  });
});

describe("what the report leads with, and how long it runs", () => {
  it("opens with the fact that the attempt was not scored", () => {
    const told = evaluate({ ...base, solutionRevealed: true });
    expect(told.feedback[0].text).toMatch(/Teacher mode/);
  });

  // A dozen bullets is a wall, and the fifth is where a reader stops. What is
  // dropped has to be what mattered least — never the authored angle.
  it("caps the list and still closes on the consultant's angle", () => {
    const dire: EvaluationInput = {
      ...base,
      finalEstimate: 40,
      framework: [
        ...split(["80%", "70%"]),
        { id: "junk", parentId: null, label: "Frequency", value: "lots" },
      ],
      calculationCount: 0,
      userMessageText: [],
      hintsUsed: 3,
      structureCoherence: 5,
    };
    const feedback = evaluate(dire).feedback;
    expect(feedback.length).toBeLessThanOrEqual(9);
    expect(feedback.at(-1)!.text).toContain("A consultant's angle");
  });

  it("does not bury a strong attempt's verdict under process notes", () => {
    // The accuracy line is what a candidate looks for, so nothing outranks it
    // except an attempt that wasn't scored at all.
    expect(evaluate(base).feedback[0].text).toMatch(/80 lakh/);
  });
});
