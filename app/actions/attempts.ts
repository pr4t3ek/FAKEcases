"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getOrCreateGuest } from "@/lib/auth";
import { canOpen, tierFor, wallRedirect } from "@/lib/entitlements";
import { interviewerReply, isRealProvider } from "@/lib/llm";
import { recordLlmCall } from "@/lib/llm/budget";
import { toQuestionContext } from "@/lib/question-context";
import { answerModeFor, isSimulation, type TreeMode } from "@/lib/types";

/**
 * Returned instead of redirecting when the candidate asks for a tree mode that
 * the in-progress attempt isn't in. `redirect()` throws, so the happy path never
 * reaches a return and this union costs the caller nothing.
 */
export interface StartConflict {
  conflict: true;
  attemptId: string;
  existingTreeMode: TreeMode;
}

/**
 * Start (or resume) an attempt for a question. Creates a guest session if the
 * visitor isn't logged in, and refuses questions the visitor's tier can't reach.
 */
export async function startAttempt(
  questionId: string,
  requestedTreeMode?: TreeMode,
  opts: { abandonExisting?: boolean } = {},
): Promise<StartConflict | void> {
  const user = await getOrCreateGuest();

  const question = await db.question.findUnique({
    where: { id: questionId },
    include: { category: true },
  });
  // A war room is played, not answered: it has no interviewer, no tree and no
  // rubric, and `answerModeFor` calls it "qualitative" only because refusing to
  // answer would be worse than a documented default. Left unguarded, a request
  // carrying a war-room id created a real `Attempt` on it and fed the practice
  // rollups and the interview leaderboard with a run off a different rubric.
  // `startSimulation` has always refused the mirror image of this; the guard
  // existed in one direction only.
  //
  // Above the resume branch, unlike the tier gate below, and the difference is
  // the point. Resuming past a *type* error would let a row created before this
  // guard keep working, which makes the guard depend on there being none — and
  // there is no half-built practice attempt on a war room worth protecting
  // anyway.
  if (!question || isSimulation(question.type)) redirect("/library");

  // Resume an existing in-progress attempt if one exists.
  const existing = await db.attempt.findFirst({
    where: { userId: user.id, questionId, status: "in_progress" },
    orderBy: { createdAt: "desc" },
  });
  if (existing) {
    // Resuming used to happen before the requested mode was even read, so
    // asking for Guided on a question already open in Solo silently handed back
    // the Solo attempt — no guidance, no explanation. The tree mode is fixed at
    // creation and cannot be switched in place (that is what keeps "solo"
    // meaningful), so the only honest options are resume or start over, and
    // that is the candidate's call rather than ours.
    const conflicts = !!requestedTreeMode && existing.treeMode !== requestedTreeMode;
    if (!conflicts) redirect(`/practice/${existing.id}`);
    if (!opts.abandonExisting) {
      return {
        conflict: true,
        attemptId: existing.id,
        existingTreeMode: (existing.treeMode as TreeMode | null) ?? "solo",
      };
    }
    await db.attempt.update({
      where: { id: existing.id },
      data: { status: "abandoned" },
    });
  }

  // The gate, and the only one that counts — the locked card in the library is
  // a courtesy. Checked after the resume branch above on purpose: an attempt
  // already in progress stays openable even if the question is un-flagged
  // underneath it, because stranding someone's half-built tree to enforce a
  // merchandising decision is not a trade worth making.
  if (!canOpen(tierFor(user), question)) redirect(wallRedirect());

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
