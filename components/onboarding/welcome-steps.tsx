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
  BatchSelect,
  CollegeSelect,
  GradYearSelect,
  ProfessionSelect,
  TargetLevels,
} from "@/components/profile/fields";

/**
 * The two questions asked after signing up.
 *
 * **One field is required and the rest are not**, which is a change from "skip
 * anything": the batch appears on every leaderboard row beside the college, so
 * an unanswered one is a row nobody can read. "Skip for now" is hidden until a
 * batch is picked rather than disabled with an explanation, because a button
 * that refuses is worse than a button that is not offered yet — and
 * `skipOnboarding` refuses the same case server-side, so hiding it is a
 * courtesy rather than the control.
 *
 * Everything else keeps the original posture: someone who signed up to try a
 * case gets to go and try the case, and the dashboard nudge asks once more.
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
  const [collegeId, setCollegeId] = useState("");
  const [collegeOther, setCollegeOther] = useState("");
  const [gradYear, setGradYear] = useState("");
  const [targetLevels, setTargetLevels] = useState<InterviewLevel[]>([]);

  function finish() {
    startTransition(async () => {
      const result = await completeOnboarding({
        batch,
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
            ? "Two quick questions so the library knows who it's talking to. Your batch is the only one we need — skip the rest."
            : "Pick the interviews you're aiming at. The library sorts to these first, and the dashboard recommends against them."}
        </p>
      </div>

      {step === 0 ? (
        <div className="space-y-4">
          <BatchSelect value={batch} onChange={setBatch} />
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
        {/* Hidden rather than disabled while the required answer is missing —
            and it sits in an empty span so the primary button stays where it
            was, on the right. */}
        <span>
          {batch && (
            <Button variant="ghost" onClick={skip} disabled={pending}>
              Skip for now
            </Button>
          )}
        </span>

        <div className="flex gap-2">
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
      </div>
    </Card>
  );
}
