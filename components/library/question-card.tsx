"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Lock, RotateCcw, Siren } from "lucide-react";
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
  isHostableType,
  isSimulation,
  type InterviewLevel,
  type TreeMode,
} from "@/lib/types";
import { iconNameForQuestion } from "@/lib/question-icon";
import { QuestionIcon } from "@/components/library/question-icon";
import { ReplayButton } from "@/components/simulation/replay-button";
import { HostRoomDialog } from "@/components/rooms/host-room-dialog";
// From the pure module rather than `lib/simulations`, which reaches `server-only`.
import type { SimQuestionState } from "@/lib/sim/replay";
// Likewise: the rule is in `lib/attempt-state`, the query is in `lib/questions`.
import type { AttemptQuestionState } from "@/lib/attempt-state";

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
  simState = null,
  attemptState = null,
  canHost = false,
}: {
  question: QuestionCardData;
  /**
   * Decided by `lib/entitlements.ts` on the server. A courtesy, not a control:
   * the same rule is re-checked in `startAttempt` and `startSimulation`, which
   * is what actually stops a hand-rolled request.
   */
  locked?: boolean;
  upgrade?: UpgradePath | null;
  /**
   * Whether this simulation has been started or finished, from
   * `simStateByQuestion`. Null for a question that isn't a simulation, for a
   * signed-out visitor, and for one never touched — all three mean "offer the
   * way in", which is what the card did for everyone before this existed.
   */
  simState?: SimQuestionState | null;
  /**
   * Whether this question has been started or submitted, from
   * `attemptStateByQuestion`. Null for a simulation, for a signed-out visitor,
   * and for one never touched — all three mean "offer the way in", which is what
   * the card did for everyone before this existed.
   */
  attemptState?: AttemptQuestionState | null;
  /**
   * Whether to offer "host this in class". True only for a professor or admin.
   *
   * Whether the *question* can be hosted is `isHostableType`, checked below —
   * the same allow-list `createRoom` gates on, rather than a second idea of it
   * kept here.
   *
   * Note it is read alongside `locked` below, never instead of it: a host can
   * only open a room on a question their own account can open, which is what
   * `createRoom` enforces. Offering the control on a locked card would be an
   * offer the action then refuses — the exact failure `lib/entitlements.ts`
   * exists to prevent.
   */
  canHost?: boolean;
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

  // Submitted at least once, and nothing half-finished ahead of it. Only ever
  // true for a question, never a simulation — that card has its own three
  // branches and its own replay dialog.
  const attempted = !simulation && attemptState?.state === "attempted";

  /**
   * The quiet way back to what they already earned, matching the war-room card.
   * Worth a link rather than a second button: re-reading a report is a smaller
   * intent than sitting the question again, and the primary action should stay
   * unambiguous.
   */
  const reportLink = attempted && attemptState?.attemptId && (
    <div className="text-center">
      <Link
        href={`/practice/${attemptState.attemptId}`}
        className="text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
      >
        or read your evaluation again
      </Link>
    </div>
  );

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
        {/* What the grid was missing: it looked identical on visit 1 and visit
            40. A locked card never shows this — nothing has been played on it. */}
        {simulation && !locked && simState?.state === "in_progress" && (
          <Badge variant="warning">In progress</Badge>
        )}
        {simulation && !locked && simState?.state === "played" && (
          <Badge variant="success">
            Played{simState.bestOverall !== null && ` · ${simState.bestOverall}`}
          </Badge>
        )}
        {/* The same two badges for a question, for the same reason. No score
            shown when every attempt was walked through by Teacher mode — there
            isn't one, and a 0 here would be an invention. */}
        {!simulation && !locked && attemptState?.state === "in_progress" && (
          <Badge variant="warning">In progress</Badge>
        )}
        {!simulation && !locked && attemptState?.state === "attempted" && (
          <Badge variant="success">
            Attempted{attemptState.bestOverall !== null && ` · ${attemptState.bestOverall}`}
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
        simState?.state === "in_progress" && simState.runId ? (
          // A link, not the server action — the same reasoning as the locked
          // branch above. It is one fewer round-trip, and `startSimulation`
          // would land here anyway once `findResumableRun` found this run.
          <Button asChild className="mt-4 w-full">
            <Link href={`/simulate/${simState.runId}`}>
              Resume the war room <ArrowRight />
            </Link>
          </Button>
        ) : simState?.state === "played" ? (
          // Primary action plus a quiet way back to the report, matching the
          // shape of the qualitative branch below.
          <div className="mt-4 space-y-2">
            <ReplayButton questionId={question.id} className="w-full" />
            {simState.runId && (
              <div className="text-center">
                <Link
                  href={`/simulate/${simState.runId}`}
                  className="text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
                >
                  or read your debrief again
                </Link>
              </div>
            )}
          </div>
        ) : (
          // No mode to choose: a simulation's phases are fixed and its budget is
          // the constraint, so there is one way in.
          <Button
            onClick={() => startTransition(async () => void (await startSimulation(question.id)))}
            disabled={pending}
            className="mt-4 w-full"
          >
            Enter the war room <ArrowRight />
          </Button>
        )
      ) : attemptState?.state === "in_progress" && attemptState.attemptId ? (
        // A link, not the server action — the same reasoning as the locked and
        // war-room branches above. It is one fewer round-trip, and `startAttempt`
        // resumes the newest in-progress attempt anyway, so this is where the
        // button was always going to land.
        //
        // No mode choice offered here even on a case: the tree mode is fixed at
        // creation, so the only thing a second choice could do is raise the
        // conflict dialog against the attempt being resumed.
        <Button asChild className="mt-4 w-full">
          <Link href={`/practice/${attemptState.attemptId}`}>
            <RotateCcw /> Resume this <ArrowRight />
          </Link>
        </Button>
      ) : qualitative ? (
        // Chosen here and fixed for the attempt. Offering it mid-attempt would
        // make "solo" meaningless — switch to guided, take the structure, switch
        // back — so the choice is made before the timer starts.
        <div className="mt-4 space-y-2">
          {/* No variant, so it inherits the primary fill — the same button the
              war-room card uses. Starting a case is the primary action on this
              card, and an outline button next to a solid one reads as the
              lesser of the two. */}
          <Button onClick={() => begin("solo")} disabled={pending} className="w-full">
            {attempted ? (
              <>
                <RotateCcw /> Practise again
              </>
            ) : (
              <>
                Practise this <ArrowRight />
              </>
            )}
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
          {reportLink}
        </div>
      ) : attempted ? (
        <div className="mt-4 space-y-2">
          <Button onClick={() => begin()} disabled={pending} className="w-full">
            <RotateCcw /> Practise again
          </Button>
          {reportLink}
        </div>
      ) : (
        <Button onClick={() => begin()} disabled={pending} className="mt-4 w-full">
          Practise this <ArrowRight />
        </Button>
      )}

      {/* The professor's way in, and the literal "pick the exercise from the
          catalogue" step. It sits under whichever of the actions rendered above
          rather than inside each, because hosting is orthogonal to whether this
          host has worked it themselves. Gated on `!locked` for the reason given
          on the prop. */}
      {isHostableType(question.type) && !locked && canHost && (
        <div className="mt-2 text-center">
          <HostRoomDialog
            questionId={question.id}
            questionTitle={question.title}
            kind={simulation ? "simulation" : "practice"}
          />
        </div>
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
