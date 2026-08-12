/**
 * Decision-simulation tunables: the scored dimensions, their weights, the result
 * bands, and the limits on what a candidate may name.
 *
 * Deliberately a separate module from `./evaluation` rather than more rows in
 * it. A simulation is not an interview attempt — it writes no `Evaluation`, it
 * never reaches `weightedOverall`, and its result must never move a percentile
 * rank. Two rubrics that cannot be confused for one another is the point.
 */

/**
 * The five scored dimensions.
 *
 * Unlike `evaluationCategories` there is no null arm and no per-mode weight:
 * every run passes through every phase, so no dimension is ever "not applicable"
 * to a completed run.
 *
 * Outcome carries the LIGHTEST weight, which is the opposite of what the name
 * suggests and is deliberate. What is being taught is judgement under
 * uncertainty, and the outcome is already largely determined by Diagnosis and
 * Decision — weighting it heavily would collapse the scorecard into one number
 * wearing five hats, and would punish a well-reasoned call that the scenario's
 * causal model happened to treat harshly.
 */
export const simRubric = [
  {
    key: "hypothesis",
    label: "Hypothesis quality",
    hint: "Did you commit to a credible suspect before spending a rupee?",
    weight: 1.0,
  },
  {
    key: "investigation",
    label: "Investigation efficiency",
    hint: "Did the data you bought answer the question you asked?",
    weight: 1.2,
  },
  {
    key: "diagnosis",
    label: "Diagnosis accuracy",
    hint: "Did you name the cause that was actually driving the drop?",
    weight: 1.5,
  },
  {
    key: "decision",
    label: "Decision quality",
    hint: "Did capacity go where the leverage was?",
    weight: 1.5,
  },
  {
    key: "outcome",
    label: "Outcome",
    hint: "What the next quarters actually did, against what was achievable.",
    weight: 0.8,
  },
] as const;

export type SimRubricKey = (typeof simRubric)[number]["key"];

/** The five scores a completed run carries. Mirrors the `SimResult` columns. */
export type SimScores = Record<SimRubricKey, number>;

/**
 * Result bands.
 *
 * Deliberately different vocabulary from `readinessBands` ("Interview Ready",
 * "Advanced", …). A simulation says nothing about interview readiness, and
 * sharing the words would invite exactly that reading.
 */
export const simBands = [
  { band: "Shipping-ready", min: 85 },
  { band: "Strong", min: 70 },
  { band: "Developing", min: 50 },
  { band: "Reactive", min: 0 },
] as const;

export type SimBand = (typeof simBands)[number]["band"];

export function bandForSimScore(overall: number): SimBand {
  for (const b of simBands) {
    if (overall >= b.min) return b.band;
  }
  return "Reactive";
}

/** Weighted mean over the five dimensions. No nulls, so no renormalisation. */
export function weightedSimOverall(scores: SimScores): number {
  let weighted = 0;
  let total = 0;
  for (const dim of simRubric) {
    weighted += scores[dim.key] * dim.weight;
    total += dim.weight;
  }
  return Math.round(weighted / total);
}

export const simConfig = {
  /**
   * Suspects nameable at the end of Observe, and causes nameable at Commit.
   *
   * Capped because an uncapped list is not a hypothesis. Naming every branch
   * guarantees a hit and tells an interviewer nothing, which is precisely the
   * habit this phase exists to break.
   */
  maxSuspects: 3,
  maxCausesNamed: 3,
  /** Credit for naming an ancestor of the true cause — the right region, not the cause. */
  ancestorCredit: 0.55,
  /**
   * Score multiplier per extra cause named beyond the first correct one.
   *
   * Lowered from 0.8 when the cap rose from two to three, because the old value
   * did not survive the wider board. The test to run is expected value against
   * a random guesser: on a six-leaf tree, naming three suspects hits with
   * probability 3/6, and `0.5 × 100 × 0.8² = 32` already beats the 29.2 a
   * single random pick earns. Hedging *paid*, on the dimension whose entire
   * purpose is to make a candidate commit.
   *
   * No adjustment to the miss credit can fix that — the hit term alone clears
   * it — so the multiplier itself had to come down. At 0.7 a single pick
   * dominates two and three across every board size we author (6, 8, 10 and 12
   * leaves), which `tests/sim-score.test.ts` pins as a property rather than as
   * a number.
   */
  shotgunPenalty: 0.7,
  /**
   * Multiplier per extra suspect on the consolation a wrong-but-committed
   * hypothesis earns.
   *
   * The flat 15 was defensible for one pick — you committed to something
   * falsifiable, which is the habit — and indefensible for three, where it
   * became a participation fee for naming half the board.
   */
  hedgedMissCredit: 0.5,
  /**
   * Ceiling on Investigation when no purchased drilldown was evidence for the
   * cause eventually named. Guessing right is worth less than diagnosing right —
   * the same principle as the `unevidenced` clamp in `lib/evaluation.ts`.
   */
  unevidencedInvestigationCap: 45,
  /** Score cost of funding an intervention below its `minSprints`, per stall. */
  stalledDecisionPenalty: 18,

  // ─── v2 engine: how money becomes effect ─────────────────────────────────

  /**
   * The response curve an effect gets when neither it nor its intervention
   * states one. The arm is the important part: an intervention aimed at
   * something that is not the problem **saturates early and low**, which is the
   * whole reason pouring money at the wrong cause has to stop working.
   *
   * Read the numbers as: on target, half the effect has arrived by 45% of the
   * ask and there is always a little more past it. Off target, the ceiling is
   * a third of the authored effect, half of that arrives at a fifth of the ask,
   * and 95% of it by 86% of the ask — so the second crore into the wrong lever
   * is worth roughly a thousandth of the first.
   */
  responseDefaults: {
    onTarget: { kind: "hill", ceiling: 1.3, halfAt: 0.45 },
    offTarget: { kind: "exponential", ceiling: 0.35, halfAt: 0.2 },
  },
  /** Default cap on what one intervention may be given, as a multiple of its ask. */
  maxAskMultiple: 3,
  /** Share of the ceiling that counts as "this has stopped paying". */
  satiationFraction: 0.95,
  /**
   * How far the authored best must beat "fund everything to its cap" before a
   * v2 scenario is certified.
   *
   * Without this a scenario could carry response curves and still have
   * "spend everything" as its answer, which is the exact play the curves exist
   * to retire — and it would validate, balance and score perfectly while doing
   * it. `checkBalance` refuses instead.
   */
  interiorityMargin: 0.02,
  /**
   * How much better spending the leftover money must be before `checkBalance`
   * calls an underspent ceiling an oversight rather than a decision.
   *
   * Not float slack — a materiality threshold. Under saturation the last
   * rupees of a budget routinely buy a hundredth of a percent, and a scenario
   * whose declared best banks them is making exactly the point the format is
   * for. Anything above this is money that was obviously worth spending.
   */
  spareMoneyTolerance: 0.005,
} as const;
