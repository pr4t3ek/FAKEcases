"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getOrCreateGuest } from "@/lib/auth";
import { guestConfig } from "@/lib/config";
import { interviewerReply, isRealProvider } from "@/lib/llm";
import { recordLlmCall } from "@/lib/llm/budget";
import { toQuestionContext } from "@/lib/question-context";
import { answerModeFor, type TreeMode } from "@/lib/types";

/**
 * Start (or resume) an attempt for a question. Creates a guest session if the
 * visitor isn't logged in. Enforces the guest attempt cap with a soft wall.
 */
export async function startAttempt(
  questionId: string,
  requestedTreeMode?: TreeMode,
): Promise<void> {
  const user = await getOrCreateGuest();

  // Resume an existing in-progress attempt if one exists.
  const existing = await db.attempt.findFirst({
    where: { userId: user.id, questionId, status: "in_progress" },
    orderBy: { createdAt: "desc" },
  });
  if (existing) redirect(`/practice/${existing.id}`);

  // Guest soft wall.
  if (user.isGuest) {
    const done = await db.attempt.count({
      where: { userId: user.id, status: "submitted" },
    });
    if (done >= guestConfig.attemptCap) redirect("/signup?wall=1");
  }

  const question = await db.question.findUnique({
    where: { id: questionId },
    include: { category: true },
  });
  if (!question) redirect("/library");

  // Fixed at creation and never changed afterwards: if the tree mode could be
  // switched mid-attempt, "solo" would mean nothing — you could flip to guided,
  // take the structure, and flip back. Solo is the default; guided is a
  // deliberate choice made on the question card, and costs the candidate their
  // structure score (see evaluateQualitative).
  const answerMode = answerModeFor(question.type);
  const treeMode =
    answerMode === "qualitative"
      ? requestedTreeMode === "guided"
        ? "guided"
        : "solo"
      : null;
  const attempt = await db.attempt.create({
    data: {
      userId: user.id,
      questionId,
      mode: "interviewer",
      status: "in_progress",
      treeMode,
    },
  });

  // Seed the interviewer's opening turn so the chat isn't empty.
  try {
    const { content, outcome } = await interviewerReply({
      question: toQuestionContext(question),
      mode: "interviewer",
      messages: [],
      assumptions: [],
      framework: [],
      hintsUsed: 0,
    });
    if (content) {
      await db.message.create({
        data: {
          attemptId: attempt.id,
          role: "assistant",
          mode: "interviewer",
          content,
          provider: outcome.provider,
          model: outcome.model,
        },
      });
      if (isRealProvider(outcome.provider)) await recordLlmCall();
    }
  } catch {
    // Non-fatal: the practice screen still works without a seeded opener.
  }

  redirect(`/practice/${attempt.id}`);
}
