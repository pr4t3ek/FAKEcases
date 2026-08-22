import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { dayKey } from "@/lib/admin-stats";
import { weekStartUtc } from "@/lib/leaderboard";
import { BENCHMARK_EMAIL_DOMAIN } from "@/lib/user-segment";
import { BATCHES, batchLabel } from "@/lib/config/batches";
import { PRACTISABLE_TYPES } from "@/lib/types";

/**
 * The cohort, rather than the roster.
 *
 * `lib/admin-stats.ts` answers "who is this person" — one row each, with the
 * grants and the buttons that change them. This answers "how is the cohort
 * doing", and the four questions it exists to settle are not ours: they are the
 * ones `docs/RETENTION.md` §2 commits to before any of its levers are built.
 *
 * **No analytics provider.** That memo assumes these need PostHog behind an env
 * var, and they do not: `Attempt`, `SimRun` and `ArenaMatch` all stamp
 * `createdAt`, `User` stamps `createdAt`, and every metric below falls out of
 * those. Keeping it in the database keeps the zero-key promise — an app that
 * only measures itself when a third party is configured measures itself in
 * production and nowhere else.
 *
 * ## Two rules the Users tab does not follow
 *
 * **Counted at the query.** `loadUserAdminStats` derives its headline counts
 * from a list capped at `USER_ROW_CAP`, so on a big install they quietly stop
 * being true — the panel warns that the *table* is truncated, not the numbers
 * above it. Everything here is a `count`/`groupBy`, correct at any size.
 *
 * **Tombstones are not guests.** `isRealUser` already drops the seeded
 * benchmark rows. The anonymous rows `lib/account-deletion.ts` mints to keep a
 * professor's roster intact carry `isGuest: true` and no email, so they read as
 * guests and would inflate that count; `deletedAt: null` is what keeps them out.
 *
 * The pure shaping helpers are exported separately from the loader so they can
 * be tested without a database, exactly as `signupSeries` and `rankDistribution`
 * are next door.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** How long an account can be silent before it counts as gone. */
export const QUIET_AFTER_DAYS = 14;
/** Windows for the return-rate headline, in days since signup. */
export const RETURN_WINDOWS = [1, 7, 30] as const;
/** Weeks of history behind the "active days per active week" chart. */
export const ACTIVITY_WEEKS = 8;
/**
 * How far back raw activity rows are read.
 *
 * The only query here that is not an aggregate, so it is the only one with a
 * window. Demo-scale by the same explicit choice as `USER_ROW_CAP`: a year of
 * timestamps for one campus is tens of thousands of rows, and writing the limit
 * down is what stops it becoming a page that degrades without anyone deciding.
 */
export const ACTIVITY_WINDOW_DAYS = 90;
/** Share of the library past which `docs/RETENTION.md` calls someone exhausted. */
export const EXHAUSTION_THRESHOLD = 0.6;

/**
 * A row that stands for a person, and is still here.
 *
 * The null arm is load-bearing rather than defensive: in SQL a comparison
 * against NULL is NULL rather than false, so `NOT (email LIKE '%@seed…')` drops
 * every guest — who has no email at all — and the guest count silently becomes
 * zero. Saying "no email, or an email that isn't a benchmark one" is the same
 * rule `userSegment` applies in TypeScript, written so the database agrees.
 */
export const REAL_USER_WHERE: Prisma.UserWhereInput = {
  deletedAt: null,
  OR: [{ email: null }, { NOT: { email: { endsWith: BENCHMARK_EMAIL_DOMAIN } } }],
};

// ── Pure shaping ────────────────────────────────────────────────────────────

/** One person's activity: when they joined, and the days they showed up. */
export interface ActivityProfile {
  userId: string;
  createdAt: Date;
  /** UTC day keys on which they did anything at all. */
  activeDays: Set<string>;
}

export interface ReturnRate {
  /** Days since signup the window covers. */
  window: number;
  /** Accounts old enough for the window to have closed. */
  eligible: number;
  /** Of those, how many came back on a later day inside it. */
  returned: number;
}

