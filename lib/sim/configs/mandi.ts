/**
 * Mandi — four quick-commerce firms in one city, eight quarters.
 *
 * The second config-driven simulator, and the one that proves the split the
 * stub in `./types.ts` claims: a competitive market is a genuinely different
 * domain from a bilateral supply contract, and it is expressed here without a
 * single edit to `lib/sim/engine`. The one engine change it needed —
 * `agents: AgentConfig[]` instead of one — is a change to how many
 * counterparties a world may hold, not to what any of them do.
 *
 * ## What makes this a game rather than an exercise
 *
 * Every other format in the app answers a decision with a consequence computed
 * from a fixed model. Here three of the four firms are `lib/sim/engine/agent.ts`
 * agents that read what you did and sample a reply, so the model answering you
 * changes as you play it. A price war is not scripted anywhere in this file: it
 * happens because undercutting moves `calm`, `calm` moves each rival's `peace`
 * posterior, and a lower posterior prices holding out of their utility.
 *
 * ## The four things a player is trading off
 *
 *   price      — cheaper wins share, on a constant elasticity, and the regime
 *                decides how sharply.
 *   marketing  — lifts demand with the same elasticity and costs cash linearly.
 *   stores     — capacity, bought a quarter before it is needed, and paid for
 *                every quarter after whether it is used or not.
 *   promise    — a fast delivery promise lifts demand up to `appealCap` and is
 *                the thing most likely to break: `queue` is convex in
 *                utilisation, so the promise you can keep at 70% of capacity is
 *                the promise that destroys your reputation at 95%.
 *
 * ## Why it cannot be solved once and replayed
 *
 * Seven devices, none of them a random number thrown at the score:
 *
 *   1. The regime is hidden and its opening value is drawn from the match seed,
 *      so "it always starts calm" is not learnable because it is not true.
 *   2. Shocks are correlated within a quarter, so a soft quarter and a bad
 *      service quarter arrive together the way they do in a real one.
 *   3. Which persona sits in which seat is drawn per match (`lib/arena/personas`).
 *   4. Personas sample from a softmax rather than executing a script.
 *   5. Their posteriors are a function of the whole match so far, so the same
 *      opening plays differently in quarter six.
 *   6. Opening conditions are drawn within bands per match.
 *   7. `scripts/arena-sweep.ts` proves no fixed strategy dominates, the way
 *      `checkBalance` proves it for a war room. A device nobody checked is a
 *      hope, not a defence.
 *
 * ## Units, stated once
 *
 * Orders are THOUSANDS of orders per quarter. Money is THOUSANDS of rupees.
 * Price is rupees per order, so `served × price` is already in thousands and
 * the settlement needs no scaling factor anywhere.
 */

import type { AgentConfig, KpiConfig, SimulatorConfig } from "./types";
import type { SimFormatRubricDim } from "@/lib/sim/formats/types";

// ─── The board ─────────────────────────────────────────────────────────────

/** Four firms. Not configurable: the covariance blocks below are sized for it. */
export const FIRM_COUNT = 4;
export const FIRM_INDICES = [0, 1, 2, 3] as const;
export type FirmIndex = (typeof FIRM_INDICES)[number];

/**
 * State keys are namespaced by seat: `p0Price`, `p1Price`, and so on.
 *
 * A function rather than four hand-written blocks, because the market is
 * symmetric by construction — every firm runs the same arithmetic on the same
 * constants — and four copies of it would be four places for them to stop
 * being the same. The symmetry is load-bearing beyond tidiness: it is what lets
 * a seat be handed from a person to an AI mid-match without the market changing
 * shape.
 */
export function firmKey(seat: number, name: string): string {
  return `p${seat}${name[0].toUpperCase()}${name.slice(1)}`;
}

/** The four things a seat decides each quarter, before namespacing. */
export const DECISION_KEYS = ["price", "stores", "marketing", "promise"] as const;
export type DecisionKey = (typeof DECISION_KEYS)[number];

// ─── Constants the model reads out of state ────────────────────────────────
//
// In `initialState` rather than closed over as literals, because a derivation
// can only name state keys — and because putting them here means a variant
// scenario can retune the game by overriding one map.

