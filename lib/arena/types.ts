/**
 * The arena's vocabulary.
 *
 * Enum-like `String` columns, validated here, exactly as `lib/types.ts` does for
 * the rest of the app — SQLite has no DB enums and the repo's answer has never
 * been to pretend otherwise.
 */

/** How a match was opened. */
export const ARENA_MODES = ["solo", "multi"] as const;
export type ArenaMode = (typeof ARENA_MODES)[number];

export function isArenaMode(value: string): value is ArenaMode {
  return (ARENA_MODES as readonly string[]).includes(value);
}

/**
 * A match's lifecycle.
 *
 * `lobby` only ever applies to a multi match. A solo match is created already
 * `running`, because there is nobody to wait for and a lobby with one seat in it
 * is a screen that exists to be clicked through.
 */
export const ARENA_STATUSES = ["lobby", "running", "finished", "abandoned"] as const;
export type ArenaStatus = (typeof ARENA_STATUSES)[number];

/** Four firms, always. The market's arithmetic is sized for it. */
export const ARENA_SEATS = 4;

/** How long a round waits for humans before it commits them on their last call. */
export const ROUND_SECONDS = 150;

/**
 * One seat as the rest of the app reads it.
 *
 * `userId: null` IS the AI seat — there is no second flag, for the reason the
 * schema comment on `ArenaSeat.userId` gives.
 */
export interface SeatView {
  seatIndex: number;
  userId: string | null;
  personaId: string;
  displayName: string;
  /** True when nobody is sitting here and the persona is playing it. */
  isAi: boolean;
}

export function isAiSeat(seat: { userId: string | null }): boolean {
  return seat.userId === null;
}
