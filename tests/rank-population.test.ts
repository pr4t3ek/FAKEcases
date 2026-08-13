import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Who counts as "everyone else" when a percentile is computed.
 *
 * Only the database is mocked — the population filter and the percentile
 * arithmetic are the real ones.
 */
const attemptFindMany = vi.fn();
const userFindMany = vi.fn();
const userUpdate = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    attempt: { findMany: attemptFindMany },
    user: { findMany: userFindMany, update: userUpdate },
    progress: { upsert: vi.fn() },
  },
}));

const { recomputeRank } = await import("@/lib/progress");

/** Enough graded attempts to clear placement, all at the same score. */
const gradedAt = (overall: number, count = 6) =>
  Array.from({ length: count }, () => ({ evaluation: { overall } }));

describe("recomputeRank population", () => {
  beforeEach(() => {
    attemptFindMany.mockReset().mockResolvedValue(gradedAt(80));
    userFindMany.mockReset().mockResolvedValue([]);
    userUpdate.mockReset().mockResolvedValue(undefined);
  });

  /**
   * Every visitor who clicks "Start practising" gets a real User row, and those
   * rows are transient. If they counted, a candidate's rank would track drive-by
   * traffic rather than anyone's skill.
   */
  it("excludes guests from the comparison set", async () => {
    await recomputeRank("me");
    expect(userFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isGuest: false }),
      }),
    );
  });

  /**
   * An attempt Teacher mode walked through has an evaluation and no overall. It
   * must reach neither the skill rating nor the placement counter, and the
   * filter has to be in the query rather than at the submit call site: this
   * recomputes over the whole history, so a later cold attempt would otherwise
   * pull the revealed one back in.
   */
  it("counts only attempts that were actually scored", async () => {
    await recomputeRank("me");
    expect(attemptFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          evaluation: { is: { overall: { not: null } } },
        }),
      }),
    );
  });

  it("excludes the user being ranked from their own population", async () => {
    await recomputeRank("me");
    expect(userFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { not: "me" } }),
      }),
    );
  });

  it("computes the percentile from the returned population", async () => {
    userFindMany.mockResolvedValue([
      { skillRating: 10 },
      { skillRating: 20 },
      { skillRating: 30 },
      { skillRating: 95 },
    ]);
    const { percentile } = await recomputeRank("me");
    // Three of the four sit below a rating built from straight 80s.
    expect(percentile).toBe(75);
  });

  it("puts a lone ranked user at the midpoint rather than the top", async () => {
    userFindMany.mockResolvedValue([]);
    const { percentile } = await recomputeRank("me");
    expect(percentile).toBe(50);
  });

  // Placement exists so a single lucky attempt can't mint a Diamond.
  it("leaves a user unranked until they have enough graded attempts", async () => {
    attemptFindMany.mockResolvedValue(gradedAt(95, 1));
    const { rank } = await recomputeRank("me");
    expect(rank).toBe("Unranked");
    expect(userUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ rank: null }) }),
    );
  });
});
