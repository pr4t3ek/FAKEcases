import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * The key rotation: every key a provider holds, tried in order, before the chain
 * moves on to the next provider.
 *
 * NVIDIA is the vehicle because it is `fetch`-based, so the stub can route by the
 * bearer token and tell one key's request from another's — but nothing here is
 * NVIDIA-specific. The chain is built from `lib/llm/keys.ts` in
 * `lib/llm/index.ts`, so Gemini with three keys walks the same code.
 *
 * Only `fetch` and `@/lib/db` are stubbed. Real SSE parsing, real error
 * classification, real chain wiring.
 */
vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContentStream: vi.fn() };
  },
}));

const dbMock = vi.hoisted(() => ({
  findMany: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    llmApiKey: {
      findMany: (...args: unknown[]) => dbMock.findMany(...args),
      update: (...args: unknown[]) => dbMock.update(...args),
    },
  },
}));

const NVIDIA_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const OLLAMA_URL = "http://localhost:11434/v1/chat/completions";

/** A strong-looking secret, so `hasStrongAuthSecret()` lets stored keys work. */
const STRONG_SECRET = "a-real-deployment-secret-9f2c41ba";

const fetchMock = vi.fn();

function frame(content: string): string {
  return `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`;
}

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

/** A body that dies partway through: the provider failed AFTER emitting text. */
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

/** The key a stubbed request was made with, read off the Authorization header. */
function keyOf(init: unknown): string {
  const headers = (init as { headers?: Record<string, string> } | undefined)?.headers ?? {};
  return String(headers.authorization ?? "").replace(/^Bearer /, "");
}

/**
 * Route the stubbed `fetch` by key rather than by host.
 *
 * Handlers are factories because a body can only be read once, and the retry
 * path calls the same key twice.
 */
function routeByKey(handlers: Record<string, () => Response>, ollama?: () => Response): void {
  fetchMock.mockImplementation(async (url: unknown, init: unknown) => {
    const target = String(url);
    if (target.startsWith(OLLAMA_URL)) {
      if (ollama) return ollama();
      throw new Error("unexpected ollama call");
    }
    if (!target.startsWith(NVIDIA_URL)) throw new Error(`unexpected fetch: ${target}`);

    const key = keyOf(init);
    const handler = handlers[key];
    if (!handler) throw new Error(`unexpected key: ${key || "(none)"}`);
    return handler();
  });
}

