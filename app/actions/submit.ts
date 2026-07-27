"use server";

import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { evaluate } from "@/lib/evaluation";
import { updateProgress, recomputeRank } from "@/lib/progress";
import { applyAttemptRewards } from "@/lib/gamification";

export interface SubmitResult {
  ok: boolean;
  error?: string;
  reward?: {
    xpGained: number;
    leveledUp: boolean;
    level: number;
    streak: number;
    newAchievements: string[];
    overall: number;
    readiness: string;
  };
}

/** Evaluate a completed attempt, persist the report, and apply rewards. */
export async function submitAttempt(attemptId: string): Promise<SubmitResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  const attempt = await db.attempt.findUnique({
    where: { id: attemptId },
    include: {
      question: true,
      messages: true,
      calculations: true,
      framework: true,
      evaluation: true,
    },
  });
  if (!attempt || attempt.userId !== user.id) return { ok: false, error: "Not found" };
  if (attempt.evaluation) {
    return { ok: true }; // already submitted; page will show the report
  }

  const result = evaluate({
    idealLow: attempt.question.idealLow,
    idealHigh: attempt.question.idealHigh,
    betterApproach: attempt.question.betterApproach,
    sampleSolution: attempt.question.sampleSolution,
    finalEstimate: attempt.finalEstimate,
    // The assumed figures are read back off the tree and the conversation
    // rather than a list kept by hand — see deriveAssumptions.
    framework: attempt.framework.map((f) => ({
      label: f.label,
      value: f.value,
      multiplier: f.multiplier,
    })),
    calculationCount: attempt.calculations.length,
    userMessageText: attempt.messages.filter((m) => m.role === "user").map((m) => m.content),
    hintsUsed: attempt.hintsUsed,
  });

  await db.evaluation.create({
    data: {
      attemptId,
      overall: result.overall,
      readiness: result.readiness,
      structuring: result.scores.structuring,
      logic: result.scores.logic,
      segmentation: result.scores.segmentation,
      assumptions: result.scores.assumptions,
      calculation: result.scores.calculation,
      communication: result.scores.communication,
      business: result.scores.business,
      confidence: result.scores.confidence,
      accuracyHit: result.accuracyHit,
      feedback: JSON.stringify(result.feedback),
      betterApproach: attempt.question.betterApproach,
      sampleSolution: attempt.question.sampleSolution,
    },
  });

  await db.attempt.update({
    where: { id: attemptId },
    data: { status: "submitted", submittedAt: new Date() },
  });

  // Progress rollup + rewards + rank (guests get rewards too; harmless).
  const progress = await updateProgress(user.id);
  const reward = await applyAttemptRewards(user.id, {
    overall: result.overall,
    accuracyHit: result.accuracyHit,
    hintsUsed: attempt.hintsUsed,
    segmentationScore: result.scores.segmentation,
    totalSolved: progress.totalSolved,
  });
  await recomputeRank(user.id).catch(() => {});

  return {
    ok: true,
    reward: {
      xpGained: reward.xpGained,
      leveledUp: reward.leveledUp,
      level: reward.level,
      streak: reward.streak,
      newAchievements: reward.newAchievements,
      overall: result.overall,
      readiness: result.readiness,
    },
  };
}
