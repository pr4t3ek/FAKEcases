import { describe, it, expect } from "vitest";
import {
  compareEntries,
  displayNameFor,
  formatEffort,
  weekStartUtc,
  dayStartUtc,
  windowFilter,
} from "@/lib/leaderboard";

/**
 * The pure half of the leaderboard. The insert-only rule that actually enforces
 * "first attempt only" lives in a database constraint, so what is testable here
 * is everything that decides ORDER and what a person is called on a board —
 * both of which are easy to invert by accident and hard to spot once shipped.
 */

describe("compareEntries", () => {
  const at = (iso: string) => new Date(iso);

  it("ranks the higher score first", () => {
    const a = { score: 80, effort: 900, achievedAt: at("2026-01-05T00:00:00Z") };
    const b = { score: 60, effort: 10, achievedAt: at("2026-01-01T00:00:00Z") };
    expect(compareEntries(a, b)).toBeLessThan(0);
  });

  it("breaks a tie on LOWER effort — the direction that is easy to invert", () => {
    const quick = { score: 70, effort: 300, achievedAt: at("2026-01-05T00:00:00Z") };
    const slow = { score: 70, effort: 3_000, achievedAt: at("2026-01-01T00:00:00Z") };
    expect(compareEntries(quick, slow)).toBeLessThan(0);
    // …and the reverse ordering is symmetric, so a sort can't be order-dependent.
    expect(compareEntries(slow, quick)).toBeGreaterThan(0);
  });

  it("breaks a remaining tie on the earlier result", () => {
    const early = { score: 70, effort: 300, achievedAt: at("2026-01-01T00:00:00Z") };
    const late = { score: 70, effort: 300, achievedAt: at("2026-01-09T00:00:00Z") };
    expect(compareEntries(early, late)).toBeLessThan(0);
  });

  it("sorts a mixed field into the expected order", () => {
    const rows = [
      { id: "c", score: 55, effort: 100, achievedAt: at("2026-01-01T00:00:00Z") },
      { id: "a", score: 91, effort: 900, achievedAt: at("2026-01-03T00:00:00Z") },
      { id: "b", score: 91, effort: 400, achievedAt: at("2026-01-04T00:00:00Z") },
    ];
    expect([...rows].sort(compareEntries).map((r) => r.id)).toEqual(["b", "a", "c"]);
  });
});

describe("weekStartUtc", () => {
  it("returns the Monday of that week at midnight UTC", () => {
    // 2026-01-08 is a Thursday.
    const start = weekStartUtc(new Date("2026-01-08T15:30:00Z"));
    expect(start.toISOString()).toBe("2026-01-05T00:00:00.000Z");
  });

  it("treats Sunday as the END of the week, not the start", () => {
    // The classic off-by-one: getUTCDay() is 0 on Sunday, so a naive shift
    // would move Sunday FORWARD into the next week.
    const sunday = weekStartUtc(new Date("2026-01-11T23:59:00Z"));
    expect(sunday.toISOString()).toBe("2026-01-05T00:00:00.000Z");
  });

  it("is idempotent — a Monday is its own week start", () => {
    const monday = new Date("2026-01-05T00:00:00Z");
    expect(weekStartUtc(monday).toISOString()).toBe(monday.toISOString());
  });
});

describe("dayStartUtc", () => {
  it("returns midnight UTC of that day", () => {
    expect(dayStartUtc(new Date("2026-01-08T15:30:00Z")).toISOString()).toBe(
      "2026-01-08T00:00:00.000Z",
    );
  });

  it("is idempotent — midnight is its own day start", () => {
    const midnight = new Date("2026-01-08T00:00:00Z");
    expect(dayStartUtc(midnight).toISOString()).toBe(midnight.toISOString());
  });

  /**
   * The daily board and the daily question must agree about when "today"
   * starts. `lib/daily-unlock.ts` keys on the UTC calendar day, so a board
   * whose day began at a different hour would rank the cohort on a mix of two
   * problems — half on yesterday's question, half on today's.
   */
  it("starts the day on the same boundary the daily unlock uses", async () => {
    const { dayKey } = await import("@/lib/daily-unlock");
    const instant = new Date("2026-01-08T23:59:59Z");
    expect(dayStartUtc(instant).toISOString().slice(0, 10)).toBe(dayKey(instant));

    const justAfter = new Date("2026-01-09T00:00:01Z");
    expect(dayStartUtc(justAfter).toISOString().slice(0, 10)).toBe(dayKey(justAfter));
  });
});

describe("windowFilter", () => {
  it("bounds the weekly board and leaves all-time unbounded", () => {
    const now = new Date("2026-01-08T15:30:00Z");
    expect(windowFilter("week", now)).toEqual({ gte: new Date("2026-01-05T00:00:00.000Z") });
    expect(windowFilter("all", now)).toBeUndefined();
  });

  it("bounds the daily board to midnight UTC", () => {
    const now = new Date("2026-01-08T15:30:00Z");
    expect(windowFilter("day", now)).toEqual({ gte: new Date("2026-01-08T00:00:00.000Z") });
  });

  /** A day is inside its week, so the daily bound is never the looser of the two. */
  it("bounds the day more tightly than the week", () => {
    const now = new Date("2026-01-08T15:30:00Z");
    const day = windowFilter("day", now)!.gte.getTime();
    const week = windowFilter("week", now)!.gte.getTime();
    expect(day).toBeGreaterThan(week);
  });
});

describe("displayNameFor", () => {
  /** A whole user, so a new field on the row cannot be forgotten in one case. */
  const who = (over: Partial<Parameters<typeof displayNameFor>[0]> = {}) =>
    displayNameFor({ name: "Ankit", batch: null, ...over });

  it("shows the first name only — never the full name", () => {
    expect(who({ name: "Ankit Sharma" }).name).toBe("Ankit");
  });

  it("carries no college — one campus, so the batch is the whole affiliation", () => {
    expect(who({ batch: "pgp1" })).toEqual({ name: "Ankit", batch: "PGP-1" });
  });

  it("resolves a batch to its short label — the years stay off the row", () => {
    expect(who({ batch: "pgp1" }).batch).toBe("PGP-1");
    expect(who({ batch: "pgp2" }).batch).toBe("PGP-2");
  });

  it("leaves the batch null rather than inventing one", () => {
    // Two real cases: an account that ranked before the field existed, and a
    // stored value that is no longer in the list. Both must render as nothing
    // rather than as "PGP-undefined".
    expect(who({ batch: null }).batch).toBeNull();
    expect(who({ batch: "pgp3" }).batch).toBeNull();
  });

  it("falls back rather than rendering an empty row", () => {
    expect(who({ name: null }).name).toBe("Learner");
    expect(who({ name: "   " }).name).toBe("Learner");
  });
});

describe("formatEffort", () => {
  it("words a simulation's tiebreak as analyst-days, singular included", () => {
    expect(formatEffort("simulation", 1)).toBe("1 analyst-day");
    expect(formatEffort("simulation", 4)).toBe("4 analyst-days");
  });

  it("words an attempt's tiebreak as minutes, never as a bare zero", () => {
    expect(formatEffort("attempt", 600)).toBe("10 min");
    expect(formatEffort("attempt", 20)).toBe("<1 min");
    expect(formatEffort("attempt", 0)).toBeNull();
  });
});
