/**
 * What a professor has taught, across every room they have opened.
 *
 * The console answers "how is this class doing". This answers the question a
 * professor has between classes — which of these scenarios lands, and which one
 * the room walks out of having got wrong — and it is the only screen where two
 * sittings of the same war room can be compared at all.
 *
 * Pure and DB-free, like the rest of `lib/rooms/`; `loadHostAnalytics` in
 * `lib/rooms.ts` does the reads. The counts deliberately mirror the console's:
 * a student is a **seat**, not a run, so somebody who joined and never started
 * is taught and not finished — the same rule `buildRoster` applies, because a
 * professor comparing the two screens must not find two different class sizes.
 */

/** A room, as this summary needs it. */
export interface TaughtRoom {
  id: string;
  /** The catalogue row, so two sittings of one war room group together. */
  questionId: string;
  questionTitle: string;
  status: string;
  createdAt: Date;
}

/** A seat in one of those rooms. */
export interface TaughtSeat {
  roomId: string;
  userId: string;
}

/** A run played in one of those rooms. */
export interface TaughtRun {
  roomId: string;
  userId: string;
  result: { overall: number; causeFound: boolean; daysSpent: number; daysPar: number } | null;
}

export interface ScenarioTeaching {
  questionId: string;
  title: string;
  rooms: number;
  students: number;
  finished: number;
  /** Mean across finished runs, or null when none have finished. */
  averageScore: number | null;
  /** Finished runs that named the real cause. */
  causesFound: number;
  /** Finished runs at or under the authored budget. */
  underPar: number;
}

export interface HostSummary {
  rooms: number;
  roomsOpen: number;
  /** Distinct people across every room. Somebody in two rooms counts once. */
  students: number;
  /** Seats taken, which is what a professor counts when they say "I taught 40". */
  seats: number;
  started: number;
  finished: number;
  averageScore: number | null;
  causesFound: number;
  underPar: number;
  /** One row per war room they have run, busiest first. */
  scenarios: ScenarioTeaching[];
}

/**
 * Fold the rooms, seats and runs into one summary.
 *
 * **A run counts as finished when it carries a result**, matching `buildRoster`
 * — a run sitting on the debrief phase with nothing scored is not a result to
 * average. And a student is counted once per room they sat in for the
 * per-scenario rows, but once overall for `students`: forty people taught twice
 * are forty people, and a screen that said eighty would be flattering rather
 * than useful.
 */
export function hostSummary(
  rooms: TaughtRoom[],
  seats: TaughtSeat[],
  runs: TaughtRun[],
): HostSummary {
  const roomById = new Map(rooms.map((r) => [r.id, r]));
  const finishedRuns = runs.filter((r) => r.result !== null);
  const scores = finishedRuns.map((r) => r.result!.overall);

  const byQuestion = new Map<string, {
    title: string;
    rooms: Set<string>;
    students: Set<string>;
    finished: number;
    scoreTotal: number;
    causesFound: number;
    underPar: number;
  }>();

  const bucket = (questionId: string, title: string) => {
    const existing = byQuestion.get(questionId);
    if (existing) return existing;
    const fresh = {
      title,
      rooms: new Set<string>(),
      students: new Set<string>(),
      finished: 0,
      scoreTotal: 0,
      causesFound: 0,
      underPar: 0,
    };
    byQuestion.set(questionId, fresh);
    return fresh;
  };

  for (const room of rooms) bucket(room.questionId, room.questionTitle).rooms.add(room.id);

  for (const seat of seats) {
    const room = roomById.get(seat.roomId);
    if (!room) continue;
    bucket(room.questionId, room.questionTitle).students.add(seat.userId);
  }

  for (const run of runs) {
    const room = roomById.get(run.roomId);
    if (!room || !run.result) continue;
    const row = bucket(room.questionId, room.questionTitle);
    row.finished++;
    row.scoreTotal += run.result.overall;
    if (run.result.causeFound) row.causesFound++;
    if (run.result.daysSpent <= run.result.daysPar) row.underPar++;
  }

  const scenarios: ScenarioTeaching[] = [...byQuestion.entries()]
    .map(([questionId, row]) => ({
      questionId,
      title: row.title,
      rooms: row.rooms.size,
      students: row.students.size,
      finished: row.finished,
      averageScore: row.finished ? Math.round(row.scoreTotal / row.finished) : null,
      causesFound: row.causesFound,
      underPar: row.underPar,
    }))
    // Most taught first, then most recently useful — a professor scanning this
    // is looking for the room they ran last week, not for an alphabet.
    .sort((a, b) => b.students - a.students || b.rooms - a.rooms);

  return {
    rooms: rooms.length,
    roomsOpen: rooms.filter((r) => r.status === "open").length,
    students: new Set(seats.map((s) => s.userId)).size,
    seats: seats.length,
    // A student who opened the run, whether or not they got to the end.
    started: new Set(runs.map((r) => `${r.roomId}:${r.userId}`)).size,
    finished: finishedRuns.length,
    averageScore: scores.length
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : null,
    causesFound: finishedRuns.filter((r) => r.result!.causeFound).length,
    underPar: finishedRuns.filter((r) => r.result!.daysSpent <= r.result!.daysPar).length,
    scenarios,
  };
}
