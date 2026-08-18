import { env } from "@/lib/config";
import { buildReplyMessages, buildHintMessages } from "./build-messages";
import { classifyNvidiaError, LlmError } from "./errors";
import { parseSseDeltas } from "./openai-sse";
import type { ConvMessage, InterviewerContext, LlmAdapter } from "./types";

/**
 * NVIDIA NIM — the hosted catalogue at `integrate.api.nvidia.com`.
 *
 * OpenAI-compatible, so this speaks the same wire format as `openai.ts` and
 * `ollama.ts` and reuses the same SSE reader. Written with `fetch` rather than
 * the `openai` npm package for the reason every adapter here is: five providers,
 * five hand-rolled request bodies, zero SDKs. Adding one for the sixth would make
 * this the only provider whose wire format the repo cannot read at a glance, and
 * would put a dependency behind a file that is forty lines of JSON.
 *
 * Two things separate it from `ollama.ts`, which otherwise looks identical:
 *
 *   - **It sends a bearer token.** Ollama deliberately sends none, which is why
 *     pointing `OLLAMA_BASE_URL` at NVIDIA does not work — the call 401s.
 *   - **It is metered.** NVIDIA is a hosted API drawing on a real quota, so it
 *     stays out of `LOCAL_PROVIDERS` in `lib/config/env.ts` and the spend guards
 *     in `lib/llm/budget.ts` apply to it exactly as they do to Gemini.
 */

/**
 * The catalogue is large and moves; this is only a floor so the adapter runs
 * with nothing but a key set. Override with `NVIDIA_MODEL` — the id is the
 * namespaced one NVIDIA shows on the model's page (`publisher/name`).
 */
export const DEFAULT_NVIDIA_MODEL = "meta/llama-3.1-8b-instruct";

const BASE_URL = "https://integrate.api.nvidia.com/v1";

/** Matches Gemini's and Ollama's ceiling — 512 truncates Teacher mode mid-sentence. */
const MAX_OUTPUT_TOKENS = 1024;

/**
 * `NVIDIA_MODEL` wins over the shared `LLM_MODEL`, the same split `OLLAMA_MODEL`
 * uses and for the same reason: `LLM_MODEL` is shared by every provider, so a
 * `gemini-2.5-flash` left over from the last session would otherwise be sent to
 * NVIDIA and 404 on a model that does not exist in its catalogue.
 */
function resolveModel(): string {
  return env.llm.nvidiaModel?.trim() || env.llm.model?.trim() || DEFAULT_NVIDIA_MODEL;
}

async function* run(system: string, messages: ConvMessage[]): AsyncGenerator<string> {
  const model = resolveModel();
  const apiKey = env.llm.nvidiaApiKey;

  // Checked before the request rather than letting it 401: the key is the one
  // thing the operator can fix, and "NVIDIA_API_KEY not set" says so where a
  // 401 body does not.
  if (!apiKey) {
    throw new LlmError("provider_error", "NVIDIA_API_KEY not set");
  }

  try {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: MAX_OUTPUT_TOKENS,
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
      throw Object.assign(new Error(`NVIDIA API ${res.status}: ${detail.slice(0, 200)}`), {
        status: res.status,
      });
    }
    if (!res.body) {
      throw new LlmError("provider_error", "NVIDIA returned no response body");
    }

    yield* parseSseDeltas(res.body);
  } catch (err) {
    throw classifyNvidiaError(err, { model });
  }
}

export const nvidiaAdapter: LlmAdapter = {
  name: "nvidia",
  get model() {
    return resolveModel();
  },
  reply(ctx: InterviewerContext) {
    const { system, messages } = buildReplyMessages(ctx);
    return run(system, messages);
  },
  hint(ctx: InterviewerContext, level: number) {
    const { system, messages } = buildHintMessages(ctx, level);
    return run(system, messages);
  },
};
