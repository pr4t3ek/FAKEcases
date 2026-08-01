import { z } from "zod";
import { NODE_ORIGINS, NODE_STATUSES } from "@/lib/types";

/**
 * Validation for a saved framework tree.
 *
 * Lives apart from the server action that uses it so it can be unit-tested like
 * the rest of the rule functions — the action imports `server-only` transitively
 * and can't be pulled into a test.
 */

/**
 * Bounds on a saved tree. Not a security boundary so much as a blast radius: the
 * payload is whatever the client posts, and an autosave loop that goes wrong
 * shouldn't be able to write an unbounded number of rows.
 */
export const MAX_NODES = 300;
const MAX_LABEL = 200;
const MAX_TEXT = 2_000;

const text = (max: number) => z.string().max(max).nullish();

const frameworkNodeSchema = z.object({
  id: z.string().min(1).max(64),
  parentId: z.string().max(64).nullable(),
  label: z.string().max(MAX_LABEL),
  value: text(MAX_LABEL),
  multiplier: text(MAX_LABEL),
  combine: z.enum(["sum", "multiply"]),
  status: z.enum(NODE_STATUSES).nullish(),
  note: text(MAX_TEXT),
  sourceMessageId: z.string().max(64).nullish(),
  origin: z.enum(NODE_ORIGINS).nullish(),
});

/**
 * Every `parentId` must name a node in the same payload.
 *
 * This is the failure that actually happens — a client-side bug leaves a child
 * pointing at a branch it already dropped — and it used to surface as a foreign
 * key error *after* the delete had gone through, taking the tree with it.
 * Rejecting up front means a malformed save changes nothing.
 */
export const frameworkSchema = z
  .array(frameworkNodeSchema)
  .max(MAX_NODES)
  .superRefine((nodes, ctx) => {
    const ids = new Set(nodes.map((n) => n.id));
    if (ids.size !== nodes.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Duplicate node id" });
    }
    for (const n of nodes) {
      if (n.parentId && !ids.has(n.parentId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Node "${n.id}" points at a parent that isn't in this save`,
        });
      }
      if (n.parentId === n.id) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Node "${n.id}" is its own parent` });
      }
    }
  });

export type FrameworkNodePayload = z.input<typeof frameworkNodeSchema>;
export type FrameworkPayload = z.output<typeof frameworkSchema>;