const CONSTANTS = {
  one: 1,
  zero: 0,
  /** Four. A derivation can only divide by a state key, so the count is one. */
  firmCount: 4,
  /** ₹ per order. The price the elasticity is measured against. */
  priceRef: 70,
  /** ₹. How far below `priceRef` counts as maximum aggression. */
  priceBand: 30,
  /**
   * ₹ per order, at the reference promise. A faster promise raises it — see
   * `promiseCostK`.
   *
   * Tied to the regime elasticities rather than picked: under constant
   * elasticity the contribution-maximising price is `unitCost × e / (e − 1)`,
   * so ₹37 against a steady-regime 2.15 puts the right price at ₹69 — inside
   * the slider, and a little under the ₹70 default.
   */
  unitCost: 37,
  /** Minutes. The promise the appeal multiplier is measured against. */
  promiseRef: 20,
  /** Ceiling on the demand lift a fast promise can buy. */
  appealCap: 1.18,
  /**
   * How much of a faster promise lands on the cost of an order.
   *
   * Speed is not free and the first tuning pass made it free: a firm with spare
   * capacity promised fifteen minutes, took a quarter more demand for nothing,
   * and `scripts/arena-sweep.ts` found it winning 92% of matches. Smaller
   * batches and more riders per order is the real cost, and at 0.5 a promise
   * a third faster than the reference adds about a sixth to unit cost — enough
   * that the appeal has to be worth paying for.
   */
  promiseCostK: 0.5,
  /** ₹ thousand. The marketing spend the lift is measured against. */
  marketingRef: 1_200,
  /**
   * Thousand orders a quarter at which a firm is carrying full delivery
   * density — enough drops per rider-hour and per store that its cost per order
   * has stopped falling.
   */
  scaleRef: 150,
  /**
   * How much a subscale operation pays for being subscale.
   *
   * The economics that decide this industry and the thing the model was missing
   * for three tuning passes. Riders, stores and pickers are paid by the hour;
   * orders per hour is what turns that into a cost per order. A firm serving
   * half the reference volume runs its riders half-empty and pays about a
   * fifth more to deliver each order.
   *
   * Without it a small high-price operation was strictly better than a large
   * one — it earned nearly the same contribution on a fraction of the cost base
   * — and `scripts/arena-sweep.ts` found exactly that line winning 62% of
   * matches. Scale is what makes conceding the city expensive rather than
   * merely modest.
   *
   * Kept deliberately MILD, and capped by `scaleGapCap`. Scale is a positive
   * feedback loop — smaller means dearer means smaller — and a strong one makes
   * a match resolve itself in the second quarter off a rounding difference. At
   * 0.6 with no cap the loop was strong enough that the game's balance stopped
   * responding monotonically to its own parameters, which is the symptom worth
   * recognising: an outcome that swings on tiny early differences is not
   * difficulty, it is noise wearing difficulty's clothes.
   */
  scaleCostK: 0.35,
  /**
   * How much bigger the city's order book gets each quarter.
   *
   * Compounding, so about half again over the eight quarters. Without it the
   * game has no reason to ever build a second store: one capacity level serves
   * a flat market forever, and the sweep duly found that never building
   * anything was the strongest fixed line available. Growth is what turns
   * capacity from a level into a SCHEDULE — build too late and you spill the
   * customers you spent to win, too early and you carry the standing cost of an
   * empty store for a year.
   */
  trendStep: 0.06,
  /** Ceiling on the scale penalty, before `scaleCostK`. Damps the feedback loop. */
  scaleGapCap: 0.6,
  /** Thousand orders per quarter, per dark store. */
  capacityPerStore: 20,
  /**
   * ₹ thousand, one-off, per store added.
   *
   * Priced so a store that is actually used pays for itself in under two
   * quarters and a store that is not is a visible hole. That ratio is the
   * capital-discipline lesson, and it only works if building is genuinely
   * attractive when demand is there — at ₹12 lakh it was not, and refusing to
   * build was the best fixed strategy in the sweep.
   */
  storeCapex: 600,
  /**
   * ₹ thousand per quarter, per thousand orders of standing capacity.
   *
   * The number that makes overbuilding hurt, and it has to be big enough to
   * notice and small enough not to decide the game. At ₹6 the standing cost of
   * capacity plus the overhead came to about ₹32 on every order — roughly
   * three-quarters of the cost of actually delivering one — and a business that
   * fixed-cost-heavy rewards whoever serves the fewest orders at the highest
   * price. Volume has to be worth having, or there is no market to compete in.
   */
  storeOpexPerUnit: 4.5,
  /**
   * How much of a quarter's unmet demand becomes lasting reputation damage.
   *
   * The number that makes running permanently hot untenable, and it has to be
   * large. At 0.55 a firm could sit at 100% utilisation for the whole match,
   * spill a fifth of its demand every quarter, and lose about a fifth of its
   * reputation over two years — slow enough that a small, deliberately
   * under-built, high-price operation was the best fixed line in the game
   * (`scripts/arena-sweep.ts`, 70% of matches). A customer who could not place
   * an order does not come back on the same schedule as one who was merely
   * disappointed.
   */
  repLossRate: 1.1,
  /** How much of a broken delivery promise does the same. */
  missLossRate: 0.35,
  /**
   * Reputation deficit repaid per quarter of behaving.
   *
   * Fast enough that fixing your service is worth doing, slow enough that
   * chronically running a little short is not free. At 0.07 every firm carried
   * the scars of its first tight quarter to the end of the match, which turned
   * reputation from a lever into a handicap nobody could respond to; at 0.15 it
   * forgave a steady eighth of unmet demand every quarter at no cost, and a
   * firm that simply never built a store was the strongest fixed line in the
   * game.
   */
  repRecover: 0.09,
  /**
   * ₹ thousand a quarter to exist: the app, the engineers, the head office.
   *
   * Independent of both capacity and volume, and that is the entire point. Its
   * absence was why a firm could retreat to a 9% niche, charge ₹92 and win —
   * with no fixed cost, a small business was simply a large one scaled down, so
   * conceding the market cost nothing. An overhead is what makes share worth
   * having: it has to be spread over orders, and a firm that concedes the city
   * still pays it.
   */
  overhead: 700,
} as const;

/** Opening position, identical for all four firms before the seed jitters it. */
const OPENING = {
  cash: 24_000,
  capacity: 270,
  reputation: 1,
  repDeficit: 0,
  utilisation: 0.75,
  served: 140,
  actualMins: 14,
  /**
   * Opening demand and opening cost per order.
   *
   * Both are DERIVED keys, so `producedKeys()` would default them to zero — and
   * a zero here is not a harmless placeholder, it is a wrong first quarter for
   * everybody. `operatingStores` reads `rawDemand` to size capacity and sees an
   * empty firm, so no AI seat builds in quarter one; `operatingPrice` reads it
   * for the demand nudge and applies its full downward clamp, so all three
   * rivals open a systematic tenth below their own best response. And
   * `unitCost` at zero puts a best-response price of ₹12 in front of anyone who
   * reads it with `??` rather than `||`.
   *
   * A firm was trading before quarter one — `served`, `utilisation` and
   * `actualMins` above already say so — and these two finish the sentence.
   */
  rawDemand: 140,
  unitCost: 37,
  price: 70,
  marketing: 1_200,
  stores: 0,
  promise: 20,
  peace: 0.7,
} as const;

/**
 * Opening values for everything the model will ever write.
 *
 * The last block is not defensive tidying, it is load-bearing.
 * `openState` builds the history map from the keys of `initialState`, and
 * `commitTick` only ever appends to keys that map already has — so a derived
 * key absent from here is computed correctly every quarter, is visible in
 * `state.current`, and has NO HISTORY AT ALL. Everything that reads a series
 * rather than a snapshot then silently reads zero: `computeKpis` sums nothing,
 * and `seatBooks` values eight quarters of trading at exactly nil.
 *
 * Deriving the list from the mechanisms and derivations rather than writing it
 * out is what keeps that true. A key added to the model tomorrow gets its
 * opening zero without anybody remembering to come back here, which is the only
 * version of this that stays correct.
 */
