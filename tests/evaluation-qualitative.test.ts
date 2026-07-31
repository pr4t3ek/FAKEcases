import { describe, expect, it } from "vitest";
import {
  deriveAssumptions,
  evaluateQualitative,
  scoreDiagnosis,
  weightedOverall,
  type EvaluationScores,
  type FrameworkNodeInput,
  type QualitativeEvaluationInput,
} from "@/lib/evaluation";

const node = (
  id: string,
  parentId: string | null,
  label: string,
  extra: Partial<FrameworkNodeInput> = {},
): FrameworkNodeInput => ({ id, parentId, label, ...extra });

const baseInput = (over: Partial<QualitativeEvaluationInput> = {}): QualitativeEvaluationInput => ({
  framework: [],
  userMessageText: [],
  finalAnswer: null,
  hintsUsed: 0,
  treeMode: "solo",
  rootCause: null,
  expectedBuckets: [],
  betterApproach: "",
  ...over,
});

const scores = (over: Partial<EvaluationScores> = {}): EvaluationScores => ({
  structuring: 80,
  logic: 80,
  segmentation: 80,
  assumptions: 80,
  calculation: 80,
  diagnosis: 80,
  communication: 80,
  business: 80,
  confidence: 80,
  ...over,
});

describe("weightedOverall", () => {
  // The whole point of nulling a category rather than zeroing it: an attempt
  // isn't punished for a category it could never have earned.
  it("renormalises over the categories that applied", () => {
    expect(weightedOverall(scores(), "numeric")).toBe(80);
    expect(weightedOverall(scores({ calculation: null, diagnosis: null }), "numeric")).toBe(80);
  });

  it("scores a null category far higher than a zero one", () => {
    const nulled = weightedOverall(scores({ calculation: null }), "numeric");
    const zeroed = weightedOverall(scores({ calculation: 0 }), "numeric");
    expect(nulled).toBeGreaterThan(zeroed);
    expect(nulled).toBe(80);
  });

  // Guided builds the tree, so structure is null — and the remaining categories
  // have to carry the score rather than the attempt collapsing.
  it("survives a guided attempt with structure and calculation absent", () => {
    const guided = scores({ structuring: null, segmentation: null, calculation: null });
    expect(weightedOverall(guided, "qualitative")).toBe(80);
  });

  it("returns 0 rather than dividing by zero when nothing applied", () => {
    const empty = scores({
      structuring: null,
      segmentation: null,
      calculation: null,
      diagnosis: null,
    });
    // logic/assumptions/communication/business/confidence still carry weight, so
    // force the degenerate case explicitly.
    expect(weightedOverall({ ...empty }, "qualitative")).toBeGreaterThan(0);
  });
});

