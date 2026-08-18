/**
 * Provider-agnostic dictation.
 *
 * The seam sits at "give me dictated text" rather than at any one API's shape,
 * because the two kinds of provider work very differently: the browser
 * recognises speech client-side and streams partial results, while a hosted API
 * records audio and transcribes it in one batch after the fact. Anything narrower
 * would bake the browser's streaming model in and have to be rewritten to add a
 * server provider.
 *
 * A batch provider satisfies this interface by never calling `onInterim` and
 * calling `onFinal` once when recording stops.
 */

export type SpeechErrorCode =
  /** The user refused the microphone, or the browser blocked it. Actionable. */
  | "permission_denied"
  /** No capture device. Actionable. */
  | "no_microphone"
  /** Transient: the recogniser lost its connection. */
  | "network"
  /** Anything else — provider not available, unexpected failure. */
  | "unavailable";

export interface SpeechHandlers {
  /** A settled segment of transcript. Appended to the box as it arrives. */
  onFinal(text: string): void;
  /**
   * Live, still-changing text. Streaming providers call this continuously;
   * batch providers never call it at all.
   */
  onInterim(text: string): void;
  onError(code: SpeechErrorCode): void;
  /**
   * The session is over and will not resume itself. Always the last call, and
   * always made — including when `start()` never got as far as recording.
   *
   * Without this the caller has no way to tell a live session from a dead one,
   * and a UI that reports "listening" is left asserting it over a recogniser
   * that stopped. A batch provider uses the same call to report that its upload
   * finished.
   */
  onEnd(): void;
}

export interface SpeechRecogniser {
  /** Provider name, for diagnostics. */
  readonly name: string;
  /**
   * Whether this provider can actually run here. Read after mount only — on the
   * server it is always false, because the check needs `window`.
   */
  isSupported(): boolean;
  /** Begin dictating. Safe to call when already started. */
  start(handlers: SpeechHandlers, lang: string): void;
  /** Stop dictating. Safe to call when not started. */
  stop(): void;
}

// ── Speaking ────────────────────────────────────────────────────────────────

/**
 * Provider-agnostic speech OUTPUT, the mirror of `SpeechRecogniser` above.
 *
 * The seam sits at "say this text" for the same reason the recogniser's sits at
 * "give me dictated text": the two kinds of provider are shaped differently. The
 * browser synthesises locally and fires events as it goes, while a hosted API
 * returns an audio file to play. Anything narrower — an `AudioBuffer`, a voice
 * id, a URL — would bake one of those in.
 *
 * Note the asymmetry with dictation, and it is worth stating because it inverts
 * the README's existing caveat: `SpeechRecognition` is Chrome and Edge only,
 * while `speechSynthesis` is implemented in Firefox and Safari too. Voice OUTPUT
 * reaches browsers voice INPUT cannot.
 */

export type SpeakErrorCode =
  /** The browser blocked playback, usually for want of a user gesture. */
  | "not_allowed"
  /** Synthesis started and failed part-way. */
  | "interrupted"
  /** No provider here — server-side, or a browser without the API. */
  | "unavailable";

export interface SpeakHandlers {
  /** Audio has actually begun. Not the same moment as `speak()` returning. */
  onStart(): void;
  onError(code: SpeakErrorCode): void;
  /**
   * Nothing is playing any more, for any reason — finished, cancelled or failed.
   * Always the last call and always made, including when `speak()` never got as
   * far as producing sound.
   *
   * The same contract `SpeechHandlers.onEnd` documents, and it exists for the
   * same failure: the provider is the only authority on whether audio is still
   * playing, and without this a button is left asserting "speaking" over a
   * synthesiser that stopped.
   */
  onEnd(): void;
}

export interface SpeakOptions {
  /** BCP-47, e.g. "en-IN". Used to choose a voice. */
  lang: string;
  /** Playback rate. 1 is the voice's natural speed. */
  rate: number;
}

export interface SpeechSpeaker {
  /** Provider name, for diagnostics. */
  readonly name: string;
  /**
   * Whether this provider can actually run here. Read after mount only — on the
   * server it is always false, because the check needs `window`.
   */
  isSupported(): boolean;
  /**
   * Say something. Cancels anything already playing rather than queueing behind
   * it: two interviewer turns talking over each other is never what was wanted.
   */
  speak(text: string, options: SpeakOptions, handlers: SpeakHandlers): void;
  /** Stop. Safe to call when nothing is playing. */
  stop(): void;
}
