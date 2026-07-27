import {
  evaluationCategories,
  readinessForScore,
  accuracyTolerance,
  type ReadinessBand,
} from "@/lib/config";
import { clamp } from "@/lib/utils";
import type { AssumptionRating, FeedbackItem } from "@/lib/types";

export interface FrameworkNodeInput {
  label: string;
  value?: string | null;
  multiplier?: string | null;
}

export interface DerivedAssumption {
  /** Where the figure came from — the step's label, or that it was said aloud. */
  key: string;
  value: string;
  rating: AssumptionRating;
  source: "framework" | "chat";
}

export interface EvaluationInput {
  idealLow: number | null;
  idealHigh: number | null;
  betterApproach: string;
  sampleSolution: string;
  finalEstimate: number | null;
  framework: FrameworkNodeInput[];
  calculationCount: number;
  userMessageText: string[]; // just the user turns' text
  hintsUsed: number;
}

export interface EvaluationResult {
  overall: number;
  readiness: ReadinessBand;
  scores: {
    structuring: number;
    logic: number;
    segmentation: number;
    assumptions: number;
    calculation: number;
    communication: number;
    business: number;
    confidence: number;
  };
  accuracyHit: boolean;
  feedback: FeedbackItem[];
}

type Accuracy = "hit" | "near" | "far" | "none";

function computeAccuracy(final: number | null, low: number | null, high: number | null): Accuracy {
  if (final == null || low == null || high == null) return "none";
  if (final >= low && final <= high) return "hit";
  const nearLow = low / accuracyTolerance.nearFactor;
  const nearHigh = high * accuracyTolerance.nearFactor;
  if (final >= nearLow && final <= nearHigh) return "near";
  return "far";
}

const SEGMENT_KEYWORDS = ["segment", "split", "adult", "child", "urban", "rural", "age", "%", "percent", "tier", "income"];
const BUSINESS_KEYWORDS = ["institutional", "seasonal", "monsoon", "b2b", "bulk", "competition", "corporate", "wholesale", "replacement", "festival", "tourist"];

function textHas(haystacks: string[], words: string[]): boolean {
  const t = haystacks.join(" ").toLowerCase();
  return words.some((w) => t.includes(w));
}

/** Heuristic auto-rating for a single stated figure. */
export function rateAssumption(
  key: string,
  value: string,
): { rating: AssumptionRating; note: string } {
  const v = value.trim();
  const hasNumber = /\d/.test(v);
  const hasJustification = /(because|since|based|assume|avg|average|data|study|report|roughly|approx|per )/i.test(v);

  if (!v) {
    return { rating: "Weak", note: "Empty — give this assumption a concrete value." };
  }
  if (hasNumber && hasJustification) {
    return { rating: "Excellent", note: "Quantified and justified — exactly what an interviewer wants." };
  }
  if (hasNumber) {
    return {
      rating: "Reasonable",
      note: "Has a number, but add a one-line rationale for where it comes from.",
    };
  }
  return {
    rating: "NeedsJustification",
    note: "No figure yet — put a number to it and justify the basis.",
  };
}

