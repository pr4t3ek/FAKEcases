/** Allowed values for enum-like String columns (SQLite has no DB enums). */

export const DIFFICULTIES = ["Easy", "Medium", "Hard"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const INTERVIEW_LEVELS = [
  "BCG",
  "McKinsey",
  "Bain",
  "Big4",
  "PM",
  "Product",
  "GeneralMBA",
] as const;
export type InterviewLevel = (typeof INTERVIEW_LEVELS)[number];

export const INTERVIEW_LEVEL_LABELS: Record<InterviewLevel, string> = {
  BCG: "BCG",
  McKinsey: "McKinsey",
  Bain: "Bain",
  Big4: "Big 4",
  PM: "PM",
  Product: "Product",
  GeneralMBA: "General MBA",
};

/**
 * The levels that name an actual employer, for the library's company filter.
 *
 * `INTERVIEW_LEVELS` is two vocabularies wearing one coat: four firms you could
 * be interviewing with, and three roles or audiences you could be preparing as.
 * Offering all seven under one "company" control asks the candidate to read
 * "General MBA" as a company.
 *
 * Derived by subtraction rather than written out again — the same posture as
 * `PRACTICE_TYPES` below — so a firm added to `INTERVIEW_LEVELS` reaches the
 * filter on its own, and only a *role* has to be named here.
 *
 * Deliberately a view over the vocabulary and not a replacement for it.
 * `INTERVIEW_LEVELS` is also the enum behind the authoring contract
 * (`lib/question-schema.ts`), profile goals (`lib/profile-schema.ts`) and the
 * admin form, and 7 of the 26 library questions carry one of the roles. Narrowing
 * the source list would invalidate seeded content and saved goals; narrowing the
 * *filter* only means those questions are reached through "All companies".
 */
const ROLE_LEVELS: readonly InterviewLevel[] = ["PM", "Product", "GeneralMBA"];

export const COMPANY_LEVELS = INTERVIEW_LEVELS.filter(
  (l) => !ROLE_LEVELS.includes(l),
);

export function isCompanyLevel(level: string): boolean {
  return (COMPANY_LEVELS as readonly string[]).includes(level);
}

/**
 * The industry a question is set in.
 *
 * Its own dimension rather than another `Category`, because a question has
 * exactly one category and the two axes are independent: "Market Sizing" is what
 * you are being asked to do, "Food & Beverage" is what it is about. Filing chai
 * under `market-sizing` used to mean it could not be found by anyone browsing
 * food and beverage, and filing it under `food-beverage` would have lost the
 * technique — a single column cannot answer both questions.
 *
 * Kebab-case values because they travel in a query string beside `category`,
 * whose slugs already look like this. Labels are separate for the ones that
 * don't round-trip.
 */
export const SECTORS = [
  "food-beverage",
  "retail",
  "consumer-goods",
  "healthcare",
  "technology",
  "telecom",
  "education",
  "transportation",
  "automotive",
  "manufacturing",
  "financial-services",
  "energy",
  "media-entertainment",
] as const;
export type Sector = (typeof SECTORS)[number];

export const SECTOR_LABELS: Record<Sector, string> = {
  "food-beverage": "Food & Beverage",
  retail: "Retail",
  "consumer-goods": "Consumer Goods",
  healthcare: "Healthcare",
  technology: "Technology",
  telecom: "Telecom",
  education: "Education",
  transportation: "Transportation",
  automotive: "Automotive",
  manufacturing: "Manufacturing",
  "financial-services": "Financial Services",
  energy: "Energy",
  "media-entertainment": "Media & Entertainment",
};

export const QUESTION_TYPES = ["guesstimate", "qualitative", "case", "simulation"] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

/**
 * The types a candidate can actually practise today. `case` is reserved in
 * `QUESTION_TYPES` for the full-length interview format and has no runtime yet,
 * so the library filters it out.
 */
export const PRACTISABLE_TYPES = ["guesstimate", "qualitative", "simulation"] as const;
export type PractisableType = (typeof PRACTISABLE_TYPES)[number];

/**
 * The types that can be authored through the admin panel or the CSV importer,
 * which is a narrower set than what can be practised.
 *
 * A `simulation` row is a catalogue entry — title, category, difficulty — while
 * the exercise itself (dashboard, drilldowns, causal model) is authored in code
 * under `lib/sim/scenarios`. There is nothing useful a form could write, and a
 * row created without a matching scenario is inert. Keeping the type out of the
 * authoring contract means that row can never be created by accident.
 */
export const AUTHORABLE_TYPES = ["guesstimate", "qualitative"] as const;
export type AuthorableType = (typeof AUTHORABLE_TYPES)[number];

export const SIMULATION_TYPE = "simulation";

export function isSimulation(type: string): boolean {
  return type === SIMULATION_TYPE;
}

/**
 * The practice formats — everything a candidate *answers*, as opposed to plays.
 *
 * War rooms have their own catalogue at `/simulations`, so the library and the
 * recommendation strip read this rather than `PRACTISABLE_TYPES`. A twenty-minute
 * guesstimate and a four-phase war room with its own budget are not
 * interchangeable, and a list that offers them side by side says they are.
 *
 * Derived rather than written out again, so adding a format to
 * `PRACTISABLE_TYPES` cannot silently leave this behind.
 */
export const PRACTICE_TYPES = PRACTISABLE_TYPES.filter((t) => !isSimulation(t));

/**
 * Which catalogue is being read or gated.
 *
 * `/library` answers "what can I practise?" and `/simulations` answers "which
 * war room shall I play?". They differ in what a card offers, what the counts
 * mean and where a refused gate should bounce you back to — so it is a
 * parameter rather than something each call site remembers to filter for.
 *
 * Here rather than in `lib/questions.ts` because `lib/entitlements.ts` needs it
 * and is deliberately DB-free.
 */
export type QuestionSurface = "practice" | "simulation";

/**
 * A simulation run's phase. Strictly forward: `canAdvanceSimPhase` allows only
 * the next one, and the server enforces it.
 *
 * Going back to `observe` after seeing drilldown data would make the hypothesis
 * score theatre — name a suspect, buy the data, then quietly revise. It is the
 * same reason `TREE_MODES` is fixed when an attempt is created.
 */
export const SIM_PHASES = ["observe", "investigate", "commit", "debrief"] as const;
export type SimPhase = (typeof SIM_PHASES)[number];

export function canAdvanceSimPhase(from: SimPhase, to: SimPhase): boolean {
  return SIM_PHASES.indexOf(to) === SIM_PHASES.indexOf(from) + 1;
}

/**
 * What may still be done to the hypothesis.
 *
 * The window used to close at the **first purchase**, on the argument that a
 * hypothesis revised in the light of evidence is not a hypothesis. That
 * argument is half right and the half it got wrong is the important half: a
 * *prediction* you may not revise when the data contradicts it is not a
 * hypothesis either, it is a guess you are stuck with. Updating a belief on
 * evidence is the thing this format should be teaching, and the lock punished
 * it — a candidate who bought the pull that proved them wrong had no way to say
 * so, and watched the run continue under a belief they no longer held.
 *
 * So it now closes at the **Commit boundary** instead, which keeps the two
 * cause-naming steps measuring different things:
 *
 *   - **Hypothesis** — your best read given the data you chose to buy.
 *   - **Diagnosis** — your final answer, with the whole board and the fixes in
 *     view, and irreversible once named.
 *
 * The integrity the old rule was protecting has not been given up, it has moved
 * where it belongs. Every revision is logged with the purchase count it was
 * made at (`lib/sim/hypothesis-log.ts`), and `scoreInvestigation` judges each
 * pull against the belief that was standing when it was bought — so rewriting
 * the hypothesis to match whatever you happened to buy earns nothing.
 */
export type HypothesisEdit = "advance" | "amend" | "locked";

export function hypothesisEditFor(phase: SimPhase): HypothesisEdit {
  if (phase === "observe") return "advance";
  if (phase === "investigate") return "amend";
  return "locked";
}

/**
 * How a question is answered, and therefore how it is built and scored.
 *
 * Everything downstream branches on this rather than on `type`, so a question
 * type that behaves like an issue tree — `case`, eventually — costs one line
 * here instead of a second pass through the builder, the scorer and the prompts.
 */
export const ANSWER_MODES = ["numeric", "qualitative"] as const;
export type AnswerMode = (typeof ANSWER_MODES)[number];

/**
 * Meaningful only for the interview types. A `simulation` is not answered, it is
 * played: it never creates an `Attempt`, so it never reaches the scorer, the
 * framework builder or the prompts that read this.
 *
 * It still returns `"qualitative"` for one rather than throwing, because the
 * honest fix is to not call it — `isSimulation` is checked first at the two
 * places that could (`question-card.tsx`, `app/library/page.tsx`), and
 * `AUTHORABLE_TYPES` keeps the type out of the authoring contract entirely.
 * A test pins this return value so it stays documented rather than latent.
 */
export function answerModeFor(type: string): AnswerMode {
  return type === "guesstimate" ? "numeric" : "qualitative";
}

/**
 * How much of the tree the app builds for the candidate.
 *
 * Fixed when the attempt is created: without the lock, "solo" is theatre —
 * switch to guided, take the structure, switch back. A guided attempt cannot be
 * graded on structure (see `lib/evaluation.ts`), which is what keeps the offer
 * honest rather than free marks.
 */
export const TREE_MODES = ["solo", "guided"] as const;
export type TreeMode = (typeof TREE_MODES)[number];

/**
 * A branch's diagnostic state. Set only by the candidate and never derived:
 * marking a child "problem" says nothing about its parent, because "the problem
 * is somewhere in here" and "this is the cause" are different claims. A trail of
 * `problem` nodes narrowing to a leaf is what a solved case looks like.
 */
export const NODE_STATUSES = ["unknown", "healthy", "problem"] as const;
export type NodeStatus = (typeof NODE_STATUSES)[number];

export const NODE_STATUS_META: Record<
  NodeStatus,
  { label: string; short: string; hint: string }
> = {
  unknown: { label: "Not examined", short: "—", hint: "Not looked at yet" },
  healthy: { label: "Healthy", short: "OK", hint: "Checked — the problem isn't here" },
  problem: {
    label: "Problem",
    short: "!",
    hint: "The problem is somewhere in here — break it down further",
  },
};

/** Where a node came from, so scoring can tell a self-built tree from a supplied one. */
export const NODE_ORIGINS = ["manual", "chat", "scaffold", "suggested"] as const;
export type NodeOrigin = (typeof NODE_ORIGINS)[number];

export const ATTEMPT_STATUSES = ["in_progress", "submitted", "abandoned"] as const;
export type AttemptStatus = (typeof ATTEMPT_STATUSES)[number];

export const MESSAGE_ROLES = ["user", "assistant", "system"] as const;
export type MessageRole = (typeof MESSAGE_ROLES)[number];

export const ASSUMPTION_RATINGS = [
  "Excellent",
  "Reasonable",
  "NeedsJustification",
  "Weak",
] as const;
export type AssumptionRating = (typeof ASSUMPTION_RATINGS)[number];

export const ASSUMPTION_RATING_META: Record<
  AssumptionRating,
  { label: string; tone: "success" | "muted" | "warning" | "destructive" }
> = {
  Excellent: { label: "Excellent", tone: "success" },
  Reasonable: { label: "Reasonable", tone: "muted" },
  NeedsJustification: { label: "Needs justification", tone: "warning" },
  Weak: { label: "Weak", tone: "destructive" },
};

export const FEEDBACK_TYPES = [
  "WrongAnswer",
  "Typo",
  "Unclear",
  "FactualError",
  "Inappropriate",
  "Other",
] as const;
export type FeedbackType = (typeof FEEDBACK_TYPES)[number];

export const FEEDBACK_TYPE_LABELS: Record<FeedbackType, string> = {
  WrongAnswer: "Wrong answer / range",
  Typo: "Typo",
  Unclear: "Unclear wording",
  FactualError: "Factual error",
  Inappropriate: "Inappropriate",
  Other: "Other",
};

export const FEEDBACK_STATUSES = ["Open", "Reviewing", "Resolved", "Dismissed"] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

/** Shape of a single itemized feedback line stored in Evaluation.feedback JSON. */
export interface FeedbackItem {
  tone: "positive" | "warning" | "tip";
  text: string;
}
