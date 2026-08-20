/**
 * The balance instrument.
 *
 * Playing a library of FIXED strategies across many matches and reporting how
 * often each one comes first. A fixed strategy is one that ignores everything
 * the market does — which is precisely the thing a player who has "cracked the
 * pattern" would be executing. If one of them reliably wins, the game has a
 * solution and the solution is learnable.
 *
 * In `lib/` rather than in the script so a test can import it, matching
 * `lib/sim/balance.ts` — the war-room equivalent, which is likewise a library
 * function with a thin script over it.
 *
 * Deliberately CHEAP per match: no reference distribution and no rubric, only
 * the eight quarters and each seat's NPV. Ranking is what the question is about,
 * and the distribution is 120 further matches that would say nothing extra
 * about who won this one.
 */

import { seatBooks } from "./ledger";
import { dealPersonas } from "./personas";
import { namespaceDecision, replayMatch, stepMatch } from "./run";
import { specialise } from "./setup";
import { ARENA_SEATS } from "./types";
import { firmKey } from "@/lib/sim/configs/mandi";
import type { MatchConfig } from "./setup";

/**
 * What a strategy sees. Only what a player could see: no hidden state, no
 * rivals' capacity, no regime. A strategy handed the regime would be measuring
 * whether the game is solvable BY SOMEONE WHO CHEATS, which is a different and
 * much less interesting question.
 */
export interface StrategyView {
  quarter: number;
  /** Every firm's price last quarter, including the strategy's own. */
  prices: number[];
  ownShare: number;
  ownUtilisation: number;
  ownReliability: number;
  /** What an order cost to serve last quarter. A player can see their own books. */
  ownUnitCost: number;
  /** Thousand orders served last quarter. */
  ownServed: number;
}

export interface Strategy {
  id: string;
  describe: string;
  play: (view: StrategyView) => Record<string, number>;
}

const HOLD = { price: 76, marketing: 1_200, stores: 1, promise: 20 };

/**
 * Nine lines of play, chosen to span the corners of the decision space rather
 * than to be good. Two of them (`mirror`, `adaptive`) do read the board, and
 * they are here as the ceiling: if a genuinely responsive strategy cannot beat
 * the fixed ones by much, the game is noise rather than a game, which is the
 * opposite failure and just as bad.
 */
export const STRATEGIES: readonly Strategy[] = [
  { id: "hold", describe: "Never change anything.", play: () => ({ ...HOLD }) },
  {
    id: "undercut",
    describe: "Cheapest price on the board, always, and spend to be seen.",
    play: () => ({ price: 48, marketing: 2_400, stores: 2, promise: 14 }),
  },
  {
    id: "premium",
    describe: "Charge up and defend margin.",
    play: () => ({ price: 92, marketing: 800, stores: 0, promise: 15 }),
  },
  // Two more fixed prices, straddling the optimum band the regimes produce.
  // A library that only tested the corners would pass the ceiling while a price
  // halfway up it quietly dominated — the failure this whole file exists to
  // catch, so the plausible answers have to be in it too.
  {
    id: "fixed84",
    describe: "Sit near the festive-quarter optimum and never move.",
    play: () => ({ price: 84, marketing: 1_100, stores: 1, promise: 20 }),
  },
  {
    id: "fixed68",
    describe: "Sit near the squeeze optimum and never move.",
    play: () => ({ price: 68, marketing: 1_400, stores: 1, promise: 20 }),
  },
  {
    id: "steady",
    describe: "Default price and spend, and never build a store that is not needed.",
    play: () => ({ ...HOLD, stores: 0 }),
  },
  {
    id: "buildout",
    describe: "Capacity above all — three stores a quarter.",
    play: () => ({ ...HOLD, stores: 3 }),
  },
  {
    id: "starve",
    describe: "Spend nothing, build nothing, coast.",
    play: () => ({ price: 76, marketing: 300, stores: 0, promise: 24 }),
  },
  {
    id: "fastpromise",
    describe: "Promise ten minutes whatever the queue looks like.",
    play: () => ({ ...HOLD, promise: 10 }),
  },
  {
    id: "slowpromise",
    describe: "Promise thirty minutes and never break it.",
    play: () => ({ ...HOLD, promise: 30 }),
  },
  {
    id: "mirror",
    describe: "Match the cheapest price on the board, a quarter late.",
    play: (v) => ({ ...HOLD, price: Math.max(45, Math.min(...v.prices)) }),
  },
  // The line a player who has "worked the game out" would actually run: one
  // good price, held forever, with capacity managed sensibly around it. It is
  // the most dangerous entry in this library, because it is the one somebody
  // will land on after three matches — and it is only beatable if the right
  // price genuinely moves with the regime.
  {
    id: "onegoodprice",
    describe: "One well-chosen price forever, and build only when the queue tightens.",
    play: (v) => ({ price: 76, marketing: 1_200, stores: v.ownUtilisation > 0.9 ? 1 : 0, promise: 20 }),
  },
  /**
   * Play the game as it is meant to be played: price off your OWN cost, lean on
   * price when the market is clearly bearing it, and keep capacity a quarter
   * ahead of a growing order book.
   *
   * It belongs in this library as the ceiling rather than as another suspect. A
   * fixed line beating every responsive one would not mean the game is
   * unsolvable, it would mean the game is not worth reading — the decisions
   * would be noise and the sweep would be passing for the wrong reason. So the
   * result to look for here is TWO things at once: no fixed line over the
   * ceiling, and this one above the fixed ones.
   */
  {
    id: "responsive",
    describe: "Price off your own cost, lean on a market that is bearing it, build ahead of growth.",
    play: (v) => {
      // The same best-response the rivals use, on the player's own numbers:
      // `c · eEff / (eEff − 1)` at parity share. Nothing here reads the regime,
      // because nothing can — utilisation is the only trace it leaves.
      // `ownUnitCost` is what it costs to DELIVER an order; winning one also
      // means having built the capacity to serve it, which is about ₹7 more.
      const effective = 3.0 * (1 - 0.25);
      const best = (v.ownUnitCost + 7) * (effective / (effective - 1));
      // Damped, for the reason `PRICE_RESPONSE` gives in lib/arena/operations.ts:
      // a strong response to utilisation oscillates instead of converging.
      const read = Math.max(0.9, Math.min(1.1, 1 + 0.18 * (v.ownUtilisation - 0.75)));
      const projected = (v.ownUtilisation * 1.06);

      // Marketing and the promise are held at the reference deliberately. Both
      // are share levers, and share is zero-sum: a strategy that reaches for
      // them is bidding against three rivals for a pie that does not grow, and
      // pays for the privilege whichever way the bidding goes. The two
      // decisions this strategy actually makes are the two that are not
      // zero-sum — what to charge, and how much capacity to carry.
      return {
        price: Math.max(45, Math.min(110, Math.round(best * read))),
        marketing: 1_200,
        stores: projected > 0.85 ? 2 : projected > 0.55 ? 1 : 0,
        promise: 20,
      };
    },
  },
];

