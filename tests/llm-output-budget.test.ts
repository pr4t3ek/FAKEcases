import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { llmOutput, maxOutputTokensWithReasoning } from "@/lib/config";

/**
 * One output budget, applied by every adapter.
 *
 * Both prompts already ask for brevity — "keep responses short (2–4 sentences)"
 * for the interviewer, "2–4 short bullets" for the war-room coach — and nothing
 * enforced it: the ceiling was set five different ways across the adapters (512,
 * 512, 1024, 1024, 3072), none of them from config. These pin that it now comes
 * from one place, and that the one adapter which genuinely needs more still
 * gets it.
 */
const generateContentStream = vi.fn();
vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContentStream };
  },
}));

const fetchMock = vi.fn();

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function sseResponse(content: string): Response {
  const frame = `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`;
  return new Response(
    new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(new TextEncoder().encode(frame));
        c.close();
      },
    }),
    { status: 200 },
  );
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
      betterApproach: "Segment adults vs children.",
      sampleSolution: "~80 lakh umbrellas/year",
    },
    mode: "interviewer" as const,
    messages: [],
    assumptions: [],
    framework: [],
    hintsUsed: 0,
  };
}

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  generateContentStream.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** The `max_tokens` the adapter put on the wire for one interviewer turn. */
async function sentMaxTokens(): Promise<number> {
  const { interviewerReplyStream, collectTurn } = await import("@/lib/llm");
  await collectTurn(interviewerReplyStream(ctx()));
  return JSON.parse(fetchMock.mock.calls[0][1].body).max_tokens;
}

describe("the shared answer budget", () => {
  it("is the ceiling OpenAI asks for", async () => {
    vi.stubEnv("LLM_PROVIDER", "openai");
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    fetchMock.mockResolvedValue(jsonResponse({ choices: [{ message: { content: "Hi" } }] }));

    expect(await sentMaxTokens()).toBe(llmOutput.visibleAnswerTokens);
  });

  it("is the ceiling Anthropic asks for", async () => {
    vi.stubEnv("LLM_PROVIDER", "anthropic");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");
    fetchMock.mockResolvedValue(jsonResponse({ content: [{ type: "text", text: "Hi" }] }));

    expect(await sentMaxTokens()).toBe(llmOutput.visibleAnswerTokens);
  });

  it("is well clear of what the prompts actually ask for", () => {
    // Four bullets of two short sentences is roughly 215 tokens; the budget has
    // to bite on a runaway reply and never on a well-behaved one.
    expect(llmOutput.visibleAnswerTokens).toBeGreaterThan(300);
  });
});

/*
 * A reasoning model bills its private deliberation against the same ceiling as
 * the answer, and `plain-text.ts` strips it before render — so it is paid for,
 * never seen, and eats the budget the answer needs. NVIDIA hit exactly this at
 * 1024.
 */
describe("headroom where thinking cannot be switched off", () => {
  it("keeps NVIDIA's proven ceiling to the token", async () => {
    vi.stubEnv("LLM_PROVIDER", "nvidia");
    vi.stubEnv("NVIDIA_API_KEY", "nvapi-test");
    fetchMock.mockResolvedValue(sseResponse("Hi"));

    const sent = await sentMaxTokens();
    expect(sent).toBe(maxOutputTokensWithReasoning());
    // The number the Nemotron truncation was fixed at. Pinned outright: it is
    // empirical, so a tidier-looking budget must not quietly walk it back.
    expect(sent).toBe(3072);
  });

  it("gives a local model the same room, since nothing asks it to stop thinking", async () => {
    vi.stubEnv("LLM_PROVIDER", "ollama");
    fetchMock.mockResolvedValue(sseResponse("Hi"));

    expect(await sentMaxTokens()).toBe(maxOutputTokensWithReasoning());
  });

  it("is strictly more than the answer budget, or it buys nothing", () => {
    expect(maxOutputTokensWithReasoning()).toBeGreaterThan(llmOutput.visibleAnswerTokens);
  });
});

/*
 * Gemini is the one adapter where the answer is genuinely both cases: flash
 * models have thinking switched off outright, Pro models cannot.
 */
describe("Gemini, where the budget depends on the model", () => {
  async function geminiMaxOutputTokens(model: string): Promise<number> {
    vi.stubEnv("LLM_PROVIDER", "gemini");
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubEnv("LLM_MODEL", model);
    generateContentStream.mockResolvedValue(
      (async function* () {
        yield { text: "Hi" };
      })(),
    );
    const { interviewerReplyStream, collectTurn } = await import("@/lib/llm");
    await collectTurn(interviewerReplyStream(ctx()));
    return generateContentStream.mock.calls[0][0].config.maxOutputTokens;
  }

  it("spends the whole budget on the answer when thinking is off", async () => {
    expect(await geminiMaxOutputTokens("gemini-2.5-flash")).toBe(llmOutput.visibleAnswerTokens);
  });

  // Pro cannot have thinking disabled, so it needs the room NVIDIA needs — this
  // adapter was one long deliberation away from the same truncation.
  it("adds the headroom for a Pro model, which cannot be told not to think", async () => {
    expect(await geminiMaxOutputTokens("gemini-2.5-pro")).toBe(maxOutputTokensWithReasoning());
  });
});
