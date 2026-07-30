import { describe, expect, it } from "vitest";
import { describeTrail, diagnosisTrail, type DiagnosisNode } from "@/lib/diagnosis";

const n = (
  id: string,
  parentId: string | null,
  status?: string,
  label = id,
): DiagnosisNode => ({ id, parentId, label, status });

describe("diagnosisTrail", () => {
  it("reports nothing for an unmarked tree", () => {
    const trail = diagnosisTrail([n("revenue", null), n("cost", null)]);
    expect(trail.paths).toEqual([]);
    expect(trail.unexamined).toBe(2);
    expect(trail.complete).toBe(false);
  });

  // The shape of a solved case: each mark narrows, and the path ends on a leaf.
  it("follows a chain of problem marks down to a leaf", () => {
    const trail = diagnosisTrail([
      n("revenue", null, "healthy"),
      n("cost", null, "problem"),
      n("fixed", "cost", "healthy"),
      n("variable", "cost", "problem"),
      n("delivery", "variable", "problem"),
    ]);
    expect(trail.labelPaths).toEqual([["cost", "variable", "delivery"]]);
    expect(trail.cleared).toBe(2);
    expect(trail.complete).toBe(true);
  });

  // A red parent is a claim about a region, not about a cause. Stopping at
  // "cost" has located a neighbourhood and no more, so it does not read as done.
  it("is incomplete while the deepest problem node still has children", () => {
    const trail = diagnosisTrail([
      n("cost", null, "problem"),
      n("fixed", "cost"),
      n("variable", "cost"),
    ]);
    expect(trail.complete).toBe(false);
    expect(trail.labelPaths).toEqual([["cost"]]);
  });

  // Businesses do have two problems at once. Reporting both beats guessing one.
  it("reports every branch when two siblings are marked", () => {
    const trail = diagnosisTrail([
      n("revenue", null, "problem"),
      n("price", "revenue", "problem"),
      n("cost", null, "problem"),
      n("rent", "cost", "problem"),
    ]);
    expect(trail.labelPaths).toEqual([
      ["revenue", "price"],
      ["cost", "rent"],
    ]);
    expect(trail.complete).toBe(true);
  });

  // Each path is reported once from its top — not once per node along it.
  it("does not restart a path at every problem node", () => {
    const trail = diagnosisTrail([
      n("cost", null, "problem"),
      n("variable", "cost", "problem"),
    ]);
    expect(trail.paths).toHaveLength(1);
  });

  it("counts branches never given a verdict, including explicit unknown", () => {
    const trail = diagnosisTrail([
      n("cost", null, "problem"),
      n("fixed", "cost", "unknown"),
      n("variable", "cost"),
    ]);
    expect(trail.unexamined).toBe(2);
  });

  // Usually means the real cause is a branch they haven't added yet. Worth
  // surfacing, never worth blocking.
  it("flags a problem node whose children are all cleared", () => {
    const trail = diagnosisTrail([
      n("cost", null, "problem"),
      n("fixed", "cost", "healthy"),
      n("variable", "cost", "healthy"),
    ]);
    expect(trail.contradictions).toEqual(["cost"]);
  });

  it("does not flag a problem node that still has unexamined children", () => {
    const trail = diagnosisTrail([
      n("cost", null, "problem"),
      n("fixed", "cost", "healthy"),
      n("variable", "cost"),
    ]);
    expect(trail.contradictions).toEqual([]);
  });

  // Status is the candidate's own claim at every level. A parent is never
  // reddened by its child, so a marked child under an unmarked parent starts its
  // own path rather than implying one above it.
  it("treats a marked child under an unmarked parent as its own path", () => {
    const trail = diagnosisTrail([n("cost", null), n("variable", "cost", "problem")]);
    expect(trail.labelPaths).toEqual([["variable"]]);
  });

  it("does not hang on a cycle in stored data", () => {
    const trail = diagnosisTrail([n("a", "b", "problem"), n("b", "a", "problem")]);
    expect(trail.paths.length).toBeGreaterThanOrEqual(0);
  });
});

describe("describeTrail", () => {
  it("prompts when nothing is marked", () => {
    expect(describeTrail(diagnosisTrail([n("cost", null)]))).toMatch(/mark what you've ruled out/i);
  });

  it("names the route and says whether the diagnosis landed", () => {
    const text = describeTrail(
      diagnosisTrail([
        n("cost", null, "problem", "Cost"),
        n("delivery", "cost", "problem", "Delivery cost"),
      ]),
    );
    expect(text).toContain("Cost → Delivery cost");
    expect(text).toContain("diagnosis complete");
  });

  it("says it is still drilling while the trail ends on a branch", () => {
    const text = describeTrail(
      diagnosisTrail([n("cost", null, "problem", "Cost"), n("fixed", "cost", undefined, "Fixed")]),
    );
    expect(text).toContain("still drilling");
  });
});
