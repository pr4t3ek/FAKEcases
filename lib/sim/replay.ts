/**
 * What a library card should offer for a simulation the visitor has met before.
 *
 * Pure and DB-free, and in `lib/sim/` for the reason `lib/framework-payload.ts`
 * sits apart from the action that uses it: `lib/simulations.ts` reaches
 * `server-only` through `lib/scenario-store.ts`, so a rule left in there cannot
 * be pulled into a test. The DB shell (`simStateByQuestion`) stays over there;
 * the rule lives here.
 */

/** Which of the three things a simulation card can offer. */
export type SimCardState = "none" | "in_progress" | "played";

export interface SimQuestionState {
  state: SimCardState;
  /** The run to open: the unfinished one if there is one, else the latest debrief. */
  runId: string | null;
  /** Best score across finished runs — the card badge. */
  bestOverall: number | null;
}

/** The shape this rule needs off a `SimRun` row. Deliberately not a Prisma type. */
export interface SimRunRow {
  id: string;
  questionId: string;
  phase: string;
  result: { overall: number } | null;
  createdAt: Date;
}

/**
 * Per-question simulation state, derived from the run rows.
 *
 * **An unfinished run outranks a finished one.** A war room already under way
 * has spent analyst-days that "play again" would strand, so it wins the button
 * even when the same scenario has been completed before — which is also the rule
 * `findResumableRun` applies. A card offering something `startSimulation` would
 * then override is worse than a card offering nothing.
 *
 * The best score is collected independently of which run owns the button, so a
 * replay left half-finished never hides what the first run earned. Note this is
 * the *best* score, while the leaderboard pins the *first* — different numbers
 * on purpose, and the board is the one that ranks.
 */
export function simStateFromRuns(rows: SimRunRow[]): Record<string, SimQuestionState> {
  const byQuestion: Record<string, SimQuestionState> = {};

  // Newest first, so the first unfinished run met is the one to resume.
  const ordered = [...rows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  for (const row of ordered) {
    const current: SimQuestionState = byQuestion[row.questionId] ?? {
      state: "none",
      runId: null,
      bestOverall: null,
    };

    if (row.phase !== "debrief") {
      if (current.state !== "in_progress") {
        current.state = "in_progress";
        current.runId = row.id;
      }
    } else {
      // Only claim the button if nothing unfinished already holds it.
      if (current.state === "none") {
        current.state = "played";
        current.runId = row.id;
      }
      if (row.result) {
        current.bestOverall =
          current.bestOverall === null
            ? row.result.overall
            : Math.max(current.bestOverall, row.result.overall);
      }
    }

    byQuestion[row.questionId] = current;
  }

  return byQuestion;
}
