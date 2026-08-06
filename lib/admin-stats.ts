import { db } from "@/lib/db";
import { rankBands } from "@/lib/config";
import { userSegment, type UserSegment } from "@/lib/user-segment";

/**
 * Aggregates behind the admin Users tab.
 *
 * Every headline figure counts real accounts only — see `lib/user-segment.ts`
 * for why a fresh install would otherwise report 42 users when two people exist.
 * Benchmark rows are still returned in `users` so the rank population stays
 * auditable behind the segment filter; they are simply not summed.
 *
 * The pure shaping helpers are exported separately from the loader so they can
 * be tested without a database.
 */

/**
 * Rows are capped rather than paginated. This is a demo-scale panel — one
 * `findMany` and client-side sorting — and the cap is here so that stays an
 * explicit choice instead of a page that quietly degrades at scale.
 */
export const USER_ROW_CAP = 500;

const DAY_MS = 24 * 60 * 60 * 1000;
export const SIGNUP_WINDOW_DAYS = 30;
const RECENT_WINDOW_DAYS = 7;

/** UTC day key, "YYYY-MM-DD" — same convention as the LLM budget counter. */
export function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export interface AdminUserRow {
  id: string;
  name: string | null;
  email: string | null;
  segment: UserSegment;
  role: string;
  level: number;
  xp: number;
  streak: number;
  rank: string | null;
  attempts: number;
  /** Mean evaluation score across their submitted attempts; null if none. */
  avgScore: number | null;
  totalSolved: number;
  /** Set on submit, not on login — so it means "last practised". */
  lastActiveDate: string | null;
  createdAt: string;
  /**
   * When their Pro pass runs out, or null. Sent as an ISO string rather than a
   * tier label so the table can show days remaining and so a pass that lapsed
   * between the query and the render reads correctly — the tier is a comparison
   * against now, never a stored value.
   */
  proUntil: string | null;
}

export interface AdminUserStats {
  registered: number;
  guests: number;
  benchmark: number;
  /** Real accounts that submitted something in the last 7 days. */
  practisedRecently: number;
  /** Real accounts created in the last 7 days. */
  newRecently: number;
  attempts: number;
  submittedAttempts: number;
  /** Mean of every Evaluation.overall on the platform; null before any exist. */
  avgScore: number | null;
  signups: { day: string; count: number }[];
  ranks: { rank: string; count: number }[];
  users: AdminUserRow[];
  /** True when the cap trimmed the list, so the UI can say so. */
  truncated: boolean;
}

/**
 * One point per day across the window, including days nobody signed up.
 *
 * Zero-filling is what makes the x-axis a timeline. Plotting only the days that
 * happen to have signups draws a flat line through a quiet fortnight and reads
 * as steady growth.
 */
export function signupSeries(
  createdAts: Date[],
  now: Date = new Date(),
  days: number = SIGNUP_WINDOW_DAYS,
): { day: string; count: number }[] {
  const counts = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) {
    counts.set(dayKey(new Date(now.getTime() - i * DAY_MS)), 0);
  }
  for (const created of createdAts) {
    const key = dayKey(created);
    // Anything older than the window is simply outside the chart.
    if (counts.has(key)) counts.set(key, counts.get(key)! + 1);
  }
  return [...counts.entries()].map(([day, count]) => ({ day, count }));
}

/**
 * Every band, always, in ladder order — including the ones nobody is in.
 *
 * A distribution that only lists occupied bands changes shape as people move
 * between them, which makes two screenshots impossible to compare.
 */
export function rankDistribution(ranks: (string | null)[]): { rank: string; count: number }[] {
  const order = ["Unranked", ...[...rankBands].reverse().map((b) => b.rank)];
  const counts = new Map<string, number>(order.map((r) => [r, 0]));
  for (const rank of ranks) {
    const key = rank ?? "Unranked";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return order.map((rank) => ({ rank, count: counts.get(rank) ?? 0 }));
}

export async function loadUserAdminStats(now: Date = new Date()): Promise<AdminUserStats> {
  const since = new Date(now.getTime() - RECENT_WINDOW_DAYS * DAY_MS);

  const [rows, totalUsers, attempts, submittedAttempts, scoreAgg] = await Promise.all([
    db.user.findMany({
      orderBy: { createdAt: "desc" },
      take: USER_ROW_CAP,
      include: {
        progress: { select: { avgScore: true, totalSolved: true } },
        _count: { select: { attempts: true } },
      },
    }),
    db.user.count(),
    db.attempt.count(),
    db.attempt.count({ where: { status: "submitted" } }),
    db.evaluation.aggregate({ _avg: { overall: true } }),
  ]);

  const users: AdminUserRow[] = rows.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    segment: userSegment(u),
    role: u.role,
    level: u.level,
    xp: u.xp,
    streak: u.streak,
    rank: u.rank,
    proUntil: u.proUntil ? u.proUntil.toISOString() : null,
    attempts: u._count.attempts,
    // Progress only exists once something has been submitted, and an avgScore
    // of 0 there means "no graded attempts", not "scored zero".
    avgScore: u.progress?.totalSolved ? Math.round(u.progress.avgScore) : null,
    totalSolved: u.progress?.totalSolved ?? 0,
    lastActiveDate: u.lastActiveDate?.toISOString() ?? null,
    createdAt: u.createdAt.toISOString(),
  }));

  const real = users.filter((u) => u.segment !== "benchmark");

  return {
    registered: real.filter((u) => u.segment === "registered").length,
    guests: real.filter((u) => u.segment === "guest").length,
    benchmark: users.length - real.length,
    practisedRecently: real.filter(
      (u) => u.lastActiveDate && new Date(u.lastActiveDate) >= since,
    ).length,
    newRecently: real.filter((u) => new Date(u.createdAt) >= since).length,
    attempts,
    submittedAttempts,
    avgScore: scoreAgg._avg.overall === null ? null : Math.round(scoreAgg._avg.overall),
    signups: signupSeries(
      real.map((u) => new Date(u.createdAt)),
      now,
    ),
    // Benchmark rows carry a skillRating but never a rank, so including them
    // would just pile 40 rows into "Unranked" and flatten the real shape.
    ranks: rankDistribution(real.map((u) => u.rank)),
    users,
    truncated: totalUsers > rows.length,
  };
}
