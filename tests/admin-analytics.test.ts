import { describe, expect, it, vi, beforeEach } from "vitest";
import { BENCHMARK_EMAIL_DOMAIN } from "@/lib/user-segment";

/**
 * The cohort panel's arithmetic.
 *
 * Only the database is mocked; every rule below — eligibility, the later-day
 * test, the buckets and the two tables the practice mix is folded from — is the
 * real one. Same posture as `admin-stats.test.ts` next door, and for the same
 * reason: these numbers are read as findings, so the shaping is the thing worth
 * pinning.
 */

const userCount = vi.fn();
const userGroupBy = vi.fn();
const userFindMany = vi.fn();
const questionFindMany = vi.fn();
const attemptGroupBy = vi.fn();
const attemptFindMany = vi.fn();
const simRunGroupBy = vi.fn();
const simRunFindMany = vi.fn();
const arenaMatchCount = vi.fn();
const arenaSeatFindMany = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    user: { count: userCount, groupBy: userGroupBy, findMany: userFindMany },
    question: { findMany: questionFindMany },
    attempt: { groupBy: attemptGroupBy, findMany: attemptFindMany },
    simRun: { groupBy: simRunGroupBy, findMany: simRunFindMany },
    arenaMatch: { count: arenaMatchCount },
    arenaSeat: { findMany: arenaSeatFindMany },
  },
}));

const {
  REAL_USER_WHERE,
  activeDaysPerWeek,
  attemptsBeforeQuiet,
  coverageBuckets,
  formatMix,
  loadAdminAnalytics,
  returnRates,
} = await import("@/lib/admin-analytics");

