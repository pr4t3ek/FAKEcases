import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { chaiWalkthrough, DEMO_QUESTION_EXTERNAL_ID } from "@/lib/walkthrough/content";
import { validateWalkthrough } from "@/lib/walkthrough/validate";
import { questions } from "../prisma/seed-data";

/**
 * The gate this whole feature rests on.
 *
 * A worked example is the first arithmetic a beginner sees here. One whose
 * chain does not reach its own question's authored answer would teach a wrong
 * method, confidently, to exactly the people who cannot tell — so it is checked
 * against the real seeded question on every run rather than on the day it was
 * written.
 *
 * The failure this catches is not somebody fat-fingering a percentage. It is
 * somebody widening a question's ideal range next year and never thinking about
 * the example that used to sit inside it.
 */
describe("the demo walkthrough is arithmetically true", () => {
  const question = questions.find((q) => q.externalId === DEMO_QUESTION_EXTERNAL_ID);

  it("points at a question that exists", () => {
    expect(question, `no seeded question "${DEMO_QUESTION_EXTERNAL_ID}"`).toBeDefined();
  });

  it("is a guesstimate with a range to check against", () => {
    expect(question?.idealLow).toBeTypeOf("number");
    expect(question?.idealHigh).toBeTypeOf("number");
  });

  it("lands inside that range", () => {
    const result = validateWalkthrough(chaiWalkthrough, {
      idealLow: question?.idealLow ?? null,
      idealHigh: question?.idealHigh ?? null,
    });
    expect(result.issues.map((i) => i.message)).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.total).toBeGreaterThanOrEqual(question!.idealLow!);
    expect(result.total).toBeLessThanOrEqual(question!.idealHigh!);
  });

  it("teaches a chain a beginner can follow", () => {
    // Three or four steps. A nine-step tree teaches that guesstimates are long
    // rather than that they are structured, which is the opposite lesson.
    expect(chaiWalkthrough.steps.length).toBeGreaterThanOrEqual(2);
    expect(chaiWalkthrough.steps.length).toBeLessThanOrEqual(5);
  });

  it("explains every number it puts on screen", () => {
    for (const step of chaiWalkthrough.steps) {
      expect(step.because.trim().length, `"${step.node.label}" has no reason`).toBeGreaterThan(20);
      expect(step.because).not.toMatch(/^TODO/);
      expect(step.say).not.toMatch(/^TODO/);
    }
    expect(chaiWalkthrough.intro).not.toMatch(/^TODO/);
    expect(chaiWalkthrough.outro).not.toMatch(/^TODO/);
  });

  it("is the question the shipped default setting points at", () => {
    // The seed publishes this walkthrough and the setting decides whether
    // anybody sees it. A default that named a different question would ship the
    // feature switched off, silently.
    const settings = readFileSync("lib/settings.ts", "utf8");
    expect(settings).toContain(`walkthroughDemoQuestion: "${DEMO_QUESTION_EXTERNAL_ID}"`);
  });
});
