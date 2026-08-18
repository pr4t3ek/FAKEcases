import { answerTokensForMode, hintConfig, llmOutput } from "@/lib/config";
import {
  renderContextBlock,
  renderDataPack,
  renderTeacherReference,
  renderSimContextBlock,
  systemPromptForMode,
  hintSystemPrompt,
  simCoachRules,
} from "./prompts";
import type { InterviewerContext, ConvMessage } from "./types";

/** The case's authored facts, appended so the model reports rather than invents. */
function dataBlock(ctx: InterviewerContext): string {
  const pack = ctx.dataPack?.length ? renderDataPack(ctx.dataPack) : "";
  return pack ? `\n\n${pack}` : "";
}

/**
 * The authored answer, appended for Teacher mode and no other.
 *
 * Gated here rather than inside `renderContextBlock` because that block is
 * shared with `buildHintMessages`, which must never be handed the final number
 * — see `renderTeacherReference`. Every other mode's prompt is unchanged, byte
 * for byte.
 */
function teacherBlock(ctx: InterviewerContext): string {
  if (ctx.mode !== "teacher") return "";
  const reference = renderTeacherReference(ctx);
  return reference ? `\n\n${reference}` : "";
}

/**
 * Build (system, messages) for a normal interviewer turn — or, when the context
 * carries a finished simulation, for the debrief coach.
 *
 * The branch lives here rather than as a third `LlmAdapter` method because all
 * five adapters build their prompt through this one function, so the coach costs
 * zero adapter changes and inherits streaming, retry, the spend guards and the
 * mock fallback exactly as they are.
 */
export function buildReplyMessages(ctx: InterviewerContext): {
  system: string;
  messages: ConvMessage[];
  /**
   * How much the model may write for this turn.
   *
   * Decided here because this is the one place that already knows which mode is
   * speaking, and the answer differs by a factor of three: Teacher mode works
   * the problem, everything else asks about it. An adapter adds reasoning
   * headroom on top where it cannot prove the model's thinking is off.
   */
  maxTokens: number;
} {
  if (ctx.simulation) {
    const system = `${simCoachRules(ctx.simulation.mentor)}\n\n${renderSimContextBlock(ctx.simulation)}${dataBlock(ctx)}`;
    const messages = ctx.messages.filter((m) => m.role !== "system");
    if (messages.length === 0) {
      messages.push({ role: "user", content: "Walk me through what I got wrong." });
    }
    // The debrief coach answers in 2–4 short bullets whatever the picker was
    // left on, so it takes the ordinary budget rather than the mode's.
    return { system, messages, maxTokens: llmOutput.visibleAnswerTokens };
  }

  const system = `${systemPromptForMode(ctx.mode, ctx.answerMode)}\n\nCurrent state:\n${renderContextBlock(ctx)}${dataBlock(ctx)}${teacherBlock(ctx)}`;
  const messages = ctx.messages.filter((m) => m.role !== "system");
  // Ensure there is at least one user message to respond to.
  if (messages.length === 0) {
    messages.push({ role: "user", content: "Let's begin. How should I approach this?" });
  }
  return { system, messages, maxTokens: answerTokensForMode(ctx.mode) };
}

/** Build (system, messages) for a hint request. */
export function buildHintMessages(
  ctx: InterviewerContext,
  level: number,
): { system: string; messages: ConvMessage[]; maxTokens: number } {
  const system = `${hintSystemPrompt(level, hintConfig.levels, ctx.answerMode)}\n\nCurrent state:\n${renderContextBlock(ctx)}${dataBlock(ctx)}`;
  const messages: ConvMessage[] = ctx.messages.filter((m) => m.role !== "system");
  messages.push({ role: "user", content: `Can I get a hint? (level ${level})` });
  // A hint is 1–3 sentences by its own prompt, so it takes the ordinary budget
  // even when the picker is sitting on Teacher — the mode the candidate happens
  // to have selected does not make the hint longer.
  return { system, messages, maxTokens: llmOutput.visibleAnswerTokens };
}
