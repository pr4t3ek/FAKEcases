"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { completeOnboarding, skipOnboarding } from "@/app/actions/user";
import type { InterviewLevel } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  CollegeSelect,
  GradYearSelect,
  ProfessionSelect,
  TargetLevels,
} from "@/components/profile/fields";

/**
 * The two questions asked after signing up.
 *
 * Everything is skippable, and "Skip for now" is a peer of the primary button
 * rather than a grey link underneath it. That is the point of the whole design:
 * someone who signed up to try a case gets to go and try the case. The nudge on
 * the dashboard is what asks again, once.
 *
 * What is *not* here is any promise about leaderboards or cohorts. The college
 * field is collected plainly, because none of that exists yet and this codebase
 * does not advertise what it hasn't built. What the step does claim — that
 * goals change what the library shows first — is true the moment it saves.
 */
export function WelcomeSteps({
  initialName,
}: {
  initialName: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState<0 | 1>(0);
  const [pending, startTransition] = useTransition();

  const [profession, setProfession] = useState("");
  const [collegeId, setCollegeId] = useState("");
  const [collegeOther, setCollegeOther] = useState("");
  const [gradYear, setGradYear] = useState("");
  const [targetLevels, setTargetLevels] = useState<InterviewLevel[]>([]);

  function finish() {
    startTransition(async () => {
      const result = await completeOnboarding({
        profession,
        collegeId,
        collegeOther,
        gradYear,
        targetLevels,
      });
      if (!result.ok) {
        toast.error(result.error ?? "Couldn't save that.");
        return;
      }
      router.push("/dashboard");
    });
  }

  function skip() {
    startTransition(async () => {
      await skipOnboarding();
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
            ? "Two quick questions so the library knows who it's talking to. Skip either — nothing here is required."
            : "Pick the interviews you're aiming at. The library sorts to these first, and the dashboard recommends against them."}
        </p>
      </div>

      {step === 0 ? (
        <div className="space-y-4">
          <ProfessionSelect value={profession} onChange={setProfession} />
          <CollegeSelect
            collegeId={collegeId}
            collegeOther={collegeOther}
            onCollegeId={setCollegeId}
            onCollegeOther={setCollegeOther}
          />
          <GradYearSelect value={gradYear} onChange={setGradYear} />
        </div>
      ) : (
        <TargetLevels value={targetLevels} onChange={setTargetLevels} />
      )}

      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={skip} disabled={pending}>
          Skip for now
        </Button>

        <div className="flex gap-2">
          {step === 1 && (
            <Button variant="outline" onClick={() => setStep(0)} disabled={pending}>
              Back
            </Button>
          )}
          {step === 0 ? (
            <Button onClick={() => setStep(1)} disabled={pending}>
              Next <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={finish} disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Finish
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
