import { env } from "@/lib/config";
import { buildReplyMessages, buildHintMessages } from "./build-messages";
import { classifyHttpError, LlmError } from "./errors";
import type { InterviewerContext, LlmAdapter } from "./types";

const DEFAULT_MODEL = "claude-sonnet-4-5";
const API_URL = "https://api.anthropic.com/v1/messages";

async function call(
  apiKey: string | undefined,
  system: string,
  messages: { role: string; content: string }[],
  maxTokens: number,
): Promise<string> {
  // Supplied by the rotation in `lib/llm/keys.ts`; undefined means it was empty.
  if (!apiKey) throw new LlmError("provider_error", "ANTHROPIC_API_KEY not set");

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: env.llm.model ?? DEFAULT_MODEL,
        max_tokens: maxTokens,
        system,
        messages: messages.map((m) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: m.content,
        })),
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw Object.assign(new Error(`Anthropic API ${res.status}: ${body.slice(0, 200)}`), {
        status: res.status,
      });
    }
    const data = (await res.json()) as { content?: { text?: string }[] };
    const text = data.content?.map((c) => c.text ?? "").join("").trim();
    if (!text) throw new Error("Anthropic API returned empty content");
    return text;
  } catch (err) {
    throw classifyHttpError("Anthropic", err);
  }
}

/**
 * Adapters are stream-first, but this one still uses the non-streaming endpoint —
 * it is kept as a paid upgrade path, not the primary provider, so it yields its
 * whole reply as a single delta rather than carrying the cost of a second
 * streaming implementation.
 */
async function* once(text: Promise<string>): AsyncGenerator<string> {
  yield await text;
}

function build(apiKey: string | undefined): LlmAdapter {
  return {
    name: "anthropic",
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
export function anthropicAdapterWithKey(apiKey: string): LlmAdapter {
  return build(apiKey);
}

/** The keyless form, so an empty rotation still names the fix. */
export const anthropicAdapter: LlmAdapter = build(undefined);
