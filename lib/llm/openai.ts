import { env } from "@/lib/config";
import { buildReplyMessages, buildHintMessages } from "./build-messages";
import type { InterviewerContext, LlmAdapter } from "./types";

const DEFAULT_MODEL = "gpt-4o-mini";
const API_URL = "https://api.openai.com/v1/chat/completions";

async function call(system: string, messages: { role: string; content: string }[]): Promise<string> {
  const apiKey = env.llm.openaiApiKey;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");

  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: env.llm.model ?? DEFAULT_MODEL,
      max_tokens: 512,
      messages: [
        { role: "system", content: system },
        ...messages.map((m) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: m.content,
        })),
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OpenAI API ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("OpenAI API returned empty content");
  return text;
}

export const openaiAdapter: LlmAdapter = {
  name: "openai",
  async reply(ctx: InterviewerContext) {
    const { system, messages } = buildReplyMessages(ctx);
    return call(system, messages);
  },
  async hint(ctx: InterviewerContext, level: number) {
    const { system, messages } = buildHintMessages(ctx, level);
    return call(system, messages);
  },
};
