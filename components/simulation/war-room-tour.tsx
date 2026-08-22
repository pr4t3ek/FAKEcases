"use client";

import { useMemo } from "react";
import { simBands, simConfig } from "@/lib/config/simulation";
import { warRoomFormat, periodicWarRoomFormat } from "@/lib/sim/formats/war-room";
import { GuidedTour, type TourStep } from "@/components/tour/guided-tour";
import type { SimPhase } from "@/lib/types";

/**
 * A guided walkthrough of the war room, anchored to the real elements via
 * `data-tour` attributes.
 *
 * The same contract as the practice screen's tour: every step says what the
 * thing is AND how it moves the score, because a scarce resource whose price is
 * never stated is a resource nobody spends carefully. The `ConceptPrimer` next
 * to it teaches the scenario's vocabulary — ROAS, contribution margin — and
 * deliberately says nothing about the screen or the rubric. This is the other
 * half.
 *
 * The closing step reads the dimensions and weights off the format itself, so
 * it cannot drift from what `lib/sim/score.ts` actually grades.
 *
 * ## Why a step can lose its anchor
 *
 * A run shows one phase at a time: the pull market does not exist during
 * Observe, and the hypothesis card is gone by Decide. Rather than hide those
 * steps — a tour of a four-phase run that only covers the phase you are in
 * teaches the sequence badly — a step names the phase it belongs to, and drops
 * its target outside that phase. The shell centres a targetless card, and the
 * copy is written to read that way ("later, when you reach Decide…").
 */

type Step = TourStep & {
  /** The phase this step's element exists in. Absent = present throughout. */
  phase?: SimPhase;
  /** The closing step, which renders the rubric under its body. */
  rubric?: boolean;
};

const PHASE_NAMES = warRoomFormat.phases.map((p) => p.label).join(" → ");

const STEPS: Step[] = [
  {
    title: "How a war room works",
    body:
      `A metric moved and nobody knows why. You commit to a suspect, buy the analyses that ` +
      `settle it, name the cause and put a quarter's capacity behind a fix — ${PHASE_NAMES}. ` +
      `This tour shows the screen and exactly how the run is graded.`,
    scoring:
      "Nothing is scored until the run ends, and it is graded on judgement rather than luck — " +
      "the outcome carries the lightest weight of the five.",
  },
  {
    target: "sim-phases",
    title: "Where you are in the run",
    body:
      `${PHASE_NAMES}. It only moves forward — there is no going back to buy one more analysis ` +
      `once you've moved on, which is what makes each step a decision rather than a draft.`,
  },
  {
    target: "sim-concepts",
    title: "The vocabulary, whenever you want it",
    body:
      "Every term this scenario uses, in plain English before the formula, with what it changes " +
      "about your decision. It opened when you arrived and this button brings it back — a " +
      "definition you can't find again is a definition you didn't read.",
    scoring: "Reading it costs nothing. Nothing here is timed and nothing here is scored.",
  },
  {
    target: "sim-metric-map",
    title: "How the number you're judged on is built",
    body:
      "Read left to right: each column is built from the one before it, and the slider icon marks " +
      "the things you can actually move. It's drawn from the same model the projection runs on, " +
      "so it can't disagree with the maths.",
    scoring:
      "This is where a cheap hypothesis comes from — the cause has to be somewhere in this chain.",
  },
  {
    target: "sim-dashboard",
    title: "The board you get for free",
    body:
      "Every panel here is yours before you spend anything, and it usually contains the answer to " +
      "at least one question you were about to pay for. What it rules out matters as much as what " +
      "it shows.",
    scoring:
      "Hypothesis quality is read off the call you make from this board, before a single " +
      "analyst-day is spent.",
  },
  {
    target: "sim-hypothesis",
    phase: "observe",
    title: "Commit before you spend",
    body:
      `Name at most ${simConfig.maxSuspects} suspects and say in one line what you'd expect the ` +
      `data to show if you're right. You can revise it as the evidence arrives — what you can't ` +
      `do is un-buy an analysis.`,
    scoring:
      "Naming half the board is not a hypothesis: every extra suspect multiplies this dimension " +
      `by ${simConfig.shotgunPenalty}, so a hedge that happens to contain the answer scores below ` +
      "a single committed call.",
  },
  {
    target: "sim-days",
    title: "Analyst-days — the only scarce thing here",
    body:
      "There is no clock in a war room. The budget is information, not time, so think as long as " +
      "you like and spend as little as you can.",
    scoring:
      `Every scenario has a par — the cheapest set of analyses that settles it. Going past par ` +
      `costs ${simConfig.overspendOverallPenalty} points off the overall for each multiple of it, ` +
      `on top of a lower Investigation score. Under par is full marks and never more.`,
  },
  {
    target: "sim-pulls",
    phase: "investigate",
    title: "Buy the analysis that settles it",
    body:
      "Each card says what it would answer and what it costs before you buy it, and the board is " +
      "open — any analysis, on any branch, in any order. Ask what a pull would rule out; if the " +
      "answer is “nothing”, that is the pull to skip.",
    scoring:
      "Investigation efficiency counts a pull as relevant if it spoke to the true cause, to what " +
      "you believed when you bought it, or to what you finally named — so buying the analysis " +
      "that changes your mind is rewarded, not punished.",
  },
  {
    target: "sim-decide",
    phase: "investigate",
    title: "Stopping is a decision too",
    body:
      "Moving on forfeits whatever budget is left. That is usually the right trade — an " +
      "unspent analyst-day costs you nothing, and one spent on a pull you couldn't name a " +
      "purpose for costs you twice.",
  },
  {
    target: "sim-commit",
    phase: "commit",
    title: "Name the cause, then fund the fix",
    body:
      `At Decide you name at most ${simConfig.maxCausesNamed} causes, and only then does the ` +
      `board show the fixes that treat them — so a run that diagnoses the wrong branch can't ` +
      `stumble onto the right remedy. Both steps are irreversible.`,
    scoring:
      `Diagnosis and Decision carry the most weight of the five. Part-funding several bets is the ` +
      `expensive mistake: below the point where a fix ships, the capacity is spent and nothing ` +
      `lands, for ${simConfig.stalledDecisionPenalty} points each.`,
  },
  {
    rubric: true,
    title: "How the run is scored",
    body:
      "Five weighted dimensions averaged into one score out of 100, with the debrief showing what " +
      "the quarters actually did against what was achievable.",
  },
];

