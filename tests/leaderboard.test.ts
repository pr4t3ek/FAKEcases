import { describe, it, expect } from "vitest";
import {
  compareEntries,
  displayNameFor,
  formatEffort,
  weekStartUtc,
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

describe("windowFilter", () => {
  it("bounds the weekly board and leaves all-time unbounded", () => {
    const now = new Date("2026-01-08T15:30:00Z");
    expect(windowFilter("week", now)).toEqual({ gte: new Date("2026-01-05T00:00:00.000Z") });
    expect(windowFilter("all", now)).toBeUndefined();
  });
});

describe("displayNameFor", () => {
  it("shows the first name only — never the full name", () => {
    expect(displayNameFor({ name: "Ankit Sharma", collegeId: null }).name).toBe("Ankit");
  });

  it("resolves a known college to its label", () => {
    const { college } = displayNameFor({ name: "Ankit", collegeId: "iim-bangalore" });
    expect(college).toBe("IIM Bangalore");
  });

  it("shows no affiliation for an unlisted college", () => {
    // "Other" is stored as a null id and grouped with nobody, so there is
    // nothing honest to print beside the name.
    expect(displayNameFor({ name: "Ankit", collegeId: null }).college).toBeNull();
    expect(displayNameFor({ name: "Ankit", collegeId: "not-a-real-id" }).college).toBeNull();
  });

  it("falls back rather than rendering an empty row", () => {
    expect(displayNameFor({ name: null, collegeId: null }).name).toBe("Learner");
    expect(displayNameFor({ name: "   ", collegeId: null }).name).toBe("Learner");
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
