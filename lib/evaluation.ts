import {
  categoryWeight,
  evaluationCategories,
  readinessForScore,
  accuracyTolerance,
  rubric,
  structureJudgement,
  type ReadinessBand,
} from "@/lib/config";
import { branchDiscussed, diagnosisTrail, type DiagnosisNode } from "@/lib/diagnosis";
import { clamp, formatIndianNumber } from "@/lib/utils";
import { parseNode, shareTotalFor, sharesOvershoot } from "@/lib/framework-value";
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
  /**
   * What the model made of the tree, 0–100, or absent.
   *
   * Deterministic rules can tell that a tree has figures, real branches and
   * coherent shares. They cannot tell whether the labels describe a sensible
   * decomposition of *this* question, and that gap is what a candidate gaming
   * the rubric relies on. `lib/framework-judge.ts` asks; the answer arrives here
   * as a plain number so this function stays pure and synchronous.
   *
   * **Absent is not zero.** No key, no budget, a provider that failed or a reply
   * that would not parse all leave this undefined, and the deterministic score
   * then stands unmultiplied — an app that scores differently depending on
   * whether a network call succeeded is worse than one that scores
   * conservatively. See `structureMultiplier`.
   */
  structureCoherence?: number;
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
 * Sum the components a candidate actually earned, on the 0–100 scale.
 *
 * `false` is accepted alongside a number so a component can be written as
 * `condition && points` and read as the sentence it is — "segmented, so 18" —
 * rather than as a ternary with a `: 0` limb on every line. A negative is a
 * penalty and subtracts.
 *
 * The clamp has no floor above zero, which is the point of the rubric: nothing
 * is owed for turning up, so an attempt that earned no component scores 0
 * rather than the 25–35 the old baselines guaranteed.
 */
function earned(...components: (number | false)[]): number {
  const total = components.reduce<number>((sum, c) => sum + (c === false ? 0 : c), 0);
  return Math.round(clamp(total, 0, 100));
}

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

/**
 * How far outside the ideal band the answer fell, and which way.
 *
 * A multiple of the bound that was missed, not of the midpoint: a candidate who
 * lands at four times the top of the range was four times too generous
 * somewhere, and that is the sentence they can act on. `computeAccuracy` says
 * *whether* it missed and is what the score reads; this says *by how much* and
 * is what the report reads.
 *
 * Null inside the range, and null for a non-positive estimate — zero has no
 * ratio to anything, and a negative one is not a market size.
 */
export function missFactor(
  final: number | null,
  low: number | null,
  high: number | null,
): { factor: number; direction: "over" | "under" } | null {
  if (final == null || low == null || high == null) return null;
  if (final <= 0 || low <= 0 || high <= 0) return null;
  if (final >= low && final <= high) return null;
  return final > high
    ? { factor: final / high, direction: "over" }
    : { factor: low / final, direction: "under" };
}

/**
 * Is this miss close enough to a round power of ten to be worth calling one?
 *
 * The most useful thing you can tell a market-sizing candidate who came out
 * 100× high is that they almost certainly did the reasoning correctly and then
 * dropped two zeroes — a lakh read as a crore, a daily figure left annual. A
 * judgement error lands on 3.7× or 6×; a unit slip lands on 10, 100, 1000.
 *
 * The window is multiplicative (±25%) rather than additive, because "close to
 * 10" and "close to 1000" cannot mean the same distance. 12× reads as ten,
 * 45× does not read as a hundred.
 */
function roundOrderOfMagnitude(factor: number): number | null {
  if (!Number.isFinite(factor) || factor < 9) return null;
  const exponent = Math.round(Math.log10(factor));
  if (exponent < 1) return null;
  const target = 10 ** exponent;
  return Math.abs(Math.log10(factor / target)) <= Math.log10(1.25) ? target : null;
}

/**
 * A figure as a candidate would say it out loud — "80 lakh", "1.2 cr".
 *
 * `toIndianWords` (lib/utils.ts) is the display version and always prints two
 * decimals, which reads as machinery mid-sentence: "your 80.00 L". Precision
 * falls away as the number grows because the report is quoting an estimate back,
 * not reconciling it.
 */
