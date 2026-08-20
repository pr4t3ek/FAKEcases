/**
 * A counterparty that decides rather than obeys.
 *
 * The whole module is three steps: score each action with a weighted utility,
 * turn the scores into a distribution with a softmax, sample. There is no
 * branch on any state variable anywhere in this file — no `if (trust < 0.5)`,
 * no floor, no special case. A supplier that has stopped trusting you offers a
 * worse buyback because the belief term entered its utility and moved the
 * distribution, and that is the only mechanism available.
 *
 * That matters beyond tidiness. A rule produces a cliff the student learns to
 * stand next to; a distribution produces a drift they have to read. And when
 * the config changes the weights, the behaviour changes with it, which a rule
 * would not.
 */

import type { Rng } from "./stochastic";
import type { AgentActionConfig, AgentConfig } from "@/lib/sim/configs/types";

export interface AgentQuote {
  actionId: string;
  label: string;
  /** State key → the level this action offers. */
  offers: Record<string, number>;
  /** Expected utility per action, for the debrief. */
  utilities: Record<string, number>;
  /** The sampled distribution, so a run can be explained after the fact. */
  probabilities: Record<string, number>;
}

/**
 * Weighted sum of an action's terms, minus a belief-scaled exposure penalty.
 *
 * The shape matters and the obvious alternative is wrong. Scaling the WHOLE
 * utility by a trust factor — `base × (1 + w(b − ½))` — leaves the ranking of
 * the actions identical at every belief, because multiplying every score by the
 * same positive number cannot reorder them. It only sharpens or flattens the
 * softmax, so a collapse in trust would make the supplier more random rather
 * than more careful. That is not the behaviour anybody means.
 *
 * So the belief attaches to ONE named term — the exposure the action leaves the
 * agent carrying — and enters as a penalty weighted by `(1 − belief)`. A
 * generous buyback is a large exposure: nearly free to offer someone you trust,
 * expensive to offer someone you do not. The ranking then genuinely reorders as
 * belief moves, which is the whole mechanism, and there is still no branch
 * anywhere on the belief value.
 */
export function expectedUtility(
  action: AgentActionConfig,
  weights: Record<string, number>,
  belief: number,
  beliefWeight: number,
  exposureTerm: string,
): number {
  let base = 0;
  for (const [term, value] of Object.entries(action.terms)) {
    if (term === exposureTerm) continue;
    base += (weights[term] ?? 0) * value;
  }

  const exposure = action.terms[exposureTerm] ?? 0;
  const penalty = (weights[exposureTerm] ?? 0) * exposure * (1 - belief) * beliefWeight;
  return base - penalty;
}

/**
 * Softmax over expected utilities: `P(a) ∝ exp(EU(a) / T)`.
 *
 * The max is subtracted before exponentiating — standard, and not cosmetic
 * here: utilities are money-scaled, so `exp` overflows to Infinity on a
 * realistic config and every probability becomes NaN.
 */
export function softmax(utilities: number[], temperature: number): number[] {
  const t = Math.max(temperature, 1e-6);
  const max = Math.max(...utilities);
  const exps = utilities.map((u) => Math.exp((u - max) / t));
  const total = exps.reduce((s, e) => s + e, 0);
  return total === 0 ? exps.map(() => 1 / exps.length) : exps.map((e) => e / total);
}

/** Sample an index from a distribution using one draw. */
export function sampleFrom(rng: Rng, probabilities: number[]): number {
  const u = rng.next();
  let cumulative = 0;
  for (let i = 0; i < probabilities.length; i++) {
    cumulative += probabilities[i];
    if (u < cumulative) return i;
  }
  return probabilities.length - 1;
}

/**
 * The agent's quote for the coming period.
 *
 * Takes state rather than reading anything global, so the same function serves
 * the live run, a Monte Carlo path and a counterfactual replay.
 */
export function quote(args: {
  config: AgentConfig;
  state: Record<string, number>;
  rng: Rng;
}): AgentQuote {
  const { config, state, rng } = args;
  const belief = state[config.beliefKey] ?? 0.5;

  const utilities = config.actions.map((a) =>
    expectedUtility(a, config.utilityWeights, belief, config.beliefWeight, config.exposureTerm),
  );
  const probabilities = softmax(utilities, config.temperature);
  const chosen = config.actions[sampleFrom(rng, probabilities)];

  return {
    actionId: chosen.id,
    label: chosen.label,
    offers: chosen.offers,
    utilities: Object.fromEntries(config.actions.map((a, i) => [a.id, utilities[i]])),
    probabilities: Object.fromEntries(config.actions.map((a, i) => [a.id, probabilities[i]])),
  };
}

/**
 * The quote the agent would offer on average, with no sampling.
 *
 * Used by the rolling valuation, which must not consume a draw — pulling from
 * the generator to value a run would change the run being valued.
 */
export function expectedOffer(
  config: AgentConfig,
  state: Record<string, number>,
  key: string,
): number {
  const belief = state[config.beliefKey] ?? 0.5;
  const utilities = config.actions.map((a) =>
    expectedUtility(a, config.utilityWeights, belief, config.beliefWeight, config.exposureTerm),
  );
  const probabilities = softmax(utilities, config.temperature);
  return config.actions.reduce(
    (sum, action, i) => sum + probabilities[i] * (action.offers[key] ?? 0),
    0,
  );
}

/**
 * Every counterparty's quote for the coming period, and their offers merged.
 *
 * A domain with one counterparty passes an array of one; a market with three
 * rivals passes three. Merging is a plain spread because a config gives each
 * agent its own offer keys — two agents writing the same key would mean one of
 * them silently loses, which `validateAgents` refuses at authoring time rather
 * than leaving to discover in a debrief.
 *
 * Each agent draws from the SAME generator, in config order. That is what keeps
 * a match reproducible: the sequence of draws is a function of the seed and the
 * order agents are declared in, neither of which a player can move.
 */
export interface AgentQuotes {
  /** One per agent, in config order. */
  each: AgentQuote[];
  /** Every agent's offers, merged. */
  offers: Record<string, number>;
}

export function quoteAll(args: {
  agents: AgentConfig[];
  state: Record<string, number>;
  rng: Rng;
}): AgentQuotes {
  const each = args.agents.map((config) => quote({ config, state: args.state, rng: args.rng }));
  const offers: Record<string, number> = {};
  for (const q of each) Object.assign(offers, q.offers);
  return { each, offers };
}

/**
 * The expected level of one offer key across every agent that quotes it.
 *
 * A sum rather than a pick, because "which agent owns this key" is not
 * something a valuation should have to know. Agents that do not offer the key
 * contribute zero, so with the one-key-one-agent rule this is that agent's
 * expectation and nothing else.
 */
export function expectedOfferAcross(
  agents: AgentConfig[],
  state: Record<string, number>,
  key: string,
): number {
  return agents.reduce((sum, config) => sum + expectedOffer(config, state, key), 0);
}

/**
 * Authoring guard: no two agents may write the same offer key.
 *
 * Returns the offending keys rather than throwing, so a config test can report
 * all of them at once. Called by the arena's config test; cheap enough that a
 * second config-driven domain should call it too.
 */
export function duplicateOfferKeys(agents: AgentConfig[]): string[] {
  const seen = new Set<string>();
  const clashes = new Set<string>();
  for (const agent of agents) {
    const keys = new Set(agent.actions.flatMap((a) => Object.keys(a.offers)));
    for (const key of keys) {
      if (seen.has(key)) clashes.add(key);
      seen.add(key);
    }
  }
  return [...clashes].sort();
}