function initialState(): Record<string, number> {
  const state: Record<string, number> = { ...CONSTANTS };

  for (const seat of FIRM_INDICES) {
    state[firmKey(seat, "price")] = OPENING.price;
    state[firmKey(seat, "marketing")] = OPENING.marketing;
    state[firmKey(seat, "stores")] = OPENING.stores;
    state[firmKey(seat, "promise")] = OPENING.promise;
    state[firmKey(seat, "capacity")] = OPENING.capacity;
    state[firmKey(seat, "reputation")] = OPENING.reputation;
    state[firmKey(seat, "repDeficit")] = OPENING.repDeficit;
    state[firmKey(seat, "utilisation")] = OPENING.utilisation;
    // Opening volume, so quarter one is not priced as if the firm were new.
    state[firmKey(seat, "served")] = OPENING.served;
    state[firmKey(seat, "actualMins")] = OPENING.actualMins;
    state[firmKey(seat, "rawDemand")] = OPENING.rawDemand;
    state[firmKey(seat, "unitCost")] = OPENING.unitCost;
    state[`peace${seat}`] = OPENING.peace;
  }

  // Seat 0's books are the ones the ENGINE settles. Every seat's books are
  // computed by `lib/arena/ledger.ts`, which is what a match is actually scored
  // on — see the note on `settlement` below.
  state.cash = OPENING.cash;
  state.aggression = 0;
  state.calm = 1;
  state.marketRaw = 0;
  state.marketServed = 0;
  state.marketMinPrice = OPENING.price;
  state.marketAvgPrice = OPENING.price;
  // The pie has to have an opening size: the market-size mechanism writes it
  // every tick, but `attract` in pass A of tick 0 is multiplied against it.
  state.marketPotential = 640;
  state.marketSized = 640;
  state.marketAttract = 4;
  state.marketTrend = 1;

  for (const key of producedKeys()) {
    if (!(key in state)) state[key] = 0;
  }

  return state;
}

/** Every key the mechanisms and derivations write. */
function producedKeys(): string[] {
  return [
    ...mechanisms().map((m) => m.writes),
    ...derivations().map((d) => d.writes),
  ];
}

// ─── Mechanisms ────────────────────────────────────────────────────────────
//
// ORDER IS LOAD-BEARING. `runTick` hands mechanism `i` the `i`-th element of the
// correlated shock vector, so the blocks below line up with the covariance
// blocks in `shockCovariance()` and the two must be changed together.
//
//   0–3    demand against price, per firm
//   4–7    demand lift against marketing, per firm
//   8–11   delivery time against last quarter's utilisation, per firm
//   12–15  each rival's posterior about how calm the market is
//
// The queue block reads utilisation from the PREVIOUS quarter, because
// mechanisms run before derivations and utilisation is a derivation. That lag
// is correct rather than tolerated: congestion is what last quarter's traffic
// did to this quarter's service.

function mechanisms(): SimulatorConfig["mechanisms"] {
  return [
    ...FIRM_INDICES.map((seat) => ({
      kind: "elasticity" as const,
      writes: firmKey(seat, "priceDemand"),
      reads: firmKey(seat, "price"),
      // Thousand orders a firm wins at the reference price under a neutral
      // regime, before marketing, reputation and the promise are applied.
      //
      // An INDEX, not a quantity. What this firm's price makes it worth
      // choosing, relative to a firm charging the reference price. Orders are
      // handed out further down, by `pull` — see the note on `marketPotential`.
      base: 1,
      referenceLevel: CONSTANTS.priceRef,
      // Raising price lowers demand. The engine multiplies the exponent by the
      // regime's elasticity, so how sharply is the regime's to decide.
      exponentSign: -1 as const,
      shockName: `demand${seat}`,
    })),
    ...FIRM_INDICES.map((seat) => ({
      kind: "elasticity" as const,
      writes: firmKey(seat, "lift"),
      reads: firmKey(seat, "marketing"),
      // A multiplier, so the base is 1 rather than a quantity.
      base: 1,
      referenceLevel: CONSTANTS.marketingRef,
      exponentSign: 1 as const,
      // Its own elasticity, NOT the regime's. Set just above the break-even
      // exponent for this market: at the reference spend, one more rupee of
      // marketing buys very slightly more than one rupee of contribution, so
      // the optimum spend is a real interior point that MOVES with the margin
      // — which is to say, with the price the player chose and the regime they
      // cannot see. At the regime's own 2.15 this lever returned 3× demand for
      // 1.75× spend and there was nothing to decide.
      elasticity: 0.55,
      shockName: `reach${seat}`,
    })),
    ...FIRM_INDICES.map((seat) => ({
      kind: "queue" as const,
      writes: firmKey(seat, "actualMins"),
      reads: firmKey(seat, "utilisation"),
      baseTime: 7,
      maxTime: 60,
      shockScale: 0.18,
      shockName: `service${seat}`,
    })),
    // How many orders the city places at all this quarter.
    //
    // THE PIE, and it is close to fixed. A market where each firm's demand
    // depended only on its own price is not a market: undercutting conjured
    // orders out of nothing instead of taking them off somebody, so a price war
    // cost the aggressor nothing and the first sweep found a firm could sit at
    // ₹92 and harvest margin while the others fought over customers who were
    // never actually contested. Demand is therefore a fixed pie split by
    // relative attractiveness, and this mechanism sizes the pie.
    //
    // It reads LAST quarter's average price with a deliberately weak elasticity
    // of 0.35: a cheaper city does buy a little more, so a price war grows the
    // market slightly — nowhere near enough to pay for itself, which is the
    // lesson. The regime's `demandMultiplier` scales it, which is what makes
    // reading the market worth anything.
    {
      kind: "elasticity" as const,
      writes: "marketPotential",
      reads: "marketAvgPrice",
      base: 640,
      referenceLevel: CONSTANTS.priceRef,
      exponentSign: -1 as const,
      elasticity: 2.2,
      shockName: "market",
    },
    // One posterior per seat, including the human's — the mechanism list is
    // fixed while who occupies a seat is not, and a belief nobody reads is
    // harmless. `calm` is last quarter's, which is what makes retaliation
    // arrive a quarter after the provocation rather than in the same breath.
    ...FIRM_INDICES.map((seat) => ({
      kind: "bayesBelief" as const,
      writes: `peace${seat}`,
      reads: "calm",
      priorStrength: 6,
      decay: 0.22,
    })),
  ];
}

