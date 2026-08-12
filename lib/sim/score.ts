/**
 * Grading a completed run.
 *
 * Five dimensions, each exported on its own so it can be tested directly rather
 * than inferred from a composite — the same posture as `scoreDiagnosis` in
 * `lib/evaluation.ts`.
 *
 * The through-line: **process is graded harder than result.** A candidate who
 * reasons well and is unlucky should out-score one who guesses and is lucky, so
 * Diagnosis and Decision carry the weight, Investigation is gated on having
 * actually found evidence, and Outcome — the number the student cares about
 * most — is the lightest of the five.
 */

import { clamp } from "@/lib/utils";
import { simConfig, weightedSimOverall, bandForSimScore } from "@/lib/config/simulation";
import type { SimBand, SimScores } from "@/lib/config/simulation";
import type { FeedbackItem } from "@/lib/types";
import { hypothesisAtPurchase, type HypothesisLog } from "./hypothesis-log";
import { drilldownById, isEvidenceFor, parCost } from "./investigate";
import { finalValue, totalsByIntervention } from "./outcome";
import type {
  CauseId,
  SimAllocationLine,
  SimDrilldown,
  SimOutcomeResult,
  SimPurchaseRecord,
  SimScenario,
} from "./types";

// ─── Cause-tree helpers ────────────────────────────────────────────────────

/** Ancestor ids of a cause, nearest first. Tolerates a broken parent link. */
export function ancestorsOf(scenario: SimScenario, causeId: CauseId): CauseId[] {
  const byId = new Map(scenario.causes.map((c) => [c.id, c]));
  const out: CauseId[] = [];
  const seen = new Set<CauseId>([causeId]);

  let current = byId.get(causeId)?.parentId ?? null;
  while (current && !seen.has(current)) {
    out.push(current);
    seen.add(current);
    current = byId.get(current)?.parentId ?? null;
  }
  return out;
}

/**
 * Is `candidate` a strict ancestor of any target?
 *
 * This is what "the right region, not the cause" means. Naming "Rider supply"
 * when the cause is "Tier-2 payout cut" is genuinely most of the way there and
 * earns partial credit; naming an unrelated branch does not.
 */
export function isAncestorOfAny(
  scenario: SimScenario,
  candidate: CauseId,
  targets: CauseId[],
): boolean {
  return targets.some((t) => t !== candidate && ancestorsOf(scenario, t).includes(candidate));
}

// ─── The five dimensions ───────────────────────────────────────────────────

/**
 * Did they commit to a credible suspect before spending anything?
 *
 * Naming the maximum allowed and being right scores below naming one and being
 * right. That gap is the point: a hypothesis that hedges across every branch
 * predicts nothing and tells an interviewer nothing.
 *
 * **The `ancestor` branch is currently unreachable, by design of the schema.**
 * `hypothesisSchema` and `diagnosisSchema` (lib/sim/payload.ts) accept leaves
 * only, so no run can name a root and collect `ancestorCredit`. It is kept
 * because the rule it encodes is right — naming the region is worth more than
 * naming the wrong branch — and it works again the day a scenario authors a
 * cause tree deeper than one level. The boundary test in `tests/sim-payload`
 * is what documents the deadness.
 */
export function scoreHypothesis(scenario: SimScenario, suspects: CauseId[]): number {
  if (!suspects.length) return 0;

  const direct = suspects.some((s) => scenario.trueCauseIds.includes(s));
  const ancestor = suspects.some((s) => isAncestorOfAny(scenario, s, scenario.trueCauseIds));

  const extras = Math.max(0, suspects.length - 1);

  let base: number;
  if (direct) base = 100;
  else if (ancestor) base = 100 * simConfig.ancestorCredit;
  // Wrong, but they committed to something falsifiable before looking, which is
  // the habit being built. Worth more than nothing, not much more — and worth
  // less the more branches were named, or "commit to half the board" collects
  // the consolation for a prediction that predicted nothing.
  else return Math.round(15 * Math.pow(simConfig.hedgedMissCredit, extras));

  return Math.round(base * Math.pow(simConfig.shotgunPenalty, extras));
}

/**
 * Did the data they bought answer the question they asked?
 *
 * Under par is full marks and never more — buying less than the cheapest
 * sufficient investigation is not a virtue if it means guessing.
 *
 * A pull counts as relevant if it spoke to a true cause *or* to the hypothesis
 * the candidate held **when they bought it**: chasing a wrong-but-reasonable
 * hypothesis is good practice that happened not to pay, and shouldn't be scored
 * as waste.
 *
 * "When they bought it" is doing real work now that the hypothesis is revisable
 * (`hypothesisEditFor`). Judged against the final belief instead, a run could
 * buy anything at all, revise to name whatever those pulls turned out to be
 * evidence for, and score full relevance for a search it never conducted — the
 * same hindsight problem the old purchase-count lock existed to prevent,
 * wearing this dimension's clothes. `hypothesisAtPurchase` is what closes it,
 * and the question it asks is the better one: was this worth buying, given what
 * you believed at the time?
 *
 * The gate matters most. A run that never bought anything bearing on the real
 * cause is capped however confident its diagnosis — guessing right is worth
 * less than diagnosing right.
 */
