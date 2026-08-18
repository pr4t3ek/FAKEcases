import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { llmBudget } from "@/lib/config";

/**
 * The spend guards protect a quota that is shared by every user of the deployment.
 * Only the database is mocked — the limits and the day-key arithmetic are real.
 *
 * The provider has to be stubbed before the import: the guards apply only to a
 * metered provider, and `env` is read once at module load.
 */
/**
 * `checkBudget` asks `message.count` three different questions — this attempt's
 * turns, the last minute, the last hour — and a single mocked return value
 * answers all three at once, which silently makes every test about whichever
 * limit happens to trip first. So the mock dispatches on the `where` it was
 * given, and a test sets only the count it means.
 */
const counts = { attempt: 0, minute: 0, hour: 0 };

const messageCount = vi.fn(async (args: { where?: Record<string, unknown> }) => {
  const where = (args?.where ?? {}) as {
    attemptId?: string;
    createdAt?: { gte?: Date };
  };
  if (where.attemptId) return counts.attempt;
  const gte = where.createdAt?.gte;
  if (!gte) return 0;
  // The minute window reaches back 60s, the hourly one 3600s. Anything under
  // two minutes is the minute check.
  return Date.now() - gte.getTime() <= 120_000 ? counts.minute : counts.hour;
});

/** Reset all three, then let a test raise the one it is about. */
function resetCounts() {
  counts.attempt = 0;
  counts.minute = 0;
  counts.hour = 0;
}
const usageFindUnique = vi.fn();
const usageUpsert = vi.fn();
const settingFindMany = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    message: { count: messageCount },
    usageCounter: { findUnique: usageFindUnique, upsert: usageUpsert },
    appSetting: { findMany: settingFindMany },
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
    messageCount.mockClear();
    resetCounts();
    usageFindUnique.mockReset().mockResolvedValue(null);
    usageUpsert.mockReset().mockResolvedValue(undefined);
    // No overrides: every limit falls back to its code default.
    settingFindMany.mockReset().mockResolvedValue([]);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => vi.restoreAllMocks());

  it("allows a turn when both limits have headroom", async () => {
    expect(await checkBudget("user-1")).toEqual({ ok: true });
  });

  it("blocks on the per-user hourly limit", async () => {
    counts.hour = llmBudget.userMessagesPerHour + 1;

    expect(await checkBudget("user-1")).toEqual({ ok: false, reason: "user_limit" });
  });

  it("allows a user sitting exactly at the hourly limit", async () => {
    counts.hour = llmBudget.userMessagesPerHour;

    expect(await checkBudget("user-1")).toEqual({ ok: true });
  });

  it("blocks on the deployment-wide daily limit", async () => {
    // Ships disabled, so this one has to be turned on to be tested at all.
    settingFindMany.mockResolvedValue([{ key: "globalRequestsPerDay", value: "200" }]);
    usageFindUnique.mockResolvedValue({ count: 200 });

    expect(await checkBudget("user-1")).toEqual({ ok: false, reason: "daily_limit" });
  });

  it("counts only the requesting user's messages, within the last hour", async () => {
    const now = new Date("2026-07-28T12:00:00.000Z");
    await checkBudget("user-1", now);

    // The minute check runs first, so the hourly one is the later call. Found
    // by its window rather than its index, so reordering the guards does not
    // silently retarget this assertion at the wrong query.
    const windows = messageCount.mock.calls.map(
      (c) => c[0].where as { role?: string; attempt?: unknown; createdAt?: { gte?: Date } },
    );
    const hourly = windows.find(
      (w) => w.createdAt?.gte?.getTime() === Date.parse("2026-07-28T11:00:00.000Z"),
    );
    expect(hourly).toBeDefined();
    expect(hourly!.attempt).toEqual({ userId: "user-1" });
    expect(hourly!.role).toBe("user");
  });

  it("reads today's counter, not a stale day", async () => {
    settingFindMany.mockResolvedValue([{ key: "globalRequestsPerDay", value: "200" }]);
    await checkBudget("user-1", new Date("2026-07-28T12:00:00.000Z"));

    expect(usageFindUnique).toHaveBeenCalledWith({ where: { day: "2026-07-28" } });
  });
});

