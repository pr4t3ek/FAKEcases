/**
 * The PGP batches a candidate can belong to.
 *
 * The same shape, and the same reasoning, as `./colleges.ts`: the id is a stable
 * grouping key, the label is display, and nothing is free text. A batch is what
 * the cohort actually compares itself on — "am I ahead of my own year, or of the
 * year above?" — and that question only survives if two students in the same
 * batch are stored under the same value.
 *
 * **The year range is display only.** `id` is what a row holds and what a board
 * groups by, so a batch rolling over is a label edit here and nothing else. Were
 * the years part of the id, every September would orphan a cohort's worth of
 * rows.
 *
 * Deliberately just the two, with no "not a PGP student" option. This app is
 * being run for one campus's PGP cohort, so the field is a required choice
 * between the two years rather than a demographic question with an opt-out —
 * see `requireBatch` in lib/batch-gate.ts for the half that makes it mandatory.
 *
 * Not exported through `lib/config/index.ts`, following `./colleges.ts`:
 * authored content that a few modules import by full path, rather than a tunable
 * everything reads.
 */

/**
 * The ids, as a readonly tuple.
 *
 * Declared as literals rather than derived from `BATCHES` with a cast, because
 * `z.enum` infers its output type from exactly this: a `[string, ...string[]]`
 * would validate at runtime and type as a bare `string`, which is how a typo in
 * a form value gets past the compiler.
 */
export const BATCH_IDS = ["pgp1", "pgp2"] as const;
export type BatchId = (typeof BATCH_IDS)[number];

export interface Batch {
  /** Stable grouping key. Never renamed — a rename orphans everyone on it. */
  id: BatchId;
  /** How a board row names it. Short, because it sits beside a college name. */
  label: string;
  /** Joining and graduating years, for the form. Display only. */
  years: string;
}

export const BATCHES: Batch[] = [
  { id: "pgp1", label: "PGP-1", years: "2026–28" },
  { id: "pgp2", label: "PGP-2", years: "2025–27" },
];

export function batchById(id: string | null | undefined): Batch | null {
  if (!id) return null;
  return BATCHES.find((b) => b.id === id) ?? null;
}

export function isKnownBatch(id: string | null | undefined): boolean {
  return batchById(id) !== null;
}

/**
 * How a batch is written on a board row: the bare label.
 *
 * The years are left off on purpose. A row already carries a college name, and
 * "IIM Bangalore · PGP-1 (2026–28)" spends the line's remaining width on a fact
 * every reader of this board already knows.
 */
export function batchLabel(id: string | null | undefined): string | null {
  return batchById(id)?.label ?? null;
}

/** How a batch is written in a form, where the years are the disambiguator. */
export function batchOptionLabel(batch: Batch): string {
  return `${batch.label} (${batch.years})`;
}
