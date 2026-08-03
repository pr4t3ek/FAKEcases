/**
 * Validated environment access. The app runs with none of these set.
 * Everything here is optional; sane local-first defaults are used when unset.
 */

export type LlmProvider = "mock" | "gemini" | "anthropic" | "openai" | "ollama";

const PROVIDERS: readonly LlmProvider[] = ["mock", "gemini", "anthropic", "openai", "ollama"];

/**
 * Providers that draw on a shared, metered quota.
 *
 * Ollama runs locally and bills nothing, so the spend guards in `lib/llm/budget.ts`
 * would only degrade a dev session to the mock for no benefit.
 */
const LOCAL_PROVIDERS: readonly LlmProvider[] = ["ollama"];

function isProvider(value: string | undefined): value is LlmProvider {
  return value !== undefined && (PROVIDERS as readonly string[]).includes(value);
}

/**
 * Gemini is checked first because it is the only provider with a free tier, and
 * so the default real provider. An explicit LLM_PROVIDER always wins.
 *
 * Ollama is deliberately absent from the sniffing chain: it has no API key to
 * detect, so it must be asked for by name (`LLM_PROVIDER=ollama`). That keeps the
 * zero-key default at `mock` and means no stray env var can point a deployment at
 * a localhost model that isn't there.
 */
function detectProvider(): LlmProvider {
  const explicit = process.env.LLM_PROVIDER?.toLowerCase();
  if (isProvider(explicit)) return explicit;

  if (process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.OPENAI_API_KEY) return "openai";
  return "mock";
}

export const env = {
  databaseUrl: process.env.DATABASE_URL ?? "file:./dev.db",
  authSecret: process.env.AUTH_SECRET ?? "estimateiq-dev-secret-change-me",

  llm: {
    provider: detectProvider(),
    model: process.env.LLM_MODEL,
    geminiApiKey: process.env.GEMINI_API_KEY,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    openaiApiKey: process.env.OPENAI_API_KEY,
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

/** True when provider calls are billed against a shared quota worth guarding. */
export const isMeteredLlm =
  hasRealLlm && !(LOCAL_PROVIDERS as readonly string[]).includes(env.llm.provider);
