"use client";

import { useState } from "react";
import { DoorOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { JoinForm } from "./join-form";

/**
 * "Join room", from the header.
 *
 * The classroom flow already existed end to end — `/join`, `JoinForm` and the
 * rate-limited `joinRoom` action — but the only way to reach it was to type the
 * URL off a projector. A student already inside the app had no door.
 *
 * ## Why a dialog rather than a link to /join
 *
 * `/join` renders in `AuthShell`, deliberately: it is the page someone lands on
 * with no account and no business being shown a nav bar for one. Linking to it
 * from the nav would drop a signed-in student onto a page with no navigation and
 * no way back except the browser button. Fixing that by giving `/join` a second
 * shell would make one page serve two audiences; a dialog leaves it doing the one
 * job it was written for.
 *
 * A dialog is also simply the right shape here. Three fields copied off a
 * whiteboard is not a destination, and the student is usually mid-something —
 * browsing the catalogue when the professor reads out a code.
 *
 * `JoinForm` is reused untouched. It already redirects to `/room/<code>` on
 * success, so nothing here needs to know what happens after the password
 * verifies, and the single-refusal-message rule the server enforces stays in the
 * one component that implements it.
 */
export function JoinRoomDialog({
  /** Match the surrounding nav items, or stand alone as a button for guests. */
  variant = "nav",
  className,
}: {
  variant?: "nav" | "button";
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {variant === "nav" ? (
        <button
          onClick={() => setOpen(true)}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
            className,
          )}
        >
          Join room
        </button>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setOpen(true)}
          className={className}
        >
          <DoorOpen className="h-4 w-4" />
          Join room
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogTitle>Join a classroom room</DialogTitle>
          <DialogDescription>
            Enter the code and password your professor read out.
          </DialogDescription>
          <JoinForm />
        </DialogContent>
      </Dialog>
    </>
  );
}
