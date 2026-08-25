/**
 * What a worked example is made of.
 *
 * One step reveals one node of the tree, with its boxes already filled, plus
 * two lines of prose: what the narrator says before it appears, and why that
 * particular number. The second is the whole point — a student who copies the
 * arithmetic has learned nothing, and a student who understands why two in
 * three Bangaloreans drink tea can build the next one alone.
 *
 * `node` deliberately mirrors the real builder's value model rather than
 * inventing a friendlier one: a root holds an absolute ("1.3cr"), a child holds
 * a share ("65") and optionally a rate ("1.5"). What the student watches is
 * therefore literally what they will type, in the same boxes.
 *
 * ## Two kinds, because there are two exercises
 *
 * A guesstimate is worked by building an arithmetic chain; a case is worked by
 * MARKING an issue tree — clearing branches, naming one as the problem, and
 * narrowing inside it. Those are different gestures on the same canvas, so a
 * step reveals either a value or a verdict, never both.
 *
 * They are a discriminated union rather than one loose shape with everything
 * optional, and the reason is the gate in `validate.ts`: a numeric walkthrough
 * is only publishable if its chain reaches the question's authored answer, and a
 * shape where `value` was optional would let a case slip through that check by
 * simply not having one. The tag makes the two sets of rules unmixable.
 *
 * Pure and DB-free, so `validate.ts`, the seed and the admin form all read the
 * same definitions.
 */

import { z } from "zod";

import { NODE_STATUSES } from "@/lib/types";

export const WALKTHROUGH_STATUSES = ["draft", "published"] as const;
export type WalkthroughStatus = (typeof WALKTHROUGH_STATUSES)[number];

export const WALKTHROUGH_SOURCES = ["llm", "admin"] as const;
export type WalkthroughSource = (typeof WALKTHROUGH_SOURCES)[number];

/**
 * Keys are author-facing strings ("pop", "drinkers") rather than generated ids,
 * because a human editing a drafted walkthrough has to be able to point a child
 * at its parent by name. They are resolved to node ids at render time.
 */
export const walkthroughNodeSchema = z.object({
  key: z.string().trim().min(1).max(40),
  parentKey: z.string().trim().min(1).max(40).nullable(),
  label: z.string().trim().min(1).max(80),
  /** The value box. Root: an absolute. Child: a share, 0–100. */
  value: z.string().trim().max(24).default(""),
  /** The × box — a per-segment rate. Blank means 1. */
  multiplier: z.string().trim().max(24).default(""),
  combine: z.enum(["sum", "multiply"]).default("sum"),
});

export const walkthroughStepSchema = z.object({
  /** Said before the node appears. One sentence. */
  say: z.string().trim().min(1).max(240),
  node: walkthroughNodeSchema,
  /** Why this number. The assumption, not the arithmetic. */
  because: z.string().trim().min(1).max(240),
});

/**
 * A case node: the same identity fields, and a verdict where the numbers were.
 *
 * `status` is the real builder's own vocabulary (`NODE_STATUSES`), not a
 * friendlier copy, for the reason the numeric node mirrors the value boxes —
 * what a student watches has to be what they will do. "Healthy" eliminates a
 * branch, "problem" says the cause is somewhere inside it, and the difference
 * between those two claims is most of the exercise.
 */
export const caseNodeSchema = z.object({
  key: z.string().trim().min(1).max(40),
  parentKey: z.string().trim().min(1).max(40).nullable(),
  label: z.string().trim().min(1).max(80),
  /**
   * Required, with no default, and `unknown` written out where a node is
   * deliberately left unexamined.
   *
   * A default would be the friendlier choice and it hides a real failure: zod
   * strips unknown keys, so a NUMERIC walkthrough mis-tagged as a case would
   * parse cleanly into a tree where every node defaulted to "unknown" — a
   * silent reinterpretation of somebody's content rather than an error. Making
   * the verdict explicit is also right on its own terms: on a case the mark IS
   * the answer, so leaving one out should never be something an author does by
   * omission.
   */
  status: z.enum(NODE_STATUSES),
});

export const caseStepSchema = z.object({
  say: z.string().trim().min(1).max(240),
  node: caseNodeSchema,
  /**
   * Why this verdict. Carries more weight than its numeric twin: on a
   * guesstimate `because` justifies a number, here it justifies ELIMINATING a
   * branch, which is the move a beginner gets wrong and the one worth watching.
   */
  because: z.string().trim().min(1).max(240),
});

const numericWalkthroughSchema = z.object({
  kind: z.literal("numeric"),
  /** Shown once at the start, framing the example as somebody else's question. */
  intro: z.string().trim().min(1).max(400),
  steps: z.array(walkthroughStepSchema).min(2).max(10),
  /** The closing line, after the total lands. */
  outro: z.string().trim().min(1).max(400),
});

const caseWalkthroughSchema = z.object({
  kind: z.literal("case"),
  intro: z.string().trim().min(1).max(400),
  steps: z.array(caseStepSchema).min(2).max(10),
  /** The closing line, after the cause is named. */
  outro: z.string().trim().min(1).max(400),
});

/**
 * Every walkthrough written before cases existed is stored without a `kind`, and
 * `discriminatedUnion` needs the tag present to choose a branch — so an untagged
 * object is read as the numeric one it was.
 *
 * A default on the field would not do it: zod resolves the discriminant before
 * it applies defaults, so an untagged row fails to match any member and the
 * error names neither. Injecting it here is the difference between every
 * existing walkthrough surviving the change and all of them disappearing.
 */
export const walkthroughSchema = z.preprocess((raw) => {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return raw;
  return "kind" in raw ? raw : { ...raw, kind: "numeric" };
}, z.discriminatedUnion("kind", [numericWalkthroughSchema, caseWalkthroughSchema]));

export type WalkthroughNode = z.infer<typeof walkthroughNodeSchema>;
export type WalkthroughStep = z.infer<typeof walkthroughStepSchema>;
export type CaseWalkthroughNode = z.infer<typeof caseNodeSchema>;
export type CaseWalkthroughStep = z.infer<typeof caseStepSchema>;

export type NumericWalkthroughContent = z.infer<typeof numericWalkthroughSchema>;
export type CaseWalkthroughContent = z.infer<typeof caseWalkthroughSchema>;
export type WalkthroughContent = z.infer<typeof walkthroughSchema>;

/**
 * Narrowing helper, so callers read `isCaseWalkthrough(content)` rather than
 * comparing string literals in a dozen components.
 */
export function isCaseWalkthrough(
  content: WalkthroughContent,
): content is CaseWalkthroughContent {
  return content.kind === "case";
}

/** Parse stored JSON. Null rather than throwing — a bad row must not take out a page. */
export function parseWalkthrough(raw: string | null | undefined): WalkthroughContent | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = walkthroughSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function isWalkthroughStatus(value: string): value is WalkthroughStatus {
  return (WALKTHROUGH_STATUSES as readonly string[]).includes(value);
}