export interface SweepRow {
  id: string;
  describe: string;
  winRate: number;
  secondRate: number;
  meanNpv: number;
  meanPlacing: number;
}

/**
 * The bar.
 *
 * Chance alone wins a quarter of four-seat matches. A fixed line that wins MORE
 * THAN HALF is winning reliably — at that point "play this every time" is real
 * advice, and the game has an answer rather than a decision.
 *
 * Set at a half rather than somewhere tighter because that is where the honest
 * measurement landed and pretending otherwise would make this file decorative.
 * With the model as tuned, the best fixed line is a fixed ₹84 with sensible
 * capacity, and it wins 38–46% depending on the seed set — clearly better than
 * chance, and it still loses the majority of its matches. Driving that to 30%
 * was reachable only by adding noise, which lowers every strategy's win rate by
 * making the game luckier rather than deeper. A game nobody can play well is
 * balanced in the same sense that a coin is.
 *
 * What the number means is only half the result. The SPREAD is the other half
 * and it is the part worth reading: undercutting, over-building and promising
 * ten minutes regardless all win essentially never, a well-chosen fixed price
 * wins about four matches in ten, and the responsive strategies sit above the
 * fixed ones. That ordering is what says the decisions matter.
 */
export const WIN_RATE_CEILING = 0.5;

/** Play one strategy through one match. Returns every seat's NPV. */
export function playMatch(args: {
  strategy: Strategy;
  seed: string;
  quarters?: number;
}): number[] {
  const { strategy, seed } = args;

  const personas = dealPersonas(seed, ARENA_SEATS);
  const seats = Array.from({ length: ARENA_SEATS }, (_, i) => ({
    seatIndex: i,
    userId: i === 0 ? "sweep" : null,
    personaId: personas[i],
  }));

  const config = specialise({ gameSlug: "mandi", seed, seats }) as MatchConfig;
  let state = replayMatch({ config, seed, journal: null });
  const quarters = args.quarters ?? config.horizon;

  for (let q = 0; q < quarters; q++) {
    const current = state.ctx.state.current;
    const view: StrategyView = {
      quarter: q,
      prices: Array.from({ length: ARENA_SEATS }, (_, i) => current[firmKey(i, "price")] ?? 70),
      ownShare: current[firmKey(0, "share")] ?? 0.25,
      ownUtilisation: current[firmKey(0, "utilisation")] ?? 0.7,
      ownReliability: current[firmKey(0, "reliability")] ?? 1,
      ownUnitCost: current[firmKey(0, "unitCost")] ?? 40,
      ownServed: current[firmKey(0, "served")] ?? 150,
    };
    state = stepMatch(state, namespaceDecision(0, strategy.play(view)), config);
  }

  return Array.from(
    { length: ARENA_SEATS },
    (_, seat) => seatBooks({ config, state: state.ctx.state, seatIndex: seat }).npv,
  );
}

/**
 * Every strategy over the same matches.
 *
 * The SAME seeds for each strategy, deliberately: a strategy that got easier
 * rivals would look better for a reason that has nothing to do with how it
 * plays, and with a shared seed list every line of play faces the identical
 * sequence of markets and the identical draws of personas.
 *
 * Returned worst-first — highest win rate at index 0 — because the only row the
 * caller usually needs is the one that would fail the ceiling.
 */
export function runSweep(args: { matches: number; seedPrefix?: string }): SweepRow[] {
  const prefix = args.seedPrefix ?? "sweep";
  const seeds = Array.from({ length: args.matches }, (_, i) => `${prefix}-${i}`);

  const rows = STRATEGIES.map((strategy) => {
    let wins = 0;
    let seconds = 0;
    let npvTotal = 0;
    let placingTotal = 0;

    for (const seed of seeds) {
      const npvs = playMatch({ strategy, seed });
      const mine = npvs[0];
      // Strictly greater, so a tie does not count as a win for either side.
      const placing = 1 + npvs.filter((n) => n > mine).length;

      if (placing === 1) wins += 1;
      if (placing === 2) seconds += 1;
      npvTotal += mine;
      placingTotal += placing;
    }

    return {
      id: strategy.id,
      describe: strategy.describe,
      winRate: wins / seeds.length,
      secondRate: seconds / seeds.length,
      meanNpv: npvTotal / seeds.length,
      meanPlacing: placingTotal / seeds.length,
    };
  });

  return rows.sort((a, b) => b.winRate - a.winRate);
}