/**
 * The covariance of one quarter's shocks.
 *
 * Built rather than written out because it is 16×16 and every entry is one of
 * five numbers. Demand shocks are strongly shared — a soft quarter is soft for
 * everyone, which is exactly what makes "is demand weak or am I losing?"
 * genuinely hard. Service correlates with demand more weakly, so a busy quarter
 * strains delivery without determining it.
 *
 * Off-diagonals stay well under 1 so the matrix is positive definite;
 * `cholesky` throws on one that is not, and `tests/arena-config.test.ts` pins
 * that this one is not.
 */
export function shockCovariance(): number[][] {
  // One entry per mechanism, in declaration order. `runTick` hands mechanism i
  // the i-th shock, so this plan and `mechanisms()` are one thing written twice
  // and `tests/arena-config.test.ts` pins that they stay the same length.
  const plan: { n: number; within: number }[] = [
    { n: FIRM_COUNT, within: 0.6 }, // 0–3   price attractiveness
    { n: FIRM_COUNT, within: 0.2 }, // 4–7   marketing reach
    { n: FIRM_COUNT, within: 0.3 }, // 8–11  delivery time
    { n: 1, within: 0 },            // 12    market size
    { n: FIRM_COUNT, within: 0 },   // 13–16 beliefs (draw nothing)
  ];

  // A busy city strains delivery, and a big city is a city that wanted more —
  // so those pairs move together. Everything unnamed is independent.
  const across: Record<string, number> = {
    "0-2": 0.15,
    "0-1": 0.1,
    "0-3": 0.3,
    "2-3": 0.12,
  };

  const blockOf: number[] = [];
  plan.forEach((block, b) => {
    for (let i = 0; i < block.n; i++) blockOf.push(b);
  });

  const pairKey = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);

  return blockOf.map((_, i) =>
    blockOf.map((__, j) => {
      if (i === j) return 1;
      const bi = blockOf[i];
      const bj = blockOf[j];
      return bi === bj ? plan[bi].within : (across[pairKey(bi, bj)] ?? 0);
    }),
  );
}

// ─── Derivations ───────────────────────────────────────────────────────────
//
// ORDER IS LOAD-BEARING HERE TOO, in a way worth stating: each derivation reads
// the working state the ones above it have already written, so a key used
// before it is rewritten carries LAST quarter's value. Two of those lags are
// deliberate and the model would be wrong without them:
//
//   - demand multiplies by `reputation` before reputation is updated, so this
//     quarter's stockout is paid for next quarter and not retroactively;
//   - the queue mechanism reads `utilisation` before it is recomputed, same.

/**
 * Pass A — everything a firm can work out about itself before the market is
 * shared out: capacity, what an order costs it, and how attractive it is.
 */
function firmAttractiveness(seat: number): SimulatorConfig["derivations"] {
  const k = (name: string) => firmKey(seat, name);

  return [
    // Capacity bought this quarter joins the standing stock. `accumulate` reads
    // its own prior, so capacity persists and cannot be un-bought — which is
    // the whole reason a store is a bet rather than a dial.
    { kind: "product", writes: k("capacityAdd"), of: [k("stores"), "capacityPerStore"] },
    { kind: "accumulate", writes: k("capacity"), inflow: k("capacityAdd"), outflow: "zero", floor: 0 },

    // A faster promise costs more per order to serve. Expressed as a blend
    // rather than a curve because a derivation has no exponent: the excess over
    // the reference promise is scaled by `promiseCostK` and added to one.
    { kind: "ratio", writes: k("costRatio"), numerator: "promiseRef", denominator: k("promise") },
    { kind: "difference", writes: k("costExcess"), minuend: k("costRatio"), subtrahend: "one", floor: 0 },
    { kind: "product", writes: k("costUplift"), of: [k("costExcess"), "promiseCostK"] },

    // And so does being small. Reads LAST quarter's volume, because this
    // quarter's has not been shared out yet — which is also the honest reading:
    // the rider roster you are paying for was sized against the orders you were
    // getting, not the ones you are about to get.
    { kind: "ratio", writes: k("scale"), numerator: k("served"), denominator: "scaleRef" },
    { kind: "difference", writes: k("scaleShortfall"), minuend: "one", subtrahend: k("scale"), floor: 0 },
    { kind: "min", writes: k("scaleGap"), of: ["scaleGapCap", k("scaleShortfall")] },
    { kind: "product", writes: k("scaleUplift"), of: [k("scaleGap"), "scaleCostK"] },

    { kind: "sum", writes: k("costMult"), of: ["one", k("costUplift"), k("scaleUplift")] },
    { kind: "product", writes: k("unitCost"), of: ["unitCost", k("costMult")] },

    // A fast promise lifts appeal, capped, so promising ten minutes is worth
    // something but not everything.
    { kind: "ratio", writes: k("appealRaw"), numerator: "promiseRef", denominator: k("promise") },
    { kind: "min", writes: k("appeal"), of: ["appealCap", k("appealRaw")] },

    // How worth choosing this firm is: price × marketing × standing reputation
    // × the promise. `reputation` has not been updated yet this quarter, so
    // this is LAST quarter's standing — deliberate. A stockout is paid for in
    // the quarter after it, not retroactively.
    {
      kind: "product",
      writes: k("attract"),
      of: [k("priceDemand"), k("lift"), k("reputation"), k("appeal")],
    },
  ];
}

