"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * The code, sized to be read from the back of a lecture hall.
 *
 * `tracking-[0.25em]` and a mono face are doing real work here rather than
 * decoration: a code is transcribed by sixty people at once, and letter-spacing
 * is what stops `RN` being read as `M`. The alphabet in `lib/rooms/code.ts`
 * removes the rest of the confusable pairs.
 *
 * The copy button copies the JOIN URL, not the code — a professor pasting into
 * a class chat wants the link, and anyone who wants just the code is reading it
 * off the screen anyway.
 */
export function RoomCode({ code, joinUrl }: { code: string; joinUrl: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(joinUrl).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      // A clipboard write can be refused (insecure origin, denied permission),
      // and a button that silently does nothing is worse than one that admits
      // it. The URL is on screen beside it either way.
      () => setCopied(false),
    );
  }

  return (
    <div className="rounded-xl border bg-muted/30 p-6 text-center">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">Room code</p>
      <p className="mt-2 font-mono text-5xl font-bold tracking-[0.25em] sm:text-6xl">{code}</p>
      <div className="mt-4 flex flex-col items-center gap-2">
        <p className="break-all text-sm text-muted-foreground">{joinUrl}</p>
        <Button size="sm" variant="secondary" onClick={copy}>
          {copied ? <Check /> : <Copy />}
          {copied ? "Copied" : "Copy join link"}
        </Button>
      </div>
    </div>
  );
}