describe("checkBudget on an unmetered provider", () => {
  beforeEach(() => {
    messageCount.mockClear();
    resetCounts();
    usageFindUnique.mockReset().mockResolvedValue(null);
    settingFindMany.mockReset().mockResolvedValue([]);
  });

  afterEach(() => {
    vi.resetModules();
    vi.stubEnv("LLM_PROVIDER", "gemini");
  });

  /**
   * A local model bills nothing, so blocking a turn would only substitute the mock
   * for the model under test — the session would look like it worked and quietly
   * stop exercising the thing being developed.
   *
   * The exemption covers the QUOTA guards only. Turn budgets are the shape of the
   * exercise rather than a spend guard, so they still apply — a student on Ollama
   * is practising the same exercise, and the case below pins that they do.
   */
  it("exempts a local provider from the quota guards", async () => {
    vi.resetModules();
    vi.stubEnv("LLM_PROVIDER", "ollama");
    const local = await import("@/lib/llm/budget");

    counts.hour = llmBudget.userMessagesPerHour * 100;
    usageFindUnique.mockResolvedValue({ count: 100_000 });

    expect(await local.checkBudget("user-1")).toEqual({ ok: true });
    // Exempt means not asked, not asked-and-ignored: the hourly window is never
    // queried, and neither is the day counter.
    const askedHourly = messageCount.mock.calls.some((c) => {
      const where = c[0].where as { createdAt?: { gte?: Date } } | undefined;
      const gte = where?.createdAt?.gte;
      return gte !== undefined && Date.now() - gte.getTime() > 120_000;
    });
    expect(askedHourly).toBe(false);
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

/**
 * The student's own allowance, as opposed to the shared quota above.
 *
 * The distinction these pin is the one the module is built around: a quota the
 * student did not create degrades to the mock, and a budget they spent refuses.
 * Getting it backwards in either direction is bad — a silent mock reply reads as
 * the app breaking, and a hard error for someone else's busy morning is unfair.
 */
describe("turn budgets", () => {
  beforeEach(() => {
    messageCount.mockClear();
    resetCounts();
    usageFindUnique.mockReset().mockResolvedValue(null);
    settingFindMany.mockReset().mockResolvedValue([]);
  });

  afterEach(() => vi.restoreAllMocks());

  it("refuses once the attempt's turns are spent", async () => {
    counts.attempt = llmBudget.messagesPerAttempt;

    const verdict = await checkBudget("user-1", new Date(), "attempt-1");
    expect(verdict).toEqual({ ok: false, reason: "attempt_limit", remaining: 0 });
  });

  /**
   * The route persists the user's message before asking, so the count already
   * includes the turn being taken. One off here is a student losing a turn they
   * were told they had.
   */
  it("allows the last turn of the budget", async () => {
    counts.attempt = llmBudget.messagesPerAttempt - 1;

    expect((await checkBudget("user-1", new Date(), "attempt-1")).ok).toBe(true);
  });

  it("refuses a burst inside one minute", async () => {
    counts.minute = llmBudget.messagesPerMinute + 1;

    // No attemptId, so the per-attempt check is skipped and the minute one bites.
    expect(await checkBudget("user-1")).toEqual({ ok: false, reason: "minute_limit" });
  });

  it("allows exactly the per-minute allowance", async () => {
    counts.minute = llmBudget.messagesPerMinute;

    expect((await checkBudget("user-1")).ok).toBe(true);
  });

  /**
   * A turn budget is the shape of the exercise, not a spend guard, so it applies
   * on a local model too — a student on Ollama is practising the same exercise.
   */
  it("still applies on an unmetered provider", async () => {
    vi.resetModules();
    vi.stubEnv("LLM_PROVIDER", "ollama");
    const { checkBudget: localCheck } = await import("@/lib/llm/budget");
    counts.attempt = llmBudget.messagesPerAttempt;

    const verdict = await localCheck("user-1", new Date(), "attempt-1");
    expect(verdict.reason).toBe("attempt_limit");

    vi.stubEnv("LLM_PROVIDER", "gemini");
    vi.resetModules();
  });

  /** An admin raising the ceiling must take effect without a redeploy. */
  it("honours an admin override of the attempt budget", async () => {
    settingFindMany.mockResolvedValue([{ key: "messagesPerAttempt", value: "25" }]);
    counts.attempt = llmBudget.messagesPerAttempt + 1;

    expect((await checkBudget("user-1", new Date(), "attempt-1")).ok).toBe(true);
  });

  it("treats 0 as disabling a limit rather than blocking everything", async () => {
    settingFindMany.mockResolvedValue([{ key: "messagesPerAttempt", value: "0" }]);
    counts.attempt = 9999;
    counts.minute = 9999;

    // The attempt cap is off; the minute cap is what refuses instead.
    expect((await checkBudget("user-1", new Date(), "attempt-1")).reason).toBe("minute_limit");
  });

  /** The global cap ships disabled, so a quiet deployment never meets it. */
  it("skips the deployment-wide cap when it is 0", async () => {
    usageFindUnique.mockResolvedValue({ count: 10_000 });

    expect((await checkBudget("user-1")).ok).toBe(true);
    expect(usageFindUnique).not.toHaveBeenCalled();
  });

  it("applies the deployment-wide cap once an admin sets one", async () => {
    settingFindMany.mockResolvedValue([{ key: "globalRequestsPerDay", value: "200" }]);
    usageFindUnique.mockResolvedValue({ count: 200 });

    expect(await checkBudget("user-1")).toEqual({ ok: false, reason: "daily_limit" });
  });
});

describe("isRefusal", () => {
  /** The whole point: two kinds of limit, two kinds of answer. */
  it("separates the student's own budget from the shared quota", async () => {
    const { isRefusal } = await import("@/lib/llm/budget");
    expect(isRefusal("attempt_limit")).toBe(true);
    expect(isRefusal("minute_limit")).toBe(true);
    expect(isRefusal("user_limit")).toBe(false);
    expect(isRefusal("daily_limit")).toBe(false);
    expect(isRefusal(undefined)).toBe(false);
  });
});
