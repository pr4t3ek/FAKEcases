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
