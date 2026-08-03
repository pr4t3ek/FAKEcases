import { describe, it, expect } from "vitest";
import {
  appendSegment,
  classifySpeechError,
  collectTranscript,
  type SpeechResultList,
} from "@/lib/speech/browser";
import { getRecogniser } from "@/lib/speech";

/**
 * The browser half of dictation can't run here — vitest is `environment: "node"`
 * and there is no jsdom. What's testable is the logic that was deliberately kept
 * pure, which is also where the bugs live: transcript assembly, error triage and
 * the append rule.
 */

/** Build a result list shaped like the one the Web Speech API hands back. */
function results(...entries: [text: string, isFinal: boolean][]): SpeechResultList {
  const list: Record<number, unknown> = {};
  entries.forEach(([transcript, isFinal], i) => {
    list[i] = { isFinal, length: 1, 0: { transcript } };
  });
  return { ...list, length: entries.length } as SpeechResultList;
}

describe("collectTranscript", () => {
  it("concatenates finalised segments in order", () => {
    const { final, interim } = collectTranscript(
      results(["Let me segment the population.", true], ["Urban first.", true]),
    );

    expect(final).toBe("Let me segment the population. Urban first.");
    expect(interim).toBe("");
  });

  it("keeps still-changing text out of the final transcript", () => {
    const { final, interim } = collectTranscript(
      results(["Roughly two lakh households", true], ["in Pune and", false]),
    );

    // Mixing the two is what makes dictation repeat itself: interim text is
    // re-sent, revised, on every event.
    expect(final).toBe("Roughly two lakh households");
    expect(interim).toBe("in Pune and");
  });

  it("returns empty strings for an empty list", () => {
    expect(collectTranscript(results())).toEqual({ final: "", interim: "" });
  });

  it("skips blank and whitespace-only results", () => {
    const { final } = collectTranscript(
      results(["First.", true], ["   ", true], ["Second.", true]),
    );

    expect(final).toBe("First. Second.");
  });

  it("reads only the best alternative", () => {
    const list = {
      0: { isFinal: true, length: 2, 0: { transcript: "crore" }, 1: { transcript: "core" } },
      length: 1,
    } as unknown as SpeechResultList;

    // The others are lower-confidence guesses at the same words; joining them
    // would produce "crore core".
    expect(collectTranscript(list).final).toBe("crore");
  });

  it("trims each segment so joining can't double-space", () => {
    expect(collectTranscript(results([" one ", true], [" two ", true])).final).toBe("one two");
  });
});

describe("classifySpeechError", () => {
  it("stays quiet on the errors that happen while working normally", () => {
    // Someone pausing to think is the normal case in this app, and `aborted` is
    // what our own stop() looks like from here.
    expect(classifySpeechError("no-speech")).toBeNull();
    expect(classifySpeechError("aborted")).toBeNull();
  });

  it("reports the ones the user can act on", () => {
    expect(classifySpeechError("not-allowed")).toBe("permission_denied");
    expect(classifySpeechError("service-not-allowed")).toBe("permission_denied");
    expect(classifySpeechError("audio-capture")).toBe("no_microphone");
    expect(classifySpeechError("network")).toBe("network");
  });

  it("falls back rather than swallowing an unknown error", () => {
    expect(classifySpeechError("something-new")).toBe("unavailable");
  });
});

describe("appendSegment", () => {
  it("separates a segment from existing text with one space", () => {
    expect(appendSegment("Urban households", "are about two lakh")).toBe(
      "Urban households are about two lakh",
    );
  });

  it("doesn't add a second space when the text already ends in one", () => {
    expect(appendSegment("Urban households ", "are about two lakh")).toBe(
      "Urban households are about two lakh",
    );
  });

  it("doesn't lead with a space in an empty box", () => {
    expect(appendSegment("", "First thought")).toBe("First thought");
  });

  it("leaves the text alone when the segment is blank", () => {
    expect(appendSegment("Unchanged", "   ")).toBe("Unchanged");
  });

  it("preserves a deliberate newline as the separator", () => {
    expect(appendSegment("Line one\n", "Line two")).toBe("Line one\nLine two");
  });
});

describe("getRecogniser", () => {
  it("defaults to the browser provider", () => {
    expect(getRecogniser().name).toBe("browser");
  });

  it("reports no support without a window", () => {
    // Node has no `window`, which is exactly the server-render case the hook
    // guards against by starting `supported` false.
    expect(getRecogniser().isSupported()).toBe(false);
  });
});
