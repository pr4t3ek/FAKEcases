import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { encodeLine, readNdjson, type StreamLine } from "@/lib/llm/stream";

/**
 * Only the network boundary is mocked, so these exercise the real adapter
 * selection, the real Gemini error classification, and the real fallback wiring.
 */
const generateContentStream = vi.fn();

vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContentStream };
  },
}));

/** An SDK-shaped error: a real Error carrying an HTTP status. */
function apiError(status: number, message: string): Error {
  return Object.assign(new Error(message), { status });
}

/** Gemini yields objects exposing `.text`. */
async function* chunks(...texts: string[]) {
  for (const text of texts) yield { text };
}

async function* chunksThenThrow(texts: string[], err: unknown) {
  for (const text of texts) yield { text };
  throw err;
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

describe("turn streaming and fallback", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("LLM_PROVIDER", "gemini");
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubEnv("LLM_MODEL", "gemini-2.5-flash");
    generateContentStream.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("streams provider deltas and reports the provider and model", async () => {
    generateContentStream.mockResolvedValue(chunks("How would ", "you segment?"));
    const { interviewerReplyStream, collectTurn } = await loadLlm();

    const turn = interviewerReplyStream(ctx());
    const { text, outcome } = await collectTurn(turn);

    expect(text).toBe("How would you segment?");
    expect(outcome.provider).toBe("gemini");
    expect(outcome.model).toBe("gemini-2.5-flash");
    expect(outcome.fallbackReason).toBeUndefined();
    expect(outcome.interrupted).toBeUndefined();
  });

  it("falls back to the mock when the provider fails before the first token", async () => {
    generateContentStream.mockRejectedValue(apiError(401, "API key not valid"));
    const { interviewerReplyStream, collectTurn, MOCK_FALLBACK } = await loadLlm();

    const { text, outcome } = await collectTurn(interviewerReplyStream(ctx()));

    expect(text.length).toBeGreaterThan(10);
    expect(outcome.provider).toBe(MOCK_FALLBACK);
    expect(outcome.fallbackReason).toBe("error");
    // The mock's model is not the provider's — don't mislabel the stored turn.
    expect(outcome.model).toBeUndefined();
  });

  it("classifies an exhausted daily quota separately from a transient limit", async () => {
    generateContentStream.mockRejectedValue(
      apiError(429, "RESOURCE_EXHAUSTED: quota GenerateRequestsPerDayPerProjectPerModel"),
    );
    const { interviewerReplyStream, collectTurn } = await loadLlm();

    const { outcome } = await collectTurn(interviewerReplyStream(ctx()));

    expect(outcome.fallbackReason).toBe("quota");
    // A daily quota is terminal — it must not burn the retry.
    expect(generateContentStream).toHaveBeenCalledTimes(1);
  });

  it("retries once on a per-minute rate limit, then serves the real reply", async () => {
    generateContentStream
      .mockRejectedValueOnce(
        apiError(429, "RESOURCE_EXHAUSTED: quota GenerateRequestsPerMinutePerProjectPerModel"),
      )
      .mockResolvedValueOnce(chunks("Second attempt worked."));

    const { interviewerReplyStream, collectTurn } = await loadLlm();
    const { text, outcome } = await collectTurn(interviewerReplyStream(ctx()));

    expect(generateContentStream).toHaveBeenCalledTimes(2);
    expect(text).toBe("Second attempt worked.");
    expect(outcome.provider).toBe("gemini");
    expect(outcome.fallbackReason).toBeUndefined();
  });

  it("does NOT splice mock text onto a reply that failed mid-stream", async () => {
    // The user is already reading a real answer; switching engines mid-paragraph
    // produces something incoherent. Truncate and say so instead.
    generateContentStream.mockResolvedValue(
      chunksThenThrow(["How would you ", "segment the "], apiError(500, "backend error")),
    );
    const { interviewerReplyStream, collectTurn } = await loadLlm();

    const { text, outcome } = await collectTurn(interviewerReplyStream(ctx()));

    expect(text).toBe("How would you segment the ");
    expect(outcome.provider).toBe("gemini");
    expect(outcome.interrupted).toBe("rate_limited");
    expect(outcome.fallbackReason).toBeUndefined();
  });

  it("treats an empty provider stream as a failure, not an empty answer", async () => {
    generateContentStream.mockResolvedValue(chunks());
    const { interviewerReplyStream, collectTurn, MOCK_FALLBACK } = await loadLlm();

    const { text, outcome } = await collectTurn(interviewerReplyStream(ctx()));

    expect(outcome.provider).toBe(MOCK_FALLBACK);
    expect(text.length).toBeGreaterThan(10);
  });

  it("serves the mock without calling the provider when the budget is blocked", async () => {
    const { interviewerReplyStream, collectTurn, MOCK_FALLBACK } = await loadLlm();

    const { text, outcome } = await collectTurn(
      interviewerReplyStream(ctx(), { budgetBlocked: true }),
    );

    expect(generateContentStream).not.toHaveBeenCalled();
    expect(outcome.provider).toBe(MOCK_FALLBACK);
    expect(outcome.fallbackReason).toBe("budget");
    expect(text.length).toBeGreaterThan(10);
  });

  it("uses the mock directly, with no fallback labelling, when no key is set", async () => {
    vi.stubEnv("LLM_PROVIDER", "mock");
    vi.resetModules();
    const { interviewerReplyStream, collectTurn } = await loadLlm();

    const { outcome } = await collectTurn(interviewerReplyStream(ctx()));

    expect(outcome.provider).toBe("mock");
    expect(outcome.fallbackReason).toBeUndefined();
  });
});

describe("ndjson protocol", () => {
  it("round-trips lines through a streamed response", async () => {
    const lines: StreamLine[] = [
      { t: "delta", v: "How would " },
      { t: "delta", v: "you segment?" },
      { t: "done", provider: "gemini", model: "gemini-2.5-flash" },
    ];

    const res = new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          const encoder = new TextEncoder();
          // Split mid-line to prove the reader reassembles across chunk boundaries.
          const raw = lines.map(encodeLine).join("");
          controller.enqueue(encoder.encode(raw.slice(0, 12)));
          controller.enqueue(encoder.encode(raw.slice(12)));
          controller.close();
        },
      }),
    );

    const received: StreamLine[] = [];
    for await (const line of readNdjson(res)) received.push(line);

    expect(received).toEqual(lines);
  });

  it("survives a malformed line without dropping the rest of the stream", async () => {
    const raw = `{"t":"delta","v":"ok"}\nnot json\n${encodeLine({ t: "done", provider: "mock" })}`;
    const res = new Response(raw);

    const received: StreamLine[] = [];
    for await (const line of readNdjson(res)) received.push(line);

    expect(received).toEqual([
      { t: "delta", v: "ok" },
      { t: "done", provider: "mock" },
    ]);
  });

  it("reads a trailing line that has no newline", async () => {
    const res = new Response(`{"t":"delta","v":"a"}\n{"t":"done","provider":"mock"}`);

    const received: StreamLine[] = [];
    for await (const line of readNdjson(res)) received.push(line);

    expect(received).toHaveLength(2);
    expect(received[1]).toEqual({ t: "done", provider: "mock" });
  });
});
