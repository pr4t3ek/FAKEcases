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
    },
  },
  /**
   * A registered account reaches everything. This is the line that changes when
   * the product goes freemium; until it does, saying so plainly here is better
   * than a `pro` tier that looks like it already means something.
   */
  free: { content: "all", upgrade: null },
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
