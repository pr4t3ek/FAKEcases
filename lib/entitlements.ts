/**
 * What a given visitor is allowed to open.
 *
 * Pure and DB-free, for two reasons. It can be unit-tested, and — more
 * importantly — the server gates and the library UI can call the *same*
 * function. A locked card and a refused `startAttempt` disagreeing is the worst
 * available outcome: either the app offers something it then snatches back, or
 * it hides something the server would have allowed.
 *
 * The inputs are structural rather than Prisma types (`TierSubject`,
 * `GatedQuestion`), so a React Server Component can pass the two fields it
 * already has instead of the whole row.
 */

import { tierAccess, type AccessTier, type UpgradePath } from "@/lib/config";
import type { QuestionSurface } from "@/lib/types";

/** The minimum needed to place someone in a tier. */
export interface TierSubject {
  isGuest: boolean;
  /** When Pro access runs out. Null, or a past instant, is a free account. */
  proUntil: Date | null;
}

/**
 * Which tier someone is in, right now.
 *
 * No session is the guest tier, not an error. A first-time visitor has no
 * `User` row at all — `getOrCreateGuest` mints one at the moment they act.
 * Treating `null` as anything else would make the library render one set of
 * locks before that first click and another set after it.
 *
 * Pro is a *date comparison*, not a stored label, and that is the whole design:
 * a pass that ran out yesterday is simply not greater than now, so the account
 * is back on the free tier with no job having run and no column to update. The
 * price is that every caller sees the tier as of the moment it asked, which is
 * exactly what it should see.
 *
 * `now` is injectable so expiry can be tested without touching the clock.
 */
export function tierFor(
  user: TierSubject | null | undefined,
  now: Date = new Date(),
): AccessTier {
  if (!user || user.isGuest) return "guest";
  return user.proUntil && user.proUntil > now ? "pro" : "free";
}

/** The minimum needed to gate a question. */
export interface GatedQuestion {
  /**
   * Required, and required for a reason: a grant is scoped to question ids, so a
   * caller that omitted one would silently lose its grant and lock a question it
   * meant to open. Failing closed is the safe direction; failing *silently* is
   * not. Making it required turns that into a type error instead.
   */
  id: string;
  freeTier: boolean;
}

/**
 * Questions opened to one visitor regardless of their tier.
 *
 * **Not an extension of `tierAccess`, and that is the load-bearing decision.**
 * The tier table answers "what does this TIER reach?", and its whole value is
 * that the answer does not depend on which row is asking. A classroom
 * membership is the opposite kind of fact: it is about one person and one
 * question. Expressing it in the table would mean either a fourth tier (a
 * student sitting in a room is still a guest, and `upgradeFor` still owes them
 * the signup path) or a per-user column on it — and either one ends the sentence
 * `lib/config/access.ts` is built on.
 *
 * So it is a third argument instead: independent of the tier, additive to it,
 * and empty by default, so `canOpen(tier, q)` means exactly what it always did.
 *
 * **The "one function, both callers" invariant survives** because the grant is
 * derived per surface, and both sides of a surface derive it the same way:
 *
 *   - `/simulations` and `startSimulation` both pass no grant. The card is
 *     locked and the action refuses. They agree.
 *   - `/room/[code]` and `startRoomRun` both pass `roomGrantFor(user.id)`. The
 *     button is offered and the action allows. They agree.
 *
 * What must never happen is one side of a *single* surface passing a grant the
 * other does not — which is why the derivation is one exported function in
 * `lib/rooms.ts` and is never inlined at a call site.
 */
export interface AccessGrant {
  readonly questionIds: readonly string[];
}

/** No grant at all — the default, and what every pre-classroom caller means. */
export const NO_GRANT: AccessGrant = { questionIds: [] };

/** Whether this tier may start work on this question. */
export function canOpen(
  tier: AccessTier,
  question: GatedQuestion,
  grant: AccessGrant = NO_GRANT,
): boolean {
  if (tierAccess[tier].content === "all" || question.freeTier) return true;
  return grant.questionIds.includes(question.id);
}

/** The inverse, for UI that reads better as a lock than as a permission. */
export function isLocked(
  tier: AccessTier,
  question: GatedQuestion,
  grant: AccessGrant = NO_GRANT,
): boolean {
  return !canOpen(tier, question, grant);
}

/** What to offer a blocked user, or null for a tier that is never blocked. */
export function upgradeFor(tier: AccessTier): UpgradePath | null {
  return tierAccess[tier].upgrade;
}

/**
 * Where a refused gate sends someone.
 *
 * The catalogue rather than straight to `/signup`: being bounced to a signup
 * form with no explanation reads as a bug, while landing back on the catalogue
 * with the wall banner up shows both what is locked and what is still open. The
 * banner is keyed off this query parameter.
 *
 * Which catalogue depends on what was refused. A locked war room has to send you
 * back to `/simulations` — the library no longer lists them, so the old
 * behaviour would bounce someone to a page with no trace of the thing they just
 * tried to open, and the one free war room sitting there to be played instead
 * would be nowhere in sight.
 */
export const WALL_PARAM = "wall";
export const WALL_LOCKED = "locked";

export function wallRedirect(surface: QuestionSurface = "practice"): string {
  const path = surface === "simulation" ? "/simulations" : "/library";
  return `${path}?${WALL_PARAM}=${WALL_LOCKED}`;
}
