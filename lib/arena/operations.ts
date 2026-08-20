/**
 * What an AI firm does about capacity.
 *
 * An `AgentConfig` commits every lever at once: an action names a price, a
 * marketing budget, a promise AND a store count, and the softmax picks one
 * bundle. That is right for a counterparty whose whole behaviour is a posture —
 * the buyback supplier either offers wide cover or it does not — and it is
 * wrong for a firm, because pricing and capacity are decided by different
 * people against different evidence.
 *
 * Leaving them bundled made the rivals hopeless in a way that flattered the
 * player: a rival competing on price also built a store every quarter it
 * competed, finished the match at nearly twice the capacity it could fill, and
 * lost on standing cost while playing a perfectly sensible price. The sweep
 * read that as a player winning 90% of matches at ₹76 — a statement about the
 * rivals, not about the price.
 *
 * So the agent chooses the POSTURE and this chooses the OPERATIONS. It is a
 * deterministic rule rather than a second agent on purpose: capacity planning
 * against observed utilisation is not a judgement call a competitor agonises
 * over, it is what an operations team does every quarter, and modelling it as a
 * dice roll would add variance without adding a decision.
 *
 * Pure, and a function of state alone, so it replays identically.
 */

import { clamp } from "@/lib/utils";
import { firmKey } from "@/lib/sim/configs/mandi";

/** Utilisation a firm reads as "the market is normal". */
const NEUTRAL_UTILISATION = 0.75;
/**
 * How hard a rival leans on the demand it saw.
 *
 * Small, and it has to be. Utilisation is a volatile signal — a firm that
 * priced low is flooded and one that priced high is empty — so a strong
 * response to it is a cobweb: cheap quarter, flooded, price up hard, empty
 * quarter, price down hard, forever. At 0.45 the rivals genuinely did this,
 * swinging between ₹68 and ₹113 in consecutive quarters, which is neither good
 * play nor a market anybody could read. At 0.18 the same signal produces a
 * drift a player can follow.
 */
const PRICE_RESPONSE = 0.18;
/** How far the demand read may move a price, either way. */
const PRICE_BAND = 0.1;
/**
 * The elasticity a rival ASSUMES, having no way to see the regime.
 *
 * The STEADY regime's value, exactly. A rival that read the live one would be
 * diagnosing the market perfectly every quarter, which is the single thing the
 * player is being asked to do — the game would have no skill left in it. A
 * rival that assumes normal conditions is competent and specifically beatable:
 * it underprices a festive quarter and overprices a squeeze, and a player who
 * spots which one they are in takes the difference.
 *
 * It has to be the steady value and not a round number near it. At 3.0 the
 * rivals' best response came out at ₹86 against a measured optimum of ₹80–84,
 * so all three overpriced by a few rupees in every quarter of every match — and
 * a fixed ₹76 beat them about 54% of the time for no better reason than that.
 */
const ASSUMED_ELASTICITY = 3.4;
/** How much of a posture's ladder position survives into the target price. */
const POSTURE_TILT = 0.35;
/** The share a rival assumes it holds when pricing. One firm of four. */
const PARITY_SHARE = 0.25;
/** Growth a rival plans capacity against. Matches `trendStep` in the config. */
const EXPECTED_GROWTH = 0.06;
/**
 * What a thousand extra orders a quarter really cost, beyond serving them.
 *
 * `unitCost` is the cost of DELIVERING an order. It is not the marginal cost of
 * WINNING one, because an order you win also has to have capacity built for it:
 * ₹6 lakh of capex per 20 thousand orders, plus a standing ₹3.5 thousand per
 * unit every quarter after. Amortised over the few quarters that capacity will
 * serve, that is about ₹7 an order.
 *
 * Leaving it out is not a rounding error, it is a systematic ₹10 underprice.
 * The rivals priced off `unitCost` alone and came out around ₹72 while the
 * measured optimum sat at ₹82–84 — so every rival was quietly selling below the
 * best price in the game, every quarter, and a player who simply held ₹84 beat
 * all three without reading anything.
 */
const CAPACITY_COST_PER_ORDER = 7;

/**
 * Stores this firm opens, from last quarter's utilisation.
 *
 * The thresholds sit just past the queue's knee. `queueDelay` is convex in
 * utilisation and starts to hurt around 0.85, so building at 0.9 is building
 * roughly when the pain arrives rather than in anticipation of it — which is
 * exactly the discipline the player is being graded on, and the rivals have to
 * be capable of it or the lesson is free. Set at 0.82 the rule built a quarter
 * too early every time and handed the player a standing cost advantage worth
 * more than the whole pricing decision.
 */
