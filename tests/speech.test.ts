import { describe, it, expect, vi, afterEach } from "vitest";
import {
  appendSegment,
  browserRecogniser,
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

/**
 * The session state machine, driven through a fake `SpeechRecognition`.
 *
 * No jsdom needed: `getConstructor()` only reads `window.SpeechRecognition`, so
 * stubbing a `window` is enough to exercise the real recogniser. This is the
 * half where the interesting bugs live — a session that ends without saying so
 * leaves the UI asserting it is listening to a recogniser that stopped.
 */

/** Minimal stand-in for the browser's SpeechRecognition. */
class FakeRecognition {
  static instances: FakeRecognition[] = [];
  /** Static: an instance field would be unreachable, since the recogniser
   *  constructs its own instance before the test can touch it. */
  static throwOnStart = false;

  lang = "";
  continuous = false;
  interimResults = false;
  maxAlternatives = 0;
  startCalls = 0;
  aborted = false;

  onresult: ((event: { results: SpeechResultList }) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;

  constructor() {
    FakeRecognition.instances.push(this);
  }

  start() {
    if (FakeRecognition.throwOnStart) throw new Error("already started");
    this.startCalls++;
  }

  stop() {
    this.onend?.();
  }

  abort() {
    this.aborted = true;
    this.onend?.();
  }

  /** What the browser does when it gives up on a silence. */
  endFromBrowser() {
    this.onend?.();
  }
}

function handlers() {
  return {
    onFinal: vi.fn(),
    onInterim: vi.fn(),
    onError: vi.fn(),
    onEnd: vi.fn(),
  };
}

function withSpeechApi(): FakeRecognition {
  FakeRecognition.instances = [];
  vi.stubGlobal("window", { SpeechRecognition: FakeRecognition });
  return FakeRecognition.instances[0];
}

/** The instance created by the most recent `start()`. */
function latest(): FakeRecognition {
  return FakeRecognition.instances[FakeRecognition.instances.length - 1];
}

describe("browser recogniser session", () => {
  afterEach(() => {
    browserRecogniser.stop();
    vi.unstubAllGlobals();
    FakeRecognition.instances = [];
  });

  it("configures the recogniser for continuous dictation in the given language", () => {
    withSpeechApi();
    browserRecogniser.start(handlers(), "en-IN");

    const recognition = latest();
    expect(recognition.lang).toBe("en-IN");
    expect(recognition.continuous).toBe(true);
    expect(recognition.interimResults).toBe(true);
    expect(recognition.startCalls).toBe(1);
  });

  it("emits only newly finalised text, never a repeat", () => {
    withSpeechApi();
    const h = handlers();
    browserRecogniser.start(h, "en-IN");

    // The API hands back every result of the session on each event, so a naive
    // handler re-sends the whole transcript and repeats every sentence.
    latest().onresult?.({ results: results(["Urban first.", true]) });
    latest().onresult?.({
      results: results(["Urban first.", true], ["Then rural.", true]),
    });

    expect(h.onFinal.mock.calls.map((c) => c[0])).toEqual(["Urban first.", "Then rural."]);
  });

  it("reports the session ending when the browser stops for good", () => {
    withSpeechApi();
    const h = handlers();
    browserRecogniser.start(h, "en-IN");

    browserRecogniser.stop();

    expect(h.onEnd).toHaveBeenCalledTimes(1);
    expect(latest().aborted).toBe(true);
  });

  it("resumes after a silence without reporting the session as over", () => {
    withSpeechApi();
    const h = handlers();
    browserRecogniser.start(h, "en-IN");

    // Chrome ends the stream on a long pause even with `continuous` set. Calling
    // onEnd here would flicker the button off every time someone stops to think.
    latest().endFromBrowser();

    expect(h.onEnd).not.toHaveBeenCalled();
    expect(latest().startCalls).toBe(2);
  });

  it("stops for good after an error rather than restarting into it", () => {
    withSpeechApi();
    const h = handlers();
    browserRecogniser.start(h, "en-IN");

    latest().onerror?.({ error: "not-allowed" });
    latest().endFromBrowser();

    expect(h.onError).toHaveBeenCalledWith("permission_denied");
    expect(h.onEnd).toHaveBeenCalledTimes(1);
    // A denied microphone would otherwise loop through onend forever.
    expect(latest().startCalls).toBe(1);
  });

  it("stays quiet and keeps listening through a benign error", () => {
    withSpeechApi();
    const h = handlers();
    browserRecogniser.start(h, "en-IN");

    // Someone pausing to think is the normal case in this app.
    latest().onerror?.({ error: "no-speech" });
    latest().endFromBrowser();

    expect(h.onError).not.toHaveBeenCalled();
    expect(h.onEnd).not.toHaveBeenCalled();
    expect(latest().startCalls).toBe(2);
  });

  it("reports the end when a second start finds one already running", () => {
    withSpeechApi();
    browserRecogniser.start(handlers(), "en-IN");

    const second = handlers();
    browserRecogniser.start(second, "en-IN");

    // Silently returning is what lets a button claim to be listening.
    expect(second.onEnd).toHaveBeenCalledTimes(1);
    expect(FakeRecognition.instances).toHaveLength(1);
  });

  it("reports an unavailable provider when there is no Speech API", () => {
    vi.stubGlobal("window", {});
    const h = handlers();

    browserRecogniser.start(h, "en-IN");

    expect(h.onError).toHaveBeenCalledWith("unavailable");
    expect(h.onEnd).toHaveBeenCalledTimes(1);
  });

  it("reports the end when start() throws", () => {
    withSpeechApi();
    const h = handlers();
    FakeRecognition.throwOnStart = true;

    try {
      browserRecogniser.start(h, "en-IN");
      expect(h.onError).toHaveBeenCalledWith("unavailable");
      expect(h.onEnd).toHaveBeenCalledTimes(1);
    } finally {
      FakeRecognition.throwOnStart = false;
    }
  });
});
