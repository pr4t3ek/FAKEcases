/**
 * Client → server payload validation.
 *
 * This *is* a trust boundary, so unlike `./validate.ts` it uses Zod. A disabled
 * button and a greyed-out card are courtesies to an honest candidate; the rules
 * that decide a score have to be re-checked here, against the scenario, on every
 * write.
 *
 * The scenario-dependent checks — does this cause exist, does this allocation
 * fit the budget — can't live in a static schema, so each export is a factory
 * that closes over the scenario.
 */

import { z } from "zod";
import { simConfig } from "@/lib/config/simulation";
import { allocationFits } from "./outcome";
import type { CauseId, SimAllocationLine, SimScenario } from "./types";

/** Sprints are whole units of team time; a third of a sprint is not a thing. */
const sprintCount = z.number().int().min(0);
/** Rupees are absolute, non-negative and finite. */
const rupeeAmount = z.number().min(0).finite();

export const allocationLineSchema = z.object({
  interventionId: z.string().min(1),
  sprints: sprintCount,
  rupees: rupeeAmount,
});

export type AllocationLineInput = z.infer<typeof allocationLineSchema>;

/** Message shared by both schemas, so the two cannot drift apart. */
const NOT_A_LEAF = "Name the specific cause, not the area it sits in";

/**
 * The causes a run may actually name: leaves only.
 *
 * A root is an *area* — the heading a group of branches sits under, not a
 * hypothesis. Naming one used to earn `ancestorCredit` (55%) for free, and while
 * the Observe picker never offered roots, nothing here stopped a hand-rolled
 * request from claiming it. The Commit picker did offer them, as "Somewhere in
 * {area}", which read as a duplicate of the heading directly above it.
 *
 * Enforcing it here rather than in the UI is the point: this file is the trust
 * boundary, and the picker is a courtesy.
 */
function leafCauseIds(scenario: SimScenario): Set<CauseId> {
  const parents = new Set(scenario.causes.map((c) => c.parentId).filter(Boolean));
  return new Set(scenario.causes.filter((c) => !parents.has(c.id)).map((c) => c.id));
}

/**
 * The suspects named at the end of Observe.
 *
 * Capped at `maxSuspects`, because an uncapped list is not a hypothesis —
 * naming every branch guarantees a hit and predicts nothing.
 */
export function hypothesisSchema(scenario: SimScenario) {
  const known = new Set(scenario.causes.map((c) => c.id));
  const leaves = leafCauseIds(scenario);
  return z
    .array(z.string().min(1))
    .min(1, "Name at least one suspect")
    .max(simConfig.maxSuspects, `Name at most ${simConfig.maxSuspects}`)
    .refine((ids) => new Set(ids).size === ids.length, "Duplicate suspect")
    // Before the leaf check, so an unknown id is reported as unknown rather
    // than as an area — `firstIssue` only surfaces one.
    .refine((ids) => ids.every((id) => known.has(id)), "Unknown cause")
    .refine((ids) => ids.every((id) => leaves.has(id)), NOT_A_LEAF);
}

/** The causes named at Commit. Same shape, its own cap. */
export function diagnosisSchema(scenario: SimScenario) {
  const known = new Set(scenario.causes.map((c) => c.id));
  const leaves = leafCauseIds(scenario);
  return z
    .array(z.string().min(1))
    .min(1, "Name at least one cause")
    .max(simConfig.maxCausesNamed, `Name at most ${simConfig.maxCausesNamed}`)
    .refine((ids) => new Set(ids).size === ids.length, "Duplicate cause")
    .refine((ids) => ids.every((id) => known.has(id)), "Unknown cause")
    .refine((ids) => ids.every((id) => leaves.has(id)), NOT_A_LEAF);
}

export function allocationSchema(scenario: SimScenario) {
  const known = new Set(scenario.interventions.map((i) => i.id));
  return z
    .array(allocationLineSchema)
    .min(1, "Fund at least one intervention")
    .refine(
      (lines) => lines.every((l) => known.has(l.interventionId)),
      "Unknown intervention",
    )
    .refine(
      (lines) => new Set(lines.map((l) => l.interventionId)).size === lines.length,
      "Duplicate intervention",
    )
    .refine(
      (lines) => lines.every((l) => l.sprints > 0 || l.rupees > 0),
      "An intervention funded with nothing should be left out instead",
    )
    .refine((lines) => allocationFits(scenario, lines), "Allocation exceeds the available capacity");
}

export interface CommitInput {
  diagnosis: CauseId[];
  allocation: SimAllocationLine[];
}

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid input";
}

export function parseHypothesis(
  scenario: SimScenario,
  raw: unknown,
): ParseResult<CauseId[]> {
  const result = hypothesisSchema(scenario).safeParse(raw);
  return result.success
    ? { ok: true, value: result.data }
    : { ok: false, error: firstIssue(result.error) };
}

export function parseCommit(scenario: SimScenario, raw: unknown): ParseResult<CommitInput> {
  const shape = z.object({
    diagnosis: diagnosisSchema(scenario),
    allocation: allocationSchema(scenario),
  });
  const result = shape.safeParse(raw);
  return result.success
    ? { ok: true, value: result.data }
    : { ok: false, error: firstIssue(result.error) };
}
