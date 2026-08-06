"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { changePassword } from "@/app/actions/user";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/profile/fields";

/**
 * Changing a password — the first way to do it in this app.
 *
 * The error renders inline rather than as a toast, matching `auth-form.tsx`: a
 * credential failure belongs next to the field that caused it, not in a corner
 * that disappears after four seconds.
 */
export function PasswordForm() {
  const [current, setCurrent] = useState("");
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
      setError("Those two new passwords don't match.");
      return;
    }

    startTransition(async () => {
      const result = await changePassword({ current, next });
      if (!result.ok) {
        setError(result.error ?? "Couldn't change your password.");
        return;
      }
      setCurrent("");
      setNext("");
      setConfirm("");
      toast.success("Password changed");
    });
  }

  return (
    <Card className="space-y-5 p-5">
      <div>
        <h2 className="font-semibold">Password</h2>
        <p className="text-sm text-muted-foreground">
          There&apos;s no reset email yet, so this is the only way to change it.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Current password" htmlFor="current">
            <Input
              id="current"
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              required
            />
          </Field>
          <Field label="New password" htmlFor="next">
            <Input
              id="next"
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              required
            />
          </Field>
          <Field label="Confirm new password" htmlFor="confirm">
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </Field>
        </div>

        {error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        {/* Stated rather than quietly untrue. `verify()` in lib/auth.ts ignores
            the timestamp in the session token and there's no revocation list,
            so other sessions genuinely do survive this. */}
        <p className="text-xs text-muted-foreground">
          Changing this won&apos;t sign you out on other devices — sessions can&apos;t be
          revoked yet. Sign out there too if that matters.
        </p>

        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          Change password
        </Button>
      </form>
    </Card>
  );
}
