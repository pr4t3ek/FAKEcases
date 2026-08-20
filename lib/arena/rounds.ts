/**
 * When a quarter is allowed to run, and who plays what if it does.
 *
 * Pure and DB-free, so the rule the whole multiplayer design rests on can be
 * tested directly — the same split `lib/rooms/roster.ts` takes from
 * `lib/rooms.ts`. `resolveIfDue` in `lib/arena.ts` is the database around this;
 * this is the decision.
 *
 * The rule is two sentences. A quarter runs when every seated PERSON has
 * committed, or when the clock has run out on them. A person who has not
 * committed by then plays whatever they played last quarter.
 *
 * Both halves matter and the second is the one that makes the format work at
 * all. Three people should never be held hostage by a fourth who closed the
 * tab, and the honest reading of somebody who did not choose is that they left
 * things as they were — not that the market stops turning until they come back.
 */

/** No deadline at all: a solo match has nobody to wait for. */
export type Deadline = Date | null;

export interface RoundPlan {
  /** Whether the quarter may run now. */
  due: boolean;
  /** Seated people who have not committed. They will be carried forward. */
  missing: number[];
  /** Why it is running, for the board to say so honestly. */
  reason: "everyone-in" | "clock" | "waiting";
}

export function planRound(args: {
  /** Seats a person is sitting in. AI seats never hold a quarter up. */
  humanSeats: number[];
  /** Seat indices that have staged a decision for this quarter. */
  committedSeats: number[];
  roundEndsAt: Deadline;
  now?: Date;
}): RoundPlan {
  const now = args.now ?? new Date();
  const committed = new Set(args.committedSeats);
  const missing = args.humanSeats.filter((seat) => !committed.has(seat));

  if (missing.length === 0) return { due: true, missing, reason: "everyone-in" };

  // `null` is a match with no clock rather than a clock that has already run
  // out — a lobby that has not started must not resolve itself.
  const expired = args.roundEndsAt !== null && args.roundEndsAt.getTime() <= now.getTime();
  return expired
    ? { due: true, missing, reason: "clock" }
    : { due: false, missing, reason: "waiting" };
}
