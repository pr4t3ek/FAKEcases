import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { isRealProvider } from "@/lib/llm";
import { getAdapter } from "@/lib/llm";
import { simRubric } from "@/lib/config/simulation";
import { loadScenario } from "@/lib/scenario-store";
import { toClientScenario } from "@/lib/sim/redact";
import { metricMap } from "@/lib/sim/metric-map";
import {
  allocationComparison,
  investigationTrail,
  missedEvidence,
  outcomeRows,
  trueCauseLabels,
} from "@/lib/sim/debrief";
import { loadRun, outcomeFromResult, ownedInOrder, toRunState } from "@/lib/simulations";
import { parseJsonArray } from "@/lib/json";
import type { FeedbackItem, SimPhase } from "@/lib/types";
import { SimulationScreen } from "@/components/simulation/simulation-screen";
import { SimulationReport } from "@/components/simulation/simulation-report";
import type { SimulationData, SimulationReportData } from "@/components/simulation/types";

export const dynamic = "force-dynamic";

export default async function SimulatePage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;
  const user = await getSessionUser();
  if (!user) redirect("/library");

  const run = await loadRun(runId);
  if (!run || run.userId !== user.id) redirect("/library");

  const scenario = await loadScenario(run.scenarioSlug);
  // A run can outlive the scenario it was played against — a removed scenario
  // should send you back to the library, not throw.
  if (!scenario) redirect("/library");

  const state = toRunState(run);

  // ── Committed → the debrief ───────────────────────────────────────────────
  if (run.phase === "debrief" && run.result) {
    const outcome = outcomeFromResult(run.result);
    if (!outcome) redirect("/library");

    const rows = outcomeRows(scenario, outcome);
    const nsPath = outcome.paths[scenario.northStar] ?? [];

    const data: SimulationReportData = {
      runId: run.id,
      isGuest: user.isGuest,
      title: scenario.title,
      company: scenario.company,
      overall: run.result.overall,
      band: run.result.band,
      causeFound: run.result.causeFound,
      daysSpent: run.result.daysSpent,
      daysPar: run.result.daysPar,
      scores: simRubric.map((dim) => ({
        key: dim.key,
        label: dim.label,
        hint: dim.hint,
        value: run.result![dim.key],
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
    };

    return <SimulationReport data={data} user={user} />;
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
    }),
    daysSpent: run.daysSpent,
    hypothesis: state.hypothesis,
    hypothesisNote: run.hypothesisNote,
    purchaseCount: run.purchases.length,
  };

  return <SimulationScreen data={data} />;
}
