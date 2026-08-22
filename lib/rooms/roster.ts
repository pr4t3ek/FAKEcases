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
  /**
   * JSON `string[]` of the cause ids named at Decide, straight off `SimRun`.
   *
   * Parsed here rather than by the caller so both paths into the roster — the
   * server render and the five-second poll — read it the same way.
   */
  diagnosis?: string | null;
  /** Wall-clock seconds in the room. Display only, like everywhere else. */
  timeSpentSec?: number;
  result: {
    overall: number;
    band: string;
    causeFound: boolean;
    /** The scenario's authored analyst-day budget. */
    daysPar: number;
    /**
     * The five rubric dimensions, when the result carries them.
     *
     * Optional because a turnaround result writes zeros here and its real
     * scores in `scoresJson` — a class board that averaged those zeroes would
     * report a room full of failures. The class view drops a run with no
     * dimensions rather than counting it as one scoring nothing.
     */
    scores?: SimScores | null;
  } | null;
}

/** The five war-room dimensions, as `SimResult` stores them. */
export interface SimScores {
  hypothesis: number;
  investigation: number;
  diagnosis: number;
  decision: number;
  outcome: number;
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
  /** Per-dimension scores, for the class averages. Null until they commit. */
  scores: SimScores | null;
  /** Cause ids named at Decide. Empty until they commit — never null. */
  namedCauses: string[];
  /** Seconds in the room, or null for a seat that never started. */
  timeSpentSec: number | null;
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
          scores: null,
          namedCauses: [],
          timeSpentSec: null,
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
        scores: run.result?.scores ?? null,
        namedCauses: parseCauseIds(run.diagnosis),
        timeSpentSec: run.timeSpentSec ?? null,
      };
    });

  return { rows, summary: summarise(rows) };
}

/**
 * The cause ids off a run, defensively.
 *
 * `SimRun.diagnosis` is a JSON column written by the app, so it should always
 * be a `string[]` — but this module renders a live classroom screen every five
 * seconds, and a row that cannot be parsed must cost that student their entry in
 * one chart rather than the professor their console.
 */
