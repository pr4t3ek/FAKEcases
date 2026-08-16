/**
 * What the host console shows: one row per student, derived from the seats and
 * the runs played against them.
 *
 * Pure and DB-free, and modelled on `lib/sim/replay.ts` down to the "not a
 * Prisma type" input interfaces. The reason is the same one that module gives,
 * plus one more that is specific to this feature: **the console renders this
 * twice** — once server-side for the first paint and once every five seconds
 * from the polling route — and a roster that shaped itself differently on those
 * two paths would flash a different table a moment after loading.
 *
 * Note what is deliberately NOT read here: `LeaderboardEntry`. That table
 * filters guests out at read time, which is right for a public ranking and
 * exactly wrong for a classroom, where most of the room *is* guests. The roster
 * reads runs directly so every student who joined appears.
 */

import type { SimPhase } from "@/lib/types";

/** A seat, as the roster needs it. */
export interface RosterMember {
  userId: string;
  displayName: string;
  joinedAt: Date;
  /** Null for a guest, which is most of a class. Shown to tell two names apart. */
  email: string | null;
}

/** A run in this room, as the roster needs it. */
export interface RosterRun {
  id: string;
  userId: string;
  phase: string;
  daysSpent: number;
  createdAt: Date;
  result: {
    overall: number;
    band: string;
    causeFound: boolean;
    /** The scenario's authored analyst-day budget. */
    daysPar: number;
  } | null;
}

/** Where a student has got to. */
export type RosterState = "joined" | "playing" | "finished";

export interface RosterRow {
  userId: string;
  displayName: string;
  email: string | null;
  joinedAt: string;
  state: RosterState;
  /** The run to link to, or null for someone who has not started. */
  runId: string | null;
  /** Null until they start. */
  phase: SimPhase | string | null;
  daysSpent: number | null;
  /** Null until they commit. */
  overall: number | null;
  band: string | null;
  causeFound: boolean | null;
  /** The scenario's par, known only once a run has been scored against it. */
  daysPar: number | null;
}

export interface RosterSummary {
  joined: number;
  playing: number;
  finished: number;
  /** Across finished runs only. Null when nobody has committed yet. */
  averageScore: number | null;
  /** How many of the finished runs found the real cause. */
  causesFound: number;
  /** How many came in at or under the scenario's authored par. */
  underPar: number;
}

export interface Roster {
  rows: RosterRow[];
  summary: RosterSummary;
}

/**
 * Build the roster.
 *
 * **A seat with no run still gets a row.** That is the point of reading seats
 * rather than runs: "who is in the room but hasn't started" is the single most
 * useful thing on this screen in the first two minutes of a class, and a
 * run-driven roster cannot show it.
 *
 * **An unfinished run outranks a finished one**, and among unfinished ones the
 * newest wins. That is the same rule `simStateFromRuns` applies, stated here
 * rather than imported because the shapes differ — and pinned by a test in both
 * places, so the two cannot drift into disagreeing about which run a student is
 * actually in.
 *
 * A run whose `userId` is not a seat in this room is ignored rather than shown.
 * It should not happen, but the honest failure is a roster that under-reports
 * rather than one that invents a student the professor never admitted.
 */
export function buildRoster(members: RosterMember[], runs: RosterRun[]): Roster {
  const seats = new Set(members.map((m) => m.userId));

  // Newest first, so the first unfinished run met for a student is the one to
  // report — matching `simStateFromRuns`.
  const ordered = [...runs]
    .filter((r) => seats.has(r.userId))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const bestFor = new Map<string, RosterRun>();
  for (const run of ordered) {
    const current = bestFor.get(run.userId);
    if (!current) {
      bestFor.set(run.userId, run);
      continue;
    }
    // Only an unfinished run displaces something already claimed, and only when
    // what it displaces is finished. Two unfinished runs keep the newer, which
    // `ordered` already put first.
    const currentDone = current.phase === "debrief";
    const runDone = run.phase === "debrief";
    if (currentDone && !runDone) bestFor.set(run.userId, run);
  }

  const rows = [...members]
    // Stable and meaningful: the order people walked in. A score sort would
    // reshuffle the table under the professor's cursor on every poll.
    .sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime())
    .map((member): RosterRow => {
      const run = bestFor.get(member.userId);
      if (!run) {
        return {
          userId: member.userId,
          displayName: member.displayName,
          email: member.email,
          joinedAt: member.joinedAt.toISOString(),
          state: "joined",
          runId: null,
          phase: null,
          daysSpent: null,
          overall: null,
          band: null,
          causeFound: null,
          daysPar: null,
        };
      }

      // `result` rather than `phase` is the test for finished, matching
      // `simSummary`: a run that reached debrief without a result is not
      // something to report a score for.
      const finished = run.result !== null;
      return {
        userId: member.userId,
        displayName: member.displayName,
        email: member.email,
        joinedAt: member.joinedAt.toISOString(),
        state: finished ? "finished" : "playing",
        runId: run.id,
        phase: run.phase,
        daysSpent: run.daysSpent,
        overall: run.result?.overall ?? null,
        band: run.result?.band ?? null,
        causeFound: run.result?.causeFound ?? null,
        daysPar: run.result?.daysPar ?? null,
      };
    });

  return { rows, summary: summarise(rows) };
}

