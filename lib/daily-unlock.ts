import { db } from "@/lib/db";
import { NO_GRANT, type AccessGrant, type TierSubject } from "@/lib/entitlements";
import { SIMULATION_TYPE } from "@/lib/types";

/**
 * The one guesstimate and one war room open today.
 *
 * The cohort works a single problem a day. Everything else in the catalogue is
 * locked (an admin turns `Question.freeTier` off), so this is what opens the
 * door — and it opens it for everyone at once, which is the point: a class that
 * all did the same question can discuss it.
 *
 * ## No cron, and that is deliberate
 *
 * The day's pick is COMPUTED FROM THE DATE when someone asks, never written by a
 * scheduled job. `User.proUntil` gives the reasoning for Pro and it applies
 * unchanged here: a value derived from the clock cannot drift out of sync with
 * it. There is no job to fail at midnight, nothing to backfill after downtime,
 * no cold-start problem on serverless, and a professor who pins nothing still
 * has a class with work to do.
 *
 * An admin pin (`DailyUnlock`) simply wins where one exists. So the professor is
 * in control on the days they care and absent on the days they do not, which is
 * the actual requirement.
 *
 * No `import "server-only"`, matching `lib/llm/budget.ts` rather than
 * `lib/auth.ts`: the marker is unresolvable under Vitest, and the two modules
 * that carry it are precisely the two with no tests. `pickDailyIndex` is the
 * whole correctness story here and it is worth more tested than fenced — and
 * the fence buys little, since importing this from a client component would
 * fail on the Prisma import a line below anyway.
 */

/** The two slots. A day opens one of each. */
export const DAILY_SLOTS = ["guesstimate", SIMULATION_TYPE] as const;
export type DailySlot = (typeof DAILY_SLOTS)[number];

/** UTC calendar day, "YYYY-MM-DD". The key a pin is stored under. */
export function dayKey(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/**
 * Which item of `count` this day gets.
 *
 * Whole days since the epoch, modulo the list length: consecutive days step
 * through the list one at a time, so every question is used once before any
 * repeats, and the same date always resolves to the same index — on any server,
 * after any restart, for every student.
 *
 * Pure, and the only interesting arithmetic in the module, so it is unit-tested
 * directly rather than through a database.
 *
 * Returns -1 for an empty list. A caller with nothing to pick from has no
 * unlock, which is a real state on a fresh install, and `% 0` is NaN — the kind
 * of value that fails three layers away from its cause.
 */
export function pickDailyIndex(day: string, count: number): number {
  if (count <= 0) return -1;
  const days = Math.floor(Date.parse(`${day}T00:00:00Z`) / 86_400_000);
  if (!Number.isFinite(days)) return -1;
  // `%` keeps the sign of its left operand, and dates before 1970 are not a
  // real case but a negative index is a real crash.
  return ((days % count) + count) % count;
}

/** The question ids open today, one slot at a time. */
async function resolveSlot(slot: DailySlot, day: string): Promise<string | null> {
  const pinned = await db.dailyUnlock.findUnique({
    where: { day_type: { day, type: slot } },
    select: { questionId: true },
  });
  if (pinned) return pinned.questionId;

  // Ordered by id so the sequence is stable across queries and deployments —
  // an unordered list would re-shuffle the rotation whenever the database felt
  // like returning rows differently, and "today's question" would stop being a
  // fact two students could agree on.
  const pool = await db.question.findMany({
    where: { type: slot },
    orderBy: { id: "asc" },
    select: { id: true },
  });

  const index = pickDailyIndex(day, pool.length);
  return index < 0 ? null : pool[index].id;
}

export interface DailyPick {
  slot: DailySlot;
  questionId: string | null;
  /** True when an admin chose it, false when the date did. */
  pinned: boolean;
}

/** Both slots for a day, with where each came from — the admin panel reads this. */
export async function resolveDaily(day: string = dayKey()): Promise<DailyPick[]> {
  const pins = await db.dailyUnlock.findMany({
    where: { day },
    select: { type: true, questionId: true },
  });
  const pinnedBy = new Map(pins.map((p) => [p.type, p.questionId]));

  return Promise.all(
    DAILY_SLOTS.map(async (slot) => {
      const pinned = pinnedBy.get(slot);
      if (pinned) return { slot, questionId: pinned, pinned: true };
      return { slot, questionId: await resolveSlot(slot, day), pinned: false };
    }),
  );
}

/**
 * Today's unlock, as a grant — **for signed-in accounts only**.
 *
 * This one line is what makes "you need an account to practise" true. A guest
 * keeps everything else: they browse the catalogue, they take a seat in a
 * classroom room (a class joins as guests by design, and `roomGrantFor` still
 * opens that room's question), and signing up claims whatever they did. What
 * they cannot do is open the day's question, because that is the thing the
 * account is for.
 *
 * A grant rather than a new kind of gate, because `AccessGrant` already means
 * exactly this — "questions opened to one visitor regardless of their tier,
 * additive to it" — and grants compose, so a student who is both signed in and
 * sitting in a room gets both.
 */
export async function dailyGrantFor(
  user: (TierSubject & { id: string }) | null | undefined,
): Promise<AccessGrant> {
  if (!user || user.isGuest) return NO_GRANT;

  const picks = await resolveDaily();
  const ids = picks.map((p) => p.questionId).filter((id): id is string => id !== null);
  return ids.length ? { questionIds: ids } : NO_GRANT;
}

/** Pin a question to a day, or replace the pin already there. */
export async function pinDaily(day: string, slot: DailySlot, questionId: string): Promise<void> {
  await db.dailyUnlock.upsert({
    where: { day_type: { day, type: slot } },
    create: { day, type: slot, questionId },
    update: { questionId },
  });
}

/** Remove a pin, handing the day back to the automatic rotation. */
export async function unpinDaily(day: string, slot: DailySlot): Promise<void> {
  await db.dailyUnlock.deleteMany({ where: { day, type: slot } });
}
