import { z } from "zod";
import { db } from "@/lib/db";
import { attemptStateFromRows, type AttemptQuestionState } from "@/lib/attempt-state";
import { tierAccess, type AccessTier } from "@/lib/config";
import { targetLevelsFor } from "@/lib/profile";
import {
  questionCoreSchema,
  refineQuestion,
  toQuestionColumns,
} from "@/lib/question-schema";
import {
  DIFFICULTIES,
  PRACTICE_TYPES,
  SECTORS,
  SIMULATION_TYPE,
  isSimulation,
  type QuestionSurface,
  type Sector,
} from "@/lib/types";

/** Single source of truth for question reads/writes + bulk import. */

export interface QuestionFilters {
  categorySlug?: string;
  /** A `SECTORS` value — the industry axis, independent of `categorySlug`. */
  sector?: string;
  difficulty?: string;
  interviewLevel?: string;
  search?: string;
  /** Defaults to the practice catalogue. */
  surface?: QuestionSurface;
  /**
   * Narrows *within* the surface — one of `PRACTICE_TYPES`. Ignored on the
   * simulation surface, which holds exactly one type.
   */
  type?: string;
}

/**
 * See `PRACTISABLE_TYPES` in lib/types — `case` stays out of the library until it
 * has a runtime. Spread into mutable arrays for Prisma's `in` filter.
 */
const practice: string[] = [...PRACTICE_TYPES];

/**
 * The types a surface may show, as a Prisma filter.
 *
 * One definition, two readers — `listQuestions` and `listCategories`. They have
 * to agree: a category is worth offering exactly when it holds something the
 * grid beneath it can render, and deriving that from a second copy of the rule
 * is how the two drift into offering a filter that always returns nothing.
 */
function typeFilterFor(surface: QuestionSurface = "practice") {
  return surface === "simulation" ? SIMULATION_TYPE : { in: practice };
}

/**
 * The categories worth offering on a surface.
 *
 * Surface-aware because the vocabulary is shared but the catalogues are not.
 * Every war room is filed under `product-management` and no practice question
 * is, so a surface-blind list offered "Product Management" on `/library` — a
 * filter that could only ever render "No questions match your filters", since
 * the type constraint excludes the only rows in it. Asking the database which
 * categories actually have something to show is both the fix and the guarantee
 * it stays fixed as content moves.
 */
export async function listCategories(surface: QuestionSurface = "practice") {
  return db.category.findMany({
    where: { questions: { some: { type: typeFilterFor(surface) } } },
    orderBy: { order: "asc" },
  });
}

/**
 * The sectors worth offering on a surface, in vocabulary order.
 *
 * Surface-aware for exactly the reason `listCategories` is, and the omission was
 * live: three sectors (Technology, Manufacturing, Energy) are carried only by
 * war rooms, so a static `SECTORS` list gave `/library` three options that could
 * only ever render the empty state — the same defect as the "Product Management"
 * category, reintroduced one dropdown to the left.
 *
 * Ordered by `SECTORS` rather than by what the query happened to return, so the
 * control reads identically on both surfaces.
 */
export async function listSectors(surface: QuestionSurface = "practice"): Promise<Sector[]> {
  const rows = await db.question.findMany({
    where: { type: typeFilterFor(surface), sector: { not: null } },
    select: { sector: true },
    distinct: ["sector"],
  });
  const present = new Set(rows.map((r) => r.sector));
  return SECTORS.filter((s) => present.has(s));
}

export async function listQuestions(filters: QuestionFilters = {}) {
  // The surface decides the type set; `type` only narrows inside it, and can
  // never be used to pull a war room into the practice catalogue.
  const where: Record<string, unknown> = {
    type:
      filters.surface !== "simulation" && filters.type && practice.includes(filters.type)
        ? filters.type
        : typeFilterFor(filters.surface),
  };
  if (filters.categorySlug) {
    const cat = await db.category.findUnique({ where: { slug: filters.categorySlug } });
    if (cat) where.categoryId = cat.id;
  }
  if (filters.sector) where.sector = filters.sector;
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

  // Easiest first on the simulation surface. Creation order put NukkadEats at
  // the front, which meant a beginner opening the track landed on the hardest
  // scenario in it. Sorted here rather than by a column, because the running
  // order of a track is a presentation decision and does not belong in the data.
  //
  // (This used to hoist simulations above everything else, back when they shared
  // a page with the practice questions and creation order buried the newest
  // format at the bottom of a thirty-card grid. Their own route settles that.)
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

/**
 * Recommend questions, preferring the user's weak categories.
 *
 * `tier` is required rather than defaulted: recommending something the user
 * cannot open is a worse failure than not recommending at all, and a default
 * would make the safe case the one you have to remember to ask for. It is
 * inert today — the dashboard turns guests away at the door — but it is the
 * surface that would start handing out locked cards the moment `free` becomes
 * a restricted tier.
 */
export async function recommendQuestions(userId: string, tier: AccessTier, limit = 3) {
  const reachable = tierAccess[tier].content === "all" ? {} : { freeTier: true };
  const targets = await targetLevelsFor(userId);
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

  // Preference passes, each topping up the last and stopping as soon as there
  // are enough. The target-level passes are skipped entirely when no goals are
  // set, which makes this a no-op for anyone who never filled in a profile —
  // the property that makes personalising the list safe to turn on.
  //
  // The level is a separate pass rather than another clause on the weak-category
  // query on purpose: the intersection is often empty, and ANDing them would
  // then fall through to a query with no level signal left in it.
  const picked: Awaited<ReturnType<typeof takeQuestions>> = [];
  const seen = new Set<string>();

  async function takeQuestions(where: Record<string, unknown>, take: number) {
    return db.question.findMany({
      where: {
        // Practice only. This strip sits on the dashboard beside the practice
        // stats and links into `startAttempt`; dropping a four-phase war room
        // into it offered the two as interchangeable, and the card that
        // appeared did not behave like its neighbours.
        type: { in: practice },
        id: { notIn: [...attemptedIds, ...seen] },
        ...reachable,
        ...where,
      },
      include: { category: true },
      take,
    });
  }

  async function pass(where: Record<string, unknown>) {
    if (picked.length >= limit) return;
    const rows = await takeQuestions(where, limit - picked.length);
    for (const row of rows) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      picked.push(row);
    }
  }

  const atTarget = targets.length ? { interviewLevel: { in: targets } } : null;

  // Sharpest first: what they're weakest at, at the level they're aiming for.
  if (atTarget && weakCategoryId) await pass({ ...atTarget, categoryId: weakCategoryId });
  if (atTarget) await pass(atTarget);
  if (weakCategoryId) await pass({ categoryId: weakCategoryId });
  await pass({});

  return picked;
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

/**
 * Per-question attempt state for one user, for the library cards.
 *
 * The thin DB half of `lib/attempt-state.ts` — one query for the whole grid
 * rather than one per card, which is why it returns a map keyed by question id.
 * `evaluation` is selected because the badge shows the best score, and because
 * an attempt with a null overall must not contribute one.
 */
export async function attemptStateByQuestion(
  userId: string,
): Promise<Record<string, AttemptQuestionState>> {
  const rows = await db.attempt.findMany({
    where: { userId },
    select: {
      id: true,
      questionId: true,
      status: true,
      createdAt: true,
      evaluation: { select: { overall: true } },
    },
  });
  return attemptStateFromRows(rows);
}
