import { describe, expect, it } from "vitest";
import { firmKey } from "@/lib/sim/configs/mandi";
import { seatBooks } from "@/lib/arena/ledger";
import { dealPersonas } from "@/lib/arena/personas";
import { namespaceDecision, replayMatch, stepMatch, sanitiseDecision } from "@/lib/arena/run";
import { openMatchRun, specialise, type MatchConfig } from "@/lib/arena/setup";
import { ARENA_SEATS } from "@/lib/arena/types";

const PLAY = { price: 76, marketing: 1_200, stores: 1, promise: 20 };

function match(seed: string, humanSeats = [0]) {
  const personas = dealPersonas(seed, ARENA_SEATS);
  const seats = Array.from({ length: ARENA_SEATS }, (_, seatIndex) => ({
    seatIndex,
    userId: humanSeats.includes(seatIndex) ? `u${seatIndex}` : null,
    personaId: personas[seatIndex],
  }));
  return specialise({ gameSlug: "mandi", seed, seats }) as MatchConfig;
}

function play(config: MatchConfig, seed: string, quarters: number, humanSeats = [0]) {
  let state = replayMatch({ config, seed, journal: null });
  for (let q = 0; q < quarters; q++) {
    const decision: Record<string, number> = {};
    for (const seat of humanSeats) Object.assign(decision, namespaceDecision(seat, PLAY));
    state = stepMatch(state, decision, config);
  }
  return state;
}

/**
 * The property the whole design rests on: state is REPLAYED, never stored.
 *
 * If a match cannot be rebuilt from its seed and its journal, then every page
 * load is showing a snapshot that some older build wrote, and a debrief is a
 * claim rather than a reconstruction.
 */
describe("arena determinism", () => {
  it("plays the same match twice from the same seed", () => {
    const a = play(match("det-1"), "det-1", 8);
    const b = play(match("det-1"), "det-1", 8);
    expect(b.ctx.state.current).toEqual(a.ctx.state.current);
    expect(b.ctx.journal.entries).toEqual(a.ctx.journal.entries);
  });

  it("plays a different match from a different seed", () => {
    const a = play(match("det-1"), "det-1", 8);
    const b = play(match("det-2"), "det-2", 8);
    expect(b.ctx.state.current).not.toEqual(a.ctx.state.current);
  });

  it("resumes into the world it left", () => {
    // The heart of it. Play four quarters, then rebuild from the journal alone
    // and play four more — it must land exactly where an uninterrupted run did.
    const config = match("resume-1");
    const straight = play(config, "resume-1", 8);

    const half = play(config, "resume-1", 4);
    let resumed = replayMatch({ config, seed: "resume-1", journal: half.ctx.journal });
    expect(resumed.round).toBe(4);
    for (let q = 0; q < 4; q++) {
      resumed = stepMatch(resumed, namespaceDecision(0, PLAY), config);
    }

    expect(resumed.ctx.state.current).toEqual(straight.ctx.state.current);
  });

  it("resumes onto the regime the match opened on", () => {
    // `openRun` always starts a context at regime 0. A match starts on the one
    // its seed drew, so every replay path has to go through `openMatchRun` or a
    // resumed match is a different world with the same journal.
    const config = match("regime-1");
    const opened = openMatchRun(config, "regime-1");
    expect(opened.regime).toBe(config.openingRegime);
    expect(replayMatch({ config, seed: "regime-1", journal: null }).ctx.regime).toBe(
      config.openingRegime,
    );
  });

  it("draws a different opening regime for different seeds", () => {
    const regimes = new Set(
      ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"].map((s) => match(s).openingRegime),
    );
    // If this ever collapses to one value, "the first quarter is always Steady"
    // is a fact a player can bank.
    expect(regimes.size).toBeGreaterThan(1);
  });
});

describe("who plays which seat", () => {
  it("gives an agent to every empty seat and to no seated one", () => {
    // "The match starts whether or not anybody joins" is this line. An empty
    // seat gets a rival; a seat with a person in it gets nothing, because that
    // person's four numbers arrive in `decision` instead.
    const config = match("seats-1", [0, 2]);
    const seats = config.agents.map((a) => Number(a.id.split("@")[1])).sort();
    expect(seats).toEqual([1, 3]);
  });

  it("fills every seat when nobody has joined at all", () => {
    const config = match("seats-2", []);
    expect(config.agents).toHaveLength(ARENA_SEATS);
  });

  it("gives nobody an agent when the table is full of people", () => {
    const config = match("seats-3", [0, 1, 2, 3]);
    expect(config.agents).toHaveLength(0);
  });

  it("plays the same market whether a seat is a person or the house", () => {
    // The decision vector is the unit of play and a seat is only who fills
    // which keys of it. Playing seat 1 as a person, with the exact numbers its
    // persona would have offered, must land in the same place.
    const solo = match("swap-1", [0]);
    const state = replayMatch({ config: solo, seed: "swap-1", journal: null });
    expect(state.offers[firmKey(1, "price")]).toBeGreaterThan(0);
    expect(state.offers[firmKey(0, "price")]).toBeUndefined();
  });
});

describe("decisions at the trust boundary", () => {
  const config = match("bounds-1");

  it("clamps a hand-rolled value into the config's own range", () => {
    const clean = sanitiseDecision(config, { price: 9_999, marketing: -5, stores: 99, promise: 0 });
    for (const spec of config.decisions) {
      expect(clean[spec.key]).toBeGreaterThanOrEqual(spec.min);
      expect(clean[spec.key]).toBeLessThanOrEqual(spec.max);
    }
  });

  it("falls back to the default rather than letting a NaN through", () => {
    const clean = sanitiseDecision(config, { price: "nonsense", marketing: null });
    const price = config.decisions.find((d) => d.key === "price")!;
    expect(clean.price).toBe(price.default);
  });

  it("ignores keys the config does not declare", () => {
    const clean = sanitiseDecision(config, { ...PLAY, cash: 9_999_999 });
    expect(clean).not.toHaveProperty("cash");
  });

  it("only ever writes the seat it was given", () => {
    const keys = Object.keys(namespaceDecision(2, PLAY));
    expect(keys.every((k) => k.startsWith("p2"))).toBe(true);
    expect(keys).toHaveLength(config.decisions.length);
  });
});

describe("seat books", () => {
  it("agrees with the engine's own settlement for seat 0", () => {
    // `mandiConfig.settlement` points at seat 0 and `seatBooks` reads
    // `firmKey(0, …)`. Both are `postPeriod` over the same three numbers, so
    // they agree by construction — this is what notices if one drifts.
    const config = match("books-1");
    const state = play(config, "books-1", 8);
    const books = seatBooks({ config, state: state.ctx.state, seatIndex: 0 });

    expect(books.cashFlows).toHaveLength(8);
    expect(books.cashFlows).toEqual(state.ctx.cashFlows);
  });

  it("gives every seat its own books", () => {
    const config = match("books-2");
    const state = play(config, "books-2", 8);
    const npvs = Array.from({ length: ARENA_SEATS }, (_, seat) =>
      seatBooks({ config, state: state.ctx.state, seatIndex: seat }).npv,
    );
    expect(new Set(npvs).size).toBe(ARENA_SEATS);
  });

  it("values a quarter that was never played at nothing", () => {
    const config = match("books-3");
    const state = replayMatch({ config, seed: "books-3", journal: null });
    expect(seatBooks({ config, state: state.ctx.state, seatIndex: 0 }).npv).toBe(0);
  });
});
