import { describe, expect, it } from "vitest";
import { PRO_PASS_DAYS, hasActivePro, nextProUntil, proDaysRemaining } from "@/lib/billing";

const NOW = new Date("2026-08-06T12:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;
const inDays = (n: number) => new Date(NOW.getTime() + n * DAY);

describe("nextProUntil", () => {
  it("starts from now when there is no pass", () => {
    expect(nextProUntil(null, 30, NOW)).toEqual(inDays(30));
  });

  /**
   * The bug this closes. Resetting to now+30 on a renewal quietly confiscates
   * whatever was left, on precisely the action the buyer is watching — and it
   * is the kind of thing nobody reports, because the date only looks slightly
   * wrong.
   */
  it("adds to a live pass instead of resetting it", () => {
    expect(nextProUntil(inDays(10), 30, NOW)).toEqual(inDays(40));
  });

  it("starts from now again once a pass has lapsed", () => {
    // Nothing left to add to, so yesterday's expiry must not drag the new pass
    // backwards.
    expect(nextProUntil(inDays(-5), 30, NOW)).toEqual(inDays(30));
  });

  it("treats a pass expiring exactly now as lapsed", () => {
    expect(nextProUntil(NOW, 30, NOW)).toEqual(inDays(30));
  });

  it("handles an undefined pass the same as a null one", () => {
    expect(nextProUntil(undefined, 90, NOW)).toEqual(inDays(90));
  });

  it("stacks repeated grants", () => {
    let until = nextProUntil(null, 30, NOW);
    until = nextProUntil(until, 30, NOW);
    until = nextProUntil(until, 30, NOW);
    expect(until).toEqual(inDays(90));
  });
});

describe("proDaysRemaining", () => {
  it("reports nothing for an account that never had a pass", () => {
    expect(proDaysRemaining(null, NOW)).toBe(0);
  });

  it("reports nothing for a lapsed pass rather than a negative number", () => {
    expect(proDaysRemaining(inDays(-3), NOW)).toBe(0);
  });

  it("counts a whole day as one day", () => {
    expect(proDaysRemaining(inDays(1), NOW)).toBe(1);
  });

  it("rounds a part-day up, because eighteen hours left is not zero days", () => {
    const eighteenHours = new Date(NOW.getTime() + 18 * 60 * 60 * 1000);
    expect(proDaysRemaining(eighteenHours, NOW)).toBe(1);
  });

  it("counts a long pass in whole days", () => {
    expect(proDaysRemaining(inDays(30), NOW)).toBe(30);
  });
});

describe("hasActivePro", () => {
  it("agrees with proDaysRemaining about what counts as active", () => {
    for (const at of [null, inDays(-1), NOW, inDays(1), inDays(90)]) {
      expect(hasActivePro(at, NOW)).toBe(proDaysRemaining(at, NOW) > 0);
    }
  });
});

describe("PRO_PASS_DAYS", () => {
  it("offers lengths that are all positive whole days", () => {
    for (const days of PRO_PASS_DAYS) {
      expect(Number.isInteger(days)).toBe(true);
      expect(days).toBeGreaterThan(0);
    }
  });
});
