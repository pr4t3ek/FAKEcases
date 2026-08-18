import { toReadableText, toSegments } from "@/lib/llm/plain-text";
import type { SpeakHandlers, SpeakOptions, SpeechSpeaker } from "./types";

/**
 * Speaking with the browser's built-in `speechSynthesis`.
 *
 * Free, keyless, offline and already installed — the same stance as the mock
 * interviewer and the dictation provider beside it. And unlike dictation, it is
 * not a Chromium-only feature: Firefox and Safari implement this one.
 *
 * The interesting parts of this file are not the synthesis call, which is four
 * lines, but the three ways browsers make it harder than it looks. Each is
 * commented where it is handled.
 */

/**
 * Text the model wrote, as it should be SAID.
 *
 * Reuse rather than a second parser. `toReadableText` already strips a reasoning
 * block, unwraps LaTeX and drops markdown the bubble cannot render, and
 * `toSegments` already separates the `**bold**` and `` `code` `` markers from
 * the words inside them — so joining the segment texts back together is exactly
 * the visible prose, which is exactly what should be spoken. Writing a separate
 * stripper here would be a second thing to keep in step with the first.
 *
 * One addition on top: emoji. A hint is stored as "💡 Hint 3: …"
 * (`app/api/hint/route.ts`), and a synthesiser reads that aloud as "light bulb
 * Hint 3", which is worse than silence. The symbols the app actually uses in
 * prose — ₹, ×, ≈ — are NOT emoji and are left alone, because a voice saying
 * "rupees" and "times" is the point.
 */
export function toSpeakableText(raw: string): string {
  const visible = toSegments(toReadableText(raw))
    .map((segment) => segment.text)
    .join("");

  return (
    visible
      // Pictographs and their modifiers only. Deliberately not a broad "strip
      // symbols" pass: ₹ (U+20B9) and × (U+00D7) are currency and arithmetic,
      // and a sizing answer read without them is unintelligible.
      .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, "")
      .replace(/\s{2,}/g, " ")
      .trim()
  );
}

/**
 * The best available voice for a language, or undefined to let the browser pick.
 *
 * Exact locale first, then the same language in any region, then nothing. Pure
 * over an array so it can be tested without a browser — which matters more here
 * than usual, because every OS ships a different voice list and the interesting
 * cases (no en-IN, no English at all, empty list) are precisely the ones a
 * developer's machine will not reproduce.
 *
 * Returning undefined rather than a fallback is deliberate: an unset `voice` on
 * the utterance means the platform default, which is a better guess than any
 * arbitrary voice this could choose.
 */
export function pickVoice<T extends { lang: string; default?: boolean }>(
  voices: readonly T[],
  lang: string,
): T | undefined {
  if (!voices.length) return undefined;

  const wanted = lang.toLowerCase();
  const base = wanted.split("-")[0];

  const exact = voices.find((v) => v.lang.toLowerCase().replace("_", "-") === wanted);
  if (exact) return exact;

  const sameLanguage = voices.filter(
    (v) => v.lang.toLowerCase().replace("_", "-").split("-")[0] === base,
  );
  if (sameLanguage.length) {
    // A voice the platform marked default is the one the user already hears
    // everywhere else, so prefer it over an arbitrary regional sibling.
    return sameLanguage.find((v) => v.default) ?? sameLanguage[0];
  }

  return undefined;
}

function synth(): SpeechSynthesis | undefined {
  if (typeof window === "undefined") return undefined;
  return window.speechSynthesis ?? undefined;
}

/**
 * Chrome stops speaking after roughly fifteen seconds.
 *
 * A long-standing Chromium bug: an utterance longer than about that is cut off
 * mid-sentence with no error. A Teacher-mode explanation is comfortably past it.
 * The accepted workaround is to pause and immediately resume on a timer, which
 * resets the internal watchdog without any audible seam.
 *
 * Harmless where the bug does not exist — pausing and resuming a playing
 * utterance is a no-op in Firefox and Safari — so it runs unconditionally rather
 * than behind a browser sniff.
 */
const KEEPALIVE_MS = 10_000;
let keepalive: ReturnType<typeof setInterval> | null = null;

function startKeepalive(api: SpeechSynthesis) {
  stopKeepalive();
  keepalive = setInterval(() => {
    if (!api.speaking) {
      stopKeepalive();
      return;
    }
    api.pause();
    api.resume();
  }, KEEPALIVE_MS);
}

function stopKeepalive() {
  if (keepalive !== null) {
    clearInterval(keepalive);
    keepalive = null;
  }
}

export const browserSpeaker: SpeechSpeaker = {
  name: "browser",

  isSupported() {
    return synth() !== undefined && typeof window.SpeechSynthesisUtterance === "function";
  },

  speak(text: string, options: SpeakOptions, handlers: SpeakHandlers) {
    const api = synth();
    if (!api) {
      handlers.onError("unavailable");
      handlers.onEnd();
      return;
    }

    const speakable = toSpeakableText(text);
    // A turn that was entirely a reasoning block, or entirely an emoji, has
    // nothing to say. Ending cleanly beats an utterance of "" — which some
    // browsers never fire `end` for, leaving the button stuck.
    if (!speakable) {
      handlers.onEnd();
      return;
    }

    // Before every utterance, not just when something is playing: a cancelled
    // utterance can still be in the queue, and queueing behind it would have the
    // previous turn talk over this one.
    api.cancel();

    const utterance = new SpeechSynthesisUtterance(speakable);
    utterance.lang = options.lang;
    utterance.rate = options.rate;

    // Resolved here rather than at module load. `getVoices()` returns an empty
    // array on first call in Chrome and populates asynchronously, so a voice
    // chosen once when the module was imported would be no voice at all.
    const voice = pickVoice(api.getVoices(), options.lang);
    if (voice) utterance.voice = voice;

    utterance.onstart = () => {
      startKeepalive(api);
      handlers.onStart();
    };
    utterance.onend = () => {
      stopKeepalive();
      handlers.onEnd();
    };
    utterance.onerror = (event) => {
      stopKeepalive();
      // "interrupted" and "canceled" are what a deliberate stop looks like, and
      // reporting those as failures would toast at the user for doing what they
      // asked for.
      const reason = (event as SpeechSynthesisErrorEvent).error;
      if (reason !== "interrupted" && reason !== "canceled") {
        handlers.onError(reason === "not-allowed" ? "not_allowed" : "interrupted");
      }
      handlers.onEnd();
    };

    api.speak(utterance);
  },

  stop() {
    stopKeepalive();
    synth()?.cancel();
  },
};
