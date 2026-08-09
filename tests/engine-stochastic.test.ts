/**
 * The random number generator and the distributions built on it.
 *
 * Reproducibility is the load-bearing property: the rest of `lib/sim` promises
 * that a pinned report reads the same next month, and a stochastic engine keeps
 * that promise only if a seed fully determines the stream.
 */

import { describe, expect, it } from "vitest";
import {
  betaDraw,
  cholesky,
  correlatedShocks,
  createRng,
  hmmStep,
  lognormalDraw,
  normalDraw,
  normalPercentile,
  standardNormal,
} from "@/lib/sim/engine/stochastic";

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const sd = (xs: number[]) => {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
};

describe("createRng", () => {
  it("gives the same stream for the same seed", () => {
    const a = createRng("seed-1");
    const b = createRng("seed-1");
    expect(Array.from({ length: 50 }, () => a.next())).toEqual(
      Array.from({ length: 50 }, () => b.next()),
    );
  });

  it("gives a different stream for a different seed", () => {
    const a = createRng("seed-1");
    const b = createRng("seed-2");
    expect(Array.from({ length: 20 }, () => a.next())).not.toEqual(
      Array.from({ length: 20 }, () => b.next()),
    );
  });

  it("stays inside [0,1)", () => {
    const rng = createRng("bounds");
    for (let i = 0; i < 5000; i++) {
      const u = rng.next();
      expect(u).toBeGreaterThanOrEqual(0);
      expect(u).toBeLessThan(1);
    }
  });

  it("is roughly uniform", () => {
    const rng = createRng("uniform");
    const draws = Array.from({ length: 20_000 }, () => rng.next());
    expect(mean(draws)).toBeCloseTo(0.5, 1);
    // Ten buckets, none starving.
    const buckets = new Array(10).fill(0);
    for (const d of draws) buckets[Math.floor(d * 10)] += 1;
    for (const b of buckets) expect(b).toBeGreaterThan(20_000 / 10 / 2);
  });

  it("counts its draws, so a journal can locate a step", () => {
    const rng = createRng("count");
    rng.next();
    rng.next();
    expect(rng.count).toBe(2);
  });
});

describe("distributions", () => {
  it("draws a standard normal with the right moments", () => {
    const rng = createRng("normal");
    const draws = Array.from({ length: 20_000 }, () => standardNormal(rng));
    expect(mean(draws)).toBeCloseTo(0, 1);
    expect(sd(draws)).toBeCloseTo(1, 1);
  });

  it("shifts and scales a normal", () => {
    const rng = createRng("normal-2");
    const draws = Array.from({ length: 20_000 }, () => normalDraw(rng, 50, 8));
    expect(mean(draws)).toBeCloseTo(50, 0);
    expect(sd(draws)).toBeGreaterThan(7);
    expect(sd(draws)).toBeLessThan(9);
  });

  it("draws a lognormal around its median, skewed right", () => {
    const rng = createRng("lognormal");
    const draws = Array.from({ length: 20_000 }, () => lognormalDraw(rng, 14, 0.4));
    const sorted = [...draws].sort((a, b) => a - b);
    expect(sorted[Math.floor(sorted.length / 2)]).toBeCloseTo(14, 0);
    // Right-skewed: the mean sits above the median, which is the whole reason
    // a lead time is modelled this way rather than symmetrically.
    expect(mean(draws)).toBeGreaterThan(14);
    expect(Math.min(...draws)).toBeGreaterThan(0);
  });

  it("draws a Beta inside (0,1) with the right mean", () => {
    const rng = createRng("beta");
    const draws = Array.from({ length: 10_000 }, () => betaDraw(rng, 46, 2));
    expect(Math.min(...draws)).toBeGreaterThan(0);
    expect(Math.max(...draws)).toBeLessThan(1);
    expect(mean(draws)).toBeCloseTo(46 / 48, 2);
  });

  it("handles a Beta with shape below one without throwing", () => {
    const rng = createRng("beta-small");
    for (let i = 0; i < 500; i++) {
      const v = betaDraw(rng, 0.4, 0.6);
      expect(Number.isFinite(v)).toBe(true);
    }
  });
});

describe("hmmStep", () => {
  const matrix = [
    [0.8, 0.1, 0.1],
    [0.3, 0.6, 0.1],
    [0.3, 0.1, 0.6],
  ];

  it("stays in range", () => {
    const rng = createRng("hmm");
    for (let i = 0; i < 2000; i++) {
      const next = hmmStep(rng, i % 3, matrix);
      expect(next).toBeGreaterThanOrEqual(0);
      expect(next).toBeLessThan(3);
    }
  });

  it("respects the row probabilities", () => {
    const rng = createRng("hmm-freq");
    const counts = [0, 0, 0];
    for (let i = 0; i < 20_000; i++) counts[hmmStep(rng, 0, matrix)] += 1;
    expect(counts[0] / 20_000).toBeCloseTo(0.8, 1);
  });

  it("normalises a row that does not sum to one", () => {
    const rng = createRng("hmm-norm");
    const counts = [0, 0];
    for (let i = 0; i < 10_000; i++) counts[hmmStep(rng, 0, [[3, 1], [1, 1]])] += 1;
    expect(counts[0] / 10_000).toBeCloseTo(0.75, 1);
  });

  it("throws on a row that cannot be a distribution", () => {
    expect(() => hmmStep(createRng("x"), 0, [[0, 0]])).toThrow(/sums to zero/);
  });
});

describe("cholesky and correlated shocks", () => {
  it("factors a matrix so that L·Lᵀ reconstructs it", () => {
    const cov = [
      [1, 0.5, -0.3],
      [0.5, 1, -0.4],
      [-0.3, -0.4, 1],
    ];
    const L = cholesky(cov);
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        const dot = L[i].reduce((s, v, k) => s + v * L[j][k], 0);
        expect(dot).toBeCloseTo(cov[i][j], 10);
      }
    }
  });

  it("refuses a matrix that is not positive definite", () => {
    expect(() => cholesky([[1, 2], [2, 1]])).toThrow(/positive definite/);
  });

  it("produces draws with the requested correlation", () => {
    const cov = [
      [1, 0.6],
      [0.6, 1],
    ];
    const rng = createRng("corr");
    const xs: number[] = [];
    const ys: number[] = [];
    for (let i = 0; i < 20_000; i++) {
      const [x, y] = correlatedShocks(rng, cov);
      xs.push(x);
      ys.push(y);
    }
    const mx = mean(xs);
    const my = mean(ys);
    const cov_xy = mean(xs.map((x, i) => (x - mx) * (ys[i] - my)));
    expect(cov_xy / (sd(xs) * sd(ys))).toBeCloseTo(0.6, 1);
  });
});

describe("normalPercentile", () => {
  it("puts the mean at the middle and the tails where they belong", () => {
    expect(normalPercentile(0, 0, 1)).toBeCloseTo(0.5, 3);
    expect(normalPercentile(1.645, 0, 1)).toBeCloseTo(0.95, 2);
    expect(normalPercentile(-1.645, 0, 1)).toBeCloseTo(0.05, 2);
  });

  it("degrades to the middle when there is no spread", () => {
    expect(normalPercentile(5, 0, 0)).toBe(0.5);
  });
});
