"use server";

import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import {
  evaluate,
  evaluateQualitative,
  solutionWasRevealed,
  type RootCause,
} from "@/lib/evaluation";
import { updateProgress, recomputeRank } from "@/lib/progress";
import { applyAttemptRewards } from "@/lib/gamification";
import { recordFirstResult } from "@/lib/leaderboard";
import { parseJson } from "@/lib/json";
import { answerModeFor, type TreeMode } from "@/lib/types";

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

  const userMessageText = attempt.messages
    .filter((m) => m.role === "user")
    .map((m) => m.content);
  // Teacher mode states the answer, so an attempt that used it is a different
  // exercise from one that didn't. Read off the transcript, not tracked apart.
  const solutionRevealed = solutionWasRevealed(attempt.messages);
  // The assumed figures — or, in a case, the reasons — are read back off the tree
  // and the conversation rather than a list kept by hand. See deriveAssumptions.
  const framework = attempt.framework.map((f) => ({
    id: f.id,
    parentId: f.parentId,
    label: f.label,
    value: f.value,
    multiplier: f.multiplier,
    status: f.status,
    note: f.note,
    sourceMessageId: f.sourceMessageId,
    origin: f.origin,
  }));

  const answerMode = answerModeFor(attempt.question.type);
  const result =
    answerMode === "qualitative"
      ? evaluateQualitative({
          framework,
          userMessageText,
          finalAnswer: attempt.finalAnswer,
          hintsUsed: attempt.hintsUsed,
          treeMode: (attempt.treeMode as TreeMode | null) ?? null,
          rootCause: parseJson<RootCause>(attempt.question.rootCause),
          expectedBuckets: parseJson<string[]>(attempt.question.expectedBuckets) ?? [],
          betterApproach: attempt.question.betterApproach,
          solutionRevealed,
        })
      : evaluate({
          idealLow: attempt.question.idealLow,
          idealHigh: attempt.question.idealHigh,
          betterApproach: attempt.question.betterApproach,
          sampleSolution: attempt.question.sampleSolution,
          finalEstimate: attempt.finalEstimate,
          framework,
          calculationCount: attempt.calculations.length,
          userMessageText,
          hintsUsed: attempt.hintsUsed,
          solutionRevealed,
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
      diagnosis: result.scores.diagnosis,
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

  // The ranked result, if this is their first attempt at this question. A
  // replay returns false and changes nothing — see lib/leaderboard.ts for why
  // a warm retry must not move a standing.
  await recordFirstResult({
    userId: user.id,
    questionId: attempt.questionId,
    kind: "attempt",
    score: result.overall,
    effort: attempt.timeSpentSec,
    sourceId: attempt.id,
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
