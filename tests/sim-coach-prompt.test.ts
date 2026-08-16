/**
 * The debrief coach's persona.
 *
 * `simCoachRules` replaced a constant when the finance scenarios arrived, and
 * the whole point of the default is that nothing changed for the nine scenarios
 * written before it — so that is what these pin, alongside the new behaviour.
 */

import { describe, expect, it } from "vitest";
import { buildReplyMessages } from "@/lib/llm/build-messages";
import { DEFAULT_SIM_MENTOR, simCoachRules } from "@/lib/llm/prompts";
import type { InterviewerContext, SimCoachContext } from "@/lib/llm/types";

function simContext(mentor?: SimCoachContext["mentor"]): InterviewerContext {
  return {
    question: {
      title: "Nirmal Pipes",
      prompt: "A record profit and no money for payroll.",
      category: "Finance",
      difficulty: "Easy",
      interviewLevel: "Big4",
      idealLow: null,
      idealHigh: null,
      unit: null,
      betterApproach: "Bridge profit to cash.",
      sampleSolution: "The cycle went from 61 days to 180.",
    },
    mode: "teacher",
    answerMode: "qualitative",
    messages: [],
    assumptions: [],
    framework: [],
    dataPack: [],
    hintsUsed: 0,
    simulation: {
      scenarioTitle: "Nirmal Pipes",
      company: "Nirmal Pipes",
      mentor,
      trueCauseLabels: ["We collect late and pay early"],
      causalChain: ["DSO went from 52 to 118."],
      whereTheLeverageWas: "The days, not the deals.",
      strongAnswer: ["Bridge profit to cash first."],
      studentDiagnosis: ["We are carrying too much stock"],
      studentAllocation: [],
      scores: [{ label: "Diagnosis accuracy", value: 40 }],
      outcomeSummary: "Free cash flow −₹26.8 cr.",
      facts: [],
    },
  };
}

describe("simCoachRules", () => {
  it("defaults to the product leader every existing scenario relies on", () => {
    expect(simCoachRules()).toBe(simCoachRules(DEFAULT_SIM_MENTOR));
    expect(simCoachRules()).toContain("a senior product leader debriefing a PM candidate");
  });

  it("speaks as whoever the scenario names", () => {
    const rules = simCoachRules({
      persona: "a CFO debriefing a junior financial analyst",
      audience: "analyst",
    });
    expect(rules).toContain("You are a CFO debriefing a junior financial analyst");
    expect(rules).toContain("Where the analyst went wrong");
    expect(rules).not.toContain("product leader");
  });

  /** The persona changes; the ban on inventing a figure does not. */
  it("keeps the rules that stop a coach making a number up", () => {
    for (const rules of [simCoachRules(), simCoachRules({ persona: "a CFO", audience: "analyst" })]) {
      expect(rules).toContain("Never invent a number");
      expect(rules).toContain("The run is FINISHED and scored");
    }
  });

  /**
   * The debrief is read by someone who has just been told they were wrong,
   * which is the worst moment to hand anyone a dense paragraph. Bullets and
   * plain words are the format, and the prompt has to ask for both — it used to
   * ask for the opposite ("no bullet lists").
   */
  it("asks for short bullets in plain words, whoever is speaking", () => {
    for (const rules of [simCoachRules(), simCoachRules({ persona: "a CFO", audience: "analyst" })]) {
      expect(rules).toMatch(/bullets/);
      expect(rules).not.toMatch(/no bullet lists/);
      // The gloss rule is what keeps a CFO persona from burying a student in
      // vocabulary it never explains.
      expect(rules).toContain("gloss it");
    }
  });
});

describe("buildReplyMessages, on the coach branch", () => {
  it("puts the scenario's mentor into the system prompt", () => {
    const { system } = buildReplyMessages(
      simContext({ persona: "a CFO debriefing a junior financial analyst", audience: "analyst" }),
    );
    expect(system).toContain("You are a CFO debriefing a junior financial analyst");
    // And still carries the run, which is what the coach is talking about.
    expect(system).toContain("We collect late and pay early");
  });

  it("falls back to the default persona when a scenario names none", () => {
    const { system } = buildReplyMessages(simContext());
    expect(system).toContain("a senior product leader debriefing a PM candidate");
  });

  it("opens the conversation when the student has not spoken yet", () => {
    const { messages } = buildReplyMessages(simContext());
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe("user");
  });
});
