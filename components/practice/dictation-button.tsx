"use client";

import { useCallback } from "react";
import { Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { appendSegment } from "@/lib/speech/browser";
import { cn } from "@/lib/utils";
import { useSpeechInput } from "./use-speech-input";

/**
 * Dictate into a text box.
 *
 * Self-contained so adding voice to another field costs one element. The box it
 * writes into stays the single source of truth: dictated text is appended to
 * whatever is already there, so typing and speaking mix freely and the result is
 * editable before it's sent.
 *
 * It never sends anything. Recognition mishears often enough — names, numbers,
 * anything said quickly — that auto-sending on a pause would post a mangled
 * answer to the interviewer and score it.
 */
export function DictationButton({
  value,
  onValueChange,
  disabled,
  className,
}: {
  value: string;
  onValueChange: (next: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const handleFinal = useCallback(
    (text: string) => onValueChange(appendSegment(value, text)),
    [value, onValueChange],
  );

  const { supported, listening, interim, toggle } = useSpeechInput({ onFinal: handleFinal });

  const label = !supported
    ? "Voice input needs Chrome or Edge"
    : listening
      ? "Stop dictating"
      : "Dictate your answer";

  return (
    <div className={cn("relative", className)}>
      {/* Positioned rather than in the flow: interim text changes on every
          syllable, and reflowing the composer while someone speaks is worse
          than not showing it at all. */}
      {listening && interim && (
        <span className="pointer-events-none absolute bottom-full right-0 mb-1 max-w-[240px] truncate rounded bg-muted px-2 py-1 text-[11px] text-muted-foreground shadow-sm">
          {interim}
        </span>
      )}

      <Button
        type="button"
        size="icon"
        variant={listening ? "destructive" : "outline"}
        onClick={toggle}
        // Disabled rather than hidden where unsupported: a button that isn't
        // there is a mystery, one that explains itself is not.
        disabled={disabled || !supported}
        title={label}
        aria-label={label}
        aria-pressed={listening}
      >
        <Mic className={cn("h-4 w-4", listening && "animate-pulse")} />
      </Button>
    </div>
  );
}
