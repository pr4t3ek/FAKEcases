"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserRoundPen } from "lucide-react";
import { skipOnboarding } from "@/app/actions/user";
import { Button } from "@/components/ui/button";

/**
 * Asks once for what the post-signup step didn't get.
 *
 * "Not now" is a real dismissal, not a re-prompt on the next page load: it sets
 * the same `profileCompletedAt` the step does, because that flag means "has
 * been asked" rather than "has answered". A banner that cannot be turned off is
 * a soft block, and this app's whole posture is that nothing blocks practising.
 * The profile stays reachable from the account menu afterwards.
 *
 * The claim it makes is the one that is already true — goals steer the library
 * and the recommendations below. It does not mention leaderboards, which don't
 * exist.
 */
export function ProfileNudge() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
      <UserRoundPen className="h-5 w-5 shrink-0 text-primary" />
      <span className="flex-1">
        Tell us what you&apos;re preparing for and the library will put those questions first.
        Takes about a minute.
      </span>
      <div className="flex gap-2">
        <Button asChild size="sm">
          <Link href="/welcome">Add details</Link>
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await skipOnboarding();
              router.refresh();
            })
          }
        >
          Not now
        </Button>
      </div>
    </div>
  );
}