export function operatingStores(state: Record<string, number>, seatIndex: number): number {
  const capacity = state[firmKey(seatIndex, "capacity")] ?? 0;
  const demand = state[firmKey(seatIndex, "rawDemand")] ?? 0;
  if (capacity <= 0) return 1;

  // Projected forward, not measured. The city's order book grows every quarter,
  // so a rule that waits until it is full is a rule that is always a quarter
  // late — which is exactly what it was, and the cost was not the lost orders
  // but the reputation: a firm spilling 5% of its demand every quarter ran at
  // two-thirds reputation for the whole match while a player who simply built
  // every quarter held four-fifths, and the attract gap did the rest.
  const utilisation = (demand * (1 + EXPECTED_GROWTH)) / capacity;
  if (utilisation > 0.8) return 2;
  if (utilisation > 0.5) return 1;
  return 0;
}

/**
 * What an AI firm charges, given the posture it chose.
 *
 * A best response, not a ladder position. Under constant elasticity the
 * contribution-maximising price is `c · eEff / (eEff − 1)`, and on a shared-pie
 * board the effective elasticity a firm faces is `e · (1 − share)` — raising
 * your price shrinks the denominator you divide by as well as your own
 * numerator. So the rule is that formula, on the firm's OWN cost and OWN share,
 * with the persona tilting the answer and last quarter's utilisation nudging it.
 *
 * Three earlier rules failed here and the way they failed is worth keeping.
 *
 * A fixed multiple of a reference price meant the rivals charged the same ₹78
 * whatever it cost them to serve an order and whatever the market was doing;
 * any competent player beat all three about 70% of the time.
 *
 * Passing their observed unit cost into their price fixed that and introduced
 * something worse: cost carries the SCALE penalty, so dearer meant higher priced
 * meant smaller meant dearer, and the loop had gain. The game's balance stopped
 * responding monotonically to its own parameters — a pass-through of 0.95 left
 * the best fixed strategy winning 70% of matches and 1.1 dropped it to 10%,
 * which is not a knob, it is a cliff.
 *
 * This rule closes that loop by construction. Pricing up costs share, share
 * raises the effective elasticity, and a higher elasticity prices back down. The
 * correction is in the formula rather than in a damping constant somebody has
 * to tune.
 */
export function operatingPrice(args: {
  state: Record<string, number>;
  seatIndex: number;
  /** The posture's price. Read only for where it sits on the ladder. */
  posturePrice: number;
  referenceUnitCost: number;
  referencePrice: number;
}): number {
  const { state, seatIndex, posturePrice, referenceUnitCost, referencePrice } = args;

  const unitCost = state[firmKey(seatIndex, "unitCost")] || referenceUnitCost;

  // Parity share, ASSUMED rather than observed, and that is the important word.
  // Keying this on the firm's actual share made every rival raise its price
  // whenever it gained one — correct monopoly theory, and ruinous here: a player
  // who priced up and ceded share was followed up by all three rivals, so
  // ceding share cost almost no volume and the measured price curve peaked ₹16
  // above where the arithmetic said it should. An assumption that does not chase
  // the player leaves the player's demand curve where the model put it.
  const effective = Math.max(1.25, ASSUMED_ELASTICITY * (1 - PARITY_SHARE));
  const marginalCost = unitCost + CAPACITY_COST_PER_ORDER;
  const best = marginalCost * (effective / (effective - 1));

  const tilt = referencePrice > 0 ? 1 + POSTURE_TILT * (posturePrice / referencePrice - 1) : 1;

  const capacity = state[firmKey(seatIndex, "capacity")] ?? 0;
  const demand = state[firmKey(seatIndex, "rawDemand")] ?? 0;
  const utilisation = capacity > 0 ? demand / capacity : NEUTRAL_UTILISATION;
  const read = clamp(
    1 + PRICE_RESPONSE * (utilisation - NEUTRAL_UTILISATION),
    1 - PRICE_BAND,
    1 + PRICE_BAND,
  );

  return best * tilt * read;
}

/**
 * The AI seats' offers, with price and capacity decided by the rules rather
 * than by the posture bundle.
 *
 * Overrides only the `stores` key and only for seats an agent is playing, so a
 * human seat is untouched — the engine still sees one merged decision vector and
 * still cannot tell which keys came from a person.
 */
export function withOperations(
  offers: Record<string, number>,
  state: Record<string, number>,
  aiSeats: number[],
  referenceUnitCost: number,
  referencePrice: number,
): Record<string, number> {
  const out = { ...offers };
  for (const seat of aiSeats) {
    out[firmKey(seat, "stores")] = operatingStores(state, seat);

    const posture = offers[firmKey(seat, "price")];
    if (typeof posture === "number") {
      out[firmKey(seat, "price")] = operatingPrice({
        state,
        seatIndex: seat,
        posturePrice: posture,
        referenceUnitCost,
        referencePrice,
      });
    }
  }
  return out;
}
