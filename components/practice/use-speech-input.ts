"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { speechConfig } from "@/lib/config";
import { getRecogniser } from "@/lib/speech";
import type { SpeechErrorCode } from "@/lib/speech";

/** What the user can actually do about a failure. Silence isn't help. */
const ERROR_MESSAGE: Record<SpeechErrorCode, string> = {
  permission_denied: "Microphone blocked. Allow it in your browser's site settings.",
  no_microphone: "No microphone found.",
  network: "Speech recognition lost its connection. Try again.",
  unavailable: "Voice input isn't available in this browser.",
};

/**
 * Drive the configured `SpeechRecogniser` from React.
 *
 * `supported` starts false and corrects after mount for the reason spelled out
 * in `use-media-query.ts`: the check needs `window`, so reading it during render
 * would disagree with the server's HTML and hydrate wrong.
 */
export function useSpeechInput({ onFinal }: { onFinal: (text: string) => void }) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");

  // Held in a ref so starting dictation doesn't capture a stale callback — the
  // caller's `onFinal` closes over `value`, which changes on every keystroke.
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  useEffect(() => {
    setSupported(getRecogniser().isSupported());
  }, []);

  const stop = useCallback(() => {
    getRecogniser().stop();
    setListening(false);
    setInterim("");
  }, []);

  const start = useCallback(() => {
    getRecogniser().start(
      {
        onFinal: (text) => onFinalRef.current(text),
        onInterim: setInterim,
        onError: (code) => {
          setListening(false);
          setInterim("");
          toast.error(ERROR_MESSAGE[code]);
        },
      },
      speechConfig.lang,
    );
    setListening(true);
  }, []);

  const toggle = useCallback(() => {
    if (listening) stop();
    else start();
  }, [listening, start, stop]);

  // Leaving the page mid-sentence must not leave the microphone open.
  useEffect(() => () => getRecogniser().stop(), []);

  return { supported, listening, interim, toggle, stop };
}
