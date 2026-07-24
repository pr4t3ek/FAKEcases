import { env } from "@/lib/config";
import { mockAdapter } from "./mock";
import { anthropicAdapter } from "./anthropic";
import { openaiAdapter } from "./openai";
import type { InterviewerContext, LlmAdapter } from "./types";

export type { InterviewerContext, LlmAdapter, ConvMessage, QuestionContext } from "./types";
export { mockAdapter } from "./mock";

export function getAdapter(): LlmAdapter {
  switch (env.llm.provider) {
    case "anthropic":
      return anthropicAdapter;
    case "openai":
      return openaiAdapter;
    default:
      return mockAdapter;
  }
}

/**
 * Safe interviewer reply: uses the configured provider, and falls back to the
 * deterministic mock on any error (missing key, rate limit, quota, network).
 */
export async function interviewerReply(ctx: InterviewerContext): Promise<{
  content: string;
  provider: string;
}> {
  const adapter = getAdapter();
  try {
    const content = await adapter.reply(ctx);
    return { content, provider: adapter.name };
  } catch (err) {
    if (adapter.name !== "mock") {
      console.error(`[llm] ${adapter.name} reply failed, falling back to mock:`, err);
      return { content: await mockAdapter.reply(ctx), provider: "mock (fallback)" };
    }
    throw err;
  }
}

export async function interviewerHint(
  ctx: InterviewerContext,
  level: number,
): Promise<{ content: string; provider: string }> {
  const adapter = getAdapter();
  try {
    const content = await adapter.hint(ctx, level);
    return { content, provider: adapter.name };
  } catch (err) {
    if (adapter.name !== "mock") {
      console.error(`[llm] ${adapter.name} hint failed, falling back to mock:`, err);
      return { content: await mockAdapter.hint(ctx, level), provider: "mock (fallback)" };
    }
    throw err;
  }
}
