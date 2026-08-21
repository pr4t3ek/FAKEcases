/**
 * Proving a worked example is actually right.
 *
 * This is the gate, and it is the reason the whole feature is safe to ship. A
 * walkthrough is the first arithmetic a beginner ever sees on this platform,
 * and one whose chain does not reach its own question's authored answer would
 * teach a wrong method — confidently, to exactly the people least able to spot
 * it. So a walkthrough that misses cannot be published.
 *
 * The same posture the repo already takes with content it cannot eyeball:
 * `checkBalance` brute-forces a war room's allocations rather than trusting the
 * author's claim, and `validateScenario` refuses a scenario that breaks its own
 * difficulty rules. Content is verified, not asserted.
 *
 * Crucially it computes with `lib/framework-rollup.ts` — the SAME function the
 * builder uses. A private copy of the arithmetic here would let the two drift,
 * and the walkthrough's entire promise is that what a student watches is what
 * the builder will compute when they type it themselves.
 */

import { rollup, type RollupNode } from "@/lib/framework-rollup";
import { walkthroughSchema, type WalkthroughContent, type WalkthroughStep } from "./types";

/** A question, as far as the validator needs to know one. */
export interface ValidationTarget {
  idealLow: number | null;
  idealHigh: number | null;
}

export interface ValidationIssue {
  /** Step index the problem is attached to, or null for a whole-walkthrough fault. */
  step: number | null;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
  /** What the chain actually comes to, or null when it cannot be computed. */
  total: number | null;
}

/**
 * Steps as a tree the roll-up can read.
 *
 * Exported because the player renders from exactly this — so the picture on
 * screen and the number the validator checked come from one conversion, not
 * two.
 */
export function toNodes(steps: WalkthroughStep[]): (RollupNode & { label: string })[] {
  return steps.map((s) => ({
    id: s.node.key,
    parentId: s.node.parentKey,
    label: s.node.label,
    value: s.node.value,
    multiplier: s.node.multiplier,
    combine: s.node.combine,
  }));
}

/** Structural faults: duplicate keys, dangling parents, no root, forward references. */
function structuralIssues(steps: WalkthroughStep[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seen = new Set<string>();

  steps.forEach((step, i) => {
    const { key, parentKey } = step.node;

    if (seen.has(key)) {
      issues.push({ step: i, message: `Two steps share the key "${key}".` });
    }
    // A parent must already have appeared. Steps are revealed in order, so a
    // child whose parent comes later would pop onto the canvas attached to
    // nothing — the one failure a student would actually see.
    if (parentKey !== null && !seen.has(parentKey)) {
      issues.push({
        step: i,
        message: `"${key}" hangs off "${parentKey}", which no earlier step introduces.`,
      });
    }
    if (parentKey === key) {
      issues.push({ step: i, message: `"${key}" is its own parent.` });
    }
    seen.add(key);
  });

  if (!steps.some((s) => s.node.parentKey === null)) {
    issues.push({ step: null, message: "No step starts a branch — one must have no parent." });
  }
  return issues;
}

/**
 * Does the chain land on the question's authored answer?
 *
 * The band is `idealLow…idealHigh` exactly, with no tolerance added. A
 * guesstimate's range is already generous — it is a band, not a point — and
 * widening it here would be quietly moving the goalposts for content that
 * exists to teach the method that hits it.
 */
export function validateWalkthrough(
  content: unknown,
  target: ValidationTarget,
): ValidationResult {
  const parsed = walkthroughSchema.safeParse(content);
  if (!parsed.success) {
    return {
      ok: false,
      total: null,
      issues: parsed.error.issues.map((i) => ({
        step: null,
        message: `${i.path.join(".") || "walkthrough"}: ${i.message}`,
      })),
    };
  }

  const steps = parsed.data.steps;
  const issues = structuralIssues(steps);
  if (issues.length > 0) return { ok: false, issues, total: null };

  const { roots } = rollup(toNodes(steps));
  const total = roots.reduce((a, b) => a + b, 0);

  if (!Number.isFinite(total) || total <= 0) {
    return {
      ok: false,
      total: null,
      issues: [{ step: null, message: "The chain does not compute to a usable number." }],
    };
  }

  // A question with no authored range is a case, not a guesstimate — there is
  // nothing to check the arithmetic against, so it cannot carry a walkthrough
  // of this kind at all. Refusing is honest; passing it silently would let an
  // unverifiable example through the one gate that exists to stop them.
  if (target.idealLow === null || target.idealHigh === null) {
    return {
      ok: false,
      total,
      issues: [
        { step: null, message: "This question has no ideal range, so a chain cannot be checked." },
      ],
    };
  }

  if (total < target.idealLow || total > target.idealHigh) {
    return {
      ok: false,
      total,
      issues: [
        {
          step: null,
          message:
            `The chain comes to ${format(total)}, outside this question's ` +
            `${format(target.idealLow)}–${format(target.idealHigh)}. ` +
            `A worked example has to reach the answer it is teaching.`,
        },
      ],
    };
  }

  return { ok: true, issues: [], total };
}

/** Indian-notation short form, matching how the questions themselves are written. */
function format(n: number): string {
  const inr = (x: number) => x.toLocaleString("en-IN", { maximumFractionDigits: 2 });
  if (n >= 1e7) return `${inr(n / 1e7)} cr`;
  if (n >= 1e5) return `${inr(n / 1e5)} lakh`;
  return inr(n);
}

/** May this be published? The admin action's single question. */
export function canPublish(
  content: WalkthroughContent | null,
  target: ValidationTarget,
): boolean {
  return content !== null && validateWalkthrough(content, target).ok;
}
