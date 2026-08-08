/**
 * Who can reach which content.
 *
 * Access is a property of a *tier*, not of a user row. The alternative — an
 * `isGuest` check at each gate — works exactly once: the day a paid plan lands,
 * every one of those checks is a site that has to learn about plans, and the
 * ones that get missed are the ones that give the product away. A tier table
 * means the gates ask one question ("may this tier open this?") and the answer
 * lives here.
 *
 * Today only `guest` is restricted. Turning the app freemium is a change to this
 * table rather than to any gate: set `free` to `free-tier-only`, point its
 * `upgrade` at checkout, and the server gates, the locked cards, the library
 * banner and the dashboard all follow.
 */

export const ACCESS_TIERS = ["guest", "free", "pro"] as const;
export type AccessTier = (typeof ACCESS_TIERS)[number];

/** What a blocked user is invited to do about it. */
export interface UpgradePath {
  /** Button copy on a locked card. */
  cta: string;
  href: string;
  /** One line explaining what being blocked means, shown on the wall banner. */
  reason: string;
  /**
   * How the library's count line names the way through — "…and 32 more with
   * Pro". It lives here rather than in the page because the page would
   * otherwise have to know which tier it was rendering for, and would tell a
   * signed-in free account that the rest is "unlocked by a free account".
   */
  unlocks: string;
}

export interface TierAccess {
  /** The whole library, or only questions flagged `freeTier`. */
  content: "all" | "free-tier-only";
  /** Null when the tier is never blocked, so there is nothing to offer. */
  upgrade: UpgradePath | null;
}

export const tierAccess: Record<AccessTier, TierAccess> = {
  guest: {
    content: "free-tier-only",
    upgrade: {
      cta: "Sign up to unlock",
      href: "/signup",
      reason:
        "You're browsing as a guest. One guesstimate, one case and one simulation are open — " +
        "create a free account to unlock the rest and save your progress.",
      unlocks: "with a free account",
    },
  },
  /**
   * A registered account opens the free set and keeps its progress; Pro opens
   * the rest.
   *
   * This is the line the whole tier table existed for. Nothing else changed to
   * turn the paywall on — the gates, the locked cards, the library banner and
   * the dashboard recommendations were all written against this table, so they
   * followed on their own.
   *
   * Note what a free account still buys over a guest, since it is not content
   * today: saved attempts, a streak, a percentile rank and a profile. Widening
   * the free content set is the admin panel's per-question toggle, not a code
   * change.
   */
  free: {
    content: "free-tier-only",
    upgrade: {
      cta: "Unlock everything",
      // The profile, not a pricing page — there is nothing to buy yet, and
      // sending someone to a checkout that doesn't exist would be worse than
      // sending them to the page that tells them where they stand.
      href: "/profile",
      // The counts are asserted against the seed and the scenario registry in
      // tests/entitlements.test.ts. This sentence said "9 war rooms" for three
      // scenarios longer than it was true — nothing tied the copy to the
      // catalogue it describes, so the finance scenarios shipped and the pitch
      // quietly under-sold the product at the moment someone decides to pay.
      reason:
        "Your account opens the free set. Pro opens the whole library — all 24 guesstimates, " +
        "both cases and all 12 war rooms.",
      unlocks: "with Pro",
    },
  },
  pro: { content: "all", upgrade: null },
};

/**
 * How many of each type the guest tier is meant to get.
 *
 * Documentation rather than enforcement: the flag on the row is what the gate
 * reads, so this is the intended shape of the shop window, checked by the seed
 * test rather than imposed at runtime. Flagging a second guesstimate is a valid
 * thing for an admin to do, and it should not need a code change.
 */
export const guestSampleSize = {
  guesstimate: 1,
  qualitative: 1,
  simulation: 1,
} as const;
