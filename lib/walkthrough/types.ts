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
 * Pure and DB-free, so `validate.ts`, the seed and the admin form all read the
 * same definitions.
 */

import { z } from "zod";

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

export const walkthroughSchema = z.object({
  /** Shown once at the start, framing the example as somebody else's question. */
  intro: z.string().trim().min(1).max(400),
  steps: z.array(walkthroughStepSchema).min(2).max(10),
  /** The closing line, after the total lands. */
  outro: z.string().trim().min(1).max(400),
});

export type WalkthroughNode = z.infer<typeof walkthroughNodeSchema>;
export type WalkthroughStep = z.infer<typeof walkthroughStepSchema>;
export type WalkthroughContent = z.infer<typeof walkthroughSchema>;

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
