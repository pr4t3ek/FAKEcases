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

describe("mock interviewer on a case", () => {
  const caseCtx = (partial: Partial<InterviewerContext> = {}) =>
    ctx({ answerMode: "qualitative", ...partial });

  // The market-sizing banks ask for populations and frequencies, which is
  // nonsense on "why are margins falling".
  it("opens by scoping rather than asking for a population", async () => {
    const text = await collect(mockAdapter.reply(caseCtx()));
    expect(text).toMatch(/objective|solving for|scope/i);
    expect(text).not.toMatch(/population|frequency/i);
  });

  it("asks for a structure once the conversation has started", async () => {
    const text = await collect(
      mockAdapter.reply(caseCtx({ messages: [{ role: "user", content: "Costs seem high to me." }] })),
    );
    expect(text).toMatch(/break|structure|framework|buckets|exhaustive/i);
  });

  // Marking a branch is the drill-down gesture, so the interviewer's job is to
  // make them go one level further, never to say whether they're right.
  it("pushes the candidate to narrow once they flag a branch", async () => {
    const text = await collect(
      mockAdapter.reply(
        caseCtx({
          messages: [{ role: "user", content: "I think it's on the cost side." }],
          framework: [
            { label: "Revenue", status: "healthy" },
            { label: "Cost", status: "problem" },
          ],
        }),
      ),
    );
    expect(text).toMatch(/inside|narrow|further|next|specifically|rule/i);
  });

  it("asks for a recommendation once branches are ruled out", async () => {
    const text = await collect(
      mockAdapter.reply(
        caseCtx({
          messages: [{ role: "user", content: "Revenue looks fine." }],
          framework: [
            { label: "Revenue", status: "healthy" },
            { label: "Cost", status: "healthy" },
          ],
        }),
      ),
    );
    expect(text).toMatch(/recommend|conclusion|commit|answer/i);
  });

  // Offline it has no data pack, and inventing a figure is exactly the failure
  // the authored facts exist to prevent.
  it("refuses to invent data when asked a direct question", async () => {
    const text = await collect(
      mockAdapter.reply(
        caseCtx({ messages: [{ role: "user", content: "What happened to delivery costs?" }] }),
      ),
    );
    expect(text).toMatch(/don't have|nothing on that|assume/i);
    expect(text).not.toMatch(/\d+%/);
  });

  it("never names the branch holding the problem, even at the last hint", async () => {
    const text = await collect(mockAdapter.hint(caseCtx(), 3));
    expect(text).toMatch(/structure/i);
    expect(text).toMatch(/yourself/i);
  });
});

describe("mock interviewer releasing authored data", () => {
  const pack = [
    { topic: ["delivery", "rider"], fact: "Delivery cost per order is up 31% year-on-year." },
    { topic: ["commission", "take rate"], fact: "Commission per order is unchanged at 18%." },
  ];
  const caseCtx = (partial: Partial<InterviewerContext> = {}) =>
    ctx({ answerMode: "qualitative", dataPack: pack, ...partial });

  // Offline has to be playable, not just non-broken: the case's truth lives in
  // the question row, so the mock can release it exactly as a real provider does.
  it("states the fact for the branch it was asked about", async () => {
    const text = await collect(
      mockAdapter.reply(
        caseCtx({ messages: [{ role: "user", content: "What's happened to delivery cost?" }] }),
      ),
    );
    expect(text).toContain("up 31% year-on-year");
  });

  it("releases only the fact that was asked for", async () => {
    const text = await collect(
      mockAdapter.reply(
        caseCtx({ messages: [{ role: "user", content: "Tell me about delivery." }] }),
      ),
    );
    expect(text).not.toContain("18%");
  });

  it("declines rather than inventing when nothing covers the question", async () => {
    const text = await collect(
      mockAdapter.reply(
        caseCtx({ messages: [{ role: "user", content: "What about staff attrition?" }] }),
      ),
    );
    expect(text).toMatch(/don't have|nothing on that|assume/i);
    expect(text).not.toMatch(/\d+%/);
  });
});
