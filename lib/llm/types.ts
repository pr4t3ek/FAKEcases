import type { AiMode } from "@/lib/config";

/** Minimal question context the interviewer needs. */
export interface QuestionContext {
  title: string;
  prompt: string;
  category: string;
  difficulty: string;
  interviewLevel: string;
  idealLow: number | null;
  idealHigh: number | null;
  unit: string | null;
  betterApproach: string;
  sampleSolution: string;
}

export interface ConvMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface AssumptionCtx {
  key: string;
  value: string;
  rating?: string | null;
}

/** Everything an adapter needs to produce the next interviewer turn. */
export interface InterviewerContext {
  question: QuestionContext;
  mode: AiMode;
  messages: ConvMessage[];
  assumptions: AssumptionCtx[];
  framework: { label: string }[];
  finalEstimate?: number | null;
  hintsUsed: number;
}

/**
 * Adapters are stream-first: every provider yields text deltas, and callers that
 * cannot stream (e.g. the server action that seeds an attempt's opening turn)
 * use `collect()` from `./index`. Keeping a single method per operation stops
 * the streaming and non-streaming paths from drifting apart.
 */
export interface LlmAdapter {
  /** The provider name (for diagnostics / UI). */
  readonly name: string;
  /** Model identifier, when the provider has one. Recorded on each Message. */
  readonly model?: string;
  /** Generate the next interviewer turn. */
  reply(ctx: InterviewerContext): AsyncIterable<string>;
  /** Generate a hint at the given escalating level (1..N). */
  hint(ctx: InterviewerContext, level: number): AsyncIterable<string>;
}
