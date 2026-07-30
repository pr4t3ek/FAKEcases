/**
 * Shape rules for the framework tree, kept apart from the React builder so they
 * can be reasoned about (and tested) as plain data.
 *
 * The tree is stored flat, as an array of nodes carrying a `parentId` pointer;
 * sibling order is array order within a parent. Only the structural fields are
 * needed here, so the helpers take a structural generic rather than importing
 * `UiFrameworkNode` — `lib/` doesn't depend on `components/`.
 */

type TreeNode = { id: string; parentId: string | null };

/** Children of `parentId`, in array order — sibling order IS array order. */
function childrenOf<T extends TreeNode>(nodes: T[], parentId: string | null): T[] {
  return nodes.filter((n) => n.parentId === parentId);
}

/**
 * Which root branch a node descends from, as an index into the roots.
 *
 * Drives the qualitative tree's colour: hue comes from the family, not the
 * depth, because a tree with several roots needs "same colour = same top-level
 * branch" to read before nesting does. Returns -1 for an unknown id, and stops
 * on a cycle rather than hanging the render that calls it.
 */
export function rootIndexOf<T extends TreeNode>(nodes: T[], id: string): number {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const seen = new Set<string>();
  let current = byId.get(id);
  while (current && current.parentId && !seen.has(current.id)) {
    seen.add(current.id);
    current = byId.get(current.parentId);
  }
  if (!current) return -1;
  return childrenOf(nodes, null).findIndex((r) => r.id === current!.id);
}

/** Every descendant id of `id`, depth-first. Cycle-safe. */
export function descendantIds<T extends TreeNode>(nodes: T[], id: string): string[] {
  const out: string[] = [];
  const walk = (parentId: string, seen: Set<string>) => {
    for (const child of childrenOf(nodes, parentId)) {
      if (seen.has(child.id)) continue;
      seen.add(child.id);
      out.push(child.id);
      walk(child.id, seen);
    }
  };
  walk(id, new Set([id]));
  return out;
}

/**
 * Insert a new sibling directly after `id`, so Enter in a label lands the next
 * bucket where the eye expects it rather than at the end of the list.
 */
export function insertSiblingAfter<T extends TreeNode>(nodes: T[], id: string, fresh: T): T[] {
  const index = nodes.findIndex((n) => n.id === id);
  if (index === -1) return [...nodes, fresh];
  const anchor = nodes[index];
  const withParent = { ...fresh, parentId: anchor.parentId } as T;
  // Insert after the anchor AND after everything nested under it, so the new
  // sibling doesn't land in the middle of the anchor's own subtree.
  const subtree = new Set(descendantIds(nodes, id));
  let at = index + 1;
  while (at < nodes.length && subtree.has(nodes[at].id)) at++;
  return [...nodes.slice(0, at), withParent, ...nodes.slice(at)];
}

/**
 * Tab: make a node a child of its previous sibling. A first child has no
 * previous sibling to adopt it, so indenting there is a no-op rather than an
 * error — the same way an outliner behaves.
 */
export function indentNode<T extends TreeNode>(nodes: T[], id: string): T[] {
  const node = nodes.find((n) => n.id === id);
  if (!node) return nodes;
  const siblings = childrenOf(nodes, node.parentId);
  const position = siblings.findIndex((s) => s.id === id);
  if (position <= 0) return nodes;
  const newParent = siblings[position - 1];
  return nodes.map((n) => (n.id === id ? { ...n, parentId: newParent.id } : n));
}

/**
 * Shift+Tab: lift a node to be its parent's next sibling. A root has nowhere to
 * go, so outdenting there is a no-op.
 */
export function outdentNode<T extends TreeNode>(nodes: T[], id: string): T[] {
  const node = nodes.find((n) => n.id === id);
  if (!node?.parentId) return nodes;
  const parent = nodes.find((n) => n.id === node.parentId);
  if (!parent) return nodes;
  const lifted = nodes.map((n) => (n.id === id ? { ...n, parentId: parent.parentId } : n));
  // Re-seat it directly after the old parent's subtree, so an outdented node
  // appears below what it came out of instead of jumping to the end.
  const moved = lifted.find((n) => n.id === id)!;
  const without = lifted.filter((n) => n.id !== id);
  return insertSiblingAfter(without, parent.id, moved);
}

/**
 * The step a newly picked palette/custom step attaches under.
 *
 * An estimate is one narrowing chain, not a set of peers: the population is
 * sliced by the segmentation, which is multiplied by the frequency. So only the
 * very first pick starts a root — every pick after it extends the tip of the
 * chain, found by walking from the last root down through last children.
 *
 * Null means the tree is empty, which is the only case that creates a root.
 * Branching a step into sibling segments is the row's own "+" button, not this.
 */
export function resolveAttachTarget<T extends TreeNode>(nodes: T[]): T | null {
  const lastChildOf = (parentId: string | null): T | undefined => {
    let found: T | undefined;
    for (const n of nodes) if (n.parentId === parentId) found = n;
    return found;
  };

  let tip = lastChildOf(null);
  if (!tip) return null;

  // Nothing validates against a cycle in stored data; a `seen` set keeps one
  // from hanging the render that calls this.
  const seen = new Set<string>([tip.id]);
  for (;;) {
    const next = lastChildOf(tip.id);
    if (!next || seen.has(next.id)) return tip;
    seen.add(next.id);
    tip = next;
  }
}
