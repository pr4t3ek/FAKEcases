import { describe, expect, it } from "vitest";
import { resolveAttachTarget } from "@/lib/framework-tree";

type Node = { id: string; parentId: string | null; label: string };

const n = (id: string, parentId: string | null, label = id): Node => ({ id, parentId, label });

describe("resolveAttachTarget", () => {
  it("returns null for an empty tree — the only case that starts a root", () => {
    expect(resolveAttachTarget([])).toBeNull();
  });

  it("attaches under the lone starting step", () => {
    const nodes = [n("population", null)];
    expect(resolveAttachTarget(nodes)?.id).toBe("population");
  });

  // The behaviour the builder exists for: picking Population then Segmentation
  // nests rather than producing two unrelated roots.
  it("walks to the tip of a chain", () => {
    const nodes = [
      n("population", null),
      n("segmentation", "population"),
      n("frequency", "segmentation"),
    ];
    expect(resolveAttachTarget(nodes)?.id).toBe("frequency");
  });

  it("follows the LAST branch when a step was split into segments", () => {
    const nodes = [
      n("population", null),
      n("urban", "population"),
      n("rural", "population"),
    ];
    expect(resolveAttachTarget(nodes)?.id).toBe("rural");
  });

  it("descends through the last branch, not the deepest one", () => {
    const nodes = [
      n("population", null),
      n("urban", "population"),
      n("urban-adults", "urban"),
      n("urban-adults-daily", "urban-adults"),
      n("rural", "population"),
    ];
    expect(resolveAttachTarget(nodes)?.id).toBe("rural");
  });

  // Attempts saved before this rule can hold several roots; they stay as they
  // are, and new steps extend the most recent one.
  it("extends the tip under the last root of legacy multi-root data", () => {
    const nodes = [
      n("population", null),
      n("segmentation", null),
      n("income-band", "segmentation"),
    ];
    expect(resolveAttachTarget(nodes)?.id).toBe("income-band");
  });

  it("carries the whole node through, so callers can name the destination", () => {
    const nodes = [n("a", null, "Population"), n("b", "a", "Target Users")];
    expect(resolveAttachTarget(nodes)?.label).toBe("Target Users");
  });

  it("returns null when malformed data leaves no root at all", () => {
    const nodes = [n("a", "c"), n("b", "a"), n("c", "b")];
    expect(resolveAttachTarget(nodes)).toBeNull();
  });

  it("terminates instead of hanging when a duplicate id loops the descent", () => {
    // Two rows claiming one id is the only way a parent-pointer array can send
    // the walk back to a node it has already visited.
    const nodes = [n("a", null), n("b", "a"), n("a", "b", "duplicate of a")];
    expect(resolveAttachTarget(nodes)?.id).toBe("b");
  });
});
