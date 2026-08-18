/**
 * What kind of account a User row actually is.
 *
 * The table holds three quite different things and only two of them are people:
 *
 *  - **registered** — someone who signed up.
 *  - **guest** — an anonymous visitor. Every click of "Start practising" mints
 *    one, they are never collected, and signing up absorbs them, so they are
 *    real traffic but not real accounts.
 *  - **benchmark** — synthetic rows seeded by `prisma/seed.ts` purely to give
 *    the percentile rank a cold-start population. On a fresh install there are
 *    40 of these against 2 real users, so counting them as users would report
 *    a userbase twenty times bigger than the one that exists.
 *
 * The email domain is the only marker the seed leaves behind, so it lives here
 * as a constant that both the writer and every reader import.
 */

export const BENCHMARK_EMAIL_DOMAIN = "@seed.caseclosed";

export const USER_SEGMENTS = ["registered", "guest", "benchmark"] as const;
export type UserSegment = (typeof USER_SEGMENTS)[number];

export const USER_SEGMENT_LABELS: Record<UserSegment, string> = {
  registered: "Registered",
  guest: "Guest",
  benchmark: "Benchmark",
};

export function userSegment(user: { email: string | null; isGuest: boolean }): UserSegment {
  // Checked before the guest flag: a benchmark row is never a guest, but this
  // ordering means a mislabelled seed row still can't inflate the real count.
  if (user.email?.toLowerCase().endsWith(BENCHMARK_EMAIL_DOMAIN)) return "benchmark";
  if (user.isGuest) return "guest";
  return "registered";
}

/** True for the rows that represent an actual person. */
export function isRealUser(user: { email: string | null; isGuest: boolean }): boolean {
  return userSegment(user) !== "benchmark";
}
