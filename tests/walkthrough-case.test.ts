import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import {
  CASE_DEMO_QUESTION_EXTERNAL_ID,
  foodDeliveryCaseWalkthrough,
} from "@/lib/walkthrough/content";
import { validateWalkthrough } from "@/lib/walkthrough/validate";
import type { CaseWalkthroughContent } from "@/lib/walkthrough/types";
import { questions } from "../prisma/seed-data";

/**
 * The gate for a worked CASE.
 *
 * The numeric one asks a single question — does the chain reach the authored
 * answer. A case has no number, so it is held to the two things its question
 * does author: the branches it is scored on, and the branch that actually holds
 * the problem. Both are checked with the functions that grade a real attempt, so
 * these tests are also a check that the example and the marking agree.
 */

/** A tree that covers the food-delivery buckets and lands on delivery cost. */
function goodCase(): CaseWalkthroughContent {
  return {
    kind: "case",
    intro: "A worked case.",
    steps: [
      {
        say: "Split it.",
        node: { key: "m", parentKey: null, label: "Contribution margin per order", status: "unknown" },
        because: "The top gets no verdict.",
      },
      {
        say: "Revenue first.",
        node: { key: "r", parentKey: "m", label: "Revenue per order", status: "healthy" },
        because: "Broadly holding.",
      },
      {
        say: "The rate.",
        node: { key: "t", parentKey: "r", label: "Commission / take rate", status: "healthy" },
        because: "Unchanged at 18%.",
      },
      {
        say: "The basket.",
        node: { key: "a", parentKey: "r", label: "Average order value", status: "healthy" },
        because: "Down 6%, too small to explain it.",
      },
      {
        say: "The other side.",
        node: { key: "c", parentKey: "m", label: "Cost per order", status: "problem" },
        because: "A region, not a cause.",
      },
      {
        say: "The usual suspect.",
        node: { key: "d", parentKey: "c", label: "Discounts", status: "healthy" },
        because: "Flat per order.",
      },
      {
        say: "What is left.",
        node: { key: "v", parentKey: "c", label: "Delivery cost per order", status: "problem" },
        because: "Rider payouts up 31%.",
      },
    ],
    outro: "That is the method.",
  };
}

const FOOD_DELIVERY = {
  idealLow: null,
  idealHigh: null,
  expectedBuckets: [
    "Revenue",
    "Cost",
    "Commission / take rate",
    "Delivery cost",
    "Discounts",
    "Order value",
  ],
  rootCause: { path: ["Cost", "Delivery cost"] },
};

