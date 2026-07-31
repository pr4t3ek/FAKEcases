/**
 * Turning the framework corpus into things the builder can offer.
 *
 * Three jobs, and the interesting one is the third. The corpus overlaps heavily
 * — "Cost" appears in three of the five frameworks, "Joint Venture" is both a
 * Mode of Entry and a route to Inorganic Growth — so a bare label cannot say
 * which framework a candidate is building. Guessing from the last word typed
 * would offer Profitability's children inside a Market Entry tree.
 *
 * Pure and offline: no network, no model, no quota. Everything here is
 * keystroke-latency work.
 */

import { FRAMEWORKS, type Framework, type FrameworkNodeTemplate } from "@/lib/config/frameworks";

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/**
 * A canonical form for term matching, not a real word.
 *
 * Without it "Joint Ventures" (Growth) and "Joint Venture" (Market Entry) index
 * as two different terms, so a concept the two frameworks genuinely share looks
 * unique to each — and a plural typo decides the framework.
 */
const stem = (s: string) =>
  norm(s)
    .split(" ")
    .map((w) => (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w))
    .join(" ");

/** Every wording that means this branch. */
function namesOf(node: FrameworkNodeTemplate): string[] {
  return [node.label, ...(node.aliases ?? [])];
}

function matchesLabel(node: FrameworkNodeTemplate, label: string): boolean {
  const target = norm(label);
  if (!target) return false;
  return namesOf(node).some((name) => {
    const n = norm(name);
    return n === target || n.startsWith(target) || target.startsWith(n);
  });
}

function walk(
  nodes: FrameworkNodeTemplate[],
  visit: (node: FrameworkNodeTemplate, depth: number) => void,
  depth = 0,
) {
  for (const node of nodes) {
    visit(node, depth);
    if (node.children) walk(node.children, visit, depth + 1);
  }
}

// ── 1. What goes under this branch ────────────────────────────────────────

/**
 * The children a framework declares for a branch, found by name.
 *
 * Matching on the branch's own name rather than its position is deliberate: a
 * candidate types "Cost" wherever they like, and the framework's answer to
 * "what's inside Cost" is the same regardless of where they put it.
 */
export function childrenFor(
  framework: Framework | null,
  label: string,
): FrameworkNodeTemplate[] {
  if (!framework || !label.trim()) return [];
  let found: FrameworkNodeTemplate[] = [];
  walk(framework.children, (node) => {
    if (found.length === 0 && matchesLabel(node, label) && node.children?.length) {
      found = node.children;
    }
  });
  return found;
}

/** The framework's own top level, for the opening move. */
export function rootsFor(framework: Framework | null): FrameworkNodeTemplate[] {
  return framework?.children ?? [];
}

// ── 2. Completing a label as it is typed ──────────────────────────────────

/**
 * Ghost completion for a partly-typed label.
 *
 * Prefers the current framework's own vocabulary, then falls back to the whole
 * corpus — a candidate who reaches for a branch from another framework should
 * still get help typing it, since cross-framework nodes are normal.
 */
export function completeLabel(prefix: string, framework: Framework | null): string | null {
  const p = norm(prefix);
  if (p.length < 2) return null;

  // Already a complete branch name. "Cost" should not ghost into "Cost plus"
  // just because a longer label happens to start the same way — the candidate
  // has finished typing.
  for (const f of FRAMEWORKS) {
    let exact = false;
    walk(f.children, (n) => {
      if (namesOf(n).some((name) => norm(name) === p)) exact = true;
    });
    if (exact) return null;
  }

  const pools: FrameworkNodeTemplate[][] = [];
  if (framework) {
    const own: FrameworkNodeTemplate[] = [];
    walk(framework.children, (n) => own.push(n));
    pools.push(own);
  }
  const all: FrameworkNodeTemplate[] = [];
  for (const f of FRAMEWORKS) walk(f.children, (n) => all.push(n));
  pools.push(all);

  for (const pool of pools) {
    // Shortest match wins: "cost" should complete to "Cost", not to
    // "Cost of goods sold and everything after it".
    const candidates = pool
      .flatMap(namesOf)
      .filter((name) => norm(name).startsWith(p) && norm(name) !== p)
      .sort((a, b) => a.length - b.length);
    if (candidates.length) return candidates[0];
  }

  // Finally the framework names themselves, so typing "profit…" completes to
  // "Profitability" — the flagship case, where accepting the completion is what
  // brings the whole structure with it.
  const frameworkName = FRAMEWORKS.map((f) => f.label)
    .filter((name) => norm(name).startsWith(p) && norm(name) !== p)
    .sort((a, b) => a.length - b.length)[0];
  return frameworkName ?? null;
}

/**
 * A completion that names a whole framework rather than a branch — accepting it
 * should offer that framework's top level, not just fill in a word.
 */
export function frameworkNamed(label: string): Framework | null {
  const target = norm(label);
  return FRAMEWORKS.find((f) => norm(f.label) === target) ?? null;
}

