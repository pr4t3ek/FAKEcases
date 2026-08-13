import { describe, it, expect } from "vitest";
import { attemptStateFromRows, type AttemptStateRow } from "@/lib/attempt-state";

/**
 * What a library card offers for a question already met.
 *
 * The card used to read "Practise this" on visit 1 and on visit 40, with a
 * half-built tree sitting behind it either way. `startAttempt` always resumed
 * the newest in-progress attempt rather than minting a second one, so the
 * behaviour was right and only the label was lying — which is why the rule these
 * tests pin is not a preference but a mirror of that action.
 */

let seq = 0;
const row = (over: Partial<AttemptStateRow> = {}): AttemptStateRow => ({
  id: `a${++seq}`,
  questionId: "q1",
  status: "in_progress",
  evaluation: null,
  // Ascending by default, so "newest" is whatever was built last.
  createdAt: new Date(2026, 0, seq),
  ...over,
});

const submitted = (overall: number | null, over: Partial<AttemptStateRow> = {}) =>
  row({ status: "submitted", evaluation: { overall }, ...over });

describe("attemptStateFromRows", () => {
  it("offers nothing for a question never touched", () => {
    expect(attemptStateFromRows([])).toEqual({});
  });

  it("offers a resume for an unfinished attempt", () => {
    const a = row();
    const state = attemptStateFromRows([a]).q1;
    expect(state.state).toBe("in_progress");
    expect(state.attemptId).toBe(a.id);
  });

  it("offers a replay once one has been submitted", () => {
    const a = submitted(72);
    const state = attemptStateFromRows([a]).q1;
    expect(state.state).toBe("attempted");
    expect(state.attemptId).toBe(a.id);
    expect(state.bestOverall).toBe(72);
  });

  /**
   * The rule that has to match `startAttempt`, which resumes the newest
   * in-progress row before it considers creating anything. A card offering
   * "Practise again" that the action answered by reopening a half-finished
   * attempt would be worse than a card offering nothing.
   */
  it("lets an unfinished attempt outrank a submitted one", () => {
    const done = submitted(72);
    const open = row();
    const state = attemptStateFromRows([done, open]).q1;
    expect(state.state).toBe("in_progress");
    expect(state.attemptId).toBe(open.id);
    // The score already earned is still reported — it just doesn't own the button.
    expect(state.bestOverall).toBe(72);
    expect(state.timesAttempted).toBe(1);
  });

  it("resumes the newest unfinished attempt", () => {
    const older = row({ createdAt: new Date(2026, 0, 1) });
    const newer = row({ createdAt: new Date(2026, 0, 9) });
    expect(attemptStateFromRows([older, newer]).q1.attemptId).toBe(newer.id);
  });

  it("opens the newest report when several were submitted", () => {
    const first = submitted(50, { createdAt: new Date(2026, 0, 1) });
    const latest = submitted(60, { createdAt: new Date(2026, 0, 9) });
    const state = attemptStateFromRows([first, latest]).q1;
    expect(state.attemptId).toBe(latest.id);
    expect(state.timesAttempted).toBe(2);
  });

  it("badges the best score, not the latest", () => {
    // A worse retry must not erase what the first attempt earned.
    const state = attemptStateFromRows([
      submitted(88, { createdAt: new Date(2026, 0, 1) }),
      submitted(41, { createdAt: new Date(2026, 0, 9) }),
    ]).q1;
    expect(state.bestOverall).toBe(88);
  });

  /**
   * An attempt Teacher mode walked through has an evaluation and no overall.
   * A badge is exactly the sort of place a 0 would quietly reappear.
   */
  it("shows no score for an attempt that was never scored", () => {
    const state = attemptStateFromRows([submitted(null)]).q1;
    expect(state.state).toBe("attempted");
    expect(state.bestOverall).toBeNull();
    expect(state.timesAttempted).toBe(1);
  });

  it("ignores an unscored attempt when scoring the badge", () => {
    const state = attemptStateFromRows([submitted(64), submitted(null)]).q1;
    expect(state.bestOverall).toBe(64);
    expect(state.timesAttempted).toBe(2);
  });

  /**
   * Written by `startAttempt` when someone deliberately restarts a case in the
   * other tree mode. Not resumable, and never submitted — so it is neither of
   * the two things a card can offer.
   */
  it("treats an abandoned attempt as if it never happened", () => {
    const state = attemptStateFromRows([row({ status: "abandoned" })]).q1;
    expect(state.state).toBe("none");
    expect(state.attemptId).toBeNull();
    expect(state.timesAttempted).toBe(0);
  });

  it("still offers the report when an abandoned attempt sits on top of one", () => {
    const done = submitted(70, { createdAt: new Date(2026, 0, 1) });
    const state = attemptStateFromRows([
      done,
      row({ status: "abandoned", createdAt: new Date(2026, 0, 9) }),
    ]).q1;
    expect(state.state).toBe("attempted");
    expect(state.attemptId).toBe(done.id);
  });

  it("keeps questions apart", () => {
    const open = row({ questionId: "q2" });
    const done = submitted(55, { questionId: "q3" });
    const states = attemptStateFromRows([open, done]);
    expect(states.q2.state).toBe("in_progress");
    expect(states.q3.state).toBe("attempted");
    expect(states.q1).toBeUndefined();
  });

  it("does not care what order the rows arrive in", () => {
    const rows = [
      submitted(50, { createdAt: new Date(2026, 0, 1) }),
      row({ createdAt: new Date(2026, 0, 5) }),
      submitted(80, { createdAt: new Date(2026, 0, 3) }),
    ];
    const forwards = attemptStateFromRows(rows).q1;
    const backwards = attemptStateFromRows([...rows].reverse()).q1;
    expect(forwards).toEqual(backwards);
    expect(forwards.state).toBe("in_progress");
    expect(forwards.bestOverall).toBe(80);
  });
});
