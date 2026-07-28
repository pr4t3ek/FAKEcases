import { describe, it, expect } from "vitest";
import { mockAdapter } from "@/lib/llm/mock";
import type { InterviewerContext } from "@/lib/llm/types";

/** Adapters stream deltas; these assertions are about the whole reply. */
async function collect(stream: AsyncIterable<string>): Promise<string> {
  let text = "";
  for await (const delta of stream) text += delta;
  return text;
}

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

describe("mock interviewer", () => {
  it("opens with a structuring question", async () => {
    const r = await collect(mockAdapter.reply(ctx()));
    expect(r.length).toBeGreaterThan(10);
    expect(r).toContain("?");
  });

  it("never reveals the sample solution in interviewer mode", async () => {
    const r = await collect(
      mockAdapter.reply(ctx({ messages: [{ role: "user", content: "population is 2 crore" }] })),
    );
    expect(r.toLowerCase()).not.toContain("80 lakh");
  });

  it("pushes for segmentation when none present", async () => {
    const r = await collect(
      mockAdapter.reply(
        ctx({ messages: [{ role: "user", content: "the total population is 2 crore" }] }),
      ),
    );
    expect(r.toLowerCase()).toMatch(/segment|break|split|homogeneous/);
  });

  it("does not reveal the final number even at the last hint level", async () => {
    const r = await collect(mockAdapter.hint(ctx(), 3));
    expect(r.toLowerCase()).not.toContain("80 lakh");
    expect(r.length).toBeGreaterThan(10);
  });

  it("hint level 1 and 3 differ in guidance", async () => {
    const c = ctx();
    const h1 = await collect(mockAdapter.hint(c, 1));
    const h3 = await collect(mockAdapter.hint(c, 3));
    expect(h1).not.toEqual(h3);
  });

  it("teacher mode explains using the approach", async () => {
    const r = await collect(mockAdapter.reply(ctx({ mode: "teacher" })));
    expect(r.toLowerCase()).toContain("structure");
  });

  it("streams in multiple chunks that reassemble to the whole reply", async () => {
    // Guards the streaming path: offline dev must exercise the same incremental
    // rendering the real provider does, not a single-shot shortcut.
    const chunks: string[] = [];
    for await (const delta of mockAdapter.reply(ctx({ mode: "teacher" }))) chunks.push(delta);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join("")).toEqual(await collect(mockAdapter.reply(ctx({ mode: "teacher" }))));
  });
});
