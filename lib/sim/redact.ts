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
 * `cause.unactionable`, `intervention.addresses`, `intervention.effects`,
 * `intervention.debrief`, `drilldown.evidenceFor`, `drilldown.readsAs`,
 * `drivers`, `drift`, `parInvestigation`, `bestAllocation`, `debrief`,
 * `coachFallback` — and every intervention that does not treat the cause the
 * run has named, which is the investment gate (see `toClientInterventions`).
 */

import type { SimPhase } from "@/lib/types";
import { resolveDrivers } from "./drivers";
import { metricMap } from "./metric-map";
import { visibleDashboard } from "./investigate";
import { responseFor, satiationMultiple } from "./response";
import { simConfig } from "@/lib/config/simulation";
import { permittedInterventions } from "./gating";
import { runSchedule } from "./outcome";
import { decisionPeriodsIn, moneyRemaining, openPeriodIn } from "./schedule";
import type {
  CauseId,
  ClientCause,
  ClientPeriods,
  SimAllocationLine,
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
  /**
   * The causes named at Commit, once locked. Empty until then.
   *
   * This is the gate: it decides which interventions exist as far as the client
   * is concerned. See `toClientInterventions`.
   */
  diagnosis: CauseId[];
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
    // Shipped so the card can say "reads alongside X". It gates nothing, and
    // it reveals nothing a student could not read off the two questions
    // themselves.
    dependsOn: d.dependsOn,
    owned: ctx.owned.includes(d.id),
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
 *
 * **Nothing ships until a diagnosis is locked, and then only what treats it.**
 * The redaction is the gate rather than the UI, for two reasons. Filtering in
 * the client would need `addresses` to cross the wire, which is the one field
 * that says which intervention answers which cause. And the mapping leaks the
 * answer on its own: the true cause usually has several fixes pointing at it
 * where a decoy has one, so "the branch with the most options" would be the
 * answer key. Since the diagnosis is persisted before this is ever called with
 * a non-empty one, nobody can enumerate the map by trying each cause in turn.
 */
function toClientInterventions(
  scenario: SimScenario,
  ctx: RedactionContext,
): ClientIntervention[] {
  const v2 = scenario.engine === "v2";
  return permittedInterventions(scenario, ctx.diagnosis).map((i) => {
    const client: ClientIntervention = {
      id: i.id,
      label: i.label,
      pitch: i.pitch,
      cost: i.cost,
      minSprints: i.minSprints,
      maxAskMultiple: i.maxAskMultiple,
    };
    if (!v2) return client;

    /**
     * Described from the ON-TARGET curve, deliberately.
     *
     * This runs after the diagnosis gate, so the board already holds only
     * fixes for the cause the student named — and describing each lever as
     * though their diagnosis were right is the only consistent thing to do.
     * Using whichever arm actually applies would make the shape of the readout
     * a tell about whether they got the cause right, which is exactly the
     * disclosure `permittedInterventions` exists to prevent.
     */
    const curve = responseFor(
      i,
      { driver: "", deltaPct: 0 },
      true,
      simConfig.responseDefaults,
    );
    const satiation = satiationMultiple(curve, simConfig.satiationFraction);
    client.saturationHint = {
      halfAtRupees:
        curve.kind === "hill" || curve.kind === "exponential"
          ? curve.halfAt * i.cost.rupees
          : i.cost.rupees,
      satiationRupees: satiation === null ? null : satiation * i.cost.rupees,
      capRupees: i.cost.rupees * (i.maxAskMultiple ?? simConfig.maxAskMultiple),
    };
    return client;
  });
}

/**
 * Why the cause they named has nothing to fund — once they have named it.
 *
 * Authored on `SimCause.unactionable` but shipped as a scenario-level field
 * rather than on the cause, so `ClientCause` keeps one uniform shape for every
 * cause. A cause carrying an extra field would itself be the tell, which is the
 * same reason `verdict` never ships (`tests/sim-redact.test.ts` pins the shape).
 *
 * Null until a diagnosis is locked, so it can only ever explain a decision
 * already made.
 */
function unactionableNote(scenario: SimScenario, diagnosis: CauseId[]): string | null {
  if (!diagnosis.length) return null;
  const named = new Set(diagnosis);
  const notes = scenario.causes
    .filter((c) => named.has(c.id) && c.unactionable)
    .map((c) => c.unactionable!.why);
  return notes.length ? notes.join(" ") : null;
}

/**
 * Where a multi-period run has got to, or nothing on a single commit.
 *
 * Every number is derived from the stored schedule, which is the same source
 * `commitDecision` re-reads to accept or refuse the next period. A client that
 * accumulated the pool itself would be a second copy of that arithmetic, and
 * the first time the two disagreed it would offer a commitment the server
 * rejects.
 */
export function toClientPeriods(
  scenario: SimScenario,
  schedule: SimAllocationLine[][],
  seed: string | null,
): ClientPeriods | undefined {
  const total = decisionPeriodsIn(scenario);
  if (total <= 1) return undefined;

  const driver = scenario.drivers.find((d) => d.id === scenario.northStar);
  const noun = scenario.periodNoun === "month" ? "M" : "Q";

  // Cut to the quarters that have actually been played. Done here rather than
  // in the component: the tail of this projection is what the allocation will
  // eventually do, which is the run's own question, and a boundary is the place
  // to stop that from crossing.
  const played =
    schedule.length === 0
      ? []
      : (runSchedule(scenario, schedule, { seed }).paths[scenario.northStar] ?? []).slice(
          0,
          schedule.length + 1,
        );

  return {
    total,
    // Null once every period is spent, which happens only in the moment before
    // the run flips to its debrief. Reporting the last one keeps a period index
    // of -1 off the screen in that gap.
    open: openPeriodIn(scenario, schedule) ?? total - 1,
    committed: schedule,
    moneyRemaining: moneyRemaining(scenario, schedule),
    observed: played.map((value, index) => ({
      label: index === 0 ? "Start" : `${noun}+${index}`,
      value,
    })),
    northStar: { label: driver?.label ?? "North star", unit: driver?.unit ?? "count" },
  };
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
    periodNoun: scenario.periodNoun ?? "quarter",
    // Definitions are the opposite of the answer, so they ship as authored.
    teaching: scenario.teaching ?? null,
    // The map, and therefore the shape of the model, only when the scenario
    // says so. Note this ships baseline values only — `drift` and every
    // intervention effect stay server-side, so it shows how the metrics relate
    // and never which lever fixes them.
    metricMap: scenario.teaching?.showMetricMap
      ? metricMap(scenario, resolveDrivers(scenario.drivers))
      : null,
    panels: visibleDashboard(scenario, ctx.owned),
    drilldowns,
    causes: toClientCause(scenario),
    interventions: toClientInterventions(scenario, ctx),
    unactionableNote: unactionableNote(scenario, ctx.diagnosis),
  };
}
