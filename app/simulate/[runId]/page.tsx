import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { isRealProvider } from "@/lib/llm";
import { getAdapter } from "@/lib/llm";
import { loadScenario } from "@/lib/scenario-store";
import { toClientScenario } from "@/lib/sim/redact";
import { metricMap } from "@/lib/sim/metric-map";
import { resolveDrivers } from "@/lib/sim/drivers";
import {
  allocationComparison,
  investigationTrail,
  missedEvidence,
  outcomeRows,
  trueCauseLabels,
} from "@/lib/sim/debrief";
import { loadRun, outcomeFromResult, ownedInOrder, toRunState } from "@/lib/simulations";
import { parseJson, parseJsonArray } from "@/lib/json";
import { questionLeaderboard, questionStanding } from "@/lib/leaderboard";
import type { FeedbackItem, SimPhase } from "@/lib/types";
import { SimulationScreen } from "@/components/simulation/simulation-screen";
import { TurnaroundScreen } from "@/components/simulation/turnaround-screen";
import { SimulationReport } from "@/components/simulation/simulation-report";
import type {
  SimulationData,
  SimulationReportData,
  TurnaroundData,
} from "@/components/simulation/types";
import { formatFor, isTurnaround } from "@/lib/sim/formats/registry";
import { pathsForSchedule } from "@/lib/sim/outcome";
import {
  decisionPeriodsFor,
  openPeriod,
  parseTurnaroundState,
} from "@/lib/sim/turnaround";

export const dynamic = "force-dynamic";

