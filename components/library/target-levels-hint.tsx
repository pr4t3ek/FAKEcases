"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Target } from "lucide-react";
import { INTERVIEW_LEVEL_LABELS, type InterviewLevel } from "@/lib/types";

/**
 * Showing the candidate's goals on the library, and applying them when it is
 * honest to do so.
 *
 * Three things make an unrequested filter acceptable rather than a library that
 * looks broken, and all three are required: it says *why* the list is short, it
 * clears in one click, and clearing sticks. Without the first, a quietly
 * pre-selected dropdown looks like a bug in the page.
 *
 * The applied case is deliberately narrow — one target only. `?level=` holds a
 * single value, so someone aiming at three roles has no URL that expresses
 * them, and pre-applying one of the three would show them a third of what they
 * asked for while claiming to have used their goals. They get chips instead.
 */
export function TargetLevelsHint({
  targets,
  applied,
  prefill,
}: {
  targets: InterviewLevel[];
  /** The level currently in the URL, if it is one of theirs. */
  applied: InterviewLevel | null;
  /** Decided on the server by `prefillLevel`. Null means leave the URL alone. */
  prefill: InterviewLevel | null;
}) {
  const router = useRouter();
  const done = useRef(false);

  useEffect(() => {
    if (!prefill || done.current) return;
    // Once per session. A candidate who cleared the filter and navigated back
    // to a bare /library meant it, and re-applying would make the Clear button
    // look broken.
    if (sessionStorage.getItem("eq_library_prefilled")) return;
    done.current = true;
    sessionStorage.setItem("eq_library_prefilled", "1");
    router.replace(`/library?level=${prefill}`);
  }, [prefill, router]);

  if (targets.length === 0) return null;

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
      <Target className="h-4 w-4 shrink-0 text-muted-foreground" />
      {applied ? (
        <>
          <span className="text-muted-foreground">
            Showing your target level, {INTERVIEW_LEVEL_LABELS[applied]}.
          </span>
          <Link
            href="/library"
            className="font-medium text-primary underline underline-offset-4"
          >
            Show everything
          </Link>
        </>
      ) : (
        <>
          <span className="text-muted-foreground">You&apos;re preparing for</span>
          {targets.map((level) => (
            <Link
              key={level}
              href={`/library?level=${level}`}
              className="rounded-full border border-input px-2.5 py-0.5 text-xs font-medium transition-colors hover:border-foreground/30"
            >
              {INTERVIEW_LEVEL_LABELS[level]}
            </Link>
          ))}
        </>
      )}
    </div>
  );
}
