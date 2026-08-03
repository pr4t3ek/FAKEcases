/**
 * Provider-agnostic error classification.
 *
 * The distinction that matters downstream is *retryability*: a per-minute rate
 * limit is worth one retry, an exhausted daily quota is not (nothing will change
 * until the quota window rolls over), and an auth/config problem never will be.
 */

export type LlmErrorCode =
  /** Daily/period quota is gone. Don't retry — degrade for the rest of the window. */
  | "quota_exhausted"
  /** Transient: per-minute rate limit or provider overload. Worth one retry. */
  | "rate_limited"
  /** Auth, config, bad request, empty response. Not retryable. */
  | "provider_error";

export class LlmError extends Error {
  readonly code: LlmErrorCode;

  constructor(code: LlmErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "LlmError";
    this.code = code;
  }
}

/** Narrow an unknown thrown value to an LlmError, defaulting to a hard failure. */
export function asLlmError(err: unknown): LlmError {
  if (err instanceof LlmError) return err;
  const message = err instanceof Error ? err.message : String(err);
  return new LlmError("provider_error", message, { cause: err });
}

/** Best-effort HTTP status extraction across SDK error shapes. */
function statusOf(err: unknown): number | undefined {
  if (typeof err !== "object" || err === null) return undefined;
  const e = err as Record<string, unknown>;
  for (const key of ["status", "code", "statusCode"]) {
    const v = e[key];
    if (typeof v === "number" && v >= 100 && v < 600) return v;
  }
  return undefined;
}

/**
 * Classify an error thrown by the Gemini SDK.
 *
 * Google returns 429 `RESOURCE_EXHAUSTED` for *both* the per-minute and the
 * per-day ceiling, and only the quota-metric name in the message tells them
 * apart. Getting this wrong is expensive in opposite directions: retrying an
 * exhausted daily quota burns latency for a guaranteed failure, while treating
 * a per-minute blip as terminal drops the app to the mock for the rest of the day.
 */
export function classifyGeminiError(err: unknown): LlmError {
  if (err instanceof LlmError) return err;

  const message = err instanceof Error ? err.message : String(err);
  const status = statusOf(err);
  const haystack = message.toLowerCase();

  if (status === 429 || haystack.includes("resource_exhausted")) {
    const perDay = /per[\s_-]?day|requestsperday|daily/i.test(message);
    return perDay
      ? new LlmError("quota_exhausted", `Gemini daily quota exhausted: ${message}`, { cause: err })
      : new LlmError("rate_limited", `Gemini rate limited: ${message}`, { cause: err });
  }

  if (status !== undefined && status >= 500) {
    return new LlmError("rate_limited", `Gemini unavailable (${status}): ${message}`, { cause: err });
  }

  return new LlmError("provider_error", `Gemini error: ${message}`, { cause: err });
}

/**
 * Classify a failure from a local Ollama server.
 *
 * Worth more care than the message length suggests. `runTurn()` falls back to the
 * mock on *any* provider failure, so a local model that was never started still
 * produces a perfectly good-looking reply — from the offline mock. The only signal
 * that anything is wrong is the badge in the chat and this line in the server log,
 * so it needs to name the fix rather than just the symptom.
 *
 * There is no quota to exhaust locally, so `quota_exhausted` is never returned.
 */
export function classifyOllamaError(
  err: unknown,
  context: { baseUrl: string; model: string },
): LlmError {
  if (err instanceof LlmError) return err;

  const message = err instanceof Error ? err.message : String(err);
  const status = statusOf(err);

  // `fetch` reports a refused connection as an opaque "fetch failed" with the real
  // reason on `cause`, so check both.
  const cause = err instanceof Error && err.cause instanceof Error ? err.cause.message : "";
  const haystack = `${message} ${cause}`.toLowerCase();
  if (
    haystack.includes("econnrefused") ||
    haystack.includes("fetch failed") ||
    haystack.includes("other side closed")
  ) {
    return new LlmError(
      "provider_error",
      `Ollama not reachable at ${context.baseUrl} — is \`ollama serve\` running? (${message})`,
      { cause: err },
    );
  }

  if (status === 404) {
    return new LlmError(
      "provider_error",
      `Ollama has no model '${context.model}' — run \`ollama pull ${context.model}\`.`,
      { cause: err },
    );
  }

  // A local server is more likely overloaded than broken: one retry is cheap.
  if (status !== undefined && status >= 500) {
    return new LlmError("rate_limited", `Ollama unavailable (${status}): ${message}`, {
      cause: err,
    });
  }

  return new LlmError("provider_error", `Ollama error: ${message}`, { cause: err });
}
