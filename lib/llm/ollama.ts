import { env, withReasoningHeadroom } from "@/lib/config";
import { buildReplyMessages, buildHintMessages } from "./build-messages";
import { classifyOllamaError, LlmError } from "./errors";
import { parseSseDeltas } from "./openai-sse";
import type { ConvMessage, InterviewerContext, LlmAdapter } from "./types";

/**
 * A local model, for development and testing.
 *
 * Ollama serves an OpenAI-compatible `/v1/chat/completions`, so this speaks the
 * same wire format as `openai.ts` — and by extension works against LM Studio,
 * vLLM or anything else that implements it, via `OLLAMA_BASE_URL`.
 *
 * It streams (unlike the OpenAI and Anthropic adapters, which shim a single
 * delta) because that is most of the point: a 7B model on a CPU takes tens of
 * seconds to produce a full turn, and without deltas the chat sits blank for all
 * of it. Streaming also means this exercises the same NDJSON path as Gemini
 * rather than a shortcut around it.
 */

export const DEFAULT_OLLAMA_MODEL = "qwen2.5:7b";
const DEFAULT_BASE_URL = "http://localhost:11434/v1";

/*
 * Requests add reasoning headroom on top of the turn's answer budget, for the
 * reason nvidia.ts gives at length: a local catalogue carries reasoning models
 * too, nothing on this path asks them to stop, and deliberation is billed against
 * the same ceiling as the answer. Ollama bills nothing, so the only thing the
 * headroom trades is latency on a turn that runs long, against a reply that
 * arrives cut in half.
 */

function resolveBaseUrl(): string {
  const raw = env.llm.ollamaBaseUrl?.trim() || DEFAULT_BASE_URL;
  return raw.replace(/\/+$/, "");
}

/**
 * `OLLAMA_MODEL` wins over the shared `LLM_MODEL` so that switching providers
 * doesn't require remembering to clear a model name that belongs to another one.
 */
function resolveModel(): string {
  return env.llm.ollamaModel?.trim() || env.llm.model?.trim() || DEFAULT_OLLAMA_MODEL;
}

async function* run(
  system: string,
  messages: ConvMessage[],
  answerTokens: number,
): AsyncGenerator<string> {
  const baseUrl = resolveBaseUrl();
  const model = resolveModel();

  try {
    // No `authorization` header: Ollama takes no key, and sending a fake one is
    // just something else to be confused by later.
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model,
        max_tokens: withReasoningHeadroom(answerTokens),
        stream: true,
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
      const detail = await res.text().catch(() => "");
      throw Object.assign(new Error(`Ollama API ${res.status}: ${detail.slice(0, 200)}`), {
        status: res.status,
      });
    }
    if (!res.body) {
      throw new LlmError("provider_error", "Ollama returned no response body");
    }

    yield* parseSseDeltas(res.body);
  } catch (err) {
    throw classifyOllamaError(err, { baseUrl, model });
  }
}

export const ollamaAdapter: LlmAdapter = {
  name: "ollama",
  get model() {
    return resolveModel();
  },
  reply(ctx: InterviewerContext) {
    const { system, messages, maxTokens } = buildReplyMessages(ctx);
    return run(system, messages, maxTokens);
  },
  hint(ctx: InterviewerContext, level: number) {
    const { system, messages, maxTokens } = buildHintMessages(ctx, level);
    return run(system, messages, maxTokens);
  },
};
