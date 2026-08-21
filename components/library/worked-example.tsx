"use client";

import { useEffect, useState } from "react";
import { GraduationCap, Lightbulb } from "lucide-react";
import { workedExample } from "@/lib/config";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * The one thing nothing else on the way in teaches: how a guesstimate is
 * actually solved.
 *
 * It sits on the library rather than in the practice screen because the practice
 * clock cannot pause — `useElapsedTimer` runs from mount to submit, deliberately,
 * since `Attempt.timeSpentSec` is the leaderboard tiebreak. A tutorial shown
 * mid-attempt spends ranked time on reading, so this one happens before an
 * attempt exists.
 *
 * The steps are rendered as the tree they would be, indent and all, so the
 * method maps onto the builder the reader is about to open rather than being
 * taught in the abstract.
 */

/**
 * Auto-opened once, then only on request.
 *
 * `localStorage` rather than a column, matching how the practice tour remembers
 * being dismissed (`eq-tour-off`). `User.onboardedAt` is deliberately left
 * alone: its schema comment pins it to the practice-screen tutorial, and one
 * column answering two questions is how a flag stops meaning anything. The cost
 * is that a new browser sees it again, which for a teaching aid is the harmless
 * direction to be wrong in.
 */
const SEEN_KEY = "cc-worked-example-seen";

export function WorkedExampleButton() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Wrapped because a private window or blocked site data throws on access
    // rather than returning null, and a tutorial must not take the page down.
    try {
      if (!localStorage.getItem(SEEN_KEY)) setOpen(true);
    } catch {
      /* no storage, no auto-open — the button is still there */
    }
  }, []);

  function change(next: boolean) {
    setOpen(next);
    if (!next) {
      try {
        localStorage.setItem(SEEN_KEY, "1");
      } catch {
        /* nothing to remember it with; it opens again next time */
      }
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="shrink-0">
        <GraduationCap className="h-4 w-4" /> How to solve one
      </Button>
      <WorkedExampleDialog open={open} onOpenChange={change} />
    </>
  );
}

function WorkedExampleDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { question, intro, steps, totalLabel, sanityCheck, habits } = workedExample;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>How a guesstimate is solved</DialogTitle>
          <DialogDescription>{intro}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <p className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm font-medium">
            {question}
          </p>

          {/* Indented like the builder's tree: each step is a slice of the one
              above it, which is the shape the reader is about to work in. */}
          <ol className="space-y-3">
            {steps.map((step, i) => (
              <li
                key={step.label}
                className="border-l-2 border-border pl-4"
                style={{ marginLeft: `${i * 0.75}rem` }}
              >
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-sm font-medium">{step.label}</span>
                  <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs tabular-nums">
                    {step.value}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{step.why}</p>
              </li>
            ))}
          </ol>

          <div className="rounded-lg border bg-card px-4 py-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Multiply through
            </div>
            <div className="mt-1 font-mono text-sm tabular-nums">
              {steps.map((s) => s.value).join(" × ")} ={" "}
              <span className="font-semibold text-primary">{totalLabel}</span>
            </div>
          </div>

          <div className="flex gap-3 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3">
            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <div>
              <div className="text-sm font-medium">Now check it against something you know</div>
              <p className="mt-1 text-sm text-muted-foreground">{sanityCheck.text}</p>
            </div>
          </div>

          <div>
            <div className="text-sm font-medium">Three habits to take into the real one</div>
            <ul className="mt-2 space-y-1.5">
              {habits.map((habit) => (
                <li key={habit} className="flex gap-2 text-sm text-muted-foreground">
                  <span aria-hidden className="text-primary">
                    •
                  </span>
                  <span>{habit}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            Got it — pick a question
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