/** A clause is worth reading as a claim only once it commits to a figure. */
function quantifiedFragments(text: string): string[] {
  return text
    .split(/[.!?;\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && /\d/.test(s));
}

/**
 * The numbers a candidate actually committed to, read back off their own work
 * rather than a separate list they had to keep by hand: every figure in the
 * framework tree, plus every quantified claim in what they said.
 *
 * The split in rating is deliberate. A tree box holds a figure but has nowhere
 * to record *why*, so a step's value is quantified at best — "Excellent" has to
 * be earned by explaining the number in the conversation, which is what an
 * interviewer is actually listening for.
 */
export function deriveAssumptions(args: {
  framework: FrameworkNodeInput[];
  userMessageText: string[];
}): DerivedAssumption[] {
  const out: DerivedAssumption[] = [];

  for (const node of args.framework) {
    const label = node.label.trim() || "Step";
    for (const [field, raw] of [
      ["value", node.value],
      ["rate", node.multiplier],
    ] as const) {
      const v = raw?.trim();
      if (!v) continue;
      const { rating } = rateAssumption(label, v);
      out.push({
        key: field === "rate" ? `${label} (rate)` : label,
        value: v,
        // Capped: the tree can't carry a rationale, so it can't earn Excellent.
        rating: rating === "Excellent" ? "Reasonable" : rating,
        source: "framework",
      });
    }
  }

  for (const message of args.userMessageText) {
    for (const fragment of quantifiedFragments(message)) {
      out.push({
        key: "Said in chat",
        value: fragment,
        rating: rateAssumption("", fragment).rating,
        source: "chat",
      });
    }
  }

  return out;
}

export function evaluate(input: EvaluationInput): EvaluationResult {
  const {
    framework,
    calculationCount,
    userMessageText,
    hintsUsed,
    finalEstimate,
    idealLow,
    idealHigh,
  } = input;

  const frameworkCount = framework.length;
  const assumptions = deriveAssumptions({ framework, userMessageText });

  const assumptionCount = assumptions.length;
  // Quantified is the floor, justified is the prize — see deriveAssumptions.
  const quantified = assumptions.filter(
    (a) => a.rating === "Excellent" || a.rating === "Reasonable",
  ).length;
  const justified = assumptions.filter((a) => a.rating === "Excellent").length;
  const weakAssumptions = assumptions.filter((a) => a.rating === "Weak").length;
  const quantifiedRatio = assumptionCount ? quantified / assumptionCount : 0;
  const justifiedRatio = assumptionCount ? justified / assumptionCount : 0;

  const hasSegmentation =
    frameworkCount >= 2 ||
    textHas([...framework.map((f) => f.label), ...userMessageText], SEGMENT_KEYWORDS);
  const businessNuance = textHas(userMessageText, BUSINESS_KEYWORDS);
  const accuracy = computeAccuracy(finalEstimate, idealLow, idealHigh);
  const userMsgCount = userMessageText.length;

  const structuring = clamp(
    40 + Math.min(frameworkCount, 5) * 11 + (hasSegmentation ? 8 : 0),
    30,
    95,
  );
  const segmentation = clamp(
    (hasSegmentation ? 68 : 36) + Math.min(frameworkCount, 4) * 5,
    28,
    95,
  );
  const logic = clamp(
    50 +
      (frameworkCount >= 2 ? 15 : 0) +
      (calculationCount > 0 ? 12 : 0) +
      (assumptionCount >= 2 ? 8 : 0),
    30,
    92,
  );
  // Derived figures are far more numerous than the handful people used to log
  // by hand, so the count contribution is capped and most of the headroom sits
  // in justifying them — otherwise a filled-in tree alone would max this out.
  const assumptionsScore = clamp(
    35 +
      Math.min(assumptionCount, 6) * 5 +
      quantifiedRatio * 15 +
      justifiedRatio * 25 -
      weakAssumptions * 8,
    25,
    95,
  );
  const calculation =
    accuracy === "hit"
      ? clamp(80 + (calculationCount > 0 ? 8 : 0), 70, 95)
      : accuracy === "near"
        ? accuracyTolerance.nearScore
        : accuracy === "far"
          ? accuracyTolerance.farScore
          : calculationCount > 0
            ? 52
            : 40;
  const communication = clamp(45 + Math.min(userMsgCount, 6) * 7, 35, 90);
  const business = clamp(
    48 + (hasSegmentation ? 8 : 0) + (businessNuance ? 20 : 0),
    30,
    92,
  );
  const confidence = clamp(80 - hintsUsed * 12 + (finalEstimate != null ? 8 : 0), 30, 92);

  const scores = {
    structuring,
    logic,
    segmentation,
    assumptions: assumptionsScore,
    calculation,
    communication,
    business,
    confidence,
  };

  // Weighted overall using config weights.
  let weightedSum = 0;
  let weightTotal = 0;
  for (const cat of evaluationCategories) {
    const s = scores[cat.key];
    weightedSum += s * cat.weight;
    weightTotal += cat.weight;
  }
  const overall = Math.round(weightedSum / weightTotal);

  const feedback = buildFeedback({
    hasSegmentation,
    weakAssumptions,
    assumptionCount,
    quantifiedRatio,
    justifiedRatio,
    accuracy,
    hintsUsed,
    calculationCount,
    businessNuance,
    betterApproach: input.betterApproach,
  });

  return {
    overall,
    readiness: readinessForScore(overall),
    scores,
    accuracyHit: accuracy === "hit",
    feedback,
  };
}

function buildFeedback(args: {
  hasSegmentation: boolean;
  weakAssumptions: number;
  assumptionCount: number;
  quantifiedRatio: number;
  justifiedRatio: number;
  accuracy: Accuracy;
  hintsUsed: number;
  calculationCount: number;
  businessNuance: boolean;
  betterApproach: string;
}): FeedbackItem[] {
  const items: FeedbackItem[] = [];

  items.push(
    args.hasSegmentation
      ? { tone: "positive", text: "Strong segmentation — you broke the problem into meaningful pieces before estimating." }
      : { tone: "warning", text: "You jumped toward a number without segmenting. Break the population into groups that behave differently." },
  );

  // The three states worth distinguishing: no numbers at all, numbers with no
  // stated basis, and numbers you actually defended.
  if (args.assumptionCount === 0) {
    items.push({ tone: "warning", text: "You never committed to a number. Put figures on your steps and say what each one is based on." });
  } else if (args.justifiedRatio >= 0.3) {
    items.push({ tone: "positive", text: "You said where your numbers came from, not just what they were — that's what makes an estimate defensible." });
  } else if (args.quantifiedRatio >= 0.6) {
    items.push({ tone: "tip", text: "Your figures are all there, but you rarely said where they came from. Talk through the basis for your biggest drivers." });
  }
  if (args.weakAssumptions > 0) {
    items.push({ tone: "warning", text: "Some steps held something that isn't a usable figure — every box should carry a number you can defend." });
  }

  switch (args.accuracy) {
    case "hit":
      items.push({ tone: "positive", text: "Your final estimate landed within a sensible range. Good calibration." });
      break;
    case "near":
      items.push({ tone: "tip", text: "You were close but outside the ideal range — recheck one or two driver assumptions." });
      break;
    case "far":
      items.push({ tone: "warning", text: "Your final estimate was well off. Sanity-check your biggest driver and your rounding." });
      break;
    case "none":
      items.push({ tone: "tip", text: "You didn't lock a final estimate. Always land on a number and state it as a range." });
      break;
  }

  if (args.calculationCount === 0) {
    items.push({ tone: "tip", text: "Show explicit calculations — use the calculator so your arithmetic is visible and checkable." });
  }
  if (args.hintsUsed === 0) {
    items.push({ tone: "positive", text: "You worked through it without hints — great independence." });
  }
  items.push(
    args.businessNuance
      ? { tone: "positive", text: "Nice business instinct — you considered demand nuances beyond the base case." }
      : { tone: "tip", text: "Add business judgement: think about institutional, seasonal or bulk demand you might be missing." },
  );

  if (args.betterApproach) {
    items.push({ tone: "tip", text: `A consultant's angle: ${args.betterApproach}` });
  }
  return items;
}
