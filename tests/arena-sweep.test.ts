import { describe, expect, it } from "vitest";
import {
  STRATEGIES,
  WIN_RATE_CEILING,
  fixedRows,
  playMatch,
  responsiveRows,
  runSweep,
} from "@/lib/arena/sweep";

/**
 * The balance proof, run as a test.
 *
 * `scripts/arena-sweep.ts` is the authoring loop — you run it at 250 matches
 * while tuning. This is the gate: a smaller, seed-pinned version that fails the
 * build if the game acquires an answer.
 *
 * Deterministic on purpose. The seeds and the match count are fixed, so this
 * either passes or it does not — a flaky balance test is one nobody trusts, and
 * a balance claim nobody trusts is the thing this whole file exists to prevent.
 *
 * The bar has TWO halves and both are checked. No fixed line over the ceiling,
 * and the best responsive line above the best fixed one. Only the first would
 * pass happily on a game where nothing a player does matters.
 */
const MATCHES = 90;

describe("mandi balance", () => {
  const rows = runSweep({ matches: MATCHES, seedPrefix: "pinned" });
  const fixed = fixedRows(rows);
  const responsive = responsiveRows(rows);

  it("has no fixed line that wins reliably", () => {
    const best = fixed[0];
    expect(
      best.winRate,
      `"${best.id}" ignores every signal in the game and wins ${(best.winRate * 100).toFixed(1)}%`,
    ).toBeLessThanOrEqual(WIN_RATE_CEILING);
  });

  it("pays a player for reading the board", () => {
    // The other half. If a responsive line cannot beat a fixed one, the
    // decisions are noise and the ceiling above is passing for the wrong reason.
    expect(responsive[0].winRate).toBeGreaterThan(fixed[0].winRate);
  });

  it("beats chance with a sensible line", () => {
    // And the floor: a market where no strategy is ever better than any other is
    // not balanced, it is random.
    expect(fixed[0].winRate).toBeGreaterThan(0.25);
  });

  it("punishes the lines that should lose", () => {
    // Each of these is a specific lesson the model is supposed to teach:
    // undercutting into a price war, building capacity you cannot fill, and
    // promising a delivery time the queue cannot keep.
    for (const id of ["undercut", "buildout", "fastpromise"]) {
      const row = rows.find((r) => r.id === id)!;
      expect(row.winRate, `${id} should not be winning`).toBeLessThan(0.1);
    }
  });

  it("keeps every strategy in the library classified", () => {
    // The ceiling only judges `fixed` rows, so a new strategy left unclassified
    // would silently escape the gate.
    expect(fixed.length + responsive.length).toBe(STRATEGIES.length);
  });

  it("plays the same match for the same strategy and seed", () => {
    // The sweep is only evidence if it is reproducible.
    const a = playMatch({ strategy: STRATEGIES[0], seed: "repeat-1" });
    const b = playMatch({ strategy: STRATEGIES[0], seed: "repeat-1" });
    expect(b).toEqual(a);
  });
});
