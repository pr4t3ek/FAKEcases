/**
 * Grading four firms on one market.
 *
 * Two decisions worth stating, because both had an obvious alternative that is
 * wrong.
 *
 * **Every seat is graded on the same definitions, instantiated per seat.**
 * `kpisForSeat` in `lib/sim/configs/mandi.ts` is one function called four
 * times, rather than four blocks in a config. A rubric that differed by seat —
 * even by accident, even by a typo in one key — would make a four-human match
 * unfair in a way nobody would notice until somebody lost by two points.
 *
 * **Value is graded against a distribution, not an absolute.** A run that
 * cleared ₹9 crore in a festive market and one that cleared ₹6 crore through
 * two squeezes have not done the same thing, and only the distribution can tell
 * them apart. This is the same principle `scoreRun` applies to the buyback and
 * `bestAllocation` applies to a war room: a score has to mean something
 * relative to what was reachable.
 *
 * The placings are separate from the scores and deliberately so — see
 * `placingsFor`.
 */

import { clamp } from "@/lib/utils";
import { bandForSimScore } from "@/lib/config/simulation";
import { weightedOverallFor } from "@/lib/sim/formats/types";
import { computeKpis, type KpiValue } from "@/lib/sim/engine/scoring";
import { quoteAll } from "@/lib/sim/engine/agent";
import { runTick } from "@/lib/sim/engine/time";
import { createRng } from "@/lib/sim/engine/stochastic";
import { openJournal } from "@/lib/sim/engine/journal";
import { rollingNpv } from "@/lib/sim/engine/financials";
import { kpisForSeat, mandiRubric } from "@/lib/sim/configs/mandi";
import { arenaFormat } from "./format";
import { seatBooks, type SeatBooks } from "./ledger";
import { agentSeats, namespaceDecision } from "./run";
import { withOperations } from "./operations";
import { openMatchRun, type MatchConfig } from "./setup";
import { ARENA_SEATS } from "./types";
import type { SimState } from "@/lib/sim/engine/state";

export interface SeatScore {
  seatIndex: number;
  scores: Record<string, number>;
  overall: number;
  band: string;
  kpis: KpiValue[];
  npv: number;
  /** Where this seat's value landed against the reference distribution, [0,1]. */
  riskPercentile: number;
}

export interface MatchDistribution {
  outcomes: number[];
  p10: number;
  median: number;
  p90: number;
}

/**
 * What this market pays a firm that picks a policy and never revisits it.
 *
 * The reference every seat's value is scored against, and the choice of policy
 * is the argument: a DEFAULT-holding firm is the honest zero, because it is
 * exactly the player who never read anything. Beating it should be most of what
 * a good score is.
 *
 * Its own function rather than the engine's `monteCarlo` for one reason that
 * matters: `monteCarlo` opens each path with `openRun`, which always starts at
 * regime 0, while a match starts on the regime its seed drew. Valuing an
 * eight-quarter run that began in a squeeze against a distribution that always
 * began steady would mark down every player who drew a hard market.
 */
export function referenceDistribution(args: {
  config: MatchConfig;
  seed: string;
  humanSeats: number[];
  paths?: number;
}): MatchDistribution {
  const { config, seed, humanSeats } = args;
  const paths = args.paths ?? config.monteCarloPaths;

  const holding: Record<string, number> = {};
  for (const seat of humanSeats) {
    Object.assign(
      holding,
      namespaceDecision(
        seat,
        Object.fromEntries(config.decisions.map((d) => [d.key, d.default])),
      ),
    );
  }

  const outcomes: number[] = [];
  for (let p = 0; p < paths; p++) {
    const pathSeed = `${seed}:mc:${p}`;
    let ctx = openMatchRun(config, pathSeed, openJournal(pathSeed, config.slug));
    const quoteRng = createRng(`${pathSeed}:quote`);

    const aiSeats = agentSeats(config);
    for (let t = 0; t < config.horizon; t++) {
      const offered = quoteAll({ agents: config.agents, state: ctx.state.current, rng: quoteRng });
      ctx = runTick(ctx, holding, withOperations(offered.offers, ctx.state.current, aiSeats, config.initialState.unitCost, config.initialState.priceRef)).ctx;
    }

    // Seat 0's books stand for "a firm in this market", which is sound because
    // the market is symmetric: every firm runs the same arithmetic on the same
    // constants, so a reference drawn from one seat is a reference for all.
    outcomes.push(seatBooks({ config, state: ctx.state, seatIndex: 0 }).npv);
  }

  outcomes.sort((a, b) => a - b);
  const at = (q: number) => outcomes[clamp(Math.floor(q * outcomes.length), 0, outcomes.length - 1)];

  return { outcomes, p10: at(0.1), median: at(0.5), p90: at(0.9) };
}

