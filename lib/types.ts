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

export const QUESTION_TYPES = ["guesstimate", "qualitative", "case"] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

/**
 * The types a candidate can actually practise today, and therefore the only ones
 * worth authoring. `case` is reserved in `QUESTION_TYPES` for the full-length
 * interview format and has no runtime yet, so the library filters it out — which
 * makes it a trap in an authoring dropdown, not an option.
 */
export const PRACTISABLE_TYPES = ["guesstimate", "qualitative"] as const;
export type PractisableType = (typeof PRACTISABLE_TYPES)[number];

/**
 * How a question is answered, and therefore how it is built and scored.
 *
 * Everything downstream branches on this rather than on `type`, so a question
 * type that behaves like an issue tree — `case`, eventually — costs one line
 * here instead of a second pass through the builder, the scorer and the prompts.
 */
export const ANSWER_MODES = ["numeric", "qualitative"] as const;
export type AnswerMode = (typeof ANSWER_MODES)[number];

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
