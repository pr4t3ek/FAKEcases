import { describe, it, expect } from "vitest";
import { simStateFromRuns } from "@/lib/sim/replay";

/**
 * The pure half of the library card's simulation state.
 *
 * Tested directly rather than through Prisma, matching `tests/leaderboard.test.ts`:
 * the precedence rule is the part worth pinning, and it needs no database to be
 * wrong. The rule that matters — an unfinished run outranks a finished one — is
 * easy to invert by accident, and the symptom is a card that offers "play again"
 * on a war room with analyst-days already spent.
 */

const DAY = 24 * 60 * 60 * 1000;
const t0 = new Date("2026-01-01T00:00:00Z");
const later = (days: number) => new Date(t0.getTime() + days * DAY);

function run(over: {
  id: string;
  questionId: string;
  phase: string;
  overall?: number | null;
  createdAt?: Date;
}) {
  return {
    id: over.id,
    questionId: over.questionId,
    phase: over.phase,
    result: over.overall == null ? null : { overall: over.overall },
    createdAt: over.createdAt ?? t0,
  };
}

describe("simStateFromRuns", () => {
  it("reports nothing for a question with no runs", () => {
    expect(simStateFromRuns([])).toEqual({});
    expect(simStateFromRuns([run({ id: "r1", questionId: "q1", phase: "observe" })])["q2"]).toBeUndefined();
  });

  it("treats every pre-debrief phase as resumable", () => {
    for (const phase of ["observe", "investigate", "commit"]) {
      const state = simStateFromRuns([run({ id: "r1", questionId: "q1", phase })]);
      expect(state["q1"]).toEqual({ state: "in_progress", runId: "r1", bestOverall: null });
    }
  });

  it("reports a committed run as played, with its score", () => {
    const state = simStateFromRuns([
      run({ id: "r1", questionId: "q1", phase: "debrief", overall: 72 }),
    ]);
    expect(state["q1"]).toEqual({ state: "played", runId: "r1", bestOverall: 72 });
  });

  it("lets an unfinished run outrank a finished one, and points at the unfinished one", () => {
    // The replay case: played it once, started again, wandered off. The button
    // has to resume the live run rather than offer a third.
    const state = simStateFromRuns([
      run({ id: "done", questionId: "q1", phase: "debrief", overall: 64, createdAt: later(0) }),
      run({ id: "live", questionId: "q1", phase: "investigate", createdAt: later(1) }),
    ]);
    expect(state["q1"]).toEqual({ state: "in_progress", runId: "live", bestOverall: 64 });
  });

  it("keeps the best score visible while an unfinished replay owns the button", () => {
    // Order reversed from the test above: precedence must not depend on the
    // order rows come back from the database.
    const state = simStateFromRuns([
      run({ id: "live", questionId: "q1", phase: "observe", createdAt: later(5) }),
      run({ id: "done", questionId: "q1", phase: "debrief", overall: 88, createdAt: later(1) }),
    ]);
    expect(state["q1"]).toEqual({ state: "in_progress", runId: "live", bestOverall: 88 });
  });

  it("takes the best of several finished runs, not the latest", () => {
    // The board keeps the FIRST score, but the card advertises the best one —
    // these are different numbers on purpose, and this pins the card's.
    const state = simStateFromRuns([
      run({ id: "r1", questionId: "q1", phase: "debrief", overall: 90, createdAt: later(0) }),
      run({ id: "r2", questionId: "q1", phase: "debrief", overall: 55, createdAt: later(2) }),
    ]);
    expect(state["q1"].bestOverall).toBe(90);
  });

  it("points a played question at its most recent debrief", () => {
    const state = simStateFromRuns([
      run({ id: "old", questionId: "q1", phase: "debrief", overall: 40, createdAt: later(0) }),
      run({ id: "new", questionId: "q1", phase: "debrief", overall: 41, createdAt: later(3) }),
    ]);
    expect(state["q1"].runId).toBe("new");
  });

  it("resumes the newest run when two are somehow open at once", () => {
    // There is no unique constraint on SimRun(userId, questionId), so two
    // concurrent starts can leave two open runs. Pick one deterministically.
    const state = simStateFromRuns([
      run({ id: "older", questionId: "q1", phase: "observe", createdAt: later(1) }),
      run({ id: "newer", questionId: "q1", phase: "observe", createdAt: later(2) }),
    ]);
    expect(state["q1"].runId).toBe("newer");
  });

  it("does not offer a run that reached debrief without a result", () => {
    // `commitRun` writes the phase and the result in one transaction, so this
    // should be unreachable — but it must not read as resumable if it happens.
    const state = simStateFromRuns([run({ id: "r1", questionId: "q1", phase: "debrief" })]);
    expect(state["q1"]).toEqual({ state: "played", runId: "r1", bestOverall: null });
  });

  it("keeps questions apart", () => {
    const state = simStateFromRuns([
      run({ id: "a", questionId: "q1", phase: "investigate" }),
      run({ id: "b", questionId: "q2", phase: "debrief", overall: 70 }),
    ]);
    expect(state["q1"].state).toBe("in_progress");
    expect(state["q2"].state).toBe("played");
  });
});
