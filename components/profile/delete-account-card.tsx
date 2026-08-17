"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { deleteAccount } from "@/app/actions/user";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Deleting your account.
 *
 * Two things this card does deliberately.
 *
 * **It names what survives.** Classroom seats and results are kept under an
 * anonymous label so a professor's roster doesn't develop holes weeks after the
 * class — which is the right behaviour and the one thing a person cannot infer
 * from the word "delete". Leaving it to be discovered would make an honest design
 * read as a broken promise.
 *
 * **The confirmation is typing the address, not a password.** An account may not
 * have a password at all (`passwordHash` is nullable, as `changePassword` has to
 * say), and something irreversible wants a step muscle memory can't complete.
 *
 * The error renders inline rather than as a toast, matching `password-form.tsx`
 * and `auth-form.tsx`: a refusal belongs next to the field that caused it, not in
 * a corner that disappears after four seconds. There is no success toast — the
 * action redirects to the landing page, and there is no profile left to show one
 * on.
 */
export function DeleteAccountCard({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Compared the way the server compares it, so the button is never enabled on
  // something the action will then refuse.
  const matches = typed.trim().toLowerCase() === email.toLowerCase();

  function confirm() {
    setError(null);
    startTransition(async () => {
      // On success this never returns — the action clears the session and
      // redirects. Only a refusal comes back.
      const result = await deleteAccount({ confirmEmail: typed });
      if (result && !result.ok) {
        setError(result.error ?? "Couldn't delete your account.");
      }
    });
  }

  function close(next: boolean) {
    if (pending) return;
    setOpen(next);
    if (!next) {
      setTyped("");
      setError(null);
    }
  }

  return (
    <Card className="space-y-5 border-destructive/30 p-5">
      <div>
        <h2 className="font-semibold">Delete account</h2>
        <p className="text-sm text-muted-foreground">
          Permanently removes your profile, photo, practice history, evaluations and
          leaderboard results. This can&apos;t be undone.
        </p>
      </div>

      <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
        If you played a war room in a class, your result stays on that professor&apos;s
        roster as <span className="font-medium">Deleted student</span> — your score
        without your name. Everything that identifies you is destroyed.
      </p>

      <Button variant="destructive" onClick={() => setOpen(true)}>
        Delete my account
      </Button>

      <Dialog open={open} onOpenChange={close}>
        <DialogContent className="sm:max-w-md">
          <DialogTitle>Delete your account?</DialogTitle>
          <DialogDescription>
            Everything except your anonymised classroom results will be permanently
            deleted. This can&apos;t be undone.
          </DialogDescription>

          <div className="space-y-2">
            <label htmlFor="confirm-email" className="text-sm text-muted-foreground">
              Type <span className="font-medium text-foreground">{email}</span> to confirm.
            </label>
            <Input
              id="confirm-email"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              placeholder={email}
            />
          </div>

          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button variant="secondary" onClick={() => close(false)} disabled={pending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirm} disabled={!matches || pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Delete account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
