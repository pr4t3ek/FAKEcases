"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { completeForcedPasswordChange } from "@/app/actions/user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * The one page an account can reach after an admin reset.
 *
 * A sibling of `components/profile/password-form.tsx` rather than a mode of it:
 * that one asks for the current password because it is a voluntary change, and
 * this one deliberately does not — see `completeForcedPasswordChange`. Sharing a
 * component would mean a prop that switches off a credential check, which is the
 * kind of switch that eventually gets passed by accident.
 *
 * The error renders inline rather than as a toast, matching `auth-form.tsx`.
 */
export function SetPasswordForm() {
  const router = useRouter();
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Checked here rather than in the schema: the server is never sent the
    // confirmation, because it has nothing to do with what gets stored.
    if (next !== confirm) {
      setError("Those two passwords don't match.");
      return;
    }

    startTransition(async () => {
      const result = await completeForcedPasswordChange({ next });
      if (!result.ok) {
        setError(result.error ?? "Couldn't set your password.");
        return;
      }
      toast.success("Password set");
      router.push("/dashboard");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="next">New password</Label>
        <Input
          id="next"
          type="password"
          autoComplete="new-password"
          minLength={6}
          required
          value={next}
          onChange={(e) => setNext(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">At least 6 characters, and not your email.</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="confirm">Confirm it</Label>
        <Input
          id="confirm"
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>

      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      )}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        Set password and continue
      </Button>
    </form>
  );
}
