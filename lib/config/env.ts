/**
 * Validated environment access. The app runs with none of these set.
 * Everything here is optional; sane local-first defaults are used when unset.
 */

export type LlmProvider = "mock" | "anthropic" | "openai";

function detectProvider(): LlmProvider {
  const explicit = process.env.LLM_PROVIDER?.toLowerCase();
  if (explicit === "anthropic" || explicit === "openai" || explicit === "mock") {
    return explicit;
  }
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
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    openaiApiKey: process.env.OPENAI_API_KEY,
  },

  isProd: process.env.NODE_ENV === "production",
};

/** True when a real LLM key is configured (vs. the offline mock). */
export const hasRealLlm = env.llm.provider !== "mock";