/**
 * Pass C — the market is shared out, and the consequences land.
 *
 * `pull` is this firm's share of total attractiveness and `rawDemand` is its
 * cut of the pie. That single pair is what makes this a competitive game: a
 * rival's price cut raises their pull, and every other firm's falls by
 * construction. Nobody can grow except at somebody's expense, apart from the
 * small amount `marketPotential` gives back when the whole city gets cheaper.
 */
function firmOutcome(seat: number): SimulatorConfig["derivations"] {
  const k = (name: string) => firmKey(seat, name);

  return [
    { kind: "ratio", writes: k("pull"), numerator: k("attract"), denominator: "marketAttract" },
    { kind: "product", writes: k("rawDemand"), of: ["marketSized", k("pull")] },

    // You can only serve what you have capacity for; the rest walks.
    { kind: "min", writes: k("served"), of: [k("rawDemand"), k("capacity")] },
    { kind: "difference", writes: k("spill"), minuend: k("rawDemand"), subtrahend: k("served"), floor: 0 },
    { kind: "ratio", writes: k("spillShare"), numerator: k("spill"), denominator: k("rawDemand") },

    // Did the promise survive contact with the queue?
    { kind: "ratio", writes: k("relRaw"), numerator: k("promise"), denominator: k("actualMins") },
    { kind: "min", writes: k("reliability"), of: ["one", k("relRaw")] },
    { kind: "difference", writes: k("missRate"), minuend: "one", subtrahend: k("reliability"), floor: 0 },

    // Reputation is carried as a DEFICIT so it needs no ceiling: the stock
    // floors at zero, and the reputation derived from it therefore caps at one.
    // Accumulating reputation directly would drift above one in a good run and
    // then take quarters to come back down, which would reward nothing.
    { kind: "product", writes: k("spillHit"), of: [k("spillShare"), "repLossRate"] },
    { kind: "product", writes: k("missHit"), of: [k("missRate"), "missLossRate"] },
    { kind: "sum", writes: k("repLoss"), of: [k("spillHit"), k("missHit")] },
    { kind: "accumulate", writes: k("repDeficit"), inflow: k("repLoss"), outflow: "repRecover", floor: 0 },
    { kind: "difference", writes: k("reputation"), minuend: "one", subtrahend: k("repDeficit"), floor: 0.3 },

    // Next quarter's congestion, which the queue mechanism will read.
    { kind: "ratio", writes: k("utilisation"), numerator: k("rawDemand"), denominator: k("capacity") },

    // The books. Capex is charged to the quarter it is committed in rather than
    // depreciated: `postPeriod` settles one operating line, and a game whose
    // stores were free this quarter and expensive later would teach the wrong
    // lesson about capacity. `utilisation` is what carries capital discipline
    // into the score.
    { kind: "product", writes: k("revenue"), of: [k("served"), k("price")] },
    { kind: "product", writes: k("cogs"), of: [k("served"), k("unitCost")] },
    { kind: "product", writes: k("storeOpex"), of: [k("capacity"), "storeOpexPerUnit"] },
    { kind: "product", writes: k("capex"), of: [k("stores"), "storeCapex"] },
    { kind: "sum", writes: k("opex"), of: [k("marketing"), k("storeOpex"), k("capex"), "overhead"] },
    { kind: "sum", writes: k("cost"), of: [k("cogs"), k("opex")] },
  ];
}

/**
 * ORDER IS LOAD-BEARING, in four passes.
 *
 * Each derivation reads the working state the ones above it have written, so a
 * key used before it is rewritten carries LAST quarter's value. Two of those
 * lags are deliberate and the model would be wrong without them: demand is
 * shared out on last quarter's reputation, and `marketAvgPrice` is what the
 * market-size mechanism read at the top of this tick.
 *
 * The passes exist because a share cannot be computed before every firm's
 * attractiveness is known. A, then the total, then C, then the market's own
 * summary — collapsing them would make one firm's demand depend on whether it
 * happened to be declared first.
 */
function derivations(): SimulatorConfig["derivations"] {
  return [
    ...FIRM_INDICES.flatMap((seat) => firmAttractiveness(seat)),

    { kind: "sum", writes: "marketAttract", of: FIRM_INDICES.map((s) => firmKey(s, "attract")) },

    // The city grows. `marketPotential` is what this quarter's average price
    // makes the order book worth; the trend is how much bigger the book itself
    // has become since quarter one.
    { kind: "accumulate", writes: "marketTrend", inflow: "trendStep", outflow: "zero", floor: 1 },
    { kind: "product", writes: "marketSized", of: ["marketPotential", "marketTrend"] },

    ...FIRM_INDICES.flatMap((seat) => firmOutcome(seat)),

    // The market, once every firm has resolved.
    { kind: "sum", writes: "marketRaw", of: FIRM_INDICES.map((s) => firmKey(s, "rawDemand")) },
    { kind: "sum", writes: "marketServed", of: FIRM_INDICES.map((s) => firmKey(s, "served")) },
    ...FIRM_INDICES.map((seat) => ({
      kind: "ratio" as const,
      writes: firmKey(seat, "share"),
      numerator: firmKey(seat, "served"),
      denominator: "marketServed",
    })),

    // What the market-size mechanism will read at the top of NEXT tick.
    { kind: "sum", writes: "sumPrices", of: FIRM_INDICES.map((s) => firmKey(s, "price")) },
    { kind: "ratio", writes: "marketAvgPrice", numerator: "sumPrices", denominator: "firmCount" },

    // How aggressive the board was this quarter, in [0,1] — the single number
    // every rival's posterior is updated on. Measured off the CHEAPEST price on
    // the board rather than any one firm's, so a rival reacts to the market it
    // is in rather than to the player specifically. In a four-human match that
    // is the only reading that makes sense, and it is the same code.
    { kind: "min", writes: "marketMinPrice", of: FIRM_INDICES.map((s) => firmKey(s, "price")) },
    { kind: "difference", writes: "priceGap", minuend: "priceRef", subtrahend: "marketMinPrice", floor: 0 },
    { kind: "ratio", writes: "aggressionRaw", numerator: "priceGap", denominator: "priceBand" },
    { kind: "min", writes: "aggression", of: ["one", "aggressionRaw"] },
    { kind: "difference", writes: "calm", minuend: "one", subtrahend: "aggression", floor: 0 },
  ];
}

