/**
 * The tree's arithmetic, as a pure function.
 *
 * One step's number is `inherited × own value × own rate`; a parent with
 * children reports what its children come to, combined by its own Sum/Multiply
 * toggle. That is the whole model, and it is what the chain result under the
 * builder is showing.
 *
 * ## Why this is not in the builder any more
 *
 * It used to live inside `components/practice/framework-builder.tsx`, which was
 * fine while the builder was the only thing that needed it. It is not any more:
 * `lib/walkthrough/validate.ts` has to compute the same numbers to prove a
 * worked example actually reaches its question's authored answer before a
 * student is ever shown it.
 *
 * A second copy of this arithmetic would be the worst possible place for a
 * divergence. The walkthrough's entire promise is "what you are watching is
 * what the builder will compute when you type it yourself" — so the two must be
 * the same code, not two readings of the same rules.
 *
 * Structural generic rather than `UiFrameworkNode`, matching
 * `lib/framework-tree.ts`: `lib/` does not depend on `components/`.
 */

import { parseNodeValue } from "@/lib/framework-value";

/** The fields the arithmetic reads. Anything else on a node is irrelevant here. */
export interface RollupNode {
  id: string;
  parentId: string | null;
  value?: string | null;
  /** Second factor applied on top of `value` — a per-segment rate. Blank = 1. */
  multiplier?: string | null;
  /** How this node's children combine into its own number. */
  combine?: "sum" | "multiply" | null;
}

export interface Rollup {
  /** This step's own number: everything above it, times its own two boxes. */
  resolved: Map<string, number>;
  /** What this step reports upward — its children's total, or its own number. */
  total: Map<string, number>;
  /**
   * Whether anything real feeds this step yet.
   *
   * A step with both boxes empty resolves to a neutral ×1, and rendering that
   * as a literal "1" would put a number on the screen the candidate never
   * entered. `live` is what lets the UI show "–" instead.
   */
  live: Map<string, boolean>;
  /** Every root's total, in order. */
  roots: number[];
}

/**
 * Resolve a whole tree.
 *
 * Cycle-safe: a node already seen on the current path is not descended into
 * again. A malformed tree should render oddly rather than hang the browser, and
 * a walkthrough drafted by a model is exactly the sort of input that could
 * carry one.
 */
export function rollup<T extends RollupNode>(nodes: T[]): Rollup {
  const byParent = new Map<string | null, T[]>();
  for (const n of nodes) {
    const arr = byParent.get(n.parentId) ?? [];
    arr.push(n);
    byParent.set(n.parentId, arr);
  }

  const resolved = new Map<string, number>();
  const total = new Map<string, number>();
  const live = new Map<string, boolean>();

  function visit(node: T, inherited: number, inheritedLive: boolean, seen: Set<string>): number {
    const own = parseNodeValue(node.value) ?? 1;
    const rate = parseNodeValue(node.multiplier) ?? 1;
    const here = inherited * own * rate;
    const isLive = inheritedLive || !!node.value?.trim() || !!node.multiplier?.trim();

    resolved.set(node.id, here);
    live.set(node.id, isLive);

    const children = (byParent.get(node.id) ?? []).filter((c) => !seen.has(c.id));
    if (children.length === 0) {
      total.set(node.id, here);
      return here;
    }

    const next = new Set(seen).add(node.id);
    const childTotals = children.map((c) => visit(c, here, isLive, next));
    const combined =
      node.combine === "multiply"
        ? childTotals.reduce((a, b) => a * b, 1)
        : childTotals.reduce((a, b) => a + b, 0);

    total.set(node.id, combined);
    return combined;
  }

  const roots = (byParent.get(null) ?? []).map((r) => visit(r, 1, false, new Set()));
  return { resolved, total, live, roots };
}

/**
 * The one number a tree lands on.
 *
 * Roots are SUMMED. A tree with several roots is several partial estimates of
 * the same quantity — "urban demand" and "rural demand" — and adding them is the
 * only reading that makes sense of a candidate who split the problem at the top
 * before splitting it anywhere else. Null when nothing has been entered at all,
 * so a caller can tell "no answer yet" from "an answer of zero".
 */
export function chainResult<T extends RollupNode>(nodes: T[]): number | null {
  const { roots, live } = rollup(nodes);
  if (roots.length === 0) return null;
  const anyLive = [...live.values()].some(Boolean);
  if (!anyLive) return null;
  return roots.reduce((a, b) => a + b, 0);
}