/**
 * D1 / D7 / D30, with the denominator kept.
 *
 * Two decisions worth stating. **A later calendar day**, not "any activity" —
 * the session that follows signing up by ten minutes is the signup, and
 * counting it would report 100% D1 forever. And **only accounts old enough for
 * the window to have closed** are eligible: someone who joined this morning has
 * not failed to return within 30 days, they have not had the chance, and
 * including them makes every rate fall as the cohort grows.
 *
 * The rate itself is left to the caller. A percentage with no denominator is
 * the thing that makes five accounts look like a finding.
 */
export function returnRates(
  people: ActivityProfile[],
  now: Date = new Date(),
  windows: readonly number[] = RETURN_WINDOWS,
): ReturnRate[] {
  return windows.map((window) => {
    let eligible = 0;
    let returned = 0;
    for (const person of people) {
      const joined = person.createdAt.getTime();
      if (now.getTime() - joined < window * DAY_MS) continue;
      eligible++;
      const joinedDay = dayKey(person.createdAt);
      const deadline = joined + window * DAY_MS;
      for (const day of person.activeDays) {
        if (day <= joinedDay) continue;
        // The day key is a date, so the comparison is against its own midnight —
        // a return on day 7 counts for D7 wherever in that day it happened.
        if (new Date(`${day}T00:00:00.000Z`).getTime() <= deadline) {
          returned++;
          break;
        }
      }
    }
    return { window, eligible, returned };
  });
}

export interface ActiveWeek {
  /** Monday of the week, as a UTC day key. */
  week: string;
  /** People with at least one active day in it. */
  activeUsers: number;
  /** Mean distinct active days each of them had. 1.0 means nobody came twice. */
  avgActiveDays: number;
}

/**
 * The memo asks for "sessions per active week". This counts **distinct active
 * days** per active person instead, and the difference is not pedantry: there is
 * no session table and no session id anywhere in the schema, so a session would
 * have to be invented out of gaps between timestamps. A day somebody turned up
 * is a fact the database actually holds, and it answers the question the memo
 * was really asking — a daily habit against a weekend cram — without dressing an
 * assumption up as a measurement.
 *
 * Empty weeks are kept, so a quiet fortnight looks like one.
 */
export function activeDaysPerWeek(
  activity: { userId: string; at: Date }[],
  now: Date = new Date(),
  weeks: number = ACTIVITY_WEEKS,
): ActiveWeek[] {
  const buckets = new Map<string, Map<string, Set<string>>>();
  const thisWeek = weekStartUtc(now);
  for (let i = weeks - 1; i >= 0; i--) {
    buckets.set(dayKey(new Date(thisWeek.getTime() - i * 7 * DAY_MS)), new Map());
  }

  for (const event of activity) {
    const week = dayKey(weekStartUtc(event.at));
    const byUser = buckets.get(week);
    if (!byUser) continue; // outside the window
    const days = byUser.get(event.userId) ?? new Set<string>();
    days.add(dayKey(event.at));
    byUser.set(event.userId, days);
  }

  return [...buckets.entries()].map(([week, byUser]) => {
    const counts = [...byUser.values()].map((days) => days.size);
    const total = counts.reduce((sum, n) => sum + n, 0);
    return {
      week,
      activeUsers: counts.length,
      avgActiveDays: counts.length ? Math.round((total / counts.length) * 10) / 10 : 0,
    };
  });
}

export interface Bucket {
  label: string;
  count: number;
}

const QUIET_BUCKETS: { label: string; max: number }[] = [
  { label: "1", max: 1 },
  { label: "2–3", max: 3 },
  { label: "4–6", max: 6 },
  { label: "7–10", max: 10 },
  { label: "11–20", max: 20 },
  { label: "21+", max: Infinity },
];

/**
 * Where people stop — the metric `docs/RETENTION.md` says could invalidate the
 * rest of its plan.
 *
 * Counts lifetime attempts for accounts that have gone quiet, so the shape says
 * which problem this app has: a mode at 1–3 is an **activation** problem and
 * most of that memo is premature; a mode near the size of the library is
 * **content exhaustion** and its first lever is urgent.
 *
 * Accounts that never did anything at all are excluded and counted separately —
 * they never started, so they cannot have stopped, and leaving them in would
 * pile the whole activation hole into the first bucket and hide it as a mode.
 */
