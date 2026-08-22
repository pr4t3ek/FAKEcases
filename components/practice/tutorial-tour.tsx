"use client";

import { useCallback } from "react";
import {
  categoryLabel,
  categoryWeight,
  evaluationCategories,
  hintConfig,
  readinessBands,
} from "@/lib/config";
import { GuidedTour, type TourStep } from "@/components/tour/guided-tour";
import type { AnswerMode, NodeStatus } from "@/lib/types";
import type { UiFrameworkNode } from "./types";

/**
 * A guided walkthrough of the practice screen, anchored to the real elements via
 * `data-tour` attributes. Each step says what the thing is AND how it moves the
 * score, so the rubric stops being a black box. The closing step renders the
 * weights straight from lib/config so it can never drift from the scorer.
 *
 * Only the words live here. The spotlight, the placement and the remembering are
 * `components/tour/guided-tour.tsx`, shared with the war room's tour.
 */

type Step = TourStep & {
  /** Panel this step lives in — revealed first on the mobile tab layout. */
  panel?: "tools" | "chat" | "progress";
  /** Tools-panel tab this step lives in, revealed first. */
  tool?: "framework" | "notes";
  /** Rendered instead of body on the closing step. */
  rubric?: boolean;
  /**
   * Illustration branches to show on the canvas for this step.
   *
   * Render-only and never persisted — see `demoNode`. The tour advances the
   * picture itself rather than asking the candidate to perform the gesture
   * correctly first, which is what lets a step about marking a branch actually
   * show one being marked.
   */
  demo?: UiFrameworkNode[];
};

const HINTS = hintConfig.levels;

/**
 * A branch that exists only for the length of the tutorial.
 *
 * The `demo:` prefix is load-bearing. These are merged in at the point the
 * canvas is rendered and never enter the builder's `nodes`, because that array
 * is debounce-saved wholesale — a demo branch that reached it would be written
 * to the database and then scored, handing out marks for structure the tutorial
 * drew. The prefix also lets the canvas style them as examples.
 */
function demoNode(
  id: string,
  label: string,
  parentId: string | null = null,
  status: NodeStatus = "unknown",
): UiFrameworkNode {
  return {
    id: `demo:${id}`,
    parentId: parentId ? `demo:${parentId}` : null,
    label,
    value: "",
    multiplier: "",
    combine: "sum",
    status,
    origin: "manual",
  };
}

/** The numeric twin: a step carries figures rather than a verdict. */
function demoStep(
  id: string,
  label: string,
  value: string,
  parentId: string | null = null,
  multiplier = "",
): UiFrameworkNode {
  return {
    id: `demo:${id}`,
    parentId: parentId ? `demo:${parentId}` : null,
    label,
    value,
    multiplier,
    combine: "sum",
    origin: "manual",
  };
}

const DEMO_ROOT = [demoStep("pop", "Population", "2cr")];
const DEMO_SPLIT = [
  ...DEMO_ROOT,
  demoStep("adults", "Adults", "70%", "pop"),
  demoStep("children", "Children", "30%", "pop"),
];

const DEMO_BARE = [demoNode("revenue", "Revenue"), demoNode("cost", "Cost")];
const DEMO_MARKED = [
  demoNode("revenue", "Revenue", null, "healthy"),
  demoNode("cost", "Cost", null, "problem"),
];
const DEMO_DRILLED = [
  ...DEMO_MARKED,
  demoNode("delivery", "Delivery cost", "cost", "problem"),
  demoNode("packaging", "Packaging", "cost", "healthy"),
];