// ─── What a player may not see ─────────────────────────────────────────────

/**
 * Hidden state. The regime is hidden by the engine already (it lives in the
 * journal's `hidden` block); these are the domain's own secrets.
 *
 * Rivals' PRICES are public — you can see what they charge, as you can in any
 * market — and so are their served orders and share, because those are the
 * numbers a trade publication prints. What stays hidden is their capacity and
 * their state of mind, which is precisely the information that would turn the
 * game into arithmetic.
 */
function hiddenKeys(): string[] {
  return [
    ...FIRM_INDICES.filter((s) => s !== 0).flatMap((seat) => [
      firmKey(seat, "capacity"),
      firmKey(seat, "utilisation"),
      firmKey(seat, "repDeficit"),
      firmKey(seat, "rawDemand"),
      firmKey(seat, "attract"),
      firmKey(seat, "pull"),
    ]),
    ...FIRM_INDICES.map((seat) => `peace${seat}`),
    "calm",
    "aggressionRaw",
    "priceGap",
    // Served orders and share are public — a trade publication prints those.
    // The PIE is not: `marketPotential` carries the regime's demand multiplier
    // almost undisguised, and showing it would hand over the one thing the
    // whole game is about reading.
    "marketPotential",
    "marketSized",
    "marketAttract",
    firmKey(0, "attract"),
    firmKey(0, "pull"),
  ];
}

// ─── Scoring ───────────────────────────────────────────────────────────────

/**
 * The KPIs for one seat.
 *
 * A function of the seat so every seat in a four-human match is graded on
 * exactly the same definitions — `lib/arena/score.ts` calls this per seat, and
 * `SimulatorConfig.kpis` below is this same function at seat 0. One definition,
 * instantiated four times, rather than a config copy that can drift from the
 * scorer.
 *
 * Every non-primary KPI is a ratio in [0,1], because `scoreRun` scales those
 * straight to a 0–100 dimension; a KPI that could exceed 1 would silently clamp
 * and stop discriminating at the top.
 */
export function kpisForSeat(seat: number): KpiConfig[] {
  const k = (name: string) => firmKey(seat, name);

  return [
    {
      key: "evNpv",
      label: "Enterprise value",
      unit: "inr",
      goodDirection: "up",
      formula: { kind: "npv" },
    },
    {
      key: "margin",
      label: "Profitability",
      unit: "percent",
      goodDirection: "up",
      formula: { kind: "marginOfSums", totalKey: k("revenue"), costKey: k("cost") },
    },
    {
      key: "share",
      label: "Market share",
      unit: "percent",
      goodDirection: "up",
      formula: { kind: "ratioOfSums", numeratorKey: k("served"), denominatorKey: "marketServed" },
    },
    {
      key: "reliability",
      label: "Reliability",
      unit: "percent",
      goodDirection: "up",
      formula: { kind: "ratioOfSums", numeratorKey: k("served"), denominatorKey: k("rawDemand") },
    },
    {
      key: "utilisation",
      label: "Capital discipline",
      unit: "percent",
      goodDirection: "up",
      formula: { kind: "ratioOfSums", numeratorKey: k("served"), denominatorKey: k("capacity") },
    },
  ];
}

/**
 * Five dimensions, and enterprise value carries the most.
 *
 * Deliberate: share, margin, reliability and utilisation can each be maximised
 * on its own by a strategy that loses the game — buy share by pricing below
 * cost, protect margin by conceding the market, hit 100% reliability by never
 * filling the stores. Value is the only one that cannot be gamed in isolation,
 * so it leads and the other four are the reasons a run got there.
 *
 * Value is also the one scored against the Monte Carlo rather than as a raw
 * ratio, which is what stops a lucky regime run outscoring a better-played
 * unlucky one.
 */
export const mandiRubric: readonly SimFormatRubricDim[] = [
  {
    key: "evNpv",
    label: "Enterprise value",
    hint: "What the eight quarters were worth, against what this market could have paid.",
    weight: 1.6,
  },
  {
    key: "margin",
    label: "Profitability",
    hint: "Did the orders you won pay for themselves?",
    weight: 1.2,
  },
  {
    key: "share",
    label: "Market share",
    hint: "How much of the city you ended up serving.",
    weight: 1.0,
  },
  {
    key: "reliability",
    label: "Reliability",
    hint: "Of the demand you created, how much you could actually serve.",
    weight: 1.0,
  },
  {
    key: "utilisation",
    label: "Capital discipline",
    hint: "Whether the stores you paid for every quarter were carrying orders.",
    weight: 1.0,
  },
];

// ─── Rival behaviour ───────────────────────────────────────────────────────

