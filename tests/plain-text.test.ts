import { describe, expect, it } from "vitest";
import { toReadableText, toSegments } from "@/lib/llm/plain-text";

/**
 * Making a model's answer readable in a plain-text bubble.
 *
 * The cases below are the real ones: a local 7B asked for a worked market-sizing
 * calculation answers in LaTeX inside markdown, and the chat renders text, so the
 * student reads the backslashes. The refusals matter as much as the rewrites —
 * this runs over every assistant turn, and a normaliser that mangles a number or
 * a rupee figure is worse than the mess it was cleaning up.
 */

describe("toReadableText", () => {
  it("unwraps inline maths and its text spans", () => {
    // `\text{ crore}` brings its own leading space and the delimiters had one
    // too, so the naive result is "15  crore". The gap is closed.
    expect(toReadableText("\\( 15 \\text{ crore} \\times 0.30 = 4.5 \\text{ crore} \\)")).toBe(
      "15 crore × 0.30 = 4.5 crore",
    );
  });

  it("keeps the indentation of a nested list while closing internal gaps", () => {
    // The bubble is `whitespace-pre-wrap`, so leading spaces are the structure
    // the model meant and must survive; only runs after real text collapse.
    expect(toReadableText("   - Old:  \\( 15 \\text{ crore} \\)")).toBe("   - Old: 15 crore");
  });

  it("reads the whole screenshot line the way a person would", () => {
    const raw = [
      "1. **Population Split:**",
      "   - Old (over 65): 30% of 15 crore",
      "   - \\( 4.5 \\text{ crore} \\times 0.50 = 2.25 \\text{ crore} \\)",
    ].join("\n");
    const out = toReadableText(raw);
    expect(out).not.toContain("\\text");
    expect(out).not.toContain("\\(");
    expect(out).toContain("×");
    expect(out).toContain("2.25");
    // The bold survives as markers for `toSegments` to turn into real bold.
    expect(out).toContain("**Population Split:**");
  });

  it("strips heading hashes and keeps the heading", () => {
    expect(toReadableText("## Step 2\nbody")).toBe("Step 2\nbody");
    expect(toReadableText("###   Deeply nested")).toBe("Deeply nested");
  });

  it("leaves a hash that is not a heading alone", () => {
    // "#1 driver" and a C# mention are prose, not markup.
    expect(toReadableText("The #1 driver here")).toBe("The #1 driver here");
    expect(toReadableText("issue #42 is open")).toBe("issue #42 is open");
  });

  it("converts the operators a calculation actually uses", () => {
    expect(toReadableText("a \\times b \\div c \\approx d")).toBe("a × b ÷ c ≈ d");
    expect(toReadableText("x \\leq y \\geq z \\neq w")).toBe("x ≤ y ≥ z ≠ w");
    expect(toReadableText("\\frac{revenue}{orders}")).toBe("revenue/orders");
  });

  it("keeps escaped punctuation as the punctuation", () => {
    expect(toReadableText("30\\% of the base")).toBe("30% of the base");
    expect(toReadableText("costs \\$5")).toBe("costs $5");
  });

  it("drops display-maths delimiters without touching the sum", () => {
    expect(toReadableText("$$ 15 \\times 0.35 = 5.25 $$")).toBe("15 × 0.35 = 5.25");
    expect(toReadableText("\\[ x = 2 \\]")).toBe("x = 2");
  });

  // ── The refusals ──────────────────────────────────────────────────────────

  it("never treats a dollar sign as a maths delimiter", () => {
    // The regression that made the rule go away. "between $5 and $6" looks
    // exactly like a delimited pair, and unwrapping it produced "between 5 and
    // 6" — a destroyed price. A stray `$` on screen is much cheaper than a
    // wrong number, so `$…$` is left entirely alone.
    expect(toReadableText("about $5 per unit")).toBe("about $5 per unit");
    expect(toReadableText("between $5 and $6")).toBe("between $5 and $6");
    expect(toReadableText("$1.2M ARR against $400k costs")).toContain("$400k");
  });

  it("still converts the commands inside a $…$ span it did not unwrap", () => {
    expect(toReadableText("$15 \\times 0.3$")).toBe("$15 × 0.3$");
  });

  it("leaves a backslash command it does not know", () => {
    // Silently deleting an unrecognised command could remove meaning. Better a
    // visible oddity than a quietly altered answer.
    expect(toReadableText("\\begin{align} x \\end{align}")).toContain("\\begin");
  });

  it("leaves ordinary prose completely alone", () => {
    const prose = "Start with Bangalore's population, then the share who drink chai daily.";
    expect(toReadableText(prose)).toBe(prose);
  });

  it("leaves rupee figures and percentages alone", () => {
    const s = "₹1.5cr at 30% gives ₹45L";
    expect(toReadableText(s)).toBe(s);
  });

  it("is safe on empty and whitespace input", () => {
    expect(toReadableText("")).toBe("");
    expect(toReadableText("   ")).toBe("");
  });

  it("collapses the blank lines stripping leaves behind", () => {
    expect(toReadableText("a\n\n---\n\nb")).toBe("a\n\nb");
  });
});

