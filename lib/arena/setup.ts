/**
 * A match is the rules plus a seed.
 *
 * `mandiConfig` is the rules — mechanisms, derivations, constants, the four
 * moves a rival can make. Everything that should differ between two matches of
 * the same game is drawn HERE, from the match seed, so it is varied without
 * being random: the same seed rebuilds the same match forever, which is what
 * lets state be replayed rather than stored.
 *
 * Three things are drawn:
 *
 *   1. **Which personas sit in which seats** (`dealPersonas`).
 *   2. **The opening regime.** `openRun` always starts a context at regime 0,
 *      which would make "the first quarter is always Steady" a fact a player
 *      could bank. It is overridden here instead of changed in the engine,
 *      because a bilateral contract genuinely does start from a known state and
 *      only a market has a weather system already running when you arrive.
 *   3. **The opening position** — standing capacity and unit cost.
 *
 * The opening position is drawn ONCE and applied to all four firms identically.
 * That is a fairness decision and it is deliberate: in a four-human match, a
 * seat that started with more capacity than another would decide the result
 * before anybody chose anything. Variety comes from the regime, the personas
 * and the shock stream, none of which favours a seat.
 */

import { createRng } from "@/lib/sim/engine/stochastic";
import { openRun, type RunContext } from "@/lib/sim/engine/time";
import { openJournal, type RunJournal } from "@/lib/sim/engine/journal";
import { firmKey } from "@/lib/sim/configs/mandi";
import { agentFor } from "./personas";
import { getArenaGame } from "./registry";
import { ARENA_SEATS, isAiSeat, type SeatView } from "./types";
import type { SimulatorConfig } from "@/lib/sim/configs/types";

/**
 * A game specialised to one match.
 *
 * The opening regime rides on the config rather than being returned beside it,
 * so the two replay sites cannot pick up one without the other — a match
 * resumed onto the wrong opening regime would be a different world with the
 * same journal, which is the one failure a replayed-state design must not have.
 */
export type MatchConfig = SimulatorConfig & { readonly openingRegime: number };

/** One seat as `specialise` needs to read it. */
export interface SeatSpec {
  seatIndex: number;
  userId: string | null;
  personaId: string;
}

/**
 * The config this match plays on.
 *
 * Only AI seats get an agent. A human seat's four numbers arrive in `decision`
 * and an AI seat's arrive in `quoteOffers`, and `runTick` merges both into one
 * working state — so "who fills which keys of the decision vector" is the ONLY
 * difference between a person and a bot here, which is the property that lets a
 * seat change hands mid-match without the market changing shape.
 */
export function specialise(args: {
  gameSlug: string;
  seed: string;
  seats: SeatSpec[];
}): MatchConfig | null {
  const base = getArenaGame(args.gameSlug);
  if (!base) return null;

  const rng = createRng(`${args.seed}:open`);

  // Drawn in a fixed order so the stream is stable; changing the order changes
  // every existing match, which is why nothing may be inserted above this.
  // Sized against the pie, not chosen: `marketPotential` hands out about 640
  // thousand orders a quarter and four firms at parity take 160 each, so this
  // band opens a firm comfortably clear of its parity share. Undersizing it was subtle and
  // fatal — at 140–200 every firm was capacity-bound at every price, so raising
  // price added revenue at NO volume cost and `scripts/arena-sweep.ts` measured
  // a strictly increasing price curve right off the top of the slider.
  const capacity = 190 + Math.floor(rng.next() * 5) * 10;
  const unitCost = 35 + Math.round(rng.next() * 6);
  const regimeCount = base.regimes.length;
  const openingRegime = Math.min(regimeCount - 1, Math.floor(rng.next() * regimeCount));

  const initialState: Record<string, number> = { ...base.initialState, unitCost };
  for (let seat = 0; seat < ARENA_SEATS; seat++) {
    initialState[firmKey(seat, "capacity")] = capacity;
  }

  return {
    ...base,
    initialState,
    agents: args.seats.filter(isAiSeat).map((s) => agentFor(s.personaId, s.seatIndex)),
    openingRegime,
  };
}

/**
 * A fresh context on the drawn opening regime.
 *
 * Every replay path must go through this rather than calling `openRun`
 * directly, or a match would resume into a different world than it was played
 * in. `tests/arena-tick.test.ts` pins that the two agree.
 */
export function openMatchRun(config: MatchConfig, seed: string, journal?: RunJournal): RunContext {
  const ctx = openRun(config, seed, journal ?? openJournal(seed, config.slug));
  return { ...ctx, regime: config.openingRegime };
}

/** Seat rows as the UI reads them. */
export function toSeatViews(seats: SeatSpec[], names: Record<number, string>): SeatView[] {
  return seats
    .slice()
    .sort((a, b) => a.seatIndex - b.seatIndex)
    .map((s) => ({
      seatIndex: s.seatIndex,
      userId: s.userId,
      personaId: s.personaId,
      displayName: names[s.seatIndex] ?? "",
      isAi: isAiSeat(s),
    }));
}