/** The dimensions and weights, read off the format the run is graded by. */
function RubricTable({ periodic }: { periodic: boolean }) {
  const rubric = (periodic ? periodicWarRoomFormat : warRoomFormat).rubric;
  return (
    <div className="mt-3 space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="pb-1 font-medium">Dimension</th>
              <th className="pb-1 text-right font-medium">Weight</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {rubric.map((dim) => (
              <tr key={dim.key} className="border-t">
                <td className="py-1 pr-2">{dim.label}</td>
                <td className="py-1 text-right font-mono">{dim.weight.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {[...simBands].reverse().map((b) => (
          <span
            key={b.band}
            className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground"
          >
            {b.band} {b.min > 0 ? `${b.min}+` : "<50"}
          </span>
        ))}
      </div>
    </div>
  );
}

export function WarRoomTour({
  phase,
  hasConcepts,
  hasMetricMap,
  periodic = false,
  autoStart = false,
  onSuppressChange,
}: {
  phase: SimPhase;
  /** The scenario carries a primer, so the Concepts button exists. */
  hasConcepts: boolean;
  /** A hard scenario withholds the map, and a tour must not point at nothing. */
  hasMetricMap: boolean;
  /** A run that commits over several periods is graded on a sixth dimension. */
  periodic?: boolean;
  autoStart?: boolean;
  onSuppressChange?: (suppressed: boolean) => void;
}) {
  const steps = useMemo(
    () =>
      STEPS.filter(
        (step) =>
          (step.target !== "sim-concepts" || hasConcepts) &&
          (step.target !== "sim-metric-map" || hasMetricMap),
      ).map((step) =>
        // Out of its phase the element isn't on screen, so the step keeps its
        // words and loses its pointer rather than spotlighting whatever
        // happens to be at that anchor next.
        step.phase && step.phase !== phase ? { ...step, target: undefined } : step,
      ),
    [phase, hasConcepts, hasMetricMap],
  );

  return (
    <GuidedTour
      steps={steps}
      ariaLabel="War room tutorial"
      autoStart={autoStart}
      onSuppressChange={onSuppressChange}
      renderExtra={(step) => (step.rubric ? <RubricTable periodic={periodic} /> : null)}
    />
  );
}
