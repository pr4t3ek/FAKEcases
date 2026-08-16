"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, Lock, Unlock } from "lucide-react";
import { toast } from "sonner";
import { closeRoom, reopenRoom, resetRoomPassword } from "@/app/actions/rooms";
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
 * Close, reopen, and reset the password.
 *
 * Reset is here rather than filed under "advanced" because it is the only way
 * out of a forgotten password: the hash is one-way by design, so the console
 * genuinely cannot show what was set. Without it, a professor who mistypes the
 * password into their notes has to abandon a room students have already joined.
 */
export function RoomControls({ roomId, isOpen }: { roomId: string; isOpen: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [resetOpen, setResetOpen] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  function toggle() {
    startTransition(async () => {
      const result = await (isOpen ? closeRoom(roomId) : reopenRoom(roomId));
      if (!result.ok) {
        toast.error(result.error ?? "That didn't work.");
        return;
      }
      toast.success(isOpen ? "Room closed to new joiners" : "Room reopened");
      router.refresh();
    });
  }

  function submitReset(formData: FormData) {
    setResetError(null);
    startTransition(async () => {
      const result = await resetRoomPassword(roomId, String(formData.get("password") ?? ""));
      if (!result.ok) {
        setResetError(result.error ?? "That didn't work.");
        return;
      }
      setResetOpen(false);
      toast.success("Password changed — read out the new one");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="secondary" size="sm" disabled={pending} onClick={toggle}>
        {pending ? <Loader2 className="animate-spin" /> : isOpen ? <Lock /> : <Unlock />}
        {isOpen ? "Close the room" : "Reopen the room"}
      </Button>
      <Button variant="ghost" size="sm" disabled={pending} onClick={() => setResetOpen(true)}>
        <KeyRound /> Reset password
      </Button>

      <Dialog open={resetOpen} onOpenChange={(o) => !o && setResetOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogTitle>Set a new room password</DialogTitle>
          <DialogDescription>
            Students already in the room stay in — this only changes what new joiners need.
          </DialogDescription>
          <form action={submitReset} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-room-password">New password</Label>
              <Input
                id="new-room-password"
                name="password"
                type="text"
                minLength={6}
                placeholder="At least 6 characters"
                required
              />
            </div>
            {resetError && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {resetError}
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setResetOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="animate-spin" />}
                Change it
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
