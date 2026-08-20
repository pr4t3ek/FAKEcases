/**
 * Four sets of books from one market.
 *
 * `runTick` settles exactly one P&L — `SettlementConfig` names one revenue line,
 * one cost line and one operating key — which is right for every simulator that
 * came before this one, because they all had a single player. A four-seat match
 * needs four, and the honest way to get them is not to run the market four
 * times: the market resolved ONCE, and each seat's books are that one
 * resolution read through that seat's keys.
 *
 * So this replays `postPeriod` — the engine's own posting function, not a copy
 * of it — over the state history the match already produced. Nothing here
 * recomputes demand, price or share; it only turns quantities that already
 * exist into money.
 *
 * Seat 0's books therefore agree with the engine's own settlement by
 * construction rather than by coincidence, since both are `postPeriod` over the
 * same three numbers. `tests/arena-ledger.test.ts` pins that they do, which is
 * what would catch `mandiConfig.settlement` drifting away from `firmKey(0, …)`.
 */

import { openLedger, postPeriod, type PostedPeriod } from "@/lib/sim/engine/financials";
import { rollingNpv } from "@/lib/sim/engine/financials";
import { firmKey } from "@/lib/sim/configs/mandi";
import type { SimState } from "@/lib/sim/engine/state";
import type { SimulatorConfig } from "@/lib/sim/configs/types";

export interface SeatBooks {
  seatIndex: number;
  /** Net cash movement per quarter, oldest first. */
  cashFlows: number[];
  /** The statements, per quarter. */
  posted: PostedPeriod[];
  receivables: number;
  payables: number;
  /** Discounted value of what actually happened. */
  npv: number;
}

/**
 * One seat's books over every quarter committed so far.
 *
 * Reads `history[key][t + 1]` rather than `[t]`: `openState` pushes the opening
 * position at index 0, so the value AT THE END of tick `t` sits at `t + 1`. That
 * alignment is stated in `lib/sim/engine/state.ts` and getting it wrong here
 * would silently value every match one quarter out of step.
 */
export function seatBooks(args: {
  config: SimulatorConfig;
  state: SimState;
  seatIndex: number;
}): SeatBooks {
  const { config, state, seatIndex } = args;
  const at = (name: string, tick: number) =>
    state.history[firmKey(seatIndex, name)]?.[tick + 1] ?? 0;

  let ledger = openLedger();
  let cash = config.initialState.cash ?? 0;
  const cashFlows: number[] = [];
  const posted: PostedPeriod[] = [];

  for (let tick = 0; tick < state.tick; tick++) {
    const result = postPeriod({
      tick,
      config: config.financials,
      ledger,
      openingCash: cash,
      revenue: at("revenue", tick),
      costOfGoodsSold: at("cogs", tick),
      // Nothing is contracted and nothing is held between quarters in this
      // game: an order you could not serve is gone, not stocked. Both zero
      // rather than omitted, so the shape of the call says so.
      contractSettlement: 0,
      operatingCost: at("opex", tick),
      heldAssetValue: 0,
    });

    ledger = result.ledger;
    cash = result.posted.balance.cash;
    cashFlows.push(result.posted.cashFlow.net);
    posted.push(result.posted);
  }

  const last = posted[posted.length - 1];

  return {
    seatIndex,
    cashFlows,
    posted,
    receivables: last?.balance.receivables ?? 0,
    payables: last?.balance.payables ?? 0,
    npv: rollingNpv({
      realisedCashFlows: cashFlows,
      forwardEstimate: 0,
      periodsRemaining: 0,
      config: config.financials,
    }),
  };
}