function percentileIn(outcomes: number[], value: number): number {
  if (outcomes.length === 0) return 0.5;
  return outcomes.filter((o) => o <= value).length / outcomes.length;
}

/** One seat's grade. */
export function scoreSeat(args: {
  config: MatchConfig;
  state: SimState;
  seatIndex: number;
  distribution: MatchDistribution;
  books?: SeatBooks;
}): SeatScore {
  const { config, state, seatIndex, distribution } = args;
  const books = args.books ?? seatBooks({ config, state, seatIndex });

  const kpis = computeKpis({
    // The same evaluator every other simulator is graded through, handed this
    // seat's KPI definitions. A private copy of the formulas here is exactly
    // how the arena would drift away from the engine it claims to reuse.
    config: { ...config, kpis: kpisForSeat(seatIndex) },
    state,
    cashFlows: books.cashFlows,
    receivables: books.receivables,
    payables: books.payables,
  });

  const npv = kpis.find((k) => k.key === config.primaryKpi)?.value ?? books.npv;
  const riskPercentile = percentileIn(distribution.outcomes, npv);

  const byKey = Object.fromEntries(kpis.map((k) => [k.key, k.value]));
  const scores: Record<string, number> = {};
  for (const dim of mandiRubric) {
    scores[dim.key] =
      dim.key === config.primaryKpi
        ? Math.round(riskPercentile * 100)
        : clamp(Math.round((byKey[dim.key] ?? 0) * 100), 0, 100);
  }

  const overall = weightedOverallFor(arenaFormat, scores);
  return { seatIndex, scores, overall, band: bandForSimScore(overall), kpis, npv, riskPercentile };
}

/**
 * Where every seat finished, 1 to 4.
 *
 * On **enterprise value**, not on the weighted overall — and the two genuinely
 * disagree, which is the point. Overall is a report card: it rewards a firm
 * that ran a tidy, reliable, well-capitalised business. Placing is who won the
 * market. A player who took second place with a better report card should be
 * told both things rather than have one of them quietly relabelled as the other.
 *
 * Ties break on the tidier business, then on seat order, so the result is
 * total and reproducible.
 */
export function placingsFor(scores: SeatScore[]): Record<number, number> {
  const ordered = scores.slice().sort((a, b) => {
    if (b.npv !== a.npv) return b.npv - a.npv;
    if (b.overall !== a.overall) return b.overall - a.overall;
    return a.seatIndex - b.seatIndex;
  });
  return Object.fromEntries(ordered.map((s, i) => [s.seatIndex, i + 1]));
}

/** Every seat, graded together. */
export function scoreMatch(args: {
  config: MatchConfig;
  state: SimState;
  seed: string;
  humanSeats: number[];
  paths?: number;
}): { scores: SeatScore[]; placings: Record<number, number>; distribution: MatchDistribution } {
  const distribution = referenceDistribution(args);
  const scores = Array.from({ length: ARENA_SEATS }, (_, seatIndex) =>
    scoreSeat({ config: args.config, state: args.state, seatIndex, distribution }),
  );
  return { scores, placings: placingsFor(scores), distribution };
}

/** Re-exported so a caller scoring one seat need not reach for the engine. */
export { rollingNpv };