export function scoreInvestigation(
  scenario: SimScenario,
  purchases: SimPurchaseRecord[],
  hypothesis: CauseId[],
  log: HypothesisLog = { revisions: [] },
): number {
  if (!purchases.length) return 0;

  const spent = purchases.reduce((sum, p) => sum + p.cost, 0);
  const par = parCost(scenario);
  const parRatio = par > 0 ? par / Math.max(spent, par) : 1;

  const bought = purchases
    .map((p) => ({ record: p, drilldown: drilldownById(scenario, p.drilldownId) }))
    .filter(
      (b): b is { record: SimPurchaseRecord; drilldown: SimDrilldown } => !!b.drilldown,
    );
  if (!bought.length) return 0;

  const relevant = bought.filter(({ record, drilldown }) =>
    isEvidenceFor(drilldown, [
      ...scenario.trueCauseIds,
      ...hypothesisAtPurchase(log, record.seq, hypothesis),
    ]),
  ).length;
  const relevance = relevant / bought.length;

  let score = Math.round(100 * (0.55 * parRatio + 0.45 * relevance));

  const foundEvidence = bought.some(({ drilldown }) =>
    isEvidenceFor(drilldown, scenario.trueCauseIds),
  );
  if (!foundEvidence) score = Math.min(score, simConfig.unevidencedInvestigationCap);

  return clamp(score, 0, 100);
}

/**
 * Did they name the cause that was actually driving it?
 *
 * Coverage matters when a scenario has more than one true cause — naming one of
 * two is a partial diagnosis, not a complete one. Wrong extras cost precision.
 */
export function scoreDiagnosisSim(scenario: SimScenario, named: CauseId[]): number {
  if (!named.length) return 0;

  const hits = named.filter((n) => scenario.trueCauseIds.includes(n)).length;
  if (hits > 0) {
    const coverage = hits / Math.max(1, scenario.trueCauseIds.length);
    const base = 100 * (0.6 + 0.4 * coverage);
    const extras = named.length - hits;
    return Math.round(base * Math.pow(simConfig.shotgunPenalty, extras));
  }

  if (named.some((n) => isAncestorOfAny(scenario, n, scenario.trueCauseIds))) {
    return Math.round(100 * simConfig.ancestorCredit);
  }
  return 8;
}

/**
 * Did capacity go where the leverage was?
 *
 * Capacity is weighted across both currencies, normalised against the budget, so
 * a sprint-heavy and a rupee-heavy commitment are comparable.
 *
 * Stalls are charged separately from the share, because they are a different
 * mistake: funding something below its `minSprints` isn't backing the wrong
 * horse, it's backing the right one with too little to matter — and it can
 * happen while the share looks excellent.
 */
export function scoreDecision(
  scenario: SimScenario,
  allocation: SimAllocationLine[],
  outcome: SimOutcomeResult,
): number {
  if (!allocation.length) return 0;

  const totals = totalsByIntervention(allocation);
  let onTarget = 0;
  let total = 0;

  for (const [id, got] of totals) {
    const iv = scenario.interventions.find((i) => i.id === id);
    if (!iv) continue;

    const sprintShare =
      scenario.budget.sprints > 0 ? got.sprints / scenario.budget.sprints : 0;
    const rupeeShare = scenario.budget.rupees > 0 ? got.rupees / scenario.budget.rupees : 0;
    const weight = (sprintShare + rupeeShare) / 2;

    total += weight;
    if (scenario.trueCauseIds.includes(iv.addresses)) onTarget += weight;
  }

  if (total <= 0) return 0;

  const share = onTarget / total;
  const penalty = outcome.stalled.length * simConfig.stalledDecisionPenalty;
  return clamp(Math.round(100 * share - penalty), 0, 100);
}

/**
 * What the quarters actually did, against what was achievable.
 *
 * Mapped from the do-nothing counterfactual (0) to the scenario's best
 * allocation (100), so it grades against this scenario's ceiling rather than an
 * absolute nobody could calibrate.
 *
 * `goodDirection` needs no special case: `best` defines the good end by
 * construction, so when lower is better the span is simply negative and the
 * same ratio still reads correctly.
 */
