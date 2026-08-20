/**
 * What crosses to the browser.
 *
 * Built FIELD BY FIELD, never by spreading state — the same discipline
 * `lib/sim/redact.ts` applies to a war room, and for the same reason: a key
 * added to the model tomorrow must be absent from this payload until somebody
 * deliberately adds it here. A spread would ship every future secret by
 * default, and the failure would be silent.
 *
 * What is deliberately withheld while a match is live:
 *
 *   - **the regime**, which is the whole exercise;
 *   - **`marketPotential` / `marketSized`**, which carry the regime's demand
 *     multiplier almost undisguised;
 *   - **every rival's `peace` posterior**, which would let a player see the
 *     price war coming rather than read it;
 *   - **rivals' capacity, utilisation and reputation deficit**, which is the
 *     information that would turn the game into arithmetic.
 *
 * What is public and should be: every firm's price, its served orders and its
 * share. A trade publication prints those, and a market where you cannot see
 * what your competitors charge is not a market.
 *
 * `tests/arena-hidden.test.ts` asserts against the SERIALISED object rather
 * than against this file, so a leak is caught by what actually ships.
 */

import { FIRM_INDICES, firmKey } from "@/lib/sim/configs/mandi";
import { lineFor, getPersona } from "./personas";
import type { MatchConfig } from "./setup";
import type { MatchState } from "./run";
import type { SeatView } from "./types";

/** One firm, as everyone can see it. */
export interface FirmView {
  seatIndex: number;
  name: string;
  isAi: boolean;
  isYou: boolean;
  price: number;
  served: number;
  share: number;
  /** Only ever your own. Null for a rival. */
  reputation: number | null;
  /** Only ever your own. Null for a rival. */
  capacity: number | null;
}

/** One control, straight off the config, plus what this seat currently holds. */
export interface DecisionView {
  key: string;
  label: string;
  help: string;
  kind: "integer" | "currency";
  min: number;
  max: number;
  step: number;
  value: number;
}

export interface YourNumbers {
  cash: number;
  revenue: number;
  cost: number;
  profit: number;
  served: number;
  capacity: number;
  utilisation: number;
  unitCost: number;
  reputation: number;
  reliability: number;
  actualMins: number;
}

export interface ArenaBoardData {
  matchId: string;
  gameLabel: string;
  premise: string;
  situation: string;
  mode: string;
  status: string;
  code: string | null;
  isHost: boolean;
  /** Your seat, or null if you are only watching. */
  seatIndex: number | null;
  round: number;
  totalRounds: number;
  /** Epoch millis, or null in a solo match, which waits for nobody. */
  roundEndsAt: number | null;
  /** True once you have committed this quarter. */
  committed: boolean;
  /** Seats that still owe a decision this quarter. Names only. */
  waitingOn: string[];
  seats: SeatView[];
  firms: FirmView[];
  decisions: DecisionView[];
  you: YourNumbers | null;
  /** What each rival did last quarter, in words. Authored, never generated. */
  chatter: { seatIndex: number; name: string; line: string }[];
  /** Order volume for the whole city, per quarter so far. */
  marketServed: number[];
  /** Your share, per quarter so far. */
  yourShare: number[];
}

function seriesOf(state: MatchState, key: string): number[] {
  // `history[k][0]` is the opening position, so a match with no quarters played
  // still has one entry and every consumer would plot it as quarter one. Drop it.
  return (state.ctx.state.history[key] ?? []).slice(1);
}

