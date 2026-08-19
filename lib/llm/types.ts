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

/**
 * A finished simulation, for the debrief coach.
 *
 * Present only after a run commits, and the difference from an interview
 * context is total: the run is over, so the cause IS revealed and the model is
 * expected to explain it rather than withhold it.
 */
export interface SimCoachContext {
  scenarioTitle: string;
  company: string;
  /**
   * Who debriefs this scenario. Absent leaves the default product-leader coach,
   * which is what every scenario written before finance joined the library
   * relies on.
   */
  mentor?: { persona: string; audience: string };
  trueCauseLabels: string[];
  causalChain: string[];
  whereTheLeverageWas: string;
  /** One bullet per point — see `SimDebriefCopy.strongAnswer`. */
  strongAnswer: string[];
  studentDiagnosis: string[];
  studentAllocation: { label: string; sprints: number; rupees: number; onTarget: boolean }[];
  scores: { label: string; value: number }[];
  outcomeSummary: string;
  /** Same shape and same contract as `Question.dataPack` — matched by topic. */
  facts: { topic: string[]; fact: string }[];
}

/**
 * A finished framework, for the structure judge.
 *
 * Present only at submit time, and like `SimCoachContext` it changes the whole
 * prompt rather than adding to it — the model is not interviewing here, it is
 * reading a tree and saying whether it decomposes this question.
 */
export interface FrameworkJudgeContext {
  questionTitle: string;
  questionPrompt: string;
  /** The tree, flattened depth-first with indentation carrying the hierarchy. */
  nodes: { depth: number; label: string; value?: string | null; rate?: string | null }[];
  finalEstimate: number | null;
  unit: string | null;
}

/** Everything an adapter needs to produce the next interviewer turn. */
export interface InterviewerContext {
  question: QuestionContext;
  mode: AiMode;
  /** Which exercise this is: a market-sizing estimate, or a case. */
  answerMode?: "numeric" | "qualitative";
  messages: ConvMessage[];
  assumptions: AssumptionCtx[];
  /** `status` is the candidate's own verdict on a branch; qualitative only. */
  framework: { label: string; status?: string | null }[];
  finalEstimate?: number | null;
  finalAnswer?: string | null;
  /**
   * Facts the interviewer may state when asked about that topic. Authored per
   * question so the model reports data rather than inventing it.
   */
  dataPack?: { topic: string[]; fact: string }[];
  hintsUsed: number;
  /**
   * Set only for a simulation debrief. When present the whole prompt changes —
   * see `buildReplyMessages` — which is why it rides the existing context
   * rather than needing a third adapter method: all five adapters build their
   * prompt through that one function, so none of them change.
   */
  simulation?: SimCoachContext;
  /**
   * Set only when scoring a submitted framework. Like `simulation`, it replaces
   * the prompt rather than extending it, and it rides the existing context for
   * the same reason: every adapter builds through `buildReplyMessages`, so none
   * of them change.
   */
  judge?: FrameworkJudgeContext;
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
