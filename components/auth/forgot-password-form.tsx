"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * The reset flow's UI, with no delivery behind it.
 *
 * It used to accept an email and answer "a reset link is on its way", which is
 * the one thing it must not say — a user who believes it waits for mail that
 * will never arrive, and the disclaimer under it was easy to miss. Until an
 * email provider is wired up, the form says so before it takes anything.
 */
export function ForgotPasswordForm() {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2.5 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
        <div>
          <p className="font-medium">Password reset isn&apos;t available yet.</p>
          <p className="mt-1 text-muted-foreground">
            No email provider is configured on this deployment, so nothing will be sent. Sign
            in with the demo account, or create a new one.
          </p>
        </div>
      </div>

      <div className="space-y-1.5 opacity-50">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" placeholder="you@example.com" disabled />
      </div>
      <Button className="w-full" disabled>
        Send reset link
      </Button>

      <Button asChild variant="outline" className="w-full">
        <Link href="/signup">Create a new account instead</Link>
      </Button>
    </div>
  );
}
