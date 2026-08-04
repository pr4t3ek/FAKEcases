/**
 * One-line prose summaries of an outcome.
 *
 * Kept apart from `./debrief.ts` because it is the only place in `lib/sim` that
 * formats rather than computes — it exists so the coach prompt can state what
 * happened in words the model can quote, instead of being handed raw paths and
 * inventing its own description of them.
 */

import type { OutcomeRow } from "./debrief";

function pct(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(1)}%`;
}

/** "Weekly orders +4.2%, contribution margin -18.0%, …" */
export function formatOutcomeSummary(rows: OutcomeRow[]): string {
  if (!rows.length) return "no metrics were projected";
  return rows.map((r) => `${r.label} ${pct(r.changePct)}`).join(", ");
}

/** Whether the run beat, matched or trailed doing nothing on this metric. */
export function comparedToDoingNothing(row: OutcomeRow): "better" | "worse" | "same" {
  const diff = row.actual - row.doNothing;
  if (Math.abs(diff) < Math.abs(row.baseline) * 1e-6) return "same";
  const better = diff > 0 === (row.goodDirection === "up");
  return better ? "better" : "worse";
}
