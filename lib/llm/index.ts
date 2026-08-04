import { env } from "@/lib/config";
import { mockAdapter } from "./mock";
import { geminiAdapter } from "./gemini";
import { anthropicAdapter } from "./anthropic";
import { openaiAdapter } from "./openai";
import { ollamaAdapter } from "./ollama";
import { asLlmError, type LlmErrorCode } from "./errors";
import type { FallbackReason } from "./stream";
import type { InterviewerContext, LlmAdapter } from "./types";

export type {
  InterviewerContext,
  LlmAdapter,
  ConvMessage,
  QuestionContext,
  SimCoachContext,
} from "./types";
export { mockAdapter } from "./mock";

/** Provider label recorded when the mock stood in for a real provider. */
export const MOCK_FALLBACK = "mock (fallback)";

/** One retry, for transient failures only, before giving up on the provider. */
const RETRY_DELAY_MS = 1_200;

export function getAdapter(): LlmAdapter {
  switch (env.llm.provider) {
    case "gemini":
      return geminiAdapter;
    case "anthropic":
      return anthropicAdapter;
    case "openai":
      return openaiAdapter;
    case "ollama":
      return ollamaAdapter;
    default:
      return mockAdapter;
  }
}

/** True when a turn was actually billed against the provider's quota. */
export function isRealProvider(provider: string): boolean {
  return !provider.startsWith("mock");
}

export interface TurnOutcome {
  /** Engine that produced the text. `MOCK_FALLBACK` when the mock stood in. */
  provider: string;
  model?: string;
  /** Set when the mock answered in place of the configured provider. */
  fallbackReason?: FallbackReason;
  /**
   * Set when the provider failed *after* emitting text. The reply is a partial
   * one; the mock is deliberately not spliced onto the end of it.
   */
  interrupted?: LlmErrorCode;
}

export interface Turn {
  /** Text deltas. Consuming this to completion fills in `outcome`. */
  deltas: AsyncGenerator<string>;
  /** Only meaningful once `deltas` is exhausted. */
  outcome: TurnOutcome;
}

export interface TurnOptions {
  /** Skip the provider and serve the mock — the spend guard said no. */
  budgetBlocked?: boolean;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type Call = (adapter: LlmAdapter) => AsyncIterable<string>;

/**
 * Run one turn against the configured provider, with the mock as a safety net.
 *
 * Failure is handled differently either side of the first token, and the split is
 * the point of this function:
 *
 *   - **Before any text** the user has seen nothing, so falling back to the mock
 *     produces a complete, coherent answer. They get a usable reply plus an honest
 *     badge instead of an error.
 *   - **After text has streamed** the user is already reading a real reply. Splicing
 *     mock output onto the end would produce an answer that changes voice and
 *     reasoning mid-paragraph, which is worse than an obviously truncated one — so
 *     the turn is marked `interrupted` and stops.
 */
function runTurn(call: Call, options: TurnOptions = {}): Turn {
  const adapter = getAdapter();
  const outcome: TurnOutcome = { provider: adapter.name, model: adapter.model };

  function serveMock(reason: FallbackReason): AsyncIterable<string> {
    outcome.provider = MOCK_FALLBACK;
    outcome.model = undefined;
    outcome.fallbackReason = reason;
    return call(mockAdapter);
  }

  async function* deltas(): AsyncGenerator<string> {
    if (adapter.name !== "mock" && options.budgetBlocked) {
      yield* serveMock("budget");
      return;
    }

    let emitted = false;

    for (let attempt = 0; attempt <= 1; attempt++) {
      try {
        for await (const delta of call(adapter)) {
          if (!delta) continue;
          emitted = true;
          yield delta;
        }
        if (emitted) return;
        // A provider that streams nothing is a failure, not an empty answer.
        if (adapter.name === "mock") return;
        throw asLlmError(new Error(`${adapter.name} returned empty content`));
      } catch (err) {
        const error = asLlmError(err);

        // The mock is the last line of defence; nothing left to fall back to.
        if (adapter.name === "mock") throw error;

        if (emitted) {
          console.error(`[llm] ${adapter.name} failed mid-stream:`, error);
          outcome.interrupted = error.code;
          return;
        }

        if (attempt === 0 && error.code === "rate_limited") {
          console.warn(`[llm] ${adapter.name} rate limited, retrying once:`, error.message);
          await sleep(RETRY_DELAY_MS);
          continue;
        }

        console.error(`[llm] ${adapter.name} failed, falling back to mock:`, error);
        yield* serveMock(error.code === "quota_exhausted" ? "quota" : "error");
        return;
      }
    }
  }

  return { deltas: deltas(), outcome };
}

export function interviewerReplyStream(ctx: InterviewerContext, options?: TurnOptions): Turn {
  return runTurn((adapter) => adapter.reply(ctx), options);
}

export function interviewerHintStream(
  ctx: InterviewerContext,
  level: number,
  options?: TurnOptions,
): Turn {
  return runTurn((adapter) => adapter.hint(ctx, level), options);
}

/** Drain a turn into a single string, for callers that cannot stream. */
export async function collectTurn(turn: Turn): Promise<{ text: string; outcome: TurnOutcome }> {
  let text = "";
  for await (const delta of turn.deltas) text += delta;
  return { text, outcome: turn.outcome };
}

/**
 * Non-streaming interviewer reply, used by `startAttempt()` to seed an attempt's
 * opening turn from a server action where there is no response stream to write to.
 */
export async function interviewerReply(
  ctx: InterviewerContext,
  options?: TurnOptions,
): Promise<{ content: string; outcome: TurnOutcome }> {
  const { text, outcome } = await collectTurn(interviewerReplyStream(ctx, options));
  return { content: text, outcome };
}
