/**
 * What the candidate believed, and when.
 *
 * A hypothesis is revisable throughout Investigate (see `hypothesisEditFor` in
 * `lib/types.ts`), and `SimRun.hypothesis` holds only the current one — the
 * previous belief is overwritten. That is fine for the final score and useless
 * for everything else, because two questions need the history rather than the
 * answer:
 *
 *   - **Scoring.** `scoreInvestigation` rates each pull on whether it spoke to
 *     what the candidate was chasing. Rated against the *final* hypothesis, a
 *     run could buy anything at all and then revise to name whatever those
 *     pulls happened to be evidence for, scoring full relevance for a search it
 *     never conducted. Rated against the belief standing **at the moment of
 *     purchase**, the same run scores what it actually earned — and the
 *     question becomes the better one anyway: was this a sensible thing to buy,
 *     given what you believed at the time?
 *   - **The debrief.** "You opened on rider supply, moved to dispatch after the
 *     ETA pull, and committed to dispatch" is a more useful thing to read about
 *     yourself than any single cause id. Changing your mind on evidence is a
 *     skill, and it is invisible unless something writes it down.
 *
 * Stored in `SimRun.stateJson`, following `parseTurnaroundState` and the
 * buyback journal: a whole-blob rewrite, immutable appends, and a cursor
 * derived from the array rather than stored beside it. Nothing here touches the
 * database or throws — a corrupt blob degrades to an empty history, which
 * scores exactly as the old single-hypothesis behaviour did.
 */

import type { CauseId } from "./types";

export interface HypothesisRevision {
  /** The suspects named. Leaves only, already validated by `parseHypothesis`. */
  causeIds: CauseId[];
  /** Why, in the candidate's own words. Null when they left it blank. */
  note: string | null;
  /**
   * How many pulls had been bought when this belief was recorded.
   *
   * Lines up with `SimPurchase.seq`, which is 1-based: an entry with
   * `afterPurchases: 2` was the belief in force when purchase 3 was made.
   */
  afterPurchases: number;
  /** Analyst-days spent at the time, for the debrief's narrative. */
  afterDays: number;
  at: string;
}

export interface HypothesisLog {
  revisions: HypothesisRevision[];
}

const EMPTY: HypothesisLog = { revisions: [] };

export function parseHypothesisLog(json: string | null): HypothesisLog {
  if (!json) return EMPTY;
  try {
    const parsed = JSON.parse(json) as { hypothesisLog?: Partial<HypothesisLog> };
    const revisions = parsed?.hypothesisLog?.revisions;
    if (!Array.isArray(revisions)) return EMPTY;
    return {
      revisions: revisions.filter(
        (r): r is HypothesisRevision =>
          !!r && Array.isArray((r as HypothesisRevision).causeIds),
      ),
    };
  } catch {
    return EMPTY;
  }
}

/**
 * The log with one more belief on the end.
 *
 * Pure and immutable, like `appendEntry` in the buyback journal — the caller
 * serialises the result, so nothing here needs to know it is going to a
 * database.
 */
export function appendRevision(
  log: HypothesisLog,
  revision: HypothesisRevision,
): HypothesisLog {
  return { revisions: [...log.revisions, revision] };
}

/**
 * Serialised for `SimRun.stateJson`, merged into whatever else is stored there.
 *
 * Merged rather than replaced because `stateJson` is one column shared by every
 * format, and a war room that grows periods later will want its schedule beside
 * this rather than instead of it.
 */
export function withHypothesisLog(existing: string | null, log: HypothesisLog): string {
  let base: Record<string, unknown> = {};
  if (existing) {
    try {
      const parsed = JSON.parse(existing);
      if (parsed && typeof parsed === "object") base = parsed as Record<string, unknown>;
    } catch {
      // A blob we cannot read is a blob we cannot preserve. Starting fresh
      // loses a turnaround schedule that was already unreadable anyway, and is
      // better than refusing the write and stranding the run.
    }
  }
  return JSON.stringify({ ...base, hypothesisLog: log });
}

/**
 * What was believed when purchase `seq` was made.
 *
 * `seq` is 1-based, matching `SimPurchase.seq`, so the belief in force is the
 * last revision recorded at `afterPurchases < seq`.
 *
 * Falls back to `current` when the log is empty or has nothing early enough —
 * which is every run played before the log existed, and every run that never
 * revised. Those score exactly as they did before, which is the property that
 * makes this safe to add to a live table.
 */
export function hypothesisAtPurchase(
  log: HypothesisLog,
  seq: number,
  current: CauseId[],
): CauseId[] {
  let standing: CauseId[] | null = null;
  for (const revision of log.revisions) {
    if (revision.afterPurchases < seq) standing = revision.causeIds;
    else break;
  }
  return standing ?? current;
}

/** Did the candidate ever change their mind? Drives the debrief's trail. */
export function wasRevised(log: HypothesisLog): boolean {
  return log.revisions.length > 1;
}
