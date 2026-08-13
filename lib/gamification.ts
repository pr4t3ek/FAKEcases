import { db } from "@/lib/db";
import { xpRules, simXpRules, levelForXp } from "@/lib/config";

/** Start-of-day for streak comparisons. */
function startOfDay(d: Date): number {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c.getTime();
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Pure XP calculation for a completed attempt.
 *
 * A null `overall` is an attempt that was not scored — Teacher mode walked the
 * candidate through it. The score-proportional slice is all that goes: the base,
 * the daily-first bonus and the streak behind it survive, because the candidate
 * did turn up and work the problem. XP measures showing up; the score measures
 * how it went, and there is no score to be proportional to.
 */
export function computeAttemptXp(args: {
  overall: number | null;
  hintsUsed: number;
  isFirstToday: boolean;
}): number {
  let xp = xpRules.attemptComplete;
  if (args.overall != null) xp += Math.floor(args.overall * xpRules.scoreFactor);
  if (args.hintsUsed === 0) xp += xpRules.fewHintsBonus;
  if (args.isFirstToday) xp += xpRules.dailyFirstAttempt;
  return xp;
}

/**
 * Pure XP calculation for a completed simulation.
 *
 * Its own rule set rather than a reuse of `computeAttemptXp`: a simulation has
 * no hints to forgo, and the behaviour worth paying for is finding the cause
 * inside the analyst-day budget.
 */
export function computeSimulationXp(args: {
  overall: number;
  underPar: boolean;
  isFirstToday: boolean;
}): number {
  let xp = simXpRules.runComplete;
  xp += Math.floor(args.overall * simXpRules.scoreFactor);
  if (args.underPar) xp += simXpRules.underBudgetBonus;
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

type RewardCore = Omit<AttemptRewardResult, "newAchievements"> & { streakDays: number };

/**
 * Streak, XP, level and coins — the half that is identical however the XP was
 * earned.
 *
 * Shared by attempts and simulations so a day spent in the war room counts as
 * practising, and so the two paths can never disagree about what a streak is.
 * The exercise-specific half — how much XP, and which achievements — stays with
 * the caller, because those are the parts that genuinely differ.
 *
 * `xpFor` is a callback because the amount depends on whether this is the first
 * activity today, which is only known once the streak has been read.
 */
async function applyRewardCore(
  userId: string,
  xpFor: (isFirstToday: boolean) => number,
): Promise<RewardCore> {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");

  const now = new Date();
  const today = startOfDay(now);

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

  const xpGained = xpFor(isFirstToday) + (isFirstToday ? xpRules.streakDayBonus : 0);
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

  return { xpGained, totalXp, level: newLevel, leveledUp, streak, streakDays: streak };
}

/** Award several achievements, returning the titles that were newly unlocked. */
async function awardAll(userId: string, slugs: string[]): Promise<string[]> {
  const unlocked: string[] = [];
  for (const slug of slugs) {
    const title = await awardAchievement(userId, slug);
    if (title) unlocked.push(title);
  }
  return unlocked;
}

/**
 * Apply XP, streak, level and achievements after an attempt is submitted.
 * Mutates the user row. Returns a summary for the UI to celebrate.
 */
export async function applyAttemptRewards(
  userId: string,
  ctx: {
    /** Null when the attempt wasn't scored at all — Teacher mode stated the
     *  answer, so none of the performance achievements can be earned from it. */
    overall: number | null;
    accuracyHit: boolean;
    hintsUsed: number;
    /** Null when the attempt wasn't scored on structure — a guided tree builds
     *  itself, so the MECE achievement can't be earned from it. */
    segmentationScore: number | null;
    totalSolved: number;
  },
): Promise<AttemptRewardResult> {
  const core = await applyRewardCore(userId, (isFirstToday) =>
    computeAttemptXp({ overall: ctx.overall, hintsUsed: ctx.hintsUsed, isFirstToday }),
  );

  // An unscored attempt earns the ones about turning up, and none of the ones
  // that claim something about the candidate's performance. `no-hints` is the
  // sharpest case: skipping the hint ladder in order to be handed the answer
  // outright used to earn the badge for working unaided.
  const scored = ctx.overall != null;

  const earned = [
    "first-attempt",
    ...(scored && (ctx.segmentationScore ?? 0) >= 85 ? ["mece-master"] : []),
    ...(scored && ctx.accuracyHit ? ["sharp-shooter"] : []),
    ...(scored && ctx.hintsUsed === 0 ? ["no-hints"] : []),
    ...(scored && ctx.overall! >= 85 ? ["interview-ready"] : []),
    ...(ctx.totalSolved >= 10 ? ["ten-solved"] : []),
    ...(core.streakDays >= 3 ? ["streak-3"] : []),
    ...(core.streakDays >= 7 ? ["streak-7"] : []),
  ];

  return { ...core, newAchievements: await awardAll(userId, earned) };
}

/**
 * Apply rewards after a simulation is committed.
 *
 * Shares the streak and level ladder with attempts, and nothing else. The
 * interview achievements stay on the attempt path — a simulation has no MECE
 * tree to score and no ideal range to hit — so the war room has its own four.
 *
 * Note what is NOT called here: `updateProgress` and `recomputeRank`. A
 * simulation earns XP and keeps a streak alive, and it moves no percentile.
 */
export async function applySimulationRewards(
  userId: string,
  ctx: {
    overall: number;
    diagnosisScore: number;
    decisionScore: number;
    causeFound: boolean;
    underPar: boolean;
  },
): Promise<AttemptRewardResult> {
  const core = await applyRewardCore(userId, (isFirstToday) =>
    computeSimulationXp({ overall: ctx.overall, underPar: ctx.underPar, isFirstToday }),
  );

  const earned = [
    "war-room",
    ...(ctx.diagnosisScore >= 85 ? ["sharp-diagnosis"] : []),
    ...(ctx.decisionScore >= 85 ? ["capital-allocator"] : []),
    // Cheap only counts if it also found the thing.
    ...(ctx.underPar && ctx.causeFound ? ["frugal-analyst"] : []),
    ...(core.streakDays >= 3 ? ["streak-3"] : []),
    ...(core.streakDays >= 7 ? ["streak-7"] : []),
  ];

  return { ...core, newAchievements: await awardAll(userId, earned) };
}
