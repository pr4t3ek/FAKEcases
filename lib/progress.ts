import { db } from "@/lib/db";
import { computeSkillRating, rankForPercentile } from "@/lib/config";
import { evaluationCategories } from "@/lib/config";
import { answerModeFor } from "@/lib/types";

/**
 * Recompute a user's Progress rollup from their submitted attempts + evaluations.
 * Two-layer design: raw attempts/evaluations are the source of truth; this is the
 * denormalized rollup the dashboard reads.
 */
export async function updateProgress(userId: string): Promise<{
  totalSolved: number;
  avgScore: number;
  accuracy: number;
  consistency: number;
}> {
  const attempts = await db.attempt.findMany({
    where: { userId, status: "submitted" },
    include: { evaluation: true, question: true },
    orderBy: { submittedAt: "asc" },
  });

  // Two lists, because "did it" and "was measured on it" stopped being the same
  // question. An attempt that Teacher mode walked through has an evaluation and
  // no overall: it happened, it belongs in the count and in history, and it
  // contributes no number to anything that averages.
  const evaluated = attempts.filter((a) => a.evaluation);
  const scored = evaluated.filter((a) => a.evaluation!.overall != null);
  const totalSolved = evaluated.length;

  const scores = scored.map((a) => a.evaluation!.overall!);
  const avgScore = scores.length
    ? Math.round((scores.reduce((s, v) => s + v, 0) / scores.length) * 10) / 10
    : 0;

  // "Accuracy" means an estimate landed inside its ideal range, which only a
  // numeric question has. Dividing by every attempt would let a run of cases
  // silently drag this stat toward zero for something they were never measured
  // on.
  const numericAttempts = scored.filter(
    (a) => answerModeFor(a.question.type) === "numeric",
  );
  const hits = numericAttempts.filter((a) => a.evaluation!.accuracyHit).length;
  const accuracy = numericAttempts.length
    ? Math.round((hits / numericAttempts.length) * 100)
    : 0;

  // Consistency: 100 minus normalized standard deviation of scores.
  let consistency = 0;
  if (scores.length >= 2) {
    const mean = scores.reduce((s, v) => s + v, 0) / scores.length;
    const variance = scores.reduce((s, v) => s + (v - mean) ** 2, 0) / scores.length;
    const stdev = Math.sqrt(variance);
    consistency = Math.max(0, Math.round(100 - stdev * 2));
  } else if (scores.length === 1) {
    consistency = 100;
  }

  // Per-category averages (by categoryId).
  const byCategory: Record<string, { name: string; avg: number; count: number }> = {};
  for (const a of scored) {
    const key = a.question.categoryId;
    const entry = byCategory[key] ?? { name: "", avg: 0, count: 0 };
    entry.avg = (entry.avg * entry.count + a.evaluation!.overall!) / (entry.count + 1);
    entry.count += 1;
    byCategory[key] = entry;
  }

  // Per-skill averages. A null category didn't apply to that attempt — no
  // arithmetic in a case, no diagnosis without a declared root cause, no
  // structure score on a guided tree — so it is skipped rather than counted as
  // zero, and a category nobody has been scored on simply doesn't appear.
  const bySkill: Record<string, { avg: number; count: number }> = {};
  for (const cat of evaluationCategories) {
    const vals = scored
      .map((a) => a.evaluation![cat.key as keyof typeof a.evaluation] as number | null)
      .filter((v): v is number => typeof v === "number");
    if (vals.length) {
      const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
      bySkill[cat.key] = { avg: Math.round(avg), count: vals.length };
    }
  }

  await db.progress.upsert({
    where: { userId },
    update: {
      totalSolved,
      avgScore,
      accuracy,
      consistency,
      byCategory: JSON.stringify(byCategory),
      bySkill: JSON.stringify(bySkill),
    },
    create: {
      userId,
      totalSolved,
      avgScore,
      accuracy,
      consistency,
      byCategory: JSON.stringify(byCategory),
      bySkill: JSON.stringify(bySkill),
    },
  });

  return { totalSolved, avgScore, accuracy, consistency };
}

/**
 * Recompute this user's skill rating, percentile and rank band, measured against
 * the seeded benchmark cohort and every other registered user. In production this
 * would be a scheduled job; per-submit is fine at this scale.
 *
 * Guests are scored but never counted in the population. Every visitor who
 * clicks "Start practising" gets a real User row, and those rows are transient —
 * abandoned, or absorbed into an account at signup. Letting them into the
 * distribution would mean a candidate's rank moved with the volume of drive-by
 * traffic rather than with anyone's skill.
 */
export async function recomputeRank(userId: string): Promise<{
  rank: string;
  percentile: number | null;
  skillRating: number | null;
}> {
  // `overall: { not: null }` rather than merely "has an evaluation": an attempt
  // walked through by Teacher mode is not scored, and must reach neither the
  // skill rating nor the placement counter. Filtered in the query rather than at
  // the call site because this recomputes over the whole history — skipping the
  // call on the revealed submission would only let the next cold one pull it
  // back in.
  const evals = await db.attempt.findMany({
    where: {
      userId,
      status: "submitted",
      evaluation: { is: { overall: { not: null } } },
    },
    include: { evaluation: true },
    orderBy: { submittedAt: "asc" },
  });
  const scores = evals.map((a) => a.evaluation!.overall!);
  const gradedAttempts = scores.length;
  const skillRating = computeSkillRating(scores);

  let percentile: number | null = null;
  if (skillRating != null) {
    const population = await db.user.findMany({
      where: { skillRating: { not: null }, isGuest: false, id: { not: userId } },
      select: { skillRating: true },
    });
    const ratings = population.map((u) => u.skillRating!).filter((r) => r != null);
    if (ratings.length > 0) {
      const below = ratings.filter((r) => r < skillRating).length;
      percentile = Math.round((below / ratings.length) * 100);
    } else {
      percentile = 50;
    }
  }

  const rank = rankForPercentile(percentile, gradedAttempts);

  await db.user.update({
    where: { id: userId },
    data: { skillRating, percentile, rank: rank === "Unranked" ? null : rank },
  });

  return { rank, percentile, skillRating };
}
