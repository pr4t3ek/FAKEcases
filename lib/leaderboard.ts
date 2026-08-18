/**
 * Leaderboards: per-question, and cumulative across the app.
 *
 * Two rules shape everything here, and both are deliberate.
 *
 * **Only a first attempt is ranked.** A replay is easier — the candidate
 * remembers roughly where the ideal range was, or which cause the scenario was
 * hiding — so a second score is not comparable to a first and must not move a
 * standing. The rule is enforced by `LeaderboardEntry`'s unique constraint
 * rather than by a check here, so no future write path can forget it.
 *
 * **Points are the sum of first-attempt scores, not XP.** XP is awarded on every
 * submission and carries streak and daily bonuses, so an XP board would rank
 * whoever practised most rather than whoever practised best — and would reward
 * precisely the replaying the rule above refuses to count. Summing pinned
 * first-attempt scores keeps the two consistent: solving more questions climbs
 * the board, replaying the same one never does.
 *
 * The pure helpers are exported separately from the loaders so they can be
 * tested without a database, following `lib/admin-stats.ts`.
 */

import { db } from "@/lib/db";
import { collegeById } from "@/lib/config/colleges";
import { batchLabel } from "@/lib/config/batches";
import { BENCHMARK_EMAIL_DOMAIN } from "@/lib/user-segment";

/** Which exercise produced a ranked result. */
export const LEADERBOARD_KINDS = ["attempt", "simulation"] as const;
export type LeaderboardKind = (typeof LEADERBOARD_KINDS)[number];

/**
 * Rows are capped rather than paginated, matching `USER_ROW_CAP` in
 * lib/admin-stats.ts. This is demo-scale, and the cap is here so that stays an
 * explicit choice rather than a query that quietly degrades.
 */
export const STANDINGS_CAP = 500;

/** How many rows the dashboard and the report screens show. */
export const TOP_N = 7;

// ── Pure helpers ────────────────────────────────────────────────────────────

/**
 * Monday 00:00 UTC of the week containing `date`.
 *
 * UTC throughout, like the LLM budget's day key — a week boundary that moves
 * with the reader's timezone would let the same result count for two different
 * weeks depending on who was looking.
 */
export function weekStartUtc(date: Date): Date {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  // getUTCDay: 0 = Sunday. Shift so Monday is the first day.
  const shift = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - shift);
  return d;
}

/**
 * Midnight UTC of the day containing `date`.
 *
 * UTC for the same reason `weekStartUtc` is, and it matters more here: a day
 * boundary that moved with the reader's timezone would put two students on
 * different boards for the same afternoon. It also has to agree with
 * `lib/daily-unlock.ts`, which keys the day's question on the UTC calendar day —
 * a daily board whose day started at a different hour from the daily question
 * would rank people on a mix of two problems.
 */