/** Every NVIDIA key the stub was actually called with, in order. */
function keysUsed(): string[] {
  return fetchMock.mock.calls
    .filter(([url]) => String(url).startsWith(NVIDIA_URL))
    .map(([, init]) => keyOf(init));
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

async function collect(turn: { deltas: AsyncGenerator<string> }): Promise<string> {
  let text = "";
  for await (const delta of turn.deltas) text += delta;
  return text;
}

// ── Environment keys ────────────────────────────────────────────────────────

describe("rotation over numbered environment keys", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("LLM_PROVIDER", "nvidia");
    vi.stubEnv("NVIDIA_MODEL", "meta/llama-3.1-8b-instruct");
    vi.stubEnv("NVIDIA_API_KEY", "nvapi-one");
    vi.stubEnv("NVIDIA_API_KEY_2", "nvapi-two");
    vi.stubEnv("NVIDIA_API_KEY_3", "nvapi-three");
    // Unset, so stored keys are unreadable and the env layer is what is used.
    vi.stubEnv("AUTH_SECRET", "");
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    dbMock.findMany.mockReset();
    dbMock.update.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  /**
   * The case the whole feature exists for. A spent free-tier key used to drop the
   * student to the offline mock; now the next key answers, and — the part that
   * matters for honesty — the turn is NOT badged as a fallback, because the
   * engine that answered really was the configured one.
   */
  it("hands the turn to the next key when the first is out of quota", async () => {
    routeByKey({
      "nvapi-one": () => errorResponse(402, "credits exhausted"),
      "nvapi-two": () => sseResponse(frame("What drives demand here?")),
    });

    const { interviewerReplyStream } = await loadLlm();
    const turn = interviewerReplyStream(ctx());
    const text = await collect(turn);

    expect(text).toBe("What drives demand here?");
    expect(keysUsed()).toEqual(["nvapi-one", "nvapi-two"]);

    expect(turn.outcome.provider).toBe("nvidia");
    expect(turn.outcome.fallbackReason).toBeUndefined();
    expect(turn.outcome.interrupted).toBeUndefined();
  });

  it("walks all the way to the third key", async () => {
    routeByKey({
      "nvapi-one": () => errorResponse(402),
      "nvapi-two": () => errorResponse(402),
      "nvapi-three": () => sseResponse(frame("Start with the population.")),
    });

    const { interviewerReplyStream } = await loadLlm();
    const turn = interviewerReplyStream(ctx());

    expect(await collect(turn)).toBe("Start with the population.");
    expect(keysUsed()).toEqual(["nvapi-one", "nvapi-two", "nvapi-three"]);
    expect(turn.outcome.provider).toBe("nvidia");
  });

  /** Every key spent is the one case that still degrades — and still says so. */
  it("falls to the mock only once every key is spent", async () => {
    routeByKey({
      "nvapi-one": () => errorResponse(402),
      "nvapi-two": () => errorResponse(402),
      "nvapi-three": () => errorResponse(402),
    });

    const { interviewerReplyStream, MOCK_FALLBACK } = await loadLlm();
    const turn = interviewerReplyStream(ctx());
    const text = await collect(turn);

    expect(text.length).toBeGreaterThan(0);
    expect(keysUsed()).toEqual(["nvapi-one", "nvapi-two", "nvapi-three"]);
    expect(turn.outcome.provider).toBe(MOCK_FALLBACK);
    expect(turn.outcome.fallbackReason).toBe("quota");
  });

  /**
   * The regression that matters most. Rotation must keep `runTurn`'s
   * before/after-first-token split intact: a key that dies mid-reply leaves a
   * truncated answer rather than one that changes voice mid-paragraph.
   */
  it("does not splice the next key onto a reply that already started", async () => {
    routeByKey({
      "nvapi-one": () => brokenSseResponse(frame("Let's begin with")),
      "nvapi-two": () => sseResponse(frame(" — WRONG, a second voice")),
    });

    const { interviewerReplyStream } = await loadLlm();
    const turn = interviewerReplyStream(ctx());
    const text = await collect(turn);

    expect(text).toBe("Let's begin with");
    expect(keysUsed()).toEqual(["nvapi-one"]);
    expect(turn.outcome.interrupted).toBeDefined();
  });

  /** A per-minute limit is the one failure worth retrying on the SAME key first. */
  it("retries a rate-limited key once before moving to the next", async () => {
    let firstKeyCalls = 0;
    routeByKey({
      "nvapi-one": () => {
        firstKeyCalls += 1;
        return errorResponse(429);
      },
      "nvapi-two": () => sseResponse(frame("Second key.")),
    });

    const { interviewerReplyStream } = await loadLlm();
    const turn = interviewerReplyStream(ctx());

    expect(await collect(turn)).toBe("Second key.");
    expect(firstKeyCalls).toBe(2);
    expect(turn.outcome.provider).toBe("nvidia");
  });

  /** The back-compat guard: one key, no numbered slots, behaves exactly as before. */
  it("is unchanged for a deployment with a single key", async () => {
    vi.stubEnv("NVIDIA_API_KEY_2", "");
    vi.stubEnv("NVIDIA_API_KEY_3", "");
    routeByKey({ "nvapi-one": () => sseResponse(frame("Only key.")) });

    const { interviewerReplyStream } = await loadLlm();
    const turn = interviewerReplyStream(ctx());

    expect(await collect(turn)).toBe("Only key.");
    expect(keysUsed()).toEqual(["nvapi-one"]);
    expect(turn.outcome.provider).toBe("nvidia");
  });

  /** A gap in the numbering is skipped, not read as the end of the list. */
  it("skips an empty slot rather than stopping at it", async () => {
    vi.stubEnv("NVIDIA_API_KEY", "");
    routeByKey({
      "nvapi-two": () => errorResponse(402),
      "nvapi-three": () => sseResponse(frame("Third.")),
    });

    const { interviewerReplyStream } = await loadLlm();
    const turn = interviewerReplyStream(ctx());

    expect(await collect(turn)).toBe("Third.");
    expect(keysUsed()).toEqual(["nvapi-two", "nvapi-three"]);
  });

  /** Every key before the next PROVIDER — a second key beats a weaker engine. */
  it("exhausts the rotation before falling to the fallback provider", async () => {
    vi.stubEnv("LLM_FALLBACK_PROVIDER", "ollama");
    vi.stubEnv("OLLAMA_MODEL", "qwen2.5:7b");

    routeByKey(
      {
        "nvapi-one": () => errorResponse(402),
        "nvapi-two": () => sseResponse(frame("Second NVIDIA key.")),
      },
      () => sseResponse(frame("Ollama should not answer.")),
    );

    const { interviewerReplyStream } = await loadLlm();
    const turn = interviewerReplyStream(ctx());

    expect(await collect(turn)).toBe("Second NVIDIA key.");
    expect(turn.outcome.provider).toBe("nvidia");
    expect(
      fetchMock.mock.calls.filter(([url]) => String(url).startsWith(OLLAMA_URL)),
    ).toHaveLength(0);
  });
});

// ── Stored keys ─────────────────────────────────────────────────────────────