describe("the case publish gate", () => {
  it("passes a tree that covers the buckets and narrows to the cause", () => {
    const result = validateWalkthrough(goodCase(), FOOD_DELIVERY);
    expect(result.issues.map((i) => i.message)).toEqual([]);
    expect(result.ok).toBe(true);
    // Nothing was added up, and saying so beats reporting a number nobody checked.
    expect(result.total).toBeNull();
  });

  it("refuses a tree that skips a branch the question is scored on", () => {
    const content = goodCase();
    content.steps = content.steps.filter((s) => s.node.key !== "d");

    const result = validateWalkthrough(content, FOOD_DELIVERY);
    expect(result.ok).toBe(false);
    expect(result.issues[0].message).toContain("Discounts");
  });

  /** The case equivalent of a chain missing the authored number. */
  it("refuses a tree that never reaches the declared cause", () => {
    const content = goodCase();
    content.steps[6].node.status = "unknown";

    const result = validateWalkthrough(content, FOOD_DELIVERY);
    expect(result.ok).toBe(false);
    expect(result.issues[0].message).toContain("Cost → Delivery cost");
  });

  /** "The problem is in cost" has located a region, not a cause. */
  it("refuses a trail that stops on a branch with children", () => {
    const content = goodCase();
    // Mark a leaf under the terminal node, so the trail can no longer finish.
    content.steps[6].node.status = "problem";
    content.steps.push({
      say: "One more level.",
      node: { key: "x", parentKey: "v", label: "Rider payouts", status: "unknown" },
      because: "Left unexamined on purpose.",
    });

    const result = validateWalkthrough(content, FOOD_DELIVERY);
    expect(result.ok).toBe(false);
    expect(result.issues[0].message).toContain("Narrow to a leaf");
  });

  /** Teaching the exact error the feedback warns about is the worst failure here. */
  it("refuses a tree that clears a branch the answer runs through", () => {
    const content = goodCase();
    content.steps[4].node.status = "healthy"; // "Cost per order"
    content.steps[6].node.status = "healthy"; // "Delivery cost per order"

    const result = validateWalkthrough(content, FOOD_DELIVERY);
    expect(result.ok).toBe(false);
    expect(result.issues[0].message).toContain("false clear");
  });

  it("refuses a question that lists no branches to cover", () => {
    const result = validateWalkthrough(goodCase(), {
      idealLow: null,
      idealHigh: null,
      expectedBuckets: [],
      rootCause: null,
    });
    expect(result.ok).toBe(false);
    expect(result.issues[0].message).toContain("no expected branches");
  });

  /**
   * Five of the ten seeded cases are decision cases — market entry, policy —
   * with no problem to localise. Coverage alone has to be enough, or they are
   * locked out of the feature permanently.
   */
  it("publishes a decision case on coverage alone, with no root cause", () => {
    const result = validateWalkthrough(goodCase(), {
      idealLow: null,
      idealHigh: null,
      expectedBuckets: ["Revenue", "Cost"],
      rootCause: null,
    });
    expect(result.ok).toBe(true);
  });

  /** An issue tree with no verdict anywhere is a list of headings. */
  it("refuses a decision case that diagnoses nothing", () => {
    const content = goodCase();
    for (const step of content.steps) step.node.status = "unknown";

    const result = validateWalkthrough(content, {
      idealLow: null,
      idealHigh: null,
      expectedBuckets: ["Revenue", "Cost"],
      rootCause: null,
    });
    expect(result.ok).toBe(false);
    expect(result.issues[0].message).toContain("No branch is marked as the problem");
  });

  /** Structural rules are shared with the numeric kind and must still bite. */
  it("refuses a child whose parent no earlier step introduces", () => {
    const content = goodCase();
    content.steps[1].node.parentKey = "later";

    const result = validateWalkthrough(content, FOOD_DELIVERY);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.message.includes("later"))).toBe(true);
  });
});

describe("the demo case walkthrough is true of its own question", () => {
  const question = questions.find((q) => q.externalId === CASE_DEMO_QUESTION_EXTERNAL_ID);

  it("points at a question that exists", () => {
    expect(question, `no seeded question "${CASE_DEMO_QUESTION_EXTERNAL_ID}"`).toBeDefined();
  });

  it("is a case with branches and a cause to check against", () => {
    expect(question?.type).toBe("qualitative");
    expect(question?.expectedBuckets?.length ?? 0).toBeGreaterThan(0);
    expect(question?.rootCause?.path?.length ?? 0).toBeGreaterThan(0);
  });

  /**
   * The failure this catches is not a typo. It is somebody adding a bucket to
   * this question next year and never thinking about the example that used to
   * cover all of them.
   */
  it("covers every scored branch and lands on the declared cause", () => {
    const result = validateWalkthrough(foodDeliveryCaseWalkthrough, {
      idealLow: null,
      idealHigh: null,
      expectedBuckets: question?.expectedBuckets ?? [],
      rootCause: question?.rootCause ?? null,
    });
    expect(result.issues.map((i) => i.message)).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("teaches a tree a beginner can follow", () => {
    expect(foodDeliveryCaseWalkthrough.steps.length).toBeGreaterThanOrEqual(4);
    expect(foodDeliveryCaseWalkthrough.steps.length).toBeLessThanOrEqual(8);
  });

  /** Clearing branches is the lesson, so the example has to actually clear some. */
  it("rules branches out rather than only building them", () => {
    const cleared = foodDeliveryCaseWalkthrough.steps.filter(
      (s) => s.node.status === "healthy",
    ).length;
    expect(cleared).toBeGreaterThanOrEqual(2);
  });

  it("explains every verdict it puts on screen", () => {
    for (const step of foodDeliveryCaseWalkthrough.steps) {
      expect(step.because.trim().length, `"${step.node.label}" has no reason`).toBeGreaterThan(20);
      expect(step.because).not.toMatch(/^TODO/);
      expect(step.say).not.toMatch(/^TODO/);
    }
  });

  it("is the question the shipped default setting points at", () => {
    const settings = readFileSync("lib/settings.ts", "utf8");
    expect(settings).toContain(
      `caseWalkthroughDemoQuestion: "${CASE_DEMO_QUESTION_EXTERNAL_ID}"`,
    );
  });
});
