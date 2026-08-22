import { describe, expect, it } from "vitest";
import {
  buildPracticeRoster,
  type PracticeRosterAttempt,
  type PracticeRosterMember,
} from "@/lib/rooms/practice-roster";
import { HOSTABLE_TYPES, isHostableType, roomKindFor } from "@/lib/types";

const T0 = new Date("2026-08-16T09:00:00.000Z");
const at = (minutes: number) => new Date(T0.getTime() + minutes * 60_000);

function member(
  userId: string,
  minutes = 0,
  extra: Partial<PracticeRosterMember> = {},
): PracticeRosterMember {
  return {
    userId,
    displayName: userId.toUpperCase(),
    joinedAt: at(minutes),
    email: null,
    ...extra,
  };
}

function attempt(
  userId: string,
  over: Partial<PracticeRosterAttempt> = {},
): PracticeRosterAttempt {
  return {
    id: `attempt-${userId}`,
    userId,
    status: "in_progress",
    createdAt: at(1),
    finalEstimate: null,
    timeSpentSec: 0,
    evaluation: null,
    ...over,
  };
}

/** A submitted, scored attempt in one line. */
function submitted(
  userId: string,
  overall: number | null,
  over: Partial<PracticeRosterAttempt> = {},
) {
  return attempt(userId, {
    status: "submitted",
    finalEstimate: 1_00_000,
    timeSpentSec: 900,
    evaluation: overall === null ? { overall: null, accuracyHit: false } : { overall, accuracyHit: true },
    ...over,
  });
}

describe("buildPracticeRoster", () => {
  /**
   * The rule `buildRoster` states for war rooms, restated here because it is the
   * reason this roster reads seats rather than attempts: "who is in the room and
   * hasn't started" is the most useful thing on the screen in the first two
   * minutes of a class.
   */
  it("gives a seat with no attempt a row of its own", () => {
    const { rows } = buildPracticeRoster([member("ana")], []);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      userId: "ana",
      state: "joined",
      attemptId: null,
      finalEstimate: null,
      overall: null,
      timeSpentSec: null,
    });
  });

  it("reports someone with an unfinished attempt as working", () => {
    const { rows } = buildPracticeRoster([member("ana")], [attempt("ana", { timeSpentSec: 120 })]);
    expect(rows[0]).toMatchObject({
      state: "working",
      attemptId: "attempt-ana",
      timeSpentSec: 120,
      // Not shown until it is submitted: a number typed into the box mid-answer
      // is not an answer, and putting it on the professor's screen would report
      // a student as having said something they have not said.
      finalEstimate: null,
    });
  });

  it("reports a submitted attempt with its estimate and score", () => {
    const { rows } = buildPracticeRoster([member("ana")], [submitted("ana", 74)]);
    expect(rows[0]).toMatchObject({
      state: "submitted",
      overall: 74,
      accuracyHit: true,
      finalEstimate: 1_00_000,
    });
  });

  /**
   * The same precedence `buildRoster` and `attemptStateFromRows` apply, pinned in
   * all three places so they cannot drift into disagreeing about which attempt a
   * student is actually in.
   */
  it("prefers an unfinished attempt over a submitted one", () => {
    const { rows } = buildPracticeRoster(
      [member("ana")],
      [submitted("ana", 74, { id: "old", createdAt: at(1) }), attempt("ana", { id: "new", createdAt: at(5) })],
    );
    expect(rows[0]).toMatchObject({ state: "working", attemptId: "new" });
  });

  it("prefers the unfinished attempt even when the submitted one is newer", () => {
    const { rows } = buildPracticeRoster(
      [member("ana")],
      [attempt("ana", { id: "open", createdAt: at(1) }), submitted("ana", 74, { id: "done", createdAt: at(9) })],
    );
    expect(rows[0]).toMatchObject({ state: "working", attemptId: "open" });
  });

  it("keeps the newest of two unfinished attempts", () => {
    const { rows } = buildPracticeRoster(
      [member("ana")],
      [attempt("ana", { id: "first", createdAt: at(1) }), attempt("ana", { id: "second", createdAt: at(4) })],
    );
    expect(rows[0].attemptId).toBe("second");
  });

  /**
   * Abandoned rows are what `startAttempt` writes when someone restarts in the
   * other tree mode. They are not resumable and were never submitted, so a
   * student whose only row is abandoned has not started.
   */
  it("ignores abandoned attempts", () => {
    const { rows, summary } = buildPracticeRoster(
      [member("ana")],
      [attempt("ana", { status: "abandoned" })],
    );
    expect(rows[0]).toMatchObject({ state: "joined", attemptId: null });
    expect(summary.joined).toBe(1);
  });

  it("ignores an attempt from someone who holds no seat", () => {
    // Should not happen; the honest failure is a roster that under-reports
    // rather than one that invents a student the professor never admitted.
    const { rows } = buildPracticeRoster([member("ana")], [submitted("zoe", 80)]);
    expect(rows).toHaveLength(1);
    expect(rows[0].userId).toBe("ana");
  });

  it("orders rows by the time people walked in", () => {
    const { rows } = buildPracticeRoster(
      [member("zoe", 5), member("ana", 1), member("raj", 3)],
      [submitted("zoe", 90)],
    );
    // Not by score: a table that re-sorted itself every five seconds would move
    // under the professor's cursor.
    expect(rows.map((r) => r.userId)).toEqual(["ana", "raj", "zoe"]);
  });
});