export function buildBoard(args: {
  matchId: string;
  config: MatchConfig;
  state: MatchState;
  seats: SeatView[];
  yourSeat: number | null;
  mode: string;
  status: string;
  code: string | null;
  isHost: boolean;
  committed: boolean;
  waitingOn: string[];
  roundEndsAt: Date | null;
}): ArenaBoardData {
  const { config, state, seats, yourSeat } = args;
  const now = state.ctx.state.current;
  const played = state.round > 0;

  const firms: FirmView[] = FIRM_INDICES.map((seat) => {
    const view = seats.find((s) => s.seatIndex === seat);
    const mine = yourSeat === seat;
    return {
      seatIndex: seat,
      name: view?.displayName || getPersona(view?.personaId ?? "")?.label || `Firm ${seat + 1}`,
      isAi: view?.isAi ?? true,
      isYou: mine,
      price: Math.round(now[firmKey(seat, "price")] ?? 0),
      served: Math.round(now[firmKey(seat, "served")] ?? 0),
      share: now[firmKey(seat, "share")] ?? 0,
      // Your own standing is yours to see. A rival's is not, and the null is
      // the payload saying so rather than a zero that reads like a fact.
      reputation: mine ? (now[firmKey(seat, "reputation")] ?? 1) : null,
      capacity: mine ? Math.round(now[firmKey(seat, "capacity")] ?? 0) : null,
    };
  });

  const you: YourNumbers | null =
    yourSeat === null
      ? null
      : {
          cash: now.cash ?? 0,
          revenue: now[firmKey(yourSeat, "revenue")] ?? 0,
          cost: now[firmKey(yourSeat, "cost")] ?? 0,
          profit: (now[firmKey(yourSeat, "revenue")] ?? 0) - (now[firmKey(yourSeat, "cost")] ?? 0),
          served: now[firmKey(yourSeat, "served")] ?? 0,
          capacity: now[firmKey(yourSeat, "capacity")] ?? 0,
          utilisation: now[firmKey(yourSeat, "utilisation")] ?? 0,
          unitCost: now[firmKey(yourSeat, "unitCost")] ?? 0,
          reputation: now[firmKey(yourSeat, "reputation")] ?? 1,
          reliability: now[firmKey(yourSeat, "reliability")] ?? 1,
          actualMins: now[firmKey(yourSeat, "actualMins")] ?? 0,
        };

  const decisions: DecisionView[] = config.decisions.map((d) => ({
    key: d.key,
    label: d.label,
    help: d.help,
    kind: d.kind,
    min: d.min,
    max: d.max,
    step: d.step,
    // What this seat played last quarter, so the controls open where the player
    // left them rather than snapping back to the config default every round.
    value:
      yourSeat === null ? d.default : (now[firmKey(yourSeat, d.key)] ?? d.default),
  }));

  // The postures the AI seats have ALREADY committed for the coming quarter.
  // Safe to show: it is what they are about to do, which is the information a
  // market gives you when a competitor changes its shelf price on Monday.
  const chatter = played
    ? state.pending.each.map((quote, i) => {
        const seat = Number(quote.actionId ? config.agents[i]?.id.split("@")[1] : NaN);
        const view = seats.find((s) => s.seatIndex === seat);
        return {
          seatIndex: seat,
          name: view?.displayName || getPersona(view?.personaId ?? "")?.label || "A rival",
          line: lineFor(view?.personaId ?? "", quote.actionId),
        };
      }).filter((c) => Number.isInteger(c.seatIndex) && c.line)
    : [];

  return {
    matchId: args.matchId,
    gameLabel: config.label,
    premise: config.premise,
    situation: config.situation,
    mode: args.mode,
    status: args.status,
    code: args.code,
    isHost: args.isHost,
    seatIndex: yourSeat,
    round: state.round,
    totalRounds: config.horizon,
    roundEndsAt: args.roundEndsAt ? args.roundEndsAt.getTime() : null,
    committed: args.committed,
    waitingOn: args.waitingOn,
    seats,
    firms,
    decisions,
    you,
    chatter,
    marketServed: seriesOf(state, "marketServed"),
    yourShare: yourSeat === null ? [] : seriesOf(state, firmKey(yourSeat, "share")),
  };
}

// ─── The debrief ───────────────────────────────────────────────────────────

export interface DebriefSeat {
  seatIndex: number;
  name: string;
  isAi: boolean;
  isYou: boolean;
  placing: number;
  overall: number;
  band: string;
  npv: number;
  scores: { key: string; label: string; hint: string; weight: number; value: number }[];
  kpis: { key: string; label: string; unit: string; value: number; goodDirection: string }[];
  /**
   * What this rival was actually playing for. Withheld for the whole match and
   * released here, which is the point of having one — a debrief that only told
   * you your own score would be a report card rather than an explanation.
   */
  objective: string | null;
}

export interface ArenaDebriefData {
  matchId: string;
  gameLabel: string;
  totalRounds: number;
  seats: DebriefSeat[];
  /** What this market paid a firm that never revisited its opening decisions. */
  reference: { p10: number; median: number; p90: number };
  marketServed: number[];
  /** Every firm's price per quarter, so the price war is visible after the fact. */
  priceHistory: { seatIndex: number; name: string; isYou: boolean; prices: number[] }[];
}

export function buildDebrief(args: {
  matchId: string;
  config: MatchConfig;
  state: MatchState;
  seats: SeatView[];
  yourSeat: number | null;
  scores: {
    seatIndex: number;
    overall: number;
    band: string;
    npv: number;
    scores: Record<string, number>;
    kpis: { key: string; label: string; unit: string; value: number; goodDirection: string }[];
  }[];
  placings: Record<number, number>;
  reference: { p10: number; median: number; p90: number };
}): ArenaDebriefData {
  const { config, state, seats, yourSeat } = args;

  const nameOf = (seat: number) => {
    const view = seats.find((s) => s.seatIndex === seat);
    return view?.displayName || getPersona(view?.personaId ?? "")?.label || `Firm ${seat + 1}`;
  };

  return {
    matchId: args.matchId,
    gameLabel: config.label,
    totalRounds: config.horizon,
    seats: args.scores
      .slice()
      .sort((a, b) => (args.placings[a.seatIndex] ?? 9) - (args.placings[b.seatIndex] ?? 9))
      .map((s) => {
        const view = seats.find((v) => v.seatIndex === s.seatIndex);
        return {
          seatIndex: s.seatIndex,
          name: nameOf(s.seatIndex),
          isAi: view?.isAi ?? true,
          isYou: yourSeat === s.seatIndex,
          placing: args.placings[s.seatIndex] ?? 0,
          overall: s.overall,
          band: s.band,
          npv: s.npv,
          scores: config.rubric.map((dim) => ({
            key: dim.key,
            label: dim.label,
            hint: dim.hint,
            weight: dim.weight,
            value: s.scores[dim.key] ?? 0,
          })),
          kpis: s.kpis,
          objective: view?.isAi ? (getPersona(view.personaId)?.objective ?? null) : null,
        };
      }),
    reference: args.reference,
    marketServed: seriesOf(state, "marketServed"),
    priceHistory: FIRM_INDICES.map((seat) => ({
      seatIndex: seat,
      name: nameOf(seat),
      isYou: yourSeat === seat,
      prices: seriesOf(state, firmKey(seat, "price")).map((p) => Math.round(p)),
    })),
  };
}
