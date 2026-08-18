import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * NVIDIA NIM is the hosted OpenAI-compatible provider. Only `fetch` is stubbed,
 * so these exercise the real SSE parsing, the real error classification and the
 * real fallback wiring in `runTurn` — no network required.
 *
 * The cases worth having are the two things that make it NOT the Ollama adapter
 * with a different URL: it sends a bearer token, and it is metered, so its
 * failures have to classify into the retryable/terminal split that decides
 * whether the turn is retried or degraded to the mock.
 *
 * Gemini's SDK is mocked out only because importing `@/lib/llm` pulls it in.
 */
vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContentStream: vi.fn() };
  },
}));

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

/** A non-streaming error response, as the API returns for a rejected request. */
function errorResponse(status: number, body = ""): Response {
  return new Response(body, { status });
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

describe("nvidia adapter", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("LLM_PROVIDER", "nvidia");
    vi.stubEnv("NVIDIA_API_KEY", "nvapi-test-key");
    vi.stubEnv("NVIDIA_MODEL", "meta/llama-3.1-8b-instruct");
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

  it("streams SSE deltas and reports the provider and model", async () => {
    fetchMock.mockResolvedValue(
      sseResponse(frame("How would "), frame("you segment?"), "data: [DONE]\n\n"),
    );
    const { interviewerReplyStream, collectTurn } = await loadLlm();

    const { text, outcome } = await collectTurn(interviewerReplyStream(ctx()));

    expect(text).toBe("How would you segment?");
    expect(outcome.provider).toBe("nvidia");
    expect(outcome.model).toBe("meta/llama-3.1-8b-instruct");
    expect(outcome.fallbackReason).toBeUndefined();
    expect(outcome.interrupted).toBeUndefined();
  });

  /**
   * The single difference from Ollama that makes this a separate adapter rather
   * than a base-URL change: NVIDIA needs a bearer token, and the Ollama adapter
   * deliberately sends none.
   */
  it("sends the bearer token to the NVIDIA endpoint", async () => {
    fetchMock.mockResolvedValue(sseResponse(frame("Hi")));
    const { interviewerReplyStream, collectTurn } = await loadLlm();

    await collectTurn(interviewerReplyStream(ctx()));

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://integrate.api.nvidia.com/v1/chat/completions");
    expect(init.headers.authorization).toBe("Bearer nvapi-test-key");

    const body = JSON.parse(init.body);
    expect(body.stream).toBe(true);
    expect(body.model).toBe("meta/llama-3.1-8b-instruct");
    expect(body.messages[0].role).toBe("system");
  });

  it("reassembles a frame split across chunk boundaries", async () => {
    const whole = frame("Segment by household.");
    const split = Math.floor(whole.length / 2);
    fetchMock.mockResolvedValue(sseResponse(whole.slice(0, split), whole.slice(split)));
    const { interviewerReplyStream, collectTurn } = await loadLlm();

    const { text } = await collectTurn(interviewerReplyStream(ctx()));

    expect(text).toBe("Segment by household.");
  });

  /**
   * `NVIDIA_MODEL` is separate from the shared `LLM_MODEL` precisely so a name
   * belonging to another provider cannot be sent here. Pinned because the
   * failure is a 404 on a model that never existed in NVIDIA's catalogue.
   */
  it("prefers NVIDIA_MODEL over the shared LLM_MODEL", async () => {
    vi.stubEnv("LLM_MODEL", "gemini-2.5-flash");
    fetchMock.mockResolvedValue(sseResponse(frame("Hi")));
    const { interviewerReplyStream, collectTurn } = await loadLlm();

    await collectTurn(interviewerReplyStream(ctx()));

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.model).toBe("meta/llama-3.1-8b-instruct");
  });

  /**
   * Every provider failure degrades the turn to the mock, so the only question
   * these cases answer is whether the failure was worth a retry. A spent
   * allowance is not; a rate limit is.
   */
  it("degrades to the mock when the key is rejected", async () => {
    fetchMock.mockResolvedValue(errorResponse(401, "invalid api key"));
    const { interviewerReplyStream, collectTurn } = await loadLlm();

    const { text, outcome } = await collectTurn(interviewerReplyStream(ctx()));

    expect(text.length).toBeGreaterThan(0);
    expect(outcome.provider).toBe("mock (fallback)");
    expect(fetchMock).toHaveBeenCalledTimes(1); // not retryable
  });

  it("retries once on a rate limit", async () => {
    fetchMock
      .mockResolvedValueOnce(errorResponse(429, "too many requests"))
      .mockResolvedValueOnce(sseResponse(frame("Second time lucky.")));
    const { interviewerReplyStream, collectTurn } = await loadLlm();

    const { text, outcome } = await collectTurn(interviewerReplyStream(ctx()));

    expect(text).toBe("Second time lucky.");
    expect(outcome.provider).toBe("nvidia");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry exhausted credits", async () => {
    fetchMock.mockResolvedValue(errorResponse(402, "payment required"));
    const { interviewerReplyStream, collectTurn } = await loadLlm();

    const { outcome } = await collectTurn(interviewerReplyStream(ctx()));

    expect(outcome.provider).toBe("mock (fallback)");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  /** Without a key there is nothing to send, and the log should say so. */
  it("falls back to the mock when no key is configured", async () => {
    vi.stubEnv("NVIDIA_API_KEY", "");
    const { interviewerReplyStream, collectTurn } = await loadLlm();

    const { outcome } = await collectTurn(interviewerReplyStream(ctx()));

    expect(outcome.provider).toBe("mock (fallback)");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("nvidia provider detection", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  /**
   * The precedence this project chose. It is silent when it is wrong — both keys
   * work — so it is pinned rather than left to the reading order of an if-chain.
   */
  it("wins over Gemini when both keys are present", async () => {
    vi.stubEnv("LLM_PROVIDER", "");
    vi.stubEnv("NVIDIA_API_KEY", "nvapi-x");
    vi.stubEnv("GEMINI_API_KEY", "gem-x");

    const { env } = await import("@/lib/config");
    expect(env.llm.provider).toBe("nvidia");
  });

  it("is metered, so the spend guards apply", async () => {
    vi.stubEnv("LLM_PROVIDER", "nvidia");
    vi.stubEnv("NVIDIA_API_KEY", "nvapi-x");

    const { isMeteredLlm } = await import("@/lib/config");
    expect(isMeteredLlm).toBe(true);
  });

  it("still yields to an explicit LLM_PROVIDER", async () => {
    vi.stubEnv("LLM_PROVIDER", "gemini");
    vi.stubEnv("NVIDIA_API_KEY", "nvapi-x");

    const { env } = await import("@/lib/config");
    expect(env.llm.provider).toBe("gemini");
  });
});
