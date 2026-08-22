"use client";

import { useTransition } from "react";
import { ArrowRight } from "lucide-react";
import { startRoomAttempt } from "@/app/actions/attempts";
import { Button } from "@/components/ui/button";

/**
 * The way into the room's guesstimate.
 *
 * A sibling of `EnterRoomButton` rather than a variant of it, because the two
 * call different actions — and it takes only the code for the same reason that
 * one does: `startRoomAttempt` derives the question from the room, mints the
 * attempt and redirects, so a question id from the client would have to be
 * cross-checked against the room's, forever.
 */
export function StartPracticeButton({ code }: { code: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      className="w-full"
      disabled={pending}
      onClick={() => startTransition(async () => void (await startRoomAttempt(code)))}
    >
      Start the guesstimate <ArrowRight />
    </Button>
  );
}
