import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * What an unscored attempt does — and does not — reach.
 *
 * Teacher mode states the answer, so an attempt that used it is written with a
 * null `overall`: it happened, and there is no performance to measure. The rule
 * only means anything if every aggregate honours it, and these are the paths
 * that carry it. None of them had a test before.
 *
 * Only the database is mocked. The split between "attempted" and "measured",
 * and the achievement gating, are the real ones.
 */

const attemptFindMany = vi.fn();
const progressUpsert = vi.fn();
const userFindUnique = vi.fn();
const userUpdate = vi.fn();
const achievementFindUnique = vi.fn();
const userAchievementFindUnique = vi.fn();
const userAchievementCreate = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    attempt: { findMany: attemptFindMany },
    progress: { upsert: progressUpsert },
    user: { findUnique: userFindUnique, update: userUpdate, findMany: vi.fn() },
    achievement: { findUnique: achievementFindUnique },
    userAchievement: {
      findUnique: userAchievementFindUnique,
      create: userAchievementCreate,
    },
  },
}));

const { updateProgress } = await import("@/lib/progress");
const { applyAttemptRewards } = await import("@/lib/gamification");

/** A submitted attempt row shaped the way `updateProgress` reads it. */
const attempt = (
  overall: number | null,
  evaluation: Record<string, number | boolean | null> = {},
) => ({
  question: { categoryId: "market-sizing", type: "guesstimate" },
  evaluation: {
    overall,
    accuracyHit: false,
    structuring: 70,
    logic: 70,
    segmentation: 70,
    assumptions: 70,
    calculation: 70,
    diagnosis: null,
    communication: 70,
    business: 70,
    confidence: 70,
    ...evaluation,
  },
});

/** The last `progress.upsert` payload, which is what the dashboard reads. */
const upserted = () => progressUpsert.mock.calls.at(-1)![0].update;

describe("updateProgress with an unscored attempt", () => {
  beforeEach(() => {
    attemptFindMany.mockReset();
    progressUpsert.mockReset().mockResolvedValue(undefined);
  });

  it("still counts it as solved", async () => {
    // It was attempted and submitted. Being told the answer does not un-do the
    // sitting down, and history has to keep showing it.
    attemptFindMany.mockResolvedValue([attempt(80), attempt(null)]);
    const result = await updateProgress("me");
    expect(result.totalSolved).toBe(2);
  });

  it("keeps it out of the average", async () => {
    attemptFindMany.mockResolvedValue([attempt(80), attempt(null)]);
    const result = await updateProgress("me");
    // 80, not the 40 that averaging a null as zero would give.
    expect(result.avgScore).toBe(80);
  });

  it("keeps it out of accuracy", async () => {
    // The unscored one "hit" its range — after being shown where the range was.
    attemptFindMany.mockResolvedValue([
      attempt(80, { accuracyHit: false }),
      attempt(null, { accuracyHit: true }),
    ]);
    const result = await updateProgress("me");
    expect(result.accuracy).toBe(0);
  });

  it("keeps its categories out of the skill rollup", async () => {
    attemptFindMany.mockResolvedValue([
      attempt(80, { logic: 90 }),
      attempt(null, { logic: 10 }),
    ]);
    await updateProgress("me");
    const bySkill = JSON.parse(upserted().bySkill);
    // One contributing attempt, at its own score — the radar and the weak-areas
    // copy both read this.
    expect(bySkill.logic).toEqual({ avg: 90, count: 1 });
  });

  it("leaves the averages empty when nothing was ever scored", async () => {
    attemptFindMany.mockResolvedValue([attempt(null)]);
    const result = await updateProgress("me");
    expect(result.totalSolved).toBe(1);
    expect(result.avgScore).toBe(0);
    expect(result.consistency).toBe(0);
  });
});

describe("applyAttemptRewards for an unscored attempt", () => {
  /** Every slug the run tried to award. */
  const awarded = () => achievementFindUnique.mock.calls.map((c) => c[0].where.slug);

  beforeEach(() => {
    achievementFindUnique.mockReset().mockResolvedValue(null);
    userAchievementFindUnique.mockReset().mockResolvedValue(null);
    userAchievementCreate.mockReset().mockResolvedValue(undefined);
    userUpdate.mockReset().mockResolvedValue(undefined);
    // Practised yesterday, so this attempt is the consecutive day that advances
    // the streak — the thing an unscored attempt must still be able to do.
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    userFindUnique.mockReset().mockResolvedValue({
      id: "me",
      xp: 0,
      level: 1,
      coins: 0,
      streak: 3,
      longestStreak: 3,
      lastActiveDate: yesterday,
    });
  });

  const ctx = {
    accuracyHit: true,
    hintsUsed: 0,
    segmentationScore: 95,
    totalSolved: 12,
  };

  /**
   * The sharpest case, and the one that was live before this rule: skipping the
   * hint ladder in order to be handed the answer outright earned the badge for
   * working unaided.
   */
  it("does not award no-hints for skipping the hints and being told", async () => {
    await applyAttemptRewards("me", { ...ctx, overall: null });
    expect(awarded()).not.toContain("no-hints");
  });

  it("awards no-hints when the same attempt was actually scored", async () => {
    await applyAttemptRewards("me", { ...ctx, overall: 60 });
    expect(awarded()).toContain("no-hints");
  });

  it("withholds every achievement that claims something about performance", async () => {
    await applyAttemptRewards("me", { ...ctx, overall: null });
    const slugs = awarded();
    expect(slugs).not.toContain("interview-ready");
    expect(slugs).not.toContain("sharp-shooter");
    expect(slugs).not.toContain("mece-master");
  });

  it("still awards the ones about turning up", async () => {
    await applyAttemptRewards("me", { ...ctx, overall: null });
    const slugs = awarded();
    expect(slugs).toContain("first-attempt");
    expect(slugs).toContain("ten-solved");
    expect(slugs).toContain("streak-3");
  });

  it("still pays XP and keeps the streak", async () => {
    const result = await applyAttemptRewards("me", { ...ctx, overall: null });
    expect(result.xpGained).toBeGreaterThan(0);
    expect(result.streak).toBe(4);
  });
});