export function attemptsBeforeQuiet(
  people: { attempts: number; lastActiveAt: Date | null }[],
  now: Date = new Date(),
  quietAfterDays: number = QUIET_AFTER_DAYS,
): { buckets: Bucket[]; quietPeople: number; modal: string | null } {
  const cutoff = now.getTime() - quietAfterDays * DAY_MS;
  const counts = new Map<string, number>(QUIET_BUCKETS.map((b) => [b.label, 0]));
  let quietPeople = 0;

  for (const person of people) {
    if (person.attempts === 0 || !person.lastActiveAt) continue;
    if (person.lastActiveAt.getTime() > cutoff) continue;
    quietPeople++;
    const bucket = QUIET_BUCKETS.find((b) => person.attempts <= b.max)!;
    counts.set(bucket.label, counts.get(bucket.label)! + 1);
  }

  const buckets = QUIET_BUCKETS.map((b) => ({ label: b.label, count: counts.get(b.label)! }));
  const top = buckets.reduce((best, b) => (b.count > best.count ? b : best), buckets[0]);
  return { buckets, quietPeople, modal: top.count > 0 ? top.label : null };
}

export interface CoverageBucket {
  label: string;
  pro: number;
  free: number;
  /** Whether this band is at or past the exhaustion threshold. */
  exhausted: boolean;
}

const COVERAGE_BANDS = [0.2, 0.4, 0.6, 0.8, 1.01];
const COVERAGE_LABELS = ["<20%", "20–40%", "40–60%", "60–80%", "80%+"];

/**
 * How much of the library people have actually seen, Pro apart from free.
 *
 * The split is the point rather than a nicety. Only Pro reaches the whole
 * catalogue today — `guestSampleSize` is zero across the board, so a free
 * account's reachable set is the rotating daily pair (`lib/daily-unlock.ts`) —
 * which means one exhaustion rate across both tiers would average a denominator
 * of 61 with a denominator of 2 and describe neither. The denominator here is
 * the whole practisable library for both, and the card says so.
 */
export function coverageBuckets(
  people: { distinct: number; pro: boolean }[],
  librarySize: number,
): CoverageBucket[] {
  const rows: CoverageBucket[] = COVERAGE_LABELS.map((label, i) => ({
    label,
    pro: 0,
    free: 0,
    exhausted: COVERAGE_BANDS[i] > EXHAUSTION_THRESHOLD,
  }));
  if (librarySize <= 0) return rows;

  for (const person of people) {
    const share = person.distinct / librarySize;
    const index = COVERAGE_BANDS.findIndex((band) => share < band);
    const row = rows[index === -1 ? rows.length - 1 : index];
    if (person.pro) row.pro++;
    else row.free++;
  }
  return rows;
}

export interface FormatRow {
  type: string;
  label: string;
  started: number;
  submitted: number;
  /** Percentage, 0–100. Zero when nothing was started, never NaN. */
  completion: number;
}

const FORMAT_LABELS: Record<string, string> = {
  guesstimate: "Guesstimates",
  qualitative: "Cases",
  simulation: "War rooms",
};

/**
 * Which format is actually being solved, and how much of what is opened is
 * finished.
 *
 * Every practisable type appears whether or not anyone has touched it, for the
 * same reason `rankDistribution` lists empty bands: a chart that drops its zero
 * rows changes shape as usage moves and makes two screenshots incomparable.
 *
 * The **Arena is deliberately absent**. A match is a game rather than an
 * exercise and is scored on its own rubric — the same reason the cumulative
 * leaderboard that summed the two was removed. It gets a tile of its own.
 */
export function formatMix(rows: { type: string; started: number; submitted: number }[]): FormatRow[] {
  const byType = new Map(rows.map((r) => [r.type, r]));
  return PRACTISABLE_TYPES.map((type) => {
    const row = byType.get(type);
    const started = row?.started ?? 0;
    const submitted = row?.submitted ?? 0;
    return {
      type,
      label: FORMAT_LABELS[type] ?? type,
      started,
      submitted,
      completion: started === 0 ? 0 : Math.round((submitted / started) * 100),
    };
  });
}

// ── The loaded shape ────────────────────────────────────────────────────────

