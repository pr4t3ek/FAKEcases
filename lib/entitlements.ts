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

/** The minimum needed to place someone in a tier. */
export interface TierSubject {
  isGuest: boolean;
  plan: string;
}

/**
 * No session is the guest tier, not an error.
 *
 * A first-time visitor has no `User` row at all — `getOrCreateGuest` mints one
 * at the moment they act. Treating `null` as anything else would make the
 * library render one set of locks before that first click and another set
 * after it.
 */
export function tierFor(user: TierSubject | null | undefined): AccessTier {
  if (!user || user.isGuest) return "guest";
  return user.plan === "pro" ? "pro" : "free";
}

/** The minimum needed to gate a question. */
export interface GatedQuestion {
  freeTier: boolean;
}

/** Whether this tier may start work on this question. */
export function canOpen(tier: AccessTier, question: GatedQuestion): boolean {
  return tierAccess[tier].content === "all" || question.freeTier;
}

/** The inverse, for UI that reads better as a lock than as a permission. */
export function isLocked(tier: AccessTier, question: GatedQuestion): boolean {
  return !canOpen(tier, question);
}

/** What to offer a blocked user, or null for a tier that is never blocked. */
export function upgradeFor(tier: AccessTier): UpgradePath | null {
  return tierAccess[tier].upgrade;
}

/**
 * Where a refused gate sends someone.
 *
 * The library rather than straight to `/signup`: being bounced to a signup form
 * with no explanation reads as a bug, while landing back on the library with the
 * wall banner up shows both what is locked and what is still open. The banner is
 * keyed off this query parameter.
 */
export const WALL_PARAM = "wall";
export const WALL_LOCKED = "locked";

export function wallRedirect(): string {
  return `/library?${WALL_PARAM}=${WALL_LOCKED}`;
}
