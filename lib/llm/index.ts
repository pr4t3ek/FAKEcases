import { env, isMeteredProvider, type LlmProvider } from "@/lib/config";
import { mockAdapter } from "./mock";
import { geminiAdapter } from "./gemini";
import { anthropicAdapter } from "./anthropic";
import { openaiAdapter } from "./openai";
import { nvidiaAdapter } from "./nvidia";
import { ollamaAdapter } from "./ollama";
import { asLlmError, type LlmErrorCode } from "./errors";
import { fallbackLabel, type FallbackReason } from "./stream";
import type { InterviewerContext, LlmAdapter } from "./types";

export type {
  InterviewerContext,
  LlmAdapter,
  ConvMessage,
  QuestionContext,
  SimCoachContext,
  FrameworkJudgeContext,
} from "./types";
export { mockAdapter } from "./mock";

/** Provider label recorded when the mock stood in for a real provider. */
export const MOCK_FALLBACK = fallbackLabel("mock");

/** One retry, for transient failures only, before giving up on the provider. */
const RETRY_DELAY_MS = 1_200;

function adapterFor(provider: LlmProvider): LlmAdapter {
  switch (provider) {
    case "gemini":
      return geminiAdapter;
    case "anthropic":
      return anthropicAdapter;
    case "openai":
      return openaiAdapter;
    case "nvidia":
      return nvidiaAdapter;
    case "ollama":
      return ollamaAdapter;
    default:
      return mockAdapter;
  }
}

export function getAdapter(): LlmAdapter {
  return adapterFor(env.llm.provider);
}

/**
 * The second engine, when `LLM_FALLBACK_PROVIDER` names one. Undefined otherwise,
 * which is the shipped default — the mock has always been the only stand-in.
 */
export function getFallbackAdapter(): LlmAdapter | undefined {
  const provider = env.llm.fallbackProvider;
  return provider === undefined ? undefined : adapterFor(provider);
}

/**
 * The engines to try for one turn, in order.
 *
 * Always ends at the mock, and the mock is only ever last: it is offline and
 * deterministic, so it cannot fail, which makes it a floor rather than another
 * link. Anything placed behind it would be unreachable.
 */
function providerChain(options: TurnOptions): LlmAdapter[] {
  const configured: LlmProvider[] = [env.llm.provider];
  if (env.llm.fallbackProvider) configured.push(env.llm.fallbackProvider);

  // The spend guard already said no, so a metered engine is out — but an
  // unmetered one costs the guarded quota nothing, and a real local model is a
  // better answer than the mock. This is why the guard is worth a chain at all
  // and not just an early `serveMock`.
  const usable = options.budgetBlocked
    ? configured.filter((provider) => !isMeteredProvider(provider))
    : configured;

  return [...usable.filter((provider) => provider !== "mock").map(adapterFor), mockAdapter];
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
 * Run one turn against the configured provider, with a stand-in behind it.
 *
 * Failure is handled differently either side of the first token, and the split is
 * the point of this function:
 *
 *   - **Before any text** the user has seen nothing, so handing the turn to the
 *     next engine in the chain produces a complete, coherent answer. They get a
 *     usable reply plus an honest label instead of an error.
 *   - **After text has streamed** the user is already reading a real reply. Splicing
 *     another engine's output onto the end would produce an answer that changes voice
 *     and reasoning mid-paragraph, which is worse than an obviously truncated one — so
 *     the turn is marked `interrupted` and stops. This is why the chain is walked
 *     here and not inside the adapters: only this loop knows whether a token has
 *     already reached the user.
 *
 * The chain is `LLM_PROVIDER` → `LLM_FALLBACK_PROVIDER` (when set) → the mock. Every
 * link past the first is labelled `<name> (fallback)` on the outcome, so a turn served
 * by the stand-in is never recorded as one the configured provider answered.
 */
function runTurn(call: Call, options: TurnOptions = {}): Turn {
  const configured = getAdapter();
  const chain = providerChain(options);
  const outcome: TurnOutcome = { provider: configured.name, model: configured.model };

  /**
   * Hand the turn to a stand-in.
   *
   * The reason recorded is the FIRST one, not the latest: it says why the engine
   * the operator chose dropped out, which is the fact worth surfacing. That the
   * fallback then failed too is already visible in the provider label.
   */
  function noteFallback(adapter: LlmAdapter, reason: FallbackReason): void {
    outcome.provider = fallbackLabel(adapter.name);
    outcome.model = adapter.model;
    outcome.fallbackReason ??= reason;
  }

  async function* deltas(): AsyncGenerator<string> {
    let emitted = false;
    // Why the configured provider isn't answering. Only `budget` is known up
    // front; anything else is read off the failure that ends its turn.
    let reason: FallbackReason = options.budgetBlocked ? "budget" : "error";

    for (let i = 0; i < chain.length; i++) {
      const adapter = chain[i];
      if (adapter !== configured) noteFallback(adapter, reason);

      for (let attempt = 0; attempt <= 1; attempt++) {
        try {
          for await (const delta of call(adapter)) {
            if (!delta) continue;
            emitted = true;
            yield delta;
          }
          if (emitted) return;
          // A provider that streams nothing is a failure, not an empty answer.
          if (adapter === mockAdapter) return;
          throw asLlmError(new Error(`${adapter.name} returned empty content`));
        } catch (err) {
          const error = asLlmError(err);

          // The mock is the last line of defence; nothing left to fall back to.
          if (adapter === mockAdapter) throw error;

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

          reason = error.code === "quota_exhausted" ? "quota" : "error";
          // The mock throws above rather than reaching here, so there is always
          // a next link to name.
          console.error(`[llm] ${adapter.name} failed, falling back to ${chain[i + 1].name}:`, error);
          break;
        }
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