export interface AdminAnalytics {
  cohort: {
    registered: number;
    guests: number;
    activeWeek: number;
    activeMonth: number;
    /** Registered accounts that have never opened anything. */
    neverStarted: number;
    pro: number;
    professors: number;
    arenaGranted: number;
    arenaMatches: number;
    batches: Bucket[];
  };
  practice: {
    formats: FormatRow[];
    /** Busiest questions first, capped — the tail is a long list of ones. */
    topQuestions: { id: string; title: string; type: string; started: number; submitted: number }[];
  };
  retention: {
    returns: ReturnRate[];
    weeks: ActiveWeek[];
    quiet: { buckets: Bucket[]; quietPeople: number; modal: string | null };
    coverage: CoverageBucket[];
    librarySize: number;
  };
  /** How far back the activity-derived panels can see. */
  windowDays: number;
}

/** Busiest-question rows shown. The tail is a long list of ones. */
const TOP_QUESTIONS = 8;

export async function loadAdminAnalytics(now: Date = new Date()): Promise<AdminAnalytics> {
  const weekAgo = new Date(now.getTime() - 7 * DAY_MS);
  const monthAgo = new Date(now.getTime() - 30 * DAY_MS);
  const windowStart = new Date(now.getTime() - ACTIVITY_WINDOW_DAYS * DAY_MS);

  const registeredWhere = { ...REAL_USER_WHERE, isGuest: false };

  const [
    registered,
    guests,
    pro,
    professors,
    arenaGranted,
    arenaMatches,
    batchRows,
    people,
    questions,
    attemptRows,
    simRows,
    attemptEvents,
    simEvents,
    arenaEvents,
    distinctPairs,
    attemptsPerUser,
  ] = await Promise.all([
    db.user.count({ where: registeredWhere }),
    db.user.count({ where: { ...REAL_USER_WHERE, isGuest: true } }),
    db.user.count({ where: { ...registeredWhere, proUntil: { gt: now } } }),
    db.user.count({ where: { ...registeredWhere, role: "professor" } }),
    db.user.count({ where: { ...registeredWhere, arenaGrantedAt: { not: null } } }),
    db.arenaMatch.count(),
    db.user.groupBy({ by: ["batch"], where: registeredWhere, _count: { _all: true } }),
    // The one row-per-person read. Everything hanging off it — return rates, the
    // quiet histogram, coverage — needs the person, not a total.
    db.user.findMany({
      where: registeredWhere,
      select: { id: true, createdAt: true, proUntil: true },
    }),
    db.question.findMany({ select: { id: true, title: true, type: true } }),
    db.attempt.groupBy({ by: ["questionId", "status"], _count: { _all: true } }),
    db.simRun.groupBy({ by: ["questionId", "phase"], _count: { _all: true } }),
    db.attempt.findMany({
      where: { createdAt: { gte: windowStart } },
      select: { userId: true, createdAt: true },
    }),
    db.simRun.findMany({
      where: { createdAt: { gte: windowStart } },
      select: { userId: true, createdAt: true },
    }),
    // A match is activity even though it is not an exercise: somebody who came
    // back to play one came back.
    db.arenaSeat.findMany({
      where: { userId: { not: null }, match: { createdAt: { gte: windowStart } } },
      select: { userId: true, match: { select: { createdAt: true } } },
    }),
    db.attempt.groupBy({ by: ["userId", "questionId"] }),
    db.attempt.groupBy({ by: ["userId"], _count: { _all: true } }),
  ]);

  const questionById = new Map(questions.map((q) => [q.id, q]));
  const practisable = new Set<string>(PRACTISABLE_TYPES);
  const librarySize = questions.filter((q) => practisable.has(q.type)).length;

  // ── Activity, folded once and read four ways ──────────────────────────────
  //
  // Read off the tables' own timestamps rather than `User.lastActiveDate`, which
  // `applyRewardCore` writes only on a completed attempt or run — so it means
  // "last finished something". Somebody who came back and opened a war room is
  // invisible to it, and that is exactly the person a return rate is about.
  const events: { userId: string; at: Date }[] = [
    ...attemptEvents.map((a) => ({ userId: a.userId, at: a.createdAt })),
    ...simEvents.map((s) => ({ userId: s.userId, at: s.createdAt })),
    ...arenaEvents.flatMap((s) =>
      s.userId ? [{ userId: s.userId, at: s.match.createdAt }] : [],
    ),
  ];

  const realIds = new Set(people.map((p) => p.id));
  const daysByUser = new Map<string, Set<string>>();
  const lastActiveByUser = new Map<string, Date>();
  for (const event of events) {
    const days = daysByUser.get(event.userId) ?? new Set<string>();
    days.add(dayKey(event.at));
    daysByUser.set(event.userId, days);
    const last = lastActiveByUser.get(event.userId);
    if (!last || event.at > last) lastActiveByUser.set(event.userId, event.at);
  }

  const attemptsByUser = new Map<string, number>();
  const distinctByUser = new Map<string, Set<string>>();
  for (const pair of distinctPairs) {
    const seen = distinctByUser.get(pair.userId) ?? new Set<string>();
    seen.add(pair.questionId);
    distinctByUser.set(pair.userId, seen);
  }

  for (const row of attemptsPerUser) {
    attemptsByUser.set(row.userId, row._count._all);
  }

  const profiles: ActivityProfile[] = people.map((p) => ({
    userId: p.id,
    createdAt: p.createdAt,
    activeDays: daysByUser.get(p.id) ?? new Set<string>(),
  }));

  // ── Practice mix ──────────────────────────────────────────────────────────
  const byType = new Map<string, { started: number; submitted: number }>();
  const byQuestion = new Map<string, { started: number; submitted: number }>();
  const bump = (
    map: Map<string, { started: number; submitted: number }>,
    key: string,
    count: number,
    finished: boolean,
  ) => {
    const row = map.get(key) ?? { started: 0, submitted: 0 };
    row.started += count;
    if (finished) row.submitted += count;
    map.set(key, row);
  };

  for (const row of attemptRows) {
    const question = questionById.get(row.questionId);
    if (!question) continue;
    const count = row._count._all;
    bump(byType, question.type, count, row.status === "submitted");
    bump(byQuestion, row.questionId, count, row.status === "submitted");
  }
  // A war room writes a SimRun rather than an Attempt, and "finished" is its
  // phase reaching the debrief — the same distinction as a submitted attempt.
  for (const row of simRows) {
    const question = questionById.get(row.questionId);
    if (!question) continue;
    const count = row._count._all;
    bump(byType, question.type, count, row.phase === "debrief");
    bump(byQuestion, row.questionId, count, row.phase === "debrief");
  }

  const topQuestions = [...byQuestion.entries()]
    .map(([id, row]) => ({
      id,
      title: questionById.get(id)?.title ?? "(removed)",
      type: questionById.get(id)?.type ?? "unknown",
      ...row,
    }))
    .sort((a, b) => b.started - a.started)
    .slice(0, TOP_QUESTIONS);

  const activeSince = (since: Date) =>
    profiles.filter((p) => {
      const last = lastActiveByUser.get(p.userId);
      return !!last && last >= since;
    }).length;

  const batchOrder = [...BATCHES.map((b) => b.id), null];
  const batchCounts = new Map<string | null, number>(
    batchRows.map((r) => [r.batch, r._count._all]),
  );

  return {
    cohort: {
      registered,
      guests,
      activeWeek: activeSince(weekAgo),
      activeMonth: activeSince(monthAgo),
      neverStarted: profiles.filter((p) => !daysByUser.has(p.userId)).length,
      pro,
      professors,
      arenaGranted,
      arenaMatches,
      batches: batchOrder.map((id) => ({
        label: batchLabel(id) ?? "No batch",
        count: batchCounts.get(id) ?? 0,
      })),
    },
    practice: {
      formats: formatMix(
        [...byType.entries()].map(([type, row]) => ({ type, ...row })),
      ),
      topQuestions,
    },
    retention: {
      returns: returnRates(profiles, now),
      weeks: activeDaysPerWeek(
        events.filter((e) => realIds.has(e.userId)),
        now,
      ),
      quiet: attemptsBeforeQuiet(
        people.map((p) => ({
          attempts: attemptsByUser.get(p.id) ?? 0,
          lastActiveAt: lastActiveByUser.get(p.id) ?? null,
        })),
        now,
      ),
      coverage: coverageBuckets(
        people.map((p) => ({
          distinct: distinctByUser.get(p.id)?.size ?? 0,
          pro: !!p.proUntil && p.proUntil > now,
        })),
        librarySize,
      ),
      librarySize,
    },
    windowDays: ACTIVITY_WINDOW_DAYS,
  };
}
