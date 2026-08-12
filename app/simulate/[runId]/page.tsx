import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { isRealProvider } from "@/lib/llm";
import { getAdapter } from "@/lib/llm";
import { loadScenario } from "@/lib/scenario-store";
import { toClientScenario } from "@/lib/sim/redact";
import { metricMap } from "@/lib/sim/metric-map";
import { wasRevised } from "@/lib/sim/hypothesis-log";
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
import { BuybackScreen } from "@/components/simulation/buyback/buyback-screen";
import { getSimulatorConfig } from "@/lib/sim/configs/registry";
import { openRun, reveal, runTick } from "@/lib/sim/engine/time";
import { quote } from "@/lib/sim/engine/agent";
import { createRng } from "@/lib/sim/engine/stochastic";
import { computeKpis, rollingValuation } from "@/lib/sim/engine/scoring";
import { openJournal, parseJournal } from "@/lib/sim/engine/journal";
import { toChartRows } from "@/lib/sim/engine/state";
import { openLedger, postPeriod } from "@/lib/sim/engine/financials";
import { SimulationReport } from "@/components/simulation/simulation-report";
import type {
  BuybackData,
  SimulationData,
  SimulationReportData,
  TurnaroundData,
} from "@/components/simulation/types";
import { formatFor, isTurnaround } from "@/lib/sim/formats/registry";
import { finalValue, pathsForSchedule } from "@/lib/sim/outcome";
import {
  decisionPeriodsFor,
  openPeriod,
  parseTurnaroundState,
} from "@/lib/sim/turnaround";

export const dynamic = "force-dynamic";

