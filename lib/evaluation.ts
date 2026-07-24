import {
  evaluationCategories,
  readinessForScore,
  accuracyTolerance,
  type ReadinessBand,
} from "@/lib/config";
import { clamp } from "@/lib/utils";
import type { AssumptionRating, FeedbackItem } from "@/lib/types";

export interface EvaluationInput {
  idealLow: number | null;
  idealHigh: number | null;
  betterApproach: string;
  sampleSolution: string;
  finalEstimate: number | null;
  frameworkCount: number;
  assumptions: { value: string; rating?: string | null }[];
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

/** Heuristic auto-rating for a single assumption (used by the assumption panel). */
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

export function evaluate(input: EvaluationInput): EvaluationResult {
  const {
    frameworkCount,
    assumptions,
    calculationCount,
    userMessageText,
    hintsUsed,
    finalEstimate,
    idealLow,
    idealHigh,
  } = input;

  const assumptionCount = assumptions.length;
  const goodAssumptions = assumptions.filter(
    (a) => a.rating === "Excellent" || a.rating === "Reasonable",
  ).length;
  const weakAssumptions = assumptions.filter((a) => a.rating === "Weak").length;
  const goodRatio = assumptionCount ? goodAssumptions / assumptionCount : 0;

  const hasSegmentation =
    frameworkCount >= 2 ||
    textHas(
      [...assumptions.map((a) => a.value), ...userMessageText],
      SEGMENT_KEYWORDS,
    );
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
  const assumptionsScore = clamp(
    40 + assumptionCount * 8 + goodRatio * 25 - weakAssumptions * 8,
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
    goodRatio,
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
  goodRatio: number;
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

  if (args.goodRatio >= 0.6) {
    items.push({ tone: "positive", text: "Your assumptions were mostly quantified and reasonable, which makes your logic auditable." });
  }
  if (args.weakAssumptions > 0) {
    items.push({ tone: "warning", text: "Some assumptions lacked justification — always state where each number comes from." });
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
