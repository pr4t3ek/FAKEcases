/**
 * Evaluation rubric configuration: the 8 scored categories, their weights,
 * and the readiness bands. Tweak scoring here without touching the scorer.
 */

export const evaluationCategories = [
  { key: "structuring", label: "Problem Structuring", weight: 1.4 },
  { key: "logic", label: "Logical Thinking", weight: 1.2 },
  { key: "segmentation", label: "Segmentation", weight: 1.3 },
  { key: "assumptions", label: "Assumption Quality", weight: 1.2 },
  { key: "calculation", label: "Calculation Accuracy", weight: 1.2 },
  { key: "communication", label: "Communication", weight: 0.9 },
  { key: "business", label: "Business Sense", weight: 1.0 },
  { key: "confidence", label: "Confidence", weight: 0.8 },
] as const;

export type EvaluationCategoryKey = (typeof evaluationCategories)[number]["key"];

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