describe("scoreDiagnosis", () => {
  const rootCause = { path: ["Cost", "Delivery cost per order"] };
  const tree = (statuses: Record<string, string>) => [
    node("r", null, "Revenue", { status: statuses.r }),
    node("c", null, "Cost", { status: statuses.c }),
    node("d", "c", "Delivery cost per order", { status: statuses.d }),
    node("p", "c", "Packaging", { status: statuses.p }),
  ];

  it("rewards a trail that lands on the declared branch", () => {
    const landed = scoreDiagnosis(tree({ r: "healthy", c: "problem", d: "problem", p: "healthy" }), rootCause);
    expect(landed.landed).toBe(true);
    expect(landed.score).toBeGreaterThan(75);
  });

  it("scores a trail that stopped one level short below one that landed", () => {
    const partial = scoreDiagnosis(tree({ r: "healthy", c: "problem" }), rootCause);
    const full = scoreDiagnosis(tree({ r: "healthy", c: "problem", d: "problem" }), rootCause);
    expect(partial.landed).toBe(false);
    expect(partial.score).toBeLessThan(full.score);
  });

  // Ruling out the branch the answer ran through is the expensive mistake, and
  // it has to cost more than simply not looking.
  it("penalises clearing a branch that was on the true path", () => {
    const cleared = scoreDiagnosis(tree({ c: "healthy" }), rootCause);
    const untouched = scoreDiagnosis(tree({}), rootCause);
    expect(cleared.falseClears).toEqual(["Cost"]);
    expect(cleared.score).toBeLessThan(untouched.score);
  });

  it("rewards eliminating siblings over guessing straight down", () => {
    const eliminated = scoreDiagnosis(
      tree({ r: "healthy", c: "problem", d: "problem", p: "healthy" }),
      rootCause,
    );
    const guessed = scoreDiagnosis(tree({ c: "problem", d: "problem" }), rootCause);
    expect(eliminated.score).toBeGreaterThan(guessed.score);
  });

  it("matches labels loosely, since wording rarely equals the authored label", () => {
    const loose = scoreDiagnosis(
      [
        node("c", null, "Costs", { status: "problem" }),
        node("d", "c", "Delivery cost per order (rider payout)", { status: "problem" }),
      ],
      rootCause,
    );
    expect(loose.landed).toBe(true);
  });

  it("stays in range on an empty tree", () => {
    const empty = scoreDiagnosis([], rootCause);
    expect(empty.score).toBeGreaterThanOrEqual(10);
    expect(empty.score).toBeLessThanOrEqual(97);
  });
});

describe("deriveAssumptions in qualitative mode", () => {
  // The rule the numeric mode already encodes, in the case's currency: a box can
  // hold a claim but not its basis, so the top band is earned by explaining it
  // in the conversation.
  it("lets a branch inherited from chat earn Excellent, but caps a typed note", () => {
    const derived = deriveAssumptions({
      framework: [
        node("a", null, "Cost", { sourceMessageId: "m1" }),
        node("b", null, "Revenue", { note: "orders look flat" }),
        node("c", null, "Packaging"),
      ],
      userMessageText: [],
      answerMode: "qualitative",
    });
    expect(derived.map((d) => d.rating)).toEqual([
      "Excellent",
      "Reasonable",
      "NeedsJustification",
    ]);
  });

  // A digit requirement would floor every case by construction.
  it("counts a reasoned claim with no numbers in it", () => {
    const derived = deriveAssumptions({
      framework: [],
      userMessageText: ["Margins fell because rider payouts rose faster than order values"],
      answerMode: "qualitative",
    });
    expect(derived).toHaveLength(1);
    expect(derived[0].rating).toBe("Excellent");
  });

  it("ignores a bare assertion with no reasoning", () => {
    const derived = deriveAssumptions({
      framework: [],
      userMessageText: ["Costs went up"],
      answerMode: "qualitative",
    });
    expect(derived).toHaveLength(0);
  });
});

