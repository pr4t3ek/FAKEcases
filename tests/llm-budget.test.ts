import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { llmBudget } from "@/lib/config";

/**
 * The spend guards protect a quota that is shared by every user of the deployment.
 * Only the database is mocked — the limits and the day-key arithmetic are real.
 *
 * The provider has to be stubbed before the import: the guards apply only to a
 * metered provider, and `env` is read once at module load.
 */
const messageCount = vi.fn();
const usageFindUnique = vi.fn();
const usageUpsert = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    message: { count: messageCount },
    usageCounter: { findUnique: usageFindUnique, upsert: usageUpsert },
  },
}));

vi.stubEnv("LLM_PROVIDER", "gemini");
vi.stubEnv("GEMINI_API_KEY", "test-key");
// The static `@/lib/config` import above already read the un-stubbed environment.
vi.resetModules();

const { checkBudget, dayKey, recordLlmCall } = await import("@/lib/llm/budget");

describe("dayKey", () => {
  it("keys on the UTC date", () => {
    expect(dayKey(new Date("2026-07-28T23:59:59.000Z"))).toBe("2026-07-28");
    expect(dayKey(new Date("2026-07-29T00:00:00.000Z"))).toBe("2026-07-29");
  });

  it("rolls over on UTC midnight regardless of local offset", () => {
    // 2026-07-28T20:00 in UTC-05:00 is already the 29th in UTC.
    expect(dayKey(new Date("2026-07-29T01:00:00.000Z"))).toBe("2026-07-29");
  });
});

describe("checkBudget", () => {
  beforeEach(() => {
    messageCount.mockReset().mockResolvedValue(0);
    usageFindUnique.mockReset().mockResolvedValue(null);
    usageUpsert.mockReset().mockResolvedValue(undefined);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => vi.restoreAllMocks());

  it("allows a turn when both limits have headroom", async () => {
    expect(await checkBudget("user-1")).toEqual({ ok: true });
  });

  it("blocks on the per-user hourly limit", async () => {
    messageCount.mockResolvedValue(llmBudget.userMessagesPerHour + 1);

    expect(await checkBudget("user-1")).toEqual({ ok: false, reason: "user_limit" });
  });

  it("allows a user sitting exactly at the hourly limit", async () => {
    messageCount.mockResolvedValue(llmBudget.userMessagesPerHour);

    expect(await checkBudget("user-1")).toEqual({ ok: true });
  });

  it("blocks on the deployment-wide daily limit", async () => {
    usageFindUnique.mockResolvedValue({ count: llmBudget.globalRequestsPerDay });

    expect(await checkBudget("user-1")).toEqual({ ok: false, reason: "daily_limit" });
  });

  it("counts only the requesting user's messages, within the last hour", async () => {
    const now = new Date("2026-07-28T12:00:00.000Z");
    await checkBudget("user-1", now);

    const where = messageCount.mock.calls[0][0].where;
    expect(where.attempt).toEqual({ userId: "user-1" });
    expect(where.role).toBe("user");
    expect(where.createdAt.gte).toEqual(new Date("2026-07-28T11:00:00.000Z"));
  });

  it("reads today's counter, not a stale day", async () => {
    await checkBudget("user-1", new Date("2026-07-28T12:00:00.000Z"));

    expect(usageFindUnique).toHaveBeenCalledWith({ where: { day: "2026-07-28" } });
  });
});

describe("checkBudget on an unmetered provider", () => {
  beforeEach(() => {
    messageCount.mockReset().mockResolvedValue(0);
    usageFindUnique.mockReset().mockResolvedValue(null);
  });

  afterEach(() => {
    vi.resetModules();
    vi.stubEnv("LLM_PROVIDER", "gemini");
  });

  /**
   * A local model bills nothing, so blocking a turn would only substitute the mock
   * for the model under test — the session would look like it worked and quietly
   * stop exercising the thing being developed.
   */
  it("exempts a local provider from both limits", async () => {
    vi.resetModules();
    vi.stubEnv("LLM_PROVIDER", "ollama");
    const local = await import("@/lib/llm/budget");

    messageCount.mockResolvedValue(llmBudget.userMessagesPerHour * 100);
    usageFindUnique.mockResolvedValue({ count: llmBudget.globalRequestsPerDay * 100 });

    expect(await local.checkBudget("user-1")).toEqual({ ok: true });
    // Exempt means not asked, not asked-and-ignored.
    expect(messageCount).not.toHaveBeenCalled();
    expect(usageFindUnique).not.toHaveBeenCalled();
  });
});

describe("recordLlmCall", () => {
  beforeEach(() => {
    usageUpsert.mockReset().mockResolvedValue(undefined);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => vi.restoreAllMocks());

  it("increments today's counter", async () => {
    await recordLlmCall(new Date("2026-07-28T12:00:00.000Z"));

    expect(usageUpsert).toHaveBeenCalledWith({
      where: { day: "2026-07-28" },
      create: { day: "2026-07-28", count: 1 },
      update: { count: { increment: 1 } },
    });
  });

  it("never throws — a counter write must not fail a turn the user already got", async () => {
    usageUpsert.mockRejectedValue(new Error("db down"));

    await expect(recordLlmCall()).resolves.toBeUndefined();
  });
});
