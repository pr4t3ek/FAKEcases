import { db } from "@/lib/db";
import { llmBudget } from "@/lib/config";

/**
 * Spend guards for a shared free-tier quota.
 *
 * Free-tier limits are enforced per API key, so every user of a deployment draws
 * from the same daily pool. Two guards protect it, and both *degrade* rather than
 * reject: exceeding a limit routes the turn to the mock interviewer (badged in the
 * UI) instead of showing the candidate an error mid-session.
 */

export type BudgetReason = "user_limit" | "daily_limit";

export interface BudgetVerdict {
  /** False when the turn must be served by the mock. */
  ok: boolean;
  reason?: BudgetReason;
}

const OK: BudgetVerdict = { ok: true };

/** UTC day key, "YYYY-MM-DD". */
export function dayKey(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/**
 * Can this user's turn go to the real provider?
 *
 * Checked before the call rather than after a 429: spending the last few requests
 * of the day discovering the quota is gone wastes exactly the budget being protected.
 */
export async function checkBudget(
  userId: string,
  now: Date = new Date(),
): Promise<BudgetVerdict> {
  const since = new Date(now.getTime() - 60 * 60 * 1000);

  // Message has no userId of its own; reach it through the owning attempt.
  const recentUserMessages = await db.message.count({
    where: {
      role: "user",
      createdAt: { gte: since },
      attempt: { userId },
    },
  });
  if (recentUserMessages > llmBudget.userMessagesPerHour) {
    return { ok: false, reason: "user_limit" };
  }

  const today = await db.usageCounter.findUnique({ where: { day: dayKey(now) } });
  if ((today?.count ?? 0) >= llmBudget.globalRequestsPerDay) {
    return { ok: false, reason: "daily_limit" };
  }

  return OK;
}

/**
 * Record one real provider call against today's counter.
 *
 * Best-effort: a counter write failing should never fail a turn the user already
 * received, so this swallows errors. Worst case the app slightly over-counts its
 * remaining budget for the day, which the headroom in `llmBudget` absorbs.
 */
export async function recordLlmCall(now: Date = new Date()): Promise<void> {
  const day = dayKey(now);
  try {
    await db.usageCounter.upsert({
      where: { day },
      create: { day, count: 1 },
      update: { count: { increment: 1 } },
    });
  } catch (err) {
    console.error("[llm] failed to record usage:", err);
  }
}
