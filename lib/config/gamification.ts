/**
 * All gamification tunables in one place — XP rules, levels, streaks,
 * and the PERCENTILE-based rank ladder (Silver → Diamond).
 */

export const xpRules = {
  /** Base XP for completing (submitting) an attempt. */
  attemptComplete: 20,
  /** Additional XP scaled by evaluation score: floor(overall * factor). */
  scoreFactor: 0.8, // e.g. 80/100 -> +64 XP
  /** Bonus for finishing without using all hints. */
  fewHintsBonus: 15,
  /** Daily streak bonus (per active day). */
  streakDayBonus: 10,
  /** First attempt of the day. */
  dailyFirstAttempt: 25,
};

/** Level thresholds: level N requires levelBase * N^levelExp cumulative XP. */
export const levelCurve = {
  base: 120,
  exp: 1.35,
  maxLevel: 50,
};

export function levelForXp(xp: number): number {
  let level = 1;
  while (
    level < levelCurve.maxLevel &&
    xp >= Math.round(levelCurve.base * Math.pow(level, levelCurve.exp))
  ) {
    level++;
  }
  return level;
}

export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.round(levelCurve.base * Math.pow(level - 1, levelCurve.exp));
}

/**
 * PERCENTILE-based rank ladder. A user's rank is set by their percentile
 * (0–100) among ranked users on their skill rating — NOT by XP.
 * Bands are the lower bound (inclusive) of each tier.
 */
export type Rank = "Unranked" | "Silver" | "Gold" | "Platinum" | "Diamond";

export const rankBands: { rank: Exclude<Rank, "Unranked">; minPercentile: number }[] = [
  { rank: "Diamond", minPercentile: 90 },
  { rank: "Platinum", minPercentile: 70 },
  { rank: "Gold", minPercentile: 40 },
  { rank: "Silver", minPercentile: 0 },
];

/** Minimum graded attempts before a user leaves "Unranked" placement. */
export const rankPlacementAttempts = 5;

export function rankForPercentile(
  percentile: number | null,
  gradedAttempts: number,
): Rank {
  if (percentile === null || gradedAttempts < rankPlacementAttempts) {
    return "Unranked";
  }
  for (const band of rankBands) {
    if (percentile >= band.minPercentile) return band.rank;
  }
  return "Silver";
}

export const rankMeta: Record<Rank, { label: string; emoji: string; color: string }> = {
  Unranked: { label: "Unranked", emoji: "•", color: "hsl(215 16% 47%)" },
  Silver: { label: "Silver", emoji: "🥈", color: "hsl(215 15% 60%)" },
  Gold: { label: "Gold", emoji: "🥇", color: "hsl(38 92% 50%)" },
  Platinum: { label: "Platinum", emoji: "💠", color: "hsl(172 60% 45%)" },
  Diamond: { label: "Diamond", emoji: "💎", color: "hsl(199 89% 58%)" },
};

/**
 * Skill rating = recency-weighted mean of evaluation overall scores,
 * lightly rewarded for consistency. Quality, not grind.
 * `scores` should be ordered oldest → newest.
 */
export function computeSkillRating(scores: number[]): number | null {
  if (scores.length === 0) return null;
  let weightSum = 0;
  let acc = 0;
  scores.forEach((s, i) => {
    // more recent attempts weigh more
    const w = 1 + i * 0.15;
    acc += s * w;
    weightSum += w;
  });
  const weightedMean = acc / weightSum;

  // consistency bonus: lower stdev => small boost (max +4)
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance =
    scores.reduce((a, b) => a + (b - mean) ** 2, 0) / scores.length;
  const stdev = Math.sqrt(variance);
  const consistencyBonus = Math.max(0, 4 - stdev / 6);

  return Math.round((weightedMean + consistencyBonus) * 10) / 10;
}
