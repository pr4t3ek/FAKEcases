"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { FEEDBACK_STATUSES } from "@/lib/types";
import {
  questionCoreSchema,
  refineQuestion,
  toQuestionColumns,
} from "@/lib/question-schema";

async function assertAdmin() {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") throw new Error("Forbidden");
}

/** The shared authoring contract, plus the category as the admin form names it. */
const questionSchema = questionCoreSchema
  .extend({ categoryId: z.string().min(1) })
  .superRefine(refineQuestion);

export interface SaveResult {
  ok: boolean;
  /** The first validation failure, phrased for the author. */
  error?: string;
}

/**
 * Validation failures are *returned*, not thrown.
 *
 * Next redacts a thrown Server Action error in production, so a throw would
 * reach the admin as "an error occurred" — useless when the actual problem is
 * "rootCause must be valid JSON" and the fix is one character. Only genuinely
 * exceptional things (not an admin, database down) still throw.
 */
function firstError(err: z.ZodError): string {
  const issue = err.issues[0];
  if (!issue) return "Save failed.";
  const field = issue.path.join(".");
  return field ? `${field}: ${issue.message}` : issue.message;
}

export async function createQuestion(input: unknown): Promise<SaveResult> {
  await assertAdmin();
  const parsed = questionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  await db.question.create({
    data: {
      ...toQuestionColumns(parsed.data),
      categoryId: parsed.data.categoryId,
      source: "admin",
    },
  });
  revalidatePath("/admin");
  revalidatePath("/library");
  return { ok: true };
}

export async function updateQuestion(id: string, input: unknown): Promise<SaveResult> {
  await assertAdmin();
  const parsed = questionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  await db.question.update({
    where: { id },
    data: { ...toQuestionColumns(parsed.data), categoryId: parsed.data.categoryId },
  });
  revalidatePath("/admin");
  revalidatePath("/library");
  return { ok: true };
}

export async function deleteQuestion(id: string) {
  await assertAdmin();
  await db.question.delete({ where: { id } });
  revalidatePath("/admin");
  revalidatePath("/library");
}

const categorySchema = z.object({
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/, "lowercase-with-hyphens"),
  name: z.string().min(2),
  icon: z.string().optional().default(""),
});

export async function createCategory(input: unknown) {
  await assertAdmin();
  const data = categorySchema.parse(input);
  const count = await db.category.count();
  await db.category.create({
    data: { slug: data.slug, name: data.name, icon: data.icon || null, order: count + 1 },
  });
  revalidatePath("/admin");
  revalidatePath("/library");
}

export async function setFeedbackStatus(id: string, status: string) {
  await assertAdmin();
  if (!FEEDBACK_STATUSES.includes(status as (typeof FEEDBACK_STATUSES)[number])) {
    throw new Error("Invalid status");
  }
  await db.questionFeedback.update({ where: { id }, data: { status } });
  revalidatePath("/admin");
}
