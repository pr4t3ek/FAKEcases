/**
 * Evaluation rubric configuration: the 9 scored categories, their weights, and
 * the readiness bands. Tweak scoring here without touching the scorer.
 *
 * No attempt is scored on all 9 — a weight of 0, or a null score, takes a
 * category out of the mean for that attempt (see `weightedOverall`). A
 * guesstimate is scored on 8 and a case on 7.
 */

/**
 * The scored categories.
 *
 * `weight` grades a numeric estimate; `weightQualitative` grades a case, and
 * where it differs it says something about what the two exercises are actually
 * testing. Structure is worth less on a case — the frameworks recur, so
 * reproducing one is not the skill — and Diagnosis carries that weight instead,
 * because localising the problem inside a known tree is the hard part.
 *
 * `labelQualitative` renames without renaming: the stored column, the key and
 * the rollups stay identical, so only the reader sees a difference.
 */
export const evaluationCategories = [
  { key: "structuring", label: "Problem Structuring", weight: 1.4, weightQualitative: 1.0 },
  { key: "logic", label: "Logical Thinking", weight: 1.2, weightQualitative: 1.2 },
  {
    key: "segmentation",
    label: "Segmentation",
    labelQualitative: "MECE Coverage",
    weight: 1.3,
    weightQualitative: 1.0,
  },
  {
    key: "assumptions",
    label: "Assumption Quality",
    labelQualitative: "Rationale Quality",
    weight: 1.2,
    weightQualitative: 1.2,
  },
  { key: "calculation", label: "Calculation Accuracy", weight: 1.2, weightQualitative: 0 },
  { key: "diagnosis", label: "Diagnosis", weight: 0, weightQualitative: 1.6 },
  // Shown as "Interaction": what it measures is how much you engage the
  // interviewer — messages sent, reasoning said out loud, figures justified —
  // not polish of speech, which is what "Communication" was read as. The KEY
  // stays `communication` because it is a column on Evaluation and a field on
  // every stored score; only the label a reader sees has changed.
  { key: "communication", label: "Interaction", weight: 0.9, weightQualitative: 1.0 },
  { key: "business", label: "Business Sense", weight: 1.0, weightQualitative: 1.2 },
  { key: "confidence", label: "Confidence", weight: 0.8, weightQualitative: 0.8 },
] as const;

export type EvaluationCategoryKey = (typeof evaluationCategories)[number]["key"];

/** The label a reader sees for this category in this mode. */
export function categoryLabel(
  cat: (typeof evaluationCategories)[number],
  answerMode: "numeric" | "qualitative",
): string {
  return answerMode === "qualitative" && "labelQualitative" in cat
    ? (cat.labelQualitative as string)
    : cat.label;
}

export function categoryWeight(
  cat: (typeof evaluationCategories)[number],
  answerMode: "numeric" | "qualitative",
): number {
  return answerMode === "qualitative" ? cat.weightQualitative : cat.weight;
}

export const readinessBands = [
  { band: "Interview Ready", min: 85 },
  { band: "Advanced", min: 70 },
  { band: "Intermediate", min: 50 },
  { band: "Beginner", min: 0 },
] as const;

export type ReadinessBand = (typeof readinessBands)[number]["band"];

export function readinessForScore(overall: number): ReadinessBand {
  for (const b of readinessBands) {
    if (overall >= b.min) return b.band;
  }
  return "Beginner";
}

/** How close the final estimate must be to the ideal range to score "accurate". */
export const accuracyTolerance = {
  /** Within the ideal [low, high] range => full marks. */
  withinRange: 100,
  /** Within this multiplicative factor of the nearest bound => partial. */
  nearFactor: 2, // within 2x
};

/**
 * The guesstimate rubric, as points earned rather than a mark awarded.
 *
 * **Every category starts at zero and is bought.** The previous shape was a
 * generous baseline plus a small bonus — 40 for structuring, 50 for logic, 48
 * for business sense, each on a floor of 25–35 — so an attempt that segmented
 * nothing, logged nothing and showed no working still totalled about 52 and was
 * told it was "Intermediate". A rubric that pays for turning up cannot then
 * claim the score means anything, and the report is the whole product here.
 *
 * So each number below stands for one aspect of the exercise, the components sum
 * to roughly 100 when all of them are covered, and the sum is clamped to 0–100
 * with no floor underneath. Doing nothing scores nothing; covering everything
 * reaches the top of the scale, which the old 90–95 ceilings did not allow
 * either.
 *
 * These are deliberately whole numbers a professor can retune without reading
 * the scorer — the same posture as the turn budgets in `./practice.ts`.
 */