/** Prefer the catalogue's title, which is what the student clicked on. */
function scenarioTitleFor(fallback: string, questionTitle?: string): string {
  return questionTitle?.trim() || fallback;
}

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

  // ── A config-driven simulator ─────────────────────────────────────────────
  //
  // Checked BEFORE the scenario lookup, because a simulator has no authored
  // scenario and `loadScenario` would send it back to the catalogue.
  //
  // State is REPLAYED from the stored seed and journal rather than read from a
  // snapshot, which is what makes a resumed run provably the run that was left.
  const simulator = getSimulatorConfig(run.scenarioSlug);
  if (simulator) {
    const seed = run.seed ?? "";
    const journal = parseJournal(run.stateJson) ?? openJournal(seed, simulator.slug);

    let ctx = openRun(simulator, seed, openJournal(seed, simulator.slug));
    const quoteRng = createRng(`${seed}:quote`);
    let offered = quote({ config: simulator.agent, state: ctx.state.current, rng: quoteRng });
    let ledger = openLedger();
    let lastPosted = null as ReturnType<typeof postPeriod>["posted"] | null;

    for (const entry of journal.entries) {
      const stepped = runTick(ctx, entry.decision, offered.offers);
      ctx = stepped.ctx;
      lastPosted = stepped.posted;
      ledger = openLedger();
      offered = quote({ config: simulator.agent, state: ctx.state.current, rng: quoteRng });
    }
    void ledger;

    if (run.phase === "debrief" && run.result) {
      // The debrief is its own component; until it lands, a finished run shows
      // the last month rather than a blank page.
      redirect("/simulations");
    }

    const view = reveal(ctx, createRng(`${seed}:peek`));
    const monthIndex = journal.entries.length;
    const branchPoint = simulator.branchPoints.find((b) => b.atTick === monthIndex);
    const labelOf = (key: string) =>
      key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());

    const lastEntry = journal.entries[journal.entries.length - 1];
    const firedIds = new Set(lastEntry?.scenarios ?? []);

    const money = (n: number) => n;
    const data: BuybackData = {
      runId: run.id,
      isGuest: user.isGuest,
      phase: run.phase,
      title: scenarioTitleFor(simulator.label, run.question?.title),
      situation: simulator.situation,
      monthIndex,
      horizon: simulator.horizon,
      decisions: simulator.decisions.map((d) => ({
        key: d.key,
        label: d.label,
        help: d.help,
        kind: d.kind,
        min: d.min,
        max: d.max,
        step: d.step,
        value: lastEntry?.decision[d.key] ?? d.default,
      })),
      branch: branchPoint
        ? {
            prompt: branchPoint.prompt,
            options: branchPoint.options.map((o) => ({
              id: o.id,
              label: o.label,
              detail: o.detail,
            })),
            chosen: journal.branches[monthIndex] ?? null,
          }
        : null,
      quote: {
        stance: offered.label,
        wholesalePrice: offered.offers.wholesalePrice ?? 0,
        buybackPrice: offered.offers.buybackPrice ?? 0,
        buybackShare: offered.offers.buybackShare ?? 0,
      },
      narrative: simulator.scenarios
        .filter((sc) => firedIds.has(sc.id))
        .map((sc) => ({ id: sc.id, headline: sc.headline, body: sc.body })),
      signals: ["cash", "inventory", "unitsSold", "demand", "leadTime", "factoryUtilization"]
        .filter((k) => k in view.signals)
        .map((k) => ({
          key: k,
          label: labelOf(k),
          value: view.signals[k],
          unit: (k === "cash" ? "inr" : k === "leadTime" ? "days" : k === "factoryUtilization" ? "ratio" : "count") as BuybackData["signals"][number]["unit"],
        })),
      kpis: computeKpis({
        config: simulator,
        state: ctx.state,
        cashFlows: ctx.cashFlows,
        receivables: lastPosted?.balance.receivables ?? 0,
        payables: lastPosted?.balance.payables ?? 0,
      }).map((k) => ({
        key: k.key,
        label: k.label,
        value: k.key === "npv" ? rollingValuation(ctx) : k.value,
        unit: k.unit as BuybackData["kpis"][number]["unit"],
        goodDirection: k.goodDirection,
      })),
      trends: journal.entries.length
        ? toChartRows(ctx.state, ["cash", "unitsSold", "inventory"], (t) => (t === 0 ? "start" : `M${t}`))
        : [],
      statements: lastPosted
        ? {
            pnl: [
              { label: "Revenue", value: money(lastPosted.pnl.revenue) },
              { label: "Cost of goods", value: money(-lastPosted.pnl.costOfGoodsSold) },
              { label: "Gross profit", value: money(lastPosted.pnl.grossProfit), emphasis: true },
              { label: "Buyback credit", value: money(lastPosted.pnl.contractSettlement) },
              { label: "Operating cost", value: money(-lastPosted.pnl.operatingCost) },
              { label: "Net profit", value: money(lastPosted.pnl.netProfit), emphasis: true },
            ],
            balance: [
              { label: "Cash", value: money(lastPosted.balance.cash) },
              { label: "Receivables", value: money(lastPosted.balance.receivables) },
              { label: "Stock", value: money(lastPosted.balance.inventoryValue) },
              { label: "Payables", value: money(-lastPosted.balance.payables) },
              { label: "Net assets", value: money(lastPosted.balance.netAssets), emphasis: true },
            ],
            cashFlow: [
              { label: "Collected", value: money(lastPosted.cashFlow.collected) },
              { label: "Paid out", value: money(-lastPosted.cashFlow.paid) },
              { label: "Net movement", value: money(lastPosted.cashFlow.net), emphasis: true },
            ],
          }
        : null,
    };

    return <BuybackScreen data={data} />;
  }

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
      // Only worth showing when there is a change of mind to show. One entry is
      // the opening call, which the report already states twice.
      hypothesisTrail: wasRevised(state.hypothesisLog)
        ? state.hypothesisLog.revisions.map((r) => ({
            causes: r.causeIds.flatMap((id) => {
              const cause = scenario.causes.find((c) => c.id === id);
              return cause ? [cause.label] : [];
            }),
            note: r.note,
            afterPurchases: r.afterPurchases,
          }))
        : [],
      yourDiagnosis: state.diagnosis.flatMap((id) => {
        const cause = scenario.causes.find((c) => c.id === id);
        return cause ? [cause.label] : [];
      }),
      trueCauses: trueCauseLabels(scenario),
      periodNoun: scenario.periodNoun ?? "quarter",
      hasInvestigation: scenario.drilldowns.length > 0,
      budgetRupees: scenario.budget.rupees,
      variance: outcome.expected
        ? {
            realised: finalValue(outcome.paths, scenario.northStar),
            expected: finalValue(outcome.expected.paths, scenario.northStar),
          }
        : null,
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
