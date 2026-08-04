import type { SpeechErrorCode, SpeechHandlers, SpeechRecogniser } from "./types";

/**
 * Dictation via the browser's built-in Web Speech API.
 *
 * Costs nothing, needs no key and no server, which is why it is the default —
 * the same reasoning that keeps the LLM layer usable with no key at all. Chrome
 * and Edge implement it; Firefox does not, which `isSupported()` reports so the
 * UI can explain itself rather than silently lack a button.
 *
 * Worth being clear about: Chrome performs the recognition on Google's servers,
 * so audio leaves the machine. That is the one part of this app that isn't
 * offline, and it is the reason `SpeechRecogniser` is an interface — a
 * self-hosted transcriber behind an API route closes the gap later without the
 * call sites changing.
 *
 * No `"use client"` here: like `lib/llm/stream.ts` this is imported from a client
 * component, and every `window` access is inside a method rather than at module
 * scope, so importing it on the server is harmless.
 */

/* ── The slice of the Web Speech API this uses ────────────────────────────────
 * Hand-written because TypeScript's DOM lib omits SpeechRecognition entirely,
 * and `@types/dom-speech-recognition` is not worth a dependency for this much —
 * the same call the LLM adapters make in using bare `fetch` over provider SDKs.
 */

interface SpeechAlternative {
  readonly transcript: string;
}

interface SpeechResult {
  readonly isFinal: boolean;
  readonly length: number;
  readonly [index: number]: SpeechAlternative;
}

export interface SpeechResultList {
  readonly length: number;
  readonly [index: number]: SpeechResult;
}

interface SpeechResultEvent {
  readonly results: SpeechResultList;
}

interface SpeechErrorEvent {
  readonly error: string;
}

interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: ((event: SpeechErrorEvent) => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

function getConstructor(): SpeechRecognitionCtor | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

/* ── Pure logic, exported so it can be tested without a browser ───────────── */

/**
 * Split a result list into settled and still-changing text.
 *
 * With `continuous = true` the browser hands back **every** result of the
 * session on each event, not just the new ones, so this returns the full
 * transcript so far and the caller emits only what it hasn't seen. Getting that
 * wrong repeats every sentence as many times as the recogniser fires.
 *
 * Only the first alternative is read: the rest are lower-confidence guesses at
 * the same words, and concatenating them would produce nonsense.
 */
export function collectTranscript(results: SpeechResultList): {
  final: string;
  interim: string;
} {
  const finals: string[] = [];
  const interims: string[] = [];

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const text = result?.[0]?.transcript?.trim();
    if (!text) continue;
    (result.isFinal ? finals : interims).push(text);
  }

  return { final: finals.join(" "), interim: interims.join(" ") };
}

/**
 * Map a Web Speech error onto something worth telling the user about.
 *
 * `null` means "expected, stay quiet": `no-speech` fires whenever someone pauses
 * to think, which in this app is most of the time, and `aborted` is what our own
 * `stop()` looks like from here. Toasting either would make dictation feel broken
 * while it was working correctly.
 */
export function classifySpeechError(error: string): SpeechErrorCode | null {
  switch (error) {
    case "no-speech":
    case "aborted":
      return null;
    case "not-allowed":
    case "service-not-allowed":
      return "permission_denied";
    case "audio-capture":
      return "no_microphone";
    case "network":
      return "network";
    default:
      return "unavailable";
  }
}

/** Append a dictated segment to what's already in the box. */
export function appendSegment(existing: string, segment: string): string {
  const addition = segment.trim();
  if (!addition) return existing;
  if (!existing) return addition;
  return /\s$/.test(existing) ? existing + addition : `${existing} ${addition}`;
}

/* ── The recogniser ───────────────────────────────────────────────────────── */

let active: SpeechRecognitionInstance | null = null;

export const browserRecogniser: SpeechRecogniser = {
  name: "browser",

  isSupported() {
    return getConstructor() !== undefined;
  },

  start(handlers: SpeechHandlers, lang: string) {
    const Ctor = getConstructor();
    if (!Ctor) {
      handlers.onError("unavailable");
      handlers.onEnd();
      return;
    }
    // Nothing was started, so say so rather than leaving the caller to assume it
    // was — a silent return here is what makes a button claim to be listening.
    if (active) {
      handlers.onEnd();
      return;
    }

    const recognition = new Ctor();
    active = recognition;

    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    /** Cleared when the user stops, so `onend` can tell a pause from a stop. */
    let wantListening = true;
    /** How much of this recognition's final text has already been handed over. */
    let emitted = "";

    recognition.onresult = (event) => {
      const { final, interim } = collectTranscript(event.results);

      // Emit only the part we haven't sent yet. Finalised text grows by
      // appending, so the already-sent text is a prefix of it.
      if (final !== emitted) {
        const fresh = final.startsWith(emitted) ? final.slice(emitted.length) : final;
        emitted = final;
        if (fresh.trim()) handlers.onFinal(fresh.trim());
      }

      handlers.onInterim(interim);
    };

    recognition.onerror = (event) => {
      const code = classifySpeechError(event.error);
      if (!code) return;

      // Any real error ends the session rather than restarting into it. A denied
      // microphone or a flapping connection would otherwise loop through `onend`
      // forever, and the user can simply click the button again.
      wantListening = false;
      handlers.onError(code);
    };

    recognition.onend = () => {
      // Chrome ends the stream on a long silence even with `continuous` set, so
      // an end the user didn't ask for is a pause to resume, not a stop.
      if (wantListening && active === recognition) {
        emitted = "";
        try {
          recognition.start();
          return;
        } catch {
          // Already restarting, or the engine is gone — fall through and settle.
        }
      }
      if (active === recognition) active = null;
      handlers.onInterim("");
      handlers.onEnd();
    };

    try {
      recognition.start();
    } catch {
      active = null;
      handlers.onError("unavailable");
      handlers.onEnd();
    }
  },

  stop() {
    const recognition = active;
    if (!recognition) return;
    active = null;
    // `abort()` rather than `stop()`: stop waits to deliver a last result, which
    // would arrive after the UI has already left the listening state.
    recognition.abort();
  },
};
