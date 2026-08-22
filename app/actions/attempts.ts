"use server";

import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getOrCreateGuest, getSessionUser } from "@/lib/auth";
import { dailyGrantFor } from "@/lib/daily-unlock";
import { canOpen, tierFor, wallRedirect } from "@/lib/entitlements";
import { interviewerReply, isRealProvider } from "@/lib/llm";
import { recordLlmCall } from "@/lib/llm/budget";
import { toQuestionContext } from "@/lib/question-context";
import { roomGrantFor, seatFor } from "@/lib/rooms";
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

  // Resume an existing in-progress attempt if one exists. Solo ones only — see
  // `findResumableAttempt`.
  const existing = await findResumableAttempt(user.id, questionId, null);
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
  // The daily unlock is what opens anything at all now that the catalogue is
  // locked, and it is account-only — `dailyGrantFor` returns NO_GRANT for a
  // guest, which is the single line that makes "sign up to practise" true.
  const grant = await dailyGrantFor(user);
  if (!canOpen(tierFor(user), question, grant)) redirect(wallRedirect());

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
  const attemptId = await openAttempt({
    userId: user.id,
    question,
    treeMode,
    roomId: null,
  });

  redirect(`/practice/${attemptId}`);
}

/**
 * The newest unfinished attempt on this question in this sitting, or null.
 *
 * **`roomId` is a real `IS NULL` filter when it is null**, not "any room by
 * omission" — the symmetry `findResumableRun` spells out, for the same two
 * failures. Unscoped, a student who worked the class guesstimate would find that
 * attempt reopened the next time they picked the question off the library
 * (outside the room, against a question their tier may not open), and a room
 * would adopt a half-built tree from last week as the class exercise.
 */
async function findResumableAttempt(
  userId: string,
  questionId: string,
  roomId: string | null,
) {
  return db.attempt.findFirst({
    where: { userId, questionId, roomId, status: "in_progress" },
    orderBy: { createdAt: "desc" },
    select: { id: true, treeMode: true },
  });
}

/**
 * Create the attempt and seed the interviewer's opening turn.
 *
 * Extracted so the library entry point and the classroom one cannot drift on
 * either — the same reason, and the same shape, as `openSimulationRun` in
 * `app/actions/simulations.ts`. An attempt that skipped the seed would open on
 * an empty chat, which reads as a broken screen rather than as a missing
 * courtesy.
 *
 * Deliberately not exported, and deliberately not a gate: both callers gate
 * before they reach it, each with the grant its own surface derives.
 */
async function openAttempt(args: {
  userId: string;
  question: Prisma.QuestionGetPayload<{ include: { category: true } }>;
  treeMode: TreeMode | null;
  roomId: string | null;
}): Promise<string> {
  const { userId, question, treeMode, roomId } = args;

  const attempt = await db.attempt.create({
    data: {
      userId,
      questionId: question.id,
      mode: "interviewer",
      status: "in_progress",
      treeMode,
      roomId,
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

  return attempt.id;
}

/**
 * Work the guesstimate a classroom is running.
 *
 * The practice-side twin of `startRoomRun`, and it takes only the code for the
 * reason that one gives: the question is DERIVED from the room, so there is no
 * client-supplied id to cross-check against it and no forgery path to keep
 * getting right forever.
 */
export async function startRoomAttempt(code: string): Promise<void> {
  // Not `getOrCreateGuest`: a seat implies a row already exists, and minting one
  // here would silently create an account for someone who never joined.
  const user = await getSessionUser();
  if (!user) redirect(`/join/${code}`);

  const seated = await seatFor(user.id, code);
  if (!seated) redirect(`/join/${code}`);
  const { room } = seated;

  // A war room is played, not answered — the guard `startAttempt` states at
  // length, here so a room opened on one can never mint a practice attempt
  // against a rubric it was not written for.
  if (isSimulation(room.question.type)) redirect(`/room/${code}`);

  // Resume BEFORE the gate, matching `startAttempt` and `startRoomRun`. A room
  // closed while a student was ten minutes into their tree must not strand it.
  const resumable = await findResumableAttempt(user.id, room.questionId, room.id);
  if (resumable) redirect(`/practice/${resumable.id}`);

  // The control, and the same call the room page rendered its button from —
  // with the same derivation, which is what keeps the button and the gate
  // honest. A closed room fails here because `roomGrantFor` counts only open
  // ones, so there is no separate status check for a future caller to forget.
  const grant = await roomGrantFor(user.id);
  if (!canOpen(tierFor(user), room.question, grant)) redirect(`/room/${code}`);

  // The room's question, re-read with its category because the interviewer's
  // opening turn needs it. `loadRoom` includes the question but not that.
  const question = await db.question.findUnique({
    where: { id: room.questionId },
    include: { category: true },
  });
  if (!question) redirect(`/room/${code}`);

  // Solo, always. Guided is a deliberate choice made on a library card, and the
  // room page offers one button rather than two — a class working the same
  // question needs to be working the same exercise.
  const attemptId = await openAttempt({
    userId: user.id,
    question,
    treeMode: answerModeFor(question.type) === "qualitative" ? "solo" : null,
    roomId: room.id,
  });

  redirect(`/practice/${attemptId}`);
}