export function scoreOutcome(scenario: SimScenario, outcome: SimOutcomeResult): number {
  // The weather is taken out before grading. A run's luck moved its own path,
  // its counterfactual and its ceiling together — see `lib/sim/noise.ts` — but
  // the honest thing to grade is the decision, so two candidates who played
  // identically score identically however their quarters happened to land.
  // Absent on a scenario with no noise, where the realised paths *are* the
  // expectation.
  const src = outcome.expected ?? outcome;

  const ns = scenario.northStar;
  const mine = finalValue(src.paths, ns);
  const floor = finalValue(src.doNothing, ns);
  const ceiling = finalValue(src.best, ns);

  const span = ceiling - floor;
  // A scenario whose best allocation changes nothing has no gradient to grade
  // on. Neutral beats a fabricated 0 or 100.
  if (Math.abs(span) < 1e-9) return 50;

  return clamp(Math.round(((mine - floor) / span) * 100), 0, 100);
}

// ─── Composition ───────────────────────────────────────────────────────────

export interface SimScoreInput {
  scenario: SimScenario;
  /** The final standing hypothesis — what the candidate believed at Commit. */
  hypothesis: CauseId[];
  /**
   * Everything they believed along the way. Absent on a run played before the
   * log existed, which then scores exactly as it did then.
   */
  hypothesisLog?: HypothesisLog;
  purchases: SimPurchaseRecord[];
  diagnosis: CauseId[];
  allocation: SimAllocationLine[];
  outcome: SimOutcomeResult;
}

export interface SimScoreResult {
  overall: number;
  band: SimBand;
  scores: SimScores;
  causeFound: boolean;
  daysSpent: number;
  daysPar: number;
  feedback: FeedbackItem[];
}

export function scoreSimulation(input: SimScoreInput): SimScoreResult {
  const { scenario, hypothesis, hypothesisLog, purchases, diagnosis, allocation, outcome } =
    input;

  const scores: SimScores = {
    hypothesis: scoreHypothesis(scenario, hypothesis),
    investigation: scoreInvestigation(scenario, purchases, hypothesis, hypothesisLog),
    diagnosis: scoreDiagnosisSim(scenario, diagnosis),
    decision: scoreDecision(scenario, allocation, outcome),
    outcome: scoreOutcome(scenario, outcome),
  };

  const overall = weightedSimOverall(scores);
  const daysSpent = purchases.reduce((sum, p) => sum + p.cost, 0);
  const daysPar = parCost(scenario);
  const causeFound = diagnosis.some((d) => scenario.trueCauseIds.includes(d));

  return {
    overall,
    band: bandForSimScore(overall),
    scores,
    causeFound,
    daysSpent,
    daysPar,
    feedback: buildFeedback({ scenario, scores, causeFound, daysSpent, daysPar, outcome }),
  };
}

/** Itemised notes for the report. Reuses the `FeedbackItem` shape. */
function buildFeedback(args: {
  scenario: SimScenario;
  scores: SimScores;
  causeFound: boolean;
  daysSpent: number;
  daysPar: number;
  outcome: SimOutcomeResult;
}): FeedbackItem[] {
  const { scenario, scores, causeFound, daysSpent, daysPar, outcome } = args;
  const items: FeedbackItem[] = [];

  if (causeFound) {
    items.push({ tone: "positive", text: "You named the cause that was actually driving the drop." });
  } else {
    items.push({
      tone: "warning",
      text: "The cause you committed to wasn't the one moving the metric, so the capacity you spent had little to work with.",
    });
  }

  if (daysSpent <= daysPar && causeFound) {
    items.push({
      tone: "positive",
      text: `You found it in ${daysSpent} analyst-days against a par of ${daysPar} — that is the habit interviewers are listening for.`,
    });
  } else if (daysSpent > daysPar * 1.5) {
    items.push({
      tone: "tip",
      text: `You spent ${daysSpent} analyst-days where ${daysPar} would have done. Ask what each pull would rule out before buying it.`,
    });
  }

  if (scores.hypothesis < 50) {
    items.push({
      tone: "tip",
      text: "A sharper opening hypothesis narrows the search before it starts. Read the free dashboard for what it rules out, not just what it shows.",
    });
  }

  for (const id of outcome.stalled) {
    const iv = scenario.interventions.find((i) => i.id === id);
    if (!iv) continue;
    items.push({
      tone: "warning",
      text: `"${iv.label}" was funded below the point where it ships, so the capacity was spent and nothing landed. Fully funding fewer bets beats part-funding several.`,
    });
  }

  if (scores.decision >= 70 && scores.outcome < 50) {
    items.push({
      tone: "tip",
      text: "Your capacity went to the right place but the quarter still lagged the best case — worth checking whether a bigger share of the budget on the same bet would have moved it further.",
    });
  }

  return items;
}
