/**
 * A sliding-window rate limiter.
 *
 * Lifted out of `app/api/feedback/route.ts`, which had grown one inline, because
 * the classroom join form needs the same thing and two hand-rolled copies of a
 * limiter is how one of them ends up with an off-by-one that nobody notices
 * until it matters.
 *
 * **In-memory, and therefore per-process.** Stated plainly rather than papered
 * over: it resets on redeploy and does not coordinate across instances, so on a
 * multi-instance deployment the effective ceiling is the limit times the
 * instance count. That is the right trade for what it protects here — a wrong
 * room password and a duplicate bug report — and the wrong one for anything
 * guarding money or credentials. The upgrade is a shared store, and the shape of
 * this interface does not change when that lands.
 *
 * The clock is injectable for the same reason `tierFor`'s is: a window that can
 * only be tested by sleeping is a window nobody tests.
 */

export interface RateLimitVerdict {
  ok: boolean;
  /** Zero when allowed. How long until the oldest hit falls out of the window. */
  retryAfterMs: number;
}

export interface RateLimiter {
  check(key: string, now?: number): RateLimitVerdict;
  /** For tests, and for a caller that wants a successful login to forgive a run of failures. */
  reset(key: string): void;
}

export function createLimiter(options: {
  windowMs: number;
  max: number;
}): RateLimiter {
  const { windowMs, max } = options;
  const hits = new Map<string, number[]>();

  return {
    check(key: string, now: number = Date.now()): RateLimitVerdict {
      const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);

      if (recent.length >= max) {
        // The window frees up when the OLDEST hit ages out, not when the newest
        // does — a refused attempt must not extend the block, or a client
        // retrying on a timer could lock itself out indefinitely.
        hits.set(key, recent);
        return { ok: false, retryAfterMs: windowMs - (now - recent[0]) };
      }

      recent.push(now);
      hits.set(key, recent);
      return { ok: true, retryAfterMs: 0 };
    },

    reset(key: string) {
      hits.delete(key);
    },
  };
}
