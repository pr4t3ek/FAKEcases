/**
 * The run's state, and every value it has ever held.
 *
 * Two things live here because they must not drift apart: the current value of
 * each variable, and its history. A chart that reads a separately-maintained
 * array is a second copy of the truth, and the two disagree the first time
 * somebody writes a value without pushing it.
 *
 * History is stored as `Record<string, number[]>` — the same shape as `SimPaths`
 * in `lib/sim/types.ts`, which the existing dashboards already plot. Reusing the
 * shape rather than inventing one is why the buyback charts need no new
 * rendering code.
 *
 * Generic over the variable names, so nothing here knows what a "backlog" is.
 */

/** Values at a point in time. Domain supplies the keys. */
export type StateRecord<K extends string = string> = Record<K, number>;

/** Every value each variable has held, index 0 being the opening position. */
export type StateHistory<K extends string = string> = Record<K, number[]>;

export interface SimState<K extends string = string> {
  readonly current: StateRecord<K>;
  readonly history: StateHistory<K>;
  /** How many ticks have been committed. */
  readonly tick: number;
}

/**
 * Open a run.
 *
 * The opening values are pushed into history immediately, so index 0 is always
 * "before anything happened" and `history[k][t]` is the value at the END of tick
 * `t`. Charts and the debrief both rely on that alignment.
 */
export function openState<K extends string>(initial: StateRecord<K>): SimState<K> {
  const history = {} as StateHistory<K>;
  for (const key of Object.keys(initial) as K[]) {
    history[key] = [initial[key]];
  }
  return { current: { ...initial }, history, tick: 0 };
}

/**
 * Commit a tick: apply the changes, then record every variable.
 *
 * Every key is appended, not just the ones that moved — a variable that held
 * still still has a value this month, and a sparse history would make a flat
 * line indistinguishable from a missing one.
 *
 * Returns a new object rather than mutating, so a Monte Carlo path cannot
 * accidentally share state with the run the student is playing.
 */
export function commitTick<K extends string>(
  state: SimState<K>,
  changes: Partial<StateRecord<K>>,
): SimState<K> {
  const current = { ...state.current, ...changes } as StateRecord<K>;
  const history = {} as StateHistory<K>;

  for (const key of Object.keys(state.history) as K[]) {
    history[key] = [...state.history[key], current[key]];
  }

  return { current, history, tick: state.tick + 1 };
}

/** A variable's value `back` ticks ago, or its opening value if the run is younger. */
export function valueAt<K extends string>(state: SimState<K>, key: K, back: number): number {
  const series = state.history[key] ?? [];
  const index = series.length - 1 - back;
  return series[Math.max(0, index)] ?? state.current[key];
}

/** Change over the whole run so far, as a fraction of the opening value. */
export function changeSinceStart<K extends string>(state: SimState<K>, key: K): number {
  const series = state.history[key] ?? [];
  const start = series[0];
  if (start === undefined || start === 0) return 0;
  return (state.current[key] - start) / Math.abs(start);
}

/**
 * History as chart rows: one object per tick, keyed by variable.
 *
 * Recharts wants row-per-x rather than series-per-key, and doing the transpose
 * here keeps every consumer from writing the same loop.
 */
export function toChartRows<K extends string>(
  state: SimState<K>,
  keys: K[],
  label: (tick: number) => string,
): Record<string, number | string>[] {
  const length = Math.max(0, ...keys.map((k) => state.history[k]?.length ?? 0));
  return Array.from({ length }, (_, t) => {
    const row: Record<string, number | string> = { period: label(t) };
    for (const key of keys) row[key] = state.history[key]?.[t] ?? 0;
    return row;
  });
}