const CASE_STEPS: Step[] = [
  {
    title: "How a case works here",
    body:
      "A case doesn't end in a number. You break the problem into branches, rule them in or out " +
      "by asking the interviewer, and narrow to the one that actually holds the cause. This tour " +
      "shows the screen and exactly how it's marked.",
  },
  {
    target: "question",
    panel: "tools",
    title: "The question, and your timer",
    body:
      "Your prompt with its category, difficulty and the interviewer style it mirrors. The timer " +
      "starts automatically and you can pause it whenever you like.",
    scoring: "Time is not scored at all — it's here for realism, not pressure.",
  },
  {
    target: "tree-mode",
    panel: "tools",
    tool: "framework",
    title: "Solo or Guided",
    body:
      "Solo means you build the structure yourself. Guided suggests the framework's branches as " +
      "you go. It's fixed when the attempt starts — switching mid-case would make solo meaningless.",
    scoring:
      "Guided is an honest trade, not a free pass: it suggests the structure, so structure isn't " +
      "scored. Diagnosis still is, and it's the heaviest category either way.",
  },
  {
    target: "framework",
    panel: "tools",
    tool: "framework",
    demo: DEMO_BARE,
    title: "Your issue tree",
    body:
      "Break the problem into branches that between them cover the whole question — revenue and " +
      "cost, internal and external. They sit side by side, and a branch's + adds a level " +
      "underneath it. The two dashed branches here are just an example.",
    scoring:
      "This is MECE Coverage. Siblings that overlap cost you, because the same cause can then " +
      "hide in two places.",
  },
  {
    target: "framework",
    panel: "tools",
    tool: "framework",
    demo: DEMO_MARKED,
    title: "Rule branches in and out",
    body:
      "Each branch carries a verdict. Green is where the problem is — the branch you're chasing, " +
      "and the loudest thing on screen. A branch you've cleared goes grey and folds away, because " +
      "it's finished with. Watch the example: Cost is now the problem, Revenue has been ruled out.",
    scoring:
      "Clearing branches on the way down is what separates a diagnosis from a guess, and it's " +
      "rewarded separately. Clearing one the answer actually ran through is the expensive mistake.",
  },
  {
    target: "framework",
    panel: "tools",
    tool: "framework",
    demo: DEMO_DRILLED,
    title: "Narrow until you reach the cause",
    body:
      "Flagging a branch as the problem opens the next level under it. Keep going until you land " +
      "on a branch with nothing left underneath — that trail, Cost → Delivery cost, is your answer.",
    scoring:
      "Diagnosis is the heaviest category on a case. Stopping at “it's a cost problem” has " +
      "located a region, not a cause.",
  },
  {
    target: "composer",
    panel: "chat",
    title: "Ask, and think aloud",
    body:
      "Ask the interviewer about a branch before you judge it — on a case with data, it will give " +
      "you the figure for that branch and nothing more. The magnifier on a branch asks about it " +
      "directly. Say your reasoning out loud as you go.",
    scoring:
      "This is where Rationale Quality is won: a branch you explained in the conversation scores " +
      "highest. Judging a branch you never asked about is flagged on your report.",
  },
  {
    target: "modes",
    panel: "chat",
    title: "Choose how much help you want",
    body:
      "Interviewer only asks questions — that is the real thing. Teacher works the whole " +
      "problem through instead. Switch at any time.",
    scoring:
      "Teacher is the one that costs: roughly what using every hint costs, and your evaluation " +
      "says it happened.",
  },
  {
    target: "hint",
    panel: "chat",
    title: `${HINTS} escalating hints`,
    body:
      `Each hint reveals a little more, and none of them says which branch holds the problem. ` +
      `After all ${HINTS}, the button switches you to Teacher mode for a full explanation.`,
    scoring: "Every hint costs 12 points of Confidence — so spend them when you're genuinely stuck.",
  },
  {
    target: "canvas-controls",
    panel: "tools",
    tool: "framework",
    // Keeps the illustration up: the controls live on the canvas, and an empty
    // tree falls back to the empty-state text, so there'd be nothing to point at.
    demo: DEMO_DRILLED,
    title: "Room to work",
    body:
      "Drag the background to pan, scroll to move, Ctrl or ⌘ with the wheel to zoom. Fit brings " +
      "the whole tree back. Fullscreen gives the tree the window and puts the interviewer in a " +
      "window you can drag wherever you like.",
    scoring: "None of this is scored — it's just space to think in.",
  },
  {
    target: "estimate",
    panel: "tools",
    title: "Commit to a recommendation",
    body:
      "Say what the answer is and what you'd do about it. A diagnosis with no recommendation is " +
      "an unfinished case.",
    scoring: "Leaving this blank is called out directly on your report.",
  },
  {
    target: "submit",
    panel: "tools",
    title: "Submit when you're ready",
    body:
      "This closes the attempt and produces your scorecard, XP and rank movement. The model " +
      "answer unlocks only after you submit — so commit first.",
    scoring: "Nothing is graded until you press this.",
  },
  {
    rubric: true,
    title: "How a case is scored",
    body:
      "Weighted categories averaged into one score out of 100. There's no arithmetic in a case, " +
      "so Calculation doesn't apply — Diagnosis carries that weight instead.",
  },
];

