/**
 * Tidy-tree layout for the case framework canvas.
 *
 * Turns the flat `{ id, parentId }` list the tree is already stored as into
 * absolute positions for a top-down flow diagram: a parent sits centred over the
 * span of its children, siblings sit side by side, and nothing overlaps.
 *
 * Pure and DOM-free, like the rest of `lib/` — no React, no measurement, no
 * `window`. Card sizes come in as options so the caller decides them once and
 * this stays testable as plain data.
 *
 * Two structural facts about a case tree drive the shape:
 *
 *   - **Several roots is normal.** Revenue and Cost are peers, not one chain, so
 *     roots are packed side by side rather than hung off a synthetic super-root
 *     (which would render as a box nobody asked for).
 *   - **A collapsed branch is a leaf.** Marking a branch healthy folds it away,
 *     and a folded branch has to stop reserving the width of a subtree nobody
 *     can see — otherwise collapsing wouldn't buy back any space.
 */

/** Card geometry. Exported so the canvas and the layout can't disagree. */
export const CARD_WIDTH = 210;
export const CARD_HEIGHT = 72;
const H_GAP = 18;
const V_GAP = 40;

export interface LayoutNode {
  id: string;
  /** Centre x of the card — the anchor both connector ends attach to. */
  x: number;
  /** Top y of the card. */
  y: number;
  depth: number;
  /** Row height at this depth: the tallest card on the row. */
  height: number;
}

export interface LayoutEdge {
  from: string;
  to: string;
}

export interface TreeLayout {
  nodes: Map<string, LayoutNode>;
  edges: LayoutEdge[];
  width: number;
  height: number;
}

export interface LayoutOptions {
  /** Branches whose children are hidden. Laid out as leaves. */
  collapsed?: Set<string>;
  /**
   * Height of one card, by id. A row takes the tallest card on it, so a branch
   * carrying a rationale or a strip of suggestions doesn't overlap the row
   * below. Deterministic by design — the caller computes it from content rather
   * than measuring the DOM, so layout needs only one pass.
   */
  heightOf?: (id: string) => number;
  cardWidth?: number;
  hGap?: number;
  vGap?: number;
}

interface Frame {
  id: string;
  depth: number;
  children: Frame[];
}

type TreeInput = { id: string; parentId: string | null };

/**
 * The visible tree, as frames.
 *
 * Guards two things nothing validates against on the way into the database. A
 * cycle is broken rather than hanging the render. And a node whose parent is
 * missing — or is itself inside a cycle — is unreachable from any root, so it is
 * swept up as an extra root instead of silently vanishing from the canvas, which
 * would look exactly like lost work.
 *
 * Reachability is computed **ignoring `collapsed`**, and that separation is the
 * point: a node behind a folded ancestor is also unreachable, but deliberately
 * so. Sweeping it up would re-plant the subtree the user just folded away as a
 * row of new roots — the opposite of collapsing it.
 */
function buildFrames<T extends TreeInput>(
  nodes: T[],
  collapsed: Set<string>,
): { frames: Frame[]; maxDepth: number } {
  const byParent = new Map<string | null, T[]>();
  for (const n of nodes) {
    const arr = byParent.get(n.parentId) ?? [];
    arr.push(n);
    byParent.set(n.parentId, arr);
  }

  // Pass A — structural reachability, folds and all.
  const reachable = new Set<string>();
  function markReachable(node: T) {
    if (reachable.has(node.id)) return; // also breaks a cycle
    reachable.add(node.id);
    for (const child of byParent.get(node.id) ?? []) markReachable(child);
  }
  const realRoots = byParent.get(null) ?? [];
  for (const root of realRoots) markReachable(root);

  // Real roots first, then anything the structure never reached, in array order
  // so the result is deterministic.
  const starts = [...realRoots, ...nodes.filter((n) => !reachable.has(n.id))];

  // Pass B — frames, honouring the folds this time.
  const placed = new Set<string>();
  let maxDepth = 0;

  function frameFor(node: T, depth: number): Frame {
    placed.add(node.id);
    maxDepth = Math.max(maxDepth, depth);
    const children: Frame[] = [];
    if (!collapsed.has(node.id)) {
      for (const child of byParent.get(node.id) ?? []) {
        if (placed.has(child.id)) continue;
        children.push(frameFor(child, depth + 1));
      }
    }
    return { id: node.id, depth, children };
  }

  const frames: Frame[] = [];
  for (const start of starts) {
    // A swept-up node may already have been drawn as another sweep's child.
    if (placed.has(start.id)) continue;
    frames.push(frameFor(start, 0));
  }
  return { frames, maxDepth };
}

