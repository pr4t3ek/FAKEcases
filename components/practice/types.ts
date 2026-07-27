import type { AiMode } from "@/lib/config";

export interface UiMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  hintLevel?: number | null;
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
}

export interface PracticeQuestion {
  id: string;
  title: string;
  prompt: string;
  category: string;
  difficulty: string;
  interviewLevel: string;
  unit: string | null;
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
  hintsUsed: number;
  timeSpentSec: number;
}
