/**
 * Per-node styling for the framework tree, shared by the builder and the
 * read-only mirror in the progress panel so both read as the same structure.
 *
 * Nesting is shown by containment: a step is a tinted box, and a step with
 * children is a bigger box holding their boxes.
 *
 * Two axes, because the two modes have different shapes:
 *   - A numeric estimate is ONE narrowing chain, so there is only ever one root
 *     and colour can vary by depth. `depthStyle` keeps that behaviour exactly.
 *   - A qualitative tree has SEVERAL roots (Revenue | Cost), and depth-only
 *     colouring would make every depth-1 node look alike no matter which branch
 *     it hangs from. So `familyStyle` takes hue from the root ancestor and shade
 *     from depth: one family, one colour, lightening as it nests.
 *
 * The ramp stays in the cool half of the wheel on purpose. The builder spends
 * amber on an unrecognized or legacy value, emerald/amber on the shares-total
 * check, red on delete — and in qualitative mode every row carries a red/green
 * traffic light. Structure must never look like status, so no family hue goes
 * near red or green.
 *
 * Every class here is a complete literal string: Tailwind scans this file for
 * names, and a constructed one (`bg-${hue}-50`) would silently emit no CSS.
 * That is why the family ramp is written out rather than generated.
 */

import type { NodeStatus } from "@/lib/types";

export const DEPTH_STYLES = [
  {
    box: "border-sky-300 bg-sky-50 dark:border-sky-500/30 dark:bg-sky-500/10",
    chip: "border-sky-300 bg-sky-100 dark:border-sky-500/30 dark:bg-sky-500/15",
    grip: "text-sky-400 dark:text-sky-500/70",
  },
  {
    box: "border-indigo-300 bg-indigo-50 dark:border-indigo-500/30 dark:bg-indigo-500/10",
    chip: "border-indigo-300 bg-indigo-100 dark:border-indigo-500/30 dark:bg-indigo-500/15",
    grip: "text-indigo-400 dark:text-indigo-500/70",
  },
  {
    box: "border-violet-300 bg-violet-50 dark:border-violet-500/30 dark:bg-violet-500/10",
    chip: "border-violet-300 bg-violet-100 dark:border-violet-500/30 dark:bg-violet-500/15",
    grip: "text-violet-400 dark:text-violet-500/70",
  },
  {
    box: "border-fuchsia-300 bg-fuchsia-50 dark:border-fuchsia-500/30 dark:bg-fuchsia-500/10",
    chip: "border-fuchsia-300 bg-fuchsia-100 dark:border-fuchsia-500/30 dark:bg-fuchsia-500/15",
    grip: "text-fuchsia-400 dark:text-fuchsia-500/70",
  },
] as const;

/** Cycles, so an arbitrarily deep tree still renders — adjacent levels never
 * share a hue, which is the distinction that has to hold. */
export function depthStyle(depth: number) {
  return DEPTH_STYLES[depth % DEPTH_STYLES.length];
}

/**
 * Family ramp: one entry per root branch, three shades deep before it repeats.
 *
 * Shade carries depth *within* a family, so the eye reads "same colour = same
 * top-level branch" first and nesting second — which is the right priority once
 * a tree can have five roots. Depth cycles rather than fading to nothing, so a
 * tree deeper than three levels stays legible.
 */
