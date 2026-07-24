"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { DIFFICULTIES, INTERVIEW_LEVELS, FEEDBACK_STATUSES } from "@/lib/types";

async function assertAdmin() {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") throw new Error("Forbidden");
}

const questionSchema = z.object({
  title: z.string().min(3),
  prompt: z.string().min(5),
  categoryId: z.string().min(1),
  difficulty: z.enum(DIFFICULTIES),
  interviewLevel: z.enum(INTERVIEW_LEVELS),
  idealLow: z.coerce.number().nonnegative(),
  idealHigh: z.coerce.number().nonnegative(),
  unit: z.string().optional().default(""),
  betterApproach: z.string().min(3),
  sampleSolution: z.string().min(3),
  tags: z.string().optional().default(""),
});

export async function createQuestion(input: unknown) {
  await assertAdmin();
  const data = questionSchema.parse(input);
  await db.question.create({
    data: {
      title: data.title,
      prompt: data.prompt,
      categoryId: data.categoryId,
      difficulty: data.difficulty,
      interviewLevel: data.interviewLevel,
      idealLow: data.idealLow,
      idealHigh: data.idealHigh,
      unit: data.unit || null,
      betterApproach: data.betterApproach,
      sampleSolution: data.sampleSolution,
      tags: data.tags || null,
      source: "admin",
    },
  });
  revalidatePath("/admin");
  revalidatePath("/library");
}

export async function updateQuestion(id: string, input: unknown) {
  await assertAdmin();
  const data = questionSchema.parse(input);
  await db.question.update({
    where: { id },
    data: {
      title: data.title,
      prompt: data.prompt,
      categoryId: data.categoryId,
      difficulty: data.difficulty,
      interviewLevel: data.interviewLevel,
      idealLow: data.idealLow,
      idealHigh: data.idealHigh,
      unit: data.unit || null,
      betterApproach: data.betterApproach,
      sampleSolution: data.sampleSolution,
      tags: data.tags || null,
    },
  });
  revalidatePath("/admin");
  revalidatePath("/library");
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
