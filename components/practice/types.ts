import type { AiMode } from "@/lib/config";

export interface UiMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  hintLevel?: number | null;
}

export interface UiAssumption {
  id: string;
  key: string;
  value: string;
  rating: string | null;
  aiNote: string | null;
}

export interface UiCalculation {
  id: string;
  expression: string;
  resultText: string | null;
}

export interface UiFrameworkNode {
  label: string;
  value?: string | null;
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
  assumptions: UiAssumption[];
  calculations: UiCalculation[];
  framework: UiFrameworkNode[];
  mode: AiMode;
  finalEstimate: number | null;
  hintsUsed: number;
  timeSpentSec: number;
}