describe("toSegments", () => {
  it("turns paired asterisks into a bold run", () => {
    expect(toSegments("1. **Population Split:** then more")).toEqual([
      { text: "1. ", kind: "plain" },
      { text: "Population Split:", kind: "strong" },
      { text: " then more", kind: "plain" },
    ]);
  });

  it("turns backticks into code", () => {
    expect(toSegments("use `orders × AOV` here")).toEqual([
      { text: "use ", kind: "plain" },
      { text: "orders × AOV", kind: "code" },
      { text: " here", kind: "plain" },
    ]);
  });

  it("leaves an unpaired marker as written", () => {
    // A lone asterisk is multiplication or emphasis-by-hand, not markup.
    expect(toSegments("3 * 4 = 12")).toEqual([{ text: "3 * 4 = 12", kind: "plain" }]);
    expect(toSegments("a ** b")).toEqual([{ text: "a ** b", kind: "plain" }]);
  });

  it("does not let a bold run swallow a line break", () => {
    const out = toSegments("**start\nend**");
    expect(out.every((s) => s.kind === "plain")).toBe(true);
  });

  it("always returns something for empty input", () => {
    expect(toSegments("")).toEqual([{ text: "", kind: "plain" }]);
  });
});

/**
 * A model that thinks out loud emits its deliberation in the same `content`
 * stream as its answer. Left alone it renders in the chat bubble — and what it
 * contains is a recital of the system prompt: the hard rules, the ideal range,
 * the sample solution. This is the case that hands a student the answer key, so
 * the stripping is unconditional rather than conservative like the rest of the
 * module.
 */
describe("reasoning removal", () => {
  it("removes a closed think block and keeps the answer", () => {
    const raw = "<think>The rules say never reveal. Ideal range 60-120 lakh.</think>How would you segment the population?";
    expect(toReadableText(raw)).toBe("How would you segment the population?");
  });

  /**
   * The failure actually seen: the model spent its whole token budget thinking
   * and was cut off before the answer. An empty bubble is the honest outcome —
   * `runTurn` treats an empty turn as a failure — and infinitely better than
   * rendering the deliberation.
   */
  it("removes an unterminated think block entirely", () => {
    const raw = "<think>1. Analyze User Input. 2. Check Role/Rules. I'll go with";
    expect(toReadableText(raw)).toBe("");
  });

  it("recovers the answer when only the closing tag survives", () => {
    expect(toReadableText("deliberation lost its opener</think>What's your starting point?"))
      .toBe("What's your starting point?");
  });

  it("matches the tag whatever its case or spelling", () => {
    expect(toReadableText("<THINK>x</THINK>Answer.")).toBe("Answer.");
    expect(toReadableText("<reasoning>x</reasoning>Answer.")).toBe("Answer.");
    expect(toReadableText("<thinking>x</thinking>Answer.")).toBe("Answer.");
  });

  /**
   * The reason the stripper bails early on text with no "<" at all: this app is
   * full of inequalities, and eating one would corrupt a number.
   */
  it("leaves an angle bracket in ordinary prose alone", () => {
    const raw = "Is 5 < 6 in your model, or did you mean >?";
    expect(toReadableText(raw)).toBe(raw);
  });

  it("keeps an answer that follows a closed block even with more text after", () => {
    const raw = "<think>hidden</think>First question. <think>more</think>Second question.";
    expect(toReadableText(raw)).toBe("First question. Second question.");
  });
});
