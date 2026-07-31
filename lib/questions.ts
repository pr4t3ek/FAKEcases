import { z } from "zod";
import { db } from "@/lib/db";
import { DIFFICULTIES, INTERVIEW_LEVELS } from "@/lib/types";

/** Single source of truth for question reads/writes + bulk import. */

export interface QuestionFilters {
  categorySlug?: string;
  difficulty?: string;
  interviewLevel?: string;
  search?: string;
  /** One of QUESTION_TYPES. Omitted means every practisable type. */
  type?: string;
}

/**
 * The types a candidate can actually practise today. `case` is reserved in
 * `QUESTION_TYPES` but has no runtime yet, so it stays out of the library rather
 * than offering a question that can't be answered.
 */
const PRACTISABLE_TYPES = ["guesstimate", "qualitative"];

export async function listCategories() {
  return db.category.findMany({ orderBy: { order: "asc" } });
}

export async function listQuestions(filters: QuestionFilters = {}) {
  const where: Record<string, unknown> = {
    type: filters.type ? filters.type : { in: PRACTISABLE_TYPES },
  };
  if (filters.categorySlug) {
    const cat = await db.category.findUnique({ where: { slug: filters.categorySlug } });
    if (cat) where.categoryId = cat.id;
  }
  if (filters.difficulty) where.difficulty = filters.difficulty;
  if (filters.interviewLevel) where.interviewLevel = filters.interviewLevel;
  if (filters.search) {
    where.OR = [
      { title: { contains: filters.search } },
      { prompt: { contains: filters.search } },
      { tags: { contains: filters.search } },
    ];
  }
  return db.question.findMany({
    where,
    include: { category: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function getQuestion(id: string) {
  return db.question.findUnique({ where: { id }, include: { category: true } });
}

/** Recommend questions, preferring the user's weak categories. */
export async function recommendQuestions(userId: string, limit = 3) {
  const progress = await db.progress.findUnique({ where: { userId } });
  const attempted = await db.attempt.findMany({
    where: { userId },
    select: { questionId: true },
  });
  const attemptedIds = new Set(attempted.map((a) => a.questionId));

  let weakCategoryId: string | undefined;
  if (progress) {
    try {
      const byCat = JSON.parse(progress.byCategory) as Record<string, { avg: number; count: number }>;
      const entries = Object.entries(byCat);
      if (entries.length) {
        entries.sort((a, b) => a[1].avg - b[1].avg);
        weakCategoryId = entries[0][0];
      }
    } catch {
      /* ignore */
    }
  }

  const pool = await db.question.findMany({
    where: {
      type: { in: PRACTISABLE_TYPES },
      id: { notIn: [...attemptedIds] },
      ...(weakCategoryId ? { categoryId: weakCategoryId } : {}),
    },
    include: { category: true },
    take: limit,
  });
  if (pool.length >= limit) return pool;

  // Top up with any unattempted questions.
  const extra = await db.question.findMany({
    where: {
      type: { in: PRACTISABLE_TYPES },
      id: { notIn: [...attemptedIds, ...pool.map((p) => p.id)] },
    },
    include: { category: true },
    take: limit - pool.length,
  });
  return [...pool, ...extra];
}

// ── Import ────────────────────────────────────────────────────────────────

export const questionImportSchema = z.object({
  title: z.string().min(3),
  prompt: z.string().min(5),
  category: z.string().min(1), // slug or name
  difficulty: z.enum(DIFFICULTIES),
  interviewLevel: z.enum(INTERVIEW_LEVELS),
  idealLow: z.coerce.number().nonnegative(),
  idealHigh: z.coerce.number().nonnegative(),
  unit: z.string().optional().default(""),
  betterApproach: z.string().min(3),
  sampleSolution: z.string().min(3),
  sourceUrl: z.string().url().optional().or(z.literal("")).optional(),
  externalId: z.string().optional(),
  tags: z.string().optional().default(""),
});

export type QuestionImportRow = z.infer<typeof questionImportSchema>;

export interface ImportRowError {
  row: number;
  errors: string[];
}
export interface ImportResult {
  created: number;
  updated: number;
  errors: ImportRowError[];
  validCount: number;
}

async function resolveCategoryId(ref: string): Promise<string | null> {
  const bySlug = await db.category.findUnique({ where: { slug: ref } });
  if (bySlug) return bySlug.id;
  const byName = await db.category.findFirst({
    where: { name: { equals: ref } },
  });
  return byName?.id ?? null;
}

/**
 * Validate + import rows. Dry-run mode validates and reports errors without
 * writing. Real run upserts by externalId (dedup) and tags source="import".
 */
export async function importQuestions(
  rawRows: unknown[],
  opts: { dryRun?: boolean } = {},
): Promise<ImportResult> {
  const errors: ImportRowError[] = [];
  const valid: { row: number; data: QuestionImportRow; categoryId: string }[] = [];

  for (let i = 0; i < rawRows.length; i++) {
    const parsed = questionImportSchema.safeParse(rawRows[i]);
    if (!parsed.success) {
      errors.push({
        row: i + 1,
        errors: parsed.error.issues.map((e) => `${e.path.join(".") || "row"}: ${e.message}`),
      });
      continue;
    }
    const categoryId = await resolveCategoryId(parsed.data.category);
    if (!categoryId) {
      errors.push({ row: i + 1, errors: [`Unknown category "${parsed.data.category}"`] });
      continue;
    }
    if (parsed.data.idealHigh < parsed.data.idealLow) {
      errors.push({ row: i + 1, errors: ["idealHigh must be ≥ idealLow"] });
      continue;
    }
    valid.push({ row: i + 1, data: parsed.data, categoryId });
  }

  let created = 0;
  let updated = 0;

  if (!opts.dryRun) {
    for (const { data, categoryId } of valid) {
      const externalId = data.externalId?.trim() || undefined;
      const payload = {
        title: data.title,
        prompt: data.prompt,
        categoryId,
        difficulty: data.difficulty,
        interviewLevel: data.interviewLevel,
        idealLow: data.idealLow,
        idealHigh: data.idealHigh,
        unit: data.unit || null,
        betterApproach: data.betterApproach,
        sampleSolution: data.sampleSolution,
        tags: data.tags || null,
        sourceUrl: data.sourceUrl || null,
        source: "import" as const,
      };
      if (externalId) {
        const existing = await db.question.findUnique({ where: { externalId } });
        if (existing) {
          await db.question.update({ where: { externalId }, data: payload });
          updated++;
        } else {
          await db.question.create({ data: { ...payload, externalId } });
          created++;
        }
      } else {
        await db.question.create({ data: payload });
        created++;
      }
    }
  }

  return { created, updated, errors, validCount: valid.length };
}
