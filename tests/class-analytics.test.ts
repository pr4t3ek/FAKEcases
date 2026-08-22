import { describe, expect, it } from "vitest";
import {
  bandSpread,
  buildRoster,
  causeMix,
  dimensionAverages,
  medianRunTime,
  phaseFunnel,
  spendAgainstPar,
  type RosterMember,
  type RosterRow,
  type RosterRun,
} from "@/lib/rooms/roster";
import { hostSummary, type TaughtRoom, type TaughtRun, type TaughtSeat } from "@/lib/rooms/teaching";
import { simBands } from "@/lib/config/simulation";

/**
 * The class view's arithmetic.
 *
 * Everything here renders on a screen a professor reads out to a room, and half
 * of it is derived from rows that arrive every five seconds — so the shaping is
 * pinned rather than eyeballed. `room-roster.test.ts` next door pins the roster
 * these read from.
 */

const T0 = new Date("2026-08-16T09:00:00.000Z");
const at = (minutes: number) => new Date(T0.getTime() + minutes * 60_000);

const member = (userId: string, minutes = 0): RosterMember => ({
  userId,
  displayName: userId.toUpperCase(),
  joinedAt: at(minutes),
  email: null,
});

const scores = { hypothesis: 60, investigation: 70, diagnosis: 80, decision: 40, outcome: 50 };

function run(userId: string, over: Partial<RosterRun> = {}): RosterRun {
  return {
    id: `run-${userId}`,
    userId,
    phase: "observe",
    daysSpent: 0,
    createdAt: at(1),
    result: null,
    ...over,
  };
}

function finished(userId: string, over: Partial<RosterRun> = {}): RosterRun {
  return run(userId, {
    phase: "debrief",
    daysSpent: 6,
    timeSpentSec: 900,
    result: { overall: 72, band: "Strong", causeFound: true, daysPar: 8, scores },
    ...over,
  });
}

/** Rows the way the console has them, so the helpers meet real shapes. */
const rowsFor = (members: RosterMember[], runs: RosterRun[]): RosterRow[] =>
  buildRoster(members, runs).rows;

describe("phaseFunnel", () => {
  it("counts every phase, including the ones nobody is on", () => {
    const rows = rowsFor(
      [member("ana"), member("bea", 1), member("carl", 2)],
      [run("bea", { phase: "investigate" }), finished("carl")],
    );
    expect(phaseFunnel(rows)).toEqual([
      { key: "joined", label: "Not started", count: 1 },
      { key: "observe", label: "Observe", count: 0 },
      { key: "investigate", label: "Investigate", count: 1 },
      { key: "commit", label: "Decide", count: 0 },
      { key: "debrief", label: "Debrief", count: 1 },
    ]);
  });

  it("counts a seat with no run as not started rather than as observing", () => {
    const rows = rowsFor([member("ana")], []);
    const funnel = phaseFunnel(rows);
    expect(funnel.find((p) => p.key === "joined")!.count).toBe(1);
    expect(funnel.find((p) => p.key === "observe")!.count).toBe(0);
  });
});

describe("dimensionAverages", () => {
  it("averages the five dimensions across finished runs", () => {
    const rows = rowsFor(
      [member("ana"), member("bea", 1)],
      [
        finished("ana"),
        finished("bea", {
          result: {
            overall: 40,
            band: "Reactive",
            causeFound: false,
            daysPar: 8,
            scores: { ...scores, decision: 20, diagnosis: 40 },
          },
        }),
      ],
    );
    const averages = dimensionAverages(rows);
    expect(averages.find((d) => d.key === "decision")!.average).toBe(30);
    expect(averages.find((d) => d.key === "diagnosis")!.average).toBe(60);
  });

  // A turnaround result stores zeros in the war room's columns, so counting it
  // would report a class that scored nothing on every dimension.
  it("skips a result that carries no dimensions rather than reading it as zero", () => {
    const rows = rowsFor(
      [member("ana"), member("bea", 1)],
      [
        finished("ana"),
        finished("bea", {
          result: { overall: 50, band: "Developing", causeFound: false, daysPar: 8, scores: null },
        }),
      ],
    );
    expect(dimensionAverages(rows).find((d) => d.key === "decision")!.average).toBe(40);
  });

  it("is empty before anybody commits", () => {
    expect(dimensionAverages(rowsFor([member("ana")], [run("ana")]))).toEqual([]);
  });
});

describe("bandSpread", () => {
  it("lists every band in the ladder, occupied or not", () => {
    const rows = rowsFor([member("ana")], [finished("ana")]);
    const spread = bandSpread(rows, simBands.map((b) => b.band));
    expect(spread).toHaveLength(simBands.length);
    expect(spread.find((b) => b.label === "Strong")!.count).toBe(1);
    expect(spread.find((b) => b.label === "Reactive")!.count).toBe(0);
  });
});

describe("spendAgainstPar", () => {
  it("splits under, at and over, and averages the spend", () => {
    const rows = rowsFor(
      [member("ana"), member("bea", 1), member("carl", 2)],
      [
        finished("ana", { daysSpent: 6 }),
        finished("bea", { daysSpent: 8 }),
        finished("carl", { daysSpent: 10 }),
      ],
    );
    expect(spendAgainstPar(rows)).toEqual({ under: 1, at: 1, over: 1, averageDays: 8 });
  });

  it("reports nothing rather than zero before anyone finishes", () => {
    const rows = rowsFor([member("ana")], [run("ana", { daysSpent: 4 })]);
    expect(spendAgainstPar(rows).averageDays).toBeNull();
  });
});