/**
 * The four moves any rival can make, as multiples of the reference price.
 *
 * `exposure` is the term the belief attaches to, and which action carries it is
 * the whole mechanism — see `lib/sim/engine/agent.ts`, where the penalty is
 * `weight × exposure × (1 − belief)`.
 *
 * STARTING A FIGHT is the exposed action. `peace` is each rival's posterior that
 * the board is calm, so when it is high a cut is cheap to contemplate and
 * somebody eventually takes one; as the cutting drives `peace` down, the same
 * cut gets steadily more expensive and the rivals drift back up the price
 * ladder. A price war therefore has a natural END as well as a beginning, and
 * both fall out of one posterior with no threshold anywhere.
 *
 * The first tuning pass had this exactly backwards — `hold` carried the
 * exposure, on the reading that standing still while somebody undercuts you is
 * the position that bleeds. That reading is true and it makes a terrible game:
 * cutting got CHEAPER the more hostile the board became, so all three rivals
 * converged on ₹59 by the second quarter, stayed there, and lost ₹23–38k each.
 * `scripts/arena-sweep.ts` found the consequence immediately — a player could
 * win 95% of matches by declining to participate. A mechanism that can only
 * escalate is not a mechanism, it is a countdown.
 *
 * `promise` does not move across the ladder at all, and `marketing` barely
 * does. Both are pure share levers, and share is zero-sum: when three firms all
 * promise fifteen minutes or all spend a third more, they cancel out completely
 * and are left holding nothing but the cost. A player who simply declines to
 * join that bidding war free-rides on it, and the sweep measured exactly that —
 * a fixed line beating all three rivals most of the time while making no
 * decision at all.
 *
 * The trap stays in the MODEL, because falling into it is a real lesson and the
 * player can still do it. The rivals are simply not required to fall into it
 * every match. What is left on the ladder is price and capacity, which are the
 * two levers that are not zero-sum, and the personas differ there and in what
 * they say.
 *
 * The original note, kept because the reasoning still holds: A
 * fast promise buys share, and share is zero-sum: when three firms all promise
 * fifteen minutes they cancel each other out completely and are left holding
 * nothing but the higher cost per order it takes to keep it. A breakdown of a
 * whole match found exactly that — the rivals matched the player on price, on
 * volume and on capacity, and lost about ₹6 lakh a quarter purely on the cost
 * of promises that bought them no relative advantage. The trap is left in the
 * model, because falling into it is a genuine lesson; the rivals are simply not
 * required to fall into it every match.
 *
 * `stores` is deliberately low across the ladder — nought or one. An agent
 * commits all four levers with a single action, so a rival that built two stores
 * whenever it chose to compete on price built one every quarter it was
 * competing, ended the match at nearly twice the capacity it could fill, and
 * lost the game on standing costs while playing a sensible price. The sweep read
 * that as a player winning 100% of matches at ₹80, which is a statement about
 * the rivals rather than about the price.
 *
 * The four `terms` are also deliberately kept within about one point of each
 * other. Utilities enter a softmax against `temperature`, so a spread much wider
 * than the temperature makes the best action overwhelmingly likely and the rival
 * becomes a script with extra steps.
 */
export const RIVAL_ACTIONS: readonly {
  id: string;
  label: string;
  priceMultiple: number;
  marketingMultiple: number;
  stores: number;
  promise: number;
  terms: Record<string, number>;
}[] = [
  {
    id: "premium",
    label: "hold the premium",
    priceMultiple: 1.25,
    marketingMultiple: 0.95,
    stores: 0,
    promise: 20,
    terms: { margin: 1.5, share: 0.35, exposure: 0.15 },
  },
  {
    id: "hold",
    label: "sit tight",
    priceMultiple: 1.12,
    marketingMultiple: 1.0,
    stores: 0,
    promise: 20,
    terms: { margin: 1.15, share: 0.65, exposure: 0.35 },
  },
  {
    id: "match",
    label: "match the board",
    priceMultiple: 1.02,
    marketingMultiple: 1.05,
    stores: 1,
    promise: 20,
    terms: { margin: 0.9, share: 1.0, exposure: 0.9 },
  },
  {
    id: "undercut",
    label: "go under everyone",
    priceMultiple: 0.92,
    marketingMultiple: 1.1,
    stores: 1,
    promise: 19,
    terms: { margin: 0.45, share: 1.35, exposure: 1.5 },
  },
];

/**
 * One rival, wired to one seat.
 *
 * The offers write that seat's decision keys directly, which is what lets the
 * engine treat an AI firm and a human firm as the same thing: a human's four
 * numbers arrive in `decision`, an AI's arrive in `quoteOffers`, and `runTick`
 * merges both into one working state without knowing which was which.
 */
export function rivalAgent(args: {
  seat: number;
  id: string;
  label: string;
  utilityWeights: Record<string, number>;
  temperature: number;
  beliefWeight: number;
}): AgentConfig {
  return {
    id: `${args.id}@${args.seat}`,
    label: args.label,
    actions: RIVAL_ACTIONS.map((action) => ({
      id: action.id,
      label: action.label,
      offers: {
        [firmKey(args.seat, "price")]: CONSTANTS.priceRef * action.priceMultiple,
        [firmKey(args.seat, "marketing")]: CONSTANTS.marketingRef * action.marketingMultiple,
        [firmKey(args.seat, "stores")]: action.stores,
        [firmKey(args.seat, "promise")]: action.promise,
      },
      terms: action.terms,
    })),
    utilityWeights: args.utilityWeights,
    temperature: args.temperature,
    beliefKey: `peace${args.seat}`,
    beliefWeight: args.beliefWeight,
    exposureTerm: "exposure",
  };
}

// ─── The config ────────────────────────────────────────────────────────────

/**
 * The template. A live match specialises it through `lib/arena/setup.ts`, which
 * draws the personas, the opening regime and the opening jitter from the match
 * seed — so this object is the RULES, and a match is the rules plus a seed.
 *
 * `agents` here is the three-rival solo default. `settlement` points at seat 0
 * because `postPeriod` settles one set of books and seat 0 is the reference
 * firm; every seat's books, including seat 0's, are computed for scoring by
 * `lib/arena/ledger.ts` from the same state history. The engine's own posting
 * is therefore seat 0's, and the two agree by construction rather than by
 * coincidence — `tests/arena-ledger.test.ts` pins that they do.
 */
