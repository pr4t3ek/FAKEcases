import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { flattenForJudge, parseVerdict } from "@/lib/framework-judge";

/**
 * The judge closes the one gap arithmetic cannot: whether the tree's labels
 * describe this problem. Everything about it fails soft, because a submission is
 * the moment a candidate's work is recorded and it must not depend on a network
 * call succeeding.
 */
vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContentStream: vi.fn() };
  },
}));

describe("parseVerdict", () => {
  it("reads the two lines it asked for", () => {
    const v = parseVerdict("COHERENCE: 82\nREASON: Each step is a real slice of the one above.")!;
    expect(v.coherence).toBe(82);
    expect(v.reason).toBe("Each step is a real slice of the one above.");
  });

  // Models decorate. None of these change what the number means.
  it("survives the ways a model dresses up two plain lines", () => {
    expect(parseVerdict("**COHERENCE:** 15\n**REASON:** Placeholder labels.")!.coherence).toBe(15);
    expect(parseVerdict("coherence - 60\nreason - Loose split.")!.coherence).toBe(60);
    expect(parseVerdict("Sure!\n\nCOHERENCE: 99\nREASON: Clean.")!.coherence).toBe(99);
  });

  it("takes the score without a reason, since the score is what moves a mark", () => {
    const v = parseVerdict("COHERENCE: 40")!;
    expect(v.coherence).toBe(40);
    expect(v.reason).toBe("");
  });

  /*
   * A guess here silently changes someone's score, so anything unparseable is
   * null and the deterministic layer stands on its own.
   */
  it("refuses anything it cannot read as a score", () => {
    for (const bad of ["", "I can't grade that.", "REASON: nice tree", "COHERENCE: high"]) {
      expect(parseVerdict(bad), bad).toBeNull();
    }
  });

  it("refuses a score outside the scale", () => {
    expect(parseVerdict("COHERENCE: 420")).toBeNull();
  });

  // Reasoning models emit their deliberation in the same stream; `toReadableText`
  // strips it, and the verdict must be read from what is left.
  it("reads past a reasoning block", () => {
    const v = parseVerdict("<think>hmm, the labels are vague</think>COHERENCE: 45\nREASON: Vague.")!;
    expect(v.coherence).toBe(45);
    expect(v.reason).toBe("Vague.");
  });
});

describe("flattenForJudge", () => {
  it("renders the hierarchy as depth, so the model sees the shape", () => {
    expect(
      flattenForJudge([
        { id: "r", parentId: null, label: "Population", value: "4cr" },
        { id: "a", parentId: "r", label: "Adults", value: "65%" },
        { id: "b", parentId: "a", label: "Brushes/day", multiplier: "2" },
      ]),
    ).toEqual([
      { depth: 0, label: "Population", value: "4cr", rate: undefined },
      { depth: 1, label: "Adults", value: "65%", rate: undefined },
      { depth: 2, label: "Brushes/day", value: undefined, rate: "2" },
    ]);
  });

  /*
   * Older rows and hand-built fixtures carry no ids. Walking from the roots
   * would emit nothing, and an empty framework reads to the model as nonsense —
   * which would score a real attempt at zero for a data-shape reason.
   */
  it("falls back to the flat list when the ids do not line up", () => {
    const flat = flattenForJudge([
      { label: "Population", value: "2cr" },
      { label: "Adults", value: "70%" },
    ]);
    expect(flat).toHaveLength(2);
    expect(flat.every((n) => n.depth === 0)).toBe(true);
  });

  it("does not hang on a cycle", () => {
    const out = flattenForJudge([
      { id: "a", parentId: "b", label: "A" },
      { id: "b", parentId: "a", label: "B" },
    ]);
    expect(out).toHaveLength(2);
  });
});