export const rubric = {
  /** Does a tree exist at all, and does it break the problem up? */
  structuring: {
    perNode: 13,
    maxNodes: 6,
    segmented: 18,
  },

  /** Did they split the population into groups that behave differently? */
  segmentation: {
    segmented: 45,
    perNode: 11,
    maxNodes: 5,
  },

  /** Does the chain of reasoning hold together end to end? */
  logic: {
    hasTree: 25, // >= 2 nodes
    showedWork: 25, // any calculation
    hasAssumptions: 20, // >= 2 derived figures
    landedNear: 20, // hit or near
    deepTree: 10, // >= 4 nodes
  },

  /**
   * Figures, and — the part that is actually scarce — their basis.
   *
   * Most of the headroom sits in `justified` rather than `perAssumption`,
   * because derived figures are numerous (every filled tree box is one) and
   * saying where a number came from is the thing an interviewer listens for.
   */
  assumptions: {
    perAssumption: 8,
    maxCounted: 6,
    quantifiedRatio: 25,
    justifiedRatio: 30,
    weakPenalty: 10,
  },

  /**
   * How many committed figures count as having worked the problem at all.
   *
   * Two, not one, and the difference is the whole guard. A candidate who types
   * their answer as a sentence — "16 crore GB per day" — has produced exactly
   * one quantified fragment, and it reads as justified to `rateAssumption`
   * because of the "per". Treating that as substantiation would hand the full
   * accuracy points back to the bare number this rubric exists to stop scoring.
   */
  substantiationThreshold: 2,

  /**
   * What sibling branches claiming more than the whole costs.
   *
   * Only an overshoot is an error — `sharesOvershoot` in lib/framework-value.ts
   * explains why falling short is not: modelling "the 25% who smoke" and "the
   * 40% in cities" is a deliberate narrowing, and flagging it told candidates to
   * pad their tree with branches they had no use for. Over 100% is double
   * counting, and the arithmetic is wrong however it is read.
   */
  partitionOvershootPenalty: 15,

  /**
   * Accuracy, and whether the number was actually arrived at.
   *
   * `unsubstantiatedCap` is the load-bearing one. Landing in the ideal range
   * used to be worth 80 on its own, so a lucky guess outranked a carefully built
   * estimate that missed — which is exactly the complaint this rubric answers. A
   * figure with no calculation and no stated assumption behind it is not a
   * demonstrated estimate, so it is capped here regardless of where it landed,
   * and the rest of the category is bought by showing the arithmetic.
   */
  calculation: {
    hit: 60,
    near: 35,
    far: 12,
    none: 0,
    unsubstantiatedCap: 20,
    perCalculation: 10,
    maxCalculations: 4,
  },

  /** Did they talk through it, and explain rather than assert? */
  communication: {
    perMessage: 12,
    maxMessages: 5,
    perReasonedClause: 10,
    maxReasonedClauses: 2,
    justifiedRatio: 20,
    /** `justifiedRatio` is paid once this share of figures carries a basis. */
    justifiedThreshold: 0.25,
  },

  /** Judgement beyond the base case — the demand a naive tree misses. */
  business: {
    nuance: 45,
    segmented: 25,
    hasAssumptions: 15, // >= 3 derived figures
    landedNear: 15,
  },

  /**
   * Committing to a defensible answer, less what it took to get there.
   *
   * Deliberately **no "worked without hints" bonus**: it would survive a Teacher
   * mode reveal and let a walked-through attempt outscore one that merely
   * exhausted the hint ladder, which is the one ordering this category exists to
   * express (see `SOLUTION_REVEAL_PENALTY` in lib/evaluation.ts).
   */
  confidence: {
    committed: 30, // gave a final estimate
    hasAssumptions: 25, // >= 3 derived figures
    showedWork: 20, // any calculation
    discussed: 25, // >= 3 messages
  },
} as const;

/**
 * How much the model's read of the tree moves the structural categories.
 *
 * Deterministic rules can tell that a tree has figures, real branches and
 * coherent shares. They cannot tell whether "Population → Adults → Urban" is a
 * sensible decomposition for toothpaste or three words with numbers attached —
 * that is a judgement about meaning, and it is the one a candidate gaming the
 * rubric relies on nobody making. So the model is asked, and its answer scales
 * what the deterministic layer awarded.
 *
 * **Banded rather than applied raw, and that is the point.** A continuous score
 * from a model is not stable: the same tree comes back 61 one run and 68 the
 * next, and a candidate who resubmits identical work to a different number
 * rightly stops trusting the report. Three bands absorb that noise while still
 * separating nonsense from a real decomposition.
 *
 * A missing verdict is not a low one — see `structureBand` in lib/evaluation.ts.
 * With no key, no budget, or a provider that failed, the deterministic score
 * stands unmultiplied, because an app that scores differently depending on
 * whether a network call succeeded is worse than one that scores conservatively.
 */
export const structureJudgement = {
  /** Below this the tree does not describe the problem: nonsense, or unrelated. */
  incoherentBelow: 30,
  /** Below this it is recognisable but loose — right idea, wrong or vague split. */
  looseBelow: 70,

  multipliers: {
    incoherent: 0.25,
    loose: 0.6,
    coherent: 1,
  },
} as const;

/** Which categories the model's read of the tree is allowed to scale. */
export const STRUCTURAL_CATEGORIES = [
  "structuring",
  "segmentation",
  "logic",
  "business",
] as const;
