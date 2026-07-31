/**
 * Evaluation rubric configuration: the 8 scored categories, their weights,
 * and the readiness bands. Tweak scoring here without touching the scorer.
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
  { key: "communication", label: "Communication", weight: 0.9, weightQualitative: 1.0 },
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
  nearScore: 65,
  farScore: 30,
};
