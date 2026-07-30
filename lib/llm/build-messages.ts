import { hintConfig } from "@/lib/config";
import {
  renderContextBlock,
  renderDataPack,
  systemPromptForMode,
  hintSystemPrompt,
} from "./prompts";
import type { InterviewerContext, ConvMessage } from "./types";

/** The case's authored facts, appended so the model reports rather than invents. */
function dataBlock(ctx: InterviewerContext): string {
  const pack = ctx.dataPack?.length ? renderDataPack(ctx.dataPack) : "";
  return pack ? `\n\n${pack}` : "";
}

/** Build (system, messages) for a normal interviewer turn. */
export function buildReplyMessages(ctx: InterviewerContext): {
  system: string;
  messages: ConvMessage[];
} {
  const system = `${systemPromptForMode(ctx.mode, ctx.answerMode)}\n\nCurrent state:\n${renderContextBlock(ctx)}${dataBlock(ctx)}`;
  const messages = ctx.messages.filter((m) => m.role !== "system");
  // Ensure there is at least one user message to respond to.
  if (messages.length === 0) {
    messages.push({ role: "user", content: "Let's begin. How should I approach this?" });
  }
  return { system, messages };
}

/** Build (system, messages) for a hint request. */
export function buildHintMessages(
  ctx: InterviewerContext,
  level: number,
): { system: string; messages: ConvMessage[] } {
  const system = `${hintSystemPrompt(level, hintConfig.levels, ctx.answerMode)}\n\nCurrent state:\n${renderContextBlock(ctx)}${dataBlock(ctx)}`;
  const messages: ConvMessage[] = ctx.messages.filter((m) => m.role !== "system");
  messages.push({ role: "user", content: `Can I get a hint? (level ${level})` });
  return { system, messages };
}
