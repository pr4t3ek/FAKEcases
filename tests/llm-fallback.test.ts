import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * The provider chain: `LLM_PROVIDER` → `LLM_FALLBACK_PROVIDER` → mock.
 *
 * The pairing exercised here is the one the feature exists for — a hosted NVIDIA
 * key in front of a local Ollama model — but nothing below is specific to it:
 * the chain is built from provider names in `lib/config/env.ts`, so Gemini in
 * front of Ollama walks the same code.
 *
 * Only `fetch` is stubbed, and it is routed by host, so both adapters run for
 * real: real SSE parsing, real error classification, real fallback wiring. The
 * two providers share a wire format, which is exactly why the URL is the only
 * way to tell their calls apart.
 *
 * Gemini's SDK is mocked out only because importing `@/lib/llm` pulls it in.
 */
vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContentStream: vi.fn() };
  },
}));

const NVIDIA_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const OLLAMA_URL = "http://localhost:11434/v1/chat/completions";

const fetchMock = vi.fn();

/** An OpenAI-style SSE frame carrying one content delta. */
function frame(content: string): string {
  return `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`;
}

/** A streaming `Response` whose body arrives in the given chunks. */
function sseResponse(...chunks: string[]): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(body, { status: 200 });
}

/**
 * A body that dies partway through, i.e. a provider failing after it has emitted
 * text. Fed on `pull` rather than up front in `start`, because erroring a stream
 * discards whatever is still queued — the deltas have to be read before the
 * break for this to be the mid-stream case at all.
 */
function brokenSseResponse(...chunks: string[]): Response {
  const encoder = new TextEncoder();
  let next = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (next < chunks.length) {
        controller.enqueue(encoder.encode(chunks[next++]));
        return;
      }
      controller.error(new Error("connection reset"));
    },
  });
  return new Response(body, { status: 200 });
}

function errorResponse(status: number, body = ""): Response {
  return new Response(body, { status });
}

type Reply = () => Response;

/**
 * Route the stubbed `fetch` by host.
 *
 * Each handler is a factory rather than a `Response`, because a body can only be
 * read once and the retry path calls the same provider twice.
 */
function route(handlers: { nvidia: Reply; ollama: Reply }): void {
  fetchMock.mockImplementation(async (url: unknown) => {
    const target = String(url);
    if (target.startsWith(NVIDIA_URL)) return handlers.nvidia();
    if (target.startsWith(OLLAMA_URL)) return handlers.ollama();
    throw new Error(`unexpected fetch: ${target}`);
  });
}

function callsTo(url: string): unknown[][] {
  return fetchMock.mock.calls.filter(([target]) => String(target).startsWith(url));
}

async function loadLlm() {
  return import("@/lib/llm");
}

function ctx() {
  return {
    question: {
      title: "Umbrellas in Mumbai",
      prompt: "Estimate annual umbrella demand in Mumbai.",
      category: "demand-estimation",
      difficulty: "Easy",
      interviewLevel: "McKinsey",
      idealLow: 6_000_000,
      idealHigh: 12_000_000,
      unit: "umbrellas/year",
      betterApproach: "Segment adults vs children, apply replacement frequency.",
      sampleSolution: "~80 lakh umbrellas/year",
    },
    mode: "interviewer" as const,
    messages: [],
    assumptions: [],
    framework: [],
    hintsUsed: 0,
  };
}

