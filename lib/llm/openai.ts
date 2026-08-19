import { env } from "@/lib/config";
import { buildReplyMessages, buildHintMessages } from "./build-messages";
import type { InterviewerContext, LlmAdapter } from "./types";

const DEFAULT_MODEL = "gpt-4o-mini";
const API_URL = "https://api.openai.com/v1/chat/completions";

async function call(
  system: string,
  messages: { role: string; content: string }[],
  maxTokens: number,
): Promise<string> {
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
      max_tokens: maxTokens,
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

/** See the note in `anthropic.ts` — single-delta shim over the non-streaming call. */
async function* once(text: Promise<string>): AsyncGenerator<string> {
  yield await text;
}

export const openaiAdapter: LlmAdapter = {
  name: "openai",
  get model() {
    return env.llm.model?.trim() || DEFAULT_MODEL;
  },
  reply(ctx: InterviewerContext) {
    const { system, messages, maxTokens } = buildReplyMessages(ctx);
    return once(call(system, messages, maxTokens));
  },
  hint(ctx: InterviewerContext, level: number) {
    const { system, messages, maxTokens } = buildHintMessages(ctx, level);
    return once(call(system, messages, maxTokens));
  },
};
