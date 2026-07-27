/**
 * Per-level styling for the framework tree, shared by the builder and the
 * read-only mirror in the progress panel so both read as the same structure.
 *
 * Nesting is shown by containment: a step is a tinted box, and a step with
 * children is a bigger box holding their boxes. The ramp stays in the cool half
 * of the wheel on purpose — the builder already spends amber on an unrecognized
 * or legacy value, emerald/amber on the shares-total-100% check, and red on
 * delete. Structure must never look like status.
 *
 * Every class here is a complete literal string: Tailwind scans this file for
 * names, and a constructed one (`bg-${hue}-50`) would silently emit no CSS.
 */

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
