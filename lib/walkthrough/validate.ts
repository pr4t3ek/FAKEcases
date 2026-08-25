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
 *
 * ## Two kinds, one posture
 *
 * A case has no number to land on, so it is checked against the two things its
 * question DOES author: the branches a good answer covers (`expectedBuckets`)
 * and, where the question declares one, the branch that actually holds the
 * problem (`rootCause`). Both are checked by calling `scoreDiagnosis` and
 * `labelMatches` from `lib/evaluation.ts` — literally the functions that grade a
 * real attempt, for the reason the numeric path calls `rollup`: a private copy
 * would let the example and the marking drift apart, and then the worked example
 * would be teaching a method the scorer punishes.
 */

import { rollup, type RollupNode } from "@/lib/framework-rollup";
import { labelMatches, scoreDiagnosis, type RootCause } from "@/lib/evaluation";
import { diagnosisTrail, type DiagnosisNode } from "@/lib/diagnosis";
import {
  walkthroughSchema,
  type CaseWalkthroughContent,
  type CaseWalkthroughStep,
  type NumericWalkthroughContent,
  type WalkthroughContent,
  type WalkthroughStep,
} from "./types";

/**
 * A question, as far as the validator needs to know one.
 *
 * Carries both kinds' fields rather than splitting into two interfaces: a caller
 * holds one question row and should not have to know which shape to build before
 * it can ask whether a walkthrough is publishable. Each path reads only its own.
 *
 * The case fields default so every existing numeric caller is unchanged.
 */
export interface ValidationTarget {
  idealLow: number | null;
  idealHigh: number | null;
  /** Branches a good answer reaches. A case cannot be published without them. */
  expectedBuckets?: string[];
  /** The branch that actually holds the problem, when the question declares one. */
  rootCause?: RootCause | null;
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

/**
 * Structural faults: duplicate keys, dangling parents, no root, forward references.
 *
 * Shared by both kinds and typed on the only fields it reads — every one of these
 * is a fault whether the node carries a number or a verdict, and a second copy
 * for cases would be the same twenty lines waiting to disagree.
 */
interface StructuralStep {
  node: { key: string; parentKey: string | null };
}

function structuralIssues(steps: StructuralStep[]): ValidationIssue[] {
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

  return parsed.data.kind === "case"
    ? validateCase(parsed.data, target)
    : validateNumeric(parsed.data, target);
}

/**
 * Does the chain land on the question's authored answer?
 *
 * The band is `idealLow…idealHigh` exactly, with no tolerance added. A
 * guesstimate's range is already generous — it is a band, not a point — and
 * widening it here would be quietly moving the goalposts for content that
 * exists to teach the method that hits it.
 */
function validateNumeric(
  content: NumericWalkthroughContent,
  target: ValidationTarget,
): ValidationResult {
  const steps = content.steps;
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

  // A question with no authored range has nothing to check the arithmetic
  // against, so it cannot carry a NUMERIC walkthrough. That is not the same as
  // carrying no walkthrough: a case is checked against its buckets and its root
  // cause instead — see `validateCase`.
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

/** Case steps as the diagnosis reader and the scorer both want them. */
export function toDiagnosisNodes(steps: CaseWalkthroughStep[]): DiagnosisNode[] {
  return steps.map((s) => ({
    id: s.node.key,
    parentId: s.node.parentKey,
    label: s.node.label,
    status: s.node.status,
  }));
}

/**
 * Does the marked-up tree teach what the question says the answer is?
 *
 * Three checks, and the order is worth keeping — each one's failure message is
 * only useful if the ones before it passed.
 *
 *   1. **Coverage.** Every branch the question says a good answer reaches has to
 *      appear. A worked example that skips one is teaching a tree the scorer
 *      will mark down, which is worse than teaching nothing.
 *   2. **It lands.** Where the question declares a root cause, the trail of
 *      `problem` marks has to reach it — the case equivalent of a chain hitting
 *      the authored number, and the reason `scoreDiagnosis` is called rather
 *      than re-derived.
 *   3. **It narrows.** A trail that stops at "Cost" has located a region, not a
 *      cause. `diagnosisTrail.complete` is the same flag the debrief reads.
 *
 * `total` is always null: there is nothing to add up, and returning a number
 * here would invite a reader to believe one had been checked.
 */
function validateCase(
  content: CaseWalkthroughContent,
  target: ValidationTarget,
): ValidationResult {
  const steps = content.steps;
  const issues = structuralIssues(steps);
  if (issues.length > 0) return { ok: false, issues, total: null };

  const buckets = (target.expectedBuckets ?? []).filter((b) => b.trim());

  // The mirror of "no ideal range" above: with nothing authored to cover, there
  // is no way to tell a good worked example from a plausible-sounding one.
  if (buckets.length === 0) {
    return {
      ok: false,
      total: null,
      issues: [
        {
          step: null,
          message: "This question lists no expected branches, so coverage cannot be checked.",
        },
      ],
    };
  }

  const missing = buckets.filter(
    (bucket) => !steps.some((s) => labelMatches(s.node.label, bucket)),
  );
  if (missing.length > 0) {
    return {
      ok: false,
      total: null,
      issues: [
        {
          step: null,
          message:
            `The tree never reaches ${missing.map((m) => `“${m}”`).join(", ")}. ` +
            `A worked example has to cover the branches this question is scored on.`,
        },
      ],
    };
  }

  const nodes = toDiagnosisNodes(steps);
  const trail = diagnosisTrail(nodes);

  if (target.rootCause) {
    // The scorer itself, with no transcript — `conversation` defaults to empty,
    // which zeroes only the `unevidenced` penalty. A walkthrough has no
    // conversation to be judged against, and everything else it computes is
    // exactly the question being asked here.
    const diagnosis = scoreDiagnosis(nodes, target.rootCause);

    if (diagnosis.falseClears.length > 0) {
      return {
        ok: false,
        total: null,
        issues: [
          {
            step: null,
            message:
              `This example clears ${diagnosis.falseClears.join(", ")}, but the answer runs ` +
              `through it. Teaching a false clear is the exact mistake the feedback warns about.`,
          },
        ],
      };
    }

    if (!diagnosis.landed) {
      return {
        ok: false,
        total: null,
        issues: [
          {
            step: null,
            message:
              `The trail never reaches ${target.rootCause.path.join(" → ")}. ` +
              `A worked case has to arrive at the cause it is teaching.`,
          },
        ],
      };
    }

    if (!trail.complete) {
      return {
        ok: false,
        total: null,
        issues: [
          {
            step: null,
            message:
              "The trail stops on a branch that still has children. Narrow to a leaf — " +
              "a case abandoned partway has located a region, not a cause.",
          },
        ],
      };
    }
  } else if (trail.paths.length === 0) {
    // No authored cause, so there is nothing to land on — but an issue tree with
    // no verdict at all is a list of headings, and watching one teaches the
    // structure without the skill.
    return {
      ok: false,
      total: null,
      issues: [
        {
          step: null,
          message: "No branch is marked as the problem — nothing in this example is diagnosed.",
        },
      ],
    };
  }

  return { ok: true, issues: [], total: null };
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