const STEPS: Step[] = [
  {
    title: "How this screen works",
    body:
      "A quick tour of every panel and — more importantly — exactly how each one is marked. " +
      "Six of the eight scored categories are things you control directly from this screen.",
  },
  {
    target: "question",
    panel: "tools",
    title: "The question, and your timer",
    body:
      "Your prompt with its category, difficulty, and the interviewer style it mirrors. The timer " +
      "starts automatically and you can pause it whenever you like.",
    scoring: "Time is not scored at all — it's here for realism, not pressure.",
  },
  {
    target: "tools-tabs",
    panel: "tools",
    title: "Your two work surfaces",
    body:
      "Framework is where you build the estimate. Notes is a plain scratchpad saved only on this " +
      "device — never submitted, never read by the interviewer.",
    scoring: "Nothing you type in Notes is graded. Use it as freely as paper.",
  },
  {
    target: "framework",
    panel: "tools",
    tool: "framework",
    demo: DEMO_ROOT,
    title: "Your estimation tree — the biggest lever",
    body:
      "Break the problem into steps, drawn as a tree. The first one you add is the starting step " +
      "and takes an absolute figure — the dashed example here holds 2cr, and the card shows what " +
      "it resolves to. Every step you add after it continues the chain underneath.",
    scoring:
      "This drives the two heaviest categories — Problem Structuring (weight 1.4) and " +
      "Segmentation (1.3). Every step you add lifts them, up to five steps. The figures in the " +
      "boxes are also read as your assumptions, so there's no separate list to keep.",
  },
  {
    target: "framework",
    panel: "tools",
    tool: "framework",
    demo: DEMO_SPLIT,
    title: "Split a step into segments",
    body:
      "A card's + breaks that step into pieces that behave differently. A segment takes a share " +
      "of the step above it rather than an absolute figure — watch the example split into 70% " +
      "and 30%, each resolving against the 2cr above. The × box holds a rate on top of that, " +
      "like 3 cups a day.",
    scoring:
      "The chip on the junction says whether the pieces add or multiply, and totals their " +
      "shares. Coming to less than 100% is fine — you only have to model the slices your " +
      "estimate needs. It flags you only if they add up to more than the whole.",
  },
  {
    target: "canvas-controls",
    panel: "tools",
    tool: "framework",
    // Same reason as the case tour: the controls live on the canvas, and an
    // empty tree falls back to the empty-state text with nothing to point at.
    demo: DEMO_SPLIT,
    title: "Room to work",
    body:
      "Drag the background to pan, scroll to move, Ctrl or ⌘ with the wheel to zoom. Fit brings " +
      "the whole chain back. Fullscreen gives the tree the window and puts the interviewer in a " +
      "window you can drag wherever you like.",
    scoring: "None of this is scored — it's just space to think in.",
  },
  {
    target: "calculator-btn",
    panel: "tools",
    title: "The calculator, wherever you want it",
    body:
      "Opens a calculator you can drag anywhere on screen, so it stays with you while you build " +
      "the framework. It understands k, L, cr and both × and x.",
    scoring: "Saving even one calculation adds 12 points to Logical Thinking.",
  },
  {
    target: "modes",
    panel: "chat",
    title: "Choose how much help you want",
    body:
      "Interviewer only asks questions — that is the real thing. Teacher works the whole " +
      "problem through instead. Switch at any time.",
    scoring:
      "Teacher is the one that costs: roughly what using every hint costs, and your evaluation " +
      "says it happened.",
  },
  {
    target: "composer",
    panel: "chat",
    title: "Think aloud here",
    body:
      "Say your reasoning out loud as you would in a real interview. The interviewer responds to " +
      "what you write, and silence tells it nothing.",
    scoring:
      "Interaction is scored from how much you actually articulate — each of your first six " +
      "messages adds to it. Assumption Quality is won here too: a figure you explain (“40% " +
      "urban, from the census”) outscores the same figure sitting unexplained in your tree.",
  },
  {
    target: "hint",
    panel: "chat",
    title: `${HINTS} escalating hints`,
    body:
      `Each hint reveals a little more, and none of them hands over the answer. After all ${HINTS}, ` +
      "the button switches you to Teacher mode for a full explanation.",
    scoring: `Every hint costs 12 points of Confidence — so spend them when you're genuinely stuck.`,
  },
  {
    target: "estimate",
    panel: "tools",
    title: "Your final estimate",
    body:
      "The number you're committing to, in the bar under the tree. The framework's chain result " +
      "can be dropped in with one click, or type it yourself.",
    scoring:
      "This sets Calculation Accuracy: inside the ideal range scores highest, within 2× scores " +
      "partial credit, further out scores low. Leaving it blank costs you the most.",
  },
  {
    target: "submit",
    panel: "tools",
    title: "Submit when you're ready",
    body:
      "This closes the attempt and produces your scorecard, XP and rank movement. The model " +
      "answer and a better-approach note unlock only after you submit — so commit first.",
    scoring: "Nothing is graded until you press this.",
  },
  {
    rubric: true,
    title: "How your score is built",
    body:
      "Eight categories, each weighted, averaged into one score out of 100. Your rank is set by " +
      "your percentile against other candidates, not by raw points.",
  },
];

