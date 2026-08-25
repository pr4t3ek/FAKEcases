import {
  env,
  isKeyedProvider,
  isMeteredProvider,
  type KeyedProvider,
  type LlmProvider,
} from "@/lib/config";
import { mockAdapter } from "./mock";
import { geminiAdapter, geminiAdapterWithKey } from "./gemini";
import { anthropicAdapter, anthropicAdapterWithKey } from "./anthropic";
import { openaiAdapter, openaiAdapterWithKey } from "./openai";
import { nvidiaAdapter, nvidiaAdapterWithKey } from "./nvidia";
import { ollamaAdapter } from "./ollama";
import { asLlmError, type LlmErrorCode } from "./errors";
import { listKeys, markDisabled, markSpent, type ResolvedKey } from "./keys";
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

/**
 * The same adapter, bound to one key from the provider's rotation.
 *
 * Separate from `adapterFor` because only keyed providers have one: `mock` needs
 * no credential and `ollama` deliberately sends none.
 */
function adapterWithKey(provider: KeyedProvider, apiKey: string): LlmAdapter {
  switch (provider) {
    case "gemini":
      return geminiAdapterWithKey(apiKey);
    case "anthropic":
      return anthropicAdapterWithKey(apiKey);
    case "openai":
      return openaiAdapterWithKey(apiKey);
    case "nvidia":
      return nvidiaAdapterWithKey(apiKey);
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

/** One attempt in the chain: an engine, and the key it was bound to if it has one. */
interface ChainLink {
  adapter: LlmAdapter;
  /** Absent for `mock` and `ollama`, and for a keyed provider with an empty rotation. */
  key?: ResolvedKey;
}

/**
 * The engines to try for one turn, in order.
 *
 * Two dimensions, walked outer-to-inner: every KEY a provider holds before the
 * next PROVIDER. `LLM_PROVIDER=gemini` with three keys and
 * `LLM_FALLBACK_PROVIDER=ollama` produces
 * `[gemini#1, gemini#2, gemini#3, ollama, mock]`.
 *
 * That order is the point of the feature. Falling to Ollama while two unspent
 * Gemini keys are sitting there would answer a student on a weaker model for no
 * reason — the second key is a strictly better answer than the second provider.
 *
 * Always ends at the mock, and the mock is only ever last: it is offline and
 * deterministic, so it cannot fail, which makes it a floor rather than another
 * link. Anything placed behind it would be unreachable.
 *
 * Async only because the rotation may live in the database. The provider NAMES
 * are still resolved synchronously from the environment, which is what lets
 * `runTurn` fill in `outcome` before the first `await`.
 */
async function providerChain(options: TurnOptions): Promise<ChainLink[]> {
  const configured: LlmProvider[] = [env.llm.provider];
  if (env.llm.fallbackProvider) configured.push(env.llm.fallbackProvider);

  // The spend guard already said no, so a metered engine is out — but an
  // unmetered one costs the guarded quota nothing, and a real local model is a
  // better answer than the mock. This is why the guard is worth a chain at all
  // and not just an early `serveMock`.
  const usable = options.budgetBlocked
    ? configured.filter((provider) => !isMeteredProvider(provider))
    : configured;

  const links: ChainLink[] = [];

  for (const provider of usable) {
    if (provider === "mock") continue;

    if (!isKeyedProvider(provider)) {
      links.push({ adapter: adapterFor(provider) });
      continue;
    }

    const keys = await listKeys(provider);

    // An empty rotation still gets ONE link, using the keyless adapter, so the
    // turn fails with "GEMINI_API_KEY not set" naming the fix rather than
    // silently skipping a provider the operator believes is configured.
    if (keys.length === 0) {
      links.push({ adapter: adapterFor(provider) });
      continue;
    }

    for (const key of keys) {
      links.push({ adapter: adapterWithKey(provider, key.secret), key });
    }
  }

  links.push({ adapter: mockAdapter });
  return links;
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
 * The chain is every key `LLM_PROVIDER` holds, then every key
 * `LLM_FALLBACK_PROVIDER` holds (when set), then the mock — see `providerChain`.
 * Every link that changes PROVIDER is labelled `<name> (fallback)` on the outcome,
 * so a turn served by a stand-in is never recorded as one the configured provider
 * answered. Moving between keys of the SAME provider is not labelled, because the
 * engine that answered really was the configured one.
 */
function runTurn(call: Call, options: TurnOptions = {}): Turn {
  const configured = getAdapter();
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

    // Built here rather than beside `outcome` because the rotation may come from
    // the database. Nothing has been yielded yet, so the await costs the student
    // nothing they can see.
    const chain = await providerChain(options);

    for (let i = 0; i < chain.length; i++) {
      const { adapter, key } = chain[i];

      // Compared by NAME, not by identity, and the difference is the whole
      // reason key rotation is invisible to the student: `gemini` key 2 is a
      // different adapter instance but the same engine, and badging its answer
      // `gemini (fallback)` would claim a stand-in wrote a reply that real
      // Gemini did. Only an actual change of provider is a fallback.
      if (adapter.name !== configured.name) noteFallback(adapter, reason);

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
            console.error(
              `[llm] ${adapter.name}${key ? ` (key ${key.hint})` : ""} failed mid-stream:`,
              error,
            );
            outcome.interrupted = error.code;
            return;
          }

          if (attempt === 0 && error.code === "rate_limited") {
            console.warn(`[llm] ${adapter.name} rate limited, retrying once:`, error.message);
            await sleep(RETRY_DELAY_MS);
            continue;
          }

          // Record what this key did before moving past it, so tomorrow's turns
          // do not rediscover it. Both are best-effort and neither blocks the
          // handoff — a bookkeeping write must not cost the student a turn.
          if (key) {
            if (error.code === "quota_exhausted") await markSpent(key);
            else if (error.code === "key_rejected") await markDisabled(key, error.message);
          }

          reason = error.code === "quota_exhausted" ? "quota" : "error";
          // The mock throws above rather than reaching here, so there is always
          // a next link to name.
          console.error(
            `[llm] ${adapter.name}${key ? ` (key ${key.hint})` : ""} failed, ` +
              `falling back to ${chain[i + 1].adapter.name}:`,
            error,
          );
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
