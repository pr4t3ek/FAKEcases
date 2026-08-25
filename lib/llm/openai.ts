import { env } from "@/lib/config";
import { buildReplyMessages, buildHintMessages } from "./build-messages";
import { classifyHttpError, LlmError } from "./errors";
import type { InterviewerContext, LlmAdapter } from "./types";

const DEFAULT_MODEL = "gpt-4o-mini";
const API_URL = "https://api.openai.com/v1/chat/completions";

async function call(
  apiKey: string | undefined,
  system: string,
  messages: { role: string; content: string }[],
  maxTokens: number,
): Promise<string> {
  // Supplied by the rotation in `lib/llm/keys.ts`; undefined means it was empty.
  if (!apiKey) throw new LlmError("provider_error", "OPENAI_API_KEY not set");

  try {
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
      throw Object.assign(new Error(`OpenAI API ${res.status}: ${body.slice(0, 200)}`), {
        status: res.status,
      });
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error("OpenAI API returned empty content");
    return text;
  } catch (err) {
    throw classifyHttpError("OpenAI", err);
  }
}

/** See the note in `anthropic.ts` — single-delta shim over the non-streaming call. */
async function* once(text: Promise<string>): AsyncGenerator<string> {
  yield await text;
}

function build(apiKey: string | undefined): LlmAdapter {
  return {
    name: "openai",
    get model() {
      return env.llm.model?.trim() || DEFAULT_MODEL;
    },
    reply(ctx: InterviewerContext) {
      const { system, messages, maxTokens } = buildReplyMessages(ctx);
      return once(call(apiKey, system, messages, maxTokens));
    },
    hint(ctx: InterviewerContext, level: number) {
      const { system, messages, maxTokens } = buildHintMessages(ctx, level);
      return once(call(apiKey, system, messages, maxTokens));
    },
  };
}

/** One link in the rotation — see `geminiAdapterWithKey`. */
export function openaiAdapterWithKey(apiKey: string): LlmAdapter {
  return build(apiKey);
}

/** The keyless form, so an empty rotation still names the fix. */
export const openaiAdapter: LlmAdapter = build(undefined);