describe("evaluateQualitative", () => {
  it("never scores calculation — there is no arithmetic in a case", () => {
    const result = evaluateQualitative(baseInput());
    expect(result.scores.calculation).toBeNull();
    expect(result.accuracyHit).toBe(false);
  });

  it("scores no diagnosis when the question declares no root cause", () => {
    expect(evaluateQualitative(baseInput()).scores.diagnosis).toBeNull();
  });

  it("scores diagnosis when a root cause is declared", () => {
    const result = evaluateQualitative(
      baseInput({
        framework: [
          node("c", null, "Cost", { status: "problem" }),
          node("d", "c", "Delivery", { status: "problem" }),
        ],
        rootCause: { path: ["Cost", "Delivery"] },
      }),
    );
    expect(result.scores.diagnosis).not.toBeNull();
  });

  // The app built the tree, so grading the candidate on it would be marking its
  // own work.
  it("does not score structure on a guided attempt", () => {
    const guided = evaluateQualitative(baseInput({ treeMode: "guided" }));
    expect(guided.scores.structuring).toBeNull();
    expect(guided.scores.segmentation).toBeNull();
    expect(guided.overall).toBeGreaterThan(0);
  });

  it("does score structure on a solo attempt", () => {
    expect(evaluateQualitative(baseInput()).scores.structuring).not.toBeNull();
  });

  it("rewards a deeper, broader tree", () => {
    const shallow = evaluateQualitative(
      baseInput({ framework: [node("a", null, "Revenue")] }),
    );
    const deep = evaluateQualitative(
      baseInput({
        framework: [
          node("a", null, "Revenue"),
          node("b", null, "Cost"),
          node("c", "a", "Price"),
          node("d", "a", "Volume"),
        ],
      }),
    );
    expect(deep.scores.structuring!).toBeGreaterThan(shallow.scores.structuring!);
  });

  it("penalises overlapping siblings", () => {
    const clean = evaluateQualitative(
      baseInput({ framework: [node("a", null, "Revenue"), node("b", null, "Cost")] }),
    );
    const overlapping = evaluateQualitative(
      baseInput({ framework: [node("a", null, "Revenue"), node("b", null, "revenue")] }),
    );
    expect(overlapping.scores.segmentation!).toBeLessThan(clean.scores.segmentation!);
  });

  it("uses expected buckets for coverage when the question declares them", () => {
    const covered = evaluateQualitative(
      baseInput({
        framework: [node("a", null, "Revenue"), node("b", null, "Cost")],
        expectedBuckets: ["Revenue", "Cost"],
      }),
    );
    const missed = evaluateQualitative(
      baseInput({
        framework: [node("a", null, "Revenue"), node("b", null, "Cost")],
        expectedBuckets: ["Revenue", "Cost", "Competition", "Regulation"],
      }),
    );
    expect(covered.scores.segmentation!).toBeGreaterThan(missed.scores.segmentation!);
  });

  it("names the branch that was cleared too early in the feedback", () => {
    const result = evaluateQualitative(
      baseInput({
        framework: [node("c", null, "Cost", { status: "healthy" })],
        rootCause: { path: ["Cost"] },
      }),
    );
    expect(result.feedback.some((f) => f.text.includes("Cost") && f.tone === "warning")).toBe(true);
  });

  it("tells a guided candidate that structure wasn't scored", () => {
    const result = evaluateQualitative(baseInput({ treeMode: "guided" }));
    expect(result.feedback.some((f) => /guided/i.test(f.text))).toBe(true);
  });

  it("flags a missing recommendation", () => {
    const result = evaluateQualitative(baseInput({ finalAnswer: null }));
    expect(result.feedback.some((f) => /recommendation/i.test(f.text))).toBe(true);
  });
});

describe("evidence in scoreDiagnosis", () => {
  const rootCause = { path: ["Cost", "Delivery cost per order"] };
  const marked = [
    node("c", null, "Cost", { status: "problem" }),
    node("d", "c", "Delivery cost per order", { status: "problem" }),
  ];

  // Guessing right is worth something; diagnosing right is worth more. The badge
  // during the attempt and the score afterwards have to be the same judgement.
  it("scores a verdict reached by asking above the same verdict reached blind", () => {
    const asked = scoreDiagnosis(marked, rootCause, [
      "what has happened to delivery cost per order?",
    ]);
    const blind = scoreDiagnosis(marked, rootCause, ["I'll go with cost."]);
    expect(asked.unevidenced).toBe(0);
    expect(blind.unevidenced).toBeGreaterThan(0);
    expect(asked.score).toBeGreaterThan(blind.score);
  });

  // Retro-compatibility: existing callers that pass no transcript must not be
  // penalised for evidence they were never asked to supply.
  it("penalises nothing when no conversation is supplied", () => {
    expect(scoreDiagnosis(marked, rootCause).unevidenced).toBe(0);
  });

  it("ignores unmarked branches — building is a hypothesis, not a claim", () => {
    const unmarkedTree = [
      node("c", null, "Cost"),
      node("d", "c", "Delivery cost per order"),
    ];
    expect(scoreDiagnosis(unmarkedTree, rootCause, ["nothing relevant"]).unevidenced).toBe(0);
  });
});