describe("the practice roster summary", () => {
  it("counts each state", () => {
    const { summary } = buildPracticeRoster(
      [member("ana", 1), member("raj", 2), member("zoe", 3)],
      [attempt("raj"), submitted("zoe", 80)],
    );
    expect(summary).toMatchObject({ joined: 1, working: 1, submitted: 1 });
  });

  it("has no average before anyone has been scored", () => {
    // The state this screen spends its first minutes in. NaN is not a thing to
    // show a professor.
    const { summary } = buildPracticeRoster([member("ana")], [attempt("ana")]);
    expect(summary.averageScore).toBeNull();
  });

  it("averages the scored attempts and rounds", () => {
    const { summary } = buildPracticeRoster(
      [member("ana", 1), member("raj", 2)],
      [submitted("ana", 71), submitted("raj", 74)],
    );
    expect(summary.averageScore).toBe(73);
  });

  /**
   * A Teacher-mode attempt is not scored at all — see the note on
   * `Evaluation.overall`. Averaging its null as a zero would report a class that
   * did worse than it did.
   */
  it("counts an unscored attempt as submitted but leaves it out of the average", () => {
    const { summary } = buildPracticeRoster(
      [member("ana", 1), member("raj", 2)],
      [submitted("ana", 80), submitted("raj", null)],
    );
    expect(summary.submitted).toBe(2);
    expect(summary.averageScore).toBe(80);
  });

  it("counts the estimates that landed inside the band", () => {
    const { summary } = buildPracticeRoster(
      [member("ana", 1), member("raj", 2)],
      [
        submitted("ana", 80),
        submitted("raj", 60, { evaluation: { overall: 60, accuracyHit: false } }),
      ],
    );
    expect(summary.withinBand).toBe(1);
  });
});

describe("what a room can be opened on", () => {
  it("accepts a war room and a guesstimate", () => {
    expect(isHostableType("simulation")).toBe(true);
    expect(isHostableType("guesstimate")).toBe(true);
  });

  /**
   * An allow-list, not "anything that isn't a case". `qualitative` is refused
   * deliberately — nothing about the room mechanics objects to one, but the host
   * console has no shape for it yet, and a room a professor cannot watch is
   * worse than one they cannot open.
   */
  it("refuses everything else, including the types with no runtime", () => {
    expect(isHostableType("qualitative")).toBe(false);
    expect(isHostableType("case")).toBe(false);
    expect(isHostableType("")).toBe(false);
    expect(HOSTABLE_TYPES).toHaveLength(2);
  });

  it("sends a war room to the run console and everything else to the practice one", () => {
    expect(roomKindFor("simulation")).toBe("simulation");
    expect(roomKindFor("guesstimate")).toBe("practice");
  });
});
