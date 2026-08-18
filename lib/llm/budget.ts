import { db } from "@/lib/db";
import { isMeteredLlm } from "@/lib/config";
import { loadSettings } from "@/lib/settings";

/**
 * What a student may spend, and what the deployment may.
 *
 * Four limits, and they divide into two kinds that deserve opposite answers.
 *
 * **Quota guards** — `user_limit`, `daily_limit` — protect a pool the student
 * did not create and cannot see. Exceeding one DEGRADES: the turn is served by
 * the mock interviewer, badged in the UI, rather than refused. Somebody whose
 * session is interrupted because a stranger was busy this morning should still
 * get an answer.
 *
 * **Turn budgets** — `attempt_limit`, `minute_limit` — are the student's own
 * allowance, spent by them, and visible in the composer before it runs out.
 * These REFUSE. Quietly substituting the mock for a budget they knowingly spent
 * would read as the app breaking, and it would waste the pedagogy: the ceiling
 * exists so a candidate decides what to ask before asking it, which only works
 * if running out is a visible event.
 *
 * The numbers come from `lib/settings.ts`, so a professor can retune them
 * mid-term from the admin panel; the code defaults in `lib/config/practice.ts`
 * apply until one is overridden.
 */

export type BudgetReason =
  /** Rolling hourly cap on one user. Degrades. */
  | "user_limit"
  /** Deployment-wide daily cap. Degrades. Disabled when the setting is 0. */
  | "daily_limit"
  /** This attempt's turn budget is spent. Refuses. */
  | "attempt_limit"
  /** Too many turns in the last minute. Refuses. */
  | "minute_limit";

/** Reasons the student caused and can see coming, so the turn is refused. */
const REFUSING: readonly BudgetReason[] = ["attempt_limit", "minute_limit"];

/**
 * Whether this verdict should be shown as an error rather than answered by the
 * mock. Exported so the route does not re-encode the same list.
 */
export function isRefusal(reason: BudgetReason | undefined): boolean {
  return reason !== undefined && (REFUSING as readonly string[]).includes(reason);
}

/** What the student is told. Each names what to do next, not just what failed. */
export const BUDGET_MESSAGE: Record<BudgetReason, string> = {
  attempt_limit:
    "You've used all your turns on this question. Submit your answer to see how you did.",
  minute_limit: "You're sending messages very quickly. Wait a moment, then continue.",
  user_limit: "You've been practising a lot this hour — answers may be less sharp for a bit.",
  daily_limit: "Today's shared AI budget is spent — answers may be less sharp for a bit.",
};

export interface BudgetVerdict {
  /** False when the turn must not go to the real provider as-is. */
  ok: boolean;
  reason?: BudgetReason;
  /** Turns left on this attempt after this one. Null when there is no cap. */
  remaining?: number | null;
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
  /** Present for a practice turn; absent for anything not tied to one attempt. */
  attemptId?: string,
): Promise<BudgetVerdict> {
  const limits = await loadSettings();

  // ── Turn budgets ─────────────────────────────────────────────────────────
  // Checked FIRST, and checked even on a local model. These are not about
  // spend: they are the shape of the exercise, and a student on Ollama is
  // practising the same exercise as everyone else.
  if (attemptId && limits.messagesPerAttempt > 0) {
    const used = await db.message.count({
      where: { attemptId, role: "user" },
    });
    // The caller persists the user's message BEFORE asking, so `used` already
    // counts the turn being taken — hence `>=` against the budget rather than
    // `>`. Off by one here is a student losing a turn they were promised.
    if (used >= limits.messagesPerAttempt) {
      return { ok: false, reason: "attempt_limit", remaining: 0 };
    }
  }

  if (limits.messagesPerMinute > 0) {
    const since = new Date(now.getTime() - 60_000);
    const recent = await db.message.count({
      where: { role: "user", createdAt: { gte: since }, attempt: { userId } },
    });
    if (recent > limits.messagesPerMinute) {
      return { ok: false, reason: "minute_limit" };
    }
  }

  // ── Quota guards ─────────────────────────────────────────────────────────
  // A local model draws on no shared quota, so these would protect nothing and
  // cost something: silently swapping the mock in partway through a dev session
  // makes it look like the local model answered when it didn't.
  if (!isMeteredLlm) return OK;

  const since = new Date(now.getTime() - 60 * 60 * 1000);

  // Message has no userId of its own; reach it through the owning attempt.
  const recentUserMessages = await db.message.count({
    where: {
      role: "user",
      createdAt: { gte: since },
      attempt: { userId },
    },
  });
  if (recentUserMessages > limits.userMessagesPerHour) {
    return { ok: false, reason: "user_limit" };
  }

  // 0 disables it, which is the shipped default — see `llmBudget`.
  if (limits.globalRequestsPerDay > 0) {
    const today = await db.usageCounter.findUnique({ where: { day: dayKey(now) } });
    if ((today?.count ?? 0) >= limits.globalRequestsPerDay) {
      return { ok: false, reason: "daily_limit" };
    }
  }

  return OK;
}

/**
 * Turns left on an attempt, for the composer to show.
 *
 * Counted from `Message` rather than a column on `Attempt`, so the number on
 * screen and the number the gate enforces cannot drift — they are the same
 * query. Null when the budget is disabled, which the UI renders as no counter
 * rather than as infinity.
 */
export async function turnsRemaining(attemptId: string): Promise<number | null> {
  const limits = await loadSettings();
  if (limits.messagesPerAttempt <= 0) return null;

  const used = await db.message.count({ where: { attemptId, role: "user" } });
  return Math.max(0, limits.messagesPerAttempt - used);
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
