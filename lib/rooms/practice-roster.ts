/**
 * What the host console shows for a room running a GUESSTIMATE: one row per
 * student, derived from the seats and the attempts worked against them.
 *
 * The practice-side twin of `lib/rooms/roster.ts`, pure and DB-free for the same
 * reasons — the console renders it twice, once server-side for the first paint
 * and once every five seconds from the poll, and a roster that shaped itself
 * differently on those two paths would flash a different table a moment after
 * loading.
 *
 * **Its own row type rather than a widened `RosterRow`.** Every column that
 * makes a war-room row worth reading — the phase, the analyst-days, whether the
 * true cause was named, the five rubric dimensions — has no counterpart here,
 * and a shared type would have carried eight nulls into one screen or the other.
 * What IS shared is the two rules below, deliberately restated rather than
 * loosely remembered: a professor comparing the two consoles must not find them
 * counting the same class differently.
 *
 * Note what is deliberately NOT read here, exactly as in `roster.ts`:
 * `LeaderboardEntry`. That table filters guests out at read time, which is right
 * for a public ranking and exactly wrong for a classroom, where most of the room
 * is guests by design.
 */

/** A seat, as this roster needs it. Identical to `RosterMember` by intent. */
export interface PracticeRosterMember {
  userId: string;
  displayName: string;
  joinedAt: Date;
  /** Null for a guest, which is most of a class. Shown to tell two names apart. */
  email: string | null;
}

/** An attempt worked in this room, as the roster needs it. */
export interface PracticeRosterAttempt {
  id: string;
  userId: string;
  /** "in_progress" | "submitted" | "abandoned" — see `model Attempt`. */
  status: string;
  createdAt: Date;
  /** The number they answered with. Null until they submit one. */
  finalEstimate: number | null;
  /** Wall-clock seconds on the question. */
  timeSpentSec: number;
  /**
   * Null until the attempt is scored — and null *afterwards* too for an attempt
   * that used Teacher mode, which states the answer and so leaves nothing to
   * measure. See the note on `Evaluation.overall`.
   */
  evaluation: { overall: number | null; accuracyHit: boolean } | null;
}

/** Where a student has got to. */
export type PracticeRosterState = "joined" | "working" | "submitted";

export interface PracticeRosterRow {
  userId: string;
  displayName: string;
  email: string | null;
  joinedAt: string;
  state: PracticeRosterState;
  /** The attempt to link to, or null for someone who has not started. */
  attemptId: string | null;
  /** What they answered, once they have. */
  finalEstimate: number | null;
  /**
   * Their score, or null — which means "not scored", never "scored zero". A
   * Teacher-mode attempt reaches this screen as a submitted row with no number,
   * because that is the truth about it.
   */
  overall: number | null;
  /** Whether the estimate landed inside the question's authored band. */
  accuracyHit: boolean | null;
  /** Seconds on the question, or null for a seat that never started. */
  timeSpentSec: number | null;
}

export interface PracticeRosterSummary {
  joined: number;
  working: number;
  submitted: number;
  /** Across scored attempts only. Null when none have been scored yet. */
  averageScore: number | null;
  /** Submitted attempts whose estimate landed in the band. */
  withinBand: number;
}

export interface PracticeRoster {
  rows: PracticeRosterRow[];
  summary: PracticeRosterSummary;
}

/**
 * Build the roster.
 *
 * **A seat with no attempt still gets a row** — the point of reading seats
 * rather than attempts, and the single most useful thing on this screen in the
 * first two minutes of a class.
 *
 * **An unfinished attempt outranks a submitted one**, and among unfinished ones
 * the newest wins. The same rule `buildRoster` and `attemptStateFromRows` apply,
 * and pinned by a test in each place so the three cannot drift into disagreeing
 * about which attempt a student is actually in.
 *
 * `abandoned` rows are neither: they are what `startAttempt` writes when someone
 * restarts a case in the other tree mode, so they are not resumable and were
 * never submitted. A student whose only row is abandoned reads as `joined`,
 * which is what they are.
 *
 * An attempt whose `userId` is not a seat in this room is ignored rather than
 * shown — the honest failure is a roster that under-reports rather than one that
 * invents a student the professor never admitted.
 */
export function buildPracticeRoster(
  members: PracticeRosterMember[],
  attempts: PracticeRosterAttempt[],
): PracticeRoster {
  const seats = new Set(members.map((m) => m.userId));

  // Newest first, so the first unfinished attempt met for a student is the one
  // to report — matching `attemptStateFromRows`.
  const ordered = [...attempts]
    .filter((a) => seats.has(a.userId) && a.status !== "abandoned")
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const bestFor = new Map<string, PracticeRosterAttempt>();
  for (const attempt of ordered) {
    const current = bestFor.get(attempt.userId);
    if (!current) {
      bestFor.set(attempt.userId, attempt);
      continue;
    }
    // Only an unfinished attempt displaces something already claimed, and only
    // when what it displaces is submitted. Two unfinished ones keep the newer,
    // which `ordered` already put first.
    if (current.status === "submitted" && attempt.status === "in_progress") {
      bestFor.set(attempt.userId, attempt);
    }
  }

  const rows = [...members]
    // Stable and meaningful: the order people walked in. A score sort would
    // reshuffle the table under the professor's cursor on every poll.
    .sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime())
    .map((member): PracticeRosterRow => {
      const attempt = bestFor.get(member.userId);
      if (!attempt) {
        return {
          userId: member.userId,
          displayName: member.displayName,
          email: member.email,
          joinedAt: member.joinedAt.toISOString(),
          state: "joined",
          attemptId: null,
          finalEstimate: null,
          overall: null,
          accuracyHit: null,
          timeSpentSec: null,
        };
      }

      // `status` is the test for finished here, not the presence of a result —
      // unlike `buildRoster`, whose war rooms can reach debrief unscored. A
      // submitted attempt is submitted whether or not the evaluator got to it,
      // and reporting it as still working would have the professor waiting on a
      // student who is done.
      const submitted = attempt.status === "submitted";
      return {
        userId: member.userId,
        displayName: member.displayName,
        email: member.email,
        joinedAt: member.joinedAt.toISOString(),
        state: submitted ? "submitted" : "working",
        attemptId: attempt.id,
        finalEstimate: submitted ? attempt.finalEstimate : null,
        overall: attempt.evaluation?.overall ?? null,
        accuracyHit: attempt.evaluation?.accuracyHit ?? null,
        timeSpentSec: attempt.timeSpentSec,
      };
    });

  return { rows, summary: summarise(rows) };
}

function summarise(rows: PracticeRosterRow[]): PracticeRosterSummary {
  const submitted = rows.filter((r) => r.state === "submitted");
  // Scored ones only. An unscored attempt averaged as a zero would report a
  // class that did worse than it did, which is the same argument
  // `attemptStateFromRows` makes about the best-score badge.
  const scores = submitted
    .map((r) => r.overall)
    .filter((score): score is number => score !== null);

  return {
    joined: rows.filter((r) => r.state === "joined").length,
    working: rows.filter((r) => r.state === "working").length,
    submitted: submitted.length,
    // Guarded rather than assumed: an empty room is the state this screen spends
    // its first minutes in, and NaN is not a thing to show a professor.
    averageScore: scores.length
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : null,
    withinBand: submitted.filter((r) => r.accuracyHit).length,
  };
}