describe("causeMix", () => {
  const causes = [
    { id: "c1", label: "Creative fatigue" },
    { id: "c2", label: "Audience too broad" },
    { id: "c3", label: "Delivery cost" },
  ];

  it("counts every naming, and marks the one that was right", () => {
    const rows = rowsFor(
      [member("ana"), member("bea", 1)],
      [
        finished("ana", { diagnosis: JSON.stringify(["c2"]) }),
        finished("bea", { diagnosis: JSON.stringify(["c2", "c1"]) }),
      ],
    );
    const mix = causeMix(rows, causes, ["c1"]);
    expect(mix[0]).toEqual({ id: "c2", label: "Audience too broad", count: 2, correct: false });
    expect(mix.find((c) => c.id === "c1")).toEqual({
      id: "c1",
      label: "Creative fatigue",
      count: 1,
      correct: true,
    });
  });

  // "Nobody named it" is the most important bar on the chart, so the true cause
  // stays even at zero — while an unnamed decoy is just an empty row.
  it("keeps the true cause when nobody named it, and drops unnamed decoys", () => {
    const rows = rowsFor([member("ana")], [finished("ana", { diagnosis: JSON.stringify(["c2"]) })]);
    const mix = causeMix(rows, causes, ["c1"]);
    expect(mix.map((c) => c.id).sort()).toEqual(["c1", "c2"]);
    expect(mix.find((c) => c.id === "c1")!.count).toBe(0);
  });

  it("survives a diagnosis column it cannot parse", () => {
    const rows = rowsFor([member("ana")], [finished("ana", { diagnosis: "not json" })]);
    expect(causeMix(rows, causes, ["c1"]).every((c) => c.count === 0)).toBe(true);
  });
});

describe("medianRunTime", () => {
  it("takes the middle, so one abandoned tab does not move it", () => {
    const rows = rowsFor(
      [member("ana"), member("bea", 1), member("carl", 2)],
      [
        finished("ana", { timeSpentSec: 600 }),
        finished("bea", { timeSpentSec: 900 }),
        finished("carl", { timeSpentSec: 20_000 }),
      ],
    );
    expect(medianRunTime(rows)).toBe(900);
  });

  it("is null before anybody finishes", () => {
    expect(medianRunTime(rowsFor([member("ana")], [run("ana")]))).toBeNull();
  });
});

describe("hostSummary", () => {
  const room = (id: string, questionId: string, over: Partial<TaughtRoom> = {}): TaughtRoom => ({
    id,
    questionId,
    questionTitle: `Question ${questionId}`,
    status: "open",
    createdAt: T0,
    ...over,
  });
  const seat = (roomId: string, userId: string): TaughtSeat => ({ roomId, userId });
  const played = (roomId: string, userId: string, over: Partial<TaughtRun> = {}): TaughtRun => ({
    roomId,
    userId,
    result: { overall: 70, causeFound: true, daysSpent: 6, daysPar: 8 },
    ...over,
  });

  it("counts a student taught twice as one person", () => {
    const summary = hostSummary(
      [room("r1", "q1"), room("r2", "q1", { status: "closed" })],
      [seat("r1", "ana"), seat("r2", "ana"), seat("r2", "bea")],
      [],
    );
    expect(summary.students).toBe(2);
    expect(summary.seats).toBe(3);
    expect(summary.rooms).toBe(2);
    expect(summary.roomsOpen).toBe(1);
  });

  it("groups two sittings of the same war room into one row", () => {
    const summary = hostSummary(
      [room("r1", "q1"), room("r2", "q1"), room("r3", "q2")],
      [seat("r1", "ana"), seat("r2", "bea"), seat("r3", "carl")],
      [played("r1", "ana"), played("r2", "bea", { result: null })],
    );
    expect(summary.scenarios).toHaveLength(2);
    const first = summary.scenarios.find((s) => s.questionId === "q1")!;
    expect(first).toMatchObject({ rooms: 2, students: 2, finished: 1, averageScore: 70 });
  });

  it("averages only what finished, and rates the rest against it", () => {
    const summary = hostSummary(
      [room("r1", "q1")],
      [seat("r1", "ana"), seat("r1", "bea"), seat("r1", "carl")],
      [
        played("r1", "ana"),
        played("r1", "bea", {
          result: { overall: 30, causeFound: false, daysSpent: 12, daysPar: 8 },
        }),
        played("r1", "carl", { result: null }),
      ],
    );
    expect(summary.started).toBe(3);
    expect(summary.finished).toBe(2);
    expect(summary.averageScore).toBe(50);
    expect(summary.causesFound).toBe(1);
    expect(summary.underPar).toBe(1);
  });

  it("reports no average rather than zero for a room nobody finished", () => {
    const summary = hostSummary([room("r1", "q1")], [seat("r1", "ana")], []);
    expect(summary.averageScore).toBeNull();
    expect(summary.scenarios[0].averageScore).toBeNull();
  });
});
