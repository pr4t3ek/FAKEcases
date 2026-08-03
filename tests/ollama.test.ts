import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Ollama is the local-model path used for development. Only `fetch` is stubbed,
 * so these exercise the real SSE parsing, the real error classification and the
 * real fallback wiring in `runTurn` — no Ollama server required.
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

/** How `fetch` surfaces a refused connection: opaque message, real reason on `cause`. */
function connectionRefused(): TypeError {
  return Object.assign(new TypeError("fetch failed"), {
    cause: new Error("connect ECONNREFUSED 127.0.0.1:11434"),
  });
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

describe("ollama adapter", () => {
  let errorLog: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("LLM_PROVIDER", "ollama");
    vi.stubEnv("OLLAMA_MODEL", "qwen2.5:7b");
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
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
    expect(outcome.provider).toBe("ollama");
    expect(outcome.model).toBe("qwen2.5:7b");
    expect(outcome.fallbackReason).toBeUndefined();
    expect(outcome.interrupted).toBeUndefined();
  });

  it("reassembles a frame split across chunk boundaries", async () => {
    const whole = frame("Segment by household.");
    const split = Math.floor(whole.length / 2);
    fetchMock.mockResolvedValue(sseResponse(whole.slice(0, split), whole.slice(split)));
    const { interviewerReplyStream, collectTurn } = await loadLlm();

    const { text } = await collectTurn(interviewerReplyStream(ctx()));

    expect(text).toBe("Segment by household.");
  });

  it("skips a malformed frame rather than failing the turn", async () => {
    fetchMock.mockResolvedValue(
      sseResponse(frame("Good. "), "data: {not json\n\n", frame("Now size it.")),
    );
    const { interviewerReplyStream, collectTurn } = await loadLlm();

    const { text, outcome } = await collectTurn(interviewerReplyStream(ctx()));

    expect(text).toBe("Good. Now size it.");
    expect(outcome.provider).toBe("ollama");
  });

  it("stops at the [DONE] sentinel", async () => {
    fetchMock.mockResolvedValue(
      sseResponse(frame("Enough."), "data: [DONE]\n\n", frame(" Not this.")),
    );
    const { interviewerReplyStream, collectTurn } = await loadLlm();

    const { text } = await collectTurn(interviewerReplyStream(ctx()));

    expect(text).toBe("Enough.");
  });

  it("requests a streaming completion and sends no API key", async () => {
    fetchMock.mockResolvedValue(sseResponse(frame("Hi")));
    const { interviewerReplyStream, collectTurn } = await loadLlm();

    await collectTurn(interviewerReplyStream(ctx()));

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:11434/v1/chat/completions");
    expect(init.headers).not.toHaveProperty("authorization");

    const body = JSON.parse(init.body);
    expect(body.stream).toBe(true);
    expect(body.model).toBe("qwen2.5:7b");
    expect(body.messages[0].role).toBe("system");
  });

  it("falls back to the mock when Ollama is not running", async () => {
    fetchMock.mockRejectedValue(connectionRefused());
    const { interviewerReplyStream, collectTurn, MOCK_FALLBACK } = await loadLlm();

    const { text, outcome } = await collectTurn(interviewerReplyStream(ctx()));

    expect(text.length).toBeGreaterThan(10);
    expect(outcome.provider).toBe(MOCK_FALLBACK);
    expect(outcome.fallbackReason).toBe("error");
    expect(outcome.model).toBeUndefined();
  });

  it("names the pull command when the model was never downloaded", async () => {
    fetchMock.mockImplementation(() => new Response("model not found", { status: 404 }));
    const { interviewerReplyStream, collectTurn, MOCK_FALLBACK } = await loadLlm();

    const { outcome } = await collectTurn(interviewerReplyStream(ctx()));

    expect(outcome.provider).toBe(MOCK_FALLBACK);
    // The badge says the mock answered; only the log says why.
    const logged = errorLog.mock.calls.flat().map(String).join(" ");
    expect(logged).toContain("ollama pull qwen2.5:7b");
  });

  it("retries once on a local-server error before giving up", async () => {
    // A fresh Response per call: a rejected body can only be read once.
    fetchMock.mockImplementation(() => new Response("overloaded", { status: 503 }));
    const { interviewerReplyStream, collectTurn, MOCK_FALLBACK } = await loadLlm();

    const { outcome } = await collectTurn(interviewerReplyStream(ctx()));

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(outcome.provider).toBe(MOCK_FALLBACK);
  });

  it("prefers OLLAMA_MODEL over a shared LLM_MODEL left behind by another provider", async () => {
    vi.stubEnv("LLM_MODEL", "gemini-2.5-flash");
    fetchMock.mockResolvedValue(sseResponse(frame("Hi")));
    const { interviewerReplyStream, collectTurn } = await loadLlm();

    const { outcome } = await collectTurn(interviewerReplyStream(ctx()));

    expect(outcome.model).toBe("qwen2.5:7b");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).model).toBe("qwen2.5:7b");
  });

  it("honours OLLAMA_BASE_URL for any OpenAI-compatible local server", async () => {
    vi.stubEnv("OLLAMA_BASE_URL", "http://127.0.0.1:1234/v1/");
    fetchMock.mockResolvedValue(sseResponse(frame("Hi")));
    const { interviewerReplyStream, collectTurn } = await loadLlm();

    await collectTurn(interviewerReplyStream(ctx()));

    expect(fetchMock.mock.calls[0][0]).toBe("http://127.0.0.1:1234/v1/chat/completions");
  });
});
