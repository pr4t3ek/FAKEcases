/**
 * The client projection of a scenario.
 *
 * Everything in `SimScenario` that constitutes the answer has to stay on the
 * server. A Next.js server component serialises whatever it hands a client
 * component into the RSC payload, so anything passed down is readable in the
 * page source — the practice screen already guards against this by shipping
 * only `hasDataPack` and keeping the facts themselves server-side.
 *
 * A simulation has far more to hide, and it is hidden by construction rather
 * than by remembering: this module builds the client object field by field, so a
 * field added to `SimScenario` is absent from the payload until someone
 * deliberately adds it here. `tests/sim-redact.test.ts` serialises the result
 * and asserts the absence of every secret.
 *
 * Withheld: unowned `reveals`, `trueCauseIds`, `cause.verdict`,
 * `intervention.addresses`, `intervention.effects`, `intervention.debrief`,
 * `drilldown.evidenceFor`, `drilldown.readsAs`, `drivers`, `drift`,
 * `parInvestigation`, `bestAllocation`, `debrief`, `coachFallback`.
 */

import type { SimPhase } from "@/lib/types";
import { isUnlocked, visibleDashboard } from "./investigate";
import type {
  ClientCause,
  ClientDrilldown,
  ClientIntervention,
  ClientScenario,
  DrilldownId,
  SimScenario,
} from "./types";

export interface RedactionContext {
  phase: SimPhase;
  /** Purchased pulls, in purchase order. */
  owned: DrilldownId[];
}

/**
 * `evidenceFor` is stripped along with the data itself.
 *
 * It looks harmless — it names causes, not findings — but three pulls all
 * flagged for the same cause is a strong steer toward the answer, and the field
 * is only ever read by the scorer, which runs on the server.
 */
function toClientDrilldown(
  scenario: SimScenario,
  ctx: RedactionContext,
  id: DrilldownId,
): ClientDrilldown | null {
  const d = scenario.drilldowns.find((x) => x.id === id);
  if (!d) return null;
  return {
    id: d.id,
    label: d.label,
    question: d.question,
    cost: d.cost,
    dependsOn: d.dependsOn,
    owned: ctx.owned.includes(d.id),
    unlocked: isUnlocked(d, ctx.owned),
  };
}

function toClientCause(scenario: SimScenario): ClientCause[] {
  return scenario.causes.map((c) => ({
    id: c.id,
    parentId: c.parentId,
    label: c.label,
  }));
}

/**
 * Interventions keep their pitch and price and lose everything that says
 * whether they work. Choosing between them on the business case alone is the
 * decision being tested.
 */
function toClientInterventions(scenario: SimScenario): ClientIntervention[] {
  return scenario.interventions.map((i) => ({
    id: i.id,
    label: i.label,
    pitch: i.pitch,
    cost: i.cost,
    minSprints: i.minSprints,
  }));
}

export function toClientScenario(
  scenario: SimScenario,
  ctx: RedactionContext,
): ClientScenario {
  const drilldowns = scenario.drilldowns
    .map((d) => toClientDrilldown(scenario, ctx, d.id))
    .filter((d): d is ClientDrilldown => d !== null);

  return {
    slug: scenario.slug,
    title: scenario.title,
    company: scenario.company,
    premise: scenario.premise,
    situation: scenario.situation,
    difficulty: scenario.difficulty,
    budget: scenario.budget,
    horizonQuarters: scenario.horizonQuarters,
    panels: visibleDashboard(scenario, ctx.owned),
    drilldowns,
    causes: toClientCause(scenario),
    interventions: toClientInterventions(scenario),
  };
}
