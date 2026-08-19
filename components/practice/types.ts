import type { AiMode } from "@/lib/config";
import type { AnswerMode, NodeOrigin, NodeStatus, TreeMode } from "@/lib/types";

export interface UiMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  hintLevel?: number | null;
  /**
   * Which conversation this turn belongs to — see `transcriptFor`. Absent on
   * rows written before the two were split; those read as the interview, which
   * is where they were said.
   */
  mode?: string | null;
  /**
   * Engine that produced an assistant turn. Badged in the UI when it isn't the
   * configured provider: any "mock*" value as the offline interviewer, and a
   * "<name> (fallback)" value as the backup model that stood in for it.
   */
  provider?: string | null;
  /** True while deltas are still arriving for this message. */
  streaming?: boolean;
  /** Set when the turn was cut short — the content is a partial answer. */
  interrupted?: boolean;
}

export interface UiCalculation {
  id: string;
  expression: string;
  resultText: string | null;
}

export interface UiFrameworkNode {
  id: string;
  parentId: string | null;
  label: string;
  value?: string | null;
  /** Second factor applied on top of `value` — a per-segment rate. Blank = 1. */
  multiplier?: string | null;
  /** How this node's children combine into its own computed value (2+ children only). */
  combine: "sum" | "multiply";
  /** Qualitative only — the candidate's judgement about this branch. Never derived. */
  status?: NodeStatus | null;
  /** Qualitative only — optional typed rationale, when none was inherited from chat. */
  note?: string | null;
  /** The chat turn this bucket came from; its text is the node's rationale. */
  sourceMessageId?: string | null;
  origin?: NodeOrigin | null;
}

export interface PracticeQuestion {
  id: string;
  title: string;
  prompt: string;
  category: string;
  difficulty: string;
  interviewLevel: string;
  unit: string | null;
  /** Drives the builder, the answer box, the prompts and the scorer. */
  answerMode: AnswerMode;
  /** Framework slug this case is written against, when authored. */
  framework: string | null;
  /**
   * Whether this question has facts to release. Only the presence matters on the
   * client — the facts themselves stay server-side so the tree can't be read off
   * the page source.
   */
  hasDataPack: boolean;
}

export interface PracticeData {
  attemptId: string;
  isGuest: boolean;
  showOnboarding: boolean;
  status: string;
  question: PracticeQuestion;
  messages: UiMessage[];
  calculations: UiCalculation[];
  framework: UiFrameworkNode[];
  mode: AiMode;
  finalEstimate: number | null;
  /** The recommendation in words — the qualitative counterpart of finalEstimate. */
  finalAnswer: string | null;
  /** Null on numeric attempts; fixed for the life of a qualitative one. */
  treeMode: TreeMode | null;
  hintsUsed: number;
  /**
   * Turns left on this attempt at page load, or null when the per-attempt
   * budget is disabled. Resolved on the server so the counter is correct before
   * the first message rather than after it.
   */
  initialRemaining: number | null;
  timeSpentSec: number;
}
