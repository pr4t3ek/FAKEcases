/**
 * The run's flight recorder.
 *
 * The debrief promises to reconstruct alternate histories, and it can only do
 * that if the original history is complete: the decision, every random draw
 * that followed it, and the state it left behind. A summary is not enough — a
 * counterfactual needs the draws, or it is a different world rather than the
 * same world with one choice changed.
 *
 * Named `journal` rather than `replay` because `lib/sim/replay.ts` already
 * exists and means something else (which of a question's runs count for a
 * ranking).
 *
 * Pure and domain-agnostic: entries carry names and numbers, and nothing here
 * knows what any of them mean.
 */

/** Something the engine sampled. Recorded with where it sat in its own tail. */
export interface JournalDraw {
  /** "demandShock", "yield" — the config's name for it. */
  name: string;
  value: number;
  /** Position in its own distribution, [0,1]. What the scenario library reads. */
  percentile?: number;
}

/** One tick, in full. */
export interface JournalEntry {
  tick: number;
  /** What the student chose. Keys are the config's decision variables. */
  decision: Record<string, number>;
  draws: JournalDraw[];
  /** State AFTER the tick resolved. */
  state: Record<string, number>;
  /** Scenario ids that fired this tick, if any. */
  scenarios: string[];
  /** Hidden variables, recorded now and revealed only in the debrief. */
  hidden: Record<string, number>;
  /** Cash movement and the running valuation, for the financial replay. */
  financial: Record<string, number>;
}

export interface RunJournal {
  seed: string;
  /** Config slug, so a journal can be read back against the right rules. */
  simulator: string;
  entries: JournalEntry[];
  /** Branch choices, keyed by the tick they were taken at. */
  branches: Record<number, string>;
}

export function openJournal(seed: string, simulator: string): RunJournal {
  return { seed, simulator, entries: [], branches: {} };
}

export function appendEntry(journal: RunJournal, entry: JournalEntry): RunJournal {
  return { ...journal, entries: [...journal.entries, entry] };
}

export function recordBranch(journal: RunJournal, tick: number, choiceId: string): RunJournal {
  return { ...journal, branches: { ...journal.branches, [tick]: choiceId } };
}

/**
 * The decisions, in order — everything needed to replay the run from its seed.
 *
 * This is what makes a counterfactual honest: re-run the engine from the same
 * seed with one decision swapped, and every draw lands identically because the
 * generator is a function of the seed and the call order, not of the choices.
 */
export function decisionsOf(journal: RunJournal): Record<string, number>[] {
  return journal.entries.map((e) => e.decision);
}

/** A single variable's path, for a trend line or a counterfactual comparison. */
export function pathOf(journal: RunJournal, key: string): number[] {
  return journal.entries.map((e) => e.state[key] ?? 0);
}

/** Hidden variable path — regime, trust — released once the run is over. */
export function hiddenPathOf(journal: RunJournal, key: string): number[] {
  return journal.entries.map((e) => e.hidden[key] ?? 0);
}

/**
 * Serialised for `SimRun.stateJson` and for the debrief's JSON export.
 *
 * Plain `JSON.stringify`: the journal is already only names and numbers, and a
 * bespoke format would be one more thing to keep in step with the type.
 */
export function serialiseJournal(journal: RunJournal): string {
  return JSON.stringify(journal);
}

export function parseJournal(raw: string | null): RunJournal | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<RunJournal>;
    if (!parsed.seed || !Array.isArray(parsed.entries)) return null;
    return {
      seed: parsed.seed,
      simulator: parsed.simulator ?? "",
      entries: parsed.entries as JournalEntry[],
      branches: parsed.branches ?? {},
    };
  } catch {
    return null;
  }
}
