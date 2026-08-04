/**
 * Build the debrief coach's context from a finished run.
 *
 * The counterpart to `lib/practice-context.ts`, and deliberately shaped the same
 * way so the coach rides the existing adapter, streaming and fallback machinery
 * without any of it needing to know a simulation exists.
 *
 * Only ever called for a run in the `debrief` phase. Before that the coach knows
 * the answer and would hand it over — `app/api/sim-coach/route.ts` enforces it.
 */

import { db } from "@/lib/db";
import { simRubric } from "@/lib/config/simulation";
import { getScenario } from "@/lib/sim/registry";
import { totalsByIntervention } from "@/lib/sim/outcome";
import { outcomeRows, trueCauseLabels } from "@/lib/sim/debrief";
import type { InterviewerContext, ConvMessage, SimCoachContext } from "@/lib/llm";
import { loadRun, outcomeFromResult, toRunState } from "@/lib/simulations";
import { formatOutcomeSummary } from "@/lib/sim/summary";

export async function loadSimCoachContext(
  runId: string,
): Promise<{ ctx: InterviewerContext; userId: string; phase: string } | null> {
  const run = await loadRun(runId);
  if (!run) return null;

  const scenario = getScenario(run.scenarioSlug);
  if (!scenario || !run.result) return null;

  const outcome = outcomeFromResult(run.result);
  if (!outcome) return null;

  const state = toRunState(run);
  const funded = totalsByIntervention(state.allocation);

  const messages: ConvMessage[] = (
    await db.simMessage.findMany({ where: { runId }, orderBy: { createdAt: "asc" } })
  ).map((m) => ({ role: m.role as ConvMessage["role"], content: m.content }));

  const simulation: SimCoachContext = {
    scenarioTitle: scenario.title,
    company: scenario.company,
    trueCauseLabels: trueCauseLabels(scenario),
    causalChain: scenario.debrief.causalChain,
    whereTheLeverageWas: scenario.debrief.whereTheLeverageWas,
    strongAnswer: scenario.debrief.strongAnswer,
    studentDiagnosis: state.diagnosis.flatMap((id) => {
      const cause = scenario.causes.find((c) => c.id === id);
      return cause ? [cause.label] : [];
    }),
    studentAllocation: scenario.interventions
      .filter((iv) => funded.has(iv.id))
      .map((iv) => ({
        label: iv.label,
        sprints: funded.get(iv.id)!.sprints,
        rupees: funded.get(iv.id)!.rupees,
        onTarget: scenario.trueCauseIds.includes(iv.addresses),
      })),
    scores: simRubric.map((dim) => ({
      label: dim.label,
      value: run.result![dim.key],
    })),
    outcomeSummary: formatOutcomeSummary(outcomeRows(scenario, outcome)),
    // Same shape and contract as Question.dataPack, so the mock's proven
    // longest-topic-wins matcher answers offline exactly as it does for a case.
    facts: scenario.coachFallback.map((f) => ({ topic: f.topic, fact: f.answer })),
  };

  const ctx: InterviewerContext = {
    question: {
      title: scenario.title,
      prompt: scenario.premise,
      category: "Product Management",
      difficulty: scenario.difficulty,
      interviewLevel: "PM",
      idealLow: null,
      idealHigh: null,
      unit: null,
      betterApproach: scenario.debrief.whereTheLeverageWas,
      sampleSolution: scenario.debrief.strongAnswer,
    },
    mode: "teacher",
    answerMode: "qualitative",
    messages,
    assumptions: [],
    framework: [],
    dataPack: simulation.facts,
    hintsUsed: 0,
    simulation,
  };

  return { ctx, userId: run.userId, phase: run.phase };
}