/**
 * The weights, read off the config the scorer reads.
 *
 * Zero-weight rows are dropped rather than shown as 0.0: on a case Calculation
 * genuinely doesn't apply, and listing it would imply marks left on the table.
 */
function RubricTable({ answerMode }: { answerMode: AnswerMode }) {
  return (
    <div className="mt-3 space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="pb-1 font-medium">Category</th>
              <th className="pb-1 text-right font-medium">Weight</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {evaluationCategories
              .filter((c) => categoryWeight(c, answerMode) > 0)
              .map((c) => (
                <tr key={c.key} className="border-t">
                  <td className="py-1 pr-2">{categoryLabel(c, answerMode)}</td>
                  <td className="py-1 text-right font-mono">
                    {categoryWeight(c, answerMode).toFixed(1)}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {[...readinessBands].reverse().map((b) => (
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

export function TutorialTour({
  onReveal,
  answerMode = "numeric",
  autoStart = false,
  onDemo,
  onSuppressChange,
}: {
  /** Asks the practice screen to reveal a panel / tool tab before measuring. */
  onReveal: (panel?: string, tool?: string) => void;
  /** A case is a different exercise, so it gets a different tour. */
  answerMode?: AnswerMode;
  /** Open once on mount — the practice screen decides when that's warranted. */
  autoStart?: boolean;
  /** Illustration branches for the current step. Always emptied on close. */
  onDemo?: (nodes: UiFrameworkNode[]) => void;
  /** The candidate ticked "don't show this again". */
  onSuppressChange?: (suppressed: boolean) => void;
}) {
  const qualitative = answerMode === "qualitative";
  const steps = qualitative ? CASE_STEPS : STEPS;

  // Both jobs have to happen before the step is measured: an unrevealed panel
  // isn't in the DOM to point at, and an empty canvas falls back to its
  // empty-state text, so the demo tree has to be drawn before we look for it.
  const onEnterStep = useCallback(
    (step: Step) => {
      if (step.panel || step.tool) onReveal(step.panel, step.tool);
      onDemo?.(step.demo ?? []);
    },
    [onReveal, onDemo],
  );

  // Cleared however the tour closes — Esc, the ✕, Skip, the click-off layer.
  const onExit = useCallback(() => onDemo?.([]), [onDemo]);

  return (
    <GuidedTour
      steps={steps}
      ariaLabel="Practice screen tutorial"
      autoStart={autoStart}
      onEnterStep={onEnterStep}
      onExit={onExit}
      onSuppressChange={onSuppressChange}
      renderExtra={(step) => (step.rubric ? <RubricTable answerMode={answerMode} /> : null)}
    />
  );
}
