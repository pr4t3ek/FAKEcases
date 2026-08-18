"use client";

import { Volume2, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Read one assistant turn aloud.
 *
 * The output counterpart of `DictationButton`, and it follows the same rules:
 * self-contained so attaching it to another surface costs one element, and
 * **disabled rather than hidden** where unsupported — a button that isn't there
 * is a mystery, one that explains itself is not.
 *
 * Unlike the mic, this one is rarely disabled: `speechSynthesis` is implemented
 * in Firefox and Safari as well as Chromium, so the "Chrome or Edge only"
 * caveat that applies to dictation does not apply here.
 *
 * Deliberately quiet in the layout. It sits on every interviewer bubble, so it
 * is ghost-styled and small: a row of loud buttons down the transcript would
 * compete with the text they exist to read.
 */
export function SpeakButton({
  speaking,
  supported,
  onToggle,
  className,
}: {
  speaking: boolean;
  supported: boolean;
  onToggle: () => void;
  className?: string;
}) {
  const label = !supported
    ? "Reading aloud isn't available in this browser"
    : speaking
      ? "Stop reading"
      : "Read this aloud";

  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      onClick={onToggle}
      disabled={!supported}
      title={label}
      aria-label={label}
      aria-pressed={speaking}
      className={cn("h-6 w-6 text-muted-foreground hover:text-foreground", className)}
    >
      {speaking ? (
        <Square className="h-3 w-3 fill-current" />
      ) : (
        <Volume2 className="h-3.5 w-3.5" />
      )}
    </Button>
  );
}