describe("nvidia with an ollama fallback", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("LLM_PROVIDER", "nvidia");
    vi.stubEnv("LLM_FALLBACK_PROVIDER", "ollama");
    vi.stubEnv("NVIDIA_API_KEY", "nvapi-test-key");
    vi.stubEnv("NVIDIA_MODEL", "meta/llama-3.1-8b-instruct");
    vi.stubEnv("OLLAMA_MODEL", "qwen2.5:7b");
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  /**
   * The point of the whole feature: a rejected key used to drop the student to
   * the offline mock even with a working local model on the same machine.
   */
  it("serves the turn from Ollama when NVIDIA rejects the key", async () => {
    route({
      nvidia: () => errorResponse(401, "invalid api key"),
      ollama: () => sseResponse(frame("How would "), frame("you segment?")),
    });
    const { interviewerReplyStream, collectTurn } = await loadLlm();

    const { text, outcome } = await collectTurn(interviewerReplyStream(ctx()));

    expect(text).toBe("How would you segment?");
    expect(outcome.provider).toBe("ollama (fallback)");
    expect(outcome.model).toBe("qwen2.5:7b");
    expect(outcome.fallbackReason).toBe("error");
    expect(outcome.interrupted).toBeUndefined();
  });

  /**
   * "Won't generate the responses" — a 200 that streams no content. Already
   * treated as a failure rather than an empty answer; this pins that it now
   * reaches the fallback rather than the mock.
   */
  it("falls through when NVIDIA answers with an empty stream", async () => {
    route({
      nvidia: () => sseResponse("data: [DONE]\n\n"),
      ollama: () => sseResponse(frame("What drives the estimate?")),
    });
    const { interviewerReplyStream, collectTurn } = await loadLlm();

    const { text, outcome } = await collectTurn(interviewerReplyStream(ctx()));

    expect(text).toBe("What drives the estimate?");
    expect(outcome.provider).toBe("ollama (fallback)");
  });

  it("does not call the fallback when NVIDIA answers", async () => {
    route({
      nvidia: () => sseResponse(frame("Where would you start?")),
      ollama: () => sseResponse(frame("local")),
    });
    const { interviewerReplyStream, collectTurn } = await loadLlm();

    const { text, outcome } = await collectTurn(interviewerReplyStream(ctx()));

    expect(text).toBe("Where would you start?");
    expect(outcome.provider).toBe("nvidia");
    expect(outcome.fallbackReason).toBeUndefined();
    expect(callsTo(OLLAMA_URL)).toHaveLength(0);
  });

  /**
   * The retry is per link, not per chain: a transient limit is still worth one
   * more try on the provider the deployment actually chose before handing the
   * turn to a weaker local model.
   */
  it("retries NVIDIA once on a rate limit before falling through", async () => {
    let nvidiaCalls = 0;
    route({
      nvidia: () => {
        nvidiaCalls++;
        return errorResponse(429, "too many requests");
      },
      ollama: () => sseResponse(frame("Local model answering.")),
    });
    const { interviewerReplyStream, collectTurn } = await loadLlm();

    const { text, outcome } = await collectTurn(interviewerReplyStream(ctx()));

    expect(nvidiaCalls).toBe(2);
    expect(text).toBe("Local model answering.");
    expect(outcome.provider).toBe("ollama (fallback)");
    expect(callsTo(OLLAMA_URL)).toHaveLength(1);
  });

  /**
   * `fallbackReason` reports why the CONFIGURED provider dropped out, so an
   * exhausted allowance stays legible on a turn another engine answered.
   */
  it("keeps the reason NVIDIA dropped out when the fallback answers", async () => {
    route({
      nvidia: () => errorResponse(402, "payment required"),
      ollama: () => sseResponse(frame("Still practising.")),
    });
    const { interviewerReplyStream, collectTurn } = await loadLlm();

    const { outcome } = await collectTurn(interviewerReplyStream(ctx()));

    expect(outcome.provider).toBe("ollama (fallback)");
    expect(outcome.fallbackReason).toBe("quota");
    // Spent credits are terminal — they must not burn the retry.
    expect(callsTo(NVIDIA_URL)).toHaveLength(1);
  });

  /** The mock is still the floor: two dead engines must not surface as an error. */
  it("degrades to the mock when both engines fail", async () => {
    route({
      nvidia: () => errorResponse(500, "upstream error"),
      ollama: () => errorResponse(503, "model loading"),
    });
    const { interviewerReplyStream, collectTurn, MOCK_FALLBACK } = await loadLlm();

    const { text, outcome } = await collectTurn(interviewerReplyStream(ctx()));

    expect(text.length).toBeGreaterThan(10);
    expect(outcome.provider).toBe(MOCK_FALLBACK);
    expect(outcome.model).toBeUndefined();
    // Both are 5xx, so both are retried once: two calls each.
    expect(callsTo(NVIDIA_URL)).toHaveLength(2);
    expect(callsTo(OLLAMA_URL)).toHaveLength(2);
  });

  /**
   * The rule the chain must not break: once text has reached the user, a second
   * engine finishing the paragraph would change voice and reasoning mid-answer.
   * Truncating is worse-looking and better.
   */
  it("never splices the fallback onto a reply that failed mid-stream", async () => {
    route({
      nvidia: () => brokenSseResponse(frame("How would you "), frame("segment the ")),
      ollama: () => sseResponse(frame(" — and what about children?")),
    });
    const { interviewerReplyStream, collectTurn } = await loadLlm();

    const { text, outcome } = await collectTurn(interviewerReplyStream(ctx()));

    expect(text).toBe("How would you segment the ");
    expect(outcome.provider).toBe("nvidia");
    expect(outcome.interrupted).toBe("provider_error");
    expect(outcome.fallbackReason).toBeUndefined();
    expect(callsTo(OLLAMA_URL)).toHaveLength(0);
  });

  /**
   * A spend guard protects a metered quota, and Ollama draws on none — so the
   * turn a budget block used to hand to the mock now goes to a real local model.
   * NVIDIA is still not called: that is the thing being guarded.
   */
  it("routes a budget-blocked turn to the unmetered fallback, not the mock", async () => {
    route({
      nvidia: () => sseResponse(frame("hosted")),
      ollama: () => sseResponse(frame("Answered locally.")),
    });
    const { interviewerReplyStream, collectTurn } = await loadLlm();

    const { text, outcome } = await collectTurn(
      interviewerReplyStream(ctx(), { budgetBlocked: true }),
    );

    expect(text).toBe("Answered locally.");
    expect(outcome.provider).toBe("ollama (fallback)");
    expect(outcome.fallbackReason).toBe("budget");
    expect(callsTo(NVIDIA_URL)).toHaveLength(0);
  });

  it("still reaches the mock when the fallback is metered too", async () => {
    vi.stubEnv("LLM_FALLBACK_PROVIDER", "openai");
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    const { interviewerReplyStream, collectTurn, MOCK_FALLBACK } = await loadLlm();

    const { outcome } = await collectTurn(interviewerReplyStream(ctx(), { budgetBlocked: true }));

    expect(outcome.provider).toBe(MOCK_FALLBACK);
    expect(outcome.fallbackReason).toBe("budget");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  /** Unset is the shipped default, and it must behave exactly as it did before. */
  it("degrades straight to the mock when no fallback is configured", async () => {
    vi.stubEnv("LLM_FALLBACK_PROVIDER", "");
    route({
      nvidia: () => errorResponse(401, "invalid api key"),
      ollama: () => sseResponse(frame("never reached")),
    });
    const { interviewerReplyStream, collectTurn, MOCK_FALLBACK } = await loadLlm();

    const { outcome } = await collectTurn(interviewerReplyStream(ctx()));

    expect(outcome.provider).toBe(MOCK_FALLBACK);
    expect(callsTo(OLLAMA_URL)).toHaveLength(0);
  });
});

describe("fallback provider detection", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("LLM_PROVIDER", "nvidia");
    vi.stubEnv("NVIDIA_API_KEY", "nvapi-x");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reads LLM_FALLBACK_PROVIDER", async () => {
    vi.stubEnv("LLM_FALLBACK_PROVIDER", "ollama");

    const { env } = await import("@/lib/config");
    expect(env.llm.fallbackProvider).toBe("ollama");
  });

  /** Never sniffed: a local model that isn't running must not be tried by accident. */
  it("is unset unless asked for by name", async () => {
    vi.stubEnv("OLLAMA_MODEL", "qwen2.5:7b");

    const { env } = await import("@/lib/config");
    expect(env.llm.fallbackProvider).toBeUndefined();
  });

  it("ignores a fallback naming the configured provider", async () => {
    vi.stubEnv("LLM_FALLBACK_PROVIDER", "nvidia");

    const { env } = await import("@/lib/config");
    expect(env.llm.fallbackProvider).toBeUndefined();
  });

  /** The mock is the floor of every chain already; naming it changes nothing. */
  it("ignores a mock fallback", async () => {
    vi.stubEnv("LLM_FALLBACK_PROVIDER", "mock");

    const { env } = await import("@/lib/config");
    expect(env.llm.fallbackProvider).toBeUndefined();
  });

  it("ignores a fallback behind a mock primary, which could never run", async () => {
    vi.stubEnv("LLM_PROVIDER", "mock");
    vi.stubEnv("LLM_FALLBACK_PROVIDER", "ollama");

    const { env } = await import("@/lib/config");
    expect(env.llm.fallbackProvider).toBeUndefined();
  });

  it("keeps the spend guards on for a metered primary", async () => {
    vi.stubEnv("LLM_FALLBACK_PROVIDER", "ollama");

    const { isMeteredLlm } = await import("@/lib/config");
    expect(isMeteredLlm).toBe(true);
  });

  /**
   * The inverse case, and the reason `isMeteredLlm` looks at both links: a local
   * primary spends nothing until it goes down, and then every turn is billed.
   */
  it("turns the spend guards on for a metered fallback behind a local primary", async () => {
    vi.stubEnv("LLM_PROVIDER", "ollama");
    vi.stubEnv("LLM_FALLBACK_PROVIDER", "nvidia");

    const { isMeteredLlm } = await import("@/lib/config");
    expect(isMeteredLlm).toBe(true);
  });

  it("leaves them off for a local primary with no fallback", async () => {
    vi.stubEnv("LLM_PROVIDER", "ollama");

    const { isMeteredLlm } = await import("@/lib/config");
    expect(isMeteredLlm).toBe(false);
  });
});
