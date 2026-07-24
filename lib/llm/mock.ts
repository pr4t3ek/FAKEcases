import { pick, seededRandom } from "@/lib/utils";
import { hintConfig } from "@/lib/config";
import type { InterviewerContext, LlmAdapter } from "./types";

/**
 * Deterministic, context-aware "interviewer" mock. Works fully offline.
 * It reads the candidate's structured state (assumptions, framework, messages)
 * and asks stage-appropriate Socratic questions. It never reveals the answer
 * before Teacher mode or Hint level 3.
 */

const SEGMENTATION_HINTS = [
  "segment",
  "split",
  "adult",
  "child",
  "urban",
  "rural",
  "male",
  "female",
  "age",
  "income",
  "tier",
  "household",
  "%",
  "percent",
];

function lc(s: string): string {
  return s.toLowerCase();
}

function lastUserMessage(ctx: InterviewerContext): string {
  for (let i = ctx.messages.length - 1; i >= 0; i--) {
    if (ctx.messages[i].role === "user") return ctx.messages[i].content;
  }
  return "";
}

function userTurnCount(ctx: InterviewerContext): number {
  return ctx.messages.filter((m) => m.role === "user").length;
}

function hasSegmentation(ctx: InterviewerContext): boolean {
  if (ctx.framework.length >= 2) return true;
  const hay = [
    ...ctx.framework.map((f) => lc(f.label)),
    ...ctx.assumptions.map((a) => `${lc(a.key)} ${lc(a.value)}`),
  ].join(" ");
  return SEGMENTATION_HINTS.some((k) => hay.includes(k));
}

function mentions(text: string, words: string[]): boolean {
  const t = lc(text);
  return words.some((w) => t.includes(w));
}

function seedFor(ctx: InterviewerContext, salt: string): string {
  return `${ctx.question.title}|${userTurnCount(ctx)}|${ctx.assumptions.length}|${salt}`;
}

// ── Phrase banks ──────────────────────────────────────────────────────────
const OPENING = [
  "Let's structure this before jumping to numbers. What would you anchor your estimate on, and how would you break the problem down?",
  "Good problem to reason through. Where would you start — and how do you want to decompose it?",
  "Before we calculate anything: how would you approach this top-down? What's your starting point?",
];

const PUSH_SEGMENT = [
  "You've anchored on a total — but would everyone use or buy this the same way? How would you segment before going further?",
  "That's a reasonable starting point. Can you segment the population before you proceed? What splits matter here?",
  "Good. Now, is this population homogeneous for this problem, or should you break it into segments first?",
];

const PROBE_FREQUENCY = [
  "You've segmented well. Now what assumptions are you making about how often this is bought or used?",
  "Nice segmentation. What's your assumption on frequency or usage rate, and why?",
  "Good split. How frequently does each segment consume or replace this? Where does that number come from?",
];

const CHALLENGE_ASSUMPTION = [
  "Why did you choose that figure? What's the basis for it — can you justify it?",
  "That assumption drives your answer a lot. How confident are you, and how would you sanity-check it?",
  "Where does that number come from? Could it be off by 2x, and would that change your conclusion?",
];

const PUSH_CALC = [
  "You have a structure and assumptions — walk me through the calculation to your final number.",
  "Good foundation. Can you now multiply through and arrive at an estimate? Talk me through it.",
  "Let's see it come together. Compute your estimate step by step from what you've built.",
];

const SANITY_CHECK = [
  "You've reached an estimate. How confident are you? Did you miss any segment — for instance institutional or bulk demand?",
  "Okay, you have a number. Does it pass a sanity check? Is there a segment you've overlooked?",
  "Good — now stress-test it. What would make this too high or too low, and did you round consistently?",
];

const STUCK_NUDGE = [
  "Take a step back. What's the single biggest driver of this number, and can you estimate that first?",
  "Don't worry about precision yet. What's the population or base you're starting from?",
  "Let's simplify. Break it into: who uses it, how many there are, and how often. Start with the first.",
];

const ACK_QUESTION = [
  "Good question — but in an interview you'd have to assume it. What's a reasonable assumption and why?",
  "I'd turn that back to you: what would you assume, and how would you justify it?",
];