export const mandiConfig: SimulatorConfig = {
  slug: "mandi",
  domain: "market-competition",
  label: "Mandi",
  premise:
    "Four ten-minute grocery apps, one city, eight quarters. You run one of them. Everyone can see everyone's prices; nobody can see anyone's capacity.",
  situation:
    "You open with 200 thousand orders of quarterly capacity, ₹2.4 crore of cash and a price nobody is currently undercutting. Demand for the city as a whole moves with a market you cannot observe directly — you only ever see what it did to the board.",

  horizon: 8,
  initialState: initialState(),
  hiddenKeys: hiddenKeys(),

  // Three regimes rather than two, because the interesting confusion is between
  // "soft" and "cut-throat": both punish a price rise, and only one of them
  // rewards a price cut.
  // The elasticities are not decoration — they are where the game lives.
  //
  // Demand is shared out by `pull`, and a firm holding a share `s` of the board
  // faces an EFFECTIVE elasticity of `e × (1 − s)`, not `e` — raising your price
  // shrinks the denominator you are dividing by as well as your own numerator,
  // so you lose less volume than the headline number suggests. The
  // contribution-maximising price is therefore `unitCost × eEff / (eEff − 1)`
  // with `eEff ≈ 0.75 e` on a four-firm board.
  //
  // That correction is worth about ₹20 on the answer and both earlier tuning
  // passes missed it. At 1.0–1.55 the optimum sat at ₹185, off the top of the
  // slider; at 1.9–2.5 it still sat near ₹98. At the values below the right
  // price is about ₹86 in a festive quarter, ₹68 in a steady one and ₹59 in a
  // squeeze.
  //
  // That SPREAD is the difficulty knob, and it is the one that matters. A
  // narrower one (1.2/1.0/0.86 on demand, 2.65/3.0/3.4 on elasticity) left the
  // optimum inside a ₹66–₹82 band, so a single well-chosen price was never badly
  // wrong and `scripts/arena-sweep.ts` measured a fixed ₹76 winning 87% of
  // matches. Across ₹59–₹86 no single number is defensible in more than one
  // regime, so the question stops being "what is the right price" and becomes
  // "which market am I in" — which is the one the player cannot look up.
  //
  // None of it works unless capacity is sized above the pie's parity share:
  // a capacity-bound firm sells the same volume at every price, so price adds
  // revenue at no cost and the optimum runs off the top of the slider no matter
  // what these numbers say. See the band in `lib/arena/setup.ts`.
  regimes: [
    { id: "normal", label: "Steady", demandMultiplier: 1.0, elasticity: 3.4, noiseSigma: 0.04 },
    { id: "boom", label: "Festive", demandMultiplier: 1.35, elasticity: 2.3, noiseSigma: 0.05 },
    { id: "squeeze", label: "Squeeze", demandMultiplier: 0.72, elasticity: 5.0, noiseSigma: 0.08 },
  ],
  // Sticky, and deliberately more so than a coin: a regime that changed every
  // other quarter could not be diagnosed in time to act on, so reading it would
  // be a party trick rather than a skill. Roughly three quarters in four, a
  // market is the market it was.
  transitionMatrix: [
    [0.72, 0.14, 0.14],
    [0.26, 0.68, 0.06],
    [0.28, 0.06, 0.66],
  ],
  shockCovariance: shockCovariance(),

  mechanisms: mechanisms(),
  derivations: derivations(),

  settlement: {
    revenue: { quantityKey: firmKey(0, "served"), priceKey: firmKey(0, "price") },
    costOfGoods: { quantityKey: firmKey(0, "served"), priceKey: firmKey(0, "unitCost") },
    operatingCostKey: firmKey(0, "opex"),
    // Nothing is held between quarters: an unserved order is lost, not stocked.
    // Omitting the key is how a domain says that, and it is why the cash cycle
    // KPI the buyback leans on is absent from this game's rubric.
  },

  agents: [
    rivalAgent({
      seat: 1,
      id: "discounter",
      label: "Jhatpat",
      utilityWeights: { margin: 0.6, share: 1.15, exposure: 1.3 },
      temperature: 0.35,
      beliefWeight: 2.2,
    }),
    rivalAgent({
      seat: 2,
      id: "premium",
      label: "Shudh Basket",
      utilityWeights: { margin: 1.9, share: 0.6, exposure: 1.1 },
      temperature: 0.25,
      beliefWeight: 1.5,
    }),
    rivalAgent({
      seat: 3,
      id: "copycat",
      label: "Turant",
      utilityWeights: { margin: 1.0, share: 1.0, exposure: 1.2 },
      temperature: 0.6,
      beliefWeight: 1.9,
    }),
  ],

  decisions: [
    {
      key: "price",
      label: "Price per order",
      help: "₹. Everyone can see it. Below about ₹64 you are under the whole board, which wins orders this quarter and changes what your rivals think they are in.",
      kind: "currency",
      min: 45,
      max: 110,
      step: 1,
      default: 76,
    },
    {
      key: "marketing",
      label: "Marketing",
      help: "₹ thousand this quarter. Lifts demand with strong diminishing returns, and is spent whether the orders arrive or not.",
      kind: "currency",
      min: 300,
      max: 3_000,
      step: 50,
      default: 1_200,
    },
    {
      key: "stores",
      label: "Dark stores to open",
      help: "Each adds 20 thousand orders of quarterly capacity, costs ₹6 lakh to build, and ₹70,000 every quarter after — used or not.",
      kind: "integer",
      min: 0,
      max: 4,
      step: 1,
      default: 1,
    },
    {
      key: "promise",
      label: "Delivery promise",
      help: "Minutes. A faster promise lifts demand up to a quarter more and RAISES your cost per order — and the queue gets convex above about 85% utilisation, so it is also the promise most likely to break.",
      kind: "integer",
      min: 10,
      max: 30,
      step: 1,
      default: 20,
    },
  ],

  financials: {
    receivableDays: 12,
    payableDays: 30,
    daysPerPeriod: 90,
    wacc: 0.14,
  },

  // Fired off the tail of a draw rather than at a fixed quarter, so a player
  // cannot learn that quarter five is the bad one.
  scenarios: [
    {
      id: "festive-rush",
      headline: "Festive week ran hot",
      body: "City-wide order volume spiked well past forecast. Everyone who had capacity took orders; everyone who did not handed them to somebody else.",
      trigger: { drawName: "demand0", atOrAbove: 0.93 },
    },
    {
      id: "demand-air-pocket",
      headline: "The city went quiet",
      body: "Volume came in far under plan across every app. Nobody lost share this quarter — the market simply bought less.",
      trigger: { drawName: "demand0", atOrBelow: 0.07 },
    },
    {
      id: "rider-crunch",
      headline: "Rider shortage",
      body: "A shortage of riders stretched delivery times across the city. The apps running closest to capacity felt it first.",
      trigger: { drawName: "service0", atOrAbove: 0.92 },
    },
  ],
  branchPoints: [],

  rubric: mandiRubric,
  kpis: kpisForSeat(0),
  primaryKpi: "evNpv",
  monteCarloPaths: 120,
};
