import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  BENCHMARK_EMAIL_DOMAIN,
  isRealUser,
  userSegment,
} from "@/lib/user-segment";

/**
 * Only the database is mocked. The segment rule, the exclusion arithmetic and
 * the chart shaping are the real ones.
 */
const userFindMany = vi.fn();
const userCount = vi.fn();
const attemptCount = vi.fn();
const evaluationAggregate = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    user: { findMany: userFindMany, count: userCount },
    attempt: { count: attemptCount },
    evaluation: { aggregate: evaluationAggregate },
  },
}));

const { loadUserAdminStats, rankDistribution, signupSeries, dayKey } = await import(
  "@/lib/admin-stats"
);

const NOW = new Date("2026-08-01T12:00:00.000Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);

/** A row shaped like what `loadUserAdminStats` asks Prisma for. */
const row = (over: Record<string, unknown> = {}) => ({
  id: Math.random().toString(36).slice(2),
  name: "Someone",
  email: "someone@example.com",
  isGuest: false,
  role: "user",
  level: 1,
  xp: 0,
  streak: 0,
  rank: null,
  lastActiveDate: null,
  createdAt: daysAgo(1),
  progress: null,
  _count: { attempts: 0 },
  ...over,
});

describe("userSegment", () => {
  it("classifies a signed-up account as registered", () => {
    expect(userSegment({ email: "a@b.com", isGuest: false })).toBe("registered");
  });

  it("classifies an anonymous visitor as a guest", () => {
    expect(userSegment({ email: null, isGuest: true })).toBe("guest");
  });

  it("classifies a seeded cohort account by its email domain", () => {
    expect(userSegment({ email: `benchmark_7${BENCHMARK_EMAIL_DOMAIN}`, isGuest: false })).toBe(
      "benchmark",
    );
    expect(userSegment({ email: `BENCHMARK_7${BENCHMARK_EMAIL_DOMAIN.toUpperCase()}`, isGuest: false })).toBe(
      "benchmark",
    );
  });

  // A guest has no email at all — the domain check must not throw on null.
  it("handles a null email", () => {
    expect(userSegment({ email: null, isGuest: false })).toBe("registered");
  });

  it("counts everything except benchmark rows as real", () => {
    expect(isRealUser({ email: "a@b.com", isGuest: false })).toBe(true);
    expect(isRealUser({ email: null, isGuest: true })).toBe(true);
    expect(isRealUser({ email: `x${BENCHMARK_EMAIL_DOMAIN}`, isGuest: false })).toBe(false);
  });
});

describe("signupSeries", () => {
  it("emits one point per day across the window, oldest first", () => {
    const series = signupSeries([], NOW, 30);
    expect(series).toHaveLength(30);
    expect(series[29].day).toBe(dayKey(NOW));
    expect(series[0].day).toBe(dayKey(daysAgo(29)));
  });

  /**
   * Zero-filling is the point: plotting only the days that had signups draws a
   * flat line through a quiet fortnight and reads as steady growth.
   */
  it("keeps quiet days at zero rather than omitting them", () => {
    // A 5-day window runs [4, 3, 2, 1, 0] days ago, so the lone signup 3 days
    // back lands at index 1 and today's two at index 4.
    const series = signupSeries([daysAgo(0), daysAgo(0), daysAgo(3)], NOW, 5);
    expect(series.map((s) => s.count)).toEqual([0, 1, 0, 0, 2]);
  });

  it("ignores signups older than the window", () => {
    const series = signupSeries([daysAgo(400)], NOW, 30);
    expect(series.reduce((sum, s) => sum + s.count, 0)).toBe(0);
  });

  it("buckets on the UTC day", () => {
    const series = signupSeries([new Date("2026-08-01T23:59:00.000Z")], NOW, 2);
    expect(series.find((s) => s.day === "2026-08-01")?.count).toBe(1);
  });
});

describe("rankDistribution", () => {
  // A distribution that only lists occupied bands changes shape as people move
  // between them, which makes two screenshots impossible to compare.
  it("includes every band even when empty, in ladder order", () => {
    expect(rankDistribution([]).map((r) => r.rank)).toEqual([
      "Unranked",
      "Silver",
      "Gold",
      "Platinum",
      "Diamond",
    ]);
    expect(rankDistribution([]).every((r) => r.count === 0)).toBe(true);
  });

  it("counts a null rank as Unranked", () => {
    const dist = rankDistribution([null, null, "Gold"]);
    expect(dist.find((r) => r.rank === "Unranked")?.count).toBe(2);
    expect(dist.find((r) => r.rank === "Gold")?.count).toBe(1);
  });
});

describe("loadUserAdminStats", () => {
  beforeEach(() => {
    userFindMany.mockReset().mockResolvedValue([]);
    userCount.mockReset().mockResolvedValue(0);
    attemptCount.mockReset().mockResolvedValue(0);
    evaluationAggregate.mockReset().mockResolvedValue({ _avg: { overall: null } });
  });

  /**
   * The whole reason this module exists. A fresh install has 40 synthetic rows
   * against two real accounts; reporting 42 users would be off by twenty times.
   */
  it("excludes benchmark accounts from the headline counts", async () => {
    userFindMany.mockResolvedValue([
      ...Array.from({ length: 40 }, (_, i) =>
        row({ email: `benchmark_${i}${BENCHMARK_EMAIL_DOMAIN}` }),
      ),
      row({ email: "admin@caseclosed.app" }),
      row({ email: "demo@caseclosed.app" }),
      row({ email: null, isGuest: true }),
    ]);

    const stats = await loadUserAdminStats(NOW);
    expect(stats.registered).toBe(2);
    expect(stats.guests).toBe(1);
    expect(stats.benchmark).toBe(40);
    // Still returned, so the rank population stays auditable behind the filter.
    expect(stats.users).toHaveLength(43);
  });

  it("keeps benchmark rows out of the rank distribution", async () => {
    userFindMany.mockResolvedValue([
      ...Array.from({ length: 40 }, (_, i) =>
        row({ email: `benchmark_${i}${BENCHMARK_EMAIL_DOMAIN}`, rank: null }),
      ),
      row({ email: "a@b.com", rank: "Gold" }),
    ]);

    const stats = await loadUserAdminStats(NOW);
    expect(stats.ranks.find((r) => r.rank === "Unranked")?.count).toBe(0);
    expect(stats.ranks.find((r) => r.rank === "Gold")?.count).toBe(1);
  });

  it("counts recent activity on a seven-day window", async () => {
    userFindMany.mockResolvedValue([
      row({ email: "recent@b.com", lastActiveDate: daysAgo(2), createdAt: daysAgo(2) }),
      row({ email: "stale@b.com", lastActiveDate: daysAgo(30), createdAt: daysAgo(90) }),
      row({ email: "never@b.com", lastActiveDate: null, createdAt: daysAgo(90) }),
    ]);

    const stats = await loadUserAdminStats(NOW);
    expect(stats.practisedRecently).toBe(1);
    expect(stats.newRecently).toBe(1);
  });

  /**
   * Progress rows exist before anything is graded, with avgScore defaulting to
   * 0 — which means "nothing scored yet", not "scored zero".
   */
  it("reports no average for a user with no graded attempts", async () => {
    userFindMany.mockResolvedValue([
      row({ progress: { avgScore: 0, totalSolved: 0 } }),
      row({ progress: { avgScore: 74.4, totalSolved: 3 } }),
    ]);

    const stats = await loadUserAdminStats(NOW);
    expect(stats.users[0].avgScore).toBe(null);
    expect(stats.users[1].avgScore).toBe(74);
  });

  it("reports no platform average before any evaluation exists", async () => {
    const stats = await loadUserAdminStats(NOW);
    expect(stats.avgScore).toBe(null);
  });

  it("flags a truncated list when the cap bites", async () => {
    userFindMany.mockResolvedValue([row()]);
    userCount.mockResolvedValue(900);
    const stats = await loadUserAdminStats(NOW);
    expect(stats.truncated).toBe(true);
  });
});