describe("judgeFramework, when the provider is not there", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const ctx = {
    questionTitle: "Toothpaste",
    questionPrompt: "Annual toothpaste demand in India.",
    nodes: [{ depth: 0, label: "Population", value: "140cr" }],
    finalEstimate: 1_000_000,
    unit: "tubes/year",
  };

  /*
   * The mock has no idea what the labels say — it answers from templates — so a
   * verdict from it is noise, and noise that moves a score is worse than none.
   */
  it("discards a verdict the mock produced", async () => {
    vi.stubEnv("LLM_PROVIDER", "mock");
    const { judgeFramework } = await import("@/lib/framework-judge");
    expect(await judgeFramework(ctx)).toBeNull();
  });

  it("returns null rather than throwing when the provider fails", async () => {
    vi.stubEnv("LLM_PROVIDER", "openai");
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const { judgeFramework } = await import("@/lib/framework-judge");
    expect(await judgeFramework(ctx)).toBeNull();
  });

  it("returns null when the reply is not a verdict", async () => {
    vi.stubEnv("LLM_PROVIDER", "openai");
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ choices: [{ message: { content: "I'd rather not." } }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    const { judgeFramework } = await import("@/lib/framework-judge");
    expect(await judgeFramework(ctx)).toBeNull();
  });

  it("returns the verdict when a real provider answers properly", async () => {
    vi.stubEnv("LLM_PROVIDER", "openai");
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "COHERENCE: 12\nREASON: The labels are placeholders." } }],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      ),
    );
    const { judgeFramework } = await import("@/lib/framework-judge");
    const v = await judgeFramework(ctx);
    expect(v?.coherence).toBe(12);
    expect(v?.reason).toMatch(/placeholders/);
  });
});

/**
 * The judge reads the figures, not just the labels.
 *
 * It used to be told the opposite in as many words — "You are NOT grading
 * arithmetic, accuracy, or whether the final number is right. Ignore all of it."
 * That left nobody checking whether a step's number was plausible, whether a
 * child's share fitted inside its parent, or whether the chain multiplied out to
 * the answer the candidate wrote down.
 */
describe("what the judge is given and asked", () => {
  it("puts every step's value and rate in front of the model", async () => {
    const { renderJudgeBlock } = await import("@/lib/llm/prompts");
    const block = renderJudgeBlock({
      questionTitle: "Toothpaste",
      questionPrompt: "Annual toothpaste demand in India.",
      nodes: [
        { depth: 0, label: "Population", value: "140cr" },
        { depth: 1, label: "Adults", value: "65%" },
        { depth: 2, label: "Tubes per year", rate: "4" },
      ],
      finalEstimate: 364_000_000,
      unit: "tubes/year",
    });
    expect(block).toContain("140cr");
    expect(block).toContain("65%");
    expect(block).toContain("4");
    // The chain has to be checkable against something.
    expect(block).toMatch(/36,40,00,000|364,000,000/);
    expect(block).toContain("tubes/year");
  });

  it("asks the model to judge the numbers, not only the decomposition", async () => {
    const { FRAMEWORK_JUDGE_RULES } = await import("@/lib/llm/prompts");
    expect(FRAMEWORK_JUDGE_RULES).toMatch(/THE NUMBERS/);
    expect(FRAMEWORK_JUDGE_RULES).toMatch(/plausible/i);
    expect(FRAMEWORK_JUDGE_RULES).toMatch(/Multiply the chain through/i);
    // The instruction that was there before, and was the whole problem.
    expect(FRAMEWORK_JUDGE_RULES).not.toMatch(/NOT grading arithmetic/i);
  });

  // The deterministic layer already zeroes a figureless tree; this stops the
  // model handing the multiplier back on the strength of tidy labels.
  it("forbids a tree with no numbers from scoring above the bottom band", async () => {
    const { FRAMEWORK_JUDGE_RULES } = await import("@/lib/llm/prompts");
    expect(FRAMEWORK_JUDGE_RULES).toMatch(/no numbers in it cannot score above 29/i);
  });
});
