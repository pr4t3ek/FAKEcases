/**
 * The rivals, and which of them you get.
 *
 * Six personalities for three AI seats, drawn per match from the seed. That is
 * the third of the seven anti-memorisation devices in `lib/sim/configs/mandi.ts`
 * and the cheapest: a player who learns "seat 2 protects margin" has learned
 * something about one match rather than about the game.
 *
 * A persona is only a set of WEIGHTS over the four moves every rival shares
 * (`RIVAL_ACTIONS`). None of them has a move the others do not, and none has a
 * rule — the difference between Jhatpat and Shudh Basket is entirely that one
 * scores share at 1.9 and the other scores margin at 1.9, which is enough to
 * make them behave like different companies without a single branch.
 *
 * `objective` is never shown during a match and is revealed in the debrief. It
 * is descriptive rather than mechanical: it names what the weights already do,
 * so it cannot drift away from the behaviour it claims to explain.
 *
 * Pure and DB-free.
 */

import { createRng } from "@/lib/sim/engine/stochastic";
import { rivalAgent } from "@/lib/sim/configs/mandi";
import type { AgentConfig } from "@/lib/sim/configs/types";

export interface Persona {
  id: string;
  /** The firm's name, shown on the board. */
  label: string;
  /** One line, shown in the debrief beside what they actually did. */
  objective: string;
  utilityWeights: Record<string, number>;
  /** Higher is less predictable. */
  temperature: number;
  /** How hard a collapse in `peace` reprices holding still. */
  beliefWeight: number;
  /** Said when this persona picks that action. Authored, so the game costs no tokens to run. */
  lines: Record<string, string>;
}

/**
 * Six, so three seats can be filled 120 ways before order is even considered.
 *
 * Weights are spread deliberately rather than evenly: two of them will start a
 * price war on thin provocation, two will refuse to, and two sit between — so a
 * draw genuinely changes what the match is about rather than reshuffling the
 * same fight.
 */
export const PERSONAS: readonly Persona[] = [
  {
    id: "discounter",
    label: "Jhatpat",
    objective: "Buy the city. Margin is a problem for later.",
    utilityWeights: { margin: 0.6, share: 1.15, exposure: 1.3 },
    temperature: 0.35,
    beliefWeight: 2.2,
    lines: {
      premium: "Jhatpat holds a premium — for once.",
      hold: "Jhatpat sits tight and watches the board.",
      match: "Jhatpat comes down to meet the market.",
      undercut: "Jhatpat goes under everyone. Again.",
    },
  },
  {
    id: "premium",
    label: "Shudh Basket",
    objective: "Protect the margin. Let the discounters have the volume.",
    utilityWeights: { margin: 1.9, share: 0.6, exposure: 1.1 },
    temperature: 0.25,
    beliefWeight: 1.5,
    lines: {
      premium: "Shudh Basket pushes its price up and leans on service.",
      hold: "Shudh Basket holds, and says so loudly.",
      match: "Shudh Basket concedes a little on price.",
      undercut: "Shudh Basket breaks its own rule and cuts.",
    },
  },
  {
    id: "copycat",
    label: "Turant",
    objective: "Whatever won last quarter. Turant has no view of its own.",
    utilityWeights: { margin: 1.0, share: 1.0, exposure: 1.2 },
    temperature: 0.6,
    beliefWeight: 1.9,
    lines: {
      premium: "Turant tries a premium position on for size.",
      hold: "Turant does nothing in particular.",
      match: "Turant matches the board, a quarter late.",
      undercut: "Turant follows the cut down.",
    },
  },
  {
    id: "operator",
    label: "Ghar Se",
    objective: "Win on reliability, not price. Build ahead of demand.",
    utilityWeights: { margin: 1.35, share: 1.1, exposure: 0.75 },
    temperature: 0.3,
    beliefWeight: 1.1,
    lines: {
      premium: "Ghar Se charges for the ten-minute promise it actually keeps.",
      hold: "Ghar Se holds price and opens another store.",
      match: "Ghar Se meets the market and keeps building.",
      undercut: "Ghar Se buys share while it has the capacity to serve it.",
    },
  },
  {
    id: "raider",
    label: "Chhapaak",
    objective: "Start the war, survive it, buy what is left.",
    utilityWeights: { margin: 0.7, share: 1.4, exposure: 0.55 },
    temperature: 0.5,
    beliefWeight: 2.6,
    lines: {
      premium: "Chhapaak, of all people, raises its price.",
      hold: "Chhapaak is quiet this quarter. That rarely lasts.",
      match: "Chhapaak matches, and looks like it is measuring something.",
      undercut: "Chhapaak opens a front. Price goes through the floor.",
    },
  },
  {
    id: "cautious",
    label: "Nitya",
    objective: "Do not lose money. Growth is somebody else's mandate.",
    utilityWeights: { margin: 1.6, share: 0.8, exposure: 1.6 },
    temperature: 0.24,
    beliefWeight: 1.3,
    lines: {
      premium: "Nitya quietly raises price and stops spending.",
      hold: "Nitya holds everything exactly where it was.",
      match: "Nitya matches, reluctantly.",
      undercut: "Nitya cuts, which means it thinks it has no choice.",
    },
  },
];

const BY_ID: Record<string, Persona> = Object.fromEntries(PERSONAS.map((p) => [p.id, p]));

export function getPersona(id: string): Persona | undefined {
  return BY_ID[id];
}

/**
 * Which persona sits in which seat, drawn from the match seed.
 *
 * A partial Fisher–Yates over a copy, so the same seed always deals the same
 * table and no persona appears twice. Seat 0's draw is made and kept even
 * though seat 0 is normally a person: a seat can be handed to the AI when
 * somebody drops, and the personality that takes over should be the one that
 * was always notionally sitting there rather than one invented at the moment of
 * the drop.
 */
export function dealPersonas(seed: string, seats: number): string[] {
  const rng = createRng(`${seed}:personas`);
  const pool = PERSONAS.map((p) => p.id);

  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  // Wraps rather than throwing if a future board is wider than the pool: a
  // repeated personality is a duller match, not a broken one.
  return Array.from({ length: seats }, (_, i) => pool[i % pool.length]);
}

/** The agent that plays `seatIndex`, wired to that seat's state keys. */
export function agentFor(personaId: string, seatIndex: number): AgentConfig {
  const persona = getPersona(personaId) ?? PERSONAS[0];
  return rivalAgent({
    seat: seatIndex,
    id: persona.id,
    label: persona.label,
    utilityWeights: persona.utilityWeights,
    temperature: persona.temperature,
    beliefWeight: persona.beliefWeight,
  });
}

/** What a persona says when it takes an action. Empty for an unknown pairing. */
export function lineFor(personaId: string, actionId: string): string {
  return getPersona(personaId)?.lines[actionId] ?? "";
}
