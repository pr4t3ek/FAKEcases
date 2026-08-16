import { describe, expect, it } from "vitest";
import { buildRoster, type RosterMember, type RosterRun } from "@/lib/rooms/roster";

const T0 = new Date("2026-08-16T09:00:00.000Z");
const at = (minutes: number) => new Date(T0.getTime() + minutes * 60_000);

function member(userId: string, minutes = 0, extra: Partial<RosterMember> = {}): RosterMember {
  return {
    userId,
    displayName: userId.toUpperCase(),
    joinedAt: at(minutes),
    email: null,
    ...extra,
  };
}

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

const finished = { overall: 72, band: "Strong", causeFound: true };

describe("buildRoster", () => {
  /**
   * The reason the roster is built from SEATS rather than from runs: "who is in
   * the room and hasn't started" is the most useful thing on this screen in the
   * first two minutes of a class, and a run-driven roster cannot show it at all.
   */
  it("gives a seat with no run a row of its own", () => {
    const { rows } = buildRoster([member("ana")], []);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      userId: "ana",
      state: "joined",
      runId: null,
      phase: null,
      daysSpent: null,
      overall: null,
    });
  });

  it("reports an in-progress run with its phase and analyst-days", () => {
    const { rows } = buildRoster(
      [member("ana")],
      [run("ana", { phase: "investigate", daysSpent: 6 })],
    );
    expect(rows[0]).toMatchObject({
      state: "playing",
      runId: "run-ana",
      phase: "investigate",
      daysSpent: 6,
      overall: null,
      band: null,
    });
  });

  it("reports a committed run with its score and band", () => {
    const { rows } = buildRoster(
      [member("ana")],
      [run("ana", { phase: "debrief", daysSpent: 9, result: finished })],
    );
    expect(rows[0]).toMatchObject({
      state: "finished",
      overall: 72,
      band: "Strong",
      causeFound: true,
      daysSpent: 9,
    });
  });

  /**
   * `result`, not `phase`, is the test for finished — the same rule `simSummary`
   * applies. A run that reached debrief without a result has no score to report,
   * and printing a 0 for it would be an invention.
   */
  it("treats a debrief with no result as still playing, not as a zero", () => {
    const { rows } = buildRoster([member("ana")], [run("ana", { phase: "debrief" })]);
    expect(rows[0].state).toBe("playing");
    expect(rows[0].overall).toBeNull();
  });

  /**
   * The same precedence `simStateFromRuns` states. Pinned in both places on
   * purpose: the two modules shape different rows from the same underlying
   * rule, and nothing but a test stops them drifting into disagreeing about
   * which run a student is actually in.
   */
  it("lets an unfinished run outrank a finished one for the same student", () => {
    const { rows } = buildRoster(
      [member("ana")],
      [
        run("ana", { id: "old", phase: "debrief", createdAt: at(1), result: finished }),
        run("ana", { id: "new", phase: "observe", createdAt: at(5) }),
      ],
    );
    expect(rows[0].state).toBe("playing");
    expect(rows[0].runId).toBe("new");
  });

  it("keeps the newest of two unfinished runs", () => {
    const { rows } = buildRoster(
      [member("ana")],
      [
        run("ana", { id: "older", phase: "observe", createdAt: at(1) }),
        run("ana", { id: "newer", phase: "commit", createdAt: at(8) }),
      ],
    );
    expect(rows[0].runId).toBe("newer");
  });

  it("ignores a run belonging to someone who is not in the room", () => {
    // Should not happen — the runs are queried by roomId — but the honest
    // failure is a roster that under-reports rather than one that invents a
    // student the professor never admitted.
    const { rows } = buildRoster([member("ana")], [run("bob"), run("ana")]);
    expect(rows).toHaveLength(1);
    expect(rows[0].userId).toBe("ana");
  });

  it("orders by when people walked in", () => {
    // Stable and meaningful. Sorting by score would reshuffle the table under
    // the professor's cursor on every five-second poll.
    const { rows } = buildRoster(
      [member("carl", 10), member("ana", 2), member("bea", 5)],
      [],
    );
    expect(rows.map((r) => r.userId)).toEqual(["ana", "bea", "carl"]);
  });

  it("keeps that order regardless of how far anyone has got", () => {
    const { rows } = buildRoster(
      [member("ana", 1), member("bea", 2)],
      [run("bea", { phase: "debrief", result: finished })],
    );
    expect(rows.map((r) => r.userId)).toEqual(["ana", "bea"]);
  });

  it("carries the display name and email through for telling two students apart", () => {
    const { rows } = buildRoster(
      [member("ana", 0, { displayName: "Ananya R", email: "a@example.com" })],
      [],
    );
    expect(rows[0].displayName).toBe("Ananya R");
    expect(rows[0].email).toBe("a@example.com");
  });

  it("serialises joinedAt, so the roster crosses the wire unchanged", () => {
    // The console renders this server-side AND from the polling route; a Date
    // would survive the first path and arrive as a string on the second.
    const { rows } = buildRoster([member("ana")], []);
    expect(typeof rows[0].joinedAt).toBe("string");
    expect(rows[0].joinedAt).toBe(T0.toISOString());
  });
});

describe("the roster summary", () => {
  it("counts each state", () => {
    const { summary } = buildRoster(
      [member("ana", 1), member("bea", 2), member("carl", 3)],
      [
        run("bea", { phase: "investigate" }),
        run("carl", { phase: "debrief", result: finished }),
      ],
    );
    expect(summary).toMatchObject({ joined: 1, playing: 1, finished: 1 });
  });

  it("averages the finished runs only", () => {
    const { summary } = buildRoster(
      [member("ana", 1), member("bea", 2), member("carl", 3)],
      [
        run("ana", { phase: "debrief", result: { ...finished, overall: 80 } }),
        run("bea", { phase: "debrief", result: { ...finished, overall: 60 } }),
        // Still playing — must not be counted as a zero and drag the mean down.
        run("carl", { phase: "investigate" }),
      ],
    );
    expect(summary.averageScore).toBe(70);
  });

  it("reports no average rather than a NaN for an empty room", () => {
    // The state this screen spends its first minutes in.
    const { summary } = buildRoster([], []);
    expect(summary.averageScore).toBeNull();
    expect(summary).toMatchObject({ joined: 0, playing: 0, finished: 0, causesFound: 0 });
  });

  it("reports no average when everyone has joined but nobody has committed", () => {
    const { summary } = buildRoster([member("ana")], [run("ana", { phase: "observe" })]);
    expect(summary.averageScore).toBeNull();
  });

  it("counts how many found the real cause", () => {
    const { summary } = buildRoster(
      [member("ana", 1), member("bea", 2)],
      [
        run("ana", { phase: "debrief", result: { ...finished, causeFound: true } }),
        run("bea", { phase: "debrief", result: { ...finished, causeFound: false } }),
      ],
    );
    expect(summary.causesFound).toBe(1);
    expect(summary.finished).toBe(2);
  });
});
