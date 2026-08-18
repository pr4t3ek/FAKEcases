import { describe, it, expect, vi } from "vitest";

/**
 * The daily rotation.
 *
 * `pickDailyIndex` is the whole of the interesting behaviour and it is pure, so
 * it is tested directly. What these pin is the property the feature rests on:
 * the day's question is DERIVED from the date, not stored — so it is the same on
 * every server, after every restart, for every student, with no job having run.
 *
 * The database is mocked only because importing the module pulls Prisma in.
 */
vi.mock("@/lib/db", () => ({
  db: {
    dailyUnlock: { findUnique: vi.fn(), findMany: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
    question: { findMany: vi.fn() },
  },
}));

const { pickDailyIndex, dayKey } = await import("@/lib/daily-unlock");

/** The day `n` days after a fixed start, as the module's key format. */
const dayAfter = (n: number) =>
  new Date(Date.UTC(2026, 7, 18) + n * 86_400_000).toISOString().slice(0, 10);

describe("pickDailyIndex", () => {
  /**
   * The property that replaces a cron job: ask twice, get the same answer, so
   * nothing has to be written down.
   */
  it("is stable for a given day", () => {
    expect(pickDailyIndex("2026-08-18", 24)).toBe(pickDailyIndex("2026-08-18", 24));
  });

  it("advances by one each day", () => {
    const a = pickDailyIndex(dayAfter(0), 24);
    expect(pickDailyIndex(dayAfter(1), 24)).toBe((a + 1) % 24);
    expect(pickDailyIndex(dayAfter(2), 24)).toBe((a + 2) % 24);
  });

  /**
   * Twenty-four guesstimates should take twenty-four days to come round again.
   * A rotation that repeats early wastes the library it exists to pace.
   */
  it("uses every question before repeating one", () => {
    const seen = new Set(Array.from({ length: 24 }, (_, i) => pickDailyIndex(dayAfter(i), 24)));
    expect(seen.size).toBe(24);
  });

  it("wraps to the start after a full cycle", () => {
    expect(pickDailyIndex(dayAfter(24), 24)).toBe(pickDailyIndex(dayAfter(0), 24));
  });

  /**
   * A fresh install has no questions of a type until it is seeded, and `% 0` is
   * NaN — a value that fails somewhere else entirely, several layers from here.
   */
  it("reports no pick rather than NaN for an empty pool", () => {
    expect(pickDailyIndex("2026-08-18", 0)).toBe(-1);
    expect(pickDailyIndex("2026-08-18", -3)).toBe(-1);
  });

  it("handles a pool of one", () => {
    expect(pickDailyIndex("2026-08-18", 1)).toBe(0);
  });

  /** Never a negative index, whatever it is handed. */
  it("returns no pick for an unparseable day", () => {
    expect(pickDailyIndex("not-a-date", 24)).toBe(-1);
  });

  it("never returns an index outside the pool", () => {
    for (let i = 0; i < 400; i++) {
      const index = pickDailyIndex(dayAfter(i), 7);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(7);
    }
  });
});

describe("dayKey", () => {
  it("is the UTC calendar day", () => {
    expect(dayKey(new Date("2026-08-18T23:59:59Z"))).toBe("2026-08-18");
    expect(dayKey(new Date("2026-08-19T00:00:01Z"))).toBe("2026-08-19");
  });

  /**
   * Stored as a UTC day on purpose. A local-time key would give two students in
   * different timezones different "todays", and the cohort's shared question is
   * the entire point.
   */
  it("does not shift with the local clock", () => {
    expect(dayKey(new Date("2026-08-18T18:30:00Z"))).toBe("2026-08-18");
  });
});