describe("rotation over stored keys", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("LLM_PROVIDER", "nvidia");
    vi.stubEnv("NVIDIA_MODEL", "meta/llama-3.1-8b-instruct");
    vi.stubEnv("AUTH_SECRET", STRONG_SECRET);
    // Present, and deliberately never used: stored rows override the environment.
    vi.stubEnv("NVIDIA_API_KEY", "nvapi-from-env");
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    dbMock.findMany.mockReset();
    dbMock.update.mockReset();
    dbMock.update.mockResolvedValue({});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  /** Rows encrypted the way `addLlmKey` writes them. */
  async function storeKeys(...secrets: string[]) {
    const { encryptSecret, maskKey } = await import("@/lib/llm/crypto");
    dbMock.findMany.mockResolvedValue(
      secrets.map((secret, i) => ({
        id: `row-${i + 1}`,
        hint: maskKey(secret),
        secret: encryptSecret(secret),
        order: i,
        spentOn: null,
        disabled: false,
        lastError: null,
      })),
    );
  }

  it("uses stored keys instead of the environment", async () => {
    await storeKeys("nvapi-stored-one-xxxxxxxx", "nvapi-stored-two-xxxxxxxx");
    routeByKey({
      "nvapi-stored-one-xxxxxxxx": () => errorResponse(402),
      "nvapi-stored-two-xxxxxxxx": () => sseResponse(frame("Stored key answered.")),
    });

    const { interviewerReplyStream } = await loadLlm();
    const turn = interviewerReplyStream(ctx());

    expect(await collect(turn)).toBe("Stored key answered.");
    expect(keysUsed()).not.toContain("nvapi-from-env");
  });

  /** Marked spent so tomorrow's turns skip it instead of rediscovering it. */
  it("records a spent key against today", async () => {
    await storeKeys("nvapi-stored-one-xxxxxxxx", "nvapi-stored-two-xxxxxxxx");
    routeByKey({
      "nvapi-stored-one-xxxxxxxx": () => errorResponse(402),
      "nvapi-stored-two-xxxxxxxx": () => sseResponse(frame("ok")),
    });

    const { interviewerReplyStream } = await loadLlm();
    await collect(interviewerReplyStream(ctx()));

    const { dayKey } = await import("@/lib/llm/budget");
    expect(dbMock.update).toHaveBeenCalledWith({
      where: { id: "row-1" },
      data: { spentOn: dayKey() },
    });
  });

  /** A rejected key is retired for good — a revoked key does not return at midnight. */
  it("disables a key the provider rejected", async () => {
    await storeKeys("nvapi-stored-one-xxxxxxxx", "nvapi-stored-two-xxxxxxxx");
    routeByKey({
      "nvapi-stored-one-xxxxxxxx": () => errorResponse(401, "invalid api key"),
      "nvapi-stored-two-xxxxxxxx": () => sseResponse(frame("ok")),
    });

    const { interviewerReplyStream } = await loadLlm();
    await collect(interviewerReplyStream(ctx()));

    expect(dbMock.update).toHaveBeenCalledWith({
      where: { id: "row-1" },
      data: { disabled: true, lastError: expect.stringContaining("rejected the key") },
    });
  });

  /** Filtered on read, so a rotation spent yesterday recovers on its own. */
  it("skips keys already marked spent today, and stored keys already disabled", async () => {
    const { encryptSecret, maskKey } = await import("@/lib/llm/crypto");
    const { dayKey } = await import("@/lib/llm/budget");
    const rows = [
      { secret: "nvapi-spent-today-xxxxxxx", spentOn: dayKey(), disabled: false },
      { secret: "nvapi-revoked-key-xxxxxxx", spentOn: null, disabled: true },
      { secret: "nvapi-good-key-xxxxxxxxxx", spentOn: null, disabled: false },
    ];
    dbMock.findMany.mockResolvedValue(
      rows.map((r, i) => ({
        id: `row-${i + 1}`,
        hint: maskKey(r.secret),
        secret: encryptSecret(r.secret),
        order: i,
        spentOn: r.spentOn,
        disabled: r.disabled,
        lastError: null,
      })),
    );

    routeByKey({ "nvapi-good-key-xxxxxxxxxx": () => sseResponse(frame("Only usable key.")) });

    const { interviewerReplyStream } = await loadLlm();
    const turn = interviewerReplyStream(ctx());

    expect(await collect(turn)).toBe("Only usable key.");
    expect(keysUsed()).toEqual(["nvapi-good-key-xxxxxxxxxx"]);
  });

  /**
   * A row written under a previous `AUTH_SECRET` must not take the rotation down
   * with it — the same "a bad row is ignored, not thrown on" rule `loadSettings`
   * follows.
   */
  it("drops an undecryptable row and carries on", async () => {
    const { encryptSecret, maskKey } = await import("@/lib/llm/crypto");
    const good = "nvapi-good-key-xxxxxxxxxx";
    dbMock.findMany.mockResolvedValue([
      {
        id: "row-1",
        hint: "nvap…xxxx",
        secret: "not:valid:ciphertext",
        order: 0,
        spentOn: null,
        disabled: false,
        lastError: null,
      },
      {
        id: "row-2",
        hint: maskKey(good),
        secret: encryptSecret(good),
        order: 1,
        spentOn: null,
        disabled: false,
        lastError: null,
      },
    ]);

    routeByKey({ [good]: () => sseResponse(frame("Survived.")) });

    const { interviewerReplyStream } = await loadLlm();
    expect(await collect(interviewerReplyStream(ctx()))).toBe("Survived.");
  });
});