const NOW = new Date("2026-08-20T12:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(NOW.getTime() - n * DAY);

const person = (createdAt: Date, days: string[] = []) => ({
  userId: Math.random().toString(36).slice(2),
  createdAt,
  activeDays: new Set(days),
});

describe("returnRates", () => {
  it("only counts accounts old enough for the window to have closed", () => {
    // Joined yesterday: D1 can be answered, D7 cannot.
    const [d1, d7] = returnRates([person(daysAgo(1))], NOW, [1, 7]);
    expect(d1.eligible).toBe(1);
    expect(d7.eligible).toBe(0);
  });

  it("does not count the signup session itself as a return", () => {
    const joined = daysAgo(10);
    const sameDayOnly = person(joined, [joined.toISOString().slice(0, 10)]);
    expect(returnRates([sameDayOnly], NOW, [7])[0].returned).toBe(0);
  });

  it("counts a later day inside the window and ignores one past it", () => {
    const joined = daysAgo(40);
    const key = (n: number) =>
      new Date(joined.getTime() + n * DAY).toISOString().slice(0, 10);
    const returnedOnDay3 = person(joined, [key(0), key(3)]);
    const returnedOnDay20 = person(joined, [key(0), key(20)]);

    const [d7, d30] = returnRates([returnedOnDay3, returnedOnDay20], NOW, [7, 30]);
    expect(d7).toEqual({ window: 7, eligible: 2, returned: 1 });
    expect(d30).toEqual({ window: 30, eligible: 2, returned: 2 });
  });

  it("counts a person once however many times they came back", () => {
    const joined = daysAgo(40);
    const key = (n: number) =>
      new Date(joined.getTime() + n * DAY).toISOString().slice(0, 10);
    const keen = person(joined, [key(0), key(1), key(2), key(3)]);
    expect(returnRates([keen], NOW, [7])[0].returned).toBe(1);
  });
});

describe("activeDaysPerWeek", () => {
  it("keeps the weeks nobody turned up in", () => {
    const weeks = activeDaysPerWeek([], NOW, 8);
    expect(weeks).toHaveLength(8);
    expect(weeks.every((w) => w.activeUsers === 0 && w.avgActiveDays === 0)).toBe(true);
  });

  it("counts distinct days per person, not events", () => {
    // Two events on one day and one on another: two days, one person.
    const at = (iso: string) => new Date(iso);
    const weeks = activeDaysPerWeek(
      [
        { userId: "a", at: at("2026-08-17T09:00:00.000Z") },
        { userId: "a", at: at("2026-08-17T19:00:00.000Z") },
        { userId: "a", at: at("2026-08-19T09:00:00.000Z") },
        { userId: "b", at: at("2026-08-19T09:00:00.000Z") },
      ],
      NOW,
      2,
    );
    const current = weeks.at(-1)!;
    expect(current.activeUsers).toBe(2);
    // a: 2 days, b: 1 day → 1.5
    expect(current.avgActiveDays).toBe(1.5);
  });
});

describe("attemptsBeforeQuiet", () => {
  const quiet = (attempts: number) => ({ attempts, lastActiveAt: daysAgo(30) });

  it("ignores accounts that never started and ones still active", () => {
    const result = attemptsBeforeQuiet(
      [
        { attempts: 0, lastActiveAt: null },
        { attempts: 4, lastActiveAt: daysAgo(1) },
        quiet(2),
      ],
      NOW,
    );
    expect(result.quietPeople).toBe(1);
    expect(result.buckets.find((b) => b.label === "2–3")!.count).toBe(1);
  });

  it("names the modal bucket, which is what the memo reads", () => {
    const result = attemptsBeforeQuiet([quiet(1), quiet(1), quiet(9)], NOW);
    expect(result.modal).toBe("1");
  });

  it("has no mode when nobody has gone quiet", () => {
    expect(attemptsBeforeQuiet([], NOW).modal).toBeNull();
  });
});

describe("coverageBuckets", () => {
  it("splits Pro from free, because only Pro reaches the whole library", () => {
    const rows = coverageBuckets(
      [
        { distinct: 1, pro: false },
        { distinct: 9, pro: true },
      ],
      10,
    );
    expect(rows.find((r) => r.label === "<20%")!.free).toBe(1);
    expect(rows.find((r) => r.label === "80%+")!.pro).toBe(1);
  });

  it("marks the bands past the exhaustion threshold", () => {
    const rows = coverageBuckets([], 10);
    expect(rows.filter((r) => r.exhausted).map((r) => r.label)).toEqual(["60–80%", "80%+"]);
  });

  it("does not divide by an empty library", () => {
    const rows = coverageBuckets([{ distinct: 3, pro: true }], 0);
    expect(rows.every((r) => r.pro === 0 && r.free === 0)).toBe(true);
  });
});

describe("formatMix", () => {
  it("lists every practisable type, including the untouched ones", () => {
    const rows = formatMix([{ type: "guesstimate", started: 4, submitted: 3 }]);
    expect(rows.map((r) => r.type)).toEqual(["guesstimate", "qualitative", "simulation"]);
    expect(rows[0].completion).toBe(75);
    expect(rows[1]).toMatchObject({ started: 0, submitted: 0, completion: 0 });
  });
});

describe("the real-user filter", () => {
  // In SQL, NOT (email LIKE '…') is NULL for a guest, who has no email — so the
  // obvious one-clause filter silently reports zero guests.
  it("keeps rows with no email at all", () => {
    expect(REAL_USER_WHERE.OR).toEqual([
      { email: null },
      { NOT: { email: { endsWith: BENCHMARK_EMAIL_DOMAIN } } },
    ]);
    expect(REAL_USER_WHERE.deletedAt).toBeNull();
  });
});

describe("loadAdminAnalytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userCount.mockResolvedValue(0);
    arenaMatchCount.mockResolvedValue(0);
    userGroupBy.mockResolvedValue([]);
    userFindMany.mockResolvedValue([]);
    questionFindMany.mockResolvedValue([]);
    attemptFindMany.mockResolvedValue([]);
    simRunFindMany.mockResolvedValue([]);
    arenaSeatFindMany.mockResolvedValue([]);
    attemptGroupBy.mockResolvedValue([]);
    simRunGroupBy.mockResolvedValue([]);
  });

  it("counts a war room's runs into the mix, and calls a debrief finished", async () => {
    questionFindMany.mockResolvedValue([
      { id: "q1", title: "Umbrellas", type: "guesstimate" },
      { id: "q2", title: "Kadak Coffee", type: "simulation" },
    ]);
    attemptGroupBy.mockImplementation(async ({ by }: { by: string[] }) =>
      by.includes("status")
        ? [
            { questionId: "q1", status: "submitted", _count: { _all: 3 } },
            { questionId: "q1", status: "in_progress", _count: { _all: 1 } },
          ]
        : [],
    );
    simRunGroupBy.mockResolvedValue([
      { questionId: "q2", phase: "debrief", _count: { _all: 2 } },
      { questionId: "q2", phase: "investigate", _count: { _all: 2 } },
    ]);

    const { practice } = await loadAdminAnalytics(NOW);
    const guesstimates = practice.formats.find((f) => f.type === "guesstimate")!;
    const warRooms = practice.formats.find((f) => f.type === "simulation")!;

    expect(guesstimates).toMatchObject({ started: 4, submitted: 3, completion: 75 });
    // A run that has not reached the debrief is started but not finished.
    expect(warRooms).toMatchObject({ started: 4, submitted: 2, completion: 50 });
    expect(practice.topQuestions[0].title).toBeTypeOf("string");
  });

  it("reads activity off the tables rather than off lastActiveDate", async () => {
    userFindMany.mockResolvedValue([
      { id: "u1", createdAt: daysAgo(40), proUntil: null },
      { id: "u2", createdAt: daysAgo(40), proUntil: null },
    ]);
    // u1 only ever opened war rooms — no attempt, and nothing submitted, so
    // `lastActiveDate` would never have been written for them. One run two days
    // after signing up, one this week.
    simRunFindMany.mockResolvedValue([
      { userId: "u1", createdAt: daysAgo(38) },
      { userId: "u1", createdAt: daysAgo(2) },
    ]);

    const { cohort, retention } = await loadAdminAnalytics(NOW);
    expect(cohort.activeWeek).toBe(1);
    expect(cohort.neverStarted).toBe(1);
    expect(retention.returns.find((r) => r.window === 7)!.returned).toBe(1);
  });
});