const FAMILY_STYLES = [
  [
    { box: "border-sky-400 bg-sky-100 dark:border-sky-500/40 dark:bg-sky-500/15", grip: "text-sky-500 dark:text-sky-400/70" },
    { box: "border-sky-300 bg-sky-50 dark:border-sky-500/25 dark:bg-sky-500/10", grip: "text-sky-400 dark:text-sky-500/60" },
    { box: "border-sky-200 bg-sky-50/50 dark:border-sky-500/15 dark:bg-sky-500/5", grip: "text-sky-300 dark:text-sky-500/50" },
  ],
  [
    { box: "border-violet-400 bg-violet-100 dark:border-violet-500/40 dark:bg-violet-500/15", grip: "text-violet-500 dark:text-violet-400/70" },
    { box: "border-violet-300 bg-violet-50 dark:border-violet-500/25 dark:bg-violet-500/10", grip: "text-violet-400 dark:text-violet-500/60" },
    { box: "border-violet-200 bg-violet-50/50 dark:border-violet-500/15 dark:bg-violet-500/5", grip: "text-violet-300 dark:text-violet-500/50" },
  ],
  [
    { box: "border-indigo-400 bg-indigo-100 dark:border-indigo-500/40 dark:bg-indigo-500/15", grip: "text-indigo-500 dark:text-indigo-400/70" },
    { box: "border-indigo-300 bg-indigo-50 dark:border-indigo-500/25 dark:bg-indigo-500/10", grip: "text-indigo-400 dark:text-indigo-500/60" },
    { box: "border-indigo-200 bg-indigo-50/50 dark:border-indigo-500/15 dark:bg-indigo-500/5", grip: "text-indigo-300 dark:text-indigo-500/50" },
  ],
  [
    { box: "border-fuchsia-400 bg-fuchsia-100 dark:border-fuchsia-500/40 dark:bg-fuchsia-500/15", grip: "text-fuchsia-500 dark:text-fuchsia-400/70" },
    { box: "border-fuchsia-300 bg-fuchsia-50 dark:border-fuchsia-500/25 dark:bg-fuchsia-500/10", grip: "text-fuchsia-400 dark:text-fuchsia-500/60" },
    { box: "border-fuchsia-200 bg-fuchsia-50/50 dark:border-fuchsia-500/15 dark:bg-fuchsia-500/5", grip: "text-fuchsia-300 dark:text-fuchsia-500/50" },
  ],
  [
    { box: "border-blue-400 bg-blue-100 dark:border-blue-500/40 dark:bg-blue-500/15", grip: "text-blue-500 dark:text-blue-400/70" },
    { box: "border-blue-300 bg-blue-50 dark:border-blue-500/25 dark:bg-blue-500/10", grip: "text-blue-400 dark:text-blue-500/60" },
    { box: "border-blue-200 bg-blue-50/50 dark:border-blue-500/15 dark:bg-blue-500/5", grip: "text-blue-300 dark:text-blue-500/50" },
  ],
  [
    { box: "border-purple-400 bg-purple-100 dark:border-purple-500/40 dark:bg-purple-500/15", grip: "text-purple-500 dark:text-purple-400/70" },
    { box: "border-purple-300 bg-purple-50 dark:border-purple-500/25 dark:bg-purple-500/10", grip: "text-purple-400 dark:text-purple-500/60" },
    { box: "border-purple-200 bg-purple-50/50 dark:border-purple-500/15 dark:bg-purple-500/5", grip: "text-purple-300 dark:text-purple-500/50" },
  ],
] as const;

/** Hue from the root branch this node descends from, shade from its depth. */
export function familyStyle(rootIndex: number, depth: number) {
  const family = FAMILY_STYLES[Math.max(0, rootIndex) % FAMILY_STYLES.length];
  return family[Math.max(0, depth) % family.length];
}

// ── Status ────────────────────────────────────────────────────────────────

/** The traffic-light badge. Shared by the outline and the canvas card. */
export const STATUS_STYLE: Record<NodeStatus, string> = {
  unknown: "border-input bg-background text-muted-foreground/60",
  healthy: "border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  problem: "border-red-500/50 bg-red-500/10 text-red-600 dark:text-red-400",
};

/**
 * The verdict washes the whole row in the OUTLINE, where a row is the only
 * surface a node has and a 4mm badge is not something you can scan a
 * twelve-branch tree with.
 *
 * The weights are deliberately uneven. A problem branch is where the candidate
 * is working, so it is the loudest thing on screen; a cleared branch has been
 * eliminated and should recede rather than compete for attention. Colour is
 * never the only signal: the badge keeps its "OK" / "!" text.
 */
export const STATUS_ROW: Record<NodeStatus, string> = {
  unknown: "bg-card",
  healthy: "border-emerald-500/40 bg-emerald-500/[0.07]",
  problem: "border-red-500/50 bg-red-500/[0.12]",
};

/**
 * On the CANVAS the verdict takes the border instead of the fill, because the
 * fill is already spoken for: a card's background carries its family hue, and
 * washing it green the moment a branch is marked would erase which top-level
 * branch it belongs to — exactly the thing the family ramp exists to show. A
 * heavy border reads as loudly at a glance and leaves the fill alone, so a card
 * says "Cost family" and "ruled out" at the same time.
 */
export const CARD_STATUS_BORDER: Record<NodeStatus, string> = {
  unknown: "",
  healthy: "!border-emerald-500 dark:!border-emerald-400",
  problem: "!border-red-500 dark:!border-red-400",
};

/**
 * Connector stroke. An edge into a marked branch takes that branch's colour, so
 * the trail of problem marks — which IS the diagnosis being graded — can be
 * followed down the diagram without reading a single label.
 */
export const EDGE_STROKE: Record<NodeStatus, string> = {
  unknown: "hsl(var(--border))",
  healthy: "rgb(16 185 129 / 0.55)",
  problem: "rgb(239 68 68 / 0.75)",
};
