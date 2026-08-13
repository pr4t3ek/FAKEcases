import {
  categoryWeight,
  evaluationCategories,
  readinessForScore,
  accuracyTolerance,
  type ReadinessBand,
} from "@/lib/config";
import { branchDiscussed, diagnosisTrail, type DiagnosisNode } from "@/lib/diagnosis";
import { clamp } from "@/lib/utils";
import type { AnswerMode, AssumptionRating, FeedbackItem, TreeMode } from "@/lib/types";

export interface FrameworkNodeInput {
  label: string;
  value?: string | null;
  multiplier?: string | null;
  /** Qualitative fields. Absent on numeric attempts. */
  id?: string;
  parentId?: string | null;
  status?: string | null;
  note?: string | null;
  sourceMessageId?: string | null;
  origin?: string | null;
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
  /** The candidate asked Teacher mode to work the problem — see `solutionWasRevealed`. */
  solutionRevealed?: boolean;
}

/**
 * Did the candidate have the solution walked through for them?
 *
 * Teacher mode is the one AI mode whose prompt explicitly solves the problem
 * ("showing the reasoning and a sample estimate" — `lib/llm/prompts.ts`), so an
 * attempt that used it is not the same exercise as one that didn't. The signal is
 * read back off the persisted turns rather than tracked separately, for the same
 * reason assumptions are derived rather than hand-kept: there is only one place
 * for it to drift out of sync with, and that place is the transcript itself.
 *
 * Only an *assistant* turn counts. Selecting the mode and changing your mind
 * before a reply arrives reveals nothing, and shouldn't be charged for.
 */
export function solutionWasRevealed(
  messages: { role: string; mode?: string | null }[],
): boolean {
  return messages.some((m) => m.role === "assistant" && m.mode === "teacher");
}

/**
 * What a walked-through solution costs, in Confidence points.
 *
 * Pitched at the full hint ladder (3 × `HINT_PENALTY`) because it buys strictly
 * more: the hints escalate but never state the answer, while Teacher mode is the
 * answer. Charging less would leave "exhaust the hints, then ask Teacher" as the
 * cheapest route through the app, which is precisely backwards.
 *
 * This is no longer what enforces that rule — a revealed attempt has no overall
 * at all now, so there is no total for a penalty to be diluted into. It survives
 * because Confidence is still shown per-category on the report, and an attempt
 * that was walked through genuinely did not demonstrate any. Diagnostic, not a
 * price.
 */
const HINT_PENALTY = 12;
const SOLUTION_REVEAL_PENALTY = 36;

/**
 * A null score means "this category was never in play for this attempt", which
 * is a different claim from zero and has to survive into the database as one.
 * Calculation is null on a case with no arithmetic; diagnosis is null when the
 * question declares no root cause. Scoring a category the attempt could not have
 * earned would drag the overall down for a reason the candidate can't act on.
 */
export interface EvaluationScores {
  structuring: number | null;
  logic: number;
  segmentation: number | null;
  assumptions: number;
  calculation: number | null;
  diagnosis: number | null;
  communication: number;
  business: number;
  confidence: number;
}

/**
 * A null `overall` means the attempt was not scored at all.
 *
 * Teacher mode states the answer, so an attempt that used it has no performance
 * left to measure — there is nothing to put a number on, and a number put on it
 * anyway would travel into interview readiness, percentile rank and the
 * leaderboard as though it had been earned. Distinct from a low score, and the
 * reason every aggregate downstream filters on `overall != null`.
 *
 * The per-category `scores` are still computed and still shown: they are the
 * teaching, and the report is where the candidate reads it. What they are not is
 * a measurement, so nothing aggregates them either.
 */
export interface EvaluationResult {
  overall: number | null;
  readiness: ReadinessBand | null;
  scores: EvaluationScores;
  accuracyHit: boolean;
  feedback: FeedbackItem[];
}

