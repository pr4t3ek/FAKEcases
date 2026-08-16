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
  result: { overall: number; band: string; causeFound: boolean } | null;
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
}

export interface RosterSummary {
  joined: number;
  playing: number;
  finished: number;
  /** Across finished runs only. Null when nobody has committed yet. */
  averageScore: number | null;
  /** How many of the finished runs found the real cause. */
  causesFound: number;
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
  };
}
