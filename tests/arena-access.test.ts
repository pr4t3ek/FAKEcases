import { describe, expect, it } from "vitest";
import { canPlayArena } from "@/lib/arena/access";

/**
 * The gate.
 *
 * `canPlayArena` is called by the nav to decide whether to render the link and
 * by every arena server action to decide whether to honour it. That is the
 * invariant worth pinning: the two must never be able to disagree, which is
 * only true while there is exactly one function and it is pure.
 */
describe("canPlayArena", () => {
  const granted = { arenaGrantedAt: new Date("2026-01-01"), isGuest: false };

  it("lets a granted account in", () => {
    expect(canPlayArena(granted)).toBe(true);
  });

  it("refuses an account nobody granted", () => {
    expect(canPlayArena({ arenaGrantedAt: null, isGuest: false })).toBe(false);
  });

  it("refuses a guest even when the column says otherwise", () => {
    // A guest session evaporates. Handing one a seat would leave a human match
    // a firm short and lose the guest the fifteen minutes they had just spent.
    expect(canPlayArena({ ...granted, isGuest: true })).toBe(false);
  });

  it("refuses nobody at all", () => {
    expect(canPlayArena(null)).toBe(false);
    expect(canPlayArena(undefined)).toBe(false);
  });

  it("does not care how old the grant is", () => {
    // Unlike `proUntil`, this is not a deadline. If it ever becomes one, this
    // test is what will notice.
    expect(canPlayArena({ arenaGrantedAt: new Date("2000-01-01"), isGuest: false })).toBe(true);
  });
});
