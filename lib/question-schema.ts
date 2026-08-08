import { z } from "zod";
import {
  AUTHORABLE_TYPES,
  DIFFICULTIES,
  INTERVIEW_LEVELS,
  SECTORS,
  answerModeFor,
} from "@/lib/types";

/**
 * The authoring contract for a question, shared by the admin panel and the
 * CSV/JSON importer.
 *
 * One schema for both, because they write the same row and drifting apart is how
 * you end up with a field you can import but not edit. The admin form names its
 * category by id and the importer by slug, so that single field is layered on top
 * rather than living here.
 *
 * A question is either a guesstimate, which ends in a number and needs an ideal
 * range, or a case, which ends in a recommendation and needs a tree to be graded
 * against. The refinement below is what stops one being saved with the other's
 * fields — the previous schema required an ideal range unconditionally, so
 * editing a case through the form stamped a fabricated 0–0 range onto it.
 */

/** `{ "path": ["Cost", "Delivery cost"], "note": "…" }` — see Question.rootCause. */
export const rootCauseSchema = z.object({
  path: z.array(z.string().trim().min(1)).min(1, "rootCause.path needs at least one branch"),
  note: z.string().optional(),
});

/** `[{ "topic": ["cost"], "fact": "…" }]` — see Question.dataPack. */
export const dataPackSchema = z.array(
  z.object({
    topic: z.array(z.string().trim().min(1)).min(1, "each dataPack entry needs a topic"),
    fact: z.string().trim().min(1, "each dataPack entry needs a fact"),
  }),
);

const blank = (v: unknown) => v === "" || v === null || v === undefined;

/**
 * A number that may legitimately be absent.
 *
 * `z.coerce.number()` turns "" into 0, which is exactly how a blank ideal-range
 * field became a real 0 in the database. Blanks are mapped to undefined first.
 */
const optionalNumber = z.preprocess(
  (v) => (blank(v) ? undefined : v),
  z.coerce.number().nonnegative().optional(),
);

const optionalText = z.preprocess(
  (v) => (blank(v) ? "" : v),
  z.string().trim().default(""),
);

/**
 * A JSON column authored as text. Blank means "not set"; anything else has to
 * parse *and* match the shape, so a typo is a save error rather than a feature
 * that silently doesn't work. A malformed `rootCause` used to disable diagnosis
 * scoring with no indication that anything was wrong.
 */
function jsonField<T extends z.ZodTypeAny>(shape: T, label: string) {
  return z.unknown().transform((raw, ctx): z.infer<T> | null => {
    if (blank(raw)) return null;

    let value: unknown = raw;
    if (typeof raw === "string") {
      try {
        value = JSON.parse(raw);
      } catch {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${label} must be valid JSON` });
        return z.NEVER;
      }
    }

    const result = shape.safeParse(value);
    if (!result.success) {
      for (const issue of result.error.issues) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${label}: ${issue.path.join(".") || "value"} ${issue.message}`,
        });
      }
      return z.NEVER;
    }
    return result.data;
  });
}

/**
 * A list authored either as a JSON array or, because a spreadsheet cell can't
 * hold one comfortably, as a `|`-separated line.
 */
const stringList = z.preprocess((v) => {
  if (blank(v)) return [];
  if (Array.isArray(v)) return v;
  if (typeof v !== "string") return v;
  const trimmed = v.trim();
  if (trimmed.startsWith("[")) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed; // fall through to the array check and fail with a clear message
    }
  }
  return trimmed
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
}, z.array(z.string().trim().min(1)).default([]));

export const questionCoreSchema = z.object({
  title: z.string().trim().min(3),
  prompt: z.string().trim().min(5),
  difficulty: z.enum(DIFFICULTIES),
  interviewLevel: z.enum(INTERVIEW_LEVELS),
  // Optional, unlike the seed's required field: a question authored without a
  // sector is a question that is simply not reachable from that filter, which
  // is a smaller failure than refusing the row outright — and it keeps every
  // existing CSV, which has no such column, importable unchanged.
  sector: z.preprocess((v) => (blank(v) ? undefined : v), z.enum(SECTORS).optional()),
  // AUTHORABLE_TYPES, not QUESTION_TYPES: a `simulation` row is a catalogue
  // entry whose exercise is authored in code, so one created through this
  // contract would have no scenario behind it and would be inert. Refusing it
  // here is what lets `refineQuestion` below assume an interview type.
  type: z.enum(AUTHORABLE_TYPES).default("guesstimate"),

  // Guesstimate-only. Enforced by the refinement below, not by the field.
  idealLow: optionalNumber,
  idealHigh: optionalNumber,
  unit: optionalText,

  // Case-only. Likewise.
  framework: optionalText,
  expectedBuckets: stringList,
  dataPack: jsonField(dataPackSchema, "dataPack"),
  rootCause: jsonField(rootCauseSchema, "rootCause"),

  betterApproach: z.string().trim().min(3),
  sampleSolution: z.string().trim().min(3),
  tags: optionalText,
});

export type QuestionCore = z.infer<typeof questionCoreSchema>;

/**
 * Cross-field rules. Split out so both the admin schema and the import schema
 * apply exactly the same ones after adding their own category field.
 */
export function refineQuestion(data: QuestionCore, ctx: z.RefinementCtx): void {
  const at = (path: keyof QuestionCore, message: string) =>
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });

  if (answerModeFor(data.type) === "numeric") {
    if (data.idealLow === undefined) at("idealLow", "A guesstimate needs an ideal low");
    if (data.idealHigh === undefined) at("idealHigh", "A guesstimate needs an ideal high");
    if (
      data.idealLow !== undefined &&
      data.idealHigh !== undefined &&
      data.idealHigh < data.idealLow
    ) {
      at("idealHigh", "idealHigh must be ≥ idealLow");
    }
    if (data.rootCause) at("rootCause", "A guesstimate has no root cause to declare");
    if (data.expectedBuckets.length) {
      at("expectedBuckets", "expectedBuckets applies to cases, not guesstimates");
    }
  } else {
    // A case ends in a recommendation, so an ideal range would be scored by
    // nothing and read as authored fact by anyone editing the row later.
    if (data.idealLow !== undefined || data.idealHigh !== undefined) {
      at("idealLow", "A case has no ideal range — leave these blank");
    }
  }
}

/** Map validated input to the Question columns, serialising the JSON ones. */
export function toQuestionColumns(data: QuestionCore) {
  const numeric = answerModeFor(data.type) === "numeric";
  return {
    title: data.title,
    prompt: data.prompt,
    difficulty: data.difficulty,
    interviewLevel: data.interviewLevel,
    sector: data.sector ?? null,
    type: data.type,
    idealLow: numeric ? (data.idealLow ?? null) : null,
    idealHigh: numeric ? (data.idealHigh ?? null) : null,
    unit: data.unit || null,
    framework: data.framework || null,
    expectedBuckets: data.expectedBuckets.length ? JSON.stringify(data.expectedBuckets) : null,
    dataPack: data.dataPack ? JSON.stringify(data.dataPack) : null,
    rootCause: data.rootCause ? JSON.stringify(data.rootCause) : null,
    betterApproach: data.betterApproach,
    sampleSolution: data.sampleSolution,
    tags: data.tags || null,
  };
}
