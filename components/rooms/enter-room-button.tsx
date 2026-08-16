"use client";

import { useTransition } from "react";
import { ArrowRight } from "lucide-react";
import { startRoomRun } from "@/app/actions/simulations";
import { Button } from "@/components/ui/button";

/**
 * The way into the room's war room.
 *
 * Calls the action rather than linking, because there is no run id to link to
 * yet — `startRoomRun` derives the question from the room, mints the run and
 * redirects. It takes only the code for that reason: a question id from the
 * client would have to be cross-checked against the room's, forever.
 */
export function EnterRoomButton({ code }: { code: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      className="w-full"
      disabled={pending}
      onClick={() => startTransition(async () => void (await startRoomRun(code)))}
    >
      Enter the war room <ArrowRight />
    </Button>
  );
}