function replyInterviewer(ctx: InterviewerContext): string {
  const turns = userTurnCount(ctx);
  const last = lastUserMessage(ctx);

  if (turns === 0 || (!last && ctx.assumptions.length === 0)) {
    return pick(OPENING, seedFor(ctx, "open"));
  }

  // Candidate is stuck / asking
  if (mentions(last, ["stuck", "don't know", "dont know", "no idea", "help", "not sure"])) {
    return pick(STUCK_NUDGE, seedFor(ctx, "stuck"));
  }
  if (last.trim().endsWith("?") || mentions(last, ["what should", "should i", "how do i"])) {
    return pick(ACK_QUESTION, seedFor(ctx, "ackq"));
  }

  // Final estimate present -> sanity check
  if (ctx.finalEstimate != null) {
    return pick(SANITY_CHECK, seedFor(ctx, "sanity"));
  }

  // No segmentation yet -> push segmentation
  if (!hasSegmentation(ctx)) {
    // If they only just mentioned population/total, acknowledge then push
    return pick(PUSH_SEGMENT, seedFor(ctx, "seg"));
  }

  // Has segmentation but few assumptions -> probe frequency/rate
  if (ctx.assumptions.length < 2) {
    return pick(PROBE_FREQUENCY, seedFor(ctx, "freq"));
  }

  // Has structure + assumptions: sometimes challenge an assumption, else push calc
  if (ctx.assumptions.length >= 2 && seededRandom(seedFor(ctx, "branch")) < 0.5) {
    return pick(CHALLENGE_ASSUMPTION, seedFor(ctx, "challenge"));
  }
  return pick(PUSH_CALC, seedFor(ctx, "calc"));
}

function replyTeacher(ctx: InterviewerContext): string {
  const q = ctx.question;
  const approach = q.betterApproach || "Break it down top-down: base population → segment → apply usage/frequency → aggregate.";
  const sample = q.sampleSolution || "";
  return [
    `Here's how a consultant would approach "${q.title}":`,
    "",
    `**Structure.** ${approach}`,
    sample ? `\n**Worked estimate.** ${sample}` : "",
    "\nRemember: the exact number matters less than a clean, defensible structure. Try re-doing it in your own words.",
  ]
    .filter(Boolean)
    .join("\n");
}

function replyEvaluator(ctx: InterviewerContext): string {
  const parts: string[] = [];
  parts.push(
    hasSegmentation(ctx)
      ? "You segmented the problem, which is the backbone of a good answer."
      : "Your biggest gap is segmentation — you jumped toward a number without breaking the population down.",
  );
  parts.push(
    ctx.assumptions.length >= 2
      ? "You stated explicit assumptions, which makes your logic auditable."
      : "Try to state more explicit assumptions so your reasoning can be checked.",
  );
  parts.push("Submit when ready and I'll produce your full scored evaluation.");
  return parts.join(" ");
}

export const mockAdapter: LlmAdapter = {
  name: "mock",

  async reply(ctx) {
    switch (ctx.mode) {
      case "teacher":
        return replyTeacher(ctx);
      case "evaluator":
        return replyEvaluator(ctx);
      default:
        return replyInterviewer(ctx);
    }
  },

  async hint(ctx, level) {
    const q = ctx.question;
    const maxLevel = hintConfig.levels;
    if (level <= 1) {
      return pick(
        [
          "Think about who actually uses or buys this — is the whole population really your market?",
          "Start from a base you know (like a city's population) and narrow it down step by step.",
          "What's the single biggest driver of this number? Estimate that first.",
        ],
        seedFor(ctx, "hint1"),
      );
    }
    if (level < maxLevel) {
      return pick(
        [
          "Break the population into meaningful segments, then apply a usage or purchase rate to each.",
          "Consider frequency: how often is this bought or replaced per year? Multiply that through your target segment.",
          "Split into who owns it vs how often they replace it — those are two different assumptions.",
        ],
        seedFor(ctx, "hint2"),
      );
    }
    // Final hint: near-complete direction using the better-approach, but no final number.
    return `Here's the structure to use: ${q.betterApproach} Now put your own numbers to each step — I'll still let you compute the final figure yourself.`;
  },
};
