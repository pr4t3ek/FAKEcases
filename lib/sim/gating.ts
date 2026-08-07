/**
 * What a run is allowed to fund, given what it said was wrong.
 *
 * The bug this closes: `runOutcome(scenario, allocation)` takes only the
 * allocation, and decides whether an intervention works by reading
 * `scenario.trueCauseIds` — ground truth, never the student's claim. That is
 * *correct*; the world does not care what you believed. But it meant a run could
 * name the wrong cause, investigate nothing, fund the one intervention that
 * happens to fix the real problem, and score 100 on both decision and outcome.
 *
 * **So the fix is not in the scorer.** It is here and at the redaction boundary:
 * an allocation that treats a cause you did not name is made *unconstructible*,
 * rather than merely penalised after the fact. Do not "correct" `outcome.ts` to
 * read the diagnosis — the debrief compares your path against the do-nothing and
 * the authored best, and all three have to be computed the same way.
 *
 * Pure and DB-free, and deliberately the only place the cause-to-intervention
 * mapping is resolved: `redact.ts` uses it to decide what ships, and
 * `payload.ts` uses it to decide what is accepted. Two implementations of the
 * same rule is exactly how the gate would come apart.
 */

import type {
  CauseId,
  InterventionId,
  SimIntervention,
  SimScenario,
} from "./types";

/**
 * The interventions that address one of these causes.
 *
 * **Exact `addresses` equality, never ancestry.** Resolving descendants would
 * mean naming an area unlocked every fix beneath it, which turns the root into
 * the optimal shotgun and undoes the whole gate. `diagnosisSchema` refuses roots
 * for the same reason, so this is belt and braces on purpose.
 *
 * An empty diagnosis permits nothing — before you have said what is wrong there
 * is nothing you are entitled to treat.
 */
export function permittedInterventions(
  scenario: SimScenario,
  diagnosis: CauseId[],
): SimIntervention[] {
  if (!diagnosis.length) return [];
  const named = new Set(diagnosis);
  return scenario.interventions.filter((i) => named.has(i.addresses));
}

/** The same set, as ids, for the payload check. */
export function permittedInterventionIds(
  scenario: SimScenario,
  diagnosis: CauseId[],
): Set<InterventionId> {
  return new Set(permittedInterventions(scenario, diagnosis).map((i) => i.id));
}

/**
 * Which interventions point at each cause.
 *
 * Used by `validateScenario` to catch a nameable cause with no fix behind it —
 * under gating that would be a dead end, not merely a thin option.
 */
export function interventionsByLeaf(
  scenario: SimScenario,
): Map<CauseId, InterventionId[]> {
  const byCause = new Map<CauseId, InterventionId[]>();
  for (const iv of scenario.interventions) {
    const existing = byCause.get(iv.addresses);
    if (existing) existing.push(iv.id);
    else byCause.set(iv.addresses, [iv.id]);
  }
  return byCause;
}

/**
 * Causes a run may name that have nothing to fund.
 *
 * Not an error in itself — some causes are honestly unfixable, and a scenario
 * says so with `SimCause.unactionable`. This is what `validateScenario` compares
 * against that annotation.
 */
export function causesWithNoIntervention(scenario: SimScenario): CauseId[] {
  const byCause = interventionsByLeaf(scenario);
  const parents = new Set(scenario.causes.map((c) => c.parentId).filter(Boolean));
  return scenario.causes
    .filter((c) => !parents.has(c.id) && !byCause.has(c.id))
    .map((c) => c.id);
}