export function layoutTree<T extends TreeInput>(
  nodes: T[],
  opts: LayoutOptions = {},
): TreeLayout {
  const cardWidth = opts.cardWidth ?? CARD_WIDTH;
  const hGap = opts.hGap ?? H_GAP;
  const vGap = opts.vGap ?? V_GAP;
  const collapsed = opts.collapsed ?? new Set<string>();
  const heightOf = opts.heightOf ?? (() => CARD_HEIGHT);

  const positions = new Map<string, LayoutNode>();
  const edges: LayoutEdge[] = [];
  if (nodes.length === 0) {
    return { nodes: positions, edges, width: 0, height: 0 };
  }

  const { frames, maxDepth } = buildFrames(nodes, collapsed);

  // Row geometry first: a card's y depends only on its depth, so the rows can be
  // measured before anything is placed horizontally.
  const rowHeight: number[] = Array.from({ length: maxDepth + 1 }, () => CARD_HEIGHT);
  const walkDepths = (frame: Frame) => {
    rowHeight[frame.depth] = Math.max(rowHeight[frame.depth], heightOf(frame.id));
    frame.children.forEach(walkDepths);
  };
  frames.forEach(walkDepths);

  const rowY: number[] = [];
  let y = 0;
  for (let d = 0; d <= maxDepth; d++) {
    rowY[d] = y;
    y += rowHeight[d] + vGap;
  }

  // Pass 1 — how wide is each subtree? A parent is at least as wide as its own
  // card, so a node with one narrow child still reserves its full width.
  const widths = new Map<string, number>();
  function measure(frame: Frame): number {
    let width = cardWidth;
    if (frame.children.length > 0) {
      const total =
        frame.children.reduce((sum, c) => sum + measure(c), 0) +
        hGap * (frame.children.length - 1);
      width = Math.max(cardWidth, total);
    }
    widths.set(frame.id, width);
    return width;
  }
  frames.forEach(measure);

  // Pass 2 — place. `left` is the left edge of the slot this subtree owns; the
  // children are centred inside it, and the parent is centred over them.
  function place(frame: Frame, left: number) {
    const width = widths.get(frame.id)!;
    let x: number;

    if (frame.children.length === 0) {
      x = left + width / 2;
    } else {
      const childTotal =
        frame.children.reduce((sum, c) => sum + widths.get(c.id)!, 0) +
        hGap * (frame.children.length - 1);
      let cursor = left + (width - childTotal) / 2;
      for (const child of frame.children) {
        place(child, cursor);
        cursor += widths.get(child.id)! + hGap;
        edges.push({ from: frame.id, to: child.id });
      }
      const first = positions.get(frame.children[0].id)!.x;
      const last = positions.get(frame.children[frame.children.length - 1].id)!.x;
      x = (first + last) / 2;
    }

    positions.set(frame.id, {
      id: frame.id,
      x,
      y: rowY[frame.depth],
      depth: frame.depth,
      height: rowHeight[frame.depth],
    });
  }

  let cursor = 0;
  for (const frame of frames) {
    place(frame, cursor);
    cursor += widths.get(frame.id)! + hGap;
  }

  return {
    nodes: positions,
    edges,
    width: Math.max(0, cursor - hGap),
    height: rowY[maxDepth] + rowHeight[maxDepth],
  };
}
