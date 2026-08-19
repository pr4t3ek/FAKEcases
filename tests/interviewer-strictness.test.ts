/**
 * The guesstimate interviewer hints; it does not lead.
 *
 * A market-sizing question is graded on the decomposition, so the decomposition
 * is the answer. Handing it over — as a hint, as an example, or as the sentence
 * after a reference figure — leaves the candidate with nothing but arithmetic
 * and stops the exercise testing what it exists to test.
 *
 * These are behavioural assertions about the PROMPTS and the offline mock, not
 * about any model's compliance. What they can guarantee is that nothing in this
 * repo puts the answer structure in front of a candidate; what a live provider
 * does with an instruction is its own business.
 *
 * Scope: the numeric / market-sizing path only. The case interviewer has the
 * same shape of leak and is deliberately untouched, which the last block here
 * pins so a later edit cannot reach it by accident.
 */

import { describe, expect, it } from "vitest";
import {
  BASE_CASE_RULES,
  hintSystemPrompt,
  systemPromptForMode,
} from "@/lib/llm/prompts";
import { mockHintText, mockReplyText } from "@/lib/llm/mock";
import { hintConfig } from "@/lib/config";
import type { InterviewerContext } from "@/lib/llm/types";

/**
 * `betterApproach` here is the authored answer structure, and it is what the
 * old level-3 hint printed verbatim. Every assertion below that looks for it is
 * looking for the actual bug.
 */
const BETTER_APPROACH = "Segment adults vs children, apply replacement frequency.";

function ctx(partial: Partial<InterviewerContext> = {}): InterviewerContext {
  return {
    question: {
      title: "Umbrellas in Mumbai",
      prompt: "Estimate annual umbrella demand in Mumbai.",
      category: "demand-estimation",
      difficulty: "Easy",
      interviewLevel: "McKinsey",
      idealLow: 6_000_000,
      idealHigh: 12_000_000,
      unit: "umbrellas/year",
      betterApproach: BETTER_APPROACH,
      sampleSolution: "~80 lakh umbrellas/year",
    },
    mode: "interviewer",
    messages: [],
    assumptions: [],
    framework: [],
    hintsUsed: 0,
    ...partial,
  };
}

/** The four candidate states the level-3 hint branches on. */
const STATES: [string, Partial<InterviewerContext>][] = [
  ["nothing yet", {}],
  [
    "segmented, no rates",
    { framework: [{ label: "Adults" }, { label: "Children" }] },
  ],
  [
    "segmented with rates",
    {
      framework: [{ label: "Adults" }, { label: "Children" }],
      assumptions: [
        { key: "adults", value: "1 crore" },
        { key: "replacement", value: "2 years" },
      ],
    },
  ],
  ["has an estimate", { finalEstimate: 9_000_000 }],
];

describe("the guesstimate hint ladder never hands over the structure", () => {
  /**
   * The bug this file exists for. `mockHintText` used to return
   * "Here's the structure to use: {betterApproach}" at the top rung.
   */
  it("never prints the authored approach, at any level or any state", () => {
    for (const [name, state] of STATES) {
      for (let level = 1; level <= hintConfig.levels; level++) {
        const hint = mockHintText(ctx(state), level);
        expect(hint, `${name} @ level ${level}`).not.toContain(BETTER_APPROACH);
        expect(hint.toLowerCase(), `${name} @ level ${level}`).not.toContain(
          "structure to use",
        );
      }
    }
  });

  it("never leaks the sample figure either", () => {
    for (const [, state] of STATES) {
      for (let level = 1; level <= hintConfig.levels; level++) {
        expect(mockHintText(ctx(state), level).toLowerCase()).not.toContain("80 lakh");
      }
    }
  });

  /**
   * The top rung still has to be worth the Confidence it costs. "Strict" must
   * not collapse into "useless" — three paid rungs that say nothing is a worse
   * product than one that says too much.
   */
  it("still escalates: the top rung names a step the first one does not", () => {
    for (const [name, state] of STATES) {
      const first = mockHintText(ctx(state), 1);
      const last = mockHintText(ctx(state), hintConfig.levels);
      expect(last, name).not.toEqual(first);
      expect(last.length, name).toBeGreaterThan(40);
      expect(last.toLowerCase(), name).toContain("next step");
    }
  });

  /** One rung, one step: the top rung answers where THIS candidate is stuck. */
  it("gives a different top-rung step for a different candidate state", () => {
    const hints = STATES.map(([, s]) => mockHintText(ctx(s), hintConfig.levels));
    expect(new Set(hints).size).toBe(STATES.length);
  });

  it("names a dimension at the middle rung, not the splits themselves", () => {
    // The old bank said "break the population into meaningful segments, then
    // apply a usage or purchase rate to each" — two steps of the chain.
    for (const [, state] of STATES) {
      const hint = mockHintText(ctx(state), 2).toLowerCase();
      expect(hint).not.toContain("then apply");
      expect(hint).not.toContain("multiply that through");
    }
  });
});

