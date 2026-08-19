"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { completeOnboarding } from "@/app/actions/user";
import type { InterviewLevel } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  BatchSelect,
  ProfessionSelect,
  TargetLevels,
} from "@/components/profile/fields";

/**
 * The two questions asked after signing up.
 *
 * **There is no way out of the step but through it**, and so no skip button.
 * The batch appears on every leaderboard row, so an unanswered one is a row
 * nobody can read; it was already the one answer that could not be given up,
 * and offering to dismiss a step that then refuses to be dismissed only put a
 * control on screen for the state it could not serve. `completeOnboarding` is
 * the single exit, and someone who closes the tab is sent back here by
 * `requireBatch` rather than landing anywhere useful.
 *
 * **One field is required and the rest are not.** Profession and target levels
 * can be left as they are — Finish saves whatever has been filled in — so
 * someone who signed up to try a case still gets to go and try the case, and
 * the dashboard nudge asks once more for what this didn't get.
 *
 * `initialBatch` is passed because this step is now also where an existing
 * account is sent when it has no batch — the pre-batch accounts that
 * `requireBatch` catches — so the control must be able to open with one already
 * set rather than always blank.
 */
export function WelcomeSteps({
  initialName,
  initialBatch = "",
}: {
  initialName: string;
  initialBatch?: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState<0 | 1>(0);
  const [pending, startTransition] = useTransition();

  const [batch, setBatch] = useState(initialBatch);
  const [profession, setProfession] = useState("");
  const [targetLevels, setTargetLevels] = useState<InterviewLevel[]>([]);

  function finish() {
    startTransition(async () => {
      const result = await completeOnboarding({
        batch,
        profession,
        targetLevels,
      });
      if (!result.ok) {
        toast.error(result.error ?? "Couldn't save that.");
        return;
      }
      router.push("/dashboard");
    });
  }

  return (
    <Card className="space-y-6 p-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Step {step + 1} of 2
        </p>
        <h2 className="mt-1 text-lg font-semibold">
          {step === 0 ? `Welcome, ${initialName}` : "What are you preparing for?"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {step === 0
            ? "Two quick questions so the library knows who it's talking to. Your batch is the only one we need — the rest are optional."
            : "Pick the interviews you're aiming at. The library sorts to these first, and the dashboard recommends against them."}
        </p>
      </div>

      {step === 0 ? (
        <div className="space-y-4">
          <BatchSelect value={batch} onChange={setBatch} />
          <ProfessionSelect value={profession} onChange={setProfession} />
        </div>
      ) : (
        <TargetLevels value={targetLevels} onChange={setTargetLevels} />
      )}

      {/* One group, right-aligned. The row used to be `justify-between` to hold
          the skip button out on the left; with it gone there is nothing to
          space against. */}
      <div className="flex justify-end gap-2">
        {step === 1 && (
          <Button variant="outline" onClick={() => setStep(0)} disabled={pending}>
            Back
          </Button>
        )}
        {step === 0 ? (
          <Button onClick={() => setStep(1)} disabled={pending || !batch}>
            Next <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={finish} disabled={pending}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Finish
          </Button>
        )}
      </div>
    </Card>
  );
}
