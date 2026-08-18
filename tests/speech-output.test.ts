import { describe, it, expect } from "vitest";
import { toSpeakableText, pickVoice } from "@/lib/speech/browser-tts";

/**
 * The pure half of reading replies aloud.
 *
 * Matches how `tests/speech.test.ts` treats dictation: the browser API itself is
 * left to the browser, and what gets tested is the text handling and the voice
 * choice — the two places a bug is silent rather than loud. A wrong voice is
 * merely odd; wrong text is a number read out incorrectly to someone practising
 * arithmetic.
 */
describe("toSpeakableText", () => {
  /**
   * A hint is stored as "💡 Hint 3: …" (`app/api/hint/route.ts`), and a
   * synthesiser pronounces that emoji. "light bulb Hint three" is worse than
   * saying nothing.
   */
  it("drops the emoji from a hint but keeps the hint", () => {
    expect(toSpeakableText("💡 Hint 3: Segment by household.")).toBe(
      "Hint 3: Segment by household.",
    );
  });

  /**
   * The case this feature would have been embarrassing to ship without: the
   * reasoning stripper runs on the way to the screen, and speech has to go
   * through it too or the private deliberation is read aloud instead.
   */
  it("never speaks a reasoning block", () => {
    expect(toSpeakableText("<think>the answer is 80 lakh</think>How would you start?")).toBe(
      "How would you start?",
    );
  });

  it("speaks the words inside markdown rather than the markers", () => {
    expect(toSpeakableText("Use **population** times `frequency`.")).toBe(
      "Use population times frequency.",
    );
  });

  it("unwraps LaTeX so arithmetic is said, not spelled", () => {
    expect(toSpeakableText("So \\( 15 \\text{ crore} \\times 30\\% \\)")).toBe(
      "So 15 crore × 30%",
    );
  });

  /**
   * The regression that matters most. A blanket "strip symbols" pass would take
   * the rupee sign and the multiplication sign with the emoji — in an app whose
   * every answer is a rupee figure, that silently destroys the content.
   */
  it("keeps currency and arithmetic symbols", () => {
    expect(toSpeakableText("About ₹5 lakh × 30% ≈ ₹1.5 lakh")).toBe(
      "About ₹5 lakh × 30% ≈ ₹1.5 lakh",
    );
  });

  /**
   * Returns empty rather than whitespace, because the provider uses that to skip
   * speaking entirely — some browsers never fire `end` for an empty utterance,
   * which would leave the button stuck showing "speaking".
   */
  it("returns nothing for a turn that was entirely reasoning", () => {
    expect(toSpeakableText("<think>cut off mid-thou")).toBe("");
  });

  it("returns nothing for a turn that was only an emoji", () => {
    expect(toSpeakableText("👍")).toBe("");
  });
});

describe("pickVoice", () => {
  const v = (lang: string, isDefault = false) => ({ lang, default: isDefault });

  it("prefers an exact locale match", () => {
    expect(pickVoice([v("en-US", true), v("en-IN"), v("hi-IN")], "en-IN")).toEqual(v("en-IN"));
  });

  it("accepts a different region of the same language", () => {
    expect(pickVoice([v("fr-FR"), v("en-GB")], "en-IN")).toEqual(v("en-GB"));
  });

  /** The one the user already hears everywhere else beats an arbitrary sibling. */
  it("prefers the platform default among same-language voices", () => {
    expect(pickVoice([v("en-GB"), v("en-US", true)], "en-IN")).toEqual(v("en-US", true));
  });

  /**
   * Undefined leaves the utterance's `voice` unset, which means the platform
   * default — a better guess than any voice this could pick arbitrarily.
   */
  it("returns undefined when the language is absent entirely", () => {
    expect(pickVoice([v("fr-FR"), v("de-DE")], "en-IN")).toBeUndefined();
  });

  it("returns undefined for an empty voice list", () => {
    expect(pickVoice([], "en-IN")).toBeUndefined();
  });

  /** Some platforms report "en_IN" rather than "en-IN". */
  it("tolerates an underscore locale separator", () => {
    expect(pickVoice([v("en_IN")], "en-IN")).toEqual(v("en_IN"));
  });
});
