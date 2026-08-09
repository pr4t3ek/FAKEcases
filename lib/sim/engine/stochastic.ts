/**
 * Randomness that can be replayed.
 *
 * The rest of `lib/sim` promises determinism outright — see the header of
 * `lib/sim/drivers.ts`, "No `Math.random`, no `Date.now()`" — because a
 * student's pinned report must read the same next month as it did the day they
 * played it. This module does not break that promise, it moves it: every draw
 * comes from a generator threaded explicitly through the call, and the seed is
 * stored on the run. Same seed, same numbers, forever.
 *
 * So there is no module-level generator and no default seed. A caller that
 * wants a draw must produce an `Rng`, which means a test can always reproduce
 * one and the debrief can always rebuild a run from its journal.
 *
 * Nothing here knows what it is simulating. Parameters arrive from a config.
 */

/** A stream of uniforms in [0,1). Stateful by design — order of calls matters. */
export interface Rng {
  next(): number;
  /** Draws taken so far. The journal records this so a step can be located. */
  readonly count: number;
}

/**
 * mulberry32 over an FNV-1a hash of the seed string.
 *
 * `seededRandom` in `lib/utils.ts` is the same hash but returns ONE number for a
 * string — fine for picking a mock reply, useless as a stream. This keeps the
 * hash (so seeds look familiar) and adds the state a sequence needs.
 */
export function createRng(seed: string): Rng {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let state = h >>> 0;
  let count = 0;

  return {
    next() {
      count += 1;
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    get count() {
      return count;
    },
  };
}

/**
 * Standard normal by Box–Muller.
 *
 * The uniform is nudged off zero because `Math.log(0)` is −Infinity, and one
 * such draw would poison every downstream number in the run rather than fail
 * loudly.
 */
export function standardNormal(rng: Rng): number {
  const u = Math.max(rng.next(), Number.EPSILON);
  const v = rng.next();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function normalDraw(rng: Rng, mean: number, sd: number): number {
  return mean + sd * standardNormal(rng);
}

/**
 * Lognormal, parameterised by the MEDIAN rather than by `mu`.
 *
 * Deliberate: a config author writing a lead time knows "usually about 14 days",
 * not "mu = 2.64". `median * exp(sigma * z)` says that directly, and the right
 * tail — the one a port strike lives in — comes out of `sigma`.
 */
export function lognormalDraw(rng: Rng, median: number, sigma: number): number {
  return median * Math.exp(sigma * standardNormal(rng));
}

/** Gamma via Marsaglia–Tsang, the building block for Beta. */
function gammaDraw(rng: Rng, shape: number): number {
  if (shape < 1) {
    // Johnk's boost for shape < 1, so the caller never has to care.
    return gammaDraw(rng, shape + 1) * Math.pow(Math.max(rng.next(), Number.EPSILON), 1 / shape);
  }
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  // Bounded rather than `while (true)`: acceptance is ~95% per pass, so 1000
  // failures means the parameters are broken and looping forever would hang a
  // request instead of saying so.
  for (let i = 0; i < 1000; i++) {
    const z = standardNormal(rng);
    const v = Math.pow(1 + c * z, 3);
    if (v <= 0) continue;
    const u = rng.next();
    if (Math.log(Math.max(u, Number.EPSILON)) < 0.5 * z * z + d - d * v + d * Math.log(v)) {
      return d * v;
    }
  }
  throw new Error(`gammaDraw failed to converge for shape ${shape}`);
}

/**
 * Beta on (0,1) — the natural shape for a yield or any other proportion,
 * because it cannot wander outside the interval the way a clipped normal can.
 */
export function betaDraw(rng: Rng, alpha: number, beta: number): number {
  const x = gammaDraw(rng, alpha);
  const y = gammaDraw(rng, beta);
  const sum = x + y;
  return sum === 0 ? 0.5 : x / sum;
}

/**
 * One step of a hidden Markov chain.
 *
 * `transitionMatrix[i][j]` is P(next = j | current = i). Rows are normalised on
 * the way through rather than trusted, so a config that writes 0.7/0.2/0.05 by
 * hand still behaves like a distribution instead of quietly biasing the last
 * state.
 */
export function hmmStep(rng: Rng, current: number, transitionMatrix: number[][]): number {
  const row = transitionMatrix[current];
  if (!row?.length) throw new Error(`No transition row for regime ${current}`);

  const total = row.reduce((s, p) => s + Math.max(0, p), 0);
  if (total <= 0) throw new Error(`Transition row ${current} sums to zero`);

  const u = rng.next() * total;
  let cumulative = 0;
  for (let j = 0; j < row.length; j++) {
    cumulative += Math.max(0, row[j]);
    if (u < cumulative) return j;
  }
  return row.length - 1;
}

/**
 * Lower-triangular Cholesky factor. Throws on a matrix that is not positive
 * definite, which is an authoring error in a config rather than a runtime event.
 */
export function cholesky(cov: number[][]): number[][] {
  const n = cov.length;
  const L: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = 0;
      for (let k = 0; k < j; k++) sum += L[i][k] * L[j][k];

      if (i === j) {
        const d = cov[i][i] - sum;
        if (d <= 0) {
          throw new Error(`Covariance matrix is not positive definite at index ${i}`);
        }
        L[i][j] = Math.sqrt(d);
      } else {
        L[i][j] = (cov[i][j] - sum) / L[j][j];
      }
    }
  }
  return L;
}

/**
 * Correlated standard normals, `L · z`.
 *
 * This is what makes bad things arrive together. Independent draws let a demand
 * collapse and a supply failure land in the same month only by coincidence; in
 * a real quarter they share a cause, and a student who has only ever seen
 * independent shocks learns to size buffers for the wrong world.
 */
export function correlatedShocks(rng: Rng, covMatrix: number[][]): number[] {
  const L = cholesky(covMatrix);
  const z = L.map(() => standardNormal(rng));
  return L.map((row) => row.reduce((sum, value, k) => sum + value * z[k], 0));
}

/**
 * Where a draw sits in its own distribution, in [0,1].
 *
 * The scenario library keys off this: "fires above the 95th percentile" is a
 * property of the draw, not of the calendar, which is what keeps narrative
 * events out of `if (month === 7)`.
 */
export function normalPercentile(value: number, mean: number, sd: number): number {
  if (sd <= 0) return 0.5;
  const z = (value - mean) / sd;
  // Abramowitz & Stegun 7.1.26 for erf; accurate to ~1e-7, which is far past
  // what a percentile threshold needs.
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp((-z * z) / 2);
  return z >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y);
}
