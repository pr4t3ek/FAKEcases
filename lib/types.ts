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

export const QUESTION_TYPES = ["guesstimate", "case"] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

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
