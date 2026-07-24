import { env } from "@/lib/config";
import { buildReplyMessages, buildHintMessages } from "./build-messages";
import type { InterviewerContext, LlmAdapter } from "./types";

const DEFAULT_MODEL = "claude-sonnet-4-5";
const API_URL = "https://api.anthropic.com/v1/messages";

async function call(system: string, messages: { role: string; content: string }[]): Promise<string> {
  const apiKey = env.llm.anthropicApiKey;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: env.llm.model ?? DEFAULT_MODEL,
      max_tokens: 512,
      system,
      messages: messages.map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      })),
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Anthropic API ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as { content?: { text?: string }[] };
  const text = data.content?.map((c) => c.text ?? "").join("").trim();
  if (!text) throw new Error("Anthropic API returned empty content");
  return text;
}

export const anthropicAdapter: LlmAdapter = {
  name: "anthropic",
  async reply(ctx: InterviewerContext) {
    const { system, messages } = buildReplyMessages(ctx);
    return call(system, messages);
  },
  async hint(ctx: InterviewerContext, level: number) {
    const { system, messages } = buildHintMessages(ctx, level);
    return call(system, messages);
  },
};
