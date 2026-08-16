import { describe, expect, it } from "vitest";
import { createLimiter } from "@/lib/rate-limit";

const WINDOW = 60_000;
const T0 = 1_000_000;

describe("createLimiter", () => {
  it("allows up to the cap inside the window", () => {
    const limiter = createLimiter({ windowMs: WINDOW, max: 3 });
    expect(limiter.check("k", T0).ok).toBe(true);
    expect(limiter.check("k", T0 + 1).ok).toBe(true);
    expect(limiter.check("k", T0 + 2).ok).toBe(true);
  });

  it("refuses the one past the cap", () => {
    const limiter = createLimiter({ windowMs: WINDOW, max: 3 });
    for (let i = 0; i < 3; i++) limiter.check("k", T0 + i);
    expect(limiter.check("k", T0 + 3).ok).toBe(false);
  });

  it("lets the window roll off", () => {
    const limiter = createLimiter({ windowMs: WINDOW, max: 2 });
    limiter.check("k", T0);
    limiter.check("k", T0 + 1);
    expect(limiter.check("k", T0 + 2).ok).toBe(false);
    // Both hits are now older than the window.
    expect(limiter.check("k", T0 + WINDOW + 1).ok).toBe(true);
  });

  it("rolls off one hit at a time, not all at once", () => {
    const limiter = createLimiter({ windowMs: WINDOW, max: 2 });
    limiter.check("k", T0);
    limiter.check("k", T0 + 30_000);
    // The first has aged out, the second has not, so exactly one slot is free.
    expect(limiter.check("k", T0 + WINDOW + 1).ok).toBe(true);
    expect(limiter.check("k", T0 + WINDOW + 2).ok).toBe(false);
  });

  /**
   * A refused attempt must not extend the block. If it did, a client retrying
   * on a timer faster than the window would lock itself out forever — which is
   * exactly what a student mistyping a room password does.
   */
  it("does not let a refused attempt push the window forward", () => {
    const limiter = createLimiter({ windowMs: WINDOW, max: 1 });
    limiter.check("k", T0);
    for (let t = T0 + 1; t < T0 + WINDOW; t += 1000) {
      expect(limiter.check("k", t).ok).toBe(false);
    }
    // Still frees up on the original hit's schedule, despite 59 refusals.
    expect(limiter.check("k", T0 + WINDOW + 1).ok).toBe(true);
  });

  it("reports how long until a slot frees up", () => {
    const limiter = createLimiter({ windowMs: WINDOW, max: 1 });
    limiter.check("k", T0);
    const verdict = limiter.check("k", T0 + 10_000);
    expect(verdict.ok).toBe(false);
    // Measured from the OLDEST hit ageing out.
    expect(verdict.retryAfterMs).toBe(WINDOW - 10_000);
  });

  it("reports zero wait when it allows the request", () => {
    const limiter = createLimiter({ windowMs: WINDOW, max: 1 });
    expect(limiter.check("k", T0).retryAfterMs).toBe(0);
  });

  it("keeps keys independent", () => {
    // One student mistyping their password must not lock out the rest of the
    // lecture hall.
    const limiter = createLimiter({ windowMs: WINDOW, max: 1 });
    expect(limiter.check("ana", T0).ok).toBe(true);
    expect(limiter.check("ana", T0 + 1).ok).toBe(false);
    expect(limiter.check("bea", T0 + 1).ok).toBe(true);
  });

  it("forgives a key on reset", () => {
    const limiter = createLimiter({ windowMs: WINDOW, max: 1 });
    limiter.check("k", T0);
    expect(limiter.check("k", T0 + 1).ok).toBe(false);
    limiter.reset("k");
    expect(limiter.check("k", T0 + 2).ok).toBe(true);
  });

  it("resets one key without touching another", () => {
    const limiter = createLimiter({ windowMs: WINDOW, max: 1 });
    limiter.check("ana", T0);
    limiter.check("bea", T0);
    limiter.reset("ana");
    expect(limiter.check("ana", T0 + 1).ok).toBe(true);
    expect(limiter.check("bea", T0 + 1).ok).toBe(false);
  });

  it("defaults to the real clock", () => {
    const limiter = createLimiter({ windowMs: WINDOW, max: 1 });
    expect(limiter.check("k").ok).toBe(true);
    expect(limiter.check("k").ok).toBe(false);
  });
});
