import { describe, it, expect } from "vitest";
import { toGeminiContents } from "@/lib/llm/gemini";
import { buildHintMessages, buildReplyMessages } from "@/lib/llm/build-messages";
import type { ConvMessage, InterviewerContext } from "@/lib/llm/types";

/**
 * Gemini's `contents` contract differs from the OpenAI/Anthropic message shape in
 * three ways, and every one of them fails silently rather than as a type error:
 * a wrong role name, a system prompt smuggled into the turn list, or two
 * consecutive same-role turns. These tests pin all three.
 */

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
      betterApproach: "Segment adults vs children, apply replacement frequency.",
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

const textOf = (c: { parts: { text: string }[] }) => c.parts.map((p) => p.text).join("");

describe("toGeminiContents", () => {
  it("maps the assistant role to Gemini's 'model'", () => {
    const out = toGeminiContents([
      { role: "user", content: "population is 2 crore" },
      { role: "assistant", content: "How would you segment that?" },
    ]);

    expect(out.map((c) => c.role)).toEqual(["user", "model"]);
    expect(textOf(out[1])).toBe("How would you segment that?");
  });

  it("drops system messages — they belong in systemInstruction", () => {
    const out = toGeminiContents([
      { role: "system", content: "You are an interviewer." },
      { role: "user", content: "hello" },
    ]);

    expect(out).toHaveLength(1);
    expect(out[0].role).toBe("user");
    expect(textOf(out[0])).toBe("hello");
  });

  it("merges consecutive same-role turns so roles alternate", () => {
    const out = toGeminiContents([
      { role: "user", content: "first" },
      { role: "user", content: "second" },
      { role: "assistant", content: "reply" },
    ]);

    expect(out.map((c) => c.role)).toEqual(["user", "model"]);
    expect(textOf(out[0])).toBe("first\n\nsecond");
  });

  it("opens with a user turn when history starts with the seeded interviewer opener", () => {
    // Every attempt starts this way: startAttempt() seeds the opening question
    // before the candidate has typed anything.
    const out = toGeminiContents([
      { role: "assistant", content: "Let's structure this. Where would you start?" },
      { role: "user", content: "population is 2 crore" },
    ]);

    expect(out[0].role).toBe("user");
    // The seeded opener is preserved, not discarded.
    expect(out.map(textOf).join(" ")).toContain("Let's structure this.");
    expect(out.map((c) => c.role)).toEqual(["user", "model", "user"]);
  });

  it("never emits an empty contents array", () => {
    expect(toGeminiContents([])).toHaveLength(1);
    expect(toGeminiContents([{ role: "system", content: "x" }])[0].role).toBe("user");
  });

  it("skips blank messages rather than sending empty parts", () => {
    const out = toGeminiContents([
      { role: "user", content: "real" },
      { role: "assistant", content: "   " },
      { role: "user", content: "also real" },
    ]);

    // The blank assistant turn is dropped, so the two user turns merge.
    expect(out).toHaveLength(1);
    expect(textOf(out[0])).toBe("real\n\nalso real");
  });

  it("alternates for a real hint request built from live history", () => {
    // buildHintMessages appends a user turn to history that already ends in one —
    // the exact case that produces two consecutive user turns.
    const history: ConvMessage[] = [
      { role: "assistant", content: "Where would you start?" },
      { role: "user", content: "I'd start with population." },
    ];
    const { messages } = buildHintMessages(ctx({ messages: history }), 2);
    const out = toGeminiContents(messages);

    for (let i = 1; i < out.length; i++) {
      expect(out[i].role).not.toBe(out[i - 1].role);
    }
    expect(out[0].role).toBe("user");
    expect(textOf(out[out.length - 1])).toContain("hint");
  });

  it("alternates for a reply built from an empty attempt", () => {
    const { messages } = buildReplyMessages(ctx());
    const out = toGeminiContents(messages);

    expect(out[0].role).toBe("user");
    for (let i = 1; i < out.length; i++) {
      expect(out[i].role).not.toBe(out[i - 1].role);
    }
  });
});
