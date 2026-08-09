/**
 * What a simulation format IS.
 *
 * A scenario carries the content — drivers, panels, causes, interventions. A
 * format carries the *verbs*: which phases a run moves through, what it is
 * graded on, and which screen renders it. Until this module existed there was
 * exactly one of these and it was implicit, spread across `SIM_PHASES` in
 * `lib/types.ts`, a `phase === …` cascade in `simulation-screen.tsx` and the
 * five dimensions of `simRubric` — which is why all twelve war rooms play
 * identically no matter how different their subject matter is.
 *
 * Pure data and DB-free, like the rest of `lib/sim`. The screen component is
 * resolved at the route, not here, so this module stays importable from tests
 * and from server code without dragging React in.
 */

/** One step in a run. `id` is what lands in `SimRun.phase`. */
export interface SimFormatPhase {
  id: string;
  /** Shown in the header stepper. */
  label: string;
  /** One line: what the student is being asked to do here. */
  help: string;
}

/**
 * A scored dimension.
 *
 * Structurally identical to an entry in `simRubric` (`lib/config/simulation.ts`)
 * — deliberately, because the war-room format is defined by handing that exact
 * array over. A second format supplies its own keys, which is the whole reason
 * `SimResult` grew a `scoresJson` column.
 */
export interface SimFormatRubricDim {
  key: string;
  label: string;
  hint: string;
  weight: number;
}

export interface SimFormat {
  slug: string;
  /** "War room", "Turnaround". Shown on the catalogue card. */
  label: string;
  /** One line on what makes playing this different. */
  tagline: string;
  /**
   * Ordered. A run advances one step at a time and never backwards — the rule
   * `canAdvanceSimPhase` enforces, now read off the format rather than off a
   * single global constant.
   */
  phases: SimFormatPhase[];
  rubric: readonly SimFormatRubricDim[];
}

/** Weighted mean over a format's own dimensions. */
export function weightedOverallFor(
  format: SimFormat,
  scores: Record<string, number>,
): number {
  let weighted = 0;
  let total = 0;
  for (const dim of format.rubric) {
    weighted += (scores[dim.key] ?? 0) * dim.weight;
    total += dim.weight;
  }
  return total === 0 ? 0 : Math.round(weighted / total);
}

/** Whether `to` is exactly one step past `from` in this format. */
export function canAdvanceIn(format: SimFormat, from: string, to: string): boolean {
  const ids = format.phases.map((p) => p.id);
  const at = ids.indexOf(from);
  return at >= 0 && ids[at + 1] === to;
}
