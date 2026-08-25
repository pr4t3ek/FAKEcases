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
  /**
   * The provider rejected this credential outright (401/403). Never retryable,
   * and unlike every other failure it is specific to ONE KEY rather than to the
   * provider — which is the whole reason it is separate from `provider_error`.
   * `runTurn` retires the key on it and moves to the next in the rotation, where
   * a bare `provider_error` would only have moved on and left the dead key in
   * the list to fail again tomorrow.
   */
  | "key_rejected"
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

  // Google reports a revoked or mistyped key as 400 INVALID_ARGUMENT as often as
  // 401, so the reason string is checked alongside the status. Getting this wrong
  // costs a key its retirement: it stays in the rotation failing every turn.
  if (status === 401 || status === 403 || /api[\s_-]?key/i.test(message)) {
    return new LlmError("key_rejected", `Gemini rejected the key: ${message}`, { cause: err });
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

/**
 * Classify a failure from NVIDIA NIM.
 *
 * Hosted and metered, so unlike Ollama it *can* exhaust a quota — and unlike
 * Gemini it separates the two cases by status rather than by prose: 429 is the
 * rate limit, and a spent allowance arrives as 402/403 rather than as a 429 with
 * a different message inside it. That is the distinction `runTurn` acts on, so
 * it is worth reading off the status rather than guessing from the body.
 *
 * The messages name the fix for the same reason `classifyOllamaError`'s do: any
 * provider failure silently degrades the turn to the mock, so the server log is
 * the only place the real problem is visible.
 */
export function classifyNvidiaError(
  err: unknown,
  context: { model: string },
): LlmError {
  if (err instanceof LlmError) return err;

  const message = err instanceof Error ? err.message : String(err);
  const status = statusOf(err);

  // `fetch` reports a network failure as an opaque "fetch failed" with the real
  // reason on `cause`, the same shape the Ollama classifier handles.
  const cause = err instanceof Error && err.cause instanceof Error ? err.cause.message : "";
  const haystack = `${message} ${cause}`.toLowerCase();
  if (haystack.includes("fetch failed") || haystack.includes("enotfound")) {
    return new LlmError(
      "provider_error",
      `NVIDIA not reachable at integrate.api.nvidia.com — check network access. (${message})`,
      { cause: err },
    );
  }

  if (status === 401 || status === 403) {
    return new LlmError(
      "key_rejected",
      `NVIDIA rejected the key (${status}) — it should start with 'nvapi-'.`,
      { cause: err },
    );
  }

  // 404 here is a model id, not a route: the path is fixed and the id is the
  // only part of the request an operator chose.
  if (status === 404) {
    return new LlmError(
      "provider_error",
      `NVIDIA has no model '${context.model}' — check NVIDIA_MODEL against the catalogue at build.nvidia.com.`,
      { cause: err },
    );
  }

  if (status === 402) {
    return new LlmError("quota_exhausted", `NVIDIA credits exhausted: ${message}`, { cause: err });
  }

  if (status === 429) {
    return new LlmError("rate_limited", `NVIDIA rate limited: ${message}`, { cause: err });
  }

  if (status !== undefined && status >= 500) {
    return new LlmError("rate_limited", `NVIDIA unavailable (${status}): ${message}`, {
      cause: err,
    });
  }

  return new LlmError("provider_error", `NVIDIA error: ${message}`, { cause: err });
}

/**
 * Classify an HTTP failure from an adapter with no classifier of its own.
 *
 * `openai.ts` and `anthropic.ts` are kept as paid upgrade paths rather than as
 * the primary provider, so neither grew the bespoke classification Gemini and
 * NVIDIA needed — they threw a bare `Error` and every failure landed on
 * `provider_error`. That was survivable while a provider had one key. It is not
 * now: a rotation cannot retire a rejected key it cannot recognise, and cannot
 * retry a rate limit it reads as fatal.
 *
 * Deliberately status-driven only. Neither API's error prose is stable enough to
 * match on, and a wrong guess here is a key retired for a transient blip.
 */
export function classifyHttpError(label: string, err: unknown): LlmError {
  if (err instanceof LlmError) return err;

  const message = err instanceof Error ? err.message : String(err);
  const status = statusOf(err);

  const cause = err instanceof Error && err.cause instanceof Error ? err.cause.message : "";
  const haystack = `${message} ${cause}`.toLowerCase();
  if (haystack.includes("fetch failed") || haystack.includes("enotfound")) {
    return new LlmError("provider_error", `${label} not reachable — check network access. (${message})`, {
      cause: err,
    });
  }

  if (status === 401 || status === 403) {
    return new LlmError("key_rejected", `${label} rejected the key (${status}): ${message}`, {
      cause: err,
    });
  }

  // 402 is a spent balance on both, which no retry and no other key on the same
  // account will fix — but a DIFFERENT account's key will, so it stays a
  // rotation-advancing failure rather than a fatal one.
  if (status === 402) {
    return new LlmError("quota_exhausted", `${label} credits exhausted: ${message}`, { cause: err });
  }

  if (status === 429 || (status !== undefined && status >= 500)) {
    return new LlmError("rate_limited", `${label} unavailable (${status}): ${message}`, {
      cause: err,
    });
  }

  return new LlmError("provider_error", `${label} error: ${message}`, { cause: err });
}
