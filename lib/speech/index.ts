import { speechConfig } from "@/lib/config";
import { browserRecogniser } from "./browser";
import { browserSpeaker } from "./browser-tts";
import type { SpeechRecogniser, SpeechSpeaker } from "./types";

export type {
  SpeechErrorCode,
  SpeechHandlers,
  SpeechRecogniser,
  SpeakErrorCode,
  SpeakHandlers,
  SpeakOptions,
  SpeechSpeaker,
} from "./types";

/**
 * Pick the dictation provider, the same way `getAdapter()` picks an LLM.
 *
 * One case today. The switch is the point: it is where a hosted transcriber
 * arrives without any call site changing.
 *
 * Adding one means:
 *   - `lib/speech/<name>.ts` implementing `SpeechRecogniser` — a `MediaRecorder`
 *     collecting audio on `start()`, uploading it on `stop()`, and calling
 *     `onFinal` once with the result. Batch providers never call `onInterim`,
 *     which the interface already allows for.
 *   - `app/api/transcribe/route.ts` to hold the API key server-side, as every
 *     LLM key is. A key inlined into the client bundle is a key given away.
 *   - a `case` here, selected by `NEXT_PUBLIC_SPEECH_PROVIDER`.
 */
export function getRecogniser(): SpeechRecogniser {
  switch (speechConfig.provider) {
    case "browser":
    default:
      return browserRecogniser;
  }
}

/**
 * Pick the speech-output provider, exactly as `getRecogniser()` picks the input
 * one. One case today; the switch is where a hosted TTS arrives without any call
 * site changing — `lib/speech/<name>.ts` implementing `SpeechSpeaker`, an
 * `app/api/speak/route.ts` holding the key server-side, and a `case` here.
 */
export function getSpeaker(): SpeechSpeaker {
  switch (speechConfig.provider) {
    case "browser":
    default:
      return browserSpeaker;
  }
}