describe("the guesstimate mock never volunteers a worked structure", () => {
  /**
   * Every reply the mock can give from one branch, not the one a single seed
   * happens to land on.
   *
   * `seedFor` mixes the question title in, so sweeping titles walks the whole
   * phrase bank. Asserting on one sampled reply is what let two of these pass
   * against the very code they were written to catch — a bank of three entries
   * hides a bad one two times in three.
   */
  const sweep = (state: Partial<InterviewerContext>): string[] =>
    Array.from({ length: 40 }, (_, i) =>
      mockReplyText(
        ctx({ ...state, question: { ...ctx().question, title: `Sizing question ${i}` } }),
      ).toLowerCase(),
    );

  /**
   * A candidate who has reached a number — and has said something, because
   * `replyInterviewer` answers with its opening line while the turn count is
   * zero and never reaches the sanity-check bank at all.
   */
  const REACHED_A_NUMBER: Partial<InterviewerContext> = {
    messages: [{ role: "user", content: "my estimate is about 90 lakh umbrellas" }],
    finalEstimate: 9_000_000,
  };

  it("covers the whole phrase bank when it sweeps", () => {
    // Guards the guard, twice over: if seeding ever stops varying with the
    // title every assertion below quietly becomes a single-sample test, and if
    // the sweep ever stops reaching the sanity-check branch it stops testing
    // the bank it names.
    const replies = new Set(sweep(REACHED_A_NUMBER));
    expect(replies.size).toBeGreaterThanOrEqual(3);
    // And it is past the opening branch: a context with nothing said yet gets
    // the opening line whatever else is on it, so an overlap here would mean
    // the sweep never reached the bank these assertions are about.
    const openings = new Set(sweep({ ...REACHED_A_NUMBER, messages: [] }));
    for (const reply of replies) expect(openings.has(reply)).toBe(false);
  });

  it("does not hand a stuck candidate the whole chain", () => {
    // "Break it into: who uses it, how many there are, and how often."
    for (const reply of sweep({ messages: [{ role: "user", content: "I'm stuck, help" }] })) {
      expect(reply).not.toContain("how many there are");
      expect(reply).toContain("?");
    }
  });

  it("does not name a segment the candidate has not thought of", () => {
    for (const reply of sweep(REACHED_A_NUMBER)) {
      expect(reply).not.toContain("institutional");
      expect(reply).not.toContain("bulk demand");
    }
  });

  it("does not announce which assumption comes next once they have segmented", () => {
    const replies = sweep({
      messages: [{ role: "user", content: "split into adults and children" }],
      framework: [{ label: "Adults" }, { label: "Children" }],
    });
    for (const reply of replies) {
      expect(reply).not.toContain("how often this is bought");
      expect(reply).not.toContain("frequency or usage rate");
      expect(reply).not.toContain("how frequently does each segment");
      expect(reply).toContain("?");
    }
  });
});

describe("the guesstimate interviewer prompt", () => {
  const prompt = systemPromptForMode("interviewer", "numeric");

  it("forbids proposing the decomposition, separately from the final answer", () => {
    expect(prompt).toContain("THE DECOMPOSITION IS WHAT IS BEING GRADED");
    expect(prompt.toLowerCase()).toContain("never propose, name or list the segments");
  });

  it("stops the structure riding along with a reference figure", () => {
    expect(prompt).toContain("GIVE THE FIGURE, THEN STOP");
    // …while keeping figures freely available, which was never the problem.
    expect(prompt).toContain("A PUBLIC REFERENCE FIGURE IS NOT THE ANSWER");
  });

  it("sends a request for structure to the priced hint button", () => {
    expect(prompt.toLowerCase()).toContain("hint button");
    expect(prompt.toLowerCase()).toContain("costs them confidence");
  });

  it("no longer tells the model to point at the structure to use", () => {
    for (let level = 1; level <= hintConfig.levels; level++) {
      const hint = hintSystemPrompt(level, hintConfig.levels, "numeric");
      expect(hint.toLowerCase(), `level ${level}`).not.toContain("structure to use");
      expect(hint, `level ${level}`).toContain("Never lay out more than one step ahead");
    }
  });
});

/**
 * The scope guard.
 *
 * `hintSystemPrompt` is one function with two branches and `BASE_CASE_RULES` is
 * a separate constant, so the case interviewer can only be reached by editing
 * it on purpose. These fail loudly if a later tightening pass does.
 */
describe("the case interviewer is deliberately untouched", () => {
  it("still builds its hints from the case rules", () => {
    for (let level = 1; level <= hintConfig.levels; level++) {
      expect(hintSystemPrompt(level, hintConfig.levels, "qualitative")).toContain(
        BASE_CASE_RULES,
      );
    }
  });

  it("keeps the case hint intensities exactly as they were", () => {
    const suffix = (level: number) =>
      hintSystemPrompt(level, hintConfig.levels, "qualitative").slice(
        BASE_CASE_RULES.length,
      );
    expect(suffix(1)).toBe(
      "\n\nThe candidate asked for a hint (level 1 of 3). Give a hint that is very subtle — point at what they haven't scoped or asked about yet, no specifics. Keep it to 1–3 sentences.",
    );
    expect(suffix(2)).toBe(
      "\n\nThe candidate asked for a hint (level 2 of 3). Give a hint that is more guidance — suggest the next split, or a branch their structure is missing. Keep it to 1–3 sentences.",
    );
    expect(suffix(3)).toBe(
      "\n\nThe candidate asked for a hint (level 3 of 3). Give a hint that is nearly complete direction — name the part of the framework worth breaking down next, but still never say which branch holds the problem. Keep it to 1–3 sentences.",
    );
  });

  it("still gives the case its authored approach at the top rung", () => {
    // The case ladder does hand over `betterApproach`, and that is the current
    // authored behaviour for cases. If it is ever tightened, tighten it on
    // purpose and change this line — do not let it drift.
    const hint = mockHintText(
      ctx({ answerMode: "qualitative", question: { ...ctx().question } }),
      hintConfig.levels,
    );
    expect(hint).toContain(BETTER_APPROACH);
  });
});
