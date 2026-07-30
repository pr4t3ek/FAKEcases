import { db } from "@/lib/db";
import { xpRules, levelForXp } from "@/lib/config";

/** Start-of-day for streak comparisons. */
function startOfDay(d: Date): number {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c.getTime();
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Pure XP calculation for a completed attempt. */
export function computeAttemptXp(args: {
  overall: number;
  hintsUsed: number;
  isFirstToday: boolean;
}): number {
  let xp = xpRules.attemptComplete;
  xp += Math.floor(args.overall * xpRules.scoreFactor);
  if (args.hintsUsed === 0) xp += xpRules.fewHintsBonus;
  if (args.isFirstToday) xp += xpRules.dailyFirstAttempt;
  return xp;
}

async function awardAchievement(userId: string, slug: string): Promise<string | null> {
  const achievement = await db.achievement.findUnique({ where: { slug } });
  if (!achievement) return null;
  const existing = await db.userAchievement.findUnique({
    where: { userId_achievementId: { userId, achievementId: achievement.id } },
  });
  if (existing) return null;
  await db.userAchievement.create({
    data: { userId, achievementId: achievement.id },
  });
  return achievement.title;
}

export interface AttemptRewardResult {
  xpGained: number;
  totalXp: number;
  level: number;
  leveledUp: boolean;
  streak: number;
  newAchievements: string[];
}

/**
 * Apply XP, streak, level and achievements after an attempt is submitted.
 * Mutates the user row. Returns a summary for the UI to celebrate.
 */
export async function applyAttemptRewards(
  userId: string,
  ctx: {
    overall: number;
    accuracyHit: boolean;
    hintsUsed: number;
    /** Null when the attempt wasn't scored on structure — a guided tree builds
     *  itself, so the MECE achievement can't be earned from it. */
    segmentationScore: number | null;
    totalSolved: number;
  },
): Promise<AttemptRewardResult> {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");

  const now = new Date();
  const today = startOfDay(now);

  // Streak
  let streak = user.streak;
  let isFirstToday = true;
  if (user.lastActiveDate) {
    const last = startOfDay(user.lastActiveDate);
    if (last === today) {
      isFirstToday = false; // already practised today
    } else if (today - last === DAY_MS) {
      streak = user.streak + 1; // consecutive day
    } else if (today - last > DAY_MS) {
      streak = 1; // streak broken; restart
    }
  } else {
    streak = 1;
  }
  const longestStreak = Math.max(user.longestStreak, streak);

  // XP + level
  const xpGained = computeAttemptXp({
    overall: ctx.overall,
    hintsUsed: ctx.hintsUsed,
    isFirstToday,
  }) + (isFirstToday ? xpRules.streakDayBonus : 0);
  const totalXp = user.xp + xpGained;
  const newLevel = levelForXp(totalXp);
  const leveledUp = newLevel > user.level;
  const coins = user.coins + Math.round(xpGained / 4);

  await db.user.update({
    where: { id: userId },
    data: {
      xp: totalXp,
      level: newLevel,
      coins,
      streak,
      longestStreak,
      lastActiveDate: now,
    },
  });

  // Achievements
  const newAchievements: string[] = [];
  const maybeAward = async (slug: string) => {
    const title = await awardAchievement(userId, slug);
    if (title) newAchievements.push(title);
  };

  await maybeAward("first-attempt");
  if ((ctx.segmentationScore ?? 0) >= 85) await maybeAward("mece-master");
  if (ctx.accuracyHit) await maybeAward("sharp-shooter");
  if (ctx.hintsUsed === 0) await maybeAward("no-hints");
  if (ctx.overall >= 85) await maybeAward("interview-ready");
  if (ctx.totalSolved >= 10) await maybeAward("ten-solved");
  if (streak >= 3) await maybeAward("streak-3");
  if (streak >= 7) await maybeAward("streak-7");

  return { xpGained, totalXp, level: newLevel, leveledUp, streak, newAchievements };
}
