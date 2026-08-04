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