function parseCauseIds(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
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

// ─── Class analytics ───────────────────────────────────────────────────────
//
// The same posture as the class board above: derived from rows the console is
// already polling, so a professor gets a live read of the room at no additional
// request. Everything here is pure, and nothing imports a scenario — the labels
// a chart needs are passed in by the page that resolved them.

/** One step of the run, and how much of the class is standing on it. */
export interface PhaseCount {
  /** `SimPhase`, or "joined" for a seat that never opened the run. */
  key: string;
  label: string;
  count: number;
}

const PHASE_LABELS: { key: string; label: string }[] = [
  { key: "joined", label: "Not started" },
  { key: "observe", label: "Observe" },
  { key: "investigate", label: "Investigate" },
  { key: "commit", label: "Decide" },
  { key: "debrief", label: "Debrief" },
];

/**
 * Where the class is standing, right now.
 *
 * The live-teaching question, and the one thing the roster table cannot answer
 * at a glance in a room of forty: a professor needs to know whether to keep
 * going or to stop and explain the pull market, and counting badges down a
 * scrolling table is not a way to find that out.
 *
 * Every phase is listed whether or not anybody is on it, for the same reason
 * `rankDistribution` lists empty bands — a bar that appears and disappears makes
 * two glances at the same screen incomparable.
 */
export function phaseFunnel(rows: RosterRow[]): PhaseCount[] {
  const counts = new Map<string, number>(PHASE_LABELS.map((p) => [p.key, 0]));
  for (const row of rows) {
    const key = row.state === "joined" ? "joined" : (row.phase ?? "observe");
    if (!counts.has(key)) continue; // a phase this build doesn't know about
    counts.set(key, counts.get(key)! + 1);
  }
  return PHASE_LABELS.map((p) => ({ ...p, count: counts.get(p.key)! }));
}

export interface DimensionAverage {
  key: keyof SimScores;
  label: string;
  average: number;
}

const DIMENSION_LABELS: { key: keyof SimScores; label: string }[] = [
  { key: "hypothesis", label: "Hypothesis" },
  { key: "investigation", label: "Investigation" },
  { key: "diagnosis", label: "Diagnosis" },
  { key: "decision", label: "Decision" },
  { key: "outcome", label: "Outcome" },
];

/**
 * What the class was good and bad at, dimension by dimension.
 *
 * The single most teachable number on this screen: an average of 74 tells a
 * professor nothing they can act on, while "they diagnosed it and then funded
 * the wrong thing" is a lecture. Empty until somebody commits, and runs with no
 * per-dimension scores are skipped rather than read as zeroes — see
 * `RosterRun.result.scores`.
 */
export function dimensionAverages(rows: RosterRow[]): DimensionAverage[] {
  const scored = rows.map((r) => r.scores).filter((s): s is SimScores => !!s);
  if (!scored.length) return [];
  return DIMENSION_LABELS.map(({ key, label }) => ({
    key,
    label,
    average: Math.round(scored.reduce((sum, s) => sum + s[key], 0) / scored.length),
  }));
}

/** How the finished runs fell across the result bands. */
export function bandSpread(rows: RosterRow[], bands: readonly string[]): PhaseCount[] {
  const counts = new Map<string, number>(bands.map((b) => [b, 0]));
  for (const row of rows) {
    if (row.band === null || !counts.has(row.band)) continue;
    counts.set(row.band, counts.get(row.band)! + 1);
  }
  return bands.map((band) => ({ key: band, label: band, count: counts.get(band)! }));
}

export interface SpendSpread {
  under: number;
  at: number;
  over: number;
  /** Mean analyst-days across finished runs, or null before any finish. */
  averageDays: number | null;
}

/**
 * How the class spent, against the budget the scenario authored.
 *
 * Three buckets rather than a histogram of every value: the lesson is whether a
 * room bought more than it needed, and a professor reading "nine went over" acts
 * on it. Which exact day each of them stopped at is on the scatter beside it.
 */
export function spendAgainstPar(rows: RosterRow[]): SpendSpread {
  const finished = rows.filter(
    (r) => r.state === "finished" && r.daysSpent !== null && r.daysPar !== null,
  );
  if (!finished.length) return { under: 0, at: 0, over: 0, averageDays: null };

  let under = 0;
  let at = 0;
  let over = 0;
  for (const row of finished) {
    if (row.daysSpent! < row.daysPar!) under++;
    else if (row.daysSpent! === row.daysPar!) at++;
    else over++;
  }
  const total = finished.reduce((sum, r) => sum + r.daysSpent!, 0);
  return { under, at, over, averageDays: Math.round((total / finished.length) * 10) / 10 };
}

export interface CauseCount {
  id: string;
  label: string;
  count: number;
  /** Whether this cause is one the scenario actually declares as true. */
  correct: boolean;
}

/**
 * What the class blamed, and how many of them were right.
 *
 * The debrief tells one student where their diagnosis went. This tells the
 * professor where the ROOM's went — and a decoy that pulled in half the class is
 * the thing worth ten minutes of the next lecture, not the average score.
 *
 * A student may name up to `simConfig.maxCausesNamed`, so the counts sum to more
 * than the number of students, and that is the honest reading: each bar is "how
 * many people had this on their list".
 *
 * Causes nobody named are dropped, unlike the fixed scales elsewhere in this
 * file — a board of twelve causes with two of them named is a chart about ten
 * empty bars. The true causes are kept whatever happened, because "nobody named
 * it" is the most important bar on the chart.
 */
export function causeMix(
  rows: RosterRow[],
  causes: { id: string; label: string }[],
  trueCauseIds: readonly string[],
): CauseCount[] {
  const truth = new Set(trueCauseIds);
  const counts = new Map<string, number>();
  for (const row of rows) {
    for (const id of row.namedCauses) counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  return causes
    .map((cause) => ({
      id: cause.id,
      label: cause.label,
      count: counts.get(cause.id) ?? 0,
      correct: truth.has(cause.id),
    }))
    .filter((cause) => cause.count > 0 || cause.correct)
    .sort((a, b) => b.count - a.count || Number(b.correct) - Number(a.correct));
}

/**
 * The median time a finished run took, in seconds, or null before any finish.
 *
 * Median rather than mean: one student who left the tab open over lunch moves a
 * mean by twenty minutes, and the number a professor wants is "how long does
 * this take a class", which is exactly what a median answers.
 */
export function medianRunTime(rows: RosterRow[]): number | null {
  const times = rows
    .filter((r) => r.state === "finished" && r.timeSpentSec !== null)
    .map((r) => r.timeSpentSec!)
    .sort((a, b) => a - b);
  if (!times.length) return null;
  const middle = Math.floor(times.length / 2);
  return times.length % 2 === 1
    ? times[middle]
    : Math.round((times[middle - 1] + times[middle]) / 2);
}
