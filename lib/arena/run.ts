/**
 * Replaying a match.
 *
 * State is not stored. A match row keeps its seed and its journal, and every
 * read rebuilds the whole market by running the engine forward again — the rule
 * `app/actions/simulations.ts` sets for config-driven runs, and the reason a
 * resumed match is provably the match that was left rather than a snapshot some
 * older build wrote.
 *
 * The quote stream is the part worth being careful about. Every AI seat draws
 * from ONE generator seeded `${seed}:quote`, in config order, once before each
 * round. So the rivals' moves are a function of the seed and the number of
 * rounds played — not of when the page was loaded, not of who was looking. That
 * is what makes an AI seat's behaviour reproducible in a debrief and in the
 * sweep, and it is why `reveal` was given its own generator in the first place.
 */

import { quoteAll, type AgentQuotes } from "@/lib/sim/engine/agent";
import { runTick, type RunContext } from "@/lib/sim/engine/time";
import { createRng, type Rng } from "@/lib/sim/engine/stochastic";
import { openJournal, type RunJournal } from "@/lib/sim/engine/journal";
import { firmKey, DECISION_KEYS } from "@/lib/sim/configs/mandi";
import { withOperations } from "./operations";
import { openMatchRun, type MatchConfig } from "./setup";

export interface MatchState {
  ctx: RunContext;
  /** The AI seats' committed intent for the round ABOUT to be played. */
  pending: AgentQuotes;
  /**
   * Those offers with capacity decided by the operating rule — what actually
   * goes into the tick. Kept beside `pending` rather than replacing it so the
   * debrief can still say which posture the rival chose.
   */
  offers: Record<string, number>;
  /** Rounds committed so far. */
  round: number;
  /**
   * The live quote generator, wound to exactly `round + 1` quotes.
   *
   * Carried rather than rebuilt on demand, because each quote is taken against
   * the state standing at that moment — the stream cannot be fast-forwarded
   * without replaying the market that produced it. A `MatchState` is rebuilt
   * per request and never serialised, so there is nothing here to keep in step
   * with a stored copy.
   */
  quoteRng: Rng;
}

/** Rebuild a match from its seed and journal. */
export function replayMatch(args: {
  config: MatchConfig;
  seed: string;
  journal: RunJournal | null;
}): MatchState {
  const { config, seed } = args;
  const journal = args.journal ?? openJournal(seed, config.slug);

  const aiSeats = agentSeats(config);

  let ctx = openMatchRun(config, seed, openJournal(seed, config.slug));
  const quoteRng = createRng(`${seed}:quote`);
  let pending = quoteAll({ agents: config.agents, state: ctx.state.current, rng: quoteRng });
  let offers = withOperations(pending.offers, ctx.state.current, aiSeats, config.initialState.unitCost, config.initialState.priceRef);

  for (const entry of journal.entries) {
    ctx = runTick(ctx, entry.decision, offers).ctx;
    pending = quoteAll({ agents: config.agents, state: ctx.state.current, rng: quoteRng });
    offers = withOperations(pending.offers, ctx.state.current, aiSeats, config.initialState.unitCost, config.initialState.priceRef);
  }

  return { ctx, pending, offers, round: journal.entries.length, quoteRng };
}

/**
 * Which seats an agent is playing, read off the agent ids.
 *
 * `rivalAgent` mints an id of `persona@seat`, so the seat is recoverable from
 * the config alone — which matters because `MatchConfig` is the only thing the
 * sweep and the Monte Carlo carry, and neither of them has a seat table.
 */
export function agentSeats(config: MatchConfig): number[] {
  return config.agents
    .map((agent) => Number(agent.id.split("@")[1]))
    .filter((seat) => Number.isInteger(seat));
}

/**
 * Turn one seat's four numbers into the state keys the engine reads.
 *
 * Decisions are authored unnamespaced in `config.decisions` — one seat's
 * controls — and namespaced here per seat. That is what lets the same bounds,
 * the same labels and the same validation serve four players.
 */
export function namespaceDecision(
  seatIndex: number,
  values: Record<string, number>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const key of DECISION_KEYS) {
    const value = values[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      out[firmKey(seatIndex, key)] = value;
    }
  }
  return out;
}

/** Read one seat's four numbers back out of engine state. */
export function readSeatDecision(
  seatIndex: number,
  state: Record<string, number>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const key of DECISION_KEYS) out[key] = state[firmKey(seatIndex, key)] ?? 0;
  return out;
}

/**
 * Clamp a submitted decision to the config's own bounds and grid.
 *
 * The client renders these controls from the same `config.decisions`, so a
 * value outside them can only arrive from a hand-rolled call — and this is the
 * control, not the slider. Clamping rather than rejecting because a round must
 * always be able to resolve: a refused decision would stall three other people
 * waiting on this seat, and the honest reading of an out-of-range number is the
 * nearest legal one.
 */
export function sanitiseDecision(
  config: MatchConfig,
  values: Record<string, unknown>,
): Record<string, number> {
  const out: Record<string, number> = {};

  for (const spec of config.decisions) {
    const raw = Number(values[spec.key]);
    const value = Number.isFinite(raw) ? raw : spec.default;
    const stepped = Math.round((value - spec.min) / spec.step) * spec.step + spec.min;
    out[spec.key] = Math.min(spec.max, Math.max(spec.min, stepped));
  }

  return out;
}

/** The decision every seat that has not chosen falls back to: what it did last. */
export function carryForward(
  config: MatchConfig,
  seatIndex: number,
  state: Record<string, number>,
): Record<string, number> {
  return sanitiseDecision(config, readSeatDecision(seatIndex, state));
}

/**
 * Commit one round. `decision` holds every human seat's namespaced keys; the AI
 * seats' keys come from the quote already standing on `state.pending`, which is
 * what makes them a move made BEFORE seeing yours rather than a reply to it.
 */
export function stepMatch(
  state: MatchState,
  decision: Record<string, number>,
  config: MatchConfig,
): MatchState {
  const stepped = runTick(state.ctx, decision, state.offers);
  const pending = quoteAll({
    agents: config.agents,
    state: stepped.ctx.state.current,
    rng: state.quoteRng,
  });

  return {
    ctx: stepped.ctx,
    pending,
    offers: withOperations(pending.offers, stepped.ctx.state.current, agentSeats(config), config.initialState.unitCost, config.initialState.priceRef),
    round: state.round + 1,
    quoteRng: state.quoteRng,
  };
}