/**
 * Weighted mean over the categories that applied, renormalised.
 *
 * Skipping rather than zeroing is what keeps an overall comparable across modes:
 * a case scored on seven categories and an estimate scored on eight both land on
 * the same 0–100 scale, so XP, rank and the readiness bands need no per-mode
 * arithmetic of their own.
 */
export function weightedOverall(
  scores: EvaluationScores,
  answerMode: AnswerMode,
): number {
  let weightedSum = 0;
  let weightTotal = 0;
  for (const cat of evaluationCategories) {
    const score = scores[cat.key];
    const weight = categoryWeight(cat, answerMode);
    if (score == null || weight === 0) continue;
    weightedSum += score * weight;
    weightTotal += weight;
  }
  return weightTotal === 0 ? 0 : Math.round(weightedSum / weightTotal);
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

/**
 * In a case, a clause counts once it explains rather than merely asserts. The
 * causal vocabulary is what an interviewer is listening for — "costs rose
 * because riders are paid more" is a claim you can push back on, "costs rose"
 * is not.
 */
const REASONING_WORDS =
  /(because|since|due to|driven by|which means|so that|therefore|as a result|suggests|implies|given|assuming|if .* then|leads to|caused by)/i;

function reasonedFragments(text: string): string[] {
  return text
    .split(/[.!?;\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 15 && REASONING_WORDS.test(s));
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
  answerMode?: AnswerMode;
}): DerivedAssumption[] {
  const out: DerivedAssumption[] = [];

  // A case's claims are reasons, not figures, so requiring a digit would floor
  // every qualitative attempt by construction. The rating split survives the
  // change of currency: a branch whose rationale was inherited from something the
  // candidate actually said in the conversation can earn "Excellent", because
  // they did explain it; a note typed into the box is capped, for the same reason
  // a numeric tree box is — a label has room for a claim but not for its basis.
  if (args.answerMode === "qualitative") {
    for (const node of args.framework) {
      const label = node.label.trim() || "Branch";
      const spoken = !!node.sourceMessageId?.trim();
      const note = node.note?.trim();
      if (!spoken && !note) {
        out.push({ key: label, value: "", rating: "NeedsJustification", source: "framework" });
        continue;
      }
      out.push({
        key: label,
        value: note ?? "(said in the conversation)",
        rating: spoken ? "Excellent" : "Reasonable",
        source: spoken ? "chat" : "framework",
      });
    }
    for (const message of args.userMessageText) {
      for (const fragment of reasonedFragments(message)) {
        out.push({
          key: "Said in chat",
          value: fragment,
          rating: "Excellent",
          source: "chat",
        });
      }
    }
    return out;
  }

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
    solutionRevealed = false,
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
  const confidence = clamp(
    80 -
      hintsUsed * HINT_PENALTY -
      (solutionRevealed ? SOLUTION_REVEAL_PENALTY : 0) +
      (finalEstimate != null ? 8 : 0),
    30,
    92,
  );

  const scores: EvaluationScores = {
    structuring,
    logic,
    segmentation,
    assumptions: assumptionsScore,
    calculation,
    // A market-sizing estimate has no branch to localise, so this category never
    // applied to it.
    diagnosis: null,
    communication,
    business,
    confidence,
  };

  // Being told the answer leaves nothing to measure — see `EvaluationResult`.
  const overall = solutionRevealed ? null : weightedOverall(scores, "numeric");

  const feedback = buildFeedback({
    hasSegmentation,
    weakAssumptions,
    assumptionCount,
    quantifiedRatio,
    justifiedRatio,
    accuracy,
    hintsUsed,
    solutionRevealed,
    calculationCount,
    businessNuance,
    betterApproach: input.betterApproach,
  });

  return {
    overall,
    readiness: overall == null ? null : readinessForScore(overall),
    scores,
    accuracyHit: accuracy === "hit",
    feedback,
  };
}

// ── Qualitative ───────────────────────────────────────────────────────────

export interface RootCause {
  /** Labels from the root down to the branch that actually holds the problem. */
  path: string[];
  note?: string;
}

export interface QualitativeEvaluationInput {
  framework: FrameworkNodeInput[];
  userMessageText: string[];
  finalAnswer: string | null;
  hintsUsed: number;
  treeMode: TreeMode | null;
  rootCause: RootCause | null;
  expectedBuckets: string[];
  betterApproach: string;
  /** The candidate asked Teacher mode to work the case — see `solutionWasRevealed`. */
  solutionRevealed?: boolean;
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** Shortest label allowed to match by containment rather than outright. */
const MIN_CONTAINMENT_LEN = 3;

/** Is `needle` a run of whole consecutive words inside `haystack`? */
function containsWordRun(haystack: string[], needle: string[]): boolean {
  if (needle.length === 0 || needle.length > haystack.length) return false;
  for (let i = 0; i <= haystack.length - needle.length; i++) {
    if (needle.every((word, j) => haystack[i + j] === word)) return true;
  }
  return false;
}

/**
 * Loose match: a candidate's wording rarely equals the authored label exactly,
 * so "Delivery cost" has to match the authored "Delivery cost per order".
 *
 * Loose, but not free. Plain substring containment matched on any fragment, so a
 * branch labelled "s" matched the target "Costs" and a tree of one-letter labels
 * scored as a diagnosis. Matching runs of *whole words* keeps the tolerance that
 * matters — extra qualifiers on either side — and drops the part that let a
 * candidate land on the root cause without naming it.
 */
export function labelMatches(candidate: string, target: string): boolean {
  const a = norm(candidate);
  const b = norm(target);
  if (!a || !b) return false;
  if (a === b) return true;
  // A fragment too short to be a word worth matching on can only match exactly.
  if (Math.min(a.length, b.length) < MIN_CONTAINMENT_LEN) return false;
  const wordsA = a.split(" ");
  const wordsB = b.split(" ");
  return containsWordRun(wordsA, wordsB) || containsWordRun(wordsB, wordsA);
}

export interface DiagnosisScore {
  score: number;
  landed: boolean;
  clearedFirst: number;
  falseClears: string[];
  /** Branches judged without ever being raised in the conversation. */
  unevidenced: number;
}

/**
 * Grade a marked-up tree against the branch that actually holds the problem.
 *
 * Deliberately not an LLM call: the question declares its own answer, so this is
 * a comparison, not a judgement. That keeps a candidate's score identical
 * offline, instant, free, and testable — the same reason the mock interviewer
 * exists.
 *
 * Three things are worth different amounts. Landing on the declared branch is
 * most of it. Eliminating siblings on the way down is the difference between
 * diagnosing and guessing, so it is rewarded separately. And clearing a branch
 * that was on the true path is the expensive mistake — the candidate ruled out
 * the answer — so it is penalised rather than merely unrewarded.
 */
export function scoreDiagnosis(
  nodes: FrameworkNodeInput[],
  rootCause: RootCause,
  /**
   * The whole transcript, so a verdict reached without checking anything scores
   * below the same verdict reached by asking. Deliberately the SAME loose test
   * the builder warns with, rather than the stricter one the server could run
   * against the real data pack — nobody should be penalised for something the
   * interface never flagged.
   */
  conversation: string[] = [],
): DiagnosisScore {
  const diagnosable: DiagnosisNode[] = nodes.map((n, i) => ({
    id: n.id ?? String(i),
    parentId: n.parentId ?? null,
    label: n.label,
    status: n.status,
  }));
  const trail = diagnosisTrail(diagnosable);
  const target = rootCause.path.filter((p) => p.trim());
  if (target.length === 0) {
    return { score: 50, landed: false, clearedFirst: 0, falseClears: [], unevidenced: 0 };
  }

  // How deep into the declared path did any single trail get?
  let bestDepth = 0;
  for (const path of trail.labelPaths) {
    let depth = 0;
    for (const step of target) {
      if (path.slice(depth).some((label) => labelMatches(label, step))) depth++;
      else break;
    }
    bestDepth = Math.max(bestDepth, depth);
  }
  const landed = bestDepth >= target.length;

  // Branches cleared that the answer actually ran through: the costly error.
  const falseClears = nodes
    .filter((n) => n.status === "healthy" && target.some((t) => labelMatches(n.label, t)))
    .map((n) => n.label);

  // Eliminating siblings before drilling is what makes a trail a diagnosis
  // rather than a lucky first guess.
  const clearedFirst = nodes.filter((n) => n.status === "healthy").length;

  // Verdicts reached without raising the branch at all. Guessing right is worth
  // something, but not as much as diagnosing right.
  const unevidenced = conversation.length
    ? nodes.filter(
        (n) =>
          n.label.trim() &&
          n.status &&
          n.status !== "unknown" &&
          !branchDiscussed(n.label, conversation),
      ).length
    : 0;

  let score = 25 + (bestDepth / target.length) * 45;
  if (landed) score += 10;
  score += Math.min(clearedFirst, 4) * 4;
  score -= falseClears.length * 18;
  score -= Math.min(unevidenced, 4) * 5;
  // A trail that never terminated has located a region, not a cause.
  if (!trail.complete && landed) score -= 6;

  return {
    score: clamp(Math.round(score), 10, 97),
    landed,
    clearedFirst,
    falseClears,
    unevidenced,
  };
}

/**
 * Score a case: an issue tree, a recommendation, and the conversation that got
 * there. Shares the rating vocabulary with `evaluate()` but none of its
 * arithmetic — there is no ideal range to land in.
 */
export function evaluateQualitative(input: QualitativeEvaluationInput): EvaluationResult {
  const {
    userMessageText,
    finalAnswer,
    hintsUsed,
    treeMode,
    rootCause,
    solutionRevealed = false,
  } = input;
  // Marking a branch as the problem opens an empty child to fill in, so an
  // unfinished tree legitimately contains blank rows. They are a prompt, not a
  // branch — counting them would dilute the rationale ratio and inflate breadth.
  const framework = input.framework.filter((n) => n.label.trim());

  const roots = framework.filter((n) => !n.parentId);
  const depth = treeDepth(framework);
  const assumptions = deriveAssumptions({
    framework,
    userMessageText,
    answerMode: "qualitative",
  });
  const justified = assumptions.filter((a) => a.rating === "Excellent").length;
  const justifiedRatio = assumptions.length ? justified / assumptions.length : 0;
  const withRationale = framework.filter(
    (n) => n.sourceMessageId?.trim() || n.note?.trim(),
  ).length;
  const rationaleRatio = framework.length ? withRationale / framework.length : 0;

  // Coverage against the branches the question says a good answer reaches, when
  // it declares them; otherwise judge the shape — breadth at the top and at
  // least one level of decomposition under it.
  const covered = input.expectedBuckets.filter((b) =>
    framework.some((n) => labelMatches(n.label, b)),
  ).length;
  const coverageRatio = input.expectedBuckets.length
    ? covered / input.expectedBuckets.length
    : null;
  const duplicateSiblings = countDuplicateSiblings(framework);

  const marked = framework.filter((n) => n.status && n.status !== "unknown").length;
  const diagnosisResult = rootCause
    ? scoreDiagnosis(framework, rootCause, userMessageText)
    : null;

  // Guided builds the tree for the candidate, so grading them on it would be the
  // app marking its own work. Null, not zero — see EvaluationScores.
  const guided = treeMode === "guided";
  const structuring = guided
    ? null
    : clamp(35 + Math.min(roots.length, 4) * 9 + Math.min(depth, 3) * 8, 25, 95);
  const segmentation = guided
    ? null
    : clamp(
        (coverageRatio !== null ? 35 + coverageRatio * 55 : 45 + Math.min(roots.length, 4) * 9) -
          duplicateSiblings * 10,
        25,
        95,
      );

  const logic = clamp(
    45 + (depth >= 2 ? 15 : 0) + (marked >= 2 ? 12 : 0) + (diagnosisResult?.landed ? 10 : 0),
    30,
    92,
  );
  const assumptionsScore = clamp(
    35 + Math.min(assumptions.length, 6) * 4 + rationaleRatio * 20 + justifiedRatio * 25,
    25,
    95,
  );
  const communication = clamp(
    40 + Math.min(userMessageText.length, 6) * 7 + (finalAnswer?.trim() ? 12 : 0),
    30,
    92,
  );
  const business = clamp(
    45 +
      (textHas(userMessageText, BUSINESS_KEYWORDS) ? 18 : 0) +
      Math.min(marked, 5) * 4,
    30,
    92,
  );
  const confidence = clamp(
    80 -
      hintsUsed * HINT_PENALTY -
      (solutionRevealed ? SOLUTION_REVEAL_PENALTY : 0) +
      (finalAnswer?.trim() ? 8 : 0),
    30,
    92,
  );

  const scores: EvaluationScores = {
    structuring,
    logic,
    segmentation,
    assumptions: assumptionsScore,
    // No arithmetic in a case, so this category never applied.
    calculation: null,
    diagnosis: diagnosisResult ? diagnosisResult.score : null,
    communication,
    business,
    confidence,
  };

  // Being told the answer leaves nothing to measure — see `EvaluationResult`.
  const overall = solutionRevealed ? null : weightedOverall(scores, "qualitative");

  return {
    overall,
    readiness: overall == null ? null : readinessForScore(overall),
    scores,
    // Reserved for a numeric estimate landing in range; a case has no range.
    accuracyHit: false,
    feedback: buildQualitativeFeedback({
      roots: roots.length,
      depth,
      marked,
      rationaleRatio,
      justifiedRatio,
      coverageRatio,
      duplicateSiblings,
      diagnosis: diagnosisResult,
      hasAnswer: !!finalAnswer?.trim(),
      hintsUsed,
      solutionRevealed,
      guided,
      betterApproach: input.betterApproach,
    }),
  };
}

function treeDepth(nodes: FrameworkNodeInput[]): number {
  const byId = new Map(nodes.map((n) => [n.id ?? "", n]));
  let deepest = 0;
  for (const node of nodes) {
    let d = 1;
    let cursor = node;
    const seen = new Set<string>();
    while (cursor.parentId && !seen.has(cursor.parentId)) {
      seen.add(cursor.parentId);
      const parent = byId.get(cursor.parentId);
      if (!parent) break;
      cursor = parent;
      d++;
    }
    deepest = Math.max(deepest, d);
  }
  return deepest;
}

/** Overlapping siblings are the commonest way a tree stops being MECE. */
function countDuplicateSiblings(nodes: FrameworkNodeInput[]): number {
  const byParent = new Map<string, string[]>();
  for (const n of nodes) {
    const key = n.parentId ?? "__root";
    byParent.set(key, [...(byParent.get(key) ?? []), norm(n.label)]);
  }
  let duplicates = 0;
  for (const labels of byParent.values()) {
    const seen = new Set<string>();
    for (const label of labels) {
      if (!label) continue;
      if (seen.has(label)) duplicates++;
      seen.add(label);
    }
  }
  return duplicates;
}

function buildQualitativeFeedback(args: {
  roots: number;
  depth: number;
  marked: number;
  rationaleRatio: number;
  justifiedRatio: number;
  coverageRatio: number | null;
  duplicateSiblings: number;
  diagnosis: DiagnosisScore | null;
  hasAnswer: boolean;
  hintsUsed: number;
  solutionRevealed: boolean;
  guided: boolean;
  betterApproach: string;
}): FeedbackItem[] {
  const items: FeedbackItem[] = [];

  if (args.roots === 0) {
    items.push({ tone: "warning", text: "You didn't break the problem down. Start with two or three branches that between them cover the whole question." });
  } else if (args.roots < 2) {
    items.push({ tone: "warning", text: "One branch isn't a structure. Split the problem so the pieces cover it between them — revenue and cost, or internal and external." });
  } else if (args.depth < 2) {
    items.push({ tone: "tip", text: "Your top-level split is sound, but you stopped there. The insight is usually one or two levels down." });
  } else {
    items.push({ tone: "positive", text: "Good structure — you broke the problem into branches and then broke those down again." });
  }

  if (args.duplicateSiblings > 0) {
    items.push({ tone: "warning", text: "Some branches at the same level overlap, so the same cause can hide in two places. Keep siblings mutually exclusive." });
  }
  if (args.coverageRatio !== null && args.coverageRatio < 0.5) {
    items.push({ tone: "warning", text: "Your tree missed several angles a strong answer would cover. Before drilling, check the top level is exhaustive." });
  }

  // The diagnostic loop is the thing being taught, so its feedback is specific.
  if (args.diagnosis) {
    if (args.diagnosis.falseClears.length > 0) {
      items.push({
        tone: "warning",
        text: `You ruled out ${args.diagnosis.falseClears.join(", ")} — but the answer ran through it. Clearing a branch is a claim; check the data before you make it.`,
      });
    }
    if (args.diagnosis.landed) {
      items.push({ tone: "positive", text: "You narrowed to the branch that actually held the problem — that's the whole exercise." });
    } else {
      items.push({ tone: "tip", text: "You didn't reach the branch the problem was really in. Work down one level at a time, eliminating as you go." });
    }
    if (args.diagnosis.clearedFirst === 0) {
      items.push({ tone: "tip", text: "You never marked anything as ruled out. Eliminating branches out loud is what separates a diagnosis from a guess." });
    }
  } else if (args.marked === 0) {
    items.push({ tone: "tip", text: "You built the tree but never marked it. Use the branches to say what you've ruled out and where you think the problem sits." });
  }

  if (args.rationaleRatio >= 0.6 || args.justifiedRatio >= 0.3) {
    items.push({ tone: "positive", text: "You said why each branch mattered, not just what it was — that's what makes a structure persuasive." });
  } else {
    items.push({ tone: "tip", text: "Most branches carried no reasoning. Say why a branch matters as you add it — talking it through in the chat is enough." });
  }

  if (!args.hasAnswer) {
    items.push({ tone: "warning", text: "You never committed to a recommendation. Always close with an answer and what you'd do about it." });
  }
  // "Without help" has to mean without any of it, or the praise is hollow.
  if (args.solutionRevealed) {
    items.push({ tone: "warning", text: "You had Teacher mode work the case through, so this attempt isn't scored at all — it counts towards nothing. Retry it cold — following a diagnosis and reaching one are different skills, and only the second one gets tested in the room." });
  } else if (args.hintsUsed === 0) {
    items.push({ tone: "positive", text: "You worked through it without hints — great independence." });
  }
  if (args.guided) {
    items.push({ tone: "tip", text: "This was a guided attempt, so structure wasn't scored. Try it in solo mode to see how your own framework holds up." });
  }
  if (args.betterApproach) {
    items.push({ tone: "tip", text: `A consultant's angle: ${args.betterApproach}` });
  }
  return items;
}

function buildFeedback(args: {
  hasSegmentation: boolean;
  weakAssumptions: number;
  assumptionCount: number;
  quantifiedRatio: number;
  justifiedRatio: number;
  accuracy: Accuracy;
  hintsUsed: number;
  solutionRevealed: boolean;
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
  // "Without help" has to mean without any of it, or the praise is hollow.
  if (args.solutionRevealed) {
    items.push({ tone: "warning", text: "You had Teacher mode work the problem through, so this attempt isn't scored at all — it counts towards nothing. Retry it cold — reading a solution and producing one are different skills, and only the second one gets tested in the room." });
  } else if (args.hintsUsed === 0) {
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
