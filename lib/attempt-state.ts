/**
 * What a library card should offer for a question the visitor has met before.
 *
 * The practice-side twin of `lib/sim/replay.ts`, and pure for the same reason:
 * `lib/questions.ts` reaches the database, so a rule left in there could not be
 * pulled into a test. The DB shell (`attemptStateByQuestion`) stays over there;
 * the rule lives here.
 *
 * The card looked identical on visit 1 and visit 40 — always "Practise this",
 * whether or not a half-built tree was sitting behind it. `startAttempt` has
 * always resumed an in-progress attempt rather than minting a second one, so the
 * behaviour was right and only the label was lying.
 */

/** Which of the three things a question card can offer. */
export type AttemptCardState = "none" | "in_progress" | "attempted";

export interface AttemptQuestionState {
  state: AttemptCardState;
  /** The attempt to open: the unfinished one if there is one, else the latest report. */
  attemptId: string | null;
  /** Best score across submitted attempts; null when none of them was scored. */
  bestOverall: number | null;
  /** How many attempts were submitted — what "again" is counting. */
  timesAttempted: number;
}

/** The shape this rule needs off an `Attempt` row. Deliberately not a Prisma type. */
export interface AttemptStateRow {
  id: string;
  questionId: string;
  status: string;
  /** Null when never submitted; `overall` null when the attempt wasn't scored. */
  evaluation: { overall: number | null } | null;
  createdAt: Date;
}

/**
 * Per-question attempt state, derived from the attempt rows.
 *
 * **An unfinished attempt outranks a submitted one**, which is not a preference
 * but a mirror of `startAttempt`: it resumes the newest `in_progress` row before
 * it considers creating anything. A card offering "Practise again" that the
 * action then answered by reopening a half-finished attempt would be worse than
 * a card offering nothing.
 *
 * Abandoned rows are neither. They are what `startAttempt` writes when someone
 * deliberately restarts a case in the other tree mode, so they are not resumable,
 * and they were never submitted, so there is nothing to go back and read.
 *
 * `bestOverall` skips an attempt with a null overall — one Teacher mode walked
 * through is not scored at all (see `lib/evaluation.ts`), and a badge is exactly
 * the sort of place a "0" would quietly reappear. A question attempted only that
 * way reads "Attempted" with no number, which is the truth.
 */
export function attemptStateFromRows(
  rows: AttemptStateRow[],
): Record<string, AttemptQuestionState> {
  const byQuestion: Record<string, AttemptQuestionState> = {};

  // Newest first, so the first unfinished attempt met is the one to resume —
  // the same `orderBy: { createdAt: "desc" }` that `startAttempt` uses.
  const ordered = [...rows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  for (const row of ordered) {
    const current: AttemptQuestionState = byQuestion[row.questionId] ?? {
      state: "none",
      attemptId: null,
      bestOverall: null,
      timesAttempted: 0,
    };

    if (row.status === "in_progress") {
      if (current.state !== "in_progress") {
        current.state = "in_progress";
        current.attemptId = row.id;
      }
    } else if (row.status === "submitted") {
      current.timesAttempted += 1;
      // Only claim the button if nothing unfinished already holds it.
      if (current.state === "none") {
        current.state = "attempted";
        current.attemptId = row.id;
      }
      if (row.evaluation?.overall != null) {
        current.bestOverall =
          current.bestOverall === null
            ? row.evaluation.overall
            : Math.max(current.bestOverall, row.evaluation.overall);
      }
    }

    byQuestion[row.questionId] = current;
  }

  return byQuestion;
}
