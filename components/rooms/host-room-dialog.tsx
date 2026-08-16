"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Presentation } from "lucide-react";
import { createRoom } from "@/app/actions/rooms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * "Host this in class", on the war-room card itself.
 *
 * This is the professor's actual entry point, and it is on the catalogue rather
 * than behind a separate picker because that is where the decision is made: a
 * professor browsing scenarios for next week's session is already looking at the
 * thing they want to host. A second grid under `/host/new` would have been the
 * same list, filtered the same way, reached one click later.
 *
 * Rendered only on cards the host can actually open — the UI half of the tier
 * gate `createRoom` enforces. A "Host this" button on a locked card would be an
 * offer the action then refuses, which is the exact failure
 * `lib/entitlements.ts` is written to prevent.
 */
export function HostRoomDialog({
  questionId,
  questionTitle,
  className,
}: {
  questionId: string;
  questionTitle: string;
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createRoom({
        questionId,
        name: String(formData.get("name") ?? ""),
        password: String(formData.get("password") ?? ""),
      });
      if (!result.ok || !result.code) {
        setError(result.error ?? "That didn't work.");
        return;
      }
      // Straight to the console: the professor's next action is always to read
      // the code out, and it is the one thing this flow exists to produce.
      router.push(`/host/${result.code}`);
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={
          className ??
          "text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
        }
      >
        or host this in class
      </button>

      <Dialog open={open} onOpenChange={(o) => !o && setOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogTitle className="flex items-center gap-2">
            <Presentation className="h-5 w-5 text-primary" /> Host a classroom room
          </DialogTitle>
          <DialogDescription>
            Students join <strong>{questionTitle}</strong> with a code and this password — no
            account needed. Everyone plays their own run at their own pace, and you watch the
            roster fill in.
          </DialogDescription>

          <form action={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="room-name">Room name</Label>
              <Input
                id="room-name"
                name="name"
                placeholder="Tue 4pm, Section B"
                maxLength={60}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="room-password">Password</Label>
              <Input
                id="room-password"
                name="password"
                type="text"
                placeholder="At least 6 characters"
                minLength={6}
                required
              />
              {/* Said before it matters rather than after: the hash is one-way,
                  so this is genuinely the last time this string is visible. */}
              <p className="text-xs text-muted-foreground">
                Shown as plain text so you can read it out. It&apos;s stored hashed, so it
                can&apos;t be shown again later — you can reset it from the console.
              </p>
            </div>

            {error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="animate-spin" />}
                Open the room
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