// ── 3. Which framework is this? ───────────────────────────────────────────

/**
 * How much each term narrows the field, by how few frameworks contain it.
 *
 * Plain inverse document frequency over five documents. A term in one framework
 * decides it; a term in three says nothing. This is why "Cost" is worthless as a
 * signal and "Break-even" is decisive, and it is computed rather than
 * hand-tuned so that adding a framework re-weights everything automatically —
 * which matters, because adding M&A as its own framework is exactly what dilutes
 * "Acquisition" and "Joint Venture".
 */
function buildTermWeights(): Map<string, { weight: number; slugs: Set<string> }> {
  const bySlug = new Map<string, Set<string>>();
  for (const framework of FRAMEWORKS) {
    const terms = new Set<string>();
    walk(framework.children, (node) => {
      for (const name of namesOf(node)) terms.add(stem(name));
      // Hints count for detection even though they are not nodes: "TAM, SAM,
      // SOM" and "Break-even analysis" are exactly the distinctive vocabulary a
      // candidate types, and a term that turns out to be shared is diluted by
      // the same IDF that dilutes everything else.
      for (const hint of node.hints ?? []) terms.add(stem(hint));
    });
    for (const trigger of framework.triggers) terms.add(stem(trigger));
    bySlug.set(framework.slug, terms);
  }

  const index = new Map<string, { weight: number; slugs: Set<string> }>();
  for (const [slug, terms] of bySlug) {
    for (const term of terms) {
      const entry = index.get(term) ?? { weight: 0, slugs: new Set<string>() };
      entry.slugs.add(slug);
      index.set(term, entry);
    }
  }
  for (const entry of index.values()) entry.weight = 1 / entry.slugs.size;
  return index;
}

const TERM_WEIGHTS = buildTermWeights();

/** One exact, unique branch name scores 1.0; a term shared by two scores 0.5. */
const CONFIDENCE_FLOOR = 0.9;

export interface FrameworkGuess {
  framework: Framework | null;
  /** True when one framework clearly beat the rest. */
  confident: boolean;
  /** Ranked runners-up, for the chooser shown when nothing is confident. */
  candidates: { framework: Framework; score: number }[];
}

/**
 * Infer the framework from the labels typed so far.
 *
 * `authored` is the question's own declared framework and outranks inference —
 * it is a fact rather than a guess. `established` is a framework already chosen
 * for this tree, which makes detection sticky: a tree does not change framework
 * because one ambiguous branch was added late.
 */
export function detectFramework(
  labels: string[],
  opts: { authored?: string | null; established?: string | null } = {},
): FrameworkGuess {
  const scores = new Map<string, number>();
  const bump = (slug: string, by: number) =>
    scores.set(slug, (scores.get(slug) ?? 0) + by);

  for (const label of labels) {
    const term = stem(label);
    if (!term) continue;
    // One label contributes its BEST match per framework, never the sum over
    // every corpus term it happens to touch. Summing let a single generic word
    // like "Cost" score 3.08 — higher than three decisive terms — because the
    // corpus contains "Cost", "Cost Based", "Variable Cost" and the rest, and it
    // matched all of them.
    const best = new Map<string, number>();
    for (const [candidate, entry] of TERM_WEIGHTS) {
      // Substring both ways: "Delivery cost per order" should still hit
      // "Distribution and Storage"'s alias "Delivery".
      if (!(term.includes(candidate) || candidate.includes(term))) continue;
      // A short generic term matching a long framework label is mostly noise.
      const lengthRatio =
        Math.min(term.length, candidate.length) / Math.max(term.length, candidate.length);
      const contribution = entry.weight * lengthRatio;
      for (const slug of entry.slugs) {
        best.set(slug, Math.max(best.get(slug) ?? 0, contribution));
      }
    }
    for (const [slug, contribution] of best) bump(slug, contribution);
  }

  if (opts.authored) bump(opts.authored, 5);
  if (opts.established) bump(opts.established, 3);

  const ranked = [...scores.entries()]
    .map(([slug, score]) => ({ framework: FRAMEWORKS.find((f) => f.slug === slug)!, score }))
    .filter((r) => r.framework && r.score > 0)
    .sort((a, b) => b.score - a.score);

  if (ranked.length === 0) return { framework: null, confident: false, candidates: [] };

  const [top, next] = ranked;
  // Two conditions, and the floor matters as much as the margin. A margin alone
  // called 0.50 vs 0.33 "confident" — a single term two frameworks share,
  // deciding the tree on a rounding difference. The floor is set so that one
  // exact, unique branch name (weight 1.0) is enough and one shared term is not.
  const confident =
    top.score >= CONFIDENCE_FLOOR && (!next || top.score >= next.score * 1.5);
  return {
    framework: confident ? top.framework : null,
    confident,
    candidates: ranked.slice(0, 3),
  };
}
