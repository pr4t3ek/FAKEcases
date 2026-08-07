"use client";

/**
 * Starting a second run of a scenario you have already played.
 *
 * Replaying has always worked — a committed run ends in `phase: "debrief"`, so
 * `findResumableRun` returns null and `startSimulation` mints a fresh run. What
 * was missing is that nobody was told, and in particular nobody was told what it
 * costs: only a first result is ever ranked (see `recordFirstResult` in
 * lib/leaderboard.ts), so a replay cannot improve a standing.
 *
 * That disclosure used to arrive *after* the whole budget had been spent, as the
 * "Unranked — this was a replay" notice on the debrief. Saying it here, before
 * the run starts, is the difference between an explanation and an excuse.
 *
 * Lives in one component because the library card and the debrief report both
 * offer this, and the two must not word the bargain differently.
 */

import { useState, useTransition } from "react";
import { RotateCcw } from "lucide-react";
import { startSimulation } from "@/app/actions/simulations";
import { Button, type ButtonProps } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";

export function ReplayButton({
  questionId,
  label = "Play again",
  variant = "default",
  className,
  /**
   * True when the run being looked at is *itself* already a replay — the report
   * knows this from `standing.isThisAttempt`. It only changes the wording: there
   * is no ranked score to protect that a previous replay hasn't already failed
   * to move.
   */
  alreadyReplay = false,
}: {
  questionId: string;
  label?: string;
  variant?: ButtonProps["variant"];
  className?: string;
  alreadyReplay?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <Button variant={variant} className={className} onClick={() => setOpen(true)}>
        <RotateCcw /> {label}
      </Button>

      <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
        <DialogContent className="sm:max-w-md">
          <DialogTitle>Start this war room again?</DialogTitle>
          <DialogDescription>
            {alreadyReplay
              ? "Your first run is the one on the board, and this one won't change it either. You get a full budget and a clean dashboard — it's for the practice."
              : "Your first run is the one on the board. This one won't be ranked and won't change your best score. You start again with the full analyst-day budget and a clean dashboard — it's for the practice."}
          </DialogDescription>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
              Not now
            </Button>
            <Button
              disabled={pending}
              onClick={() =>
                // `startSimulation` redirects, so there is nothing to await past
                // this point and no success branch to write.
                startTransition(async () => void (await startSimulation(questionId)))
              }
            >
              {pending ? "Starting…" : "Start a fresh run"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
