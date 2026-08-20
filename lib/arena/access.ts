/**
 * Who may open the arena.
 *
 * ONE predicate, and both sides of every surface call it — the nav that renders
 * the link and the server action that honours it. That is the invariant
 * `lib/entitlements.ts` exists to protect, restated here because the arena is
 * deliberately not part of the tier table: a link that offers something the
 * action then refuses is the exact failure both files are written to prevent.
 *
 * Deliberately NOT a tier. `tierFor()` answers "what does this person's plan
 * reach"; the arena is opened one account at a time by an admin, so folding it
 * into the tier ladder would mean every Pro pass silently granted it and
 * revoking it would mean taking Pro away.
 *
 * DB-free and pure, so a test can reach it and so a client component can import
 * it without dragging Prisma in.
 */

/** The subject shape, kept minimal so `getSessionUser()`'s row satisfies it. */
export interface ArenaSubject {
  arenaGrantedAt: Date | null;
  isGuest: boolean;
}

/**
 * Signed in, not a guest, and granted.
 *
 * Guests are refused outright rather than given a trial. A match is a
 * multi-quarter commitment against three other firms; handing one to a session
 * that evaporates would leave a human match a seat short, and the guest would
 * lose the run they had just spent fifteen minutes on.
 */
export function canPlayArena(user: ArenaSubject | null | undefined): boolean {
  if (!user) return false;
  if (user.isGuest) return false;
  return user.arenaGrantedAt !== null && user.arenaGrantedAt !== undefined;
}

/** Where a refused action sends someone. */
export const ARENA_WALL = "/dashboard?wall=arena";
