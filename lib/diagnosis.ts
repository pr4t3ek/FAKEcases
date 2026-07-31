/**
 * Reading a marked-up issue tree as a diagnosis.
 *
 * A qualitative case is worked by marking branches: "healthy" eliminates one,
 * "problem" says the cause is somewhere inside it. Marking is a narrowing
 * gesture, so the answer is not a single node but a PATH — Cost → Primary
 * Activities → Distribution — ending on a branch with nothing left underneath.
 *
 * Two rules hold this together, and both are deliberate:
 *
 *   - Status is never derived. A "problem" child does not redden its parent, and
 *     a parent's mark says nothing about which child is at fault. "The problem is
 *     in here" and "this is the cause" are different claims, and a candidate has
 *     to make each one explicitly.
 *   - Two problem siblings are legitimate. A business can have two problems, so
 *     this reports every path rather than assuming one and picking a winner.
 *
 * Pure and structural: no scoring, no question content. `lib/evaluation.ts`
 * grades these paths against the question's authored root cause.
 */

export interface DiagnosisNode {
  id: string;
  parentId: string | null;
  label: string;
  status?: string | null;
}

export interface DiagnosisTrail {
  /** Every chain of `problem` marks, root-most first, as node ids. */
  paths: string[][];
  /** The same chains as labels, for display. */
  labelPaths: string[][];
  /** Branches explicitly cleared. */
  cleared: number;
  /** Branches never given a verdict. */
  unexamined: number;
  /**
   * True once some path ends on a problem node with no children at all — the
   * candidate has narrowed as far as their tree goes. A case abandoned at
   * "Cost" has located a region, not a cause, and reads as incomplete.
   */
  complete: boolean;
  /**
   * Problem nodes whose children are all marked healthy. Not an error — usually
   * it means the real cause is a branch they haven't added yet — but worth
   * surfacing quietly.
   */
  contradictions: string[];
}

const isProblem = (n: DiagnosisNode) => n.status === "problem";
const isHealthy = (n: DiagnosisNode) => n.status === "healthy";

export function diagnosisTrail(nodes: DiagnosisNode[]): DiagnosisTrail {
  const byParent = new Map<string | null, DiagnosisNode[]>();
  for (const n of nodes) {
    const arr = byParent.get(n.parentId) ?? [];
    arr.push(n);
    byParent.set(n.parentId, arr);
  }
  const childrenOf = (id: string) => byParent.get(id) ?? [];

  const paths: string[][] = [];
  const labelPaths: string[][] = [];
  const contradictions: string[] = [];
  let complete = false;

  /**
   * Walk down through problem marks. `seen` guards against a cycle in stored
   * data, which nothing validates against on the way in.
   */
  function walk(node: DiagnosisNode, ids: string[], labels: string[], seen: Set<string>) {
    const nextIds = [...ids, node.id];
    const nextLabels = [...labels, node.label.trim() || "Untitled"];
    const children = childrenOf(node.id);
    const problemChildren = children.filter((c) => isProblem(c) && !seen.has(c.id));

    if (children.length > 0 && problemChildren.length === 0) {
      // Marked as containing the problem, but nothing inside it is.
      if (children.every(isHealthy)) contradictions.push(node.id);
    }

    if (problemChildren.length === 0) {
      // Terminal for this path. Only a branch with NO children counts as a
      // finished diagnosis — one with unexamined children is still mid-drill.
      if (children.length === 0) complete = true;
      paths.push(nextIds);
      labelPaths.push(nextLabels);
      return;
    }
    for (const child of problemChildren) {
      seen.add(child.id);
      walk(child, nextIds, nextLabels, seen);
    }
  }

  // Start only from problem nodes whose parent is NOT a problem, so a path is
  // reported once from its top rather than once per node along it.
  const byId = new Map(nodes.map((n) => [n.id, n]));
  for (const node of nodes) {
    if (!isProblem(node)) continue;
    const parent = node.parentId ? byId.get(node.parentId) : null;
    if (parent && isProblem(parent)) continue;
    walk(node, [], [], new Set([node.id]));
  }

  return {
    paths,
    labelPaths,
    cleared: nodes.filter(isHealthy).length,
    unexamined: nodes.filter((n) => !n.status || n.status === "unknown").length,
    complete,
    contradictions,
  };
}

/**
 * What the candidate sees WHILE working. Their own marked path and nothing else.
 *
 * Deliberately free of counts and verdicts. "2 unexamined" tells them how much
 * is left to look at, and "diagnosis complete" tells them they have bottomed
 * out — both are progress signals no interviewer would ever give, and a
 * candidate would learn to drill until the app stopped saying "still drilling".
 * The path itself is only a readback of what they marked, so it guides nothing.
 */
export function describeTrailLive(trail: DiagnosisTrail): string {
  if (trail.labelPaths.length === 0) {
    return "Mark branches as you rule them out, and where you think the problem is.";
  }
  return trail.labelPaths.map((p) => p.join(" → ")).join("  ·  ");
}

/** The full picture, for the report — after submitting, this is feedback. */
export function describeTrail(trail: DiagnosisTrail): string {
  if (trail.labelPaths.length === 0) {
    return trail.unexamined > 0
      ? "No branches marked yet — mark what you've ruled out, and where the problem is."
      : "No branches marked yet.";
  }
  const routes = trail.labelPaths.map((p) => p.join(" → ")).join("  ·  ");
  const bits = [routes, `${trail.cleared} cleared`];
  if (trail.unexamined > 0) bits.push(`${trail.unexamined} unexamined`);
  bits.push(trail.complete ? "diagnosis complete" : "still drilling");
  return bits.join(" · ");
}

/**
 * Has this branch come up in the conversation at all?
 *
 * The evidence test for "did you check before you judged". Deliberately loose
 * and deliberately client-safe: it reads only the transcript, so the app never
 * has to ship the question's fact topics to the browser — which would itself
 * tell a candidate which branches have data behind them, and therefore which
 * ones matter.
 */
const STOPWORDS = new Set([
  "the", "and", "for", "per", "from", "with", "cost", "costs", "side", "level",
  "other", "new", "total", "value", "rate", "number",
]);

export function branchDiscussed(label: string, conversation: string[]): boolean {
  const words = label
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 3 && !STOPWORDS.has(w));
  if (words.length === 0) return true; // nothing distinctive to look for
  const hay = conversation.join(" ").toLowerCase();
  return words.some((w) => hay.includes(w));
}
