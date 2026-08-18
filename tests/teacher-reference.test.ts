import { describe, it, expect } from "vitest";
import { buildReplyMessages, buildHintMessages } from "@/lib/llm/build-messages";
import { renderTeacherReference } from "@/lib/llm/prompts";
import type { InterviewerContext, QuestionContext } from "@/lib/llm";

const question: QuestionContext = {
  title: "Daily mobile data consumed in India",
  prompt: "Estimate the total mobile data consumed in India per day.",
  category: "Telecom",
  difficulty: "medium",
  interviewLevel: "McKinsey",
  idealLow: 270_000_000,
  idealHigh: 300_000_000,
  unit: "GB/day",
  betterApproach: "Segment by smartphone users and average daily usage.",
  sampleSolution: "~45 cr users × ~0.6-0.7 GB/day ≈ 27-30 crore GB/day.",
};

function ctx(over: Partial<InterviewerContext> = {}): InterviewerContext {
  return {
    question,
    mode: "teacher",
    answerMode: "numeric",
    messages: [{ role: "user", content: "Just show me how it's done." }],
    assumptions: [],
    framework: [],
    hintsUsed: 0,
    ...over,
  };
}

/**
 * Teacher mode is the one mode that works the problem, and it used to do so with
 * no anchor: the authored answer reached `QuestionContext` and stopped there. So
 * the model derived a fresh estimate on every retry while the evaluation screen
 * kept showing the one authored figure as "Sample solution".
 */
describe("the teacher's reference solution", () => {
  it("hands the authored answer to the teacher", () => {
    const { system } = buildReplyMessages(ctx());
    expect(system).toContain("REFERENCE SOLUTION");
    expect(system).toContain(question.sampleSolution);
    expect(system).toContain(question.betterApproach);
  });

  it("states the accepted range in figures the model can check against", () => {
    const { system } = buildReplyMessages(ctx());
    expect(system).toContain("27,00,00,000");
    expect(system).toContain("30,00,00,000");
    expect(system).toContain("GB/day");
  });

  // The whole point: the same question must teach the same answer twice.
  it("is identical across turns, so a retry teaches the same number", () => {
    const first = buildReplyMessages(ctx()).system;
    const second = buildReplyMessages(
      ctx({ messages: [{ role: "user", content: "again please" }] }),
    ).system;
    expect(first).toBe(second);
  });

  /*
   * Every other mode is explicitly forbidden from revealing the answer, so the
   * reference must not reach them. This is the assertion that would catch the
   * block being moved into `renderContextBlock`, where it would leak.
   */
  it("is withheld from every mode that must not reveal the answer", () => {
    for (const mode of ["interviewer", "coach", "evaluator"] as const) {
      const { system } = buildReplyMessages(ctx({ mode }));
      expect(system, mode).not.toContain("REFERENCE SOLUTION");
      expect(system, mode).not.toContain(question.sampleSolution);
    }
  });

  // A candidate sitting in Teacher mode can still ask for a hint, and a hint is
  // forbidden from stating the final number.
  it("never reaches a hint prompt, even from inside teacher mode", () => {
    const { system } = buildHintMessages(ctx({ mode: "teacher" }), 3);
    expect(system).not.toContain("REFERENCE SOLUTION");
    expect(system).not.toContain(question.sampleSolution);
  });

  it("leaves an unauthored question teaching exactly as it did before", () => {
    const bare = ctx({
      question: { ...question, sampleSolution: "", betterApproach: "", idealLow: null, idealHigh: null },
    });
    expect(renderTeacherReference(bare)).toBe("");
    expect(buildReplyMessages(bare).system).not.toContain("REFERENCE SOLUTION");
  });

  it("drops the range for a case and asks for the recommendation instead", () => {
    const block = renderTeacherReference(ctx({ answerMode: "qualitative" }));
    expect(block).toContain("Sample recommendation");
    expect(block).not.toContain("Accepted range");
  });
});

/*
 * The instruction lives in the reference block, not in `MODE_PROMPTS`, so a
 * question with nothing authored is untouched by this change rather than being
 * told to teach toward a block that was never appended.
 */
describe("questions with no authored answer", () => {
  it("builds the prompt it built before the reference existed", () => {
    const bare = ctx({
      question: { ...question, sampleSolution: "", betterApproach: "", idealLow: null, idealHigh: null },
    });
    const system = buildReplyMessages(bare).system;
    expect(system).not.toMatch(/REFERENCE SOLUTION|reference solution/i);
    expect(system).toContain("showing the reasoning and a sample estimate");
  });
});

/*
 * The interviewer's posture toward the authored facts is "state one only when
 * asked, never volunteer, never reveal the list". That is right while the
 * exercise is running and contradicts Teacher mode, which is told in the same
 * prompt to walk through population and segmentation — that is, to volunteer
 * exactly these figures.
 */
describe("the data pack's posture", () => {
  const facts = [
    { topic: ["india", "population"], fact: "India's population is about 140 crore." },
    { topic: ["urban", "rural"], fact: "Roughly 35% of India lives in urban areas." },
  ];
  const withFacts = (over: Partial<InterviewerContext> = {}) =>
    ctx({ dataPack: facts, ...over });

  it("keeps the interviewer withholding until asked", () => {
    const { system } = buildReplyMessages(withFacts({ mode: "interviewer" }));
    expect(system).toContain("Never volunteer one unprompted");
  });

  it("lets Teacher mode build the walkthrough out of them", () => {
    const { system } = buildReplyMessages(withFacts({ mode: "teacher" }));
    expect(system).not.toContain("Never volunteer one unprompted");
    expect(system).not.toContain("ONLY when the candidate asks");
    expect(system).toContain("Use these freely");
  });

  // The ban that always holds: a made-up figure is worse than no figure in any
  // mode, and it is the reason the pack is handed over at all.
  it("never lets any mode invent a figure", () => {
    for (const mode of ["interviewer", "coach", "teacher"] as const) {
      const { system } = buildReplyMessages(withFacts({ mode }));
      expect(system, mode).toContain("never invent a fact that is not here");
    }
  });

  // A hint escalates but never states the answer, so it keeps the interviewer's
  // posture even when the picker is sitting on Teacher.
  it("does not open the list to a hint asked from inside teacher mode", () => {
    const { system } = buildHintMessages(withFacts({ mode: "teacher" }), 3);
    expect(system).toContain("Never volunteer one unprompted");
    expect(system).not.toContain("Use these freely");
  });

  /*
   * The war-room coach's context is built with `mode: "teacher"`
   * (lib/simulation-context.ts), so a check that read `ctx.mode` instead of
   * being told would have changed the coach's prompt as a side effect. This is
   * the test that catches that.
   */
  it("leaves the war-room coach's prompt exactly as it was", () => {
    const { system } = buildReplyMessages(
      withFacts({
        mode: "teacher",
        simulation: {
          scenarioTitle: "Liquidity", company: "Chalo", trueCauseLabels: ["supply"],
          causalChain: ["drivers left"], whereTheLeverageWas: "supply",
          studentDiagnosis: ["demand"], studentAllocation: [], outcomeSummary: "missed",
          scores: [{ label: "Diagnosis", value: 40 }], strongAnswer: ["Fund supply"],
          facts: [],
        } as NonNullable<InterviewerContext["simulation"]>,
      }),
    );
    expect(system).toContain("Never volunteer one unprompted");
    expect(system).not.toContain("Use these freely");
  });
});
