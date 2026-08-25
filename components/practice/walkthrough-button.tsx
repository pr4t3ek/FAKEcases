"use client";

import { useState } from "react";
import { Lightbulb } from "lucide-react";

import { WalkthroughPlayer } from "./walkthrough-player";
import type { DemoWalkthroughView } from "./types";

/**
 * The way back into the worked example.
 *
 * It used to be reachable only from the first-run welcome modal, which meant a
 * student who clicked past it — or who was not new when the feature shipped —
 * could never see it again. That is the wrong shape for the one thing on this
 * screen a stuck beginner would actually want: the moment somebody needs a
 * worked example is not their first thirty seconds, it is the third time they
 * stare at an empty tree.
 *
 * So it lives in the header beside the tutorial button, and both are always
 * there.
 *
 * Renders nothing at all when `demo` is null — nothing published for this
 * question's kind — so callers can drop it in unconditionally rather than each
 * deciding whether today is a day it exists.
 *
 * The example is picked server-side to match the attempt's own answer mode, so
 * this only has to say which one arrived.
 */
export function WalkthroughButton({
  demo,
  variant = "header",
}: {
  demo: DemoWalkthroughView | null;
  /** `header` is the small ghost button; `inline` is a plain link for prose. */
  variant?: "header" | "inline";
}) {
  const [open, setOpen] = useState(false);
  if (!demo) return null;

  const isCase = demo.content.kind === "case";

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        data-tour="walkthrough-btn"
        title={
          isCase
            ? "Watch a case worked out step by step"
            : "Watch a guesstimate worked out step by step"
        }
        className={
          variant === "header"
            ? "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            : "inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
        }
      >
        <Lightbulb className="h-3.5 w-3.5" />
        Worked example
      </button>

      {open ? (
        <WalkthroughPlayer
          title={demo.title}
          prompt={demo.prompt}
          unit={demo.unit}
          content={demo.content}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
