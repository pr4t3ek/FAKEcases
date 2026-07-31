import { describe, expect, it } from "vitest";
import { CARD_WIDTH, layoutTree } from "@/lib/framework-layout";

type N = { id: string; parentId: string | null };

const node = (id: string, parentId: string | null = null): N => ({ id, parentId });

/** Centre-to-centre distance, which is what "do these overlap?" comes down to. */
function gapBetween(a: { x: number }, b: { x: number }): number {
  return Math.abs(a.x - b.x);
}

describe("layoutTree", () => {
  it("stacks a single chain in one column", () => {
    const layout = layoutTree([node("a"), node("b", "a"), node("c", "b")]);

    const a = layout.nodes.get("a")!;
    const b = layout.nodes.get("b")!;
    const c = layout.nodes.get("c")!;

    // An only child has nothing to spread over, so the column stays straight.
    expect(a.x).toBe(b.x);
    expect(b.x).toBe(c.x);
    expect(a.y).toBeLessThan(b.y);
    expect(b.y).toBeLessThan(c.y);
    expect(a.depth).toBe(0);
    expect(c.depth).toBe(2);
  });

  it("centres a parent over two children", () => {
    const layout = layoutTree([node("a"), node("b", "a"), node("c", "a")]);

    const a = layout.nodes.get("a")!;
    const b = layout.nodes.get("b")!;
    const c = layout.nodes.get("c")!;

    expect(a.x).toBeCloseTo((b.x + c.x) / 2);
    expect(b.y).toBe(c.y);
    expect(gapBetween(b, c)).toBeGreaterThanOrEqual(CARD_WIDTH);
  });

  it("centres a parent over three children, on the middle one", () => {
    const layout = layoutTree([
      node("a"),
      node("b", "a"),
      node("c", "a"),
      node("d", "a"),
    ]);

    const a = layout.nodes.get("a")!;
    const c = layout.nodes.get("c")!;

    expect(a.x).toBeCloseTo(c.x);
  });

  it("packs several roots side by side without overlapping", () => {
    // The normal shape of a case tree: Revenue and Cost are peers, each with
    // their own children, and neither hangs off the other.
    const layout = layoutTree([
      node("revenue"),
      node("cost"),
      node("price", "revenue"),
      node("volume", "revenue"),
      node("delivery", "cost"),
      node("packaging", "cost"),
    ]);

    const price = layout.nodes.get("price")!;
    const volume = layout.nodes.get("volume")!;
    const delivery = layout.nodes.get("delivery")!;
    const packaging = layout.nodes.get("packaging")!;

    // Every leaf on the row is at least a card apart from its neighbour.
    const row = [price, volume, delivery, packaging].sort((l, r) => l.x - r.x);
    for (let i = 1; i < row.length; i++) {
      expect(gapBetween(row[i - 1], row[i])).toBeGreaterThanOrEqual(CARD_WIDTH);
    }
    // The two families don't interleave.
    expect(Math.max(price.x, volume.x)).toBeLessThan(Math.min(delivery.x, packaging.x));
  });

  it("lays a collapsed branch out as a leaf and drops its subtree", () => {
    const nodes = [node("a"), node("b", "a"), node("c", "b"), node("d", "c")];
    const open = layoutTree(nodes);
    const closed = layoutTree(nodes, { collapsed: new Set(["b"]) });

    expect(open.nodes.has("c")).toBe(true);
    expect(closed.nodes.has("c")).toBe(false);
    expect(closed.nodes.has("d")).toBe(false);
    // Folding a branch has to buy back space, or there'd be no point folding it.
    expect(closed.height).toBeLessThan(open.height);
    expect(closed.edges).not.toContainEqual({ from: "b", to: "c" });
  });

  it("reclaims the width a collapsed subtree was reserving", () => {
    const nodes = [
      node("root"),
      node("wide", "root"),
      node("w1", "wide"),
      node("w2", "wide"),
      node("w3", "wide"),
      node("narrow", "root"),
    ];
    const open = layoutTree(nodes);
    const closed = layoutTree(nodes, { collapsed: new Set(["wide"]) });

    expect(closed.width).toBeLessThan(open.width);
  });

  it("emits an edge for every visible parent-child pair", () => {
    const layout = layoutTree([node("a"), node("b", "a"), node("c", "a")]);

    expect(layout.edges).toHaveLength(2);
    expect(layout.edges).toContainEqual({ from: "a", to: "b" });
    expect(layout.edges).toContainEqual({ from: "a", to: "c" });
  });

  it("terminates on a cycle instead of hanging", () => {
    // Nothing validates against this on the way into the database, so the
    // render has to survive it.
    const layout = layoutTree([node("a"), node("b", "c"), node("c", "b")]);

    expect(layout.nodes.has("a")).toBe(true);
    expect(layout.nodes.has("b")).toBe(true);
    expect(layout.nodes.has("c")).toBe(true);
  });

  it("still places a node whose parent is missing", () => {
    // An unreachable node silently vanishing from the canvas would look exactly
    // like lost work, so it is swept up as an extra root.
    const layout = layoutTree([node("a"), node("orphan", "gone")]);

    const orphan = layout.nodes.get("orphan")!;
    expect(orphan).toBeDefined();
    expect(orphan.depth).toBe(0);
    expect(orphan.y).toBe(0);
  });

  it("gives a row the height of its tallest card", () => {
    const layout = layoutTree([node("a"), node("b", "a"), node("c", "a")], {
      heightOf: (id) => (id === "b" ? 160 : 72),
    });

    const b = layout.nodes.get("b")!;
    const c = layout.nodes.get("c")!;

    // Same row, so the short card gets the tall card's row height — otherwise
    // the tall one would overlap whatever sits below it.
    expect(b.height).toBe(160);
    expect(c.height).toBe(160);
    expect(b.y).toBe(c.y);
  });

  it("returns an empty layout for an empty tree", () => {
    const layout = layoutTree([]);

    expect(layout.nodes.size).toBe(0);
    expect(layout.edges).toHaveLength(0);
    expect(layout.width).toBe(0);
    expect(layout.height).toBe(0);
  });
});
