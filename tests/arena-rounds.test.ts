import { describe, expect, it } from "vitest";
import { planRound } from "@/lib/arena/rounds";

/**
 * When a quarter runs.
 *
 * This is the rule the entire two-mode design rests on: a match must never be
 * stuck waiting for somebody, because the answer to "what if nobody else joins"
 * has to be "it plays anyway" or the feature is a lobby simulator.
 */
const T0 = new Date("2026-08-20T10:00:00.000Z");
const at = (seconds: number) => new Date(T0.getTime() + seconds * 1_000);

describe("planRound", () => {
  it("runs as soon as every person has committed", () => {
    const plan = planRound({
      humanSeats: [0, 2],
      committedSeats: [0, 2],
      roundEndsAt: at(300),
      now: T0,
    });
    expect(plan).toMatchObject({ due: true, reason: "everyone-in", missing: [] });
  });

  it("waits while somebody still owes a decision and the clock has time", () => {
    const plan = planRound({
      humanSeats: [0, 1],
      committedSeats: [0],
      roundEndsAt: at(60),
      now: T0,
    });
    expect(plan).toMatchObject({ due: false, reason: "waiting", missing: [1] });
  });

  it("runs anyway once the clock is out, and names who was carried", () => {
    const plan = planRound({
      humanSeats: [0, 1, 3],
      committedSeats: [0],
      roundEndsAt: at(-1),
      now: T0,
    });
    expect(plan).toMatchObject({ due: true, reason: "clock" });
    expect(plan.missing).toEqual([1, 3]);
  });

  it("resolves a solo match on the one person, with no clock at all", () => {
    // A solo match sets no deadline. The round has to turn on the commit, not
    // on a timer that never fires.
    expect(planRound({ humanSeats: [0], committedSeats: [0], roundEndsAt: null, now: T0 }))
      .toMatchObject({ due: true, reason: "everyone-in" });
  });

  it("does not resolve a match with no clock while somebody is missing", () => {
    // A lobby has no deadline either, and must not resolve itself into quarter
    // one because nobody has committed to a match that has not started.
    expect(planRound({ humanSeats: [0, 1], committedSeats: [], roundEndsAt: null, now: T0 }))
      .toMatchObject({ due: false, reason: "waiting" });
  });

  it("ignores AI seats entirely", () => {
    // Seats 1–3 are the house here. They never hold a quarter up, because they
    // committed before the player did — that is what `reveal` before `decide`
    // means.
    expect(planRound({ humanSeats: [0], committedSeats: [0], roundEndsAt: at(300), now: T0 }))
      .toMatchObject({ due: true });
  });

  it("treats a match with nobody in it as ready", () => {
    // Every seat handed back to the house. The match plays itself out rather
    // than hanging forever in a state no one can clear.
    expect(planRound({ humanSeats: [], committedSeats: [], roundEndsAt: null, now: T0 }))
      .toMatchObject({ due: true, reason: "everyone-in" });
  });
});
