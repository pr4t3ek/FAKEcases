"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { speechConfig } from "@/lib/config";
import { getSpeaker } from "@/lib/speech";
import type { SpeakErrorCode } from "@/lib/speech";

/** What the user can actually do about a failure. Silence isn't help. */
const ERROR_MESSAGE: Record<SpeakErrorCode, string> = {
  not_allowed: "Your browser blocked audio. Interact with the page and try again.",
  interrupted: "Playback stopped unexpectedly.",
  unavailable: "Reading aloud isn't available in this browser.",
};

/**
 * Drive the configured `SpeechSpeaker` from React — the mirror of
 * `use-speech-input`, and meant to be read as a pair with it.
 *
 * `supported` starts false and corrects after mount for the same reason spelled
 * out there and in `use-media-query.ts`: the check needs `window`, so reading it
 * during render would disagree with the server's HTML and hydrate wrong.
 *
 * Tracks WHICH message is speaking rather than a bare boolean, because the
 * buttons are per-bubble: without the id, every speaker icon on screen would
 * light up at once.
 */
export function useSpeechOutput(rate: number = speechConfig.defaultRate) {
  const [supported, setSupported] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  // The live rate, held in a ref so a speed change mid-session is picked up by
  // the next utterance without `speak` being rebuilt and every button
  // re-rendering.
  const rateRef = useRef(rate);
  rateRef.current = rate;

  useEffect(() => {
    setSupported(getSpeaker().isSupported());
  }, []);

  const stop = useCallback(() => {
    getSpeaker().stop();
    setSpeakingId(null);
  }, []);

  const speak = useCallback((id: string, text: string) => {
    // Set before starting, not after: `onEnd` can fire synchronously inside
    // `speak()` — an empty utterance does exactly that — and an optimistic value
    // written afterwards would overwrite the correction, leaving a button
    // insisting it is speaking over silence.
    setSpeakingId(id);

    getSpeaker().speak(
      text,
      { lang: speechConfig.lang, rate: rateRef.current },
      {
        onStart: () => setSpeakingId(id),
        onError: (code) => toast.error(ERROR_MESSAGE[code]),
        // The provider is the authority on whether audio is still playing. This
        // is the only thing that clears the speaking state on its own, and it
        // clears it only if THIS message is still the one on screen — a second
        // utterance cancels the first, and the first's `end` must not then
        // silence the button for the one now playing.
        onEnd: () => setSpeakingId((current) => (current === id ? null : current)),
      },
    );
  }, []);

  const toggle = useCallback(
    (id: string, text: string) => {
      if (speakingId === id) stop();
      else speak(id, text);
    },
    [speakingId, speak, stop],
  );

  // Leaving the page mid-sentence must not leave the browser talking, exactly as
  // it must not leave the microphone open.
  useEffect(() => () => getSpeaker().stop(), []);

  return { supported, speakingId, speak, stop, toggle };
}
