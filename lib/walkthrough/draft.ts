/**
 * Turning a question's `sampleSolution` into a first draft.
 *
 * ## Why this parses rather than prompts
 *
 * The plan called for an LLM to draft these. The repo's LLM adapter
 * (`lib/llm/types.ts`) is not shaped for it: it exposes `reply(ctx)` and
 * `hint(ctx, level)` over an `InterviewerContext` built from an attempt, its
 * messages and its question. There is no general "complete this" entry point,
 * and inventing a fake attempt to borrow one would put a second, practice-shaped
 * code path into `lib/llm` to serve an admin script.
 *
 * The objection to parsing was that a mis-parse would teach a wrong method. That
 * objection is about content reaching STUDENTS, and nothing here does:
 *
 *   1. Output lands as `status: "draft"`, which is never served.
 *   2. A human edits it in the admin panel.
 *   3. `validateWalkthrough` refuses to publish a chain that misses the
 *      question's own authored range.
 *
 * So this is a typing shortcut for a reviewer, not a content pipeline. It is
 * deliberately conservative: where it cannot tell what a fragment means it
 * leaves the prose in `because` for a human to rewrite, rather than guessing.
 *
 * If a real drafting model is wanted later, it replaces this one function and
 * nothing else — the draft/review/validate path around it does not change.
 */

import type { NumericWalkthroughContent, WalkthroughStep } from "./types";

/** "~65%" -> "65%", "~1.3 cr" -> "1.3cr", "1.5 cups/day" -> "1.5". */
function figureIn(fragment: string): { value: string; isShare: boolean } | null {
  const share = fragment.match(/(\d+(?:\.\d+)?)\s*%/);
  if (share) return { value: `${share[1]}%`, isShare: true };

  const magnitude = fragment.match(/(\d+(?:\.\d+)?)\s*(cr|crore|lakh|k)\b/i);
  if (magnitude) {
    const unit = magnitude[2].toLowerCase().startsWith("cr") ? "cr" : magnitude[2].toLowerCase();
    return { value: `${magnitude[1]}${unit}`, isShare: false };
  }

  const plain = fragment.match(/(\d+(?:\.\d+)?)/);
  return plain ? { value: plain[1], isShare: false } : null;
}

/** A short label from a fragment, with the numbers stripped back out. */
function labelIn(fragment: string): string {
  const words = fragment
    .replace(/[≈~=→]/g, " ")
    .replace(/\d+(?:\.\d+)?\s*(cr|crore|lakh|k|%)?/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const short = words.split(/[,;]/)[0].trim();
  return (short || "Step").slice(0, 60).replace(/^\w/, (c) => c.toUpperCase());
}

/**
 * A draft chain from the arrow-notation every guesstimate already carries.
 *
 * Guesstimates only. There is no case analogue and inventing one would mean
 * guessing which branch holds a problem, which is the whole exercise.
 *
 * Returns null when the prose yields fewer than two usable figures — better no
 * draft than a one-node "walkthrough" a reviewer has to delete.
 */
export function draftFromSampleSolution(args: {
  title: string;
  sampleSolution: string;
}): NumericWalkthroughContent | null {
  const fragments = args.sampleSolution
    .split(/[→;]/)
    .map((f) => f.trim())
    .filter(Boolean);

  const steps: WalkthroughStep[] = [];
  let rootKey: string | null = null;

  for (const fragment of fragments) {
    const figure = figureIn(fragment);
    if (!figure) continue;

    const key = `s${steps.length + 1}`;
    // The first absolute figure anchors the tree; everything after hangs off it.
    const isRoot = rootKey === null && !figure.isShare;

    steps.push({
      say: `TODO — what to say before this step. Parsed from: “${fragment}”`.slice(0, 240),
      node: {
        key,
        parentKey: isRoot ? null : rootKey,
        label: labelIn(fragment),
        value: figure.value,
        multiplier: "",
        combine: "sum",
      },
      because: `TODO — why this number. Parsed from: “${fragment}”`.slice(0, 240),
    });

    if (isRoot) rootKey = key;
    if (steps.length >= 8) break;
  }

  if (steps.length < 2 || rootKey === null) return null;

  return {
    // Numeric by construction: this parses arrow-notation arithmetic, which a
    // case does not have. Cases are authored by hand — see `content.ts`.
    kind: "numeric",
    intro:
      `TODO — how to introduce this example. It solves: ${args.title}`.slice(0, 400),
    steps,
    outro: "TODO — what the student should take away.".slice(0, 400),
  };
}
