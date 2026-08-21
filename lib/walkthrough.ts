/**
 * Data access for worked examples.
 *
 * Everything that touches Prisma for a walkthrough goes through here, so
 * `lib/walkthrough/` stays pure and the validator can be exercised by a test
 * with no database anywhere near it — the same split `lib/rooms.ts` and
 * `lib/arena.ts` keep.
 */

import "server-only";

import { db } from "@/lib/db";
import { loadTextSettings } from "@/lib/settings";
import { parseWalkthrough, type WalkthroughContent } from "@/lib/walkthrough/types";
import { validateWalkthrough } from "@/lib/walkthrough/validate";

export interface DemoWalkthrough {
  questionId: string;
  title: string;
  prompt: string;
  unit: string | null;
  content: WalkthroughContent;
}

/**
 * The published walkthrough a first-timer should see, or null.
 *
 * Null is a perfectly ordinary answer and every caller must handle it: the
 * setting can name a question that does not exist, or one whose walkthrough is
 * still a draft. Both mean "no worked example today", which is a quieter
 * failure than a half-rendered overlay.
 *
 * Re-validated on read rather than trusted. The row was checked when it was
 * published, but the QUESTION's ideal range can be edited afterwards from the
 * admin panel — and a walkthrough that no longer reaches its own question's
 * answer is precisely the thing this feature must never show a beginner.
 */
export async function loadDemoWalkthrough(): Promise<DemoWalkthrough | null> {
  const { walkthroughDemoQuestion } = await loadTextSettings();
  if (!walkthroughDemoQuestion.trim()) return null;

  const question = await db.question.findUnique({
    where: { externalId: walkthroughDemoQuestion.trim() },
    select: {
      id: true,
      title: true,
      prompt: true,
      unit: true,
      idealLow: true,
      idealHigh: true,
      walkthrough: { select: { stepsJson: true, status: true } },
    },
  });

  if (!question?.walkthrough || question.walkthrough.status !== "published") return null;

  const content = parseWalkthrough(question.walkthrough.stepsJson);
  if (!content) return null;

  const check = validateWalkthrough(content, {
    idealLow: question.idealLow,
    idealHigh: question.idealHigh,
  });
  if (!check.ok) return null;

  return {
    questionId: question.id,
    title: question.title,
    prompt: question.prompt,
    unit: question.unit,
    content,
  };
}

/** Every walkthrough, for the admin list. */
export async function listWalkthroughs() {
  return db.walkthrough.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      question: {
        select: { id: true, externalId: true, title: true, idealLow: true, idealHigh: true, unit: true },
      },
    },
  });
}

export async function loadWalkthroughFor(questionId: string) {
  return db.walkthrough.findUnique({
    where: { questionId },
    include: { question: { select: { idealLow: true, idealHigh: true, title: true, unit: true } } },
  });
}

/**
 * Write a draft. Publishing is a separate action on purpose — saving must never
 * be the thing that puts content in front of a student.
 */
export async function saveDraft(args: {
  questionId: string;
  content: WalkthroughContent;
  source: "llm" | "admin";
}): Promise<void> {
  const stepsJson = JSON.stringify(args.content);
  await db.walkthrough.upsert({
    where: { questionId: args.questionId },
    create: { questionId: args.questionId, stepsJson, source: args.source, status: "draft" },
    // Status is deliberately reset: an edit to a published walkthrough sends it
    // back for review rather than going live under its old approval.
    update: { stepsJson, source: args.source, status: "draft" },
  });
}

export async function setStatus(questionId: string, status: "draft" | "published"): Promise<void> {
  await db.walkthrough.update({ where: { questionId }, data: { status } });
}

export async function deleteWalkthrough(questionId: string): Promise<void> {
  await db.walkthrough.deleteMany({ where: { questionId } });
}
