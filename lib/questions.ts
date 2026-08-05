import { z } from "zod";
import { db } from "@/lib/db";
import {
  questionCoreSchema,
  refineQuestion,
  toQuestionColumns,
} from "@/lib/question-schema";
import { DIFFICULTIES, PRACTISABLE_TYPES, isSimulation } from "@/lib/types";

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
 * See `PRACTISABLE_TYPES` in lib/types — `case` stays out of the library until it
 * has a runtime. Spread into a mutable array for Prisma's `in` filter.
 */
const practisable: string[] = [...PRACTISABLE_TYPES];

export async function listCategories() {
  return db.category.findMany({ orderBy: { order: "asc" } });
}

export async function listQuestions(filters: QuestionFilters = {}) {
  const where: Record<string, unknown> = {
    type: filters.type ? filters.type : { in: practisable },
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
  const questions = await db.question.findMany({
    where,
    include: { category: true },
    orderBy: { createdAt: "asc" },
  });

  // Simulations were seeded last, so creation order buried the newest format at
  // the bottom of a thirty-card page — the least discoverable thing in the app
  // was the thing we most wanted people to try.
  //
  // Within them, easiest first. Creation order put NukkadEats at the front,
  // which meant a beginner opening the track landed on the hardest scenario in
  // it. Sorted here rather than by a column, because "show the new format
  // first, gently" is a presentation decision and does not belong in the data.
  const sims = questions
    .filter((q) => isSimulation(q.type))
    .sort((a, b) => difficultyRank(a.difficulty) - difficultyRank(b.difficulty));

  return [...sims, ...questions.filter((q) => !isSimulation(q.type))];
}

function difficultyRank(difficulty: string): number {
  const order = DIFFICULTIES.indexOf(difficulty as (typeof DIFFICULTIES)[number]);
  return order === -1 ? DIFFICULTIES.length : order;
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
  // A simulation never creates an Attempt, so counting only those would keep
  // recommending a war room the candidate has already played through.
  const simmed = await db.simRun.findMany({
    where: { userId },
    select: { questionId: true },
  });
  const attemptedIds = new Set([
    ...attempted.map((a) => a.questionId),
    ...simmed.map((s) => s.questionId),
  ]);

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
      type: { in: practisable },
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
      type: { in: practisable },
      id: { notIn: [...attemptedIds, ...pool.map((p) => p.id)] },
    },
    include: { category: true },
    take: limit - pool.length,
  });
  return [...pool, ...extra];
}

// ── Import ────────────────────────────────────────────────────────────────

/**
 * The shared authoring contract, plus the fields only a bulk import has: the
 * category named by slug or name rather than id, and the provenance columns used
 * to dedupe re-imports.
 */
export const questionImportSchema = questionCoreSchema
  .extend({
    category: z.string().min(1), // slug or name
    sourceUrl: z.string().url().optional().or(z.literal("")).optional(),
    externalId: z.string().optional(),
  })
  .superRefine(refineQuestion);

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
    // The ideal-range ordering check now lives in `refineQuestion`, alongside the
    // rule about which question types have a range at all.
    valid.push({ row: i + 1, data: parsed.data, categoryId });
  }

  let created = 0;
  let updated = 0;

  if (!opts.dryRun) {
    for (const { data, categoryId } of valid) {
      const externalId = data.externalId?.trim() || undefined;
      const payload = {
        ...toQuestionColumns(data),
        categoryId,
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
