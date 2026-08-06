"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Lock, Siren } from "lucide-react";
import { startAttempt } from "@/app/actions/attempts";
import type { UpgradePath } from "@/lib/config";
import { startSimulation } from "@/app/actions/simulations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  INTERVIEW_LEVEL_LABELS,
  answerModeFor,
  isSimulation,
  type InterviewLevel,
  type TreeMode,
} from "@/lib/types";
import { iconNameForQuestion } from "@/lib/question-icon";
import { QuestionIcon } from "@/components/library/question-icon";

interface QuestionCardData {
  id: string;
  title: string;
  prompt: string;
  difficulty: string;
  interviewLevel: string;
  type: string;
  tags: string | null;
  category: { name: string; icon: string | null };
}

const diffVariant: Record<string, "success" | "warning" | "destructive"> = {
  Easy: "success",
  Medium: "warning",
  Hard: "destructive",
};

export function QuestionCard({
  question,
  locked = false,
  upgrade = null,
}: {
  question: QuestionCardData;
  /**
   * Decided by `lib/entitlements.ts` on the server. A courtesy, not a control:
   * the same rule is re-checked in `startAttempt` and `startSimulation`, which
   * is what actually stops a hand-rolled request.
   */
  locked?: boolean;
  upgrade?: UpgradePath | null;
}) {
  // Checked BEFORE answerModeFor, which is meaningful only for the interview
  // types and would report a simulation as qualitative (see lib/types.ts).
  const simulation = isSimulation(question.type);
  const qualitative = !simulation && answerModeFor(question.type) === "qualitative";
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  /**
   * Set when the candidate asked for a mode the in-progress attempt isn't in.
   * The mode is fixed at creation, so this is a genuine fork rather than
   * something we can quietly reconcile.
   */
  const [conflict, setConflict] = useState<{
    wanted: TreeMode;
    attemptId: string;
    existing: TreeMode;
  } | null>(null);

  function begin(treeMode?: TreeMode, abandonExisting = false) {
    startTransition(async () => {
      // The action redirects on success, so anything returned is a conflict.
      const result = await startAttempt(question.id, treeMode, { abandonExisting });
      if (result?.conflict && treeMode) {
        setConflict({
          wanted: treeMode,
          attemptId: result.attemptId,
          existing: result.existingTreeMode,
        });
      }
    });
  }

  return (
    <Card
      className={
        locked
          ? "flex flex-col border-dashed p-5"
          : "flex flex-col p-5 transition-shadow hover:shadow-md"
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {locked && (
          <Badge variant="muted" className="gap-1">
            <Lock className="h-3 w-3" /> Locked
          </Badge>
        )}
        <Badge variant="secondary">{question.category.name}</Badge>
        <Badge variant={diffVariant[question.difficulty] ?? "muted"}>{question.difficulty}</Badge>
        <Badge variant="outline">
          {INTERVIEW_LEVEL_LABELS[question.interviewLevel as InterviewLevel] ?? question.interviewLevel}
        </Badge>
        {qualitative && <Badge variant="outline">Issue tree</Badge>}
        {simulation && (
          <Badge variant="outline" className="gap-1">
            <Siren className="h-3 w-3" /> Simulation
          </Badge>
        )}
      </div>
      {/* The icon carries the subject so a grid of cards can be scanned without
          reading every title — see lib/question-icon.ts. */}
      <div className={locked ? "flex flex-1 gap-3 opacity-60" : "flex flex-1 gap-3"}>
        <QuestionIcon name={iconNameForQuestion({
          title: question.title,
          tags: question.tags,
          categoryIcon: question.category.icon,
        })} />
        <div className="min-w-0">
          <h3 className="font-semibold leading-snug">{question.title}</h3>
          <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{question.prompt}</p>
        </div>
      </div>

      {locked ? (
        // A link, not a disabled button. A dead control tells someone they
        // can't have this; a link tells them how to get it, which is the whole
        // job of a locked card.
        <Button asChild className="mt-4 w-full" variant="secondary">
          <Link href={upgrade?.href ?? "/signup"}>
            <Lock /> {upgrade?.cta ?? "Sign up to unlock"}
          </Link>
        </Button>
      ) : simulation ? (
        // No mode to choose: a simulation's phases are fixed and its budget is
        // the constraint, so there is one way in.
        <Button
          onClick={() => startTransition(async () => void (await startSimulation(question.id)))}
          disabled={pending}
          className="mt-4 w-full"
        >
          Enter the war room <ArrowRight />
        </Button>
      ) : qualitative ? (
        // Chosen here and fixed for the attempt. Offering it mid-attempt would
        // make "solo" meaningless — switch to guided, take the structure, switch
        // back — so the choice is made before the timer starts.
        <div className="mt-4 space-y-2">
          <Button
            onClick={() => begin("solo")}
            disabled={pending}
            className="w-full"
            variant="outline"
          >
            Practise this <ArrowRight />
          </Button>
          <div className="text-center">
            <button
              onClick={() => begin("guided")}
              disabled={pending}
              className="text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
              title="Branches are suggested as you name each parent. You're scored on the diagnosis, not on the structure."
            >
              or try it guided — structure suggested, and not scored
            </button>
          </div>
        </div>
      ) : (
        <Button
          onClick={() => begin()}
          disabled={pending}
          className="mt-4 w-full"
          variant="outline"
        >
          Practise this <ArrowRight />
        </Button>
      )}

      <Dialog open={!!conflict} onOpenChange={(open) => !open && setConflict(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogTitle>This case is already open</DialogTitle>
          <DialogDescription>
            You have an attempt in progress in{" "}
            <strong>{conflict?.existing === "guided" ? "guided" : "solo"}</strong> mode. The mode is
            fixed when an attempt starts — switching it mid-case would make solo meaningless — so
            you can carry on with that one, or start again in{" "}
            <strong>{conflict?.wanted === "guided" ? "guided" : "solo"}</strong>.
          </DialogDescription>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => conflict && router.push(`/practice/${conflict.attemptId}`)}
            >
              Resume {conflict?.existing === "guided" ? "guided" : "solo"} attempt
            </Button>
            <Button
              onClick={() => {
                const wanted = conflict?.wanted;
                setConflict(null);
                if (wanted) begin(wanted, true);
              }}
            >
              Start fresh in {conflict?.wanted === "guided" ? "guided" : "solo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
