/**
 * Validated environment access. The app runs with none of these set.
 * Everything here is optional; sane local-first defaults are used when unset.
 */

export type LlmProvider = "mock" | "gemini" | "anthropic" | "openai";

const PROVIDERS: readonly LlmProvider[] = ["mock", "gemini", "anthropic", "openai"];

function isProvider(value: string | undefined): value is LlmProvider {
  return value !== undefined && (PROVIDERS as readonly string[]).includes(value);
}

/**
 * Gemini is checked first because it is the only provider with a free tier, and
 * so the default real provider. An explicit LLM_PROVIDER always wins.
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
  },

  isProd: process.env.NODE_ENV === "production",
};

/** True when a real LLM key is configured (vs. the offline mock). */
export const hasRealLlm = env.llm.provider !== "mock";