function summarise(rows: RosterRow[]): RosterSummary {
  const finished = rows.filter((r) => r.state === "finished");
  const scores = finished.map((r) => r.overall ?? 0);

  return {
    joined: rows.filter((r) => r.state === "joined").length,
    playing: rows.filter((r) => r.state === "playing").length,
    finished: finished.length,
    // Guarded rather than assumed: an empty room is the state this screen
    // spends its first minutes in, and NaN is not a thing to show a professor.
    averageScore: scores.length
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : null,
    causesFound: finished.filter((r) => r.causeFound).length,
    underPar: finished.filter(
      (r) => r.daysPar !== null && r.daysSpent !== null && r.daysSpent <= r.daysPar,
    ).length,
  };
}

// ─── The class board ───────────────────────────────────────────────────────
//
// Derived from the rows above rather than queried, which is the whole point:
// the console already polls the roster every five seconds, so the standings are
// live at no additional cost. A second endpoint for numbers already on screen
// would double the request rate to say the same thing.

export interface StandingRow extends RosterRow {
  /** 1-based. Dense, so a tie shares a rank and the next result takes the next. */
  rank: number;
}

/** Only a finished run has both a score and a settled spend. */
function isFinished(row: RosterRow): boolean {
  return row.state === "finished" && row.overall !== null && row.daysSpent !== null;
}

/**
 * The class board.
 *
 * **Score descending, then analyst-days ASCENDING**, then who got there first.
 * Deliberately the same ordering `LeaderboardEntry` uses, whose `effort` column
 * documents that lower is always better — a war room is judged on how cheaply it
 * was investigated, not on how long the tab was open. Stated here, and pinned by
 * a test, so a class board and the public board cannot drift into ranking the
 * same two results differently.
 *
 * Reads roster rows rather than `LeaderboardEntry`, for the same reason
 * `buildRoster` does: that table filters guests out at read time, which is right
 * for a public ranking and exactly wrong for a class that is mostly guests by
 * design.
 *
 * **Dense ranking.** Two students who scored the same and spent the same are
 * genuinely tied, and inventing an order between them would put one above the
 * other on a screen their professor reads out.
 */
export function classStandings(rows: RosterRow[]): StandingRow[] {
  const ranked = rows.filter(isFinished).sort((a, b) => {
    if (a.overall !== b.overall) return b.overall! - a.overall!;
    if (a.daysSpent !== b.daysSpent) return a.daysSpent! - b.daysSpent!;
    return a.joinedAt.localeCompare(b.joinedAt);
  });

  let rank = 0;
  let previous: { overall: number; daysSpent: number } | null = null;

  return ranked.map((row, index) => {
    // A new rank only when this result differs from the one above it, so ties
    // share and the next distinct result takes the position it actually holds.
    if (
      !previous ||
      previous.overall !== row.overall ||
      previous.daysSpent !== row.daysSpent
    ) {
      rank = index + 1;
      previous = { overall: row.overall!, daysSpent: row.daysSpent! };
    }
    return { ...row, rank };
  });
}

/** One dot on the cost-vs-score chart. */
export interface CostScorePoint {
  userId: string;
  displayName: string;
  daysSpent: number;
  overall: number;
  causeFound: boolean;
}

/**
 * The scatter's data.
 *
 * Finished runs only — a point needs both axes, and plotting an in-progress run
 * at its current spend would put a student on the chart at a score they have not
 * earned yet.
 */
export function costScorePoints(rows: RosterRow[]): CostScorePoint[] {
  return rows.filter(isFinished).map((row) => ({
    userId: row.userId,
    displayName: row.displayName,
    daysSpent: row.daysSpent!,
    overall: row.overall!,
    causeFound: row.causeFound ?? false,
  }));
}

/**
 * Where to draw the budget line, or null before anyone has finished.
 *
 * Every run in a room is the same scenario, so every result carries the same
 * par — the first one is the answer. Read off a result rather than passed in,
 * because the scenario content lives in `lib/sim/` and this module is pure.
 */
export function classDaysPar(rows: RosterRow[]): number | null {
  return rows.find((r) => r.daysPar !== null)?.daysPar ?? null;
}