export function dayStartUtc(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export type LeaderboardWindow = "day" | "week" | "all";

/** The `achievedAt` filter for a window, or undefined for all-time. */
export function windowFilter(window: LeaderboardWindow, now: Date = new Date()) {
  if (window === "day") return { gte: dayStartUtc(now) };
  if (window === "week") return { gte: weekStartUtc(now) };
  return undefined;
}

/**
 * How someone is named on a board: first name, their college when it is one we
 * can group by, and their PGP batch.
 *
 * First name only, and never the email. A leaderboard is the one screen in the
 * app that shows one candidate to another, and a full name against a low score
 * is a cost the feature does not need to impose. "Other" colleges show no
 * affiliation at all, which is the honest consequence of the curated list —
 * a written-in name is grouped with nobody (see lib/config/colleges.ts).
 *
 * Batch is nullable here even though the app requires one, because a row can
 * outlive the rule that produced it: accounts that ranked before the field
 * existed have none until they next sign in and meet `requireBatch`. A board
 * that refused to render those rows would be hiding real results to enforce a
 * label.
 *
 * The single place a row's identity is assembled, which is why adding a field
 * here reaches every board at once — the per-question board and the cumulative
 * one both spread this.
 */
export function displayNameFor(user: {
  name: string | null;
  collegeId: string | null;
  batch: string | null;
}): { name: string; college: string | null; batch: string | null } {
  const first = (user.name ?? "").trim().split(/\s+/)[0];
  return {
    name: first || "Learner",
    college: collegeById(user.collegeId)?.name ?? null,
    batch: batchLabel(user.batch),
  };
}

/**
 * Order ranked rows: best score first, then least effort, then earliest.
 *
 * Exported and pure because the tiebreak is the part worth pinning in a test —
 * "lower effort wins" is easy to invert by accident, and the symptom is a board
 * that looks plausible while being backwards.
 */
export function compareEntries(
  a: { score: number; effort: number; achievedAt: Date },
  b: { score: number; effort: number; achievedAt: Date },
): number {
  if (a.score !== b.score) return b.score - a.score;
  if (a.effort !== b.effort) return a.effort - b.effort;
  return a.achievedAt.getTime() - b.achievedAt.getTime();
}

/** Format the tiebreak for display. Attempts are a duration, sims are days. */
export function formatEffort(kind: string, effort: number): string | null {
  if (kind === "simulation") {
    return effort > 0 ? `${effort} analyst-day${effort === 1 ? "" : "s"}` : null;
  }
  if (effort <= 0) return null;
  const mins = Math.round(effort / 60);
  return mins < 1 ? "<1 min" : `${mins} min`;
}

// ── Writing ─────────────────────────────────────────────────────────────────

/**
 * Record a result, if this user has never had one on this question.
 *
 * Returns whether the row was created — false means a ranked result already
 * existed and this was a replay, which is what the report screens use to badge
 * themselves "unranked" rather than silently showing nothing.
 *
 * Two layers, and both are needed. The `findUnique` handles the ordinary replay,
 * which is a perfectly normal thing for a candidate to do and must not write an
 * error to the logs every time — Prisma logs a constraint violation at `error`
 * level (see lib/db.ts), so relying on the catch alone would fill production
 * logs with routine practice. The constraint is still the actual arbiter,
 * because two submissions racing would both pass the read; `P2002` from that
 * race is the one error worth swallowing, and anything else is a real fault that
 * gets logged rather than hidden.
 */
export async function recordFirstResult(args: {
  userId: string;
  questionId: string;
  kind: LeaderboardKind;
  score: number;
  effort: number;
  /** `Attempt.id` or `SimRun.id`, so a report can tell if it is the ranked one. */
  sourceId: string;
}): Promise<boolean> {
  const existing = await db.leaderboardEntry.findUnique({
    where: { userId_questionId: { userId: args.userId, questionId: args.questionId } },
    select: { id: true },
  });
  if (existing) return false;

  try {
    await db.leaderboardEntry.create({
      data: {
        userId: args.userId,
        questionId: args.questionId,
        kind: args.kind,
        score: Math.round(args.score),
        effort: Math.max(0, Math.round(args.effort)),
        sourceId: args.sourceId,
      },
    });
    return true;
  } catch (error) {
    // The race the constraint exists for: a concurrent submission got there
    // between the read above and this insert. Expected, and already handled.
    if ((error as { code?: string })?.code === "P2002") return false;
    // Anything else is a real fault. A missing board row must not fail a
    // submission — the report is what the candidate came for — but it must not
    // disappear silently either.
    console.error("[leaderboard] failed to record result:", error);
    return false;
  }
}

/**
 * Move a guest's ranked rows onto the account they just logged into.
 *
 * Only for the `login()` path, where the guest is a SEPARATE row that gets
 * deleted; `signup()` upgrades the guest row in place and so needs nothing.
 * Rows for questions the account has already ranked are left behind to be
 * cascaded away — the account's own result came first and outranks a guest
 * session's claim on the same question.
 */
export async function mergeGuestEntries(fromUserId: string, toUserId: string): Promise<void> {
  const [guestRows, existing] = await Promise.all([
    db.leaderboardEntry.findMany({ where: { userId: fromUserId }, select: { id: true, questionId: true } }),
    db.leaderboardEntry.findMany({ where: { userId: toUserId }, select: { questionId: true } }),
  ]);
  const taken = new Set(existing.map((e) => e.questionId));
  const movable = guestRows.filter((r) => !taken.has(r.questionId)).map((r) => r.id);
  if (movable.length) {
    await db.leaderboardEntry.updateMany({
      where: { id: { in: movable } },
      data: { userId: toUserId },
    });
  }
}

// ── Reading ─────────────────────────────────────────────────────────────────

/**
 * Who is eligible to appear.
 *
 * Guests are excluded for the reason `recomputeRank` excludes them — every
 * visitor who clicks "Start practising" mints one, so letting them onto a board
 * would rank drive-by traffic against candidates. Benchmark rows are excluded
 * because they are not people at all; they carry a skill rating and nothing
 * else, so they cannot produce an entry today, and the filter is here so that
 * stays true if they ever gain one.
 */
const rankableUser = {
  isGuest: false,
  NOT: { email: { endsWith: BENCHMARK_EMAIL_DOMAIN } },
};

export interface LeaderboardRow {
  userId: string;
  rank: number;
  name: string;
  college: string | null;
  /** "PGP-1" / "PGP-2", or null for an account that predates the field. */
  batch: string | null;
  score: number;
  effort: number;
  kind: string;
  achievedAt: Date;
}

/**
 * The board for one question, best first.
 *
 * Every row here is somebody's first attempt, by construction — there is no
 * "first" filter to apply because a non-first result was never written.
 */
export async function questionLeaderboard(
  questionId: string,
  limit = TOP_N,
): Promise<LeaderboardRow[]> {
  const rows = await db.leaderboardEntry.findMany({
    where: { questionId, user: rankableUser },
    orderBy: [{ score: "desc" }, { effort: "asc" }, { achievedAt: "asc" }],
    take: limit,
    include: { user: { select: { id: true, name: true, collegeId: true, batch: true } } },
  });

  return rows.map((r, i) => ({
    userId: r.userId,
    rank: i + 1,
    ...displayNameFor(r.user),
    score: r.score,
    effort: r.effort,
    kind: r.kind,
    achievedAt: r.achievedAt,
  }));
}

/**
 * This user's own standing on a question, and whether the attempt they are
 * looking at is the ranked one.
 *
 * `isThisAttempt` is what the report screen needs: on a replay it is false, and
 * the screen says so rather than showing a rank the current score did not earn.
 */
export async function questionStanding(
  userId: string,
  questionId: string,
  /** The attempt/run being viewed, so the caller learns if it is the ranked one. */
  sourceId?: string,
): Promise<{
  rank: number;
  total: number;
  score: number;
  effort: number;
  isThisAttempt: boolean;
} | null> {
  const mine = await db.leaderboardEntry.findUnique({
    where: { userId_questionId: { userId, questionId } },
  });
  if (!mine) return null;

  const all = await db.leaderboardEntry.findMany({
    where: { questionId, user: rankableUser },
    select: { userId: true, score: true, effort: true, achievedAt: true },
    take: STANDINGS_CAP,
  });
  const ordered = [...all].sort(compareEntries);
  const index = ordered.findIndex((r) => r.userId === userId);

  return {
    // A guest's own row is not in `ordered`; report them as unplaced rather
    // than as rank 0, which would read as "first".
    rank: index === -1 ? 0 : index + 1,
    total: ordered.length,
    score: mine.score,
    effort: mine.effort,
    // Absent `sourceId` the caller isn't looking at a specific run, so there is
    // nothing to contradict — treat the standing as its own.
    isThisAttempt: sourceId === undefined || mine.sourceId === sourceId,
  };
}

export interface GlobalStanding {
  userId: string;
  rank: number;
  name: string;
  college: string | null;
  /** "PGP-1" / "PGP-2", or null for an account that predates the field. */
  batch: string | null;
  points: number;
  solved: number;
}

/**
 * Cumulative standings — the sum of each user's first-attempt scores.
 *
 * Returns the whole (capped) ordered list rather than just the top few, so the
 * dashboard can slice a top N *and* find the viewer's own position from one
 * query instead of two that could disagree.
 *
 * **One kind at a time.** This used to sum every entry a user had, which added a
 * simulation's score to a guesstimate's — two numbers off different rubrics,
 * measuring different things, on different scales of effort. `simSummary` had
 * already refused to do that ("averaging the two numbers would produce something
 * that means nothing") and this was quietly doing it anyway. Two boards is the
 * honest shape: a war-room standing and a practice standing are not comparable
 * and should not be added.
 */
export async function globalStandings(
  window: LeaderboardWindow,
  kind: LeaderboardKind,
  now: Date = new Date(),
): Promise<GlobalStanding[]> {
  const achievedAt = windowFilter(window, now);
  const grouped = await db.leaderboardEntry.groupBy({
    by: ["userId"],
    where: { kind, user: rankableUser, ...(achievedAt ? { achievedAt } : {}) },
    _sum: { score: true },
    _count: { _all: true },
    orderBy: { _sum: { score: "desc" } },
    take: STANDINGS_CAP,
  });
  if (!grouped.length) return [];

  const users = await db.user.findMany({
    where: { id: { in: grouped.map((g) => g.userId) } },
    select: { id: true, name: true, collegeId: true, batch: true },
  });
  const byId = new Map(users.map((u) => [u.id, u]));

  return grouped.flatMap((g, i) => {
    const user = byId.get(g.userId);
    if (!user) return [];
    return [
      {
        userId: g.userId,
        rank: i + 1,
        ...displayNameFor(user),
        points: g._sum.score ?? 0,
        solved: g._count._all,
      },
    ];
  });
}

/**
 * The dashboard's view: a top slice, where the viewer sits, and how many people
 * are on the board at all.
 *
 * All three come off one ordered list rather than three queries, so "you are
 * 12th of 40" can never be assembled from two reads that disagree.
 */
export async function globalBoard(
  userId: string,
  window: LeaderboardWindow,
  kind: LeaderboardKind = "attempt",
  limit = TOP_N,
): Promise<{ top: GlobalStanding[]; you: GlobalStanding | null; total: number }> {
  const standings = await globalStandings(window, kind);
  return {
    top: standings.slice(0, limit),
    you: standings.find((s) => s.userId === userId) ?? null,
    total: standings.length,
  };
}
