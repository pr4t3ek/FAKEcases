"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getOrCreateGuest } from "@/lib/auth";
import { guestConfig } from "@/lib/config";
import { interviewerReply } from "@/lib/llm";
import { toQuestionContext } from "@/lib/question-context";

/**
 * Start (or resume) an attempt for a question. Creates a guest session if the
 * visitor isn't logged in. Enforces the guest attempt cap with a soft wall.
 */
export async function startAttempt(questionId: string): Promise<void> {
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

  const attempt = await db.attempt.create({
    data: { userId: user.id, questionId, mode: "interviewer", status: "in_progress" },
  });

  // Seed the interviewer's opening turn so the chat isn't empty.
  try {
    const { content } = await interviewerReply({
      question: toQuestionContext(question),
      mode: "interviewer",
      messages: [],
      assumptions: [],
      framework: [],
      hintsUsed: 0,
    });
    await db.message.create({
      data: { attemptId: attempt.id, role: "assistant", mode: "interviewer", content },
    });
  } catch {
    // Non-fatal: the practice screen still works without a seeded opener.
  }

  redirect(`/practice/${attempt.id}`);
}
