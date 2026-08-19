/**
 * Validated environment access. The app runs with none of these set.
 * Everything here is optional; sane local-first defaults are used when unset.
 */

export type LlmProvider = "mock" | "gemini" | "anthropic" | "openai" | "nvidia" | "ollama";

const PROVIDERS: readonly LlmProvider[] = [
  "mock",
  "gemini",
  "anthropic",
  "openai",
  "nvidia",
  "ollama",
];

/**
 * Providers that draw on a shared, metered quota.
 *
 * Ollama runs locally and bills nothing, so the spend guards in `lib/llm/budget.ts`
 * would only degrade a dev session to the mock for no benefit.
 */
const LOCAL_PROVIDERS: readonly LlmProvider[] = ["ollama"];

/**
 * Whether calls to this provider are billed against a quota worth guarding.
 *
 * Per-provider rather than a single flag because a deployment can now run two
 * engines at once — see `fallbackProvider` — and the guards care about the one
 * actually being asked to answer, not the one named in `LLM_PROVIDER`.
 */
export function isMeteredProvider(provider: LlmProvider): boolean {
  return provider !== "mock" && !(LOCAL_PROVIDERS as readonly string[]).includes(provider);
}

function isProvider(value: string | undefined): value is LlmProvider {
  return value !== undefined && (PROVIDERS as readonly string[]).includes(value);
}

/**
 * NVIDIA is checked first: it is this project's preferred hosted provider, so a
 * deployment holding its key should use it rather than fall through to whatever
 * else happens to be configured. Gemini follows, because it is the only one with
 * a free tier and so the right default when no preference is expressed. An
 * explicit LLM_PROVIDER always wins over the whole chain.
 *
 * The order is the only thing that decides a machine carrying two keys, and it
 * is silent when it is wrong — both keys work, so the app answers normally on
 * the provider you did not mean to pay for. Set LLM_PROVIDER when that matters.
 *
 * Ollama is deliberately absent from the sniffing chain: it has no API key to
 * detect, so it must be asked for by name (`LLM_PROVIDER=ollama`). That keeps the
 * zero-key default at `mock` and means no stray env var can point a deployment at
 * a localhost model that isn't there.
 */
function detectProvider(): LlmProvider {
  const explicit = process.env.LLM_PROVIDER?.toLowerCase();
  if (isProvider(explicit)) return explicit;

  if (process.env.NVIDIA_API_KEY) return "nvidia";
  if (process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.OPENAI_API_KEY) return "openai";
  return "mock";
}

/**
 * A second engine to try when the configured one cannot answer a turn.
 *
 * The case this exists for is `LLM_PROVIDER=nvidia` with
 * `LLM_FALLBACK_PROVIDER=ollama`: a hosted provider that is out of credit,
 * rate limited, unreachable or returning nothing hands the turn to a local
 * model instead of dropping the session to the offline mock.
 *
 * Opt-in by name, never sniffed, for the reason `detectProvider` gives about
 * Ollama: a fallback silently routes real student turns to a different engine,
 * so a deployment has to say out loud that the second one is there.
 *
 * Two settings are accepted and ignored, because both mean "no fallback" rather
 * than something the app could honour:
 *
 *   - **the same provider twice** — the retry in `runTurn` already covers the
 *     transient case, and re-running a spent quota just spends latency;
 *   - **`mock`** — it is the floor of every chain already.
 *
 * A fallback behind a `mock` primary is also dropped: the mock cannot fail, so
 * nothing behind it would ever run, and keeping it would only make
 * `isMeteredLlm` lie about a provider that is never called.
 */
function detectFallbackProvider(primary: LlmProvider): LlmProvider | undefined {
  const explicit = process.env.LLM_FALLBACK_PROVIDER?.toLowerCase();
  if (!isProvider(explicit)) return undefined;
  if (explicit === primary || explicit === "mock" || primary === "mock") return undefined;
  return explicit;
}

const provider = detectProvider();

export const env = {
  databaseUrl: process.env.DATABASE_URL ?? "file:./dev.db",
  authSecret: process.env.AUTH_SECRET ?? "case-closed-dev-secret-change-me",

  llm: {
    provider,
    /** Tried when `provider` fails before it has produced any text. */
    fallbackProvider: detectFallbackProvider(provider),
    model: process.env.LLM_MODEL,
    geminiApiKey: process.env.GEMINI_API_KEY,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    openaiApiKey: process.env.OPENAI_API_KEY,
    nvidiaApiKey: process.env.NVIDIA_API_KEY,
    /**
     * Separate from `model` for the reason `ollamaModel` is: `LLM_MODEL` is
     * shared by every provider, and NVIDIA ids are namespaced
     * (`meta/llama-3.1-8b-instruct`), so a name left over from another provider
     * is never a valid one here.
     */
    nvidiaModel: process.env.NVIDIA_MODEL,
    /** Any OpenAI-compatible local server; Ollama's default port. */
    ollamaBaseUrl: process.env.OLLAMA_BASE_URL,
    /**
     * Separate from `model` because `LLM_MODEL` is shared by every provider, so a
     * `gemini-2.5-flash` left over from the last session would otherwise be sent
     * to Ollama and 404 on a model that was never pulled.
     */
    ollamaModel: process.env.OLLAMA_MODEL,
  },

  isProd: process.env.NODE_ENV === "production",
};

/** True when a real LLM key is configured (vs. the offline mock). */
export const hasRealLlm = env.llm.provider !== "mock";

/**
 * True when provider calls are billed against a shared quota worth guarding.
 *
 * A metered *fallback* counts too. `LLM_PROVIDER=ollama` with a hosted provider
 * behind it spends real money the moment the local server is down, and the
 * guards are the only thing standing in front of that.
 */
export const isMeteredLlm =
  isMeteredProvider(env.llm.provider) ||
  (env.llm.fallbackProvider !== undefined && isMeteredProvider(env.llm.fallbackProvider));
