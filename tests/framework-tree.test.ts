import { describe, expect, it } from "vitest";
import {
  descendantIds,
  indentNode,
  insertSiblingAfter,
  outdentNode,
  resolveAttachTarget,
  rootIndexOf,
} from "@/lib/framework-tree";

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

describe("outline editing", () => {
  const chain = () => [n("revenue", null), n("price", "revenue"), n("volume", "revenue"), n("cost", null)];

  it("inserts a sibling directly after its anchor, not at the end", () => {
    const next = insertSiblingAfter(chain(), "price", n("fresh", null));
    const ids = next.map((x) => x.id);
    expect(ids).toEqual(["revenue", "price", "fresh", "volume", "cost"]);
    // It takes the anchor's parent, whatever was passed in.
    expect(next.find((x) => x.id === "fresh")?.parentId).toBe("revenue");
  });

  // Inserting after a node that has children must clear the whole subtree, or
  // the new sibling lands in the middle of its own predecessor's descendants.
  it("skips past the anchor's subtree", () => {
    const next = insertSiblingAfter(chain(), "revenue", n("fresh", null));
    expect(next.map((x) => x.id)).toEqual(["revenue", "price", "volume", "fresh", "cost"]);
  });

  it("appends when the anchor is unknown", () => {
    const next = insertSiblingAfter(chain(), "nope", n("fresh", null));
    expect(next.at(-1)?.id).toBe("fresh");
  });

  it("indents a node under its previous sibling", () => {
    const next = indentNode(chain(), "cost");
    expect(next.find((x) => x.id === "cost")?.parentId).toBe("revenue");
  });

  // A first child has nobody to be adopted by. Outliners no-op here rather than
  // erroring, and so does this.
  it("does not indent a first child or a first root", () => {
    expect(indentNode(chain(), "revenue")).toEqual(chain());
    expect(indentNode(chain(), "price")).toEqual(chain());
  });

  it("outdents to the parent's level, seated after the old parent", () => {
    const next = outdentNode(chain(), "price");
    expect(next.find((x) => x.id === "price")?.parentId).toBeNull();
    expect(next.map((x) => x.id)).toEqual(["revenue", "volume", "price", "cost"]);
  });

  it("does not outdent a root", () => {
    expect(outdentNode(chain(), "revenue")).toEqual(chain());
  });

  it("never loses or duplicates a node", () => {
    for (const op of [indentNode, outdentNode]) {
      for (const id of ["revenue", "price", "volume", "cost"]) {
        const next = op(chain(), id);
        expect(next).toHaveLength(4);
        expect(new Set(next.map((x) => x.id)).size).toBe(4);
      }
    }
  });
});

describe("rootIndexOf", () => {
  const tree = [
    n("revenue", null),
    n("price", "revenue"),
    n("cost", null),
    n("fixed", "cost"),
    n("rent", "fixed"),
  ];

  it("gives every node the index of the root branch it descends from", () => {
    expect(rootIndexOf(tree, "revenue")).toBe(0);
    expect(rootIndexOf(tree, "price")).toBe(0);
    expect(rootIndexOf(tree, "cost")).toBe(1);
    expect(rootIndexOf(tree, "rent")).toBe(1);
  });

  it("returns -1 for an unknown id", () => {
    expect(rootIndexOf(tree, "ghost")).toBe(-1);
  });

  // Nothing validates stored data against cycles, and this runs inside a render.
  it("does not hang on a cycle", () => {
    const cyclic = [n("a", "b"), n("b", "a")];
    expect(rootIndexOf(cyclic, "a")).toBe(-1);
  });
});

describe("descendantIds", () => {
  it("collects the whole subtree, depth-first", () => {
    const tree = [n("cost", null), n("fixed", "cost"), n("rent", "fixed"), n("variable", "cost")];
    expect(descendantIds(tree, "cost")).toEqual(["fixed", "rent", "variable"]);
  });

  it("is empty for a leaf", () => {
    expect(descendantIds([n("leaf", null)], "leaf")).toEqual([]);
  });
});