export default async function SimulatePage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;
  const user = await getSessionUser();
  if (!user) redirect("/simulations");

  const run = await loadRun(runId);
  if (!run || run.userId !== user.id) redirect("/simulations");

  const scenario = await loadScenario(run.scenarioSlug);
  // A run can outlive the scenario it was played against — a removed scenario
  // should send you back to the library, not throw.
  if (!scenario) redirect("/simulations");

  const state = toRunState(run);

  // ── Committed → the debrief ───────────────────────────────────────────────
  if (run.phase === "debrief" && run.result) {
    const outcome = outcomeFromResult(run.result);
    if (!outcome) redirect("/simulations");

    const rows = outcomeRows(scenario, outcome);
    // Present for any format that stores its scores as JSON; null for the twelve
    // war rooms, which keep using the typed columns.
    const storedScores = parseJson<Record<string, number>>(run.result.scoresJson);
    const nsPath = outcome.paths[scenario.northStar] ?? [];

    // The board is keyed on the catalogue question, not the scenario slug, so a
    // simulation ranks alongside every other question in the same table.
    const [simBoard, simStanding] = await Promise.all([
      questionLeaderboard(run.questionId),
      questionStanding(user.id, run.questionId, run.id),
    ]);

    const data: SimulationReportData = {
      runId: run.id,
      questionId: run.questionId,
      isGuest: user.isGuest,
      title: scenario.title,
      company: scenario.company,
      overall: run.result.overall,
      band: run.result.band,
      causeFound: run.result.causeFound,
      daysSpent: run.result.daysSpent,
      daysPar: run.result.daysPar,
      // The format's rubric, not a constant. A turnaround writes its four
      // dimensions to `scoresJson` and leaves the five typed columns at zero,
      // because those columns are named after the war room's dimensions —
      // reading them here would report a turnaround as having scored nothing.
      scores: formatFor(scenario).rubric.map((dim) => ({
        key: dim.key,
        label: dim.label,
        hint: dim.hint,
        value:
          storedScores?.[dim.key] ??
          (dim.key in run.result! ? (run.result as unknown as Record<string, number>)[dim.key] : 0),
      })),
      feedback: parseJsonArray<FeedbackItem>(run.result.feedback),
      northStarLabel:
        scenario.drivers.find((d) => d.id === scenario.northStar)?.label ?? "North star",
      outcome: rows,
      northStarPaths: nsPath.map((value, q) => ({
        quarter: q === 0 ? "Now" : `${scenario.periodNoun === "month" ? "M" : "Q"}+${q}`,
        actual: value,
        doNothing: outcome.doNothing[scenario.northStar]?.[q] ?? value,
        best: outcome.best[scenario.northStar]?.[q] ?? value,
      })),
      allocation: allocationComparison(scenario, state.allocation, outcome),
      trail: investigationTrail(scenario, state.purchases),
      missed: missedEvidence(scenario, state.purchases),
      yourDiagnosis: state.diagnosis.flatMap((id) => {
        const cause = scenario.causes.find((c) => c.id === id);
        return cause ? [cause.label] : [];
      }),
      trueCauses: trueCauseLabels(scenario),
      periodNoun: scenario.periodNoun ?? "quarter",
      hasInvestigation: scenario.drilldowns.length > 0,
      budgetRupees: scenario.budget.rupees,
      // Built at end-of-horizon values rather than baseline, so the chain shows
      // where the student's decision actually landed. Safe to reveal here —
      // the run is over.
      metricMap: scenario.teaching?.showMetricMap
        ? metricMap(
            scenario,
            Object.fromEntries(
              Object.entries(outcome.paths).map(([id, path]) => [id, path[path.length - 1] ?? 0]),
            ),
          )
        : null,
      teaching: scenario.teaching ?? null,
      causalChain: scenario.debrief.causalChain,
      whereTheLeverageWas: scenario.debrief.whereTheLeverageWas,
      strongAnswer: scenario.debrief.strongAnswer,
      // Only whether a real provider is configured — the coach answers either
      // way, this just badges it honestly.
      coachAvailable: isRealProvider(getAdapter().name),
      leaderboard: simBoard.map((r) => ({
        userId: r.userId,
        rank: r.rank,
        name: r.name,
        college: r.college,
        value: r.score,
        detail: String(r.effort),
      })),
      standing: simStanding,
    };

    return <SimulationReport data={data} user={user} />;
  }

  // ── A turnaround, still playing ───────────────────────────────────────────
  //
  // Its own screen rather than a branch inside `SimulationScreen`: the format
  // owns its layout, and sharing the war room's chrome is exactly what would
  // make a second format feel like the first one.
  if (isTurnaround(scenario)) {
    const tState = parseTurnaroundState(run.stateJson);
    const periods = decisionPeriodsFor(scenario);
    const noun = scenario.periodNoun === "month" ? "M" : "Q";

    // Projected from the COMMITTED schedule only, and read no further than the
    // quarters already played. Values beyond that are the answer, and a server
    // component serialises whatever it hands a client one.
    const played = pathsForSchedule(scenario, tState.schedule);
    const shown = [scenario.northStar, ...scenario.reported];
    const labelOf = (id: string) =>
      scenario.drivers.find((d) => d.id === id)?.label ?? id;
    const unitOf = (id: string) =>
      scenario.drivers.find((d) => d.id === id)?.unit ?? "count";
    const directionOf = (id: string) =>
      scenario.drivers.find((d) => d.id === id)?.goodDirection;

    const byId = new Map(scenario.interventions.map((i) => [i.id, i]));
    const openAt = openPeriod(scenario, tState);

    const data: TurnaroundData = {
      runId: run.id,
      isGuest: user.isGuest,
      phase: run.phase,
      title: scenario.title,
      company: scenario.company,
      situation: scenario.situation,
      periodNoun: scenario.periodNoun ?? "quarter",
      budget: { sprints: scenario.budget.sprints, rupees: scenario.budget.rupees },
      openPeriod: openAt,
      periods: Array.from({ length: periods }, (_, p) => {
        const done = p < tState.schedule.length;
        return {
          period: p,
          label: `${noun}${p + 1}`,
          state: done ? ("done" as const) : p === openAt ? ("open" as const) : ("future" as const),
          committed: (tState.schedule[p] ?? []).map((line) => ({
            label: byId.get(line.interventionId)?.label ?? line.interventionId,
            sprints: line.sprints,
            rupees: line.rupees,
          })),
          // End-of-quarter values, only for quarters that have run.
          metrics: done
            ? shown.map((id) => {
                const path = played[id] ?? [];
                const value = path[p + 1] ?? path[0] ?? 0;
                const start = path[0] ?? 0;
                return {
                  driver: id,
                  label: labelOf(id),
                  value,
                  unit: unitOf(id),
                  deltaPct: start === 0 ? undefined : (value - start) / Math.abs(start),
                  goodDirection: directionOf(id),
                };
              })
            : [],
        };
      }),
      // Every option is on the table from the start — there is no diagnosis
      // gate here, so nothing is withheld behind one.
      interventions: scenario.interventions.map((iv) => ({
        id: iv.id,
        label: iv.label,
        pitch: iv.pitch,
        cost: iv.cost,
        minSprints: iv.minSprints,
      })),
      teaching: scenario.teaching ?? null,
      metricMap: scenario.teaching?.showMetricMap
        ? metricMap(scenario, resolveDrivers(scenario.drivers))
        : null,
      panels: scenario.dashboard,
    };

    return <TurnaroundScreen data={data} />;
  }

  // ── Still playing ─────────────────────────────────────────────────────────
  //
  // `toClientScenario` is the only scenario shape allowed across this boundary:
  // a server component serialises whatever it hands a client component into the
  // RSC payload, so the unredacted object would put the answer in the page
  // source. See lib/sim/redact.ts and tests/sim-redact.test.ts.
  const data: SimulationData = {
    runId: run.id,
    isGuest: user.isGuest,
    phase: run.phase as SimPhase,
    scenario: toClientScenario(scenario, {
      phase: run.phase as SimPhase,
      owned: ownedInOrder(run.purchases),
      // Empty until `lockDiagnosis` writes it, and that is what keeps the
      // intervention list empty until a cause has been named.
      diagnosis: state.diagnosis,
    }),
    daysSpent: run.daysSpent,
    hypothesis: state.hypothesis,
    hypothesisNote: run.hypothesisNote,
    purchaseCount: run.purchases.length,
    diagnosis: state.diagnosis,
  };

  return <SimulationScreen data={data} />;
}
