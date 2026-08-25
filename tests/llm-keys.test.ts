import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * The two layers underneath the rotation: what a stored key is encrypted with,
 * and which keys a provider is considered to have.
 *
 * `tests/llm-key-rotation.test.ts` covers what the chain does with them.
 */

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

const STRONG_SECRET = "a-real-deployment-secret-9f2c41ba";
const DEV_SECRET = "case-closed-dev-secret-change-me";

beforeEach(() => {
  vi.resetModules();
  dbMock.findMany.mockReset();
  dbMock.update.mockReset();
  dbMock.update.mockResolvedValue({});
  dbMock.findMany.mockResolvedValue([]);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("stored-key encryption", () => {
  it("round-trips a key", async () => {
    vi.stubEnv("AUTH_SECRET", STRONG_SECRET);
    const { encryptSecret, decryptSecret } = await import("@/lib/llm/crypto");

    const key = "nvapi-a-real-looking-key-0123456789";
    expect(decryptSecret(encryptSecret(key))).toBe(key);
  });

  /** Fresh IV per row, so equal secrets never produce equal ciphertext. */
  it("encrypts the same key differently each time", async () => {
    vi.stubEnv("AUTH_SECRET", STRONG_SECRET);
    const { encryptSecret } = await import("@/lib/llm/crypto");

    const key = "nvapi-a-real-looking-key-0123456789";
    expect(encryptSecret(key)).not.toBe(encryptSecret(key));
  });

  /** GCM authenticates: a tampered row fails to decrypt rather than yielding garbage. */
  it("returns undefined for a tampered or malformed value", async () => {
    vi.stubEnv("AUTH_SECRET", STRONG_SECRET);
    const { encryptSecret, decryptSecret } = await import("@/lib/llm/crypto");

    expect(decryptSecret("not-even-close")).toBeUndefined();
    expect(decryptSecret("a:b:c")).toBeUndefined();

    const valid = encryptSecret("nvapi-a-real-looking-key-0123456789");
    const [iv, tag, data] = valid.split(":");
    expect(decryptSecret([iv, tag, `${data.slice(0, -4)}AAAA`].join(":"))).toBeUndefined();
  });

  /**
   * Refused rather than stored weakly. The shipped default is published in this
   * repository, so a key encrypted under it is not protected — and pretending
   * otherwise invites someone to store a real one believing it is.
   */
  it("refuses to work without a strong AUTH_SECRET", async () => {
    vi.stubEnv("AUTH_SECRET", DEV_SECRET);
    const { hasStrongAuthSecret, encryptSecret } = await import("@/lib/llm/crypto");

    expect(hasStrongAuthSecret()).toBe(false);
    expect(() => encryptSecret("nvapi-anything-at-all-0123456789")).toThrow(/AUTH_SECRET/);
  });

  it.each([
    ["", false],
    ["short", false],
    [DEV_SECRET, false],
    [STRONG_SECRET, true],
  ])("hasStrongAuthSecret(%j) === %j", async (secret, expected) => {
    vi.stubEnv("AUTH_SECRET", secret);
    const { hasStrongAuthSecret } = await import("@/lib/llm/crypto");
    expect(hasStrongAuthSecret()).toBe(expected);
  });

  /** Enough to tell two keys apart, never enough to use one. */
  it("masks a key to its first and last four characters", async () => {
    const { maskKey } = await import("@/lib/llm/crypto");

    expect(maskKey("nvapi-abcdefghijklmnop")).toBe("nvap…mnop");
    // A short value is hidden outright: revealing 8 of 12 defeats the point.
    expect(maskKey("tiny-key")).not.toContain("tiny");
  });
});

describe("listKeys", () => {
  it("returns nothing for providers that take no key", async () => {
    vi.stubEnv("AUTH_SECRET", STRONG_SECRET);
    const { listKeys } = await import("@/lib/llm/keys");

    expect(await listKeys("mock")).toEqual([]);
    expect(await listKeys("ollama")).toEqual([]);
  });

  it("reads the numbered environment variables in order", async () => {
    vi.stubEnv("AUTH_SECRET", "");
    vi.stubEnv("GEMINI_API_KEY", "gem-one-xxxxxxxxxxxx");
    vi.stubEnv("GEMINI_API_KEY_2", "gem-two-xxxxxxxxxxxx");
    const { listKeys } = await import("@/lib/llm/keys");

    const keys = await listKeys("gemini");
    expect(keys.map((k) => k.secret)).toEqual(["gem-one-xxxxxxxxxxxx", "gem-two-xxxxxxxxxxxx"]);
    expect(keys.every((k) => k.source === "env")).toBe(true);
  });

  /** The same quota twice is not a second key — it is one extra failed request. */
  it("drops a key repeated across two slots", async () => {
    vi.stubEnv("AUTH_SECRET", "");
    vi.stubEnv("GEMINI_API_KEY", "gem-same-xxxxxxxxxxxx");
    vi.stubEnv("GEMINI_API_KEY_2", "gem-same-xxxxxxxxxxxx");
    const { listKeys } = await import("@/lib/llm/keys");

    expect(await listKeys("gemini")).toHaveLength(1);
  });

  /**
   * Without a strong `AUTH_SECRET` there is nothing readable in the table, so the
   * database is never asked — which is also why a fresh clone opens no connection.
   */
  it("does not query stored keys when AUTH_SECRET is weak", async () => {
    vi.stubEnv("AUTH_SECRET", DEV_SECRET);
    vi.stubEnv("GEMINI_API_KEY", "gem-one-xxxxxxxxxxxx");
    const { listKeys } = await import("@/lib/llm/keys");

    expect(await listKeys("gemini")).toHaveLength(1);
    expect(dbMock.findMany).not.toHaveBeenCalled();
  });

  /** An environment key has no row to write, so marking it is a no-op, not a crash. */
  it("ignores mark calls for environment keys", async () => {
    vi.stubEnv("AUTH_SECRET", "");
    vi.stubEnv("GEMINI_API_KEY", "gem-one-xxxxxxxxxxxx");
    const { listKeys, markSpent, markDisabled } = await import("@/lib/llm/keys");

    const [key] = await listKeys("gemini");
    await markSpent(key);
    await markDisabled(key, "rejected");

    expect(dbMock.update).not.toHaveBeenCalled();
  });
});

describe("listKeyStatus", () => {
  it("shows environment keys when nothing has overridden them", async () => {
    vi.stubEnv("AUTH_SECRET", STRONG_SECRET);
    vi.stubEnv("GEMINI_API_KEY", "gem-one-xxxxxxxxxxxx");
    const { listKeyStatus } = await import("@/lib/llm/keys");

    const gemini = (await listKeyStatus()).filter((k) => k.provider === "gemini");
    expect(gemini).toHaveLength(1);
    expect(gemini[0].source).toBe("env");
    // The masked form is the only one that reaches a browser.
    expect(gemini[0].hint).not.toContain("xxxxxxxxxxxx");
  });

  /**
   * Once a row exists the environment key is hidden, because `listKeys` would not
   * use it: a panel listing keys the app is ignoring is worse than one listing none.
   */
  it("hides environment keys once a stored key overrides them", async () => {
    vi.stubEnv("AUTH_SECRET", STRONG_SECRET);
    vi.stubEnv("GEMINI_API_KEY", "gem-one-xxxxxxxxxxxx");

    const { encryptSecret, maskKey } = await import("@/lib/llm/crypto");
    const stored = "gem-stored-xxxxxxxxxxxx";
    dbMock.findMany.mockImplementation(async ({ where }: { where: { provider: string } }) =>
      where.provider === "gemini"
        ? [
            {
              id: "row-1",
              hint: maskKey(stored),
              secret: encryptSecret(stored),
              order: 0,
              spentOn: null,
              disabled: false,
              lastError: null,
            },
          ]
        : [],
    );

    const { listKeyStatus } = await import("@/lib/llm/keys");
    const gemini = (await listKeyStatus()).filter((k) => k.provider === "gemini");

    expect(gemini).toHaveLength(1);
    expect(gemini[0].source).toBe("db");
  });

  /** Spent and disabled keys are exactly what an admin opened the page to fix. */
  it("reports spent and disabled keys rather than filtering them out", async () => {
    vi.stubEnv("AUTH_SECRET", STRONG_SECRET);
    const { encryptSecret, maskKey } = await import("@/lib/llm/crypto");
    const { dayKey } = await import("@/lib/llm/budget");

    const secret = "gem-spent-xxxxxxxxxxxxx";
    dbMock.findMany.mockImplementation(async ({ where }: { where: { provider: string } }) =>
      where.provider === "gemini"
        ? [
            {
              id: "row-1",
              hint: maskKey(secret),
              secret: encryptSecret(secret),
              order: 0,
              spentOn: dayKey(),
              disabled: false,
              lastError: null,
            },
            {
              id: "row-2",
              hint: maskKey(secret),
              secret: encryptSecret(secret),
              order: 1,
              spentOn: null,
              disabled: true,
              lastError: "Gemini rejected the key",
            },
          ]
        : [],
    );

    const { listKeyStatus, listKeys } = await import("@/lib/llm/keys");
    const gemini = (await listKeyStatus()).filter((k) => k.provider === "gemini");

    expect(gemini).toHaveLength(2);
    expect(gemini[0].spent).toBe(true);
    expect(gemini[1].disabled).toBe(true);
    expect(gemini[1].lastError).toBe("Gemini rejected the key");

    // …while the rotation itself skips both.
    expect(await listKeys("gemini")).toHaveLength(0);
  });
});
