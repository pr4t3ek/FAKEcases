import { describe, expect, it } from "vitest";
import { chainResult, rollup } from "@/lib/framework-rollup";

/**
 * The arithmetic that was lifted out of `framework-builder.tsx`.
 *
 * These pin the behaviour the builder had before the extraction, because both
 * the builder's chain result and `lib/walkthrough/validate.ts` now depend on
 * this one function — and the walkthrough's whole promise is that what a
 * student watches is what the builder computes when they type it.
 */
describe("rollup", () => {
  const node = (
    id: string,
    parentId: string | null,
    value = "",
    multiplier = "",
    combine: "sum" | "multiply" = "sum",
  ) => ({ id, parentId, value, multiplier, combine });

  it("multiplies a child's share and rate through its parent", () => {
    const nodes = [node("pop", null, "1.3cr"), node("drink", "pop", "65%", "1.5")];
    const { resolved } = rollup(nodes);
    expect(resolved.get("pop")).toBe(13_000_000);
    expect(resolved.get("drink")).toBeCloseTo(12_675_000, 0);
  });

  it("sums sibling branches into their parent", () => {
    const nodes = [
      node("pop", null, "1.3cr"),
      node("a", "pop", "65%", "1.5"),
      node("b", "pop", "10%", "1.5"),
    ];
    expect(rollup(nodes).total.get("pop")).toBeCloseTo(14_625_000, 0);
  });

  it("multiplies siblings when the parent says so", () => {
    const nodes = [
      node("root", null, "100", "", "multiply"),
      node("a", "root", "", "2"),
      node("b", "root", "", "3"),
    ];
    // 100×2 and 100×3, combined by multiply.
    expect(rollup(nodes).total.get("root")).toBe(60_000);
  });

  it("treats an empty box as a neutral pass-through", () => {
    const nodes = [node("group", null), node("leaf", "group", "50")];
    expect(rollup(nodes).resolved.get("leaf")).toBe(50);
  });

  it("marks a node live only once something real feeds it", () => {
    const { live } = rollup([node("empty", null), node("filled", null, "5")]);
    expect(live.get("empty")).toBe(false);
    expect(live.get("filled")).toBe(true);
  });

  it("inherits liveness down the tree", () => {
    const { live } = rollup([node("root", null, "10"), node("child", "root")]);
    expect(live.get("child")).toBe(true);
  });

  it("survives a cycle instead of hanging", () => {
    const nodes = [node("a", "b", "2"), node("b", "a", "3")];
    expect(() => rollup(nodes)).not.toThrow();
  });

  it("returns null from chainResult when nothing has been entered", () => {
    expect(chainResult([node("a", null), node("b", null)])).toBeNull();
  });

  it("sums roots in chainResult", () => {
    expect(chainResult([node("a", null, "10"), node("b", null, "5")])).toBe(15);
  });
});