function figure(n: number): string {
  const abs = Math.abs(n);
  const [divisor, unit] =
    abs >= 1e7 ? [1e7, " cr"] : abs >= 1e5 ? [1e5, " lakh"] : abs >= 1e3 ? [1e3, "K"] : [1, ""];
  const scaled = n / divisor;
  const decimals = Math.abs(scaled) >= 100 ? 0 : Math.abs(scaled) >= 10 ? 1 : 2;
  // Grouped, because the tail of a slipped estimate is where this lands:
  // "10000 cr" is a figure a reader has to count digits on, "10,000 cr" isn't.
  return `${formatIndianNumber(scaled, decimals)}${unit}`;
}

/**
 * A miss as a multiple: "1.4×", "5.2×", "137×", "1,50,000×".
 *
 * Two significant figures once it runs past a thousand. Nobody needs the exact
 * ratio at that point — "1,50,000×" and "1,53,846×" say the identical thing,
 * and only one of them reads as a sentence.
 */
function times(factor: number): string {
  if (factor < 10) return `${Number(factor.toFixed(1))}×`;
  if (factor < 1000) return `${Math.round(factor)}×`;
  const magnitude = 10 ** (Math.floor(Math.log10(factor)) - 1);
  return `${formatIndianNumber(Math.round(factor / magnitude) * magnitude)}×`;
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

/**
 * How much the model's read of the tree scales what the deterministic layer
 * awarded.
 *
 * Banded rather than applied raw, because a continuous score from a model is not
 * stable: the same tree comes back 61 one run and 68 the next, and a candidate
 * who resubmits identical work to a different number rightly stops trusting the
 * report. Three bands absorb that noise and still separate nonsense from a real
 * decomposition.
 *
 * **No verdict means no multiplier**, not a penalty. This is the offline path
 * and the failure path at once, and both have to leave the deterministic score
 * exactly as it was.
 */
export function structureMultiplier(coherence: number | undefined): number {
  const band = structureBand(coherence);
  return band === null ? 1 : structureJudgement.multipliers[band];
}

/**
 * The band itself, for the report.
 *
 * Split out from the multiplier because the two readers want different things
 * from the same verdict: the scorer wants a number to multiply by, and the
 * feedback wants to say which of the three judgements was made. Deriving both
 * from one function is what stops the report describing a band the score was
 * never scaled by.
 *
 * Null means no verdict was taken at all — no key, no budget, a provider that
 * failed. Not a low band, and nothing to tell the candidate about.
 */
export function structureBand(
  coherence: number | undefined,
): "incoherent" | "loose" | "coherent" | null {
  if (coherence == null || !Number.isFinite(coherence)) return null;
  const { incoherentBelow, looseBelow } = structureJudgement;
  if (coherence < incoherentBelow) return "incoherent";
  if (coherence < looseBelow) return "loose";
  return "coherent";
}

/** What the framework actually says, as opposed to how many rows it has. */
interface TreeReading {
  /**
   * Nodes that are a step rather than a label.
   *
   * A node counts when it carries a figure this app can parse, or when it has
   * children. The second clause is required rather than generous: `parseNode`'s
   * own documentation says a grouping node — "Segment by Income", which has no
   * value of its own, only its children do — is legitimate. What does not count
   * is the childless, figureless leaf, which is decoration, and six of which
   * used to be worth full marks.
   */
  substantiveCount: number;
  /** Is there an actual partition: a step broken into branches, or shares of one? */
  hasPartition: boolean;
  /** Deepest chain of nodes. A flat list of six is not a tree. */
  depth: number;
  /** Branch sets claiming more than 100% of their parent — double counting. */
  overshootingParents: number;
  /**
   * Which step overshot, and by how much.
   *
   * The same finding as `overshootingParents`, carrying the identity the count
   * throws away. It costs `partitionOvershootPenalty` in two categories, and a
   * deduction the report cannot name is a deduction nobody can act on — so the
   * feedback quotes the step and its total rather than saying "some branches".
   */
  overshoots: { label: string; total: number }[];
  /**
   * Steps holding something in a figure box that no parser can read.
   *
   * Read off `parseNode` rather than off the `Weak` assumption rating, which
   * cannot fire on a numeric attempt: `rateAssumption` returns Weak only for an
   * empty value, and `deriveAssumptions` skips empty values before it is
   * called. So "12 lakh" and "lots" were reported identically, and a box that
   * buys nothing on the scorecard was never flagged as one.
   */
  unreadable: string[];
}

/**
 * Read the tree's structure, using the parsers the builder already validates
 * input with (`lib/framework-value.ts`) so "a figure" means the same thing on
 * both sides of the screen.
 *
 * `parentId` is genuinely populated on numeric attempts — `FrameworkNode` has
 * the relation and `app/actions/submit.ts` passes it — despite the stale comment
 * on `FrameworkNodeInput` calling those fields qualitative-only. Where a tree
 * carries no ids at all (older rows, and most test fixtures), every node reads
 * as a root, so depth is 1 and a partition has to be evidenced by shares
 * instead. That degrades to the flat case rather than throwing.
 */
function readTree(framework: FrameworkNodeInput[]): TreeReading {
  const childrenOf = new Map<string, FrameworkNodeInput[]>();
  for (const node of framework) {
    const parent = node.parentId;
    if (!parent) continue;
    const siblings = childrenOf.get(parent) ?? [];
    siblings.push(node);
    childrenOf.set(parent, siblings);
  }

  const hasFigure = (n: FrameworkNodeInput) =>
    parseNode(n.value) !== null || parseNode(n.multiplier) !== null;

  /*
   * Does a figure exist at or below this node?
   *
   * The grouping-node carve-out is what made nesting worth points: "counts if it
   * has children" let a tree of empty labels score simply by being indented,
   * because each parent qualified on the existence of its children rather than
   * on anything either of them said. Three parents with two blank children each
   * reached 57 on structure and 78 on segmentation with not one number in the
   * whole tree.
   *
   * A grouping node is legitimate — `parseNode` documents the case, "Segment by
   * Income" holds no value of its own — but only because its children carry the
   * figures. So the carve-out now asks for that instead of assuming it, and an
   * outline with no arithmetic under it is an outline, not an estimate.
   */
  const subtreeHasFigure = (n: FrameworkNodeInput, seen: Set<string>): boolean => {
    if (hasFigure(n)) return true;
    if (!n.id || seen.has(n.id)) return false;
    seen.add(n.id);
    return (childrenOf.get(n.id) ?? []).some((kid) => subtreeHasFigure(kid, seen));
  };
  const groupsOverFigures = (n: FrameworkNodeInput): boolean => {
    const kids = n.id ? (childrenOf.get(n.id) ?? []) : [];
    return kids.length > 0 && kids.some((kid) => subtreeHasFigure(kid, new Set()));
  };

  const substantiveCount = framework.filter(
    (n) => hasFigure(n) || groupsOverFigures(n),
  ).length;

  // A partition is a step split into branches. Two or more siblings anywhere is
  // one; so is a pair of bare percentage shares, which is how a flat tree
  // expresses the same idea. Either way the branches have to carry figures —
  // splitting nothing into two nothings is not a segmentation of anything.
  // Kept as entries rather than values so the parent that overshot can be
  // NAMED. The count alone was all the scorer needed; the report needs to say
  // which step it is talking about.
  const splitEntries = [...childrenOf.entries()].filter(
    ([, kids]) => kids.length >= 2 && kids.some((kid) => subtreeHasFigure(kid, new Set())),
  );
  const splitParents = splitEntries.map(([, kids]) => kids);
  const shareNodes = framework.filter((n) => parseNode(n.value)?.isPercent === true);
  const hasPartition = splitParents.length > 0 || shareNodes.length >= 2;

  // Only an overshoot is an error — see `sharesOvershoot`. Falling short is a
  // deliberate narrowing to the slices the estimate needs.
  const labelOf = (id: string) =>
    framework.find((n) => n.id === id)?.label.trim() || "that step";
  const overshoots = splitEntries.flatMap(([parentId, kids]) => {
    const total = shareTotalFor(kids);
    return total !== null && sharesOvershoot(total)
      ? [{ label: labelOf(parentId), total: Math.round(total) }]
      : [];
  });
  const overshootingParents = overshoots.length;

  // Anything typed into a value or × box that the chain can't read. A blank box
  // is not one of these — an unfilled step is incomplete, not wrong.
  const unreadable = framework
    .filter((n) =>
      [n.value, n.multiplier]
        .filter((box) => !!box?.trim())
        .some((box) => parseNode(box) === null),
    )
    .map((n) => n.label.trim() || "an unnamed step");

  const depthOf = (node: FrameworkNodeInput, seen: Set<string>): number => {
    if (!node.id || seen.has(node.id)) return 1;
    seen.add(node.id);
    const kids = childrenOf.get(node.id) ?? [];
    return 1 + Math.max(0, ...kids.map((k) => depthOf(k, seen)));
  };
  const roots = framework.filter((n) => !n.parentId);
  const depth = roots.length ? Math.max(...roots.map((r) => depthOf(r, new Set()))) : 0;

  return {
    substantiveCount,
    hasPartition,
    depth,
    overshootingParents,
    overshoots,
    unreadable,
  };
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
    structureCoherence,
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

  const tree = readTree(framework);
  /*
   * "You have two boxes" is not "you segmented", and reading it that way is what
   * let a tree of six empty labels score 96 on structure and 100 on
   * segmentation. Real evidence is a partition that exists — a step actually
   * broken into branches, or branches carrying shares of their parent — or the
   * candidate saying so in words.
   */
  const hasSegmentation =
    tree.hasPartition ||
    textHas([...framework.map((f) => f.label), ...userMessageText], SEGMENT_KEYWORDS);
  const businessNuance = textHas(userMessageText, BUSINESS_KEYWORDS);
  const accuracy = computeAccuracy(finalEstimate, idealLow, idealHigh);
  const userMsgCount = userMessageText.length;

  // Clauses that explain rather than assert — the same test the case scorer
  // applies, reused here so "said why" means one thing across both modes.
  const reasonedCount = userMessageText.reduce(
    (n, message) => n + reasonedFragments(message).length,
    0,
  );
  const landedNear = accuracy === "hit" || accuracy === "near";

  // Every category below is bought from zero and clamped 0–100 — see `rubric`
  // for why there is no baseline and no floor.
  const structuring = earned(
    Math.min(tree.substantiveCount, rubric.structuring.maxNodes) * rubric.structuring.perNode,
    hasSegmentation && rubric.structuring.segmented,
    -tree.overshootingParents * rubric.partitionOvershootPenalty,
  );
  const segmentation = earned(
    hasSegmentation && rubric.segmentation.segmented,
    Math.min(tree.substantiveCount, rubric.segmentation.maxNodes) * rubric.segmentation.perNode,
    -tree.overshootingParents * rubric.partitionOvershootPenalty,
  );
  const logic = earned(
    tree.substantiveCount >= 2 && rubric.logic.hasTree,
    calculationCount > 0 && rubric.logic.showedWork,
    assumptionCount >= 2 && rubric.logic.hasAssumptions,
    landedNear && rubric.logic.landedNear,
    // Depth rather than a fourth row: a chain that goes somewhere is structure,
    // a longer flat list is not.
    tree.depth >= 3 && rubric.logic.deepTree,
  );
  /*
   * Derived figures are far more numerous than the handful people used to log by
   * hand, so the count contribution is capped and most of the headroom sits in
   * justifying them — otherwise a filled-in tree alone would max this out.
   *
   * The ratios are then scaled by how many figures there are to take a ratio of.
   * A ratio is a proportion, and a proportion of one is 1.0 — so a candidate who
   * typed a single sentence with a number in it ("16 crore GB per day", which
   * `rateAssumption` reads as justified because of the "per") would otherwise
   * collect the entire quantified and justified bonus for it. Scaling by
   * coverage means those bonuses are earned across the estimate rather than by
   * one lucky fragment, and a full tree is unaffected.
   */
  const assumptionCoverage =
    Math.min(assumptionCount, rubric.assumptions.maxCounted) / rubric.assumptions.maxCounted;
  const assumptionsScore = earned(
    Math.min(assumptionCount, rubric.assumptions.maxCounted) *
      rubric.assumptions.perAssumption,
    quantifiedRatio * rubric.assumptions.quantifiedRatio * assumptionCoverage,
    justifiedRatio * rubric.assumptions.justifiedRatio * assumptionCoverage,
    -weakAssumptions * rubric.assumptions.weakPenalty,
  );
  /*
   * A number nothing supports is a guess, however well it landed.
   *
   * Accuracy on its own used to be worth 80, which is what let an empty attempt
   * that typed a lucky figure outscore a built estimate that missed. So the
   * accuracy points are capped when there is neither a calculation nor a single
   * derived figure behind the answer, and the rest of the category is bought by
   * showing the arithmetic.
   *
   * The threshold is two figures rather than one on purpose — see
   * `rubric.substantiationThreshold`.
   */
  const substantiated =
    calculationCount > 0 || assumptionCount >= rubric.substantiationThreshold;
  const accuracyPoints = Math.min(
    rubric.calculation[accuracy],
    substantiated ? Infinity : rubric.calculation.unsubstantiatedCap,
  );
  const calculation = earned(
    accuracyPoints,
    Math.min(calculationCount, rubric.calculation.maxCalculations) *
      rubric.calculation.perCalculation,
  );
  const communication = earned(
    Math.min(userMsgCount, rubric.communication.maxMessages) *
      rubric.communication.perMessage,
    Math.min(reasonedCount, rubric.communication.maxReasonedClauses) *
      rubric.communication.perReasonedClause,
    justifiedRatio >= rubric.communication.justifiedThreshold &&
      rubric.communication.justifiedRatio,
  );
  const business = earned(
    businessNuance && rubric.business.nuance,
    hasSegmentation && rubric.business.segmented,
    assumptionCount >= 3 && rubric.business.hasAssumptions,
    landedNear && rubric.business.landedNear,
  );
  const confidence = earned(
    finalEstimate != null && rubric.confidence.committed,
    assumptionCount >= 3 && rubric.confidence.hasAssumptions,
    calculationCount > 0 && rubric.confidence.showedWork,
    userMsgCount >= 3 && rubric.confidence.discussed,
    -hintsUsed * HINT_PENALTY,
    solutionRevealed && -SOLUTION_REVEAL_PENALTY,
  );

  /*
   * The model's read scales the four categories that are claims ABOUT THE TREE.
   * Assumptions, calculation, communication and confidence are evidence of work
   * — figures committed, arithmetic shown, things said — and a tree the model
   * dislikes does not make those things not have happened.
   */
  const structural = structureMultiplier(structureCoherence);
  const scores: EvaluationScores = {
    structuring: Math.round(structuring * structural),
    logic: Math.round(logic * structural),
    segmentation: Math.round(segmentation * structural),
    assumptions: assumptionsScore,
    calculation,
    // A market-sizing estimate has no branch to localise, so this category never
    // applied to it.
    diagnosis: null,
    communication,
    business: Math.round(business * structural),
    confidence,
  };

  // Being told the answer leaves nothing to measure — see `EvaluationResult`.
  const overall = solutionRevealed ? null : weightedOverall(scores, "numeric");

  const feedback = buildFeedback({
    tree,
    // The same verdict the four structural categories were scaled by, so the
    // report can only ever describe the band the score actually used.
    structure: structureBand(structureCoherence),
    hasSegmentation,
    assumptionCount,
    quantifiedRatio,
    justifiedRatio,
    accuracy,
    finalEstimate,
    idealLow,
    idealHigh,
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

/**
 * How many derived observations a report may carry.
 *
 * A weak attempt can legitimately trigger a dozen of these, and a dozen bullets
 * is a wall rather than a report — the fifth one is where a reader stops. The
 * cap only ever drops the lowest-ranked items, and never the authored
 * `betterApproach`, which is appended after it.
 */
const FEEDBACK_LIMIT = 8;

/**
 * What the candidate is told, in the order it is worth reading.
 *
 * Two rules distinguish this from the list it replaces, and both come from what
 * the war room's own builder (`lib/sim/score.ts`) already does well:
 *
 *  1. **Name the number.** "Your final estimate was well off" is the same
 *     sentence at 1.4× and at 400×, and only one of those is a reasoning
 *     problem. Every item that can quote a figure, a step or a total does.
 *  2. **Price the penalty.** A deduction the report does not mention teaches
 *     nothing. Sibling shares over 100% and a structure the judge could not
 *     read both move the score, and until now neither said so.
 *
 * `rank` is the order the report shows them in — impact, not authoring order —
 * and the reason the list is a sort rather than a sequence of pushes. It is
 * also what makes the cap safe: the items that fall off the end are the ones
 * that mattered least.
 */
function buildFeedback(args: {
  tree: TreeReading;
  structure: ReturnType<typeof structureBand>;
  hasSegmentation: boolean;
  assumptionCount: number;
  quantifiedRatio: number;
  justifiedRatio: number;
  accuracy: Accuracy;
  finalEstimate: number | null;
  idealLow: number | null;
  idealHigh: number | null;
  hintsUsed: number;
  solutionRevealed: boolean;
  calculationCount: number;
  businessNuance: boolean;
  betterApproach: string;
}): FeedbackItem[] {
  const items: (FeedbackItem & { rank: number })[] = [];
  const say = (rank: number, tone: FeedbackItem["tone"], text: string) =>
    items.push({ rank, tone, text });

  const { tree } = args;
  const range =
    args.idealLow != null && args.idealHigh != null
      ? `${figure(args.idealLow)}–${figure(args.idealHigh)}`
      : null;
  const miss = missFactor(args.finalEstimate, args.idealLow, args.idealHigh);

  // ── 0. Whether this was an attempt at all ────────────────────────────────
  if (args.solutionRevealed) {
    say(
      0,
      "warning",
      "You had Teacher mode work the problem through, so this attempt isn't scored at all — it counts towards nothing. Retry it cold — reading a solution and producing one are different skills, and only the second one gets tested in the room.",
    );
  }

  // ── 1. The number, which is what everyone reads first ────────────────────
  switch (args.accuracy) {
    case "hit":
      say(
        1,
        "positive",
        range
          ? `Your ${figure(args.finalEstimate!)} sits inside the ${range} band a strong answer lands in. Good calibration.`
          : "Your final estimate landed within a sensible range. Good calibration.",
      );
      break;
    case "near":
    case "far": {
      const far = args.accuracy === "far";
      if (!miss) {
        say(
          1,
          far ? "warning" : "tip",
          "Your final estimate landed outside the sensible range. Sanity-check your biggest driver and your rounding.",
        );
        break;
      }
      const way = miss.direction === "over" ? "above the top of" : "below the bottom of";
      const order = roundOrderOfMagnitude(miss.factor);
      const opening = `Your ${figure(args.finalEstimate!)} is about ${times(miss.factor)} ${way} the ${range ?? "sensible"} range.`;
      if (order) {
        // The single most useful sentence in a market-sizing report: a miss
        // that lands on a round order of magnitude is a units problem, and
        // re-doing the reasoning will reproduce it exactly.
        say(
          1,
          "warning",
          `${opening} A miss that lands this close to ${times(order)} is almost always a unit slip rather than a judgement error — a lakh read as a crore, or a per-day figure left as per-year. Check the units on your biggest step before you re-work anything.`,
        );
      } else if (far) {
        say(
          1,
          "warning",
          `${opening} That gap is bigger than any one assumption should be able to open — find the driver carrying it, and sanity-check its size against something you know.`,
        );
      } else {
        say(
          1,
          "tip",
          `${opening} Close. One or two driver assumptions are a little ${miss.direction === "over" ? "generous" : "mean"} — recheck the biggest of them.`,
        );
      }
      break;
    }
    case "none":
      say(
        1,
        "warning",
        `You didn't lock a final estimate, so there was nothing to mark for accuracy${range ? ` against the ${range} a strong answer lands in` : ""}. Always land on a number and state it as a range.`,
      );
      break;
  }

  // ── 2. What the model made of the tree ───────────────────────────────────
  //
  // The judge's own sentence is prepended separately (`app/actions/submit.ts`)
  // and says WHY. This says what it cost, which is the part a candidate can
  // otherwise only infer from a score that moved for no visible reason.
  if (args.structure === "incoherent") {
    say(
      2,
      "warning",
      `The steps don't read as a decomposition of this particular question, so Problem Structuring, Segmentation, Logical Thinking and Business Sense were scaled to ${Math.round(structureJudgement.multipliers.incoherent * 100)}% of what they earned. Label each step with what it actually measures, and check the chain multiplies out to the thing being asked for.`,
    );
  } else if (args.structure === "loose") {
    say(
      2,
      "tip",
      `Your structure is recognisable but loose for this question, which scaled the four structural categories to ${Math.round(structureJudgement.multipliers.loose * 100)}%. The usual fix is one step doing two jobs — split it, or say what it means.`,
    );
  }

  // ── 3. Whether there is a chain at all ───────────────────────────────────
  if (tree.substantiveCount === 0) {
    say(
      3,
      "warning",
      "There's no estimation chain on the board — every figure in an estimate has to come from somewhere, and the tree is where you show it. Start with a population or a base you're confident in, then narrow.",
    );
  } else if (tree.substantiveCount === 1) {
    say(
      3,
      "warning",
      "One step isn't an estimate, it's an assertion. Break the number you're after into the two or three quantities it's made of, and put a figure on each.",
    );
  } else if (tree.depth <= 1 && tree.substantiveCount >= 3) {
    say(
      9,
      "tip",
      "Your steps sit side by side rather than following from one another. A guesstimate is a chain — each step should narrow the one above it, which is also what makes the arithmetic checkable.",
    );
  }

  // ── 4. Arithmetic that cannot be right whichever way it is read ──────────
  for (const over of tree.overshoots) {
    say(
      4,
      "warning",
      `The branches under “${over.label}” add up to ${over.total}% of it, which is double counting — the same people are being sized twice. It costs ${rubric.partitionOvershootPenalty} points off both Problem Structuring and Segmentation. Shares of a step can come to less than the whole, never more.`,
    );
  }

  // ── 5. Segmentation ──────────────────────────────────────────────────────
  if (!args.hasSegmentation && tree.substantiveCount > 0) {
    say(
      5,
      "warning",
      "You jumped toward a number without segmenting. Break the population into groups that behave differently — urban and rural, adults and children — because one average across all of them hides the estimate.",
    );
  } else if (args.hasSegmentation && tree.overshoots.length === 0) {
    // Withheld while a partition overshoots: "strong segmentation" directly
    // under "these branches double count" is the report contradicting itself,
    // and the overshoot item already says what the split got wrong.
    say(
      5,
      "positive",
      "Strong segmentation — you broke the problem into meaningful pieces before estimating.",
    );
  }

  // ── 6/7. The figures, and whether they were defended ─────────────────────
  //
  // Three states worth distinguishing: no numbers at all, numbers with no
  // stated basis, and numbers you actually defended.
  if (args.assumptionCount === 0) {
    say(
      6,
      "warning",
      "You never committed to a number. Put figures on your steps and say what each one is based on.",
    );
  } else if (args.justifiedRatio >= 0.3) {
    say(
      7,
      "positive",
      "You said where your numbers came from, not just what they were — that's what makes an estimate defensible.",
    );
  } else if (args.quantifiedRatio >= 0.6) {
    say(
      7,
      "tip",
      "Your figures are all there, but you rarely said where they came from. Talk through the basis for your biggest drivers — an interviewer is listening for the basis, not the digit.",
    );
  }

  if (tree.unreadable.length > 0) {
    const named = tree.unreadable.slice(0, 3).map((label) => `“${label}”`).join(", ");
    say(
      6,
      "warning",
      `${named} ${tree.unreadable.length === 1 ? "holds" : "hold"} something in a figure box that isn't a figure, so ${tree.unreadable.length === 1 ? "it drops" : "they drop"} out of the chain entirely. Every box should carry a number, a percentage or a rate you can defend.`,
    );
  }

  // ── 8. Showing the work ──────────────────────────────────────────────────
  if (args.calculationCount === 0) {
    say(
      8,
      "tip",
      "Show explicit calculations — use the calculator so your arithmetic is visible and checkable. Saving even one is worth points, and it is how an interviewer follows you.",
    );
  }

  // ── 10. Judgement, and what the attempt cost ─────────────────────────────
  say(
    10,
    args.businessNuance ? "positive" : "tip",
    args.businessNuance
      ? "Nice business instinct — you considered demand nuances beyond the base case."
      : "Add business judgement: think about institutional, seasonal or bulk demand you might be missing.",
  );
  // "Without help" has to mean without any of it, or the praise is hollow.
  if (!args.solutionRevealed && args.hintsUsed === 0) {
    say(10, "positive", "You worked through it without hints — great independence.");
  }

  // ── The cap, and the one item it may never drop ──────────────────────────
  //
  // Sorted before slicing, so what falls off the end is what mattered least.
  // `sort` is stable in every runtime this ships on, which is what keeps two
  // overshooting steps in the order the tree lists them.
  const ranked = items
    .sort((a, b) => a.rank - b.rank)
    .slice(0, FEEDBACK_LIMIT)
    .map(({ tone, text }) => ({ tone, text }));

  // Authored content rather than a derived observation, and the only line
  // written by a human who knows the question — so it survives the cap and
  // always closes the report.
  if (args.betterApproach) {
    ranked.push({ tone: "tip", text: `A consultant's angle: ${args.betterApproach}` });
  }
  return ranked;
}
